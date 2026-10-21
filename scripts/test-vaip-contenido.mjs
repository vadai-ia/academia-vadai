#!/usr/bin/env node
/**
 * test-vaip-contenido.mjs — Criterio de cierre de M26: V-AI-P por dentro.
 *
 *   VAIP_ESPACIO_DE_PRUEBA=qa-contenido PORT=3141 pnpm start   (con las variables de siempre)
 *   APP_URL=http://localhost:3141 node scripts/test-vaip-contenido.mjs [--conservar]
 *
 * La variable puede quedarse puesta para todas las suites: solo las peticiones
 * que traen `x-vaip-espacio: qa-contenido` —las de esta suite— ven el plan QA.
 *
 * Cubre lo que pidió Alejandro el 21-oct-2026:
 *   - las clases grabadas se suben por fecha y quedan en su MES; el mes se crea
 *     solo, se reusa, y la grabación se liga sola a la clase de ese día;
 *   - el community manager sube, edita y publica, pero no cambia el tipo, no
 *     toca una lección de curso y no borra; sin video no se publica;
 *   - las herramientas son videos con etiquetas libres y portada dibujada
 *     (720×960); renombrar redibuja y la portada vieja desaparece;
 *   - el miembro las ve en /vaip y no como curso: /curso/<casa>/<id> lo manda
 *     a su página, el filtro por etiqueta y «Anterior/Siguiente» se quedan en
 *     la etiqueta, el reproductor sabe si el video es vertical; quien no es
 *     miembro vuelve a /vaip; un borrador no se ve;
 *   - «Lo nuevo» arriba del muro; puntos 5 (grabación) y 3 (herramienta);
 *   - los comentarios llegan al Muro del panel; los números de la barra
 *     cuentan lo que espera acción y en 0 no se pintan.
 *
 * Todo vive en el plan `qa-contenido` y su casa `qa-contenido-casa`, que la
 * suite arma y borra por marca exacta. El servidor tiene que correr con
 * `VAIP_ESPACIO_DE_PRUEBA=qa-contenido` (lib/membresia/consultas.ts) y cada
 * petición lleva `x-vaip-espacio`: así el espacio y el panel de V-AI-P usan la
 * casa QA y la real nunca se toca.
 */

import { cargarEnv, conectarPostgres, exigir } from './lib/entorno.mjs'
import { CLAVE_QA, CURSO_QA } from './lib/qa.mjs'
import { actividadDeFila, PUNTOS, puntosDe } from '../lib/gamificacion/reglas.ts'

const vars = cargarEnv()
const SUPABASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')
const ANON = exigir(vars, 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
const APP = (process.env.APP_URL ?? 'http://localhost:3141').replace(/\/+$/, '')

const CONSERVAR = process.argv.includes('--conservar')
const PLAN = 'qa-contenido'
const CASA = 'qa-contenido-casa'
const SUB = 'sub_qacontenido_'
const BUCKET = 'academia-media'
const CORREO_ADMIN = 'qa-admin@academia.vadai.com.mx'
const CORREO_CM = 'qa-cm@academia.vadai.com.mx'
const CORREO_MIEMBRO = 'qa-alumno1@academia.vadai.com.mx'
const CORREO_VENCIDO = 'qa-alumno2@academia.vadai.com.mx'
const DIA = 24 * 60 * 60 * 1000
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

const fechaCdmx = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date(ms))

// --- sesión, páginas y formularios -------------------------------------------

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
// Cada petición pide el espacio QA (`planDelEspacio`): sin este encabezado, el V-AI-P real.
const pedir = (ruta, frasco, opciones = {}) =>
  fetch(`${APP}${ruta}`, {
    redirect: 'manual',
    ...opciones,
    headers: { 'x-vaip-espacio': PLAN, ...(frasco?.tamano ? { cookie: frasco.encabezado() } : {}) },
  })
const html = async (ruta, frasco) => (await pedir(ruta, frasco)).text()
const destino = (r) => {
  const l = r.headers.get('location')
  return l ? new URL(l, APP).pathname + new URL(l, APP).search : null
}

/** El <form> que trae todas las piezas, con sus campos como los mandaría un navegador sin JS. */
function formulario(pagina, ...piezas) {
  for (const bloque of pagina.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)) {
    if (!piezas.every((p) => bloque[1].includes(p))) continue
    const campos = {}
    for (const etiqueta of bloque[1].matchAll(/<input\b[^>]*>/g)) {
      const nombre = etiqueta[0].match(/name="([^"]*)"/)?.[1]
      if (!nombre) continue
      const tipo = etiqueta[0].match(/type="([^"]*)"/)?.[1]
      if ((tipo === 'checkbox' || tipo === 'radio') && !/\schecked/.test(etiqueta[0])) continue
      campos[nombre] = (etiqueta[0].match(/value="([^"]*)"/)?.[1] ?? '').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&')
    }
    if (Object.keys(campos).some((n) => n.startsWith('$ACTION'))) return campos
  }
  return null
}
/** Envía un formulario; un arreglo manda el campo varias veces (casillas). */
async function enviar(ruta, campos, frasco) {
  const cuerpo = new FormData()
  for (const [n, v] of Object.entries(campos)) {
    for (const x of Array.isArray(v) ? v : [v]) cuerpo.append(n, x)
  }
  return pedir(ruta, frasco, { method: 'POST', body: cuerpo })
}
const sinArreglo = (campos, ...quitar) => Object.fromEntries(Object.entries(campos).filter(([n]) => !quitar.includes(n)))

