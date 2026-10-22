#!/usr/bin/env node
/**
 * test-noticias.mjs — Criterio de cierre de M24: publicar desde el panel de
 * V-AI-P y las noticias con IA (cacería, liga, propuestas, imagen y muro).
 *
 *   El servidor necesita el Claude simulado y el sitio de noticias falso:
 *   ANTHROPIC_SIMULADO=http://127.0.0.1:4805 NOTICIAS_SITIO_DE_PRUEBA=http://127.0.0.1:4806 \
 *     PORT=3117 pnpm start
 *   pnpm qa:mostrar
 *   APP_URL=http://localhost:3117 node scripts/test-noticias.mjs
 *   pnpm qa:esconder
 *
 * `--conservar` deja la casa QA con sus noticias para `pnpm capturas`;
 * `--limpiar` solo borra lo de la suite.
 *
 * Con ANTHROPIC_SIMULADO el servidor es el «agente QA»: sus búsquedas y
 * propuestas van con `es_qa = true` y publica en la casa del plan `qa-agente`
 * (que esta suite arma con su curso `qa-noticias-casa`), nunca en el muro real.
 * El sitio falso sirve los hosts `*.qa-noticias.invalid`.
 */

import { createHash } from 'node:crypto'
import http from 'node:http'

import { cargarEnv, conectarPostgres, exigir } from './lib/entorno.mjs'

const vars = cargarEnv()
const SUPABASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')
const APP = (process.env.APP_URL ?? 'http://localhost:3117').replace(/\/+$/, '')
const CONSERVAR = process.argv.includes('--conservar')
const SOLO_LIMPIAR = process.argv.includes('--limpiar')
const PUERTO_CLAUDE = 4805
const PUERTO_SITIO = 4806

const PLAN = 'qa-agente'
const CASA = 'qa-noticias-casa'
const CORREO_ADMIN = 'qa-admin@academia.vadai.com.mx'
const CORREO_CM = 'qa-cm@academia.vadai.com.mx'
const CORREO_ALUMNO = 'qa-alumno1@academia.vadai.com.mx'

const Q = (dominio, ruta) => `https://${dominio}.qa-noticias.invalid${ruta}`
const URL_A = Q('theverge.com', '/agentes-excel')
const URL_B = 'https://www.theverge.com.qa-noticias.invalid/agentes-excel?utm_source=qa&utm_medium=correo'
const URL_C = Q('techcrunch.com', '/vieja')
const URL_D = Q('reuters.com', '/no-existe')
const URL_E = Q('openai.com', '/redirige')
const URL_G = Q('anthropic.com', '/ya-publicada')
const URL_H = Q('blog.google', '/inventada')
const URL_I = Q('x.com', '/rumor')
const URL_J = Q('anthropic.com', '/claude-pdf')
const URL_K = Q('microsoft.com', '/copilot-precios')
// 21-oct-2026: la cacería a fondo, con cinco frentes.
const URL_ROBOT = Q('therobotreport.com', '/humanoides-almacen')
const URL_VIEJA5 = Q('spectrum.ieee.org', '/robot-de-hace-5-dias')
const URL_MX = Q('elfinanciero.com.mx', '/ia-en-mexico')
const URL_GUIA = Q('learn.microsoft.com', '/guia-copilot-excel')
const URL_VIDEO_GUIA = 'https://youtube.com.qa-noticias.invalid/watch?v=qaGuia456'
const URL_LIGA = Q('xataka.com.mx', '/nota-liga')
const URL_VIDEO = 'https://youtube.com.qa-noticias.invalid/watch?v=qaVideo123'

const hash = (u) => createHash('sha256').update(u).digest('hex')

// ============================================================================
// El sitio de noticias falso (127.0.0.1:4806)
// ============================================================================

const haceHoras = (h) => new Date(Date.now() - h * 3_600_000).toISOString()
function pagina({ titulo, medio, publicado, canonica, parrafos }) {
  return `<!doctype html><html><head>
<title>${titulo} | ${medio}</title>
<meta property="og:title" content="${titulo}">
<meta property="og:site_name" content="${medio}">
<meta property="og:description" content="${parrafos[0].slice(0, 120)}">
${publicado ? `<meta property="article:published_time" content="${publicado}">` : ''}
${canonica ? `<link rel="canonical" href="${canonica}">` : ''}
</head><body><nav>Menú</nav><article>${parrafos.map((p) => `<p>${p}</p>`).join('')}</article></body></html>`
}
const largo = (t) => `${t} Esto le sirve a una empresa que trabaja con Excel, Word y correo todos los días, y lo puede probar el lunes.`

