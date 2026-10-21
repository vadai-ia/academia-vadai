import 'server-only'

import { z } from 'zod'

import { ajustesDelAgente } from '@/lib/agente/ajustes'
import { llamar, primerJson, type FuenteDeBusqueda } from '@/lib/agente/claude'
import { dbDelAgente, type ClienteAgente } from '@/lib/agente/servidor'
import type { Json } from '@/lib/supabase/types'
import { casaDeNoticias } from '@/lib/noticias/casa'
import { leerPagina, leerVideo, type Pagina } from '@/lib/noticias/pagina'
import { DOMINIOS_BLOQUEADOS, FRENTES, REGLAS_LIGA, REGLAS_REDACCION, reglasDelFrente, type Frente } from '@/lib/noticias/prompt'
import { hashDeUrl, hostEn, idDeYoutube, medioDeHost, normalizarUrl } from '@/lib/noticias/url'

/**
 * Las noticias de V-AI-P (M24).
 *
 * CACERÍA («Cazar noticias de hoy», y el cron de las 7:00), a fondo desde el
 * 21-oct-2026 (decisiones de Alejandro: cinco frentes, toda la web, top 5):
 *   1. Cinco FRENTES investigan en paralelo, en toda la web (menos
 *      DOMINIOS_BLOQUEADOS) y desde México: modelos y lanzamientos, herramientas
 *      para empresas, robótica y hardware, IA en México y en español, y aprender
 *      IA. Cada uno con 4 búsquedas, propone hasta 6. Todos saben qué temas YA
 *      vio la comunidad: no se repiten salvo que haya algo nuevo.
 *   2. El CÓDIGO limpia: solo cuentan URLs que de verdad salieron en la
 *      búsqueda (el modelo no puede inventar una liga), fuera de los bloqueados,
 *      normalizadas y sin repetir (contra la tanda y contra todo lo que ya se
 *      propuso o publicó); cada página o video se lee de verdad (si no abre,
 *      fuera) y se descarta lo viejo: 72 horas las noticias, 7 días las guías.
 *   3. Sonnet, sin herramientas y con las candidatas como datos, elige el top
 *      5 variado y lo escribe; un seguimiento de un tema ya publicado queda
 *      marcado en las notas con lo nuevo. El código quita URLs y correos.
 *   4. Quedan como PROPUESTAS. Nada se publica sin el clic de una persona.
 *
 * DESDE UNA LIGA: se lee la página (o el título y la descripción del video),
 * Sonnet investiga con la búsqueda web y escribe; queda como propuesta.
 *
 * Todo pasa por `llamar()`: cada llamada reserva su peor caso contra el tope
 * del mes antes de salir.
 */

const BUSQUEDAS_POR_FRENTE = 4
const MAX_POR_FRENTE = 6
const MAX_A_REDACTAR = 15
const MAX_PROPUESTAS = 5
const LECTURAS_A_LA_VEZ = 6

/** Acerca los resultados a lo que se lee en México (sin dejar de buscar en el mundo). */
const UBICACION = { ciudad: 'Ciudad de México', region: 'Ciudad de México', pais: 'MX', zona: 'America/Mexico_City' }

const EsquemaCaceria = z.object({
  candidatas: z.array(
    z.object({
      url: z.string(),
      titulo: z.string().default(''),
      por_que: z.string().default(''),
      nuevo: z.string().default(''),
    })
  ),
})

const EsquemaRedaccion = z.object({
  noticias: z
    .array(
      z.object({
        clave: z.string().describe('La clave de la candidata: C1, C2…'),
        titulo: z.string(),
        resumen: z.string(),
        texto: z.string(),
        seguimiento: z.boolean().describe('Continúa un tema que la comunidad ya vio.'),
        nuevo: z.string().describe('Si es seguimiento, qué cambió; si no, vacío.'),
      })
    )
    .max(MAX_PROPUESTAS),
})

