#!/usr/bin/env node
/**
 * test-api.mjs — Criterio de cierre de M20: la API de la academia.
 *
 *   API_KEYS_PEPPER=<32+> WEBHOOKS_MASTER=<32+> CRON_SECRET=<16+> \
 *   WEBHOOKS_RECEPTOR_DE_PRUEBA=http://127.0.0.1:4803 PORT=3117 pnpm start
 *   CRON_SECRET=<el mismo> node scripts/test-api.mjs
 *
 * Necesita la cuenta «Equipo VADAI» (node scripts/cuenta-equipo-vadai.mjs).
 *
 * Todo sobre un plan QA (`qa-api-plan`, con su casa `qa-api-casa`): la API se
 * dirige a él con `?plan=`, así que nada toca V-AI-P real. Las llaves se crean
 * desde Ajustes → API (también prueba el panel) y los webhooks van a un
 * receptor local por el host reservado `qa-webhooks.invalid`.
 */

import { createHmac } from 'node:crypto'
import { createServer } from 'node:http'

import { cargarEnv, conectarPostgres, exigir } from './lib/entorno.mjs'

const vars = cargarEnv()
const SUPABASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')
const APP = (process.env.APP_URL ?? 'http://localhost:3117').replace(/\/+$/, '')
const CRON = process.env.CRON_SECRET ?? ''
const PUERTO = 4803
const PLAN = 'qa-api-plan'
const Q = `?plan=${PLAN}`
const CORREO_ALUMNO = 'qa-alumno2@academia.vadai.com.mx'

// --- el receptor de webhooks ---------------------------------------------------

const recibidos = []
const receptor = createServer((req, res) => {
  let cuerpo = ''
  req.on('data', (d) => (cuerpo += d))
  req.on('end', () => {
    recibidos.push({ ruta: req.url, headers: req.headers, cuerpo })
    res.writeHead(req.url?.startsWith('/falla') ? 500 : 200).end('ok')
  })
})
async function esperarAviso(prueba, ms = 8000) {
  const fin = Date.now() + ms
  while (Date.now() < fin) {
    const r = recibidos.find(prueba)
    if (r) return r
    await new Promise((x) => setTimeout(x, 200))
  }
  return null
}

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

// --- la API -------------------------------------------------------------------

