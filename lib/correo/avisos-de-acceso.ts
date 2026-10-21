import 'server-only'

import { randomUUID } from 'node:crypto'

import type { LlamadaRpc } from '@/lib/alumno/catalogo'
import { crearEnlacesDurables } from '@/lib/auth/enlace-durable'
import {
  conteoVacio,
  cursosDelCambio,
  decidirCorreo,
  titulosDelCambio,
  type CambioDeAcceso,
  type ConteoDeAvisos,
  type Decision,
  type OrigenCorreoAcceso,
  type TipoCorreoAcceso,
} from '@/lib/correo/decision'
import {
  plantillaBienvenida,
  plantillaNuevaGeneracion,
  plantillaNuevoCurso,
  plantillaRecordatorio,
  type Plantilla,
} from '@/lib/correo/plantillas'
import { enviarCorreosEnLote } from '@/lib/correo/resend'
import { fechasDeGeneracion, nombreCortoDeGeneracion } from '@/lib/generaciones'
import { esCuentaQa } from '@/lib/qa'
import type { Database } from '@/lib/supabase/types'
import { crearClienteServiceRole } from '@/lib/supabase/service-role'

/**
 * Manda el correo de acceso que le toca a cada persona y lo anota (M25).
 *
 * TODO camino que da una cuenta, un curso o una generación termina aquí: el
 * alta manual y la masiva, agregar desde un curso o desde la ficha, el webhook
 * de Stripe, el de la membresía, las encuestas, el recordatorio y los
 * reenvíos. Qué correo le toca a quién lo decide `decidirCorreo`
 * (lib/correo/decision.ts); aquí se arma, se manda y se escribe.
 *
 * La bitácora (`access_emails`, migración 0047) se escribe ANTES de mandar,
 * como `pendiente`: si el envío no termina —un timeout de la server action—
 * la fila se queda así y a los 15 minutos cuenta como fallida, en vez de
 * desaparecer sin rastro. Después se cierra con lo que respondió Resend.
 *
 * Nada de esto puede tumbar un alta (CLAUDE.md): un fallo de correo o de la
 * bitácora solo se registra y se reporta en el resultado.
 *
 * Service role: es provisioning. Las ligas y la bitácora no tienen políticas
 * de escritura para nadie; quien llama ya pasó por `exigirAdmin()` /
 * `exigirEquipo()`, o es un webhook firmado.
 */

type Fila = Database['academia']['Tables']['access_emails']['Insert'] & { id: string }

function registrar(operacion: string, detalle: Record<string, unknown>) {
  console.log(JSON.stringify({ operacion, ...detalle }))
}

function armarPlantilla(
  c: CambioDeAcceso,
  d: Exclude<Decision, { tipo: null }>,
  url: string | null,
  base: string | undefined
): Plantilla {
  const titulos = titulosDelCambio(c)
  switch (d.tipo) {
    case 'bienvenida':
      return plantillaBienvenida({ url: url ?? '', cursos: titulos, nombre: c.nombre, base })
    case 'recordatorio':
      return plantillaRecordatorio({ url: url ?? '', cursos: titulos, nombre: c.nombre, base })
    case 'nuevo_curso':
      return plantillaNuevoCurso({ cursos: titulos, nombre: c.nombre, base })
    case 'nueva_generacion':
      return plantillaNuevaGeneracion({
        nombre: c.nombre,
        curso: d.generacion.cursoTitulo,
        cursoSlug: d.generacion.cursoSlug,
        generacion: nombreCortoDeGeneracion(d.generacion.nombre),
        fechas: fechasDeGeneracion(d.generacion.startsOn, d.generacion.endsOn),
        urlAcceso: url,
        otrosCursos: titulos,
        base,
      })
  }
}