const EsquemaLiga = z.object({
  titulo: z.string(),
  resumen: z.string(),
  texto: z.string(),
  advertencia: z.string().default(''),
})

type Descarte = { url: string; motivo: 'invalida' | 'inventada' | 'dominio' | 'duplicada' | 'rota' | 'vieja' | 'no_publica' | 'sin_texto' }

type PorLeer = {
  url: string
  urlOriginal: string
  hash: string
  porQue: string
  nuevo: string
  edad: string | null
  f: Frente
}

type Candidata = PorLeer & { pagina: Pagina }

function registrar(operacion: string, detalle: Record<string, unknown>) {
  console.error(JSON.stringify({ operacion, ...detalle }))
}

/** Sin URLs ni correos: la liga la arma el código, nunca el modelo. */
export function textoLimpio(t: string, max: number): string {
  return t
    .replace(/\r\n/g, '\n')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\bwww\.\S+/gi, '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ +\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max)
}

/** «2 days ago», «Oct 18, 2026»… a fecha. null si no se entiende. */
function fechaDeEdad(edad: string | null): Date | null {
  if (!edad) return null
  const relativa = edad.match(/(\d+)\s*(minute|hour|day|week|month)s?\s+ago/i)
  if (relativa) {
    const n = Number(relativa[1])
    const unidad = { minute: 60_000, hour: 3_600_000, day: 86_400_000, week: 604_800_000, month: 2_592_000_000 }[
      relativa[2]!.toLowerCase() as 'minute' | 'hour' | 'day' | 'week' | 'month'
    ]
    return new Date(Date.now() - n * unidad)
  }
  const d = new Date(edad)
  return Number.isNaN(d.getTime()) ? null : d
}

async function paso(db: ClienteAgente, huntId: string, texto: string) {
  await db.from('news_hunts').update({ paso: texto }).eq('id', huntId)
}

async function terminar(
  db: ClienteAgente,
  huntId: string,
  estado: 'lista' | 'sin_resultados' | 'fallida',
  extra: { detalle?: string; descartes?: Descarte[] } = {}
) {
  const { error } = await db
    .from('news_hunts')
    .update({
      estado,
      paso: null,
      finished_at: new Date().toISOString(),
      ...(extra.detalle ? { detalle: extra.detalle.slice(0, 2000) } : {}),
      ...(extra.descartes ? { descartes: extra.descartes as unknown as Json } : {}),
    })
    .eq('id', huntId)
  if (error) registrar('noticias:terminar', { huntId, error: error.message })
}

function motivoDeFallo(motivo: string, detalle?: string): string {
  if (motivo === 'sin_presupuesto') return 'Se acabó el presupuesto del mes para la IA (Ajustes → Agente).'
  if (motivo === 'sin_llave') return 'Falta ANTHROPIC_API_KEY en el servidor.'
  // Un 4xx es Anthropic rechazando la petición: reintentar no lo arregla, y
  // decir «no respondió» manda a buscar el problema donde no está (21-oct-2026).
  const rechazo = detalle?.match(/^(4\d\d)\b/)?.[1]
  if (rechazo) return `Anthropic rechazó la petición (error ${rechazo}); reintentar no lo arregla. El detalle quedó en el registro del agente.`
  return 'La IA no respondió. Intenta de nuevo en un momento.'
}

/** Corre una lista de tareas de `n` en `n`. */
async function deAPocos<T, R>(items: T[], n: number, f: (x: T) => Promise<R>): Promise<R[]> {
  const salida: R[] = []
  for (let i = 0; i < items.length; i += n) salida.push(...(await Promise.all(items.slice(i, i + n).map(f))))
  return salida
}

const hoyEnCdmx = () => new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'full' }).format(new Date())

// ==========================================================================
// Cacería
// ==========================================================================

type TemasVistos = { publicados: Array<{ titulo: string; resumen: string }>; propuestos: string[] }