const PAGINAS = {
  '/theverge.com/agentes-excel': () =>
    pagina({ titulo: 'OpenAI lanza agentes que trabajan con Excel', medio: 'The Verge', publicado: haceHoras(5), canonica: URL_A, parrafos: [largo('OpenAI presentó agentes que llenan hojas de Excel.'), largo('Están disponibles para cuentas de empresa.')] }),
  '/techcrunch.com/vieja': () =>
    pagina({ titulo: 'Una noticia vieja', medio: 'TechCrunch', publicado: haceHoras(240), parrafos: [largo('Esto pasó hace diez días.')] }),
  '/anthropic.com/claude-pdf': () =>
    pagina({ titulo: 'Claude ahora llena formatos PDF', medio: 'Anthropic', publicado: haceHoras(10), parrafos: [largo('Claude ya puede leer y llenar formatos PDF.'), largo('Funciona en los planes Team y Enterprise.')] }),
  '/microsoft.com/copilot-precios': () =>
    pagina({ titulo: 'Copilot baja sus precios para pymes', medio: 'Microsoft', publicado: null, parrafos: [largo('Microsoft anunció precios nuevos de Copilot para empresas pequeñas.')] }),
  '/anthropic.com/ya-publicada': () => pagina({ titulo: 'Ya publicada', medio: 'Anthropic', publicado: haceHoras(3), parrafos: [largo('Ya salió.')] }),
  '/x.com/rumor': () => pagina({ titulo: 'Rumor', medio: 'X', publicado: haceHoras(2), parrafos: [largo('Un rumor sin fuente.')] }),
  '/therobotreport.com/humanoides-almacen': () =>
    pagina({ titulo: 'Robots humanoides empiezan a trabajar en almacenes', medio: 'The Robot Report', publicado: haceHoras(6), parrafos: [largo('Una cadena de almacenes puso robots humanoides a mover cajas.')] }),
  '/spectrum.ieee.org/robot-de-hace-5-dias': () =>
    pagina({ titulo: 'Un robot de hace cinco días', medio: 'IEEE Spectrum', publicado: haceHoras(120), parrafos: [largo('Esto es noticia de la semana pasada.')] }),
  '/elfinanciero.com.mx/ia-en-mexico': () =>
    pagina({ titulo: 'Empresas mexicanas adoptan IA en sus áreas de ventas', medio: 'El Financiero', publicado: haceHoras(20), parrafos: [largo('Un estudio dice que más empresas mexicanas usan IA en ventas.')] }),
  '/learn.microsoft.com/guia-copilot-excel': () =>
    pagina({ titulo: 'Guía: Copilot en Excel paso a paso', medio: 'Microsoft Learn', publicado: haceHoras(120), parrafos: [largo('Una guía oficial para usar Copilot en Excel.')] }),
  '/xataka.com.mx/nota-liga': () =>
    pagina({ titulo: 'Gemini llega a Gmail en español', medio: 'Xataka México', publicado: haceHoras(20), parrafos: [largo('Google activó Gemini dentro de Gmail para cuentas en México.'), largo('Resume hilos largos y propone respuestas.')] }),
}

const sitio = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x')
  if (u.pathname === '/reuters.com/no-existe') return res.writeHead(404, { 'content-type': 'text/html' }).end('<p>no</p>')
  if (u.pathname === '/openai.com/redirige') return res.writeHead(302, { location: 'https://169.254.169.254/latest/meta-data' }).end()
  if (u.pathname === '/youtube.com/oembed') {
    return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ title: 'QA video: Claude en 10 minutos', author_name: 'Canal QA' }))
  }
  if (u.pathname === '/youtube.com/watch') {
    return res
      .writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      .end(`<!doctype html><html><head><title>QA video - YouTube</title><meta name="description" content="Te enseñamos a usar Claude con tus archivos de Excel en 10 minutos."><meta property="og:title" content="QA video: Claude en 10 minutos"></head><body></body></html>`)
  }
  const hacer = PAGINAS[u.pathname]
  if (!hacer) return res.writeHead(404).end()
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(hacer())
})

// ============================================================================
// El Claude falso (127.0.0.1:4805)
// ============================================================================

const peticiones = []
const RESULTADOS = [
  [URL_A, 'OpenAI lanza agentes', '5 hours ago'],
  [URL_B, 'OpenAI lanza agentes (otra liga)', '5 hours ago'],
  [URL_C, 'Vieja', '10 days ago'],
  [URL_D, 'No existe', '1 day ago'],
  [URL_E, 'Redirige', '1 day ago'],
  [URL_G, 'Ya publicada', '3 hours ago'],
  [URL_I, 'Rumor', '2 hours ago'],
  [URL_J, 'Claude y los PDF', '10 hours ago'],
  [URL_K, 'Copilot precios', '3 hours ago'],
]
const bloquesDeBusqueda = (resultados) => [
  { type: 'server_tool_use', id: 'srvtoolu_qa1', name: 'web_search', input: { query: 'noticias de IA' } },
  {
    type: 'web_search_tool_result',
    tool_use_id: 'srvtoolu_qa1',
    content: resultados.map(([url, title, page_age]) => ({ type: 'web_search_result', url, title, page_age, encrypted_content: 'qa' })),
  },
]
const respuesta = (modelo, content, busquedas = 0) => ({
  id: 'msg_qa',
  type: 'message',
  role: 'assistant',
  model: modelo,
  content,
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: { input_tokens: 1500, output_tokens: 500, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: { web_search_requests: busquedas } },
})

// Los medios que bloquean al buscador de Anthropic, como los rechaza la API real
// (21-oct-2026): si `allowed_domains` trae uno, la búsqueda ENTERA sale con 400.
// Los cinco de verdad nunca deben llegar; bloomberg.com hace del medio que «mañana»
// empieza a bloquear, para probar que la cacería lo quita sola y reintenta.
const SIN_BUSCADOR = ['apnews.com', 'arstechnica.com', 'reuters.com', 'theverge.com', 'wired.com']

// Lo que encuentra y propone cada frente de la cacería (lib/noticias/prompt.ts, FRENTES).
const POR_FRENTE = {
  'Modelos y lanzamientos de IA': {
    resultados: [RESULTADOS[0], RESULTADOS[1], RESULTADOS[5], RESULTADOS[7]],
    candidatas: [URL_A, URL_B, URL_G, URL_H, URL_J],
  },
  'Herramientas de IA para empresas': {
    resultados: [RESULTADOS[8], RESULTADOS[3], RESULTADOS[0]],
    candidatas: [URL_K, URL_D, URL_A],
  },
  'Robótica y hardware': {
    resultados: [[URL_ROBOT, 'Humanoides en almacenes', '6 hours ago'], [URL_VIEJA5, 'Robot de hace 5 días', '5 days ago']],
    candidatas: [URL_ROBOT, URL_VIEJA5],
  },
  'IA en México y en español': {
    resultados: [[URL_MX, 'IA en ventas en México', '20 hours ago'], RESULTADOS[4]],
    candidatas: [URL_MX, URL_E],
  },
  'Aprender IA': {
    resultados: [[URL_GUIA, 'Guía de Copilot en Excel', '5 days ago'], [URL_VIDEO_GUIA, 'Video: Claude con Excel', '2 days ago'], RESULTADOS[2], RESULTADOS[6]],
    candidatas: [URL_GUIA, URL_VIDEO_GUIA, URL_C, URL_I],
  },
}

