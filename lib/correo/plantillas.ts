import 'server-only'

/**
 * Plantillas de correo.
 *
 * Escritas para el alumno de §0: dueño de negocio, 30–55, NO técnico, que
 * probablemente abre esto desde el celular. Reglas que sigue cada una:
 *
 *   - Español, sin una sola palabra técnica. Nada de "token", "enlace de
 *     verificación" ni "restablecer credenciales".
 *   - Una acción principal, en lima. El botón dice qué pasa al tocarlo. La
 *     bienvenida lleva además una secundaria, en contorno, que no compite: es el
 *     paso 2 y solo sirve después de hacer el 1.
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

/** Nombres y títulos vienen de un formulario o de Stripe: nunca van crudos al HTML. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * `preheader` es la línea gris que la bandeja muestra junto al asunto. Va
 * escondida al inicio del cuerpo; el relleno de espacios invisibles evita que el
 * cliente de correo la complete con lo primero que encuentre del contenido.
 */
function envoltura(contenido: string, preheader?: string): string {
  const avance = preheader
    ? `<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${escapar(preheader)}${'&#847;&zwnj;&nbsp;'.repeat(60)}</div>`
    : ''

  return `<!doctype html>
<html lang="es-MX">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:${NAVY};">
  ${avance}
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
          <a href="mailto:ayuda@vadai.com.mx" style="color:${CYAN};">ayuda@vadai.com.mx</a>
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

/** Contorno en vez de relleno: es la acción que sigue, no la que urge. */
function botonSecundario(url: string, etiqueta: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 24px;">
    <tr><td style="border:1px solid ${CYAN};border-radius:8px;">
      <a href="${url}" style="display:inline-block;padding:12px 24px;font-family:Inter,Arial,sans-serif;font-size:15px;font-weight:600;color:${TEXTO};text-decoration:none;">${etiqueta}</a>
    </td></tr>
  </table>`
}

function urlEnTexto(url: string): string {
  return `<p style="margin:0;font-size:13px;color:${GRIS};line-height:1.6;word-break:break-all;">
    Si el botón no funciona, copia esta dirección en tu navegador:<br>
    <a href="${url}" style="color:${CYAN};">${url}</a>
  </p>`
}

/**
 * El curso de inducción: el paso 2 de la bienvenida manda ahí a ver el video que
 * explica la plataforma. Si cambia de nombre o de slug, se cambia aquí.
 *
 * OJO: el enlace solo le sirve a quien esté INSCRITO en ese curso. El alta no lo
 * agrega sola; hay que marcarlo junto con el curso que la persona compró.
 */
const CURSO_DE_INDUCCION = { titulo: 'Academia VADAI', ruta: '/curso/academia-vadai' }

/** "A", "A y B", "A, B y C" — con las reglas del español (y/e). */
function enLista(valores: string[]): string {
  return new Intl.ListFormat('es', { style: 'long', type: 'conjunction' }).format(valores)
}

/**
 * Primer correo tras una compra o un alta manual.
 *
 * `cursos` son los títulos a los que la persona acaba de recibir acceso. Puede
 * venir vacío —el alta de alguien del equipo, o un reenvío a quien no tiene
 * inscripciones— y entonces el correo habla de la plataforma sin nombrar curso.
 *
 * `base` es la URL pública de la app, para armar el botón secundario. Sin ella
 * ese botón no se pinta: un enlace sin dominio en un correo no lleva a nada.
 */
