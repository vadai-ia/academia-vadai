#!/usr/bin/env node
/**
 * test-agente.mjs — Criterio de cierre de M21: el agente de la comunidad.
 *
 *   ANTHROPIC_SIMULADO=http://127.0.0.1:4805 CRON_SECRET=<16+> PORT=3141 \
 *     NEXT_PUBLIC_APP_URL=http://localhost:3141 pnpm start
 *   CRON_SECRET=<el mismo> APP_URL=http://localhost:3141 node scripts/test-agente.mjs
 *
 *   --conservar  deja los datos de la suite para las capturas
 *   --limpiar    solo borra lo de la suite
 *
 * Necesita la migración 0045 y la cuenta «Equipo VADAI»
 * (node scripts/cuenta-equipo-vadai.mjs).
 *
 * Con ANTHROPIC_SIMULADO el servidor es el agente de la SUITE (es_qa): sus
 * ajustes, su cola, su gasto y sus borradores son los de la fila QA, y solo
 * atiende cursos y cuentas QA. Esta suite levanta ese Claude falso en el
 * puerto 4805: decide según una marca en el mensaje del alumno ([[responder]],
 * [[borrador]]…) y guarda cada petición para revisar qué se le mandó.
 *
 * Todo vive en los cursos `qa-agente-casa` y `qa-agente-otro`, el plan
 * `qa-agente` y el conocimiento `qa-agente-*`. Solo se borra eso.
 */

import { createServer } from 'node:http'

import { cargarEnv, conectarPostgres, exigir } from './lib/entorno.mjs'

const vars = cargarEnv()
const SUPABASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')
const APP = (process.env.APP_URL ?? 'http://localhost:3141').replace(/\/+$/, '')
const CRON = process.env.CRON_SECRET ?? ''
const PUERTO = 4805
const CASA = 'qa-agente-casa'
const OTRO = 'qa-agente-otro'
const PLAN = 'qa-agente'
const CORREO_ALUMNO = 'qa-alumno1@academia.vadai.com.mx'
const CORREO_ADMIN = 'qa-admin@academia.vadai.com.mx'
const CORREO_CM = 'qa-cm@academia.vadai.com.mx'
const CONSERVAR = process.argv.includes('--conservar')
const SOLO_LIMPIAR = process.argv.includes('--limpiar')

// --- el Claude falso -------------------------------------------------------------

/** Cada petición que llegó: modelo, cuerpo y el texto de la conversación. */
const peticiones = []

function textoDe(cuerpo) {
  const sistema = (cuerpo.system ?? []).map((b) => b.text ?? '').join('\n')
  const mensaje = typeof cuerpo.messages?.[0]?.content === 'string' ? cuerpo.messages[0].content : JSON.stringify(cuerpo.messages?.[0]?.content ?? '')
  return { sistema, mensaje }
}

/** El último mensaje de la conversación: lo que va después del último [n]. */
function ultimoMensaje(mensaje) {
  const partes = mensaje.split(/\n\[\d+\] /)
  return partes[partes.length - 1] ?? mensaje
}

function decision(marca, modelo) {
  const base = { complejidad: 'baja', enlaces: [], motivo: 'QA', ideas: [], temas: ['qa'] }
  switch (marca) {
    case 'responder':
      return {
        ...base,
        accion: 'responder',
        certeza: 0.95,
        respuesta: 'Abre tu proyecto, sube el Excel del viernes y pídele que concilie contra el banco. Tú revisas las diferencias antes de cerrar.',
        enlaces: ['L1'],
        ideas: [{ tipo: 'peticion', resumen: 'QA-agente: quieren una plantilla de conciliación' }],
        temas: ['excel'],
      }
    case 'dudoso':
      return modelo.includes('sonnet')
        ? { ...base, accion: 'responder', certeza: 0.92, complejidad: 'media', respuesta: 'Respuesta del modelo fuerte: primero el contexto, luego la tarea.' }
        : { ...base, accion: 'responder', certeza: 0.7, complejidad: 'media', respuesta: 'Respuesta dudosa del modelo rápido.' }
    case 'borrador':
      return { ...base, accion: 'borrador', certeza: 0.4, respuesta: 'Propuesta para que el equipo la revise.', motivo: 'Es un tema de facturación.' }
    case 'liga':
      return { ...base, accion: 'responder', certeza: 0.95, respuesta: 'Entra a https://ejemplo-inventado.com/curso y descárgalo.' }
    case 'precio':
      return { ...base, accion: 'responder', certeza: 0.95, respuesta: 'La membresía cuesta $349 al mes.' }
    case 'clave':
      return { ...base, accion: 'responder', certeza: 0.95, respuesta: 'Está en la lección de conciliación.', enlaces: ['L999'] }
    case 'ignorar':
    default:
      return { ...base, accion: 'ignorar', certeza: 0.9, respuesta: '', motivo: 'Solo es un saludo.' }
  }
}

function respuesta(modelo, texto, extra = {}) {
  return {
    id: `msg_qa_${peticiones.length}`,
    type: 'message',
    role: 'assistant',
    model: modelo,
    content: [{ type: 'text', text: texto }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 1200, output_tokens: 180, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, ...extra.usage },
    ...extra.cuerpo,
  }
}