const claude = http.createServer(async (req, res) => {
  let crudo = ''
  for await (const pedazo of req) crudo += pedazo
  const cuerpo = JSON.parse(crudo || '{}')
  const sistema = (cuerpo.system ?? []).map((b) => b.text ?? '').join('\n')
  const mensaje = (cuerpo.messages ?? []).map((m) => (typeof m.content === 'string' ? m.content : '')).join('\n')
  peticiones.push({ sistema, mensaje, cuerpo })
  const enviar = (r) => res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(r))

  const bloqueados = (cuerpo.tools?.[0]?.allowed_domains ?? []).filter((d) => SIN_BUSCADOR.includes(d))
  if (bloqueados.length > 0) {
    const lista = bloqueados.map((d) => `'${d}'`).join(', ')
    return res.writeHead(400, { 'content-type': 'application/json' }).end(
      JSON.stringify({
        type: 'error',
        error: {
          type: 'invalid_request_error',
          message: `The following domains are not accessible to our user agent: [${lista}]. Read more: https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler`,
        },
      })
    )
  }

  if (sistema.includes('investigas A FONDO un frente')) {
    const frente = POR_FRENTE[sistema.match(/Frente: ([^\n]+)\./)?.[1] ?? '']
    if (!frente) return enviar(respuesta(cuerpo.model, [{ type: 'text', text: '{"candidatas":[]}' }]))
    const candidatas = frente.candidatas.map((url, i) => ({ url, titulo: `Candidata ${i + 1}`, por_que: 'Le sirve a una empresa.', nuevo: '' }))
    return enviar(respuesta(cuerpo.model, [...bloquesDeBusqueda(frente.resultados), { type: 'text', text: `Aquí van:\n${JSON.stringify({ candidatas })}` }], 2))
  }
  if (sistema.includes('escribes las noticias de IA')) {
    const claves = [...mensaje.matchAll(/<candidata clave="(C\d+)">[\s\S]*?\nmedio: ([^\n]*)/g)].map((m) => ({ clave: m[1], medio: m[2] }))
    // La segunda, como seguimiento de un tema ya publicado.
    const noticias = claves.slice(0, 5).map((c, i) => ({
      clave: c.clave,
      titulo: `QA-NOTICIA ${c.medio}`,
      resumen: `Lo esencial de ${c.medio}.`,
      texto: `Qué cambió en ${c.medio}. Más en https://ejemplo.com/qa y escribe a qa@ejemplo.com.\n\nQué puede hacer tu empresa con eso.`,
      seguimiento: i === 1,
      nuevo: i === 1 ? 'Ahora también para pymes en México.' : '',
    }))
    return enviar(respuesta(cuerpo.model, [{ type: 'text', text: JSON.stringify({ noticias }) }]))
  }
  if (sistema.includes('conviertes una liga')) {
    const video = mensaje.includes('video de YouTube')
    const nota = {
      titulo: video ? 'QA-LIGA video de Claude con Excel' : 'QA-LIGA Gemini llega a Gmail en español',
      resumen: 'Lo esencial de la liga.',
      texto: 'Qué cambió.\n\nQué puede hacer una empresa con eso.',
      advertencia: video ? 'No vi el video: escribí con el título y la descripción.' : '',
    }
    return enviar(respuesta(cuerpo.model, [...bloquesDeBusqueda([[URL_J, 'Contexto de la liga', '1 day ago']]), { type: 'text', text: JSON.stringify(nota) }], 1))
  }
  res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'QA: no reconozco esta petición' } }))
})

// ============================================================================
// Sesión, formularios y reporte
// ============================================================================