export function plantillaBienvenida(opciones: {
  url: string
  cursos: string[]
  nombre?: string | null
  base?: string | null
}): Plantilla {
  const { url, cursos } = opciones
  const nombre = opciones.nombre?.trim() ?? ''
  const base = (opciones.base ?? '').replace(/\/+$/, '')
  const urlInduccion = base ? `${base}${CURSO_DE_INDUCCION.ruta}` : null

  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'

  // Tres redacciones, no una con relleno: "tu curso la academia" no es español.
  const dondeVive =
    cursos.length === 0
      ? { antes: 'la plataforma donde viven tus cursos', titulos: '' }
      : cursos.length === 1
        ? { antes: 'la plataforma donde vivirá tu curso ', titulos: enLista(cursos) }
        : { antes: 'la plataforma donde vivirán tus cursos ', titulos: enLista(cursos) }

  const parrafo = `margin:0 0 14px;font-size:15px;color:${TEXTO};line-height:1.65;`
  const paso = `margin:22px 0 6px;font-size:16px;font-weight:600;color:${TEXTO};line-height:1.4;`

  const html = envoltura(
    `
    <p style="${parrafo}">${escapar(saludo)}</p>
    <p style="${parrafo}">
      Bienvenido a VADAI Academy, ${dondeVive.antes}${
        dondeVive.titulos ? `<strong>${escapar(dondeVive.titulos)}</strong>` : ''
      }.
    </p>
    <p style="${parrafo}">Para empezar, solo necesitas dos pasos:</p>

    <p style="${paso}">1. Crea tu contraseña</p>
    <p style="${parrafo}">
      Tu usuario es este correo. Define tu contraseña para activar tu acceso. Esta liga te
      sirve durante 30 días, las veces que la necesites.
    </p>
    ${boton(url, 'Crear mi contraseña')}
    ${urlEnTexto(url)}

    <p style="${paso}">2. Aprende a usar la plataforma</p>
    <p style="${parrafo}">
      Una vez dentro, entra al curso <strong>${escapar(CURSO_DE_INDUCCION.titulo)}</strong> y mira
      el video de bienvenida. Ahí verás cómo navegar los módulos, unirte a las sesiones en vivo y
      descargar los recursos.
    </p>
    ${urlInduccion ? botonSecundario(urlInduccion, `Ir a ${CURSO_DE_INDUCCION.titulo}`) : ''}

    <p style="${parrafo}">
      Si tienes algún problema para entrar, responde este correo y te ayudamos.
    </p>
    <p style="${parrafo}">Nos vemos dentro.</p>
    <p style="margin:0;font-size:15px;color:${TEXTO};line-height:1.65;">Equipo VADAI</p>
  `,
    'Crea tu contraseña y da el primer paso.'
  )

  const texto = `${saludo}

Bienvenido a VADAI Academy, ${dondeVive.antes}${dondeVive.titulos}.

Para empezar, solo necesitas dos pasos:

1. Crea tu contraseña
Tu usuario es este correo. Define tu contraseña para activar tu acceso. Esta liga te sirve durante 30 días, las veces que la necesites:
${url}

2. Aprende a usar la plataforma
Una vez dentro, entra al curso ${CURSO_DE_INDUCCION.titulo} y mira el video de bienvenida. Ahí verás cómo navegar los módulos, unirte a las sesiones en vivo y descargar los recursos.${
    urlInduccion ? `\n${urlInduccion}` : ''
  }

Si tienes algún problema para entrar, responde este correo y te ayudamos.

Nos vemos dentro.

Equipo VADAI`

  return { asunto: 'Tu acceso a VADAI Academy está listo', html, texto }
}

/**
 * Recordatorio para quien recibió su acceso y todavía no ha entrado.
 *
 * No es la bienvenida otra vez: esa ya la tiene en el buzón y no la abrió, o
 * la abrió con la liga muerta. Este correo es corto, dice qué se está
 * perdiendo —con el nombre de su curso— y da una sola cosa que hacer. La liga
 * es la de 30 días, así que sirve aunque lo abra la semana que entra.
 *
 * Sale en lote desde /admin/alumnos ("Mandar recordatorio a los que nunca han
 * entrado"), así que el texto tiene que funcionar para cualquiera de la lista
 * sin que nadie lo edite.
 */
