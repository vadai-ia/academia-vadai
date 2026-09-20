import 'server-only'

/**
 * Plantillas de correo.
 *
 * Escritas para el alumno de §0: dueño de negocio, 30–55, NO técnico, que
 * probablemente abre esto desde el celular. Reglas que sigue cada una:
 *
 *   - Español, sin una sola palabra técnica. Nada de "token", "enlace de
 *     verificación" ni "restablecer credenciales".
 *   - Una sola acción visible. El botón dice qué pasa al tocarlo.
 *   - La URL también en texto plano: los clientes de correo corporativos a veces
 *     rompen los botones, y quedarse sin forma de entrar sería absurdo.
 *   - HTML con estilos en línea y tabla: es lo único que Outlook y Gmail
 *     renderizan igual. Nada de flexbox ni clases.
 */

const NAVY = '#0A1A2F'
const CYAN = '#00A0DB'
const LIMA = '#C6F24E'
const TEXTO = '#F5F8FB'
const GRIS = '#93A3B5'

export type Plantilla = { asunto: string; html: string; texto: string }

function envoltura(contenido: string): string {
  return `<!doctype html>
<html lang="es-MX">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:${NAVY};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${NAVY};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
        <tr><td style="padding-bottom:28px;font-family:Inter,Arial,sans-serif;">
          <span style="font-size:18px;font-weight:700;letter-spacing:3px;color:${TEXTO};">VADAI</span>
          <span style="font-size:18px;font-weight:300;letter-spacing:3px;color:${CYAN};">ACADEMIA</span>
        </td></tr>
        <tr><td style="background-color:#0F2440;border-radius:10px;padding:28px;font-family:Inter,Arial,sans-serif;">
          ${contenido}
        </td></tr>
        <tr><td style="padding-top:24px;font-family:Inter,Arial,sans-serif;font-size:12px;color:${GRIS};line-height:1.6;">
          Si no esperabas este correo, puedes ignorarlo.<br>
          ¿Necesitas ayuda? Escríbenos a
          <a href="mailto:hola@vadai.com.mx" style="color:${CYAN};">hola@vadai.com.mx</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function boton(url: string, etiqueta: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr><td style="background-color:${LIMA};border-radius:8px;">
      <a href="${url}" style="display:inline-block;padding:13px 26px;font-family:Inter,Arial,sans-serif;font-size:15px;font-weight:600;color:${NAVY};text-decoration:none;">${etiqueta}</a>
    </td></tr>
  </table>`
}

function urlEnTexto(url: string): string {
  return `<p style="margin:0;font-size:13px;color:${GRIS};line-height:1.6;word-break:break-all;">
    Si el botón no funciona, copia esta dirección en tu navegador:<br>
    <a href="${url}" style="color:${CYAN};">${url}</a>
  </p>`
}

/** Primer correo tras una compra o un alta manual. */
export function plantillaBienvenida(url: string, curso: string, nombre?: string | null): Plantilla {
  const saludo = nombre?.trim() ? `Hola, ${nombre.trim()}` : 'Hola'

  const html = envoltura(`
    <h1 style="margin:0 0 14px;font-size:21px;font-weight:600;color:${TEXTO};">${saludo}</h1>
    <p style="margin:0 0 14px;font-size:15px;color:${TEXTO};line-height:1.65;">
      Ya tienes acceso a <strong>${curso}</strong>.
    </p>
    <p style="margin:0;font-size:15px;color:${TEXTO};line-height:1.65;">
      Para entrar solo falta que elijas una contraseña. Toma menos de un minuto.
      Esta liga te sirve durante 30 días, las veces que la necesites.
    </p>
    ${boton(url, 'Crear mi contraseña')}
    ${urlEnTexto(url)}
  `)

  const texto = `${saludo},

Ya tienes acceso a ${curso}.

Para entrar solo falta que elijas una contraseña. Esta liga te sirve
durante 30 días, las veces que la necesites:
${url}

Si no esperabas este correo, puedes ignorarlo.
¿Necesitas ayuda? hola@vadai.com.mx`

  return { asunto: `Tu acceso a ${curso}`, html, texto }
}

/** "Olvidé mi contraseña". */
export function plantillaRecuperacion(url: string): Plantilla {
  const html = envoltura(`
    <h1 style="margin:0 0 14px;font-size:21px;font-weight:600;color:${TEXTO};">Cambia tu contraseña</h1>
    <p style="margin:0;font-size:15px;color:${TEXTO};line-height:1.65;">
      Pediste entrar de nuevo a tu academia. Elige una contraseña nueva y listo.
    </p>
    ${boton(url, 'Elegir contraseña nueva')}
    ${urlEnTexto(url)}
    <p style="margin:16px 0 0;font-size:13px;color:${GRIS};line-height:1.6;">
      Este enlace vence en una hora. Si vence, pídelo otra vez desde la pantalla de acceso.
    </p>
  `)

  const texto = `Cambia tu contraseña

Pediste entrar de nuevo a tu academia. Elige una contraseña nueva aquí:
${url}

Este enlace vence en una hora.

Si no lo pediste, puedes ignorar este correo.
¿Necesitas ayuda? hola@vadai.com.mx`

  return { asunto: 'Cambia tu contraseña · VADAI Academia', html, texto }
}