// --- la base con la sesión de alguien (REST con su JWT) ------------------------

async function token(email) {
  const res = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: CLAVE_QA }),
  })
  const cuerpo = await res.json()
  if (!res.ok || !cuerpo.access_token) throw new Error(`No se pudo entrar como ${email}`)
  return cuerpo.access_token
}
async function rest(jwt, metodo, consulta, cuerpo) {
  const res = await fetch(`${SUPABASE}/rest/v1/${consulta}`, {
    method: metodo,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${jwt}`,
      'Accept-Profile': 'academia',
      'Content-Profile': 'academia',
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
  const datos = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, filas: Array.isArray(datos) ? datos : [], datos, mensaje: datos?.message ?? '', codigo: datos?.code ?? '' }
}

// --- reporte --------------------------------------------------------------------

const resultados = []
const afirmar = (grupo, descripcion, esperado, real) => resultados.push({ grupo, descripcion, esperado, real, ok: esperado === real })
function imprimir() {
  if (resultados.length === 0) return false
  const porGrupo = new Map()
  for (const r of resultados) porGrupo.set(r.grupo, [...(porGrupo.get(r.grupo) ?? []), r])
  const ancho = Math.max(...resultados.map((r) => r.descripcion.length))
  console.log('\n  PRUEBA DE M26 — V-AI-P por dentro: clases grabadas, herramientas y números')
  console.log(`  App: ${APP}`)
  for (const [grupo, casos] of porGrupo) {
    console.log(`\n  ${grupo}\n  ${'─'.repeat(ancho + 30)}`)
    for (const c of casos) console.log(`  ${c.ok ? '✓' : '✗'}  ${c.descripcion.padEnd(ancho)}  ${c.ok ? String(c.real) : `esperado ${c.esperado}, obtuvo ${c.real}`}`)
  }
  const fallidas = resultados.filter((r) => !r.ok)
  console.log(`\n  ${'─'.repeat(ancho + 30)}`)
  console.log(fallidas.length === 0 ? `  M26 EN VERDE — ${resultados.length}/${resultados.length} aserciones pasaron.` : `  ${fallidas.length} de ${resultados.length} aserciones FALLARON.`)
  for (const f of fallidas) console.log(`    ${f.grupo} · ${f.descripcion}: esperado ${f.esperado}, obtuvo ${f.real}`)
  console.log('')
  return fallidas.length === 0
}

// --- base ---------------------------------------------------------------------------

const una = async (bd, sql, params = []) => (await bd.query(sql, params)).rows[0] ?? null
const idDe = async (bd, email) => (await una(bd, `select user_id from academia.profiles where lower(email) = $1`, [email]))?.user_id ?? null

async function borrarPortadas(casaId) {
  const prefijo = `vaip/herramientas/${casaId}`
  const r = await fetch(`${SUPABASE}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: prefijo, limit: 200 }),
  })
  const archivos = (await r.json().catch(() => [])) ?? []
  const rutas = (Array.isArray(archivos) ? archivos : []).map((a) => `${prefijo}/${a.name}`)
  if (rutas.length === 0) return
  await fetch(`${SUPABASE}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: rutas }),
  })
}

/** Solo lo suyo, por marca exacta: el plan `qa-contenido`, su casa y sus membresías. */
async function purgar(bd) {
  const casa = await una(bd, `select id from academia.courses where slug = $1`, [CASA])
  if (casa) await borrarPortadas(casa.id)
  await bd.query(`delete from academia.memberships where stripe_subscription_id like $1`, [`${SUB}%`])
  await bd.query(`delete from academia.membership_plans where slug = $1`, [PLAN])
  if (casa) {
    // Los módulos antes que las generaciones: `modules.cohort_id` es restrict.
    await bd.query(`delete from academia.modules where course_id = $1`, [casa.id])
    await bd.query(`delete from academia.cohort_sessions where cohort_id in (select id from academia.cohorts where course_id = $1)`, [casa.id])
    await bd.query(`delete from academia.enrollments where course_id = $1`, [casa.id])
    await bd.query(`delete from academia.cohorts where course_id = $1`, [casa.id])
    await bd.query(`delete from academia.courses where id = $1`, [casa.id])
  }
}

const insignia = (pagina, clave) => {
  const m = pagina.match(new RegExp(`data-insignia="${clave}"[^>]*>(\\d+\\+?)`))
  return m ? m[1] : null
}
/** Ancho y alto de un PNG, de su encabezado IHDR. */
function medidasPng(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return `${v.getUint32(16)}×${v.getUint32(20)}`
}
const urlPublica = (ruta) => `${SUPABASE}/storage/v1/object/public/${BUCKET}/${ruta}`
const activaEnMenu = (pagina, href) =>
  new RegExp(`<a[^>]*aria-current="page"[^>]*href="${href}"|<a[^>]*href="${href}"[^>]*aria-current="page"`).test(pagina)

// --- la prueba --------------------------------------------------------------------

const bd = await conectarPostgres(vars)
let verde = false
try {
  const columna = await una(bd, `select 1 as hay from information_schema.tables where table_schema = 'academia' and table_name = 'tool_tags'`)
  if (!columna) throw new Error('Falta aplicar la migración academia_0048_contenido_de_vaip.')
  await purgar(bd)

  // --- 0. Montaje: plan QA con su casa, «Miembros», tres clases y dos alumnos -----
  const ahora = Date.now()
  const ayer = fechaCdmx(ahora - DIA)
  const haceUnMes = fechaCdmx(ahora - 35 * DIA)
  // Otro mes más atrás: la grabación que se crea ahí y se cambia de día deja ese mes vacío.
  const haceDosMeses = fechaCdmx(ahora - 70 * DIA)
  const enTresDias = fechaCdmx(ahora + 3 * DIA)
  // Otro día del mes de «ayer», para reusar ese mes.
  const diaDeAyer = Number(ayer.slice(8, 10))
  const otroDia = `${ayer.slice(0, 8)}${String(diaDeAyer === 15 ? 14 : 15).padStart(2, '0')}`

  const casa = await una(
    bd,
    `insert into academia.courses (slug, title, course_type, status, certificate_enabled) values ($1, 'QA · Casa de contenido (test-vaip-contenido)', 'cohort', 'published', false) returning id`,
    [CASA]
  )
  const gen = await una(
    bd,
    `insert into academia.cohorts (course_id, name, starts_on, ends_on, open_for_enrollment) values ($1, 'Miembros', current_date - 60, null, true) returning id`,
    [casa.id]
  )
  const plan = await una(
    bd,
    `insert into academia.membership_plans (slug, name, price_mxn, status, hub_course_id) values ($1, 'QA Contenido', 100, 'active', $2) returning id`,
    [PLAN, casa.id]
  )
  await bd.query(`insert into academia.membership_plan_courses (plan_id, course_id) values ($1, $2)`, [plan.id, casa.id])
  const sesion = async (titulo, fecha) =>
    (
      await una(
        bd,
        `insert into academia.cohort_sessions (cohort_id, title, scheduled_at, kind) values ($1, $2, $3::timestamptz, 'clase') returning id`,
        [gen.id, titulo, `${fecha}T17:00:00-06:00`]
      )
    ).id
  const S1 = await sesion('QA Contenido · clase de ayer', ayer)
  const S2 = await sesion('QA Contenido · clase del mes pasado', haceUnMes)
  await sesion('QA Contenido · próxima clase', enTresDias)

  const miembroId = await idDe(bd, CORREO_MIEMBRO)
  const vencidoId = await idDe(bd, CORREO_VENCIDO)
  const cmId = await idDe(bd, CORREO_CM)
  if (!miembroId || !vencidoId || !cmId) throw new Error('Faltan las cuentas QA: corre el seed.')
  await bd.query(
    `insert into academia.enrollments (user_id, course_id, cohort_id, source, status, expires_at) values ($1, $2, $3, 'membresia', 'active', now() + interval '20 days')`,
    [miembroId, casa.id, gen.id]
  )
  await bd.query(
    `insert into academia.memberships (plan_id, user_id, email, stripe_customer_id, stripe_subscription_id, status, current_period_start, current_period_end, access_until)
     values ($1, $2, $3, 'cus_qacontenido', $4, 'active', now() - interval '10 days', now() + interval '20 days', now() + interval '22 days')`,
    [plan.id, miembroId, CORREO_MIEMBRO, `${SUB}1`]
  )

  const admin = await entrar(CORREO_ADMIN)
  const cm = await entrar(CORREO_CM)
  const miembro = await entrar(CORREO_MIEMBRO)
  const vencido = await entrar(CORREO_VENCIDO)
  const [jwtCm, jwtMiembro] = await Promise.all([token(CORREO_CM), token(CORREO_MIEMBRO)])

  let clases = await html('/admin/vaip/clases', cm)
  if (!clases.includes('QA Contenido · clase de ayer')) {
    throw new Error('El servidor no usa la casa QA: arráncalo con VAIP_ESPACIO_DE_PRUEBA=qa-contenido (fuera de Vercel).')
  }

  // --- 1. En la base: quién puede crear contenido de V-AI-P -------------------------
  const B = 'En la base'
  const rpcAlumno = await rest(jwtMiembro, 'POST', 'rpc/academia_vaip_nueva_grabacion', { p_casa: casa.id, p_fecha: ayer })
  afirmar(B, 'un alumno que llama la RPC: 42501', '42501', rpcAlumno.codigo)
  const rpcNoCasa = await rest(jwtCm, 'POST', 'rpc/academia_vaip_nueva_grabacion', { p_casa: CURSO_QA.id, p_fecha: ayer })
  afirmar(B, 'un curso que no es casa: 22023', '22023', rpcNoCasa.codigo)
  afirmar(B, 'y no dejó nada creado', 0, Number((await una(bd, `select count(*) from academia.modules where course_id = $1 and kind = 'mes'`, [CURSO_QA.id])).count))

  // --- 2. Panel → Clases: subir grabaciones por fecha ---------------------------------
  const P = 'Panel · Clases'
  afirmar(P, 'el CM entra a Clases', 200, (await pedir('/admin/vaip/clases', cm)).status)
  afirmar(P, 'ya no hay «Datos de la casa»', false, clases.includes('Datos de la casa'))
  afirmar(P, 'ni el árbol de un curso', false, clases.includes('Nuevo módulo'))
  afirmar(P, 'la clase de ayer ofrece «Subir grabación»', true, clases.includes(`data-subir-grabacion="${S1}"`))
  const clasesEnSql = Number(
    (
      await una(
        bd,
        `select count(*) from academia.cohort_sessions where cohort_id = $1 and kind = 'clase' and recording_lesson_id is null
           and scheduled_at <= now() - interval '3 hours' and scheduled_at >= now() - interval '30 days'`,
        [gen.id]
      )
    ).count
  )
  afirmar(P, 'el número de Clases en la barra coincide con SQL', clasesEnSql === 0 ? null : String(clasesEnSql), insignia(clases, 'clases'))

  const formSubir = formulario(clases, 'name="clase"')
  afirmar(P, 'el formulario «Subir grabación» está', true, formSubir !== null)
  let r = await enviar('/admin/vaip/clases', { ...formSubir, clase: S1, fecha: '', titulo: '' }, cm)
  const R1 = destino(r)?.match(new RegExp(`/admin/vaip/clases/(${UUID})`))?.[1] ?? null
  afirmar(P, 'subir la de ayer lleva a su editor', true, Boolean(R1))
  const r1 = await una(
    bd,
    `select l.title, l.recorded_on::text as dia, l.status, m.kind, m.month::text as mes, m.title as nombre_mes
       from academia.lessons l join academia.modules m on m.id = l.module_id where l.id = $1`,
    [R1]
  )
  afirmar(P, 'queda en borrador, en el mes de la clase', `draft · mes · ${ayer.slice(0, 7)}-01`, `${r1?.status} · ${r1?.kind} · ${r1?.mes}`)
  afirmar(P, 'con el día de la clase', ayer, r1?.dia)
  afirmar(P, 'y el título de la clase', 'QA Contenido · clase de ayer', r1?.title)
  afirmar(P, 'el mes se llama como el mes', true, /^[A-ZÁÉÍÓÚ][a-záéíóú]+ \d{4}$/.test(r1?.nombre_mes ?? ''))
  afirmar(P, 'y se ligó sola a su clase', R1, (await una(bd, `select recording_lesson_id from academia.cohort_sessions where id = $1`, [S1]))?.recording_lesson_id)

  clases = await html('/admin/vaip/clases', cm)
  r = await enviar('/admin/vaip/clases', { ...formulario(clases, 'name="clase"'), clase: 'ninguna', fecha: haceDosMeses, titulo: 'QA Contenido · grabación sin clase' }, cm)
  const R2 = destino(r)?.match(new RegExp(`/admin/vaip/clases/(${UUID})`))?.[1] ?? null
  r = await enviar('/admin/vaip/clases', { ...formulario(clases, 'name="clase"'), clase: S2, fecha: '', titulo: '' }, cm)
  const R3 = destino(r)?.match(new RegExp(`/admin/vaip/clases/(${UUID})`))?.[1] ?? null
  const meses = await bd.query(`select month::text as mes from academia.modules where course_id = $1 and kind = 'mes' order by month`, [casa.id])
  afirmar(P, 'cada mes es su módulo, creado solo', `${haceDosMeses.slice(0, 7)}-01 ${haceUnMes.slice(0, 7)}-01 ${ayer.slice(0, 7)}-01`, meses.rows.map((m) => m.mes).join(' '))
  afirmar(P, 'una grabación sin clase no liga nada', 0, Number((await una(bd, `select count(*) from academia.cohort_sessions where recording_lesson_id = $1`, [R2])).count))
  afirmar(P, 'ya no queda clase pendiente: el número se apaga', null, insignia(await html('/admin/vaip/clases', cm), 'clases'))

  // El editor: cambiar el día la mueve de mes; el CM edita el título.
  let editor = await html(`/admin/vaip/clases/${R2}`, cm)
  afirmar(P, 'el CM abre el editor de la grabación', true, editor.includes('QA Contenido · grabación sin clase'))
  afirmar(P, 'sin «Eliminar» para el CM', false, editor.includes('Eliminar grabación'))
  const formDatos = formulario(editor, 'name="fecha"', 'name="titulo"')
  await enviar(`/admin/vaip/clases/${R2}`, { ...formDatos, titulo: 'QA Contenido · grabación movida', fecha: otroDia }, cm)
  const r2 = await una(
    bd,
    `select l.title, l.recorded_on::text as dia, m.month::text as mes from academia.lessons l join academia.modules m on m.id = l.module_id where l.id = $1`,
    [R2]
  )
  afirmar(P, 'cambiar el día la mueve de mes', `${otroDia} · ${ayer.slice(0, 7)}-01`, `${r2?.dia} · ${r2?.mes}`)
  afirmar(P, 'y el CM le cambió el título', 'QA Contenido · grabación movida', r2?.title)
  const mismoModulo = await una(bd, `select (select module_id from academia.lessons where id = $1) = (select module_id from academia.lessons where id = $2) as igual`, [R1, R2])
  afirmar(P, 'el mismo mes se reusa: queda junto a la de ayer', true, mismoModulo?.igual)
  afirmar(P, 'sin crear otro módulo', 3, Number((await una(bd, `select count(*) from academia.modules where course_id = $1 and kind = 'mes'`, [casa.id])).count))
  const listaDelPanel = await html('/admin/vaip/clases', cm)
  afirmar(P, 'el mes que quedó vacío no se pinta en el panel', false, listaDelPanel.includes(`data-mes="${haceDosMeses.slice(0, 7)}"`))
  afirmar(P, 'los que tienen grabaciones sí', true, listaDelPanel.includes(`data-mes="${ayer.slice(0, 7)}"`) && listaDelPanel.includes(`data-mes="${haceUnMes.slice(0, 7)}"`))

  // Publicar: sin video, no.
  editor = await html(`/admin/vaip/clases/${R1}`, cm)
  const sinVideo = await (await enviar(`/admin/vaip/clases/${R1}`, formulario(editor, 'name="publicar"'), cm)).text()
  afirmar(P, 'publicar sin video se rechaza con su motivo', true, sinVideo.includes('Sube el video antes de publicar.'))
  afirmar(P, 'y sigue en borrador', 'draft', (await una(bd, `select status from academia.lessons where id = $1`, [R1]))?.status)
  const porRest = await rest(jwtCm, 'PATCH', `lessons?id=eq.${R1}`, { status: 'published' })
  afirmar(P, 'la base también se niega (23514)', '23514', porRest.codigo)

  // Con video (la subida a Bunny no se prueba aquí: se simula el GUID).
  await bd.query(`update academia.lessons set bunny_video_id = 'qa-contenido-' || left(id::text, 8), video_duration_sec = 3600 where id = any($1)`, [[R1, R2, R3]])
  for (const id of [R1, R3]) {
    const pagina = await html(`/admin/vaip/clases/${id}`, cm)
    await enviar(`/admin/vaip/clases/${id}`, formulario(pagina, 'name="publicar"'), cm)
  }
  const publicadas = await bd.query(`select id, status, published_at is not null as sellada from academia.lessons where id = any($1)`, [[R1, R3]])
  afirmar(P, 'con video, el CM publica y se sella la fecha', 'published·true published·true', publicadas.rows.map((x) => `${x.status}·${x.sellada}`).join(' '))

  // Lo que el CM no puede.
  const tipo = await rest(jwtCm, 'PATCH', `lessons?id=eq.${R1}`, { lesson_type: 'text' })
  afirmar(P, 'el CM no cambia el tipo', false, tipo.ok)
  const deCurso = await una(bd, `select l.id, l.title from academia.lessons l join academia.modules m on m.id = l.module_id where m.course_id = $1 limit 1`, [CURSO_QA.id])
  if (deCurso) {
    const titulo = await rest(jwtCm, 'PATCH', `lessons?id=eq.${deCurso.id}`, { title: 'QA intruso' })
    afirmar(P, 'ni el título de una lección de curso', false, titulo.ok)
    afirmar(P, 'que sigue igual', deCurso.title, (await una(bd, `select title from academia.lessons where id = $1`, [deCurso.id]))?.title)
  }
  const borrar = await rest(jwtCm, 'DELETE', `lessons?id=eq.${R1}`)
  afirmar(P, 'un borrado del CM no afecta ninguna fila', 0, borrar.filas.length)
  afirmar(P, 'la grabación sigue ahí', 1, Number((await una(bd, `select count(*) from academia.lessons where id = $1`, [R1])).count))

  // --- 3. Panel → Herramientas: etiquetas, videos y portadas ---------------------------
  const H = 'Panel · Herramientas'
  let herramientas = await html('/admin/vaip/herramientas', cm)
  afirmar(H, 'el CM entra a Herramientas', true, herramientas.includes('Nueva herramienta'))
  for (const nombre of ['QA Ventas', 'QA RH']) {
    herramientas = await html('/admin/vaip/herramientas', cm)
    await enviar('/admin/vaip/herramientas', { ...formulario(herramientas, 'name="nombre"', 'Agregar etiqueta'), nombre }, cm)
  }
  const tags = Object.fromEntries((await bd.query(`select slug, id from academia.tool_tags where course_id = $1`, [casa.id])).rows.map((t) => [t.slug, t.id]))
  afirmar(H, 'el CM crea etiquetas', 'qa-rh qa-ventas', Object.keys(tags).sort().join(' '))

  const nueva = async (titulo, orientacion, etiquetas, nuevaEtiqueta = '') => {
    const pagina = await html('/admin/vaip/herramientas', cm)
    const campos = sinArreglo(formulario(pagina, 'name="orientacion"', 'name="nueva_etiqueta"'), 'etiqueta', 'orientacion')
    const res = await enviar('/admin/vaip/herramientas', { ...campos, titulo, orientacion, etiqueta: etiquetas, nueva_etiqueta: nuevaEtiqueta }, cm)
    return destino(res)?.match(new RegExp(`/admin/vaip/herramientas/(${UUID})`))?.[1] ?? null
  }
  const A = await nueva('QA Contenido · herramienta vertical', 'vertical', [tags['qa-rh']], 'QA Finanzas')
  const B2 = await nueva('QA Contenido · herramienta horizontal', 'horizontal', [tags['qa-ventas']])
  const C = await nueva('QA Contenido · otra de RH', 'vertical', [tags['qa-rh']])
  afirmar(H, 'crear una herramienta lleva a su editor', true, Boolean(A && B2 && C))
  const a = await una(
    bd,
    `select l.orientation, l.status, l.cover_path, m.kind,
            (select string_agg(t.slug, ' ' order by t.slug) from academia.lesson_tool_tags x join academia.tool_tags t on t.id = x.tag_id where x.lesson_id = l.id) as etiquetas
       from academia.lessons l join academia.modules m on m.id = l.module_id where l.id = $1`,
    [A]
  )
  afirmar(H, 'queda en borrador, vertical, en «herramientas»', 'draft · vertical · herramientas', `${a?.status} · ${a?.orientation} · ${a?.kind}`)
  afirmar(H, 'con su etiqueta y la nueva que se escribió ahí', 'qa-finanzas qa-rh', a?.etiquetas)
  afirmar(H, 'la portada se guarda en su carpeta', true, new RegExp(`^vaip/herramientas/${casa.id}/${A}-[0-9a-f]{10}\\.png$`).test(a?.cover_path ?? ''))
  const png = await fetch(urlPublica(a?.cover_path ?? 'nada'))
  afirmar(H, 'y responde como PNG de 720×960', '200 · 720×960', `${png.status} · ${png.ok ? medidasPng(new Uint8Array(await png.arrayBuffer())) : '-'}`)

  // Una herramienta no lleva fecha; una grabación no lleva etiquetas.
  const etiquetarGrabacion = await rest(jwtCm, 'POST', 'lesson_tool_tags', { lesson_id: R1, tag_id: tags['qa-rh'] })
  afirmar(H, 'una grabación no se etiqueta', '23514', etiquetarGrabacion.codigo)

  // Renombrar redibuja: ruta nueva y la vieja desaparece.
  editor = await html(`/admin/vaip/herramientas/${A}`, cm)
  const formH = formulario(editor, 'name="orientacion"', 'name="id"')
  const actuales = (await bd.query(`select tag_id from academia.lesson_tool_tags where lesson_id = $1`, [A])).rows.map((x) => x.tag_id)
  await enviar(`/admin/vaip/herramientas/${A}`, { ...sinArreglo(formH, 'etiqueta', 'orientacion'), titulo: 'QA Contenido · herramienta vertical renombrada', orientacion: 'vertical', etiqueta: actuales, nueva_etiqueta: '' }, cm)
  const a2 = await una(bd, `select title, cover_path from academia.lessons where id = $1`, [A])
  afirmar(H, 'renombrar cambia el título', 'QA Contenido · herramienta vertical renombrada', a2?.title)
  afirmar(H, 'y dibuja otra portada', true, Boolean(a2?.cover_path && a2.cover_path !== a?.cover_path))
  afirmar(H, 'la portada vieja ya no existe', false, (await fetch(urlPublica(a?.cover_path ?? 'nada'))).ok)

  // Publicar las tres (con video simulado), en orden: A, luego B, luego C.
  await bd.query(`update academia.lessons set bunny_video_id = 'qa-contenido-' || left(id::text, 8), video_duration_sec = 45 where id = any($1)`, [[A, B2, C]])
  for (const id of [A, B2, C]) {
    const pagina = await html(`/admin/vaip/herramientas/${id}`, cm)
    await enviar(`/admin/vaip/herramientas/${id}`, formulario(pagina, 'name="publicar"'), cm)
    await new Promise((listo) => setTimeout(listo, 1100))
  }
  afirmar(H, 'el CM las publica', 3, Number((await una(bd, `select count(*) from academia.lessons where id = any($1) and status = 'published'`, [[A, B2, C]])).count))

  // --- 4. El portal del miembro ------------------------------------------------------
  const M = 'Portal del miembro'
  const portal = await html('/vaip/clases', miembro)
  afirmar(M, '/vaip/clases trae «Clases grabadas»', true, portal.includes('Clases grabadas'))
  afirmar(M, 'con la grabación de ayer', true, portal.includes(`data-grabacion="${R1}"`))
  afirmar(M, 'y la del mes pasado', true, portal.includes(`data-grabacion="${R3}"`))
  afirmar(M, 'un borrador no se ve', false, portal.includes(`data-grabacion="${R2}"`))
  afirmar(M, 'ni el índice de un curso', false, portal.includes('Grabaciones y material'))

  const pagR1 = await html(`/vaip/clases/${R1}`, miembro)
  afirmar(M, 'la grabación abre en /vaip/clases/<id>', true, pagR1.includes('QA Contenido · clase de ayer'))
  afirmar(M, 'con el reproductor horizontal', true, pagR1.includes('data-orientacion="horizontal"'))
  afirmar(M, 'con la clase anterior por fecha', true, pagR1.includes(`href="/vaip/clases/${R3}"`) && pagR1.includes('Clase anterior'))
  afirmar(M, 'sin barra de avance de curso', false, pagR1.includes('Tu avance'))
  afirmar(M, 'en el menú se enciende V-AI-P', true, activaEnMenu(pagR1, '/vaip'))
  afirmar(M, 'y no «Mis cursos»', false, activaEnMenu(pagR1, '/cursos'))
  afirmar(M, 'un borrador por URL regresa a Clases', '/vaip/clases', destino(await pedir(`/vaip/clases/${R2}`, miembro)))
  afirmar(M, '/curso/<casa>/<grabación> manda a su página', `/vaip/clases/${R1}`, destino(await pedir(`/curso/${CASA}/${R1}`, miembro)))
  afirmar(M, '/curso/<casa>/<herramienta> también', `/vaip/herramientas/${A}`, destino(await pedir(`/curso/${CASA}/${A}`, miembro)))

  // Quien no es miembro, o ya no lo es, vuelve a /vaip.
  afirmar(M, 'quien no es miembro vuelve a /vaip', '/vaip', destino(await pedir(`/vaip/clases/${R1}`, vencido)))
  await bd.query(
    `insert into academia.memberships (plan_id, user_id, email, stripe_customer_id, stripe_subscription_id, status, current_period_start, current_period_end, access_until)
     values ($1, $2, $3, 'cus_qacontenido', $4, 'canceled', now() - interval '40 days', now() - interval '10 days', now() - interval '8 days')`,
    [plan.id, vencidoId, CORREO_VENCIDO, `${SUB}2`]
  )
  await bd.query(
    `insert into academia.enrollments (user_id, course_id, cohort_id, source, status, expires_at) values ($1, $2, $3, 'membresia', 'active', now() - interval '8 days')`,
    [vencidoId, casa.id, gen.id]
  )
  afirmar(M, 'con la membresía vencida, también', '/vaip', destino(await pedir(`/vaip/herramientas/${A}`, vencido)))
  afirmar(M, 'y la lista de clases igual', '/vaip', destino(await pedir('/vaip/clases', vencido)))

  // Herramientas: etiquetas, galería y el reel.
  const galeria = await html('/vaip/herramientas', miembro)
  afirmar(M, 'la galería trae las tres', true, [A, B2, C].every((id) => galeria.includes(`data-herramienta="${id}"`)))
  afirmar(M, 'con las etiquetas como filtro', true, galeria.includes('href="/vaip/herramientas?etiqueta=qa-rh"'))
  const deRh = await html('/vaip/herramientas?etiqueta=qa-rh', miembro)
  afirmar(M, 'filtrar por RH deja las dos de RH', 'true true false', [A, C, B2].map((id) => deRh.includes(`data-herramienta="${id}"`)).join(' '))
  const reel = await html(`/vaip/herramientas/${C}?etiqueta=qa-rh`, miembro)
  afirmar(M, 'el reel vertical lleva su reproductor vertical', true, reel.includes('data-orientacion="vertical"'))
  afirmar(M, '«Siguiente» se queda en RH', true, reel.includes(`href="/vaip/herramientas/${A}?etiqueta=qa-rh"`))
  afirmar(M, 'y dice cuántas son', true, /1(?:<!-- -->)? de (?:<!-- -->)?2/.test(reel))
  const horizontal = await html(`/vaip/herramientas/${B2}`, miembro)
  afirmar(M, 'una horizontal lleva su reproductor horizontal', true, horizontal.includes('data-orientacion="horizontal"'))

  // «Lo nuevo» arriba del muro.
  const muro = await html('/vaip', miembro)
  afirmar(M, '«Lo nuevo» sale arriba del muro', true, muro.includes('data-lo-nuevo'))
  afirmar(M, 'con la última grabación', true, muro.includes(`data-nueva-grabacion="${R1}"`))
  afirmar(M, 'y las herramientas de la semana', true, [A, B2, C].every((id) => muro.includes(`data-nueva-herramienta="${id}"`)))
  afirmar(M, 'la casa no sale en Mis cursos', false, (await html('/cursos', miembro)).includes(CASA))

  // --- 5. Puntos ----------------------------------------------------------------------
  const X = 'Puntos'
  for (const leccion of [R1, A]) {
    await rest(jwtMiembro, 'POST', 'lesson_progress?on_conflict=user_id,lesson_id', { user_id: miembroId, lesson_id: leccion, completed: true, completed_at: new Date().toISOString() })
  }
  const comentario = await rest(jwtMiembro, 'POST', 'lesson_comments', { lesson_id: A, user_id: miembroId, content: 'QA Contenido · ¿esto sirve para nómina?' })
  // La vista se lee con la sesión del miembro: con la conexión directa no trae filas (no hay auth.uid()).
  const fila = (await rest(jwtMiembro, 'GET', `actividad_por_curso?select=*&user_id=eq.${miembroId}&course_id=eq.${casa.id}`)).filas[0] ?? null
  afirmar(X, 'la vista cuenta la grabación y la herramienta aparte', 'lecciones 0 · grabaciones 1 · herramientas 1', `lecciones ${fila?.lecciones} · grabaciones ${fila?.grabaciones} · herramientas ${fila?.herramientas}`)
  afirmar(X, 'una grabación vale 5 y una herramienta 3 (una lección sigue en 10)', '5 3 10', `${PUNTOS.grabacion} ${PUNTOS.herramienta} ${PUNTOS.leccion}`)
  const esperados = puntosDe(actividadDeFila(fila))
  const ranking = await html('/vaip/ranking', miembro)
  const enRanking = ranking.match(new RegExp(`href="/vaip/miembros/${miembroId}"[\\s\\S]*?Nivel[\\s\\S]{0,24}?</span><span[^>]*>(\\d+)</span>`))?.[1]
  afirmar(X, `el ranking de V-AI-P le da ${esperados} puntos`, String(esperados), enRanking ?? null)
  const misPuntos = await html('/perfil/puntos', miembro)
  afirmar(X, 'Mi perfil → Puntos explica las dos', true, misPuntos.includes('Clases grabadas vistas en V-AI-P') && misPuntos.includes('Herramientas vistas en V-AI-P'))

  // --- 6. Comentarios: se atienden en el Muro del panel --------------------------------
  const K = 'Comentarios'
  const cid = comentario.filas[0]?.id
  afirmar(K, 'el miembro comenta la herramienta', true, Boolean(cid))
  let muroPanel = await html('/admin/vaip/muro', admin)
  afirmar(K, 'sale en el Muro del panel con liga a /vaip', true, muroPanel.includes(`href="/vaip/herramientas/${A}#comentario-${cid}"`))
  afirmar(K, 'y no en Grupos', false, (await html('/admin/grupos', admin)).includes(`#comentario-${cid}`))
  const antes = Number(insignia(muroPanel, 'muro') ?? '0')
  afirmar(K, 'el número del Muro lo cuenta', true, antes >= 1)
  await rest(jwtCm, 'POST', 'lesson_comments', { lesson_id: A, user_id: cmId, parent_id: cid, content: 'QA Contenido · sí, para la nómina también.' })
  muroPanel = await html('/admin/vaip/muro', admin)
  afirmar(K, 'al contestar, baja uno', antes - 1, Number(insignia(muroPanel, 'muro') ?? '0'))

  // --- 7. Los números de la barra ------------------------------------------------------
  const N = 'Números de la barra'
  const panelCm = await html('/admin/vaip/herramientas', cm)
  afirmar(N, 'el CM no tiene el de Planes y cobros', false, panelCm.includes('data-insignia="planes"'))
  afirmar(N, 'en 0 no se pinta (Clases ya no tiene pendientes)', null, insignia(panelCm, 'clases'))
  afirmar(N, 'lo que se pinta dice «por atender» al lector de pantalla', true, !/data-insignia="/.test(panelCm) || panelCm.includes('por atender'))

  // --- 8. Borrar es de admin ------------------------------------------------------------
  const E = 'Eliminar'
  const editorAdmin = await html(`/admin/vaip/clases/${R2}`, admin)
  afirmar(E, 'el admin ve «Eliminar grabación»', true, editorAdmin.includes('Eliminar grabación'))
  r = await enviar(`/admin/vaip/clases/${R2}`, formulario(editorAdmin, 'Sí, eliminar'), admin)
  afirmar(E, 'y al confirmar regresa a Clases', '/admin/vaip/clases', destino(r))
  afirmar(E, 'la grabación ya no existe', 0, Number((await una(bd, `select count(*) from academia.lessons where id = $1`, [R2])).count))

  verde = imprimir()
  if (CONSERVAR) {
    console.log('  --conservar: los datos se quedan. Para las capturas (pnpm capturas -- --solo=contenido…):')
    console.log(`    panel:   /admin/vaip/clases/${R1},/admin/vaip/herramientas/${A}`)
    console.log(`    miembro: /vaip/clases/${R1},/vaip/herramientas/${C}?etiqueta=qa-rh,/vaip/herramientas/${B2}\n`)
  }
} catch (error) {
  imprimir()
  console.error('\n  La prueba se cayó:', error)
} finally {
  if (!CONSERVAR) await purgar(bd).catch((e) => console.error('  Limpieza incompleta:', e.message))
  await bd.end()
  process.exitCode = verde ? 0 : 1
}