export function plantillaRecordatorio(opciones: {
  url: string
  cursos: string[]
  nombre?: string | null
  base?: string | null
}): Plantilla {
  const { url, cursos } = opciones
  const nombre = opciones.nombre?.trim() ?? ''
  const base = (opciones.base ?? '').replace(/\/+$/, '')
  const urlLogin = base ? `${base}/login` : null

  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'
  const queEspera =
    cursos.length === 0
      ? 'tu academia ya está lista'
      : cursos.length === 1
        ? `tu curso <strong>${escapar(enLista(cursos))}</strong> ya está listo`
        : `tus cursos <strong>${escapar(enLista(cursos))}</strong> ya están listos`
  const queEsperaTexto =
    cursos.length === 0
      ? 'tu academia ya está lista'
      : cursos.length === 1
        ? `tu curso ${enLista(cursos)} ya está listo`
        : `tus cursos ${enLista(cursos)} ya están listos`

  const parrafo = `margin:0 0 14px;font-size:15px;color:${TEXTO};line-height:1.65;`

  const html = envoltura(
    `
    <p style="${parrafo}">${escapar(saludo)}</p>
    <p style="${parrafo}">
      Vimos que todavía no has entrado a la academia, y ${queEspera}: ahí van quedando las
      grabaciones de cada sesión, los módulos y los archivos para descargar.
    </p>
    <p style="${parrafo}">
      Entrar toma un minuto: da clic, elige tu contraseña y listo. Tu usuario es este correo.
    </p>
    ${boton(url, 'Entrar a mi academia')}
    ${urlEnTexto(url)}
    <p style="${parrafo};margin-top:18px;">
      Esta liga te sirve durante 30 días, las veces que la necesites.${
        urlLogin
          ? ` Si ya tienes contraseña, entra directo en <a href="${urlLogin}" style="color:${CYAN};">${escapar(urlLogin.replace(/^https?:\/\//, ''))}</a>.`
          : ''
      }
    </p>
    <p style="${parrafo}">
      Si algo no funciona, responde este correo y te ayudamos.
    </p>
    <p style="margin:0;font-size:15px;color:${TEXTO};line-height:1.65;">Equipo VADAI</p>
  `,
    'Tu curso ya te está esperando. Entrar toma un minuto.'
  )

  const texto = `${saludo}

Vimos que todavía no has entrado a la academia, y ${queEsperaTexto}: ahí van quedando las grabaciones de cada sesión, los módulos y los archivos para descargar.

Entrar toma un minuto: da clic, elige tu contraseña y listo. Tu usuario es este correo.
${url}

Esta liga te sirve durante 30 días, las veces que la necesites.${
    urlLogin ? ` Si ya tienes contraseña, entra directo en ${urlLogin}` : ''
  }

Si algo no funciona, responde este correo y te ayudamos.

Equipo VADAI`

  return { asunto: 'Recuerda entrar a tu academia VADAI', html, texto }
}

/**
 * Aviso a quien YA tiene cuenta y acaba de recibir un curso más.
 *
 * Antes no salía nada: "la persona ya sabe entrar y lo encuentra en su lista".
 * Alejandro lo pidió sí o sí (20-sep-2026), y tiene razón: si nadie te avisa,
 * el curso nuevo no existe hasta que entres por otra razón. No lleva liga de
 * acceso: ya tiene contraseña. Lleva el botón a Mis cursos y, por si acaso, la
 * ruta para recuperarla.
 */
export function plantillaNuevoCurso(opciones: {
  cursos: string[]
  nombre?: string | null
  base?: string | null
}): Plantilla {
  const { cursos } = opciones
  const nombre = opciones.nombre?.trim() ?? ''
  const base = (opciones.base ?? '').replace(/\/+$/, '')
  const urlInicio = `${base}/mis-cursos`
  const urlRecuperar = `${base}/recuperar`

  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'
  const que =
    cursos.length === 1
      ? `el curso <strong>${escapar(enLista(cursos))}</strong>`
      : `los cursos <strong>${escapar(enLista(cursos))}</strong>`
  const queTexto = cursos.length === 1 ? `el curso ${enLista(cursos)}` : `los cursos ${enLista(cursos)}`

  const parrafo = `margin:0 0 14px;font-size:15px;color:${TEXTO};line-height:1.65;`

  const html = envoltura(
    `
    <p style="${parrafo}">${escapar(saludo)}</p>
    <p style="${parrafo}">Te dimos acceso a ${que}. Ya está en tu academia.</p>
    <p style="${parrafo}">Entra con tu correo y tu contraseña de siempre.</p>
    ${boton(urlInicio, 'Ir a mi academia')}
    ${urlEnTexto(urlInicio)}
    <p style="${parrafo};margin-top:18px;">
      Si no recuerdas tu contraseña, pide una nueva en
      <a href="${urlRecuperar}" style="color:${CYAN};">${escapar(urlRecuperar.replace(/^https?:\/\//, ''))}</a>.
    </p>
    <p style="margin:0;font-size:15px;color:${TEXTO};line-height:1.65;">Equipo VADAI</p>
  `,
    `Ya tienes acceso a ${cursos[0] ?? 'un curso nuevo'}.`
  )

  const texto = `${saludo}

Te dimos acceso a ${queTexto}. Ya está en tu academia.

Entra con tu correo y tu contraseña de siempre:
${urlInicio}

Si no recuerdas tu contraseña, pide una nueva en ${urlRecuperar}

Equipo VADAI`

  return {
    asunto: cursos.length === 1 ? `Ya tienes acceso a ${cursos[0]}` : 'Tienes cursos nuevos en tu academia',
    html,
    texto,
  }
}

export type SesionParaCorreo = {
  id: string
  titulo: string
  /** ISO UTC. */
  inicio: string
  ligaUrl: string | null
  horario: string
  google: string
  outlook: string
}

/**
 * Las fechas de las sesiones en vivo, con botones para agregarlas al
 * calendario (pedido 21-sep-2026, día del lanzamiento: "para que no se les
 * pase ninguna").
 *
 * Cada sesión trae sus ligas a Google Calendar y Outlook, que abren
 * prellenadas sin entrar a la plataforma; el botón grande descarga TODAS en
 * un .ics (Apple y cualquier otro) por una URL firmada, que tampoco pide
 * entrar: en el navegador del correo del teléfono no hay sesión. Y se recuerda
 * que la liga de Zoom se activa en Mis cursos 15 minutos antes.
 *
 * Con `urlAcceso` (quien nunca ha entrado), el botón principal pasa a ser
 * "Entrar a mi academia" —su liga de 30 días— y el .ics baja a secundario:
 * el correo que abren el día de la sesión es el que los mete.
 */
export function plantillaCalendario(opciones: {
  nombre?: string | null
  curso: string
  sesiones: SesionParaCorreo[]
  /** URL del .ics con todas (firmada, lib/calendario/firma.ts). */
  urlTodas: string
  /** Liga de acceso de 30 días; solo para quien nunca ha entrado. */
  urlAcceso?: string | null
  base?: string | null
}): Plantilla {
  const nombre = opciones.nombre?.trim() ?? ''
  const base = (opciones.base ?? '').replace(/\/+$/, '')
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'
  const parrafo = `margin:0 0 14px;font-size:15px;color:${TEXTO};line-height:1.65;`
  const chica = `font-size:13px;color:${GRIS};`

  // Si todas las sesiones comparten liga (lo normal: una sala de Zoom fija),
  // va una sola vez y arriba; si no, cada sesión trae la suya.
  const ligas = [...new Set(opciones.sesiones.map((s) => s.ligaUrl).filter((u): u is string => Boolean(u)))]
  const ligaComun = ligas.length === 1 ? ligas[0] : null

  const filas = opciones.sesiones
    .map(
      (s) => `
      <tr>
        <td style="padding:10px 0;border-top:1px solid #1f3350;">
          <div style="font-size:15px;color:${TEXTO};font-weight:600;">${escapar(s.titulo)}</div>
          <div style="${chica}margin-top:2px;">${escapar(s.horario)}</div>
          <div style="${chica}margin-top:4px;">
            Agregar a
            <a href="${s.google}" style="color:${CYAN};">Google Calendar</a> ·
            <a href="${s.outlook}" style="color:${CYAN};">Outlook</a>
          </div>
          ${s.ligaUrl && !ligaComun ? `<div style="${chica}margin-top:4px;word-break:break-all;">Entrar: <a href="${s.ligaUrl}" style="color:${CYAN};">${escapar(s.ligaUrl)}</a></div>` : ''}
        </td>
      </tr>`
    )
    .join('')

  const acceso = opciones.urlAcceso
    ? `
    <p style="${parrafo}">
      Todavía no has entrado a tu academia. Es un clic: eliges tu contraseña y quedas lista o listo para la sesión.
    </p>
    ${boton(opciones.urlAcceso, 'Entrar a mi academia')}
    <p style="${chica}margin:-12px 0 22px;">Tu liga es personal y vale 30 días.</p>`
    : ''

  const html = envoltura(
    `
    <p style="${parrafo}">${escapar(saludo)}</p>
    ${acceso}
    <p style="${parrafo}">
      Estas son las ${opciones.sesiones.length} sesiones en vivo de <strong>${escapar(opciones.curso)}</strong>.
      Agrégalas a tu calendario hoy, para que ninguna se te pase.
    </p>
    ${
      ligaComun
        ? `<p style="${parrafo}word-break:break-all;">
      La liga de Zoom es la misma para todas las sesiones:<br>
      <a href="${ligaComun}" style="color:${CYAN};">${escapar(ligaComun)}</a>
    </p>`
        : ''
    }
    ${(acceso ? botonSecundario : boton)(opciones.urlTodas, 'Agregar todas a mi calendario')}
    <p style="${chica}margin:0 0 18px;">
      Descarga un archivo de calendario con las ${opciones.sesiones.length} fechas. También puedes agregarlas una
      por una aquí abajo.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
      ${filas}
    </table>
    <p style="${parrafo}">
      La liga para entrar también aparece en <a href="${base}/mis-cursos" style="color:${CYAN};">tu academia</a>
      15 minutos antes de cada sesión. Ahí mismo quedan después las grabaciones.
    </p>
    <p style="${parrafo}">Si algo no funciona, responde este correo y te ayudamos.</p>
    <p style="margin:0;font-size:15px;color:${TEXTO};line-height:1.65;">Equipo VADAI</p>
  `,
    `${opciones.sesiones.length} sesiones en vivo. Agrégalas a tu calendario hoy.`
  )

  const texto = `${saludo}

Estas son las ${opciones.sesiones.length} sesiones en vivo de ${opciones.curso}. Agrégalas a tu calendario hoy, para que ninguna se te pase.

${opciones.urlAcceso ? `Todavía no has entrado a tu academia. Es un clic: eliges tu contraseña y quedas lista o listo para la sesión. Tu liga es personal y vale 30 días:\n${opciones.urlAcceso}\n\n` : ''}${ligaComun ? `Liga de Zoom, la misma para todas las sesiones:\n${ligaComun}\n\n` : ''}Agregar todas a mi calendario (.ics):
${opciones.urlTodas}

${opciones.sesiones.map((s) => `${s.titulo}\n${s.horario}\nGoogle Calendar: ${s.google}\nOutlook: ${s.outlook}${s.ligaUrl && !ligaComun ? `\nEntrar: ${s.ligaUrl}` : ''}`).join('\n\n')}

La liga para entrar también aparece en ${base}/mis-cursos 15 minutos antes de cada sesión. Ahí mismo quedan después las grabaciones.

Si algo no funciona, responde este correo y te ayudamos.

Equipo VADAI`

  return { asunto: `Fechas de tus sesiones en vivo · ${opciones.curso}`, html, texto }
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
¿Necesitas ayuda? ayuda@vadai.com.mx`

  return { asunto: 'Cambia tu contraseña · VADAI Academia', html, texto }
}
