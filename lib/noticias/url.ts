import { createHash } from 'node:crypto'

/**
 * Las ligas de las noticias (M24): una misma nota llega con muchas caras
 * (`www.`, `?utm_source=…`, `/amp`, `#comentarios`). Normalizarla y sacarle un
 * hash es lo que deja saber que dos ligas son la misma noticia, sin depender
 * de que el modelo «se acuerde».
 */

const PARAMETROS_DE_RASTREO = /^(utm_[a-z]+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|ref|ref_src|ref_url|referrer|source|si|igshid|yclid|_hs[a-z]+|cmpid|ocid|taid|smid|sh)$/i

/** La URL canónica de una noticia, o null si no es una URL https usable. */
export function normalizarUrl(cruda: string): string | null {
  let u: URL
  try {
    u = new URL(cruda.trim())
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  u.protocol = 'https:'
  u.username = ''
  u.password = ''
  u.hash = ''
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '').replace(/^amp\./, '')
  if (u.port === '443' || u.port === '80') u.port = ''

  const video = idDeYoutube(u)
  if (video) {
    const host = u.hostname === 'youtube.com.qa-noticias.invalid' ? u.hostname : 'youtube.com'
    return `https://${host}/watch?v=${video}`
  }

  // AMP: /amp, /amp/, ?amp, .amp.html
  u.pathname = u.pathname.replace(/\/amp\/?$/i, '/').replace(/\.amp\.html$/i, '.html')
  const parametros = [...u.searchParams.entries()]
    .filter(([k]) => !PARAMETROS_DE_RASTREO.test(k) && k.toLowerCase() !== 'amp' && k.toLowerCase() !== 'output')
    .sort(([a], [b]) => a.localeCompare(b))
  u.search = ''
  for (const [k, v] of parametros) u.searchParams.append(k, v)
  let texto = u.toString()
  if (u.pathname !== '/' && texto.endsWith('/') && !u.search) texto = texto.slice(0, -1)
  if (u.pathname === '/' && !u.search) texto = texto.replace(/\/$/, '')
  return texto
}

export function hashDeUrl(normalizada: string): string {
  return createHash('sha256').update(normalizada).digest('hex')
}

/** El id de un video de YouTube, si la liga es de uno. */
export function idDeYoutube(u: URL | string): string | null {
  let url: URL
  try {
    url = typeof u === 'string' ? new URL(u) : u
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, '')
  const valido = (id: string | null | undefined) => (id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null)
  if (host === 'youtu.be') return valido(url.pathname.split('/')[1])
  // `youtube.com.qa-noticias.invalid` es el YouTube del sitio falso de la suite.
  const esYoutube = host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'youtube.com.qa-noticias.invalid'
  if (esYoutube) {
    if (url.pathname === '/watch') return valido(url.searchParams.get('v'))
    const m = url.pathname.match(/^\/(shorts|embed|live|v)\/([^/?#]+)/)
    if (m) return valido(m[2])
  }
  return null
}

/** El nombre del medio para «Leer más en …», por su dominio. */
const MEDIOS: Record<string, string> = {
  'anthropic.com': 'Anthropic',
  'claude.com': 'Anthropic',
  'openai.com': 'OpenAI',
  'blog.google': 'Google',
  'deepmind.google': 'Google DeepMind',
  'google.com': 'Google',
  'microsoft.com': 'Microsoft',
  'techcrunch.com': 'TechCrunch',
  'theverge.com': 'The Verge',
  'reuters.com': 'Reuters',
  'apnews.com': 'AP',
  'xataka.com.mx': 'Xataka México',
  'xataka.com': 'Xataka',
  'expansion.mx': 'Expansión',
  'elfinanciero.com.mx': 'El Financiero',
  'wired.com': 'WIRED',
  'bloomberg.com': 'Bloomberg',
  'youtube.com': 'YouTube',
  'youtu.be': 'YouTube',
  'x.com': 'X',
  'linkedin.com': 'LinkedIn',
}

/**
 * El dominio de verdad de un host. En la suite, `theverge.com.qa-noticias.invalid`
 * es «theverge.com» del sitio falso (lib/red/seguro.ts): así la lista de medios
 * permitidos se revisa igual que en producción.
 */
export function hostReal(host: string): string {
  return host.toLowerCase().replace(/\.qa-noticias\.invalid$/, '').replace(/^www\./, '')
}

export function medioDeHost(host: string): string {
  const h = hostReal(host)
  for (const [dominio, nombre] of Object.entries(MEDIOS)) {
    if (h === dominio || h.endsWith(`.${dominio}`)) return nombre
  }
  // Sin nombre conocido: el dominio sin el www (cnn.com, nytimes.com).
  return h.slice(0, 80)
}

/** ¿El host es uno de estos dominios o un subdominio suyo? */
export function hostEn(host: string, dominios: readonly string[]): boolean {
  const h = hostReal(host)
  return dominios.some((d) => h === d || h.endsWith(`.${d}`))
}

/**
 * Los dominios que la API de Anthropic dice que su buscador no puede abrir, del
 * texto de su error: «The following domains are not accessible to our user
 * agent: ['apnews.com', 'reuters.com']». Vacío si el error es otro.
 */
export function dominiosSinBuscador(error: string | undefined): string[] {
  const lista = error?.match(/domains are not accessible[^[]*\[([^\]]*)\]/i)?.[1]
  if (!lista) return []
  return [...lista.matchAll(/['"]([a-z0-9.-]+)['"]/gi)].map((m) => (m[1] ?? '').toLowerCase()).filter(Boolean)
}