export async function avisarAccesos(
  cambios: CambioDeAcceso[],
  opciones: { origen: OrigenCorreoAcceso; creadoPor?: string | null; loteId?: string }
): Promise<ConteoDeAvisos> {
  const conteo = conteoVacio()
  if (cambios.length === 0) return conteo

  const loteId = opciones.loteId ?? randomUUID()
  const base = process.env.NEXT_PUBLIC_APP_URL
  const decididos = cambios.map((c) => ({ c, d: decidirCorreo(c) }))

  // 1. Quien no tiene nada nuevo no recibe nada; se cuenta para el resumen.
  for (const { c, d } of decididos) {
    if (d.tipo !== null) continue
    conteo.sinCambio += 1
    if (!c.yaEntro && !c.cuentaNueva) conteo.sinCambioSinEntrar += 1
  }
  const porMandar = decididos.filter(
    (x): x is { c: CambioDeAcceso; d: Exclude<Decision, { tipo: null }> } => x.d.tipo !== null
  )
  if (porMandar.length === 0) return conteo

  // 2. Las ligas de 30 días, de un jalón: un insert para todo el lote.
  const conEnlace = porMandar.filter(({ d }) => d.conEnlace).map(({ c }) => c.email)
  const enlaces =
    conEnlace.length > 0 ? await crearEnlacesDurables({ emails: conEnlace, creadoPor: opciones.creadoPor }) : new Map()

  // 3. Una fila y un correo por persona.
  const filas: Fila[] = []
  const correos: Array<{ fila: number; para: string; asunto: string; html: string; texto: string }> = []

  for (const { c, d } of porMandar) {
    const email = c.email.trim().toLowerCase()
    const enlace = d.conEnlace ? enlaces.get(email) : undefined
    const fila: Fila = {
      id: randomUUID(),
      user_id: c.userId,
      email,
      tipo: d.tipo,
      origen: opciones.origen,
      con_enlace: Boolean(enlace),
      access_link_id: enlace?.id ?? null,
      course_ids: cursosDelCambio(c),
      cohort_id: d.tipo === 'nueva_generacion' ? d.generacion.cohorteId : null,
      estado: 'pendiente',
      lote_id: loteId,
      es_qa: esCuentaQa(email),
      creado_por: opciones.creadoPor ?? null,
    }

    if (d.conEnlace && !enlace) {
      // Sin liga no tiene caso mandar una bienvenida que no abre nada.
      fila.estado = 'fallido'
      fila.motivo = 'No se pudo generar la liga de acceso.'
      filas.push(fila)
      continue
    }

    const plantilla = armarPlantilla(c, d, enlace?.url ?? null, base)
    correos.push({ fila: filas.length, para: email, asunto: plantilla.asunto, html: plantilla.html, texto: plantilla.texto })
    filas.push(fila)
  }

  // 4. La bitácora, antes de intentar.
  const supabase = crearClienteServiceRole()
  const { error: errorAlta } = await supabase.from('access_emails').insert(filas)
  if (errorAlta) {
    registrar('avisarAccesos:bitacora', { origen: opciones.origen, loteId, error: errorAlta.message })
  }

  // 5. Mandar, y repartir lo que respondió Resend fila por fila.
  const resultado = await enviarCorreosEnLote(correos.map(({ para, asunto, html, texto }) => ({ para, asunto, html, texto })))
  for (const [i, r] of resultado.porDestinatario.entries()) {
    const fila = filas[correos[i]!.fila]!
    fila.estado = r.estado
    fila.motivo = r.motivo ? r.motivo.slice(0, 500) : null
    fila.resend_id = r.id ?? null
  }

  // 6. Cerrar las filas con su estado final.
  if (!errorAlta) {
    const { error: errorCierre } = await supabase.from('access_emails').upsert(filas, { onConflict: 'id' })
    if (errorCierre) {
      registrar('avisarAccesos:cierre', { origen: opciones.origen, loteId, error: errorCierre.message })
    }
  }

  // 7. El conteo para el aviso del panel.
  for (const [i, fila] of filas.entries()) {
    const tipo = fila.tipo as TipoCorreoAcceso
    if (fila.estado === 'enviado') {
      conteo.porTipo[tipo] += 1
      const d = porMandar[i]!.d
      if (d.tipo === 'nueva_generacion') {
        const nombre = nombreCortoDeGeneracion(d.generacion.nombre)
        if (!conteo.generaciones.includes(nombre)) conteo.generaciones.push(nombre)
      }
    } else if (fila.estado === 'omitido') {
      conteo.omitidos += 1
    } else {
      conteo.fallidos.push({ email: fila.email, motivo: fila.motivo ?? 'sin detalle' })
    }
  }

  registrar('avisarAccesos', {
    origen: opciones.origen,
    loteId,
    personas: cambios.length,
    enviados: Object.values(conteo.porTipo).reduce((a, b) => a + b, 0),
    omitidos: conteo.omitidos,
    fallidos: conteo.fallidos.length,
    sinCambio: conteo.sinCambio,
  })
  return conteo
}

/**
 * La bitácora no crece para siempre: las filas QA se van a los 7 días y las
 * reales a los 24 meses (`academia_purgar_correos`, 0047). La llama el cron
 * diario. null si falló o si la migración aún no está.
 */
export async function purgarBitacoraDeCorreos(): Promise<number | null> {
  const supabase = crearClienteServiceRole()
  const rpc = (supabase.rpc as unknown as LlamadaRpc).bind(supabase)
  const { data, error } = await rpc('academia_purgar_correos')
  if (error) {
    registrar('purgarBitacoraDeCorreos', { error: error.message })
    return null
  }
  return typeof data === 'number' ? data : Number(data ?? 0)
}
