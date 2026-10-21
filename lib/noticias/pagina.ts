import 'server-only'

import { pedirSeguro } from '@/lib/red/seguro'
import { idDeYoutube, medioDeHost } from '@/lib/noticias/url'

/**
 * Lo que se lee de la página de una noticia (M24): sus metadatos (Open Graph,
 * JSON-LD) y un extracto del texto. Sin librería de DOM: expresiones sobre el
 * HTML, que alcanzan para `<meta>`, `<link>`, `<title>` y los `<p>`.
 */

export type Pagina = {
  url: string
  canonica: string | null
  titulo: string | null
  descripcion: string | null
  medio: string
  publicado: Date | null
  /** Los primeros párrafos del cuerpo, en texto plano. */
  extracto: string
  esVideo: boolean
}

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function desescapar(t: string): string {
  return t
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTIDADES[n.toLowerCase()] ?? m)
}

const limpio = (t: string | null | undefined, max: number) =>
  t ? desescapar(t).replace(/\s+/g, ' ').trim().slice(0, max) || null : null

function atributo(etiqueta: string, nombre: string): string | null {
  const m = etiqueta.match(new RegExp(`\\b${nombre}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
  return m ? (m[2] ?? m[3] ?? m[4] ?? null) : null
}

function meta(html: string, ...claves: string[]): string | null {
  for (const etiqueta of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const clave = (atributo(etiqueta, 'property') ?? atributo(etiqueta, 'name') ?? atributo(etiqueta, 'itemprop') ?? '').toLowerCase()
    if (claves.includes(clave)) {
      const valor = atributo(etiqueta, 'content')
      if (valor) return valor
    }
  }
  return null
}

function enlace(html: string, rel: string): string | null {
  for (const etiqueta of html.match(/<link\b[^>]*>/gi) ?? []) {
    if ((atributo(etiqueta, 'rel') ?? '').toLowerCase().split(/\s+/).includes(rel)) return atributo(etiqueta, 'href')
  }
  return null
}

/** `datePublished` de algún bloque JSON-LD. */
function fechaJsonLd(html: string): string | null {
  for (const m of html.matchAll(/<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    const f = m[1]?.match(/"datePublished"\s*:\s*"([^"]+)"/)
    if (f?.[1]) return f[1]
  }
  return null
}

function fecha(texto: string | null): Date | null {
  if (!texto) return null
  const d = new Date(texto)
  return Number.isNaN(d.getTime()) ? null : d
}

/** El texto de los primeros `<p>` del cuerpo, sin etiquetas. */
function parrafos(html: string, max: number): string {
  const cuerpo = html.replace(/<(script|style|noscript|svg|nav|footer|header|aside|form)\b[\s\S]*?<\/\1>/gi, ' ')
  const partes: string[] = []
  let largo = 0
  for (const m of cuerpo.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const t = limpio((m[1] ?? '').replace(/<[^>]+>/g, ' '), 2000)
    if (!t || t.length < 40) continue
    partes.push(t)
    largo += t.length
    if (largo >= max) break
  }
  return partes.join('\n\n').slice(0, max)
}

function absoluta(url: string | null, base: string): string | null {
  if (!url) return null
  try {
    return new URL(desescapar(url), base).toString()
  } catch {
    return null
  }
}

/**
 * Lee una página de noticia. `extracto` es el texto que se le da al modelo
 * (más largo para una liga que alguien pegó, más corto para cada candidata de
 * una cacería).
 */
export async function leerPagina(url: string, o: { extracto: number; maxBytes?: number }): Promise<Pagina | { error: string }> {
  const r = await pedirSeguro(url, {
    maxBytes: o.maxBytes ?? 1_000_000,
    tiempo: 8000,
    acepta: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
  })
  if ('error' in r) return r
  if (r.status !== 200) return { error: `La página respondió ${r.status}.` }
  if (!/html/.test(r.tipo)) return { error: 'La liga no es una página web.' }

  const html = r.cuerpo.toString('utf8')
  const host = new URL(r.url).hostname
  const titulo = limpio(meta(html, 'og:title', 'twitter:title') ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], 300)
  return {
    url: r.url,
    canonica: absoluta(enlace(html, 'canonical') ?? meta(html, 'og:url'), r.url),
    titulo,
    descripcion: limpio(meta(html, 'og:description', 'twitter:description', 'description'), 600),
    medio: limpio(meta(html, 'og:site_name'), 80) ?? medioDeHost(host),
    publicado: fecha(meta(html, 'article:published_time', 'og:published_time', 'datepublished', 'date') ?? fechaJsonLd(html)),
    extracto: parrafos(html, o.extracto),
    esVideo: Boolean(idDeYoutube(r.url)),
  }
}

/**
 * Un video de YouTube: título y canal por oEmbed y la descripción de la página.
 * El modelo NO ve el video; escribe con esto y con lo publicado del tema.
 */
export async function leerVideo(url: string): Promise<Pagina | { error: string }> {
  const id = idDeYoutube(url)
  if (!id) return { error: 'No reconocí el video.' }
  const host = new URL(url).hostname
  const base = host.endsWith('.qa-noticias.invalid') ? `https://${host}` : 'https://www.youtube.com'
  const watch = `${base}/watch?v=${id}`
  const oembed = await pedirSeguro(`${base}/oembed?format=json&url=${encodeURIComponent(watch)}`, {
    maxBytes: 64_000,
    tiempo: 6000,
    acepta: 'application/json',
  })
  let titulo: string | null = null
  let canal: string | null = null
  if (!('error' in oembed) && oembed.status === 200) {
    try {
      const j = JSON.parse(oembed.cuerpo.toString('utf8')) as { title?: string; author_name?: string }
      titulo = limpio(j.title, 300)
      canal = limpio(j.author_name, 80)
    } catch {
      /* sin oEmbed, se sigue con la página */
    }
  }
  const pagina = await leerPagina(watch, { extracto: 0, maxBytes: 600_000 })
  const descripcion = 'error' in pagina ? null : pagina.descripcion
  if (!titulo && 'error' in pagina) return { error: 'No se pudo leer el video.' }
  return {
    url: watch,
    canonica: watch,
    titulo: titulo ?? ('error' in pagina ? null : pagina.titulo),
    descripcion,
    medio: canal ? `YouTube · ${canal}` : 'YouTube',
    publicado: 'error' in pagina ? null : pagina.publicado,
    extracto: '',
    esVideo: true,
  }
}