/**
 * Lo que la comunidad ya vio: lo publicado en 30 días (de la cacería o escrito
 * por el equipo en el tema Noticias) y lo que se propuso o descartó en 10.
 * Alejandro (21-oct-2026): si ya se habló de un tema, no se vuelve a investigar
 * a fondo, salvo que haya algo nuevo o algo que profundizar.
 */
async function temasVistos(db: ClienteAgente, esQa: boolean, casaId: string): Promise<TemasVistos> {
  const hace30 = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const hace10 = new Date(Date.now() - 10 * 86_400_000).toISOString()
  const [{ data: publicadas }, { data: otras }, { data: tema }] = await Promise.all([
    db
      .from('news_items')
      .select('titulo, resumen')
      .eq('es_qa', esQa)
      .eq('estado', 'publicada')
      .gte('created_at', hace30)
      .order('created_at', { ascending: false })
      .limit(40),
    db
      .from('news_items')
      .select('titulo')
      .eq('es_qa', esQa)
      .neq('estado', 'publicada')
      .gte('created_at', hace10)
      .order('created_at', { ascending: false })
      .limit(40),
    db.from('community_topics').select('id').eq('course_id', casaId).eq('slug', 'noticias').maybeSingle(),
  ])
  const { data: posts } = tema
    ? await db
        .from('community_posts')
        .select('title')
        .eq('course_id', casaId)
        .eq('topic_id', tema.id)
        .eq('status', 'visible')
        .gte('created_at', hace30)
        .order('created_at', { ascending: false })
        .limit(40)
    : { data: [] as Array<{ title: string }> }

  const vistos = new Map<string, { titulo: string; resumen: string }>()
  for (const n of publicadas ?? []) vistos.set(n.titulo.toLowerCase(), { titulo: n.titulo, resumen: n.resumen })
  for (const p of posts ?? []) if (!vistos.has(p.title.toLowerCase())) vistos.set(p.title.toLowerCase(), { titulo: p.title, resumen: '' })
  return { publicados: [...vistos.values()], propuestos: (otras ?? []).map((o) => o.titulo) }
}

function textoDeVistos(v: TemasVistos): string {
  const partes: string[] = []
  if (v.publicados.length) {
    partes.push(
      `La comunidad YA vio estos temas (no los repitas salvo que haya algo nuevo):\n${v.publicados.map((p) => `- ${p.titulo}${p.resumen ? ` — ${p.resumen}` : ''}`).join('\n')}`
    )
  }
  if (v.propuestos.length) {
    partes.push(`Ya se propusieron o se descartaron (no los vuelvas a proponer):\n${v.propuestos.map((t) => `- ${t}`).join('\n')}`)
  }
  return partes.length ? `\n\n<ya_vistos>\n${partes.join('\n\n')}\n</ya_vistos>` : ''
}

/** Hasta `n` candidatas, turnándose entre frentes: que la redacción tenga de todo. */
function variadas(lista: Candidata[], n: number): Candidata[] {
  const porFrente = new Map<string, Candidata[]>()
  for (const c of lista) porFrente.set(c.f.clave, [...(porFrente.get(c.f.clave) ?? []), c])
  const colas = [...porFrente.values()]
  const salida: Candidata[] = []
  while (salida.length < n && colas.some((q) => q.length > 0)) {
    for (const q of colas) {
      const c = q.shift()
      if (c && salida.length < n) salida.push(c)
    }
  }
  return salida
}

