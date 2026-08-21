import { NextResponse } from 'next/server'

import { esEquipo, obtenerSesion } from '@/lib/auth/sesion'
import { emitirCertificado, urlDescarga } from '@/lib/certificados/emision'
import { normalizarFolio, pareceFolio } from '@/lib/certificados/folio'
import { crearClienteServiceRole } from '@/lib/supabase/service-role'

/**
 * Descarga del PDF (§3.6).
 *
 * Con sesión, y no porque el folio sea secreto —lo es, pero eso protege la
 * *verificación* pública, que es otra cosa—, sino porque el PDF vive en un
 * bucket privado y §4 exige que el contenido privado se sirva por signed URL
 * generada server-side. Aquí se genera una de 60 segundos y se redirige.
 *
 * Descargan el dueño y el equipo. El equipo porque soporte necesita poder
 * reenviarle a un alumno su certificado sin pedirle que lo busque él.
 *
 * Si el PDF no está —render fallido, archivo perdido— se regenera al vuelo con
 * el MISMO folio antes de firmar. Un certificado emitido nunca es una descarga
 * rota.
 */
export async function GET(
  _peticion: Request,
  contexto: { params: Promise<{ folio: string }> }
) {
  const { folio: crudo } = await contexto.params
  const folio = normalizarFolio(crudo)

  if (!pareceFolio(folio)) {
    return NextResponse.json({ error: 'Folio inválido.' }, { status: 400 })
  }

  const sesion = await obtenerSesion()
  if (sesion.tipo !== 'activo') {
    return NextResponse.json({ error: 'Necesitas iniciar sesión.' }, { status: 401 })
  }

  const servicio = crearClienteServiceRole()
  const { data: certificado } = await servicio
    .from('certificates')
    .select('user_id, course_id, pdf_path')
    .eq('folio', folio)
    .maybeSingle()

  // Mismo 404 para "no existe" y "no es tuyo": distinguirlos le confirmaría a
  // un curioso que el folio es real.
  const propio = certificado?.user_id === sesion.perfil.user_id
  if (!certificado || (!propio && !esEquipo(sesion.perfil))) {
    return NextResponse.json({ error: 'Certificado no encontrado.' }, { status: 404 })
  }

  let ruta = certificado.pdf_path

  if (!ruta) {
    const rehecho = await emitirCertificado(certificado.user_id, certificado.course_id)
    if (!rehecho.ok || !rehecho.certificado.rutaPdf) {
      return NextResponse.json(
        { error: 'El certificado existe pero su PDF no se pudo generar.' },
        { status: 503 }
      )
    }
    ruta = rehecho.certificado.rutaPdf
  }

  const url = await urlDescarga(ruta)
  if (!url) {
    return NextResponse.json({ error: 'No se pudo preparar la descarga.' }, { status: 503 })
  }

  return NextResponse.redirect(url, { status: 302 })
}
