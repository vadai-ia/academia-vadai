import 'server-only'

import { renderToBuffer } from '@react-pdf/renderer'

import { crearClienteServiceRole } from '@/lib/supabase/service-role'

import { revisarElegibilidad, type Elegibilidad } from './elegibilidad'
import { generarFolio } from './folio'
import { Certificado } from './plantilla'

/**
 * Emisión del certificado (§3.6).
 *
 * Todo pasa por service role, y no por comodidad: el alumno no tiene ni debe
 * tener permiso de escribir en `certificates` —la tabla tiene RLS con policy de
 * lectura solamente— porque si lo tuviera podría insertarse un certificado de
 * un curso que no terminó. La decisión de emitir la toma el servidor tras
 * revisar la elegibilidad, igual que la calificación de un quiz (§3.4).
 *
 * La emisión es idempotente por dos vías que se refuerzan: primero se busca el
 * certificado existente, y si aun así dos peticiones simultáneas llegaran a la
 * vez, el `unique (user_id, course_id)` de M1 hace que solo una gane. La
 * perdedora vuelve a leer y devuelve el mismo folio. Un alumno no puede tener
 * dos certificados del mismo curso ni por accidente ni a propósito.
 */

const BUCKET = 'academia-certificados'

export type CertificadoEmitido = {
  folio: string
  emitidoEn: string
  rutaPdf: string | null
  yaExistia: boolean
}

export type ResultadoEmision =
  | { ok: true; certificado: CertificadoEmitido }
  | { ok: false; motivo: string; elegibilidad?: Elegibilidad }

function registrar(operacion: string, detalle: Record<string, unknown>) {
  console.error(JSON.stringify({ operacion, ...detalle }))
}

function urlVerificacion(folio: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '')
  return `${base || 'https://academia.vadai.com.mx'}/certificado/${folio}`
}

/** Busca el certificado ya emitido, si lo hay. */
export async function certificadoExistente(
  userId: string,
  cursoId: string
): Promise<CertificadoEmitido | null> {
  const servicio = crearClienteServiceRole()

  const { data } = await servicio
    .from('certificates')
    .select('folio, issued_at, pdf_path')
    .eq('user_id', userId)
    .eq('course_id', cursoId)
    .maybeSingle()

  if (!data) return null

  return {
    folio: data.folio,
    emitidoEn: data.issued_at,
    rutaPdf: data.pdf_path,
    yaExistia: true,
  }
}

/**
 * Genera el PDF y lo sube. Se separa de la fila para poder regenerarlo si el
 * archivo se perdiera sin tener que reemitir el certificado ni cambiar el folio:
 * el folio impreso de un alumno tiene que seguir siendo el mismo para siempre.
 */