function crearFrasco() {
  const cookies = new Map()
  return {
    guardar(r) {
      for (const cruda of r.headers.getSetCookie?.() ?? []) {
        const [par] = cruda.split(';')
        const i = par.indexOf('=')
        if (i === -1) continue
        const v = par.slice(i + 1).trim()
        if (v === '' || /Max-Age=0/i.test(cruda)) cookies.delete(par.slice(0, i).trim())
        else cookies.set(par.slice(0, i).trim(), v)
      }
    },
    encabezado: () => [...cookies.entries()].map(([n, v]) => `${n}=${v}`).join('; '),
    get tamano() {
      return cookies.size
    },
  }
}
async function entrar(email) {
  const r = await fetch(`${SUPABASE}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'recovery', email }),
  })
  const c = await r.json()
  const hashToken = c.hashed_token ?? c.properties?.hashed_token
  const frasco = crearFrasco()
  frasco.guardar(await fetch(`${APP}/auth/confirmar?token_hash=${encodeURIComponent(hashToken)}&type=recovery`, { redirect: 'manual' }))
  return frasco
}
const pedir = (ruta, frasco, opciones = {}) =>
  fetch(`${APP}${ruta}`, { redirect: 'manual', ...opciones, headers: frasco?.tamano ? { cookie: frasco.encabezado() } : {} })
const html = async (ruta, frasco) => (await pedir(ruta, frasco)).text()

/** El primer `<form>` que cumple `prueba`, con sus campos (como lo enviaría un navegador sin JS). */
function formularioDonde(pagina, prueba) {
  for (const bloque of pagina.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)) {
    if (!prueba(bloque[1])) continue
    const campos = {}
    for (const etiqueta of bloque[1].matchAll(/<(?:input|select|textarea)\b[^>]*>/g)) {
      const nombre = etiqueta[0].match(/name="([^"]*)"/)?.[1]
      if (!nombre) continue
      const tipo = etiqueta[0].match(/type="([^"]*)"/)?.[1]
      if (tipo === 'file') continue
      if ((tipo === 'checkbox' || tipo === 'radio') && !/\schecked/.test(etiqueta[0])) continue
      campos[nombre] = (etiqueta[0].match(/value="([^"]*)"/)?.[1] ?? '').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&')
    }
    return campos
  }
  return null
}
async function enviarFormulario(ruta, campos, frasco) {
  const cuerpo = new FormData()
  for (const [nombre, valor] of Object.entries(campos)) cuerpo.append(nombre, valor)
  return pedir(ruta, frasco, { method: 'POST', body: cuerpo })
}

const resultados = []
const afirmar = (grupo, descripcion, esperado, real) => resultados.push({ grupo, descripcion, esperado, real, ok: esperado === real })
function imprimir() {
  const porGrupo = new Map()
  for (const r of resultados) porGrupo.set(r.grupo, [...(porGrupo.get(r.grupo) ?? []), r])
  const ancho = Math.max(10, ...resultados.map((r) => r.descripcion.length))
  console.log('\n  PRUEBA DE NOTICIAS Y PUBLICAR — M24')
  console.log(`  App: ${APP}`)
  for (const [grupo, casos] of porGrupo) {
    console.log(`\n  ${grupo}\n  ${'─'.repeat(ancho + 30)}`)
    for (const c of casos) console.log(`  ${c.ok ? '✓' : '✗'}  ${c.descripcion.padEnd(ancho)}  ${c.ok ? String(c.real) : `esperado ${c.esperado}, obtuvo ${c.real}`}`)
  }
  const fallidas = resultados.filter((r) => !r.ok)
  console.log(`\n  ${'─'.repeat(ancho + 30)}`)
  console.log(fallidas.length === 0 && resultados.length > 0 ? `  M24 EN VERDE — ${resultados.length}/${resultados.length} aserciones pasaron.` : `  ${fallidas.length} de ${resultados.length} aserciones FALLARON.`)
  for (const f of fallidas) console.log(`    ${f.grupo} · ${f.descripcion}: esperado ${f.esperado}, obtuvo ${f.real}`)
  console.log('')
  return fallidas.length === 0 && resultados.length > 0
}

// ============================================================================
// Base: lo de la suite, por nombre exacto
// ============================================================================

const una = async (bd, sql, p = []) => (await bd.query(sql, p)).rows[0] ?? null
const varias = async (bd, sql, p = []) => (await bd.query(sql, p)).rows
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms))

async function borrarDelStorage(rutas) {
  if (rutas.length === 0) return
  await fetch(`${SUPABASE}/storage/v1/object/academia-media`, {
    method: 'DELETE',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: rutas }),
  })
}

async function purgar(bd) {
  const casa = await una(bd, `select id from academia.courses where slug = $1`, [CASA])
  if (casa) {
    const posts = await varias(bd, `select images from academia.community_posts where course_id = $1`, [casa.id])
    await borrarDelStorage(posts.flatMap((p) => (Array.isArray(p.images) ? p.images.map((i) => i.storage_path).filter(Boolean) : [])))
    await bd.query(`delete from academia.community_posts where course_id = $1`, [casa.id])
    await bd.query(`delete from academia.community_topics where course_id = $1`, [casa.id])
    await bd.query(`delete from academia.enrollments where course_id = $1`, [casa.id])
  }
  // Las búsquedas y propuestas QA son solo de esta suite (`es_qa`).
  await bd.query(`delete from academia.agent_runs where es_qa and tarea in ('noticias', 'noticias_redactar', 'noticia_liga')`)
  await bd.query(`delete from academia.news_items where es_qa`)
  await bd.query(`delete from academia.news_hunts where es_qa`)
  await bd.query(`delete from academia.membership_plans where slug = $1 and hub_course_id in (select id from academia.courses where slug = $2)`, [PLAN, CASA])
  await bd.query(`delete from academia.cohorts where course_id in (select id from academia.courses where slug = $1)`, [CASA])
  await bd.query(`delete from academia.courses where slug = $1`, [CASA])
}

async function esperarBusqueda(bd, id) {
  for (let i = 0; i < 90; i += 1) {
    const h = await una(bd, `select estado, detalle, descartes from academia.news_hunts where id = $1`, [id])
    if (h && h.estado !== 'buscando') return h
    await esperar(1000)
  }
  return { estado: 'se quedó buscando', detalle: null, descartes: [] }
}

const idDeRedireccion = (r) => (r.headers.get('location') ?? '').match(/busqueda=([0-9a-f-]{36})/)?.[1] ?? null

// ============================================================================
// La prueba
// ============================================================================

await Promise.all([
  new Promise((ok) => claude.listen(PUERTO_CLAUDE, '127.0.0.1', ok)),
  new Promise((ok) => sitio.listen(PUERTO_SITIO, '127.0.0.1', ok)),
])
const bd = await conectarPostgres(vars)
let verde = false
let ajustesPrevios = null

try {
  await purgar(bd)
  if (SOLO_LIMPIAR) {
    console.log('\n  Limpio: la casa QA de noticias, sus búsquedas y sus propuestas.\n')
    await bd.end()
    claude.close()
    sitio.close()
    process.exit(0)
  }
  if (await una(bd, `select 1 from academia.membership_plans where slug = $1`, [PLAN])) {
    throw new Error(`Ya existe el plan ${PLAN} (¿quedó de test-agente --conservar?). Límpialo antes.`)
  }
  const admin = await una(bd, `select user_id from academia.profiles where email = $1`, [CORREO_ADMIN])
  const alumno = await una(bd, `select user_id from academia.profiles where email = $1`, [CORREO_ALUMNO])
  const bot = await una(bd, `select user_id from academia.profiles where es_bot and status = 'active' limit 1`)
  if (!bot) throw new Error('Falta la cuenta «Equipo VADAI»: node scripts/cuenta-equipo-vadai.mjs')
  ajustesPrevios = await una(bd, `select tope_usd, pausado_por_tope, noticias, noticias_por_caceria from academia.agent_settings where es_qa`)
  if (!ajustesPrevios) throw new Error('Faltan los ajustes del agente QA (agent_settings es_qa). ¿Aplicaste 0050?')
  // La cacería grande prueba el top 5 variado; al final se prueba la de 1 (0050).
  await bd.query(`update academia.agent_settings set tope_usd = 5, pausado_por_tope = false, noticias_por_caceria = 5 where es_qa`)

  // --- la casa QA: curso, generación, plan y temas --------------------------
  const casa = await una(bd, `insert into academia.courses (slug, title, course_type, status, certificate_enabled) values ($1, 'QA · Casa de noticias (test-noticias)', 'cohort', 'published', false) returning id`, [CASA])
  const gen = await una(bd, `insert into academia.cohorts (course_id, name, starts_on, ends_on, open_for_enrollment) values ($1, 'Miembros', current_date, null, true) returning id`, [casa.id])
  await bd.query(`insert into academia.membership_plans (slug, name, price_mxn, status, hub_course_id) values ($1, 'QA Noticias', 100, 'active', $2)`, [PLAN, casa.id])
  await bd.query(
    `insert into academia.community_topics (course_id, name, slug, position, solo_equipo) values ($1, 'Noticias', 'noticias', -1, true), ($1, 'Avisos', 'avisos', -2, true), ($1, 'Prompts', 'prompts', 0, false)`,
    [casa.id]
  )
  // La G ya está publicada: la cacería no la vuelve a proponer.
  await bd.query(
    `insert into academia.news_items (es_qa, course_id, url, url_hash, medio, titulo, resumen, texto, estado) values (true, $1, $2, $3, 'Anthropic', 'QA ya publicada', 'Lo que ya se contó de Claude.', 't', 'publicada')`,
    [casa.id, URL_G, hash(URL_G)]
  )

  const sAdmin = await entrar(CORREO_ADMIN)
  const sCm = await entrar(CORREO_CM)
  const sAlumno = await entrar(CORREO_ALUMNO)

  // =========================================================================
  // 1. Quién entra
  // =========================================================================
  const P = 'Permisos'
  const delAlumno = await pedir('/admin/vaip/noticias', sAlumno)
  afirmar(P, 'un alumno no entra a Noticias', true, delAlumno.status >= 300 && delAlumno.status < 400)
  afirmar(P, 'ni a la vista previa de imágenes', 403, (await pedir('/api/noticias/vista-previa?titulo=hola%20mundo', sAlumno)).status)
  const paginaCm = await html('/admin/vaip/noticias', sCm)
  afirmar(P, 'el community manager sí entra', true, paginaCm.includes('Cazar noticias de hoy'))
  // M25: Publicar vive en el Muro de V-AI-P.
  afirmar(P, 'la barra lateral lleva Noticias y Muro', true, paginaCm.includes('href="/admin/vaip/noticias"') && paginaCm.includes('href="/admin/vaip/muro"'))

  // =========================================================================
  // 2. Cazar noticias
  // =========================================================================
  const C = 'Cacería'
  const postsAntes = (await una(bd, `select count(*)::int n from academia.community_posts where course_id = $1`, [casa.id])).n
  const formCazar = formularioDonde(paginaCm, (f) => f.includes('name="cazar"'))
  const respCazar = await enviarFormulario('/admin/vaip/noticias', formCazar, sCm)
  const idCaceria = idDeRedireccion(respCazar)
  afirmar(C, 'el botón empieza la búsqueda y regresa a la página', true, Boolean(idCaceria))
  const mientras = await html(`/admin/vaip/noticias?busqueda=${idCaceria}`, sCm)
  const caceria = await esperarBusqueda(bd, idCaceria)
  afirmar(C, 'mientras busca, la página se refresca sola', true, mientras.includes('http-equiv="refresh"') || caceria.estado !== 'buscando')
  afirmar(C, 'la búsqueda termina lista', 'lista', caceria.estado)

  const propuestas = await varias(bd, `select id, url, orden, titulo, texto, medio, estado, notas from academia.news_items where es_qa and hunt_id = $1 order by orden`, [idCaceria])
  // Turnándose entre frentes: la J (otra de modelos) se queda fuera del top 5.
  afirmar(C, 'deja el top 5, variado entre frentes', [URL_A, URL_K, URL_ROBOT, URL_MX, URL_GUIA].join(' '), propuestas.map((p) => p.url).join(' '))
  const deK = propuestas.find((p) => p.url === URL_K)
  afirmar(C, 'cada propuesta dice de qué frente viene', true, Boolean(deK?.notas?.includes('Frente: Herramientas de IA para empresas.')))
  afirmar(C, 'un seguimiento queda marcado con lo nuevo', true, Boolean(deK?.notas?.includes('Seguimiento de un tema que ya se publicó. Lo nuevo: Ahora también para pymes en México.')))
  const motivos = Object.fromEntries((caceria.descartes ?? []).map((d) => [d.url, d.motivo]))
  // La B normalizada es la A, y otro frente también trajo la A: los dos descartes quedan con la URL de la A.
  afirmar(C, 'la misma nota con utm, www o de otro frente cuenta como repetida', 'duplicada', motivos[URL_A])
  afirmar(C, 'la ya publicada no se vuelve a proponer', 'duplicada', motivos[URL_G])
  afirmar(C, 'una guía de hace 10 días se descarta por vieja', 'vieja', motivos[URL_C])
  afirmar(C, 'una noticia de hace 5 días se descarta por vieja', 'vieja', motivos[URL_VIEJA5])
  afirmar(C, '…pero una guía de hace 5 días sí entra', true, propuestas.some((p) => p.url === URL_GUIA))
  afirmar(C, 'la que da 404 se descarta', 'rota', motivos[URL_D])
  afirmar(C, 'la que redirige a una IP interna se descarta', 'rota', motivos[URL_E])
  afirmar(C, 'una liga que no salió en la búsqueda no entra', 'inventada', motivos[URL_H])
  afirmar(C, 'una red social que pide sesión no entra', 'dominio', motivos[URL_I])
  afirmar(C, 'el texto no trae URLs ni correos', false, propuestas.some((p) => /https?:\/\/|@/.test(p.texto)))

  const busquedas = peticiones.filter((p) => p.sistema.includes('investigas A FONDO un frente'))
  const herramienta = (p) => p?.cuerpo.tools?.[0] ?? {}
  const frentesPedidos = busquedas.map((p) => p.sistema.match(/Frente: ([^\n]+)\./)?.[1]).sort()
  afirmar(C, 'investiga los cinco frentes', Object.keys(POR_FRENTE).sort().join(' · '), frentesPedidos.join(' · '))
  afirmar(C, '…cada uno con 4 búsquedas', true, busquedas.length === 5 && busquedas.every((p) => herramienta(p).max_uses === 4))
  afirmar(C, '…en toda la web, sin lista de permitidos', false, busquedas.some((p) => 'allowed_domains' in herramienta(p)))
  afirmar(C, '…bloqueando redes sociales y agregadores', true, busquedas.every((p) => ['x.com', 'facebook.com', 'news.google.com'].every((d) => (herramienta(p).blocked_domains ?? []).includes(d))))
  afirmar(C, '…y desde México', true, busquedas.every((p) => herramienta(p).user_location?.country === 'MX'))
  afirmar(C, 'cada frente sabe lo que la comunidad ya vio', true, busquedas.every((p) => p.mensaje.includes('QA ya publicada — Lo que ya se contó de Claude.')))
  const deRedaccion = peticiones.find((p) => p.sistema.includes('escribes las noticias de IA'))
  afirmar(C, 'la redacción también lo sabe', true, Boolean(deRedaccion?.mensaje.includes('QA ya publicada')))
  afirmar(C, 'la redacción recibe candidatas de los cinco frentes', true, Object.keys(POR_FRENTE).every((f) => deRedaccion?.mensaje.includes(`frente: ${f}`)))
  afirmar(C, 'un video de YouTube entra como candidata, con su canal', true, Boolean(deRedaccion?.mensaje.includes('medio: YouTube · Canal QA')))
  const corridas = await varias(bd, `select tarea, estado, busquedas from academia.agent_runs where news_hunt_id = $1 order by created_at`, [idCaceria])
  afirmar(C, 'las seis llamadas quedan en el gasto, cerradas', '5 noticias · 1 noticias_redactar · todas cerradas', `${corridas.filter((r) => r.tarea === 'noticias').length} noticias · ${corridas.filter((r) => r.tarea === 'noticias_redactar').length} noticias_redactar · ${corridas.every((r) => r.estado === 'cerrada') ? 'todas cerradas' : 'alguna abierta'}`)
  afirmar(C, 'las búsquedas web cuentan', 10, corridas.reduce((s, r) => s + r.busquedas, 0))
  afirmar(C, 'la cacería sola no publica nada', postsAntes, (await una(bd, `select count(*)::int n from academia.community_posts where course_id = $1`, [casa.id])).n)
  const conPropuestas = await html('/admin/vaip/noticias', sCm)
  afirmar(C, 'las propuestas esperan en el panel', true, conPropuestas.includes('Esperan tu clic') && conPropuestas.includes(`propuesta-${propuestas[0]?.id}`))
  afirmar(C, 'el community manager no ve dólares', false, conPropuestas.includes('US$'))
  afirmar(C, 'el admin sí ve lo que costó', true, (await html(`/admin/vaip/noticias?busqueda=${idCaceria}`, sAdmin)).includes('US$'))

  // =========================================================================
  // 3. Publicar y descartar
  // =========================================================================
  const U = 'Publicar una noticia'
  const [pA, pOtra] = propuestas
  const formA = formularioDonde(conPropuestas, (f) => f.includes(`value="${pA?.id}"`) && f.includes('name="titulo"'))
  const camposA = { ...formA, titulo: 'QA-NOTICIA publicada', resumen: 'Lo esencial, corregido.', texto: 'Primer párrafo.\n\nSegundo párrafo.', fijar: 'no' }
  await enviarFormulario('/admin/vaip/noticias', camposA, sCm)
  const post = await una(
    bd,
    `select p.id, p.via, p.user_id, p.resumen, p.enlace_url, p.enlace_medio, p.images, p.publicado_por, t.slug as tema
       from academia.community_posts p left join academia.community_topics t on t.id = p.topic_id
      where p.course_id = $1 and p.title = 'QA-NOTICIA publicada'`,
    [casa.id]
  )
  afirmar(U, 'publicar la pone en el tema Noticias', 'noticias', post?.tema)
  afirmar(U, 'firmada por Equipo VADAI, revisada por una persona', `${bot.user_id} agente_revisado`, `${post?.user_id} ${post?.via}`)
  afirmar(U, 'con el resumen corregido y la liga «Leer más»', `Lo esencial, corregido. ${URL_A} The Verge`, `${post?.resumen} ${post?.enlace_url} ${post?.enlace_medio}`)
  const imagen = Array.isArray(post?.images) ? post.images[0] : null
  afirmar(U, 'con su imagen dibujada, guardada como PNG', true, Boolean(imagen?.storage_path?.startsWith('noticias/qa/') && imagen.storage_path.endsWith('.png')))
  const png = imagen ? await fetch(imagen.url) : null
  afirmar(U, '…que se abre desde el muro', 'image/png', png?.headers.get('content-type'))
  const marcada = await una(bd, `select estado, post_id from academia.news_items where id = $1`, [pA?.id])
  afirmar(U, 'la propuesta queda publicada y ligada', `publicada ${post?.id}`, `${marcada?.estado} ${marcada?.post_id}`)
  const doble = await (await enviarFormulario('/admin/vaip/noticias', camposA, sCm)).text()
  afirmar(U, 'un doble clic no publica dos veces', 1, (await una(bd, `select count(*)::int n from academia.community_posts where course_id = $1 and title = 'QA-NOTICIA publicada'`, [casa.id])).n)
  afirmar(U, '…y lo dice', true, doble.includes('ya se publicó'))
  const muro = await html(`/curso/${CASA}/comunidad?tema=noticias`, sAdmin)
  afirmar(U, 'el muro la enseña como tarjeta con su resumen y su liga', true, muro.includes('Lo esencial, corregido.') && muro.includes(`/curso/${CASA}/comunidad/${post?.id}`))
  const noticia = await html(`/curso/${CASA}/comunidad/${post?.id}`, sAdmin)
  afirmar(U, 'y su página, con «Leer la nota original en The Verge»', true, noticia.includes('Leer la nota original en The Verge') && noticia.includes(URL_A))

  const paraDescartar = formularioDonde(await html('/admin/vaip/noticias', sCm), (f) => f.includes(`value="${pOtra?.id}"`) && !f.includes('name="titulo"'))
  await enviarFormulario('/admin/vaip/noticias', paraDescartar, sCm)
  afirmar(U, 'descartar la saca de la bandeja', 'descartada', (await una(bd, `select estado from academia.news_items where id = $1`, [pOtra?.id]))?.estado)

  // =========================================================================
  // 4. Desde una liga
  // =========================================================================
  const L = 'Desde una liga'
  const pagNoticias = await html('/admin/vaip/noticias', sCm)
  const formLiga = formularioDonde(pagNoticias, (f) => f.includes('name="url"'))
  const peticionesAntes = peticiones.length
  for (const mala of ['https://localhost/x', 'https://10.0.0.1/x', 'https://intranet/x', 'nada']) {
    const r = await (await enviarFormulario('/admin/vaip/noticias', { ...formLiga, url: mala, enfoque: '' }, sCm)).text()
    afirmar(L, `rechaza «${mala}» antes de llamar a la IA`, true, /no es público|con su nombre|liga completa|no es válida/.test(r))
  }
  afirmar(L, '…sin una sola llamada al modelo', peticionesAntes, peticiones.length)

  const respLiga = await enviarFormulario('/admin/vaip/noticias', { ...formLiga, url: URL_LIGA, enfoque: 'cómo le sirve a un despacho' }, sCm)
  const liga = await esperarBusqueda(bd, idDeRedireccion(respLiga))
  afirmar(L, 'un artículo queda como propuesta', 'lista', liga.estado)
  const deLiga = await una(bd, `select titulo, tipo_fuente, medio, notas, estado from academia.news_items where es_qa and url = $1`, [URL_LIGA])
  afirmar(L, '…leída de la nota, con su medio', 'articulo Xataka México propuesta', `${deLiga?.tipo_fuente} ${deLiga?.medio} ${deLiga?.estado}`)
  afirmar(L, '…y con lo que consultó, solo para el equipo', true, Boolean(deLiga?.notas?.includes('Consultó')))
  const pidioEnfoque = peticiones.find((p) => p.sistema.includes('conviertes una liga') && p.mensaje.includes('cómo le sirve a un despacho'))
  afirmar(L, 'le pasa a la IA lo que el equipo pidió destacar', true, Boolean(pidioEnfoque))

  const repetida = await (await enviarFormulario('/admin/vaip/noticias', { ...formLiga, url: URL_LIGA, enfoque: '' }, sCm)).text()
  afirmar(L, 'la misma liga otra vez no se repite', true, repetida.includes('Esperan tu clic'))

  const respVideo = await enviarFormulario('/admin/vaip/noticias', { ...formLiga, url: URL_VIDEO, enfoque: '' }, sCm)
  const video = await esperarBusqueda(bd, idDeRedireccion(respVideo))
  const deVideo = await una(bd, `select tipo_fuente, medio, notas from academia.news_items where es_qa and url like '%qaVideo123%'`)
  afirmar(L, 'un video de YouTube queda como propuesta', 'lista video', `${video.estado} ${deVideo?.tipo_fuente}`)
  afirmar(L, '…con su canal y la advertencia de que no lo vio', true, deVideo?.medio === 'YouTube · Canal QA' && Boolean(deVideo?.notas?.includes('No vi el video')))

  // =========================================================================
  // 5. El tope de gasto y el límite del día
  // =========================================================================
  const G = 'Gasto y límites'
  await bd.query(`update academia.agent_settings set tope_usd = 0.0001, pausado_por_tope = false where es_qa`)
  const antesDelTope = peticiones.length
  const sinPresupuesto = await enviarFormulario('/admin/vaip/noticias', formularioDonde(await html('/admin/vaip/noticias', sCm), (f) => f.includes('name="cazar"')), sCm)
  const fallida = await esperarBusqueda(bd, idDeRedireccion(sinPresupuesto))
  afirmar(G, 'sin presupuesto, la búsqueda falla con su motivo', true, fallida.estado === 'fallida' && /presupuesto/.test(fallida.detalle ?? ''))
  afirmar(G, '…sin llamar al modelo', antesDelTope, peticiones.length)
  await bd.query(`update academia.agent_settings set tope_usd = 5, pausado_por_tope = false where es_qa`)
  let limite = ''
  try {
    await bd.query(`select academia.academia_noticias_iniciar('caceria', 'boton', null, null, null, 1, true)`)
  } catch (e) {
    limite = e.message
  }
  afirmar(G, 'con el límite del día lleno no abre otra', 'limite', limite)

  // =========================================================================
  // 6. El compositor: un aviso fijado
  // =========================================================================
  const A = 'Compositor'
  // M25: el compositor vive en el Muro, detrás de «Publicar en el muro».
  const pagPublicar = await html('/admin/vaip/muro', sAdmin)
  afirmar(A, 'el Muro trae el compositor', true, pagPublicar.includes('Publicar en V-AI-P'))
  const formCompositor = formularioDonde(pagPublicar, (f) => f.includes('name="tipo"') && f.includes('name="titulo"'))
  await enviarFormulario(
    '/admin/vaip/muro',
    { ...formCompositor, tipo: 'aviso', titulo: 'QA-AVISO herramienta nueva', texto: 'Ya está la plantilla de prompts para ventas.', fijar: '1', firma: 'equipo', imagen_generada: 'si', tema: '', resumen: '', enlace: '', medio: '' },
    sAdmin
  )
  const aviso = await una(
    bd,
    `select p.id, p.pinned, p.pinned_until, p.user_id, p.publicado_por, p.images, p.via, t.slug as tema
       from academia.community_posts p left join academia.community_topics t on t.id = p.topic_id
      where p.course_id = $1 and p.title = 'QA-AVISO herramienta nueva'`,
    [casa.id]
  )
  afirmar(A, 'el aviso va al tema Avisos, firmado por el equipo', `avisos ${bot.user_id} humano`, `${aviso?.tema} ${aviso?.user_id} ${aviso?.via}`)
  afirmar(A, '…con quién lo publicó', admin.user_id, aviso?.publicado_por)
  const horas = aviso?.pinned_until ? (Date.parse(aviso.pinned_until) - Date.now()) / 3_600_000 : -1
  afirmar(A, 'fijado por un día', true, aviso?.pinned === true && horas > 23 && horas < 25)
  afirmar(A, 'con la imagen de aviso dibujada', true, Boolean(Array.isArray(aviso?.images) && aviso.images[0]?.storage_path?.startsWith('vaip/qa/')))
  afirmar(A, 'sale en «Avisos fijados» del Muro', true, (await html('/admin/vaip/muro', sAdmin)).includes('QA-AVISO herramienta nueva'))

  // Un alumno no puede escribir en Avisos aunque esté en la generación.
  await bd.query('begin')
  let codigo = ''
  try {
    await bd.query(`insert into academia.enrollments (user_id, course_id, cohort_id, source, status) values ($1, $2, $3, 'manual', 'active')`, [alumno.user_id, casa.id, gen.id])
    await bd.query(`set local role authenticated`)
    await bd.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: alumno.user_id, role: 'authenticated' })])
    await bd.query(
      `insert into academia.community_posts (course_id, cohort_id, user_id, title, status, topic_id)
       values ($1, $2, $3, 'QA-AVISO de un alumno', 'visible', (select id from academia.community_topics where course_id = $1 and slug = 'avisos'))`,
      [casa.id, gen.id, alumno.user_id]
    )
  } catch (e) {
    codigo = e.code
  } finally {
    await bd.query('rollback')
  }
  afirmar(A, 'un alumno no publica en Avisos', '42501', codigo)

  // Un fijado vencido se apaga al abrir el muro.
  await bd.query(`update academia.community_posts set pinned_until = now() - interval '1 minute' where id = $1`, [aviso?.id])
  await html(`/curso/${CASA}/comunidad`, sAdmin)
  afirmar(A, 'el fijado vencido se apaga solo', false, (await una(bd, `select pinned from academia.community_posts where id = $1`, [aviso?.id]))?.pinned)

  // =========================================================================
  // 7. Cuántas noticias por búsqueda (0050): se guarda desde el panel, y con 1
  //    la IA elige la más hablada y queda una sola.
  // =========================================================================
  const N = 'Noticias por búsqueda'
  const pagCm = await html('/admin/vaip/noticias', sCm)
  afirmar(N, 'el community manager ve el valor, sin poder cambiarlo', true, pagCm.includes('Cada búsqueda deja') && !pagCm.includes('name="noticias_por_caceria"'))
  const pagAdmin = await html('/admin/vaip/noticias', sAdmin)
  const formCantidad = formularioDonde(pagAdmin, (f) => f.includes('name="noticias_por_caceria"'))
  afirmar(N, 'el admin tiene el selector', true, Boolean(formCantidad))
  if (formCantidad) {
    await enviarFormulario('/admin/vaip/noticias', { ...formCantidad, noticias_por_caceria: '1' }, sAdmin)
    afirmar(N, 'el valor queda guardado', 1, (await una(bd, `select noticias_por_caceria from academia.agent_settings where es_qa`))?.noticias_por_caceria)
    afirmar(N, 'la página lo dice', true, (await html('/admin/vaip/noticias', sAdmin)).includes('la noticia más hablada del momento'))
  }
  // Una búsqueda limpia: sin lo que ya propuso la de arriba.
  await bd.query(`delete from academia.news_items where es_qa`)
  await bd.query(`delete from academia.news_hunts where es_qa`)
  const antesTop1 = peticiones.length
  const respTop1 = await enviarFormulario('/admin/vaip/noticias', formularioDonde(await html('/admin/vaip/noticias', sCm), (f) => f.includes('name="cazar"')), sCm)
  const idTop1 = idDeRedireccion(respTop1)
  const top1 = await esperarBusqueda(bd, idTop1)
  afirmar(N, 'con 1, la búsqueda termina lista', 'lista', top1.estado)
  const deTop1 = await varias(bd, `select url from academia.news_items where es_qa and hunt_id = $1`, [idTop1])
  afirmar(N, '…y deja una sola noticia aunque la IA escriba más', 1, deTop1.length)
  const redaccionTop1 = peticiones.slice(antesTop1).find((p) => p.sistema.includes('escribes las noticias de IA'))
  afirmar(N, '…pidiéndole la más hablada: la que más medios distintos cubren', true, Boolean(redaccionTop1?.sistema.includes('UNA SOLA') && redaccionTop1?.sistema.includes('MÁS MEDIOS DISTINTOS')))

  verde = imprimir()
} catch (e) {
  afirmar('Suite', 'terminó sin detenerse', true, false)
  imprimir()
  console.error(`  La suite se detuvo: ${e.message}`)
} finally {
  if (ajustesPrevios) {
    await bd
      .query(`update academia.agent_settings set tope_usd = $1, pausado_por_tope = $2, noticias = $3, noticias_por_caceria = $4 where es_qa`, [ajustesPrevios.tope_usd, ajustesPrevios.pausado_por_tope, ajustesPrevios.noticias, ajustesPrevios.noticias_por_caceria])
      .catch(() => {})
  }
  if (!CONSERVAR) await purgar(bd).catch((e) => console.error(`  No se pudo limpiar: ${e.message}`))
  else console.log('  --conservar: la casa QA de noticias queda armada. Quítala con --limpiar.\n')
  await bd.end()
  claude.close()
  sitio.close()
  process.exit(verde ? 0 : 1)
}
