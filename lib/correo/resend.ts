import 'server-only'

import { direccionValida, repartirLote, type ResultadoPorDestinatario } from '@/lib/correo/decision'

/**
 * Envío de correo por la API de Resend.
 *
 * POR QUÉ NO POR SMTP DE SUPABASE (decidido 21-ago-2026)
 * La ruta SMTP fallaba con un `500 unexpected_failure` que no dice nada, y los
 * logs de Resend confirmaron que los intentos de Supabase nunca llegaban a
 * Resend siquiera. Depurar una caja negra a un mes del lanzamiento no es un
 * plan.
 *
 * Mandar desde aquí además arregla algo que ya era un problema: las plantillas
 * default de Supabase están en inglés y sin marca. El primer correo que recibe
 * un alumno que acaba de pagar no puede decir "Follow this link to reset your
 * password" (§0: cero jerga, español, sensación premium).
 */

const API = 'https://api.resend.com/emails'

/**
 * A estas direcciones NO se les manda correo, nunca.
 *
 * `academia.vadai.com.mx` no tiene registro MX, así que todo correo a un buzón
 * de ese dominio **rebota duro**. Y las cuentas QA viven ahí: cada corrida de la
 * suite de Stripe provisiona `qa-stripe@` y le manda la bienvenida. Se
 * acumularon 14 rebotes antes de que alguien lo notara, y Resend ya había
 * empezado a suprimir la dirección.
 *
 * Eso no es un detalle de laboratorio. La cuenta de Resend es COMPARTIDA con los
 * otros dominios de VADAI, así que la tasa de rebote de nuestras pruebas se
 * cobra sobre la reputación de envío de todos — justo la que §6.1 necesita
 * intacta para que las 40 invitaciones del lanzamiento lleguen a bandeja.
 *
 * El corte va aquí y no en cada prueba: en la capa de envío no se puede olvidar,
 * y cubre todos los caminos —bienvenida, recuperación, reenvío de acceso— sin
 * que quien escriba la siguiente prueba tenga que acordarse.
 */
const DOMINIO_QA = '@academia.vadai.com.mx'

/** La cuenta «Equipo VADAI» (M20): es un bot, su dirección no tiene buzón. */
const SIN_BUZON = new Set(['equipo@academia.vadai.com.mx'])

function esDireccionQA(para: string): boolean {
  const limpia = para.trim().toLowerCase()
  return (limpia.startsWith('qa-') && limpia.endsWith(DOMINIO_QA)) || SIN_BUZON.has(limpia)
}

export type ResultadoCorreo = {
  ok: boolean
  id?: string
  motivo?: string
  /** true cuando no se mandó por ser dirección de prueba. */
  omitido?: boolean
}

function remitente(): string {
  const direccion = process.env.CORREO_REMITENTE ?? 'noreply@automail.vadai.com.mx'
  const nombre = process.env.CORREO_REMITENTE_NOMBRE ?? 'VADAI Academia'
  return `${nombre} <${direccion}>`
}

/**
 * A dónde llegan las respuestas.
 *
 * El remitente es un `noreply@` sin buzón, y la bienvenida dice "responde este
 * correo y te ayudamos": sin esta cabecera esa respuesta se perdería.
 */
function responderA(): string {
  return process.env.CORREO_RESPONDER_A ?? 'ayuda@vadai.com.mx'
}

export function correoConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

export async function enviarCorreo(opciones: {
  para: string
  asunto: string
  html: string
  texto: string
}): Promise<ResultadoCorreo> {
  const llave = process.env.RESEND_API_KEY

  if (!llave) {
    console.error(JSON.stringify({ operacion: 'enviarCorreo', error: 'falta RESEND_API_KEY' }))
    return { ok: false, motivo: 'Correo no configurado.' }
  }

  // Devuelve ok: quien llama no debe tratar esto como un fallo, porque no lo es.
  // Un alta QA tiene que seguir su curso igual que un alta real.
  if (esDireccionQA(opciones.para)) {
    console.log(
      JSON.stringify({ operacion: 'enviarCorreo:omitido', para: opciones.para, motivo: 'QA' })
    )
    return { ok: true, omitido: true }
  }

  try {
    const respuesta = await fetch(API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${llave}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: remitente(),
        reply_to: responderA(),
        to: [opciones.para],
        subject: opciones.asunto,
        html: opciones.html,
        text: opciones.texto,
      }),
      signal: AbortSignal.timeout(15_000),
    })

    const cuerpo = (await respuesta.json().catch(() => null)) as
      | { id?: string; message?: string }
      | null

    if (!respuesta.ok) {
      // A diferencia del SMTP de Supabase, aquí el motivo es legible y queda en
      // el log: llave inválida, dominio sin verificar, destinatario rechazado.
      console.error(
        JSON.stringify({
          operacion: 'enviarCorreo',
          para: opciones.para,
          status: respuesta.status,
          error: cuerpo?.message ?? 'sin detalle',
        })
      )
      return { ok: false, motivo: cuerpo?.message ?? `HTTP ${respuesta.status}` }
    }

    console.log(
      JSON.stringify({ operacion: 'enviarCorreo:ok', para: opciones.para, id: cuerpo?.id })
    )
    return { ok: true, id: cuerpo?.id }
  } catch (error) {
    const motivo = error instanceof Error ? error.message : 'error desconocido'
    console.error(JSON.stringify({ operacion: 'enviarCorreo', para: opciones.para, error: motivo }))
    return { ok: false, motivo }
  }
}

export type CorreoEnLote = { para: string; asunto: string; html: string; texto: string }