export async function cazarNoticias(huntId: string): Promise<void> {
  const db = dbDelAgente()
  try {
    const [a, casa] = await Promise.all([ajustesDelAgente(), casaDeNoticias(db)])
    if (!a) return terminar(db, huntId, 'fallida', { detalle: 'Faltan los ajustes del agente.' })
    if (!casa) return terminar(db, huntId, 'fallida', { detalle: 'No encontré el muro de V-AI-P.' })
    const yaVistos = textoDeVistos(await temasVistos(db, a.es_qa, casa.id))

    // --- 1. los frentes, en paralelo y en toda la web --------------------------
    await paso(db, huntId, `Investigando ${FRENTES.length} frentes en la web`)
    const frentes = await Promise.all(
      FRENTES.map(async (f) => ({
        f,
        r: await llamar({
          tarea: 'noticias',
          modelo: a.modelo_fuerte,
          sistema: [{ texto: reglasDelFrente(f) }],
          mensaje: `Hoy es ${hoyEnCdmx()}.${yaVistos}`,
          maxTokens: 2500,
          effort: 'medium',
          busqueda: { maxUsos: BUSQUEDAS_POR_FRENTE, bloqueados: DOMINIOS_BLOQUEADOS, ubicacion: UBICACION },
          huntId,
        }),
      }))
    )
    const caidos: Array<{ f: Frente; motivo: string; detalle?: string }> = []
    for (const { f, r } of frentes) {
      if (r.ok) continue
      caidos.push({ f, motivo: r.motivo, detalle: r.detalle })
      registrar('noticias:frente', { huntId, frente: f.clave, motivo: r.motivo, detalle: r.detalle })
    }
    const [primerCaido] = caidos
    if (primerCaido && caidos.length === frentes.length) {
      return terminar(db, huntId, 'fallida', { detalle: motivoDeFallo(primerCaido.motivo, primerCaido.detalle) })
    }
    // Si un frente falla, la cacería sigue con los demás y lo dice.
    const avisoDeCaidos = caidos.length
      ? `${caidos.length === 1 ? 'Un frente no respondió' : `${caidos.length} frentes no respondieron`}: ${caidos.map((c) => c.f.nombre).join(', ')}.`
      : ''

    // --- 2. limpiar en código ---------------------------------------------------
    const descartes: Descarte[] = []
    const vistas = new Map<string, FuenteDeBusqueda>()
    const crudas: Array<{ f: Frente; url: string; porQue: string; nuevo: string }> = []
    for (const { f, r } of frentes) {
      if (!r.ok) continue
      for (const fuente of r.fuentes) {
        const n = normalizarUrl(fuente.url)
        if (n) vistas.set(n, fuente)
      }
      const lectura = EsquemaCaceria.safeParse(primerJson(r.texto))
      if (!lectura.success) {
        registrar('noticias:frente-ilegible', { huntId, frente: f.clave })
        continue
      }
      for (const c of lectura.data.candidatas.slice(0, MAX_POR_FRENTE)) crudas.push({ f, url: c.url, porQue: c.por_que, nuevo: c.nuevo })
    }

    const enLote = new Set<string>()
    const porLeer: PorLeer[] = []
    for (const c of crudas) {
      const n = normalizarUrl(c.url)
      if (!n) {
        descartes.push({ url: c.url.slice(0, 300), motivo: 'invalida' })
        continue
      }
      const fuente = vistas.get(n)
      if (!fuente) {
        descartes.push({ url: n, motivo: 'inventada' })
        continue
      }
      if (hostEn(new URL(n).hostname, DOMINIOS_BLOQUEADOS)) {
        descartes.push({ url: n, motivo: 'dominio' })
        continue
      }
      const hash = hashDeUrl(n)
      if (enLote.has(hash)) {
        descartes.push({ url: n, motivo: 'duplicada' })
        continue
      }
      enLote.add(hash)
      porLeer.push({ url: n, urlOriginal: c.url, hash, porQue: c.porQue, nuevo: c.nuevo, edad: fuente.edad, f: c.f })
    }
    if (porLeer.length) {
      const { data: existentes } = await db.from('news_items').select('url_hash').eq('es_qa', a.es_qa).in('url_hash', porLeer.map((p) => p.hash))
      const ya = new Set((existentes ?? []).map((e) => e.url_hash))
      for (const p of porLeer.filter((p) => ya.has(p.hash))) descartes.push({ url: p.url, motivo: 'duplicada' })
      porLeer.splice(0, porLeer.length, ...porLeer.filter((p) => !ya.has(p.hash)))
    }

    await paso(db, huntId, `Leyendo ${porLeer.length} notas`)
    const leidas = await deAPocos(porLeer, LECTURAS_A_LA_VEZ, async (p) => ({
      p,
      // Los videos de YouTube son una fuente más (los «canales»): de ellos se lee el título y la descripción.
      pagina: idDeYoutube(p.url) ? await leerVideo(p.url) : await leerPagina(p.url, { extracto: 1500 }),
    }))
    const ahora = Date.now()
    const candidatas: Candidata[] = []
    for (const { p, pagina } of leidas) {
      if ('error' in pagina) {
        descartes.push({ url: p.url, motivo: 'rota' })
        continue
      }
      // La canónica de la misma página puede ser otra cara de una ya vista.
      let url = p.url
      let hash = p.hash
      const canonica = pagina.canonica ? normalizarUrl(pagina.canonica) : null
      if (canonica && canonica !== p.url && new URL(canonica).hostname === new URL(p.url).hostname) {
        const h = hashDeUrl(canonica)
        if (enLote.has(h) && h !== p.hash) {
          descartes.push({ url: p.url, motivo: 'duplicada' })
          continue
        }
        url = canonica
        hash = h
        enLote.add(h)
      }
      // Cada frente con su ventana: 72 horas las noticias, 7 días las guías.
      const fecha = pagina.publicado ?? fechaDeEdad(p.edad)
      if (fecha && ahora - fecha.getTime() > p.f.horas * 3_600_000) {
        descartes.push({ url, motivo: 'vieja' })
        continue
      }
      if (!pagina.extracto && !pagina.descripcion) {
        descartes.push({ url, motivo: 'sin_texto' })
        continue
      }
      candidatas.push({ ...p, url, hash, pagina })
    }
    if (candidatas.length === 0) {
      return terminar(db, huntId, 'sin_resultados', {
        descartes,
        detalle: ['Ninguna candidata pasó la limpieza.', avisoDeCaidos].filter(Boolean).join(' '),
      })
    }

    // --- 3. elegir y redactar el top 5 -----------------------------------------
    await paso(db, huntId, `Eligiendo y redactando el top ${MAX_PROPUESTAS}`)
    const lista = variadas(candidatas, MAX_A_REDACTAR)
    const bloque = lista
      .map((c, i) =>
        [
          `<candidata clave="C${i + 1}">`,
          `frente: ${c.f.nombre}`,
          `tipo: ${c.f.tipo === 'guia' ? 'guía para aprender' : 'noticia'}`,
          `medio: ${c.pagina.medio}`,
          `fecha: ${c.pagina.publicado?.toISOString().slice(0, 10) ?? c.edad ?? 'sin fecha'}`,
          `titulo: ${c.pagina.titulo ?? ''}`,
          `descripcion: ${c.pagina.descripcion ?? ''}`,
          `por que le sirve (segun la busqueda): ${c.porQue}`,
          c.nuevo ? `que hay de nuevo (segun la busqueda): ${c.nuevo}` : '',
          `texto de la pagina: ${c.pagina.extracto}`,
          `</candidata>`,
        ]
          .filter(Boolean)
          .join('\n')
      )
      .join('\n\n')
    const redaccion = await llamar({
      tarea: 'noticias_redactar',
      modelo: a.modelo_fuerte,
      sistema: [{ texto: REGLAS_REDACCION }],
      mensaje: `Hoy es ${hoyEnCdmx()}.${yaVistos}\n\n${bloque}`,
      maxTokens: 4500,
      effort: 'medium',
      esquema: EsquemaRedaccion,
      huntId,
    })
    if (!redaccion.ok) return terminar(db, huntId, 'fallida', { descartes, detalle: motivoDeFallo(redaccion.motivo, redaccion.detalle) })
    const escritas = redaccion.datos ?? EsquemaRedaccion.safeParse(primerJson(redaccion.texto)).data
    if (!escritas) return terminar(db, huntId, 'fallida', { descartes, detalle: 'La IA no devolvió las noticias en el formato esperado.' })

    const usadas = new Set<string>()
    const filas = escritas.noticias
      .map((n) => ({ n, c: lista[Number(n.clave.replace(/\D/g, '')) - 1] }))
      .filter((x): x is { n: (typeof escritas.noticias)[number]; c: Candidata } => Boolean(x.c) && !usadas.has(x.n.clave) && Boolean(usadas.add(x.n.clave)))
      .slice(0, MAX_PROPUESTAS)
      .map(({ n, c }, i) => {
        const nuevo = textoLimpio(n.nuevo, 400)
        const notas = [`Frente: ${c.f.nombre}.`, n.seguimiento ? `Seguimiento de un tema que ya se publicó. Lo nuevo: ${nuevo || 'sin detalle'}.` : '']
          .filter(Boolean)
          .join('\n')
        return {
          es_qa: a.es_qa,
          hunt_id: huntId,
          course_id: casa.id,
          url: c.url,
          url_original: c.urlOriginal.slice(0, 2000),
          url_hash: c.hash,
          tipo_fuente: c.pagina.esVideo ? ('video' as const) : ('articulo' as const),
          medio: c.pagina.medio.slice(0, 80),
          titulo: textoLimpio(n.titulo, 160),
          resumen: textoLimpio(n.resumen, 600),
          texto: textoLimpio(n.texto, 5000),
          publicado_en_fuente: c.pagina.publicado?.toISOString() ?? null,
          notas: notas.slice(0, 2000),
          orden: i + 1,
        }
      })
      .filter((f) => f.titulo.length >= 3 && f.resumen.length > 0 && f.texto.length > 0)

    if (filas.length === 0) {
      return terminar(db, huntId, 'sin_resultados', { descartes, detalle: ['La IA no eligió ninguna.', avisoDeCaidos].filter(Boolean).join(' ') })
    }
    const { error } = await db.from('news_items').upsert(filas, { onConflict: 'es_qa,url_hash', ignoreDuplicates: true })
    if (error) {
      registrar('noticias:guardar', { huntId, error: error.message })
      return terminar(db, huntId, 'fallida', { descartes, detalle: 'No se pudieron guardar las propuestas.' })
    }
    await terminar(db, huntId, 'lista', { descartes, ...(avisoDeCaidos ? { detalle: avisoDeCaidos } : {}) })
  } catch (e) {
    registrar('noticias:cazar', { huntId, error: e instanceof Error ? e.message : String(e) })
    await terminar(db, huntId, 'fallida', { detalle: 'Algo falló a la mitad. Intenta de nuevo.' })
  }
}

