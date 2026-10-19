#!/usr/bin/env node
/**
 * test-vaip-portal.mjs — Criterio de cierre de M19: el panel con barra lateral
 * y el portal de la comunidad V-AI-P.
 *
 *   PORT=3117 pnpm start
 *   node scripts/test-vaip-portal.mjs
 *
 * Cubre:
 *   - la barra lateral lleva a todo lo que había (y a Entregas y
 *     Publicaciones), y cada página del panel sigue abriendo;
 *   - el portal: el community manager entra a Resumen, Miembros, Clases y
 *     eventos, Contenido y Muro, pero Cobros y Planes lo rebotan (y ni los
 *     ve); la columna de suscripción solo la ve el admin, y en Postgres el
 *     community manager sigue sin leer membresías;
 *   - Miembros: avance y puntos salen de la actividad real;
 *   - Herramientas: un curso con área sale en el espacio del miembro, en su
 *     grupo;
 *   - un tema «solo equipo» no se le ofrece a un alumno y la base lo rechaza;
 *   - un evento con su lugar se agenda desde el panel y el alumno lo ve.
 *
 * Solo con cursos QA (`qa-portal-*`): la casa REAL de V-AI-P no se toca, ni se
 * agenda nada que avise a sus miembros. Lo suyo se borra por marca exacta.
 */

import { createHmac } from 'node:crypto'

import { cargarEnv, conectarPostgres, exigir } from './lib/entorno.mjs'

const vars = cargarEnv()
const SUPABASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')
const SECRETO = exigir(vars, 'STRIPE_WEBHOOK_SECRET')
const APP = (process.env.APP_URL ?? 'http://localhost:3117').replace(/\/+$/, '')

const VAIP = 'v-ai-p'
const CORREO = 'qa-portal1@academia.vadai.com.mx'
const CORREO_CM = 'qa-cm@academia.vadai.com.mx'
const CORREO_ADMIN = 'qa-admin@academia.vadai.com.mx'
const NOMBRE = 'QA Portal Miembro'
const DIA = 24 * 60 * 60
const ahora = () => Math.floor(Date.now() / 1000)

// --- webhook firmado, sesión y formularios -----------------------------------

let cuenta = 0
const evento = (tipo, objeto, creado = ahora()) => {
  cuenta += 1
  return { id: `evt_qaportal_${Date.now()}_${cuenta}`, object: 'event', type: tipo, api_version: '2026-07-29.dahlia', created: creado, data: { object: objeto } }
}
async function webhook(e) {
  const cuerpo = JSON.stringify(e)
  const t = ahora()
  const firma = `t=${t},v1=${createHmac('sha256', SECRETO).update(`${t}.${cuerpo}`).digest('hex')}`
  return (await fetch(`${APP}/api/stripe/webhook`, { method: 'POST', headers: { 'stripe-signature': firma, 'content-type': 'application/json' }, body: cuerpo })).status
}

function crearFrasco() {
  const cookies = new Map()
  return {
    guardar(r) {
      for (const cruda of r.headers.getSetCookie?.() ?? []) {
        const [par] = cruda.split(';')
        const i = par.indexOf('=')
        if (i === -1) continue
        const valor = par.slice(i + 1).trim()
        if (valor === '' || /Max-Age=0/i.test(cruda)) cookies.delete(par.slice(0, i).trim())
        else cookies.set(par.slice(0, i).trim(), valor)
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
  const cuerpo = await r.json()
  const hash = cuerpo.hashed_token ?? cuerpo.properties?.hashed_token
  if (!hash) throw new Error(`No se pudo generar enlace para ${email}.`)
  const frasco = crearFrasco()
  frasco.guardar(await fetch(`${APP}/auth/confirmar?token_hash=${encodeURIComponent(hash)}&type=recovery`, { redirect: 'manual' }))
  return frasco
}
const pedir = (ruta, frasco, opciones = {}) =>
  fetch(`${APP}${ruta}`, { redirect: 'manual', ...opciones, headers: frasco?.tamano ? { cookie: frasco.encabezado() } : {} })
const html = async (ruta, frasco) => (await pedir(ruta, frasco)).text()
const rebota = (r) => r.status === 307 || r.status === 303

function formulario(pagina, campo) {
  for (const bloque of pagina.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)) {
    if (!bloque[1].includes(`name="${campo}"`)) continue
    const campos = {}
    for (const etiqueta of bloque[1].matchAll(/<(?:input|select|textarea)\b[^>]*>/g)) {
      const nombre = etiqueta[0].match(/name="([^"]*)"/)?.[1]
      if (!nombre) continue
      // Como un navegador: una casilla sin marcar no se envía.
      const tipo = etiqueta[0].match(/type="([^"]*)"/)?.[1]
      if ((tipo === 'checkbox' || tipo === 'radio') && !/\schecked/.test(etiqueta[0])) continue
      campos[nombre] = (etiqueta[0].match(/value="([^"]*)"/)?.[1] ?? '').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&')
    }
    return campos
  }
  return null
}
async function enviar(ruta, campos, frasco) {
  const cuerpo = new FormData()
  for (const [n, v] of Object.entries(campos)) cuerpo.append(n, v)
  return pedir(ruta, frasco, { method: 'POST', body: cuerpo })
}