const claude = createServer((req, res) => {
  let crudo = ''
  req.on('data', (d) => (crudo += d))
  req.on('end', () => {
    let cuerpo = {}
    try {
      cuerpo = JSON.parse(crudo)
    } catch {}
    const { sistema, mensaje } = textoDe(cuerpo)
    const p = { ruta: req.url, modelo: cuerpo.model, cuerpo, sistema, mensaje }
    peticiones.push(p)
    const json = (status, datos) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(datos))

    // Las noticias: con búsqueda web, texto con JSON.
    if ((cuerpo.tools ?? []).some((t) => t.name === 'web_search')) {
      return json(
        200,
        respuesta(
          cuerpo.model,
          `Encontré esto:\n${JSON.stringify({
            noticias: [
              { titulo: 'QA-agente noticia permitida', texto: 'Claude ya lee tus hojas de Excel completas.', fuente: 'https://www.anthropic.com/news/qa-agente' },
              { titulo: 'QA-agente noticia de un sitio no permitido', texto: 'Rumor.', fuente: 'https://blog-raro.example/qa' },
            ],
          })}`,
          { usage: { server_tool_use: { web_search_requests: 2 } } }
        )
      )
    }
    // El resumen del día.
    if (sistema.includes('cada mañana le resumes')) {
      return json(
        200,
        respuesta(
          cuerpo.model,
          JSON.stringify({
            resumen: 'QA-agente resumen: se habló de conciliación en Excel.',
            temas: [{ tema: 'excel', conversaciones: 2 }],
            dudas_frecuentes: ['Cómo conciliar el viernes'],
            atencion: [{ clave: 'C1', por_que: 'QA-agente: necesita a una persona' }],
            ideas: ['Plantilla de conciliación'],
          })
        )
      )
    }
    // Decidir sobre una conversación.
    const marca = ultimoMensaje(mensaje).match(/\[\[([a-z-]+)\]\]/)?.[1] ?? 'ignorar'
    if (marca === 'falla') return json(500, { type: 'error', error: { type: 'api_error', message: 'QA: falla simulada' } })
    if (marca === 'rechazo') return json(200, { ...respuesta(cuerpo.model, ''), stop_reason: 'refusal' })
    if (marca === 'roto') return json(200, respuesta(cuerpo.model, 'esto no es JSON'))
    return json(200, respuesta(cuerpo.model, JSON.stringify(decision(marca, cuerpo.model ?? ''))))
  })
})

// --- sesión y formularios --------------------------------------------------------

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
  const hash = c.hashed_token ?? c.properties?.hashed_token
  const frasco = crearFrasco()
  frasco.guardar(await fetch(`${APP}/auth/confirmar?token_hash=${encodeURIComponent(hash)}&type=recovery`, { redirect: 'manual' }))
  return frasco
}
const pedir = (ruta, frasco, opciones = {}) =>
  fetch(`${APP}${ruta}`, { redirect: 'manual', ...opciones, headers: frasco?.tamano ? { cookie: frasco.encabezado() } : {} })
function formulario(pagina, prueba) {
  for (const bloque of pagina.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)) {
    if (!prueba(bloque[1])) continue
    const campos = {}
    for (const e of bloque[1].matchAll(/<(?:input|select|textarea)\b[^>]*>/g)) {
      const nombre = e[0].match(/name="([^"]*)"/)?.[1]
      if (!nombre) continue
      const tipo = e[0].match(/type="([^"]*)"/)?.[1]
      if ((tipo === 'checkbox' || tipo === 'radio') && !/\schecked/.test(e[0])) continue
      campos[nombre] = (e[0].match(/value="([^"]*)"/)?.[1] ?? '').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    }
    return campos
  }
  return null
}
async function enviar(ruta, campos, frasco) {
  const cuerpo = new FormData()
  for (const [n, v] of Object.entries(campos)) for (const x of Array.isArray(v) ? v : [v]) cuerpo.append(n, x)
  return (await pedir(ruta, frasco, { method: 'POST', body: cuerpo })).text()
}
const cron = (ruta) => fetch(`${APP}${ruta}`, { headers: { authorization: `Bearer ${CRON}` } }).then(async (r) => ({ status: r.status, datos: await r.json().catch(() => null) }))

// --- reporte --------------------------------------------------------------------

const resultados = []
const afirmar = (grupo, descripcion, esperado, real) => resultados.push({ grupo, descripcion, esperado, real, ok: esperado === real })
function imprimir() {
  const porGrupo = new Map()
  for (const r of resultados) porGrupo.set(r.grupo, [...(porGrupo.get(r.grupo) ?? []), r])
  const ancho = Math.max(...resultados.map((r) => r.descripcion.length))
  console.log('\n  PRUEBA DEL AGENTE — M21')
  console.log(`  App: ${APP}`)
  for (const [grupo, casos] of porGrupo) {
    console.log(`\n  ${grupo}\n  ${'─'.repeat(ancho + 30)}`)
    for (const c of casos) console.log(`  ${c.ok ? '✓' : '✗'}  ${c.descripcion.padEnd(ancho)}  ${c.ok ? String(c.real) : `esperado ${c.esperado}, obtuvo ${c.real}`}`)
  }
  const fallidas = resultados.filter((r) => !r.ok)
  console.log(`\n  ${'─'.repeat(ancho + 30)}`)
  console.log(fallidas.length === 0 ? `  M21 EN VERDE — ${resultados.length}/${resultados.length} aserciones pasaron.` : `  ${fallidas.length} de ${resultados.length} aserciones FALLARON.`)
  for (const f of fallidas) console.log(`    ${f.grupo} · ${f.descripcion}: esperado ${f.esperado}, obtuvo ${f.real}`)
  console.log('')
  return fallidas.length === 0
}