export type ResultadoLote = {
  /** Cuántos aceptó Resend. */
  enviados: number
  /** Direcciones QA que se cortaron aquí, sin intentarlo. */
  omitidos: number
  /** Los que Resend rechazó, o el lote entero si la petición falló. */
  fallidos: string[]
  motivo?: string
  /**
   * Lo que pasó con cada correo, en el mismo orden en que llegaron (M25). Es
   * lo que escribe la bitácora de correos de acceso: enviado con su id de
   * Resend, fallido con su motivo, u omitido (QA o sin buzón).
   */
  porDestinatario: ResultadoPorDestinatario[]
}

/** Tope del endpoint de lote de Resend. */
const POR_LOTE = 100

/**
 * Manda muchos correos de una vez por `/emails/batch`.
 *
 * Es lo que hace posible "mandar recordatorio a todos los que no han entrado"
 * en un clic. Uno por uno no se podía: Resend admite dos peticiones por
 * segundo y una server action en Vercel tiene segundos, así que ochenta
 * correos eran cuarenta segundos y un tope de diez por clic. En lote, ochenta
 * correos son UNA petición.
 *
 * La guarda de direcciones QA aplica igual que en `enviarCorreo`: se filtran
 * antes de armar el lote y cuentan como omitidos, no como fallos.
 *
 * Resend valida el lote completo: si una dirección viene mal formada rechaza
 * las cien. Por eso cada dirección se revisa ANTES de armar el lote (M25): una
 * mala queda fallida sola, en vez de tumbar a las otras 99. Si aun así un lote
 * falla, se reporta entero como fallido, con el motivo, en vez de adivinar.
 */
export async function enviarCorreosEnLote(correos: CorreoEnLote[]): Promise<ResultadoLote> {
  const porDestinatario: Array<ResultadoPorDestinatario | undefined> = correos.map(() => undefined)
  const porEnviar: number[] = []

  for (const [i, c] of correos.entries()) {
    if (esDireccionQA(c.para)) {
      porDestinatario[i] = {
        para: c.para,
        estado: 'omitido',
        motivo: SIN_BUZON.has(c.para.trim().toLowerCase()) ? 'sin_buzon' : 'qa',
      }
    } else if (!direccionValida(c.para)) {
      porDestinatario[i] = { para: c.para, estado: 'fallido', motivo: 'Correo inválido.' }
    } else {
      porEnviar.push(i)
    }
  }

  const omitidos = porDestinatario.filter((r) => r?.estado === 'omitido').length
  if (omitidos > 0) {
    console.log(JSON.stringify({ operacion: 'enviarCorreosEnLote:omitidos', cuantos: omitidos, motivo: 'QA' }))
  }

  let motivo: string | undefined
  const invalidos = porDestinatario.filter((r) => r?.estado === 'fallido').length
  if (invalidos > 0) motivo = 'Correo inválido.'

  const llave = process.env.RESEND_API_KEY
  if (!llave && porEnviar.length > 0) {
    console.error(JSON.stringify({ operacion: 'enviarCorreosEnLote', error: 'falta RESEND_API_KEY' }))
    motivo = 'Correo no configurado.'
    for (const i of porEnviar) {
      porDestinatario[i] = { para: correos[i]!.para, estado: 'fallido', motivo }
    }
    porEnviar.length = 0
  }

  for (let inicio = 0; inicio < porEnviar.length; inicio += POR_LOTE) {
    const indices = porEnviar.slice(inicio, inicio + POR_LOTE)
    const lote = indices.map((i) => correos[i]!)
    const numero = inicio / POR_LOTE + 1
    // Dos peticiones por segundo: entre lotes se espera, no dentro del lote.
    if (inicio > 0) await new Promise((r) => setTimeout(r, 600))

    let repartido: ResultadoPorDestinatario[]
    try {
      const respuesta = await fetch(`${API}/batch`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${llave}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(
          lote.map((c) => ({
            from: remitente(),
            reply_to: responderA(),
            to: [c.para.trim().toLowerCase()],
            subject: c.asunto,
            html: c.html,
            text: c.texto,
          }))
        ),
        signal: AbortSignal.timeout(20_000),
      })

      const cuerpo = (await respuesta.json().catch(() => null)) as
        | { data?: Array<{ id?: string }>; message?: string }
        | null

      if (!respuesta.ok) {
        motivo = cuerpo?.message ?? `HTTP ${respuesta.status}`
        console.error(
          JSON.stringify({ operacion: 'enviarCorreosEnLote', lote: numero, status: respuesta.status, error: motivo })
        )
        repartido = repartirLote(lote.map((c) => c.para), { ok: false, motivo })
      } else {
        // Resend devuelve un id por correo, en el mismo orden del lote.
        repartido = repartirLote(lote.map((c) => c.para), {
          ok: true,
          ids: lote.map((_, j) => cuerpo?.data?.[j]?.id),
        })
        console.log(JSON.stringify({ operacion: 'enviarCorreosEnLote:ok', lote: numero, cuantos: lote.length }))
      }
    } catch (error) {
      motivo = error instanceof Error ? error.message : 'error desconocido'
      console.error(JSON.stringify({ operacion: 'enviarCorreosEnLote', lote: numero, error: motivo }))
      repartido = repartirLote(lote.map((c) => c.para), { ok: false, motivo })
    }

    for (const [j, i] of indices.entries()) porDestinatario[i] = repartido[j]
  }

  const final = porDestinatario.map(
    (r, i) => r ?? { para: correos[i]!.para, estado: 'fallido' as const, motivo: 'No se intentó.' }
  )
  return {
    enviados: final.filter((r) => r.estado === 'enviado').length,
    omitidos,
    fallidos: final.filter((r) => r.estado === 'fallido').map((r) => r.para),
    motivo,
    porDestinatario: final,
  }
}
