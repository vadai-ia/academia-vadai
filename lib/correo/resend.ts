import 'server-only'

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

function esDireccionQA(para: string): boolean {
  const limpia = para.trim().toLowerCase()
  return limpia.startsWith('qa-') && limpia.endsWith(DOMINIO_QA)
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
  return process.env.CORREO_RESPONDER_A ?? 'hola@vadai.com.mx'
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