// --- base -----------------------------------------------------------------------

const una = async (bd, sql, p = []) => (await bd.query(sql, p)).rows[0] ?? null
const varias = async (bd, sql, p = []) => (await bd.query(sql, p)).rows
const AJUSTES_QA_POR_DEFECTO = `modo = 'borradores', prompt = '', umbral = 0.80, espera_min = 25, espera_max = 120, hora_inicio = 8, hora_fin = 21,
  busqueda_web = false, noticias = true, tope_usd = 50, modelo_rapido = 'claude-haiku-5-5', modelo_fuerte = 'claude-sonnet-5-5', pausado_por_tope = false`

async function purgar(bd) {
  const cursos = `(select id from academia.courses where slug in ('${CASA}', '${OTRO}'))`
  await bd.query(`delete from academia.agent_drafts where es_qa and (course_id in ${cursos} or course_id is null)`)
  await bd.query(`delete from academia.community_insights where es_qa and course_id in ${cursos}`)
  await bd.query(`delete from academia.agent_runs where es_qa`)
  await bd.query(`delete from academia.agent_digests where es_qa`)
  await bd.query(`delete from academia.agent_jobs where es_qa and course_id in ${cursos}`)
  await bd.query(`delete from academia.agent_knowledge where clave like 'qa-agente-%'`)
  await bd.query(`delete from academia.lesson_comments where lesson_id in (select l.id from academia.lessons l join academia.modules m on m.id = l.module_id where m.course_id in ${cursos})`)
  await bd.query(`delete from academia.community_posts where course_id in ${cursos}`)
  await bd.query(`delete from academia.community_topics where course_id in ${cursos}`)
  await bd.query(`delete from academia.membership_plans where slug = $1`, [PLAN])
  await bd.query(`delete from academia.lessons where module_id in (select id from academia.modules where course_id in ${cursos})`)
  await bd.query(`delete from academia.modules where course_id in ${cursos}`)
  await bd.query(`delete from academia.enrollments where course_id in ${cursos}`)
  await bd.query(`delete from academia.cohorts where course_id in ${cursos}`)
  await bd.query(`delete from academia.courses where slug in ('${CASA}', '${OTRO}')`)
  await bd.query(`update academia.agent_settings set ${AJUSTES_QA_POR_DEFECTO} where es_qa`)
}
async function comoUsuario(bd, userId, sql) {
  await bd.query('begin')
  try {
    await bd.query(`set local role authenticated`)
    await bd.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: userId, role: 'authenticated' })])
    return (await bd.query(sql)).rows
  } finally {
    await bd.query('rollback')
  }
}
const doc = (texto) => JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: texto }] }] })

/** Corre el cron hasta que no quede nada que ya toque (o 6 vueltas). */
async function correrHastaVaciar(bd) {
  for (let i = 0; i < 6; i++) {
    await cron('/api/cron/agente')
    const pendiente = await una(
      bd,
      `select count(*)::int n from academia.agent_jobs where es_qa and estado in ('pendiente', 'procesando') and toca_en <= now() + interval '5 seconds'`
    )
    if (pendiente.n === 0) return
    await new Promise((r) => setTimeout(r, 500))
  }
}

// --- la prueba ------------------------------------------------------------------