async function subirPdf(opciones: {
  userId: string
  folio: string
  nombre: string
  curso: string
  emitidoEn: Date
}): Promise<string | null> {
  const { userId, folio, nombre, curso, emitidoEn } = opciones
  const servicio = crearClienteServiceRole()
  const ruta = `${userId}/${folio}.pdf`

  try {
    const pdf = await renderToBuffer(
      Certificado({
        nombre,
        curso,
        folio,
        emitidoEn,
        urlVerificacion: urlVerificacion(folio),
      })
    )

    const { error } = await servicio.storage.from(BUCKET).upload(ruta, pdf, {
      contentType: 'application/pdf',
      upsert: true,
    })

    if (error) {
      registrar('certificado:subir', { folio, error: error.message })
      return null
    }

    return ruta
  } catch (error) {
    registrar('certificado:render', {
      folio,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

export async function emitirCertificado(
  userId: string,
  cursoId: string
): Promise<ResultadoEmision> {
  const servicio = crearClienteServiceRole()

  // 1. ¿Ya lo tiene? El folio no se reemite jamás.
  const previo = await certificadoExistente(userId, cursoId)
  if (previo) {
    // El PDF pudo perderse aunque la fila siga. Se regenera con el mismo folio.
    if (previo.rutaPdf) return { ok: true, certificado: previo }

    const datos = await datosParaPdf(userId, cursoId)
    if (!datos) return { ok: true, certificado: previo }

    const ruta = await subirPdf({
      userId,
      folio: previo.folio,
      nombre: datos.nombre,
      curso: datos.curso,
      emitidoEn: new Date(previo.emitidoEn),
    })

    if (ruta) {
      await servicio.from('certificates').update({ pdf_path: ruta }).eq('folio', previo.folio)
    }

    return { ok: true, certificado: { ...previo, rutaPdf: ruta } }
  }

  // 2. ¿Se lo ganó? Esto se decide aquí y no en el botón.
  const elegibilidad = await revisarElegibilidad(userId, cursoId)
  if (!elegibilidad.cumple) {
    return {
      ok: false,
      motivo:
        elegibilidad.totalObligatorias === 0
          ? 'Este curso todavía no tiene lecciones obligatorias.'
          : 'Todavía te falta contenido por completar.',
      elegibilidad,
    }
  }

  const datos = await datosParaPdf(userId, cursoId)
  if (!datos) {
    registrar('certificado:datos', { userId, cursoId })
    return { ok: false, motivo: 'No se pudieron leer tus datos.' }
  }

  // Sin nombre no se emite, y no es un capricho: el folio queda para siempre y
  // la página pública de verificación la abre cualquiera. Caer al correo, como
  // hace el PDF, publicaría la dirección del alumno a quien tenga el folio.
  if (datos.nombre === '') {
    return {
      ok: false,
      motivo: 'Agrega tu nombre en tu perfil antes de generar el certificado.',
    }
  }

  // 3. La fila primero, el PDF después. Si el render fallara, el certificado
  //    existe y es verificable por folio; el PDF se regenera al descargarlo.
  //    Al revés —PDF primero— un fallo al insertar dejaría archivos huérfanos.
  const emitidoEn = new Date()
  const folio = generarFolio(emitidoEn)

  const { error } = await servicio.from('certificates').insert({
    user_id: userId,
    course_id: cursoId,
    folio,
    issued_at: emitidoEn.toISOString(),
  })

  if (error) {
    // Carrera perdida contra otra petición: el certificado ya existe y es el
    // bueno. `23505` es unique_violation.
    if (error.code === '23505') {
      const ganador = await certificadoExistente(userId, cursoId)
      if (ganador) return { ok: true, certificado: ganador }
    }
    registrar('certificado:insertar', { userId, cursoId, error: error.message })
    return { ok: false, motivo: 'No se pudo emitir el certificado.' }
  }

  const ruta = await subirPdf({
    userId,
    folio,
    nombre: datos.nombre,
    curso: datos.curso,
    emitidoEn,
  })

  if (ruta) {
    await servicio.from('certificates').update({ pdf_path: ruta }).eq('folio', folio)
  }

  return {
    ok: true,
    certificado: {
      folio,
      emitidoEn: emitidoEn.toISOString(),
      rutaPdf: ruta,
      yaExistia: false,
    },
  }
}

async function datosParaPdf(
  userId: string,
  cursoId: string
): Promise<{ nombre: string; curso: string } | null> {
  const servicio = crearClienteServiceRole()

  const [{ data: perfil }, { data: curso }] = await Promise.all([
    servicio.from('profiles').select('full_name').eq('user_id', userId).maybeSingle(),
    servicio.from('courses').select('title').eq('id', cursoId).maybeSingle(),
  ])

  if (!perfil || !curso) return null

  // Vacío si no hay nombre: emitirCertificado lo rechaza antes de generar nada.
  return { nombre: perfil.full_name.trim(), curso: curso.title }
}

/** Signed URL de descarga. Corta a propósito: se usa y se tira. */
export async function urlDescarga(rutaPdf: string): Promise<string | null> {
  const servicio = crearClienteServiceRole()

  const { data, error } = await servicio.storage.from(BUCKET).createSignedUrl(rutaPdf, 60)

  if (error) {
    registrar('certificado:firmar', { rutaPdf, error: error.message })
    return null
  }

  return data.signedUrl
}