// ==========================================================================
// Desde una liga
// ==========================================================================

export async function noticiaDesdeLiga(huntId: string): Promise<void> {
  const db = dbDelAgente()
  try {
    const [a, casa, { data: hunt }] = await Promise.all([
      ajustesDelAgente(),
      casaDeNoticias(db),
      db.from('news_hunts').select('url_pedida, enfoque').eq('id', huntId).maybeSingle(),
    ])
    if (!a) return terminar(db, huntId, 'fallida', { detalle: 'Faltan los ajustes del agente.' })
    if (!casa) return terminar(db, huntId, 'fallida', { detalle: 'No encontré el muro de V-AI-P.' })
    const url = hunt?.url_pedida ? normalizarUrl(hunt.url_pedida) : null
    if (!url) return terminar(db, huntId, 'fallida', { detalle: 'La liga no es válida.' })

    await paso(db, huntId, idDeYoutube(url) ? 'Leyendo el video' : 'Leyendo la nota')
    const pagina = idDeYoutube(url) ? await leerVideo(url) : await leerPagina(url, { extracto: 6000 })
    if ('error' in pagina) return terminar(db, huntId, 'fallida', { detalle: `No se pudo leer la liga: ${pagina.error}` })

    await paso(db, huntId, 'Investigando y redactando')
    const datos = [
      `<liga>`,
      `tipo: ${pagina.esVideo ? 'video de YouTube (no lo viste)' : 'articulo'}`,
      `medio: ${pagina.medio}`,
      `fecha: ${pagina.publicado?.toISOString().slice(0, 10) ?? 'sin fecha'}`,
      `titulo: ${pagina.titulo ?? ''}`,
      `descripcion: ${pagina.descripcion ?? ''}`,
      pagina.extracto ? `texto: ${pagina.extracto}` : '',
      `</liga>`,
    ]
      .filter(Boolean)
      .join('\n')
    const r = await llamar({
      tarea: 'noticia_liga',
      modelo: a.modelo_fuerte,
      sistema: [{ texto: REGLAS_LIGA }],
      mensaje: `Hoy es ${hoyEnCdmx()}.${hunt?.enfoque ? `\n\nEl equipo pide destacar: ${hunt.enfoque}` : ''}\n\n${datos}`,
      maxTokens: 2500,
      effort: 'medium',
      busqueda: { maxUsos: 3 },
      huntId,
    })
    if (!r.ok) return terminar(db, huntId, 'fallida', { detalle: motivoDeFallo(r.motivo, r.detalle) })
    const escrita = EsquemaLiga.safeParse(primerJson(r.texto))
    if (!escrita.success) return terminar(db, huntId, 'fallida', { detalle: 'La IA no devolvió la noticia en el formato esperado.' })

    const consultadas = r.fuentes
      .slice(0, 6)
      .map((f) => `${f.titulo} — ${new URL(f.url).hostname}`)
      .join('\n')
    const notas = [escrita.data.advertencia.trim() ? `Advertencia: ${escrita.data.advertencia.trim()}` : '', consultadas ? `Consultó:\n${consultadas}` : '']
      .filter(Boolean)
      .join('\n\n')

    const fila = {
      es_qa: a.es_qa,
      hunt_id: huntId,
      course_id: casa.id,
      url,
      url_original: hunt?.url_pedida?.slice(0, 2000) ?? null,
      url_hash: hashDeUrl(url),
      tipo_fuente: pagina.esVideo ? ('video' as const) : ('articulo' as const),
      medio: (pagina.medio || medioDeHost(new URL(url).hostname)).slice(0, 80),
      titulo: textoLimpio(escrita.data.titulo, 160),
      resumen: textoLimpio(escrita.data.resumen, 600),
      texto: textoLimpio(escrita.data.texto, 5000),
      publicado_en_fuente: pagina.publicado?.toISOString() ?? null,
      orden: 1,
      notas: notas.slice(0, 2000) || null,
    }
    if (fila.titulo.length < 3 || !fila.resumen || !fila.texto) {
      return terminar(db, huntId, 'fallida', { detalle: 'La IA dejó la noticia vacía. Prueba con otra liga.' })
    }
    const { error } = await db.from('news_items').insert(fila)
    if (error) {
      const repetida = error.code === '23505'
      if (!repetida) registrar('noticias:liga:guardar', { huntId, error: error.message })
      return terminar(db, huntId, 'fallida', { detalle: repetida ? 'Esa noticia ya estaba propuesta o publicada.' : 'No se pudo guardar la propuesta.' })
    }
    await terminar(db, huntId, 'lista')
  } catch (e) {
    registrar('noticias:liga', { huntId, error: e instanceof Error ? e.message : String(e) })
    await terminar(db, huntId, 'fallida', { detalle: 'Algo falló a la mitad. Intenta de nuevo.' })
  }
}