// --- reporte ------------------------------------------------------------------

const resultados = []
const afirmar = (grupo, descripcion, esperado, real) => resultados.push({ grupo, descripcion, esperado, real, ok: esperado === real })
function imprimir() {
  const porGrupo = new Map()
  for (const r of resultados) porGrupo.set(r.grupo, [...(porGrupo.get(r.grupo) ?? []), r])
  const ancho = Math.max(...resultados.map((r) => r.descripcion.length))
  console.log('\n  PRUEBA DEL PORTAL — M19 · barra lateral y portal de V-AI-P')
  console.log(`  App: ${APP}`)
  for (const [grupo, casos] of porGrupo) {
    console.log(`\n  ${grupo}\n  ${'─'.repeat(ancho + 30)}`)
    for (const c of casos) console.log(`  ${c.ok ? '✓' : '✗'}  ${c.descripcion.padEnd(ancho)}  ${c.ok ? String(c.real) : `esperado ${c.esperado}, obtuvo ${c.real}`}`)
  }
  const fallidas = resultados.filter((r) => !r.ok)
  console.log(`\n  ${'─'.repeat(ancho + 30)}`)
  console.log(fallidas.length === 0 ? `  M19 EN VERDE — ${resultados.length}/${resultados.length} aserciones pasaron.` : `  ${fallidas.length} de ${resultados.length} aserciones FALLARON.`)
  for (const f of fallidas) console.log(`    ${f.grupo} · ${f.descripcion}: esperado ${f.esperado}, obtuvo ${f.real}`)
  console.log('')
  return fallidas.length === 0
}

// --- base ---------------------------------------------------------------------

const una = async (bd, sql, params = []) => (await bd.query(sql, params)).rows[0] ?? null
const idDe = async (bd, email) => (await una(bd, `select user_id from academia.profiles where lower(email) = $1`, [email]))?.user_id ?? null