const bd = await conectarPostgres(vars)
if (SOLO_LIMPIAR) {
  await purgar(bd)
  await bd.end()
  console.log('  Datos de test-agente borrados.')
  process.exit(0)
}
await new Promise((r) => claude.listen(PUERTO, '127.0.0.1', r))
let verde = false
try {
  await purgar(bd)
  const bot = await una(bd, `select user_id from academia.profiles where es_bot and status = 'active' limit 1`)
  if (!bot) throw new Error('Falta la cuenta «Equipo VADAI»: node scripts/cuenta-equipo-vadai.mjs')
  if (CRON.length < 16) throw new Error('Pasa CRON_SECRET (el mismo que tiene el servidor).')
  const salud = await cron('/api/cron/agente')
  if (salud.status !== 200) throw new Error(`/api/cron/agente respondió ${salud.status}: ¿el servidor tiene el mismo CRON_SECRET?`)
  if (salud.datos?.estado === 'sin_llave') throw new Error('El servidor no tiene ANTHROPIC_SIMULADO: levántalo con ANTHROPIC_SIMULADO=http://127.0.0.1:4805.')

  const alumno = await una(bd, `select user_id, full_name from academia.profiles where email = $1`, [CORREO_ALUMNO])
  const admin = await una(bd, `select user_id from academia.profiles where email = $1`, [CORREO_ADMIN])
  const cm = await una(bd, `select user_id from academia.profiles where email = $1`, [CORREO_CM])

  // --- datos: la casa, otro curso, un plan, una lección, una exclusiva ------------
  const { rows: [casa] } = await bd.query(
    `insert into academia.courses (slug, title, course_type, status, certificate_enabled) values ($1, 'QA · qa-agente-casa (test-agente)', 'cohort', 'published', false) returning id`,
    [CASA]
  )
  const { rows: [otro] } = await bd.query(
    `insert into academia.courses (slug, title, course_type, status, certificate_enabled) values ($1, 'QA · qa-agente-otro (test-agente)', 'evergreen', 'published', false) returning id`,
    [OTRO]
  )
  const { rows: [gen] } = await bd.query(
    `insert into academia.cohorts (course_id, name, starts_on, ends_on, open_for_enrollment) values ($1, 'Miembros', current_date, null, true) returning id`,
    [casa.id]
  )
  await bd.query(`insert into academia.membership_plans (slug, name, price_mxn, status, hub_course_id) values ($1, 'QA Agente', 100, 'active', $2)`, [PLAN, casa.id])
  await bd.query(
    `insert into academia.community_topics (course_id, name, slug, position, solo_equipo) values ($1, 'Noticias', 'noticias', 0, true)`,
    [casa.id]
  )
  const { rows: [modulo] } = await bd.query(
    `insert into academia.modules (course_id, cohort_id, title, position) values ($1, $2, 'QA-agente módulo', 1) returning id`,
    [casa.id, gen.id]
  )
  const { rows: [leccion] } = await bd.query(
    `insert into academia.lessons (module_id, title, position, lesson_type, status) values ($1, 'QA-agente conciliación en Excel', 1, 'text', 'published') returning id`,
    [modulo.id]
  )
  const { rows: [exclusivo] } = await bd.query(
    `insert into academia.modules (course_id, cohort_id, title, position, is_restricted) values ($1, $2, 'QA-agente módulo exclusivo', 2, true) returning id`,
    [casa.id, gen.id]
  )
  await bd.query(`insert into academia.lessons (module_id, title, position, lesson_type, status) values ($1, 'QA-agente lección exclusiva secreta', 1, 'text', 'published')`, [exclusivo.id])
  await bd.query(
    `insert into academia.enrollments (user_id, course_id, cohort_id, source, status, expires_at) values ($1, $2, $3, 'manual', 'active', now() + interval '20 days')`,
    [alumno.user_id, casa.id, gen.id]
  )
  await bd.query(
    `insert into academia.agent_knowledge (fuente, clave, titulo, course_id, contenido) values
      ('equipo', 'qa-agente-casa', 'QA-agente conciliación', $1, 'La conciliación del viernes en Excel se hace en un proyecto de Claude: subes el Excel del banco y el de ventas y le pides que concilie. Tú revisas las diferencias.'),
      ('equipo', 'qa-agente-otro', 'QA-agente otro curso', $2, 'QA-agente secreto de otro curso: conciliación del viernes en Excel con la receta del otro curso.')`,
    [casa.id, otro.id]
  )
  // El agente de la suite: automático, sin espera, todo el día.
  await bd.query(
    `update academia.agent_settings set modo = 'automatico', espera_min = 0, espera_max = 0, hora_inicio = 0, hora_fin = 24, umbral = 0.80,
       tope_usd = 5, noticias = true, busqueda_web = true, pausado_por_tope = false where es_qa`
  )

  const post = async (titulo, autor = alumno.user_id) =>
    (await una(bd, `insert into academia.community_posts (course_id, cohort_id, user_id, title, content_rich, status) values ($1, $2, $3, $4, $5::jsonb, 'visible') returning id`, [
      casa.id,
      gen.id,
      autor,
      titulo,
      doc(`Mi correo es qa-filtrado@ejemplo.com y mi cel 55 1234 5678. ${titulo}`),
    ])).id
  const comentar = async (postId, texto, autor = alumno.user_id, via = 'humano') =>
    (await una(bd, `insert into academia.community_comments (post_id, user_id, content, status, via) values ($1, $2, $3, 'visible', $4) returning id`, [postId, autor, texto, via])).id
  const trabajo = (origen) => una(bd, `select id, estado, intentos, resultado, toca_en from academia.agent_jobs where origen_id = $1`, [origen])
  const delBot = (postId) => varias(bd, `select id, content, via, agent_job_id from academia.community_comments where post_id = $1 and user_id = $2`, [postId, bot.user_id])

  // =========================================================================
  // 1. Decide y publica
  // =========================================================================
  const G = 'Decide y publica'
  const pResponder = await post('[[responder]] ¿Cómo hago la conciliación del viernes en Excel?')
  const pDudoso = await post('[[dudoso]] ¿Cómo armo un prompt para el cierre?')
  const pBorrador = await post('[[borrador]] Me cobraron doble la factura')
  const pIgnorar = await post('[[ignorar]] ¡Hola a todos!')
  const pLiga = await post('[[liga]] ¿Dónde descargo el material?')
  const pPrecio = await post('[[precio]] ¿Cuánto cuesta?')
  const pClave = await post('[[clave]] ¿En qué lección está?')
  const pRechazo = await post('[[rechazo]] Algo que el modelo no quiere contestar')
  const pRoto = await post('[[roto]] El modelo devuelve basura')
  const pEquipo = await post('[[responder]] Esto ya lo contestó el equipo')
  await comentar(pEquipo, 'Ya te contesté por aquí. — QA admin', admin.user_id)
  const pNuevo = await post('[[responder]] Primera pregunta del hilo')
  const cNuevo = await comentar(pNuevo, '[[responder]] Segunda pregunta, la más nueva')
  const pDelEquipo = await post('[[responder]] Publicación del propio equipo', admin.user_id)
  const pTope2 = await post('[[ignorar]] Hilo con dos respuestas del agente')
  await comentar(pTope2, 'Respuesta 1 del agente (QA)', bot.user_id, 'agente')
  await comentar(pTope2, 'Respuesta 2 del agente (QA)', bot.user_id, 'agente')
  const cTope2 = await comentar(pTope2, '[[responder]] Y otra pregunta más')
  const raiz = (await una(bd, `insert into academia.lesson_comments (lesson_id, user_id, content, status) values ($1, $2, '[[responder]] Pregunta en la lección: ¿cómo concilio?', 'visible') returning id`, [leccion.id, alumno.user_id])).id

  const antes = peticiones.length
  await correrHastaVaciar(bd)

  const bResp = await delBot(pResponder)
  afirmar(G, 'contesta solo lo que tiene claro', 1, bResp.length)
  afirmar(G, '…firmado via agente', 'agente', bResp[0]?.via)
  afirmar(G, '…ligado a su trabajo', (await trabajo(pResponder))?.id, bResp[0]?.agent_job_id)
  afirmar(G, '…con la liga de la lección armada por el código', true, Boolean(bResp[0]?.content.includes(`/curso/${CASA}/${leccion.id}`)))
  afirmar(G, 'el trabajo queda hecho', 'hecho', (await trabajo(pResponder))?.estado)
  afirmar(G, 'anota la idea que trae la conversación', 1, (await una(bd, `select count(*)::int n from academia.community_insights where es_qa and hilo_id = $1`, [pResponder])).n)

  const bDudoso = await delBot(pDudoso)
  afirmar(G, 'duda cerca del umbral: escala a Sonnet y publica', true, Boolean(bDudoso[0]?.content.includes('modelo fuerte')))
  afirmar(G, '…una sola vez', 1, peticiones.filter((p) => p.modelo === 'claude-sonnet-5-5' && p.mensaje.includes('[[dudoso]]')).length)
  afirmar(G, '…y queda la corrida «escalar»', true, (await una(bd, `select count(*)::int n from academia.agent_runs where es_qa and tarea = 'escalar' and estado = 'cerrada'`)).n >= 1)

  const borrador = await una(bd, `select id, estado, motivo, texto from academia.agent_drafts where es_qa and hilo_id = $1`, [pBorrador])
  afirmar(G, 'lo delicado va a borrador, sin publicar', 'pendiente 0', `${borrador?.estado} ${(await delBot(pBorrador)).length}`)
  afirmar(G, '…y el trabajo dice borrador', 'borrador', (await trabajo(pBorrador))?.estado)
  afirmar(G, 'un saludo no se contesta', 'omitido 0', `${(await trabajo(pIgnorar))?.estado} ${(await delBot(pIgnorar)).length}`)

  const motivo = async (hilo) => (await una(bd, `select motivo from academia.agent_drafts where es_qa and hilo_id = $1`, [hilo]))?.motivo ?? ''
  afirmar(G, 'una liga inventada manda a borrador', true, (await delBot(pLiga)).length === 0 && /liga/.test(await motivo(pLiga)))
  afirmar(G, 'un precio manda a borrador', true, (await delBot(pPrecio)).length === 0 && /precio/.test(await motivo(pPrecio)))
  afirmar(G, 'una clave fuera del mapa manda a borrador', true, (await delBot(pClave)).length === 0 && /mapa/.test(await motivo(pClave)))
  afirmar(G, 'un rechazo del modelo va a borrador vacío', '', (await una(bd, `select texto from academia.agent_drafts where es_qa and hilo_id = $1`, [pRechazo]))?.texto)
  afirmar(G, 'una salida que no es JSON va a borrador', true, /decisión válida/.test(await motivo(pRoto)))

  afirmar(G, 'si el equipo ya contestó, no hace nada', 'omitido', (await trabajo(pEquipo))?.estado)
  afirmar(G, '…ni le llega al modelo', 0, peticiones.filter((p) => p.mensaje.includes('Esto ya lo contestó el equipo')).length)
  afirmar(G, 'con un mensaje más nuevo, contesta ese', 'omitido hecho', `${(await trabajo(pNuevo))?.estado} ${(await trabajo(cNuevo))?.estado}`)
  afirmar(G, '…una sola respuesta en el hilo', 1, (await delBot(pNuevo)).length)
  afirmar(G, 'lo que escribe el equipo no se encola', null, await trabajo(pDelEquipo))
  afirmar(G, 'a lo más dos respuestas del agente por hilo', 'omitido', (await trabajo(cTope2))?.estado)
  afirmar(G, 'lo que publica el agente no se vuelve a encolar', 0, (await una(bd, `select count(*)::int n from academia.agent_jobs j join academia.community_comments c on c.id = j.origen_id where c.user_id = $1`, [bot.user_id])).n)

  const enLeccion = await una(bd, `select parent_id, via from academia.lesson_comments where parent_id = $1 and user_id = $2`, [raiz, bot.user_id])
  afirmar(G, 'contesta en la lección, debajo de la pregunta', 'agente', enLeccion?.via)

  const reales = await una(bd, `select count(*)::int n from academia.agent_jobs j join academia.courses c on c.id = j.course_id where j.es_qa and c.slug not like 'qa-%'`)
  afirmar(G, 'el agente de la suite nunca encola un curso real', 0, reales.n)
  const ajenos = await una(bd, `select count(*)::int n from academia.agent_jobs j join academia.courses c on c.id = j.course_id where j.es_qa and c.slug not like 'qa-agente-%'`)
  afirmar(G, '…ni el de otra suite', 0, ajenos.n)

  // Si el equipo contesta por su cuenta, el borrador se retira solo.
  await comentar(pPrecio, 'Lo contesto yo: te escribo por mensaje. — QA admin', admin.user_id)
  await cron('/api/cron/agente')
  const retirado = await una(bd, `select estado, motivo from academia.agent_drafts where es_qa and hilo_id = $1`, [pPrecio])
  afirmar(G, 'si el equipo contesta, el borrador se retira solo', true, retirado?.estado === 'descartado' && /el equipo ya contestó/.test(retirado.motivo ?? ''))

  // =========================================================================
  // 2. Qué se le manda al modelo
  // =========================================================================
  const M = 'Lo que ve el modelo'
  const deResponder = peticiones.slice(antes).find((p) => p.mensaje.includes('conciliación del viernes'))
  afirmar(M, 'sin el correo del alumno', false, Boolean(deResponder?.mensaje.includes('qa-filtrado@ejemplo.com')))
  afirmar(M, 'sin su teléfono', false, Boolean(deResponder?.mensaje.includes('1234 5678')))
  afirmar(M, 'sin su nombre', false, Boolean(alumno.full_name && deResponder?.mensaje.includes(alumno.full_name)))
  afirmar(M, 'el texto del alumno va marcado como conversación', true, Boolean(deResponder?.mensaje.includes('<conversacion>')))
  afirmar(M, 'las reglas fijas van en caché de 1 hora', '1h', deResponder?.cuerpo.system?.[0]?.cache_control?.ttl)
  afirmar(M, 'Haiku sin razonamiento y con esfuerzo bajo', 'disabled low', `${deResponder?.cuerpo.thinking?.type} ${deResponder?.cuerpo.output_config?.effort}`)
  afirmar(M, 'con salida estructurada', true, Boolean(deResponder?.cuerpo.output_config?.format))
  const deSonnet = peticiones.find((p) => p.modelo === 'claude-sonnet-5-5' && p.mensaje.includes('[[dudoso]]'))
  afirmar(M, 'Sonnet con between_tools (disabled le da 400)', 'between_tools', deSonnet?.cuerpo.thinking?.type)
  afirmar(M, 'el mapa trae la lección publicada', true, Boolean(deResponder?.sistema.includes('QA-agente conciliación en Excel')))
  afirmar(M, 'el mapa no trae la exclusiva', false, Boolean(deResponder?.sistema.includes('lección exclusiva secreta')))
  afirmar(M, 'el conocimiento del curso sí va', true, Boolean(deResponder?.sistema.includes('subes el Excel del banco')))
  afirmar(M, 'el de otro curso no', false, Boolean(deResponder?.sistema.includes('secreto de otro curso')))
  afirmar(M, 'el modelo no recibe herramientas: no puede actuar', undefined, deResponder?.cuerpo.tools)

  // =========================================================================
  // 3. Reintentos, modo, horario y tope
  // =========================================================================
  const T = 'Reintentos, modo, horario y tope'
  const pFalla = await post('[[falla]] La API de Claude se cae')
  await cron('/api/cron/agente')
  await cron('/api/cron/agente')
  const tFalla = await trabajo(pFalla)
  afirmar(T, 'si la API falla, vuelve a la cola', 'pendiente', tFalla?.estado)
  afirmar(T, '…en 15 minutos, con su intento contado', true, tFalla?.intentos === 1 && Date.parse(tFalla.toca_en) - Date.now() > 10 * 60_000)
  afirmar(T, '…y la corrida no cobra (la API la rechazó)', 0, Number((await una(bd, `select coalesce(sum(costo_usd), 0) s from academia.agent_runs where es_qa and job_id = $1`, [tFalla?.id])).s))
  await bd.query(`update academia.agent_jobs set estado = 'omitido' where id = $1`, [tFalla?.id])

  await bd.query(`update academia.agent_settings set modo = 'borradores' where es_qa`)
  const pModo = await post('[[responder]] Pregunta en modo borradores')
  await correrHastaVaciar(bd)
  afirmar(T, 'en modo borradores no publica nada', 0, (await delBot(pModo)).length)
  afirmar(T, '…deja el borrador con el motivo', true, /modo borradores/.test(await motivo(pModo)))

  await bd.query(`update academia.agent_settings set modo = 'automatico', espera_min = 30, espera_max = 30, hora_inicio = 8, hora_fin = 21 where es_qa`)
  const pEspera = await post('[[responder]] Pregunta que espera')
  await cron('/api/cron/agente')
  const tEspera = await una(bd, `select j.estado, j.toca_en, p.created_at from academia.agent_jobs j join academia.community_posts p on p.id = j.origen_id where j.origen_id = $1`, [pEspera])
  const hora = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Mexico_City', hour: 'numeric', hourCycle: 'h23' }).format(new Date(tEspera?.toca_en)))
  afirmar(T, 'espera al menos lo configurado antes de contestar', true, Boolean(tEspera) && Date.parse(tEspera.toca_en) - Date.parse(tEspera.created_at) >= 30 * 60_000 - 2000)
  afirmar(T, '…y solo dentro del horario de la CDMX', true, hora >= 8 && hora < 21)
  afirmar(T, '…mientras tanto sigue pendiente', 'pendiente', tEspera?.estado)
  await bd.query(`update academia.agent_jobs set estado = 'omitido' where origen_id = $1`, [pEspera])

  await bd.query(`update academia.agent_settings set espera_min = 0, espera_max = 0, hora_inicio = 0, hora_fin = 24, tope_usd = 0 where es_qa`)
  const llamadasAntes = peticiones.length
  const pTope = await post('[[responder]] Pregunta sin presupuesto')
  await correrHastaVaciar(bd)
  afirmar(T, 'sin presupuesto no se llama al modelo', llamadasAntes, peticiones.length)
  afirmar(T, '…el trabajo lo atiende el equipo', true, /tope/.test((await trabajo(pTope))?.resultado ?? ''))
  afirmar(T, '…y el agente queda en pausa', true, (await una(bd, `select pausado_por_tope p from academia.agent_settings where es_qa`)).p)
  afirmar(T, 'el gasto de la suite no toca el del agente real', 0, Number((await una(bd, `select count(*)::int n from academia.agent_runs where not es_qa and created_at > now() - interval '1 hour' and job_id in (select id from academia.agent_jobs where es_qa)`)).n))

  // =========================================================================
  // 4. El panel
  // =========================================================================
  const P = 'El panel'
  const sAdmin = await entrar(CORREO_ADMIN)
  const sCm = await entrar(CORREO_CM)
  const sAlumno = await entrar(CORREO_ALUMNO)

  // Subir el tope desde Ajustes quita la pausa.
  const ajustes = await (await pedir('/admin/agente/ajustes', sAdmin)).text()
  const formAjustes = formulario(ajustes, (f) => f.includes('name="tope_usd"'))
  afirmar(P, 'el admin ve Ajustes → Agente con el gasto', true, Boolean(formAjustes) && ajustes.includes('Gasto del mes'))
  // `formulario` no lee la opción elegida de un <select>: los modelos van explícitos.
  const guardado = await enviar(
    '/admin/agente/ajustes',
    { ...formAjustes, modo: 'automatico', tope_usd: '5', busqueda_web: 'si', noticias: 'si', modelo_rapido: 'claude-haiku-5-5', modelo_fuerte: 'claude-sonnet-5-5' },
    sAdmin
  )
  afirmar(P, 'guardar ajustes avisa que quedó', true, guardado.includes('Guardado.'))
  const trasGuardar = await una(bd, `select tope_usd, pausado_por_tope, updated_by from academia.agent_settings where es_qa`)
  afirmar(P, 'guardar ajustes sube el tope y quita la pausa', '5 false', `${Number(trasGuardar.tope_usd)} ${trasGuardar.pausado_por_tope}`)
  afirmar(P, '…firmado por quien lo cambió', admin.user_id, trasGuardar.updated_by)
  afirmar(P, '…y no toca los ajustes del agente real', false, (await una(bd, `select updated_by = $1 u from academia.agent_settings where not es_qa`, [admin.user_id])).u ?? false)

  // El probador contesta sin publicar.
  const formProbador = formulario(ajustes, (f) => f.includes('name="pregunta"'))
  const probado = await enviar('/admin/agente/ajustes', { ...formProbador, curso: casa.id, pregunta: '[[responder]] ¿Cómo concilio en Excel? (probador)' }, sAdmin)
  afirmar(P, 'el probador dice qué contestaría', true, probado.includes('Contestaría'))
  afirmar(P, '…y cuenta en el gasto', true, (await una(bd, `select count(*)::int n from academia.agent_runs where es_qa and tarea = 'probador'`)).n >= 1)

  afirmar(P, 'el community manager no entra a Ajustes → Agente', true, (await pedir('/admin/agente/ajustes', sCm)).status !== 200)
  const tableroCm = await (await pedir('/admin/agente', sCm)).text()
  afirmar(P, 'el community manager ve los borradores', true, tableroCm.includes(`borrador-${borrador?.id}`))
  afirmar(P, '…pero no el gasto', false, tableroCm.includes('Solo lo ve un admin'))
  afirmar(P, 'un alumno no entra al tablero', true, (await pedir('/admin/agente', sAlumno)).status !== 200)

  // Publicar un borrador corregido.
  const tablero = await (await pedir('/admin/agente', sAdmin)).text()
  const formBorrador = formulario(tablero, (f) => f.includes(`value="${borrador?.id}"`) && f.includes('name="texto"'))
  afirmar(P, 'el borrador se puede corregir en el tablero', true, Boolean(formBorrador))
  await enviar('/admin/agente', { ...formBorrador, texto: 'Revisado: lo vemos por mensaje directo, ya quedó tu factura.' }, sAdmin)
  const publicado = await una(bd, `select via, agent_job_id, content from academia.community_comments where post_id = $1 and user_id = $2`, [pBorrador, bot.user_id])
  afirmar(P, 'publicar lo firma «revisado por el equipo»', 'agente_revisado', publicado?.via)
  afirmar(P, '…con el texto corregido', true, Boolean(publicado?.content.startsWith('Revisado:')))
  const marcado = await una(bd, `select estado, revisado_por from academia.agent_drafts where id = $1`, [borrador?.id])
  afirmar(P, '…y el borrador queda publicado por quien lo revisó', `publicado ${admin.user_id}`, `${marcado?.estado} ${marcado?.revisado_por}`)
  await enviar('/admin/agente', { ...formBorrador, texto: 'Segunda vez' }, sAdmin)
  afirmar(P, 'publicarlo dos veces no duplica', 1, (await delBot(pBorrador)).length)

  // Descartar.
  const idLiga = (await una(bd, `select id from academia.agent_drafts where es_qa and hilo_id = $1`, [pLiga]))?.id
  const formDescartar = formulario(tablero, (f) => f.includes(`value="${idLiga}"`) && !f.includes('name="texto"'))
  await enviar('/admin/agente', formDescartar ?? {}, sAdmin)
  afirmar(P, 'descartar un borrador', 'descartado', (await una(bd, `select estado from academia.agent_drafts where id = $1`, [idLiga]))?.estado)

  // La bandeja: «Contestó el agente». La casa es de un plan, así que vive en el
  // Muro de V-AI-P (M25), no en Grupos.
  const bandeja = await (await pedir('/admin/vaip/muro?estado=agente', sAdmin)).text()
  afirmar(P, 'la bandeja filtra lo que contestó el agente', true, bandeja.includes(`hilo-${pResponder}`))
  afirmar(P, '…y no lo revisado por el equipo', false, bandeja.includes(`hilo-${pBorrador}`))

  // =========================================================================
  // 5. Resumen del día
  // =========================================================================
  const D = 'Resumen del día'
  const realesAntes = (await una(bd, `select count(*)::int n from academia.agent_digests where not es_qa`)).n
  const diario = await cron('/api/cron/agente-diario?solo=resumen')
  const resumen = await una(bd, `select contenido from academia.agent_digests where es_qa order by fecha desc limit 1`)
  afirmar(D, 'arma el resumen del día', true, diario.status === 200 && Boolean(resumen?.contenido?.resumen?.startsWith('QA-agente resumen')))
  afirmar(D, '…con la liga del hilo que necesita a una persona', true, Boolean(resumen?.contenido?.atencion?.[0]?.href?.startsWith('/curso/')))
  afirmar(D, '…y cuenta lo que contestó el agente', true, (resumen?.contenido?.cifras?.respuestasDelAgente ?? 0) >= 1)
  afirmar(D, 'no toca el resumen del agente real', realesAntes, (await una(bd, `select count(*)::int n from academia.agent_digests where not es_qa`)).n)
  const deResumen = peticiones.find((p) => p.sistema.includes('cada mañana le resumes'))
  afirmar(D, 'al resumen no le llegan correos', false, Boolean(deResumen?.mensaje.includes('qa-filtrado@ejemplo.com')))

  // M24: las noticias (cacería, liga, propuestas, imagen y publicación) se
  // prueban en scripts/test-noticias.mjs.

  // =========================================================================
  // 6. Lo que ve el alumno, y quién lee qué
  // =========================================================================
  const A = 'El alumno y los permisos'
  const muro = await (await pedir(`/curso/${CASA}/comunidad?por=100`, sAlumno)).text()
  afirmar(A, 'el alumno ve la firma «con Claude, nuestra IA»', true, muro.includes('con Claude, nuestra IA'))
  afirmar(A, '…y la de lo revisado por el equipo', true, muro.includes('con Claude · revisado por el equipo'))
  afirmar(A, 'la liga de la lección se puede abrir', true, new RegExp(`href="[^"]*/curso/${CASA}/${leccion.id}"`).test(muro))
  const enClase = await (await pedir(`/curso/${CASA}/${leccion.id}`, sAlumno)).text()
  afirmar(A, 'también en la lección', true, enClase.includes('con Claude, nuestra IA'))

  const ver = async (uid, tabla) => (await comoUsuario(bd, uid, `select count(*)::int n from academia.${tabla} where es_qa`))[0].n
  afirmar(A, 'un alumno no ve borradores', 0, await ver(alumno.user_id, 'agent_drafts'))
  afirmar(A, 'ni el gasto', 0, await ver(alumno.user_id, 'agent_runs'))
  afirmar(A, 'el community manager ve los borradores', true, (await ver(cm.user_id, 'agent_drafts')) > 0)
  afirmar(A, '…pero no el gasto', 0, await ver(cm.user_id, 'agent_runs'))
  afirmar(A, 'el admin ve el gasto', true, (await ver(admin.user_id, 'agent_runs')) > 0)
  const falso = await comoUsuario(
    bd,
    alumno.user_id,
    `insert into academia.community_comments (post_id, user_id, content, status, via) values ('${pIgnorar}', '${alumno.user_id}', 'QA', 'visible', 'agente') returning via`
  )
  afirmar(A, 'un alumno no puede firmar como el agente', 'humano', falso[0]?.via)

  verde = imprimir()
} catch (e) {
  imprimir()
  console.error(`  La suite se detuvo: ${e.message}`)
} finally {
  if (!CONSERVAR) await purgar(bd).catch((e) => console.error(`  No se pudo limpiar: ${e.message}`))
  else console.log('  --conservar: los datos de la suite se quedan (node scripts/test-agente.mjs --limpiar para borrarlos).')
  await bd.end()
  claude.close()
  process.exit(verde ? 0 : 1)
}