async function api(metodo, ruta, llave, cuerpo) {
  const r = await fetch(`${APP}/api/v1${ruta}`, {
    method: metodo,
    headers: { ...(llave ? { authorization: `Bearer ${llave}` } : {}), ...(cuerpo ? { 'content-type': 'application/json' } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
  return { status: r.status, datos: await r.json().catch(() => null) }
}

// --- reporte --------------------------------------------------------------------

const resultados = []
const afirmar = (grupo, descripcion, esperado, real) => resultados.push({ grupo, descripcion, esperado, real, ok: esperado === real })
function imprimir() {
  const porGrupo = new Map()
  for (const r of resultados) porGrupo.set(r.grupo, [...(porGrupo.get(r.grupo) ?? []), r])
  const ancho = Math.max(...resultados.map((r) => r.descripcion.length))
  console.log('\n  PRUEBA DE LA API — M20')
  console.log(`  App: ${APP}`)
  for (const [grupo, casos] of porGrupo) {
    console.log(`\n  ${grupo}\n  ${'─'.repeat(ancho + 30)}`)
    for (const c of casos) console.log(`  ${c.ok ? '✓' : '✗'}  ${c.descripcion.padEnd(ancho)}  ${c.ok ? String(c.real) : `esperado ${c.esperado}, obtuvo ${c.real}`}`)
  }
  const fallidas = resultados.filter((r) => !r.ok)
  console.log(`\n  ${'─'.repeat(ancho + 30)}`)
  console.log(fallidas.length === 0 ? `  M20 EN VERDE — ${resultados.length}/${resultados.length} aserciones pasaron.` : `  ${fallidas.length} de ${resultados.length} aserciones FALLARON.`)
  for (const f of fallidas) console.log(`    ${f.grupo} · ${f.descripcion}: esperado ${f.esperado}, obtuvo ${f.real}`)
  console.log('')
  return fallidas.length === 0
}

// --- base -----------------------------------------------------------------------

const una = async (bd, sql, p = []) => (await bd.query(sql, p)).rows[0] ?? null
const NOMBRES_LLAVES = ['QA API lectura', 'QA API escritura', 'QA API cobros', 'QA API revocada']
const NOMBRES_WEBHOOKS = ['QA API receptor', 'QA API falla']

async function purgar(bd) {
  const cursos = `(select id from academia.courses where slug like 'qa-api-%')`
  await bd.query(`delete from academia.memberships where stripe_subscription_id like 'sub_qaapi_%'`)
  await bd.query(`delete from academia.membership_plans where slug = $1`, [PLAN])
  await bd.query(`delete from academia.posts where audience_course_id in ${cursos}`)
  await bd.query(`delete from academia.community_posts where course_id in ${cursos}`)
  await bd.query(`delete from academia.community_topics where course_id in ${cursos}`)
  await bd.query(`delete from academia.cohort_sessions where cohort_id in (select id from academia.cohorts where course_id in ${cursos})`)
  await bd.query(`delete from academia.enrollments where course_id in ${cursos}`)
  await bd.query(`delete from academia.cohorts where course_id in ${cursos}`)
  await bd.query(`delete from academia.courses where slug like 'qa-api-%'`)
  await bd.query(`delete from academia.webhooks_salientes where nombre = any($1)`, [NOMBRES_WEBHOOKS])
  await bd.query(`delete from academia.api_keys where nombre = any($1)`, [NOMBRES_LLAVES])
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

// --- la prueba ------------------------------------------------------------------

await new Promise((r) => receptor.listen(PUERTO, '127.0.0.1', r))
const bd = await conectarPostgres(vars)
let verde = false
try {
  await purgar(bd)
  const bot = await una(bd, `select user_id from academia.profiles where es_bot and status = 'active' limit 1`)
  if (!bot) throw new Error('Falta la cuenta «Equipo VADAI»: node scripts/cuenta-equipo-vadai.mjs')
  if (CRON.length < 16) throw new Error('Pasa CRON_SECRET (el mismo que tiene el servidor).')

  // Un plan QA con su casa, su tema Noticias, un miembro y una pregunta sin responder.
  const { rows: [casa] } = await bd.query(
    `insert into academia.courses (slug, title, course_type, status, certificate_enabled) values ('qa-api-casa', 'QA · qa-api-casa (test-api)', 'cohort', 'published', false) returning id`
  )
  const { rows: [gen] } = await bd.query(
    `insert into academia.cohorts (course_id, name, starts_on, ends_on, open_for_enrollment) values ($1, 'Miembros', current_date, null, true) returning id`,
    [casa.id]
  )
  const { rows: [plan] } = await bd.query(
    `insert into academia.membership_plans (slug, name, price_mxn, status, hub_course_id) values ($1, 'QA API', 100, 'active', $2) returning id`,
    [PLAN, casa.id]
  )
  await bd.query(`insert into academia.community_topics (course_id, name, slug, position, solo_equipo) values ($1, 'Noticias', 'noticias', 0, true)`, [casa.id])
  const alumno = await una(bd, `select user_id, full_name from academia.profiles where email = $1`, [CORREO_ALUMNO])
  await bd.query(
    `insert into academia.enrollments (user_id, course_id, cohort_id, source, status, expires_at) values ($1, $2, $3, 'membresia', 'active', now() + interval '20 days')`,
    [alumno.user_id, casa.id, gen.id]
  )
  await bd.query(
    `insert into academia.memberships (plan_id, user_id, email, stripe_customer_id, stripe_subscription_id, status, current_period_start, current_period_end, access_until)
     values ($1, $2, $3, 'cus_qaapi', 'sub_qaapi_1', 'active', now() - interval '10 days', now() + interval '20 days', now() + interval '22 days')`,
    [plan.id, alumno.user_id, CORREO_ALUMNO]
  )
  const { rows: [pregunta] } = await bd.query(
    `insert into academia.community_posts (course_id, cohort_id, user_id, title) values ($1, $2, $3, 'QA API pregunta') returning id`,
    [casa.id, gen.id, alumno.user_id]
  )

  // --- 1. Llaves y webhooks desde el panel -------------------------------------
  const admin = await entrar('qa-admin@academia.vadai.com.mx')
  const cm = await entrar('qa-cm@academia.vadai.com.mx')
  const r0 = await pedir('/admin/ajustes/api', cm)
  afirmar('Panel', 'Ajustes → API rebota al community manager', true, r0.status === 307 || r0.status === 303)
  let pagina = await (await pedir('/admin/ajustes/api', admin)).text()
  const formLlave = formulario(pagina, (b) => b.includes('name="permisos"'))
  const crearLlave = async (nombre, permisos, vence = '365') => {
    const html = await enviar('/admin/ajustes/api', { ...formLlave, nombre, permisos, vence_dias: vence }, admin)
    return html.match(/vadai_[a-z0-9]{12}_[A-Za-z0-9_-]{43}/)?.[0] ?? null
  }
  const lectura = await crearLlave('QA API lectura', ['noticias:leer', 'eventos:leer', 'comunidad:leer', 'miembros:leer', 'metricas:leer'])
  const escritura = await crearLlave('QA API escritura', ['noticias:escribir', 'eventos:escribir', 'comunidad:escribir', 'miembros:pii'])
  const cobros = await crearLlave('QA API cobros', ['cobros:leer', 'miembros:leer', 'metricas:leer'], '0')
  const revocada = await crearLlave('QA API revocada', ['metricas:leer'])
  afirmar('Panel', 'crear una llave la muestra una vez', true, Boolean(lectura && escritura && cobros && revocada))
  const fila = await una(bd, `select hash, key_id from academia.api_keys where nombre = 'QA API lectura'`)
  afirmar('Panel', 'en la base no queda la llave, solo su hash', false, Boolean(fila && lectura.includes(fila.hash)))
  const vence = await una(bd, `select (expires_at - created_at) <= interval '90 days' and expires_at > now() + interval '89 days' as ok from academia.api_keys where nombre = 'QA API cobros'`)
  afirmar('Panel', 'una llave de cobros vence a los 90 días aunque se pida «no vence»', true, vence?.ok)
  pagina = await (await pedir('/admin/ajustes/api', admin)).text()
  afirmar('Panel', 'al recargar ya no aparece', false, pagina.includes(lectura))

  const formWebhook = formulario(pagina, (b) => b.includes('name="eventos"'))
  let html = await enviar('/admin/ajustes/api', { ...formWebhook, nombre: 'QA API receptor', url: 'https://qa-webhooks.invalid/recibe', eventos: ['noticia.publicada', 'sesion.creada'] }, admin)
  const secreto = html.match(/whsec_vadai_[0-9a-f]{40}/)?.[0] ?? null
  afirmar('Panel', 'registrar un webhook muestra su secreto', true, Boolean(secreto))
  html = await enviar('/admin/ajustes/api', { ...formWebhook, nombre: 'QA API falla', url: 'https://qa-webhooks.invalid/falla', eventos: ['noticia.publicada'] }, admin)
  html = await enviar('/admin/ajustes/api', { ...formWebhook, nombre: 'QA API privado', url: 'https://127.0.0.1/x', eventos: ['noticia.publicada'] }, admin)
  afirmar('Panel', 'un webhook a una IP privada se rechaza', true, html.includes('Ese destino no es público'))

  const revId = (await una(bd, `select id from academia.api_keys where nombre = 'QA API revocada'`)).id
  pagina = await (await pedir('/admin/ajustes/api', admin)).text()
  await enviar('/admin/ajustes/api', { ...formulario(pagina, (b) => b.includes(`value="${revId}"`) && b.includes('Revocar')) }, admin)

  // --- 2. La puerta -------------------------------------------------------------
  const antes = (await una(bd, `select count(*)::int n from academia.api_bitacora`)).n
  afirmar('Puerta', 'sin llave: 401', 401, (await api('GET', `/metricas${Q}`)).status)
  afirmar('Puerta', 'mal formada: 401', 401, (await api('GET', `/metricas${Q}`, 'no-es-una-llave')).status)
  afirmar('Puerta', 'secreto equivocado: 401', 401, (await api('GET', `/metricas${Q}`, lectura.slice(0, -4) + 'AAAA')).status)
  afirmar('Puerta', 'revocada: 401', 401, (await api('GET', `/metricas${Q}`, revocada)).status)
  afirmar('Puerta', 'y una llave mala no escribe nada', antes, (await una(bd, `select count(*)::int n from academia.api_bitacora`)).n)
  afirmar('Puerta', 'sin el permiso: 403', 403, (await api('POST', `/noticias${Q}`, lectura, { titulo: 'x', cuerpo: 'x' })).status)
  afirmar('Puerta', 'plan que no existe: 404', 404, (await api('GET', '/metricas?plan=no-existe', lectura)).status)
  afirmar('Puerta', 'cuerpo inválido: 400', 400, (await api('POST', `/noticias${Q}`, escritura, { titulo: 'x' })).status)
  await new Promise((r) => setTimeout(r, 500))
  const bitacora = await una(bd, `select status, ruta from academia.api_bitacora where key_id = (select id from academia.api_keys where nombre = 'QA API lectura') and status = 403 order by created_at desc limit 1`)
  afirmar('Puerta', 'la bitácora guarda el 403, sin cuerpo', '403 /api/v1/noticias', `${bitacora?.status} ${bitacora?.ruta}`)
  const openapi = await fetch(`${APP}/api/v1/openapi.json`)
  afirmar('Puerta', 'openapi.json es público', '3.1.0', (await openapi.json()).openapi)

  // --- 3. Noticias --------------------------------------------------------------
  let r = await api('POST', `/noticias${Q}`, escritura, { titulo: 'QA API noticia', cuerpo: 'Primer párrafo.\n\nSegundo párrafo.', fuente: 'https://www.anthropic.com/news' })
  afirmar('Noticias', 'publicar responde 201', 201, r.status)
  const noticiaId = r.datos?.id
  const post = await una(
    bd,
    `select p.via, p.api_key_id is not null as con_llave, pr.es_bot, t.slug, p.content_rich::text as cuerpo
       from academia.community_posts p join academia.profiles pr on pr.user_id = p.user_id join academia.community_topics t on t.id = p.topic_id
      where p.id = $1`,
    [noticiaId]
  )
  afirmar('Noticias', 'queda en Noticias, a nombre del bot, marcada api y con su llave', 'api true true noticias', `${post?.via} ${post?.con_llave} ${post?.es_bot} ${post?.slug}`)
  afirmar('Noticias', 'con su fuente como liga', true, Boolean(post?.cuerpo.includes('https://www.anthropic.com/news')))
  r = await api('GET', `/noticias${Q}`, lectura)
  afirmar('Noticias', 'se lista, con su texto', 'Primer párrafo.\n\nSegundo párrafo.\n\nFuente: https://www.anthropic.com/news', r.datos?.noticias?.find((n) => n.id === noticiaId)?.texto)
  const aviso = await esperarAviso((x) => x.headers['x-vadai-evento'] === 'noticia.publicada' && x.ruta === '/recibe')
  afirmar('Webhooks', 'el receptor recibe noticia.publicada', true, Boolean(aviso))
  const [t, v1] = (aviso?.headers['x-vadai-firma'] ?? '').split(',').map((p) => p.split('=')[1])
  afirmar('Webhooks', 'con una firma válida', v1, createHmac('sha256', secreto ?? '').update(`${t}.${aviso?.cuerpo}`).digest('hex'))
  afirmar('Webhooks', 'y solo ids y títulos, sin correos', false, (aviso?.cuerpo ?? '').includes('@'))
  afirmar('Webhooks', 'el id del evento viaja en el encabezado', true, (aviso?.headers['x-vadai-id'] ?? '').startsWith('evt_'))
  await new Promise((x) => setTimeout(x, 1500))
  const falla = await una(
    bd,
    `select e.estado, e.intentos, e.ultimo_error, w.fallas_seguidas from academia.webhook_entregas e join academia.webhooks_salientes w on w.id = e.webhook_id where w.nombre = 'QA API falla' order by e.created_at desc limit 1`
  )
  afirmar('Webhooks', 'una entrega que falla queda pendiente para reintento', 'pendiente 1 Respondió 500. 1', `${falla?.estado} ${falla?.intentos} ${falla?.ultimo_error} ${falla?.fallas_seguidas}`)
  r = await api('PATCH', `/noticias/${noticiaId}${Q}`, escritura, { titulo: 'QA API noticia editada' })
  afirmar('Noticias', 'editar', 'QA API noticia editada', (await una(bd, `select title from academia.community_posts where id = $1`, [noticiaId]))?.title)
  r = await api('DELETE', `/noticias/${noticiaId}${Q}`, escritura)
  afirmar('Noticias', 'retirar la saca de la lista', false, (await api('GET', `/noticias${Q}`, lectura)).datos?.noticias?.some((n) => n.id === noticiaId))
  afirmar('Noticias', 'una noticia de otro plan no se toca', 404, (await api('PATCH', `/noticias/${noticiaId}?plan=v-ai-p`, escritura, { titulo: 'QA intruso' })).status)

  // --- 4. Clases y eventos -------------------------------------------------------
  const manana = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
  afirmar('Eventos', 'en el pasado: 400', 400, (await api('POST', `/eventos${Q}`, escritura, { titulo: 'QA API pasado', inicio: '2020-01-01T10:00:00Z' })).status)
  afirmar('Eventos', 'un evento sin lugar ni liga: 400', 400, (await api('POST', `/eventos${Q}`, escritura, { titulo: 'QA API sin lugar', inicio: manana, tipo: 'evento' })).status)
  r = await api('POST', `/eventos${Q}`, escritura, { titulo: 'QA API evento', inicio: manana, tipo: 'evento', lugar: 'QA Sala', anunciar: true })
  afirmar('Eventos', 'agendar responde 201', 201, r.status)
  const sesionId = r.datos?.id
  const sesion = await una(bd, `select kind, location, cohort_id from academia.cohort_sessions where id = $1`, [sesionId])
  afirmar('Eventos', 'queda como evento en la generación de la casa', `evento QA Sala ${gen.id}`, `${sesion?.kind} ${sesion?.location} ${sesion?.cohort_id}`)
  // M25: `anunciar` se acepta pero ya no publica: las clases de V-AI-P no llevan anuncio.
  afirmar('Eventos', 'y NO sale anuncio aunque se pida', false, Boolean(await una(bd, `select 1 from academia.posts where audience_course_id = $1 and title like '%QA API evento'`, [casa.id])))
  afirmar('Webhooks', 'el receptor recibe sesion.creada', true, Boolean(await esperarAviso((x) => x.headers['x-vadai-evento'] === 'sesion.creada')))
  afirmar('Eventos', 'se lista', true, (await api('GET', `/eventos${Q}`, lectura)).datos?.eventos?.some((e) => e.id === sesionId && e.lugar === 'QA Sala'))
  afirmar('Eventos', 'cancelar', 200, (await api('DELETE', `/eventos/${sesionId}${Q}`, escritura)).status)
  afirmar('Eventos', 'y ya no existe', null, await una(bd, `select id from academia.cohort_sessions where id = $1`, [sesionId]))

  // --- 5. El muro -----------------------------------------------------------------
  r = await api('GET', `/comunidad/hilos${Q}`, lectura)
  afirmar('Muro', 'la pregunta espera respuesta', true, r.datos?.hilos?.some((h) => h.id === pregunta.id && h.sinRespuesta))
  r = await api('POST', `/comunidad/hilos/${pregunta.id}/respuestas${Q}`, escritura, { texto: 'QA API respuesta del equipo.' })
  afirmar('Muro', 'responder responde 201', 201, r.status)
  const comentario = await una(bd, `select via, user_id from academia.community_comments where id = $1`, [r.datos?.id])
  afirmar('Muro', 'la respuesta es del bot, marcada api', `api ${bot.user_id}`, `${comentario?.via} ${comentario?.user_id}`)
  r = await api('GET', `/comunidad/hilos${Q}`, lectura)
  afirmar('Muro', 'y la pregunta deja de esperar', false, r.datos?.hilos?.some((h) => h.id === pregunta.id))

  // --- 6. Miembros y métricas -------------------------------------------------------
  r = await api('GET', `/miembros${Q}`, lectura)
  const miembro = r.datos?.miembros?.find((m) => m.id === alumno.user_id)
  afirmar('Miembros', 'el miembro sale con su nombre y sus puntos', true, Boolean(miembro && miembro.nombre === alumno.full_name && typeof miembro.puntos === 'number'))
  afirmar('Miembros', 'sus puntos cuentan su pregunta (15)', true, (miembro?.puntos ?? 0) >= 15)
  afirmar('Miembros', 'sin miembros:pii no hay correo', false, 'correo' in (miembro ?? {}))
  afirmar('Miembros', 'sin cobros:leer no hay suscripción', false, 'suscripcion' in (miembro ?? {}))
  afirmar('Miembros', 'el bot no es un miembro', false, r.datos?.miembros?.some((m) => m.id === bot.user_id))
  r = await api('GET', `/miembros${Q}`, cobros)
  afirmar('Miembros', 'con cobros:leer sí, la suscripción', 'active', r.datos?.miembros?.find((m) => m.id === alumno.user_id)?.suscripcion?.estado)
  afirmar('Miembros', 'miembros:pii sin miembros:leer: 403', 403, (await api('GET', `/miembros${Q}`, escritura)).status)
  r = await api('GET', `/metricas${Q}`, lectura)
  afirmar('Métricas', 'cuenta al miembro con acceso', true, (r.datos?.miembrosConAcceso ?? 0) >= 1)
  afirmar('Métricas', 'sin cobros:leer no hay dinero', false, 'cobradoEsteMesMxn' in (r.datos ?? {}))
  afirmar('Métricas', 'con cobros:leer sí', true, 'cobradoEsteMesMxn' in ((await api('GET', `/metricas${Q}`, cobros)).datos ?? {}))

  // --- 7. Cuota, cron y RLS ---------------------------------------------------------
  const idLectura = (await una(bd, `select id from academia.api_keys where nombre = 'QA API lectura'`)).id
  await bd.query(`update academia.api_uso set cuenta = 600 where key_id = $1 and hora = date_trunc('hour', now())`, [idLectura])
  afirmar('Cuota', 'pasada la cuota: 429', 429, (await api('GET', `/metricas${Q}`, lectura)).status)
  afirmar('Cron', 'sin el secreto: 401', 401, (await fetch(`${APP}/api/cron/webhooks`)).status)
  const cron = await fetch(`${APP}/api/cron/webhooks`, { headers: { authorization: `Bearer ${CRON}` } })
  afirmar('Cron', 'con el secreto corre', 200, cron.status)
  const cmId = (await una(bd, `select user_id from academia.profiles where email = 'qa-cm@academia.vadai.com.mx'`)).user_id
  afirmar('RLS', 'el community manager no ve llaves', 0, (await comoUsuario(bd, cmId, `select id from academia.api_keys`)).length)
  afirmar('RLS', 'ni webhooks', 0, (await comoUsuario(bd, cmId, `select id from academia.webhooks_salientes`)).length)
  // Por su fila (la liga a su ficha): el correo buscado también vuelve en el campo de búsqueda.
  const lista = await (await pedir(`/admin/alumnos?q=${encodeURIComponent('equipo@academia.vadai.com.mx')}`, admin)).text()
  afirmar('RLS', 'el bot no sale en Alumnos', false, lista.includes(`/admin/alumnos/${bot.user_id}`))

  verde = imprimir()
} catch (error) {
  console.error('\n  La prueba se cayó:', error)
} finally {
  await purgar(bd).catch((e) => console.error('  Limpieza incompleta:', e.message))
  await bd.end()
  receptor.close()
  process.exitCode = verde ? 0 : 1
}
