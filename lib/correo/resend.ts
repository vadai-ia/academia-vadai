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

export type ResultadoCorreo = {
  ok: boolean
  id?: string
  motivo?: string
}

function remitente(): string {
  const direccion = process.env.CORREO_REMITENTE ?? 'noreply@automail.vadai.com.mx'
  const nombre = process.env.CORREO_REMITENTE_NOMBRE ?? 'VADAI Academia'
  return `${nombre} <${direccion}>`
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

  try {
    const respuesta = await fetch(API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${llave}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: remitente(),
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