async function purgar(bd) {
  const cursos = `(select id from academia.courses where slug like 'qa-portal-%')`
  await bd.query(`delete from academia.memberships where stripe_subscription_id like 'sub_qaportal_%'`)
  await bd.query(`delete from academia.community_posts where course_id in ${cursos}`)
  await bd.query(`delete from academia.community_topics where course_id in ${cursos}`)
  await bd.query(`delete from academia.posts where audience_course_id in ${cursos}`)
  await bd.query(`delete from academia.cohort_sessions where cohort_id in (select id from academia.cohorts where course_id in ${cursos})`)
  await bd.query(`delete from academia.enrollments where course_id in ${cursos}`)
  await bd.query(`delete from academia.cohorts where course_id in ${cursos}`)
  await bd.query(`delete from academia.courses where slug like 'qa-portal-%'`)
  await bd.query(`delete from academia.stripe_events where event_id like 'evt_qaportal_%'`)
}
async function borrarCuenta(bd) {
  const id = await idDe(bd, CORREO)
  if (!id) return
  await bd.query(`delete from academia.enrollments where user_id = $1`, [id])
  await fetch(`${SUPABASE}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } })
  await bd.query(`delete from academia.profiles where user_id = $1`, [id])
}
async function comoUsuario(bd, userId, sql, params = []) {
  await bd.query('begin')
  try {
    await bd.query(`set local role authenticated`)
    await bd.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: userId, role: 'authenticated' })])
    return (await bd.query(sql, params)).rows
  } finally {
    await bd.query('rollback')
  }
}

// --- la prueba --------------------------------------------------------------------

const bd = await conectarPostgres(vars)
let verde = false
try {
  await purgar(bd)
  await borrarCuenta(bd)
  const plan = await una(bd, `select id from academia.membership_plans where slug = $1`, [VAIP])
  if (!plan) throw new Error('No existe el plan v-ai-p.')
  const columna = await una(bd, `select 1 as hay from information_schema.columns where table_schema = 'academia' and table_name = 'courses' and column_name = 'category'`)
  if (!columna) throw new Error('Falta aplicar la migración academia_0043_contenido_vaip.')

  const curso = async (slug, tipo, categoria = null) => {
    const id = (
      await bd.query(
        `insert into academia.courses (slug, title, course_type, status, certificate_enabled, category)
         values ($1, $2, $3, 'published', false, $4) returning id`,
        [slug, `QA · ${slug} (test-vaip-portal)`, tipo, categoria]
      )
    ).rows[0].id
    await bd.query(`insert into academia.membership_plan_courses (plan_id, course_id) values ($1, $2)`, [plan.id, id])
    return id
  }
  const casa = await curso('qa-portal-casa', 'cohort')
  await curso('qa-portal-herramienta', 'evergreen', 'creativas')
  const { rows: [gen] } = await bd.query(
    `insert into academia.cohorts (course_id, name, starts_on, ends_on, open_for_enrollment) values ($1, 'Miembros', current_date, null, true) returning id`,
    [casa]
  )
  const { rows: [temaEquipo] } = await bd.query(
    `insert into academia.community_topics (course_id, name, slug, position, solo_equipo) values ($1, 'QA Portal Noticias', 'qa-portal-noticias', 0, true) returning id`,
    [casa]
  )

  // Un miembro, por el webhook.
  const t0 = ahora()
  const sub = {
    id: 'sub_qaportal_1', object: 'subscription', status: 'active', customer: 'cus_qaportal_1', cancel_at_period_end: false, ended_at: null,
    metadata: { academia_plan: VAIP },
    items: { object: 'list', data: [{ id: 'si_qaportal_1', current_period_start: t0 - DIA, current_period_end: t0 + 29 * DIA, price: { id: 'price_qaportal' } }] },
  }
  await webhook(evento('customer.subscription.created', sub, t0))
  await webhook(
    evento('checkout.session.completed', {
      id: 'cs_qaportal_1', object: 'checkout.session', mode: 'subscription', payment_status: 'paid', subscription: sub.id, customer: sub.customer,
      customer_details: { email: CORREO, name: NOMBRE }, customer_email: CORREO, client_reference_id: null, metadata: { academia_plan: VAIP },
    }, t0 + 1)
  )
  const miembroId = await idDe(bd, CORREO)
  if (!miembroId) throw new Error('El webhook no creó al miembro.')
  // Una publicación suya: 15 puntos.
  await bd.query(`insert into academia.community_posts (course_id, cohort_id, user_id, title) values ($1, $2, $3, 'QA portal publicación')`, [casa, gen.id, miembroId])

  const admin = await entrar(CORREO_ADMIN)
  const cm = await entrar(CORREO_CM)
  const miembro = await entrar(CORREO)

  // --- 1. La barra lateral --------------------------------------------------
  const panelAdmin = await html('/admin', admin)
  afirmar('Barra lateral', 'el panel trae la barra lateral', true, panelAdmin.includes('aria-label="Secciones del panel"'))
  for (const [ruta, nombre] of [
    ['/admin/cursos', 'Cursos'], ['/admin/entregas', 'Entregas'], ['/admin/publicaciones', 'Publicaciones'], ['/admin/comunidad', 'Bandeja'],
    ['/admin/puntos', 'Puntos'], ['/admin/alumnos', 'Alumnos'], ['/admin/empresas', 'Empresas'], ['/admin/encuestas', 'Encuestas'],
    ['/admin/dinamicas', 'Dinámicas'], ['/admin/certificaciones', 'Certificaciones'], ['/admin/vaip', 'V-AI-P'], ['/mis-cursos', 'Portal de alumnos'],
  ]) {
    afirmar('Barra lateral', `lleva a ${nombre}`, true, panelAdmin.includes(`href="${ruta}"`))
  }
  for (const ruta of ['/admin', '/admin/cursos', '/admin/entregas', '/admin/publicaciones', '/admin/comunidad', '/admin/puntos', '/admin/alumnos', '/admin/empresas', '/admin/encuestas', '/admin/dinamicas', '/admin/certificaciones']) {
    afirmar('Barra lateral', `${ruta} sigue abriendo`, 200, (await pedir(ruta, admin)).status)
  }
  afirmar('Barra lateral', 'el community manager ve V-AI-P', true, (await html('/admin', cm)).includes('href="/admin/vaip"'))

  // --- 2. Permisos del portal -------------------------------------------------
  for (const pestana of ['', '/miembros', '/clases', '/contenido', '/muro']) {
    afirmar('Portal', `el CM entra a /admin/vaip${pestana}`, 200, (await pedir(`/admin/vaip${pestana}`, cm)).status)
  }
  afirmar('Portal', 'Cobros rebota al CM', true, rebota(await pedir('/admin/vaip/cobros', cm)))
  afirmar('Portal', 'Planes rebota al CM', true, rebota(await pedir('/admin/vaip/planes', cm)))
  const resumenCm = await html('/admin/vaip', cm)
  afirmar('Portal', 'y al CM ni se le ofrecen', false, resumenCm.includes('href="/admin/vaip/cobros"') || resumenCm.includes('href="/admin/vaip/planes"'))
  const resumenAdmin = await html('/admin/vaip', admin)
  afirmar('Portal', 'al admin sí', true, resumenAdmin.includes('href="/admin/vaip/cobros"') && resumenAdmin.includes('href="/admin/vaip/planes"'))
  afirmar('Portal', 'Cobros abre para admin', 200, (await pedir('/admin/vaip/cobros', admin)).status)
  afirmar('Portal', 'el dinero del resumen es solo del admin', true, resumenAdmin.includes('Cobrado este mes') && !resumenCm.includes('Cobrado este mes'))

  // --- 3. Miembros ------------------------------------------------------------
  const miembrosAdmin = await html('/admin/vaip/miembros?estado=todos', admin)
  const miembrosCm = await html('/admin/vaip/miembros?estado=todos', cm)
  // Por su fila (la liga a su ficha), no por su nombre: el nombre también sale
  // en la campana del encabezado, porque su publicación espera respuesta.
  const fila = `href="/admin/alumnos/${miembroId}"`
  afirmar('Miembros', 'el admin ve al miembro', true, miembrosAdmin.includes(fila))
  afirmar('Miembros', 'el CM también', true, miembrosCm.includes(fila))
  afirmar('Miembros', 'la suscripción solo la ve el admin', true, miembrosAdmin.includes('>Suscripción<') && !miembrosCm.includes('>Suscripción<'))
  const cmId = await idDe(bd, CORREO_CM)
  afirmar('Miembros', 'en Postgres el CM sigue sin leer membresías', 0, (await comoUsuario(bd, cmId, `select id from academia.memberships where stripe_subscription_id = 'sub_qaportal_1'`)).length)
  afirmar('Miembros', 'sus puntos salen de su actividad (una publicación = 15)', true, /QA Portal Miembro[\s\S]*?>15<\/span>/.test(miembrosAdmin))
  const buscado = await html(`/admin/vaip/miembros?estado=todos&q=${encodeURIComponent('nadie-se-llama-asi')}`, admin)
  afirmar('Miembros', 'la búsqueda filtra', false, buscado.includes(fila))

  // --- 4. Herramientas en el espacio ----------------------------------------
  // M22: V-AI-P tiene pestañas; las herramientas viven en la suya.
  const espacio = await html('/vaip/herramientas', miembro)
  afirmar('Herramientas', 'el espacio trae la sección', true, espacio.includes('>Herramientas<'))
  afirmar('Herramientas', 'con la herramienta en su área', true, /Creativas[\s\S]*qa-portal-herramienta/.test(espacio))
  // Las tarjetas pintadas (<h3>), no el texto: el título también viaja en el
  // paquete de datos de React que Next mete en la página.
  const apariciones = espacio.match(/<h3[^>]*>QA · qa-portal-herramienta \(test-vaip-portal\)<\/h3>/g) ?? []
  afirmar('Herramientas', 'y no repetida en la Biblioteca', 1, apariciones.length)
  const contenido = await html('/admin/vaip/contenido', cm)
  afirmar('Herramientas', 'el portal la agrupa por área', true, /Herramientas creativas[\s\S]*qa-portal-herramienta/.test(contenido))

  // --- 5. Un tema solo del equipo ----------------------------------------------
  const muro = await html('/curso/qa-portal-casa/comunidad', miembro)
  afirmar('Tema del equipo', 'el alumno lo puede filtrar', true, muro.includes('QA Portal Noticias'))
  afirmar('Tema del equipo', 'pero no se le ofrece para publicar', false, muro.includes(`<option value="${temaEquipo.id}"`))
  const publicar = formulario(muro, 'cuerpo')
  await enviar('/curso/qa-portal-casa/comunidad', { ...publicar, titulo: 'QA portal intruso', cuerpo: 'Forzado', topic_id: temaEquipo.id }, miembro)
  afirmar('Tema del equipo', 'y si lo fuerza, la base lo rechaza', null, await una(bd, `select id from academia.community_posts where title = 'QA portal intruso'`))
  const muroCm = await html('/curso/qa-portal-casa/comunidad', cm)
  afirmar('Tema del equipo', 'al equipo sí se le ofrece', true, muroCm.includes(`<option value="${temaEquipo.id}"`))

  // --- 6. Un evento con su lugar ------------------------------------------------
  const rutaGen = `/admin/cursos/${casa}?gen=${gen.id}`
  const agendar = formulario(await html(rutaGen, admin), 'kind')
  afirmar('Eventos', 'agendar en V-AI-P ofrece clase o evento', true, agendar !== null)
  const fecha = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date((t0 + 5 * DIA) * 1000))
  // Sin anuncio ni correo: la suite no avisa a nadie.
  const { anunciar: _a, avisar: _b, ...sinAvisos } = agendar ?? {}
  await enviar(rutaGen, { ...sinAvisos, title: 'QA Portal Evento', fecha, hora: '10:00', kind: 'evento', location: 'QA Sala de juntas', meet_url: '' }, admin)
  const ev = await una(bd, `select kind, location from academia.cohort_sessions where cohort_id = $1 and title = 'QA Portal Evento'`, [gen.id])
  afirmar('Eventos', 'queda como evento, con su lugar', 'evento · QA Sala de juntas', `${ev?.kind} · ${ev?.location}`)
  const enVivo = await html('/curso/qa-portal-casa/en-vivo', miembro)
  afirmar('Eventos', 'el alumno lo ve como evento, con el lugar', true, enVivo.includes('QA Portal Evento') && enVivo.includes('QA Sala de juntas'))
  const sinLugar = await enviar(rutaGen, { ...sinAvisos, title: 'QA Portal Evento sin lugar', fecha, hora: '11:00', kind: 'evento', location: '', meet_url: '' }, admin)
  afirmar('Eventos', 'un evento sin lugar ni liga se rechaza', true, (await sinLugar.text()).includes('Un evento necesita su lugar o su liga'))

  verde = imprimir()
} catch (error) {
  console.error('\n  La prueba se cayó:', error)
} finally {
  await purgar(bd).catch((e) => console.error('  Limpieza incompleta:', e.message))
  await borrarCuenta(bd).catch((e) => console.error('  Limpieza incompleta:', e.message))
  await bd.end()
  process.exitCode = verde ? 0 : 1
}
