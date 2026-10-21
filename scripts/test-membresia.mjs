#!/usr/bin/env node
/**
 * test-membresia.mjs — Criterio de cierre de M17, fases 1 y 2 (VADAI V-AI-P).
 *
 * Como test-stripe.mjs: firma eventos sintéticos con el `whsec_` real y los manda
 * al endpoint, sin mover un peso. Cubre lo que un pago feliz nunca ejerce:
 * eventos fuera de orden, reenviados, atrasados, de otros negocios de la misma
 * cuenta, un evento que falla y se tiene que poder reintentar, y la regla de
 * que una membresía nunca acorta un curso comprado aparte.
 *
 * Todo se verifica en Postgres, no en la pantalla. Usa el plan REAL `v-ai-p`
 * (es el que leen /vaip y /perfil) con cursos QA colgados de él: las cuentas
 * reales nunca los reciben (`esCursoQa`). Lo suyo lo borra por marca exacta: los
 * cursos `qa-vaip-*`, las suscripciones `sub_qavaip_*`, las facturas
 * `in_qavaip_*` y los eventos `evt_qavaip_*`. Al plan real no le toca nada.
 *
 * Fase 2 (el espacio de miembros): temas del muro con su RLS y su trigger,
 * ranking y logros en /vaip, el perfil de miembro (la casa real solo se toca
 * dentro de una transacción que se revierte) y la serie quincenal del panel
 * con su anuncio y su correo, que a una cuenta qa-* nunca sale.
 *
 *   PORT=3117 pnpm start
 *   node scripts/test-membresia.mjs
 *
 * Para fotografiar el espacio de miembro (pnpm capturas -- --solo=vaip):
 *   node scripts/test-membresia.mjs --conservar   # corre y deja el escenario armado
 *   node scripts/test-membresia.mjs --limpiar     # lo borra, sin correr nada
 */

import { createHmac } from 'node:crypto'

import { cargarEnv, conectarPostgres, exigir } from './lib/entorno.mjs'

const vars = cargarEnv()
const SUPABASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')
const SECRETO = exigir(vars, 'STRIPE_WEBHOOK_SECRET')
const APP = (process.env.APP_URL ?? 'http://localhost:3117').replace(/\/+$/, '')
const RUTA = '/api/stripe/webhook'

const PLAN = 'v-ai-p'
const PRECIO = 'price_qa_vaip_test'
const CORREO = 'qa-vaip1@academia.vadai.com.mx'
const CORREO_VITALICIO = 'qa-alumno1@academia.vadai.com.mx'
const CORREO_CM = 'qa-cm@academia.vadai.com.mx'
const CORREO_ADMIN = 'qa-admin@academia.vadai.com.mx'
const DIA = 24 * 60 * 60
const CONSERVAR = process.argv.includes('--conservar')
const SOLO_LIMPIAR = process.argv.includes('--limpiar')

// --- firma y envío ------------------------------------------------------------

function firmar(cuerpo) {
  const epoch = Math.floor(Date.now() / 1000)
  return `t=${epoch},v1=${createHmac('sha256', SECRETO).update(`${epoch}.${cuerpo}`).digest('hex')}`
}

let contador = 0
const ahora = () => Math.floor(Date.now() / 1000)
function evento(tipo, objeto, creado = ahora()) {
  contador += 1
  return {
    id: `evt_qavaip_${Date.now()}_${contador}`,
    object: 'event',
    type: tipo,
    api_version: '2026-07-29.dahlia',
    created: creado,
    data: { object: objeto },
  }
}

async function enviar(cuerpoObjeto) {
  const cuerpo = JSON.stringify(cuerpoObjeto)
  const r = await fetch(`${APP}${RUTA}`, {
    method: 'POST',
    headers: { 'stripe-signature': firmar(cuerpo), 'content-type': 'application/json' },
    body: cuerpo,
  })
  return { status: r.status, cuerpo: await r.json().catch(() => ({})) }
}

// --- payloads (forma dahlia: periodo en los items, factura por `parent`) -----

function suscripcion({ id, status = 'active', inicio, fin, cancelaAlFinal = false, terminada = null, marca = PLAN, precio = PRECIO }) {
  return {
    id,
    object: 'subscription',
    status,
    customer: `cus_${id}`,
    cancel_at_period_end: cancelaAlFinal,
    ended_at: terminada,
    metadata: marca ? { academia_plan: marca } : {},
    items: {
      object: 'list',
      data: [{ id: `si_${id}`, object: 'subscription_item', current_period_start: inicio, current_period_end: fin, price: { id: precio, object: 'price' } }],
    },
  }
}

function checkout({ id, sub, email, referencia = null, marca = PLAN }) {
  return {
    id,
    object: 'checkout.session',
    mode: 'subscription',
    payment_status: 'paid',
    subscription: sub,
    customer: `cus_${sub}`,
    customer_details: { email, name: 'QA V-AI-P' },
    customer_email: email,
    client_reference_id: referencia,
    metadata: marca ? { academia_plan: marca } : {},
  }
}

function factura({ id, sub, email, inicio, fin }) {
  return {
    id,
    object: 'invoice',
    customer: `cus_${sub}`,
    customer_email: email,
    customer_name: 'QA V-AI-P',
    amount_paid: 34900,
    amount_due: 34900,
    currency: 'mxn',
    parent: { type: 'subscription_details', subscription_details: { subscription: sub, metadata: { academia_plan: PLAN } } },
    lines: { object: 'list', data: [{ id: `il_${id}`, period: { start: inicio, end: fin }, pricing: { price_details: { price: PRECIO } } }] },
  }
}

// --- sesión (para las pantallas) -----------------------------------------------

function crearFrasco() {
  const cookies = new Map()
  return {
    guardar(respuesta) {
      for (const cruda of respuesta.headers.getSetCookie?.() ?? []) {
        const [par] = cruda.split(';')
        const i = par.indexOf('=')
        if (i === -1) continue
        const nombre = par.slice(0, i).trim()
        const valor = par.slice(i + 1).trim()
        if (valor === '' || /Max-Age=0/i.test(cruda)) cookies.delete(nombre)
        else cookies.set(nombre, valor)
      }
    },
    encabezado: () => [...cookies.entries()].map(([n, v]) => `${n}=${v}`).join('; '),
    get tamano() {
      return cookies.size
    },
  }
}

async function entrar(email) {
  const enlace = await fetch(`${SUPABASE}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'recovery', email }),
  })
  const cuerpo = await enlace.json()
  const hash = cuerpo.hashed_token ?? cuerpo.properties?.hashed_token
  if (!hash) throw new Error(`No se pudo generar enlace para ${email}.`)
  const frasco = crearFrasco()
  frasco.guardar(await fetch(`${APP}/auth/confirmar?token_hash=${encodeURIComponent(hash)}&type=recovery`, { redirect: 'manual' }))
  return frasco
}

const pedir = (ruta, frasco, opciones = {}) =>
  fetch(`${APP}${ruta}`, {
    redirect: 'manual',
    ...opciones,
    headers: frasco?.tamano ? { cookie: frasco.encabezado() } : {},
  })

/**
 * Los formularios de una página con su acción de servidor (mejora progresiva),
 * como en test-cohortes: los `$ACTION_*` se copian tal cual y el servidor los
 * interpreta. Se elige el formulario por un campo que solo él tiene.
 */
function formularioCon(html, campo) {
  for (const bloque of html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)) {
    if (!bloque[1].includes(`name="${campo}"`)) continue
    const campos = {}
    for (const etiqueta of bloque[1].matchAll(/<(?:input|select|textarea)\b[^>]*>/g)) {
      const nombre = etiqueta[0].match(/name="([^"]*)"/)?.[1]
      if (!nombre) continue
      // Como un navegador: una casilla sin marcar no se envía.
      const tipo = etiqueta[0].match(/type="([^"]*)"/)?.[1]
      if ((tipo === 'checkbox' || tipo === 'radio') && !/\schecked/.test(etiqueta[0])) continue
      campos[nombre] = (etiqueta[0].match(/value="([^"]*)"/)?.[1] ?? '')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&amp;/g, '&')
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

/** Una consulta con la sesión de alguien (RLS), dentro de una transacción que se revierte. */
async function comoUsuario(bd, userId, sql, params = []) {
  await bd.query('begin')
  try {
    await bd.query(`set local role authenticated`)
    await bd.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: userId, role: 'authenticated' })])
    const { rows } = await bd.query(sql, params)
    return { filas: rows, error: null }
  } catch (error) {
    return { filas: [], error: error.code ?? error.message }
  } finally {
    await bd.query('rollback')
  }
}

/** Si un logro sale ganado o pendiente en el HTML (el texto oculto de cada tarjeta). */
const estadoDeLogro = (html, nombre) =>
  html.match(new RegExp(`${nombre}</span>[\\s\\S]*?<span class="sr-only">(Ganado|Pendiente)</span>`))?.[1] ?? 'no aparece'

const fechaCdmx = (epoch) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date(epoch * 1000))

// --- reporte --------------------------------------------------------------------

const resultados = []
const afirmar = (grupo, descripcion, esperado, real) =>
  resultados.push({ grupo, descripcion, esperado, real, ok: esperado === real })

function imprimir() {
  const porGrupo = new Map()
  for (const r of resultados) porGrupo.set(r.grupo, [...(porGrupo.get(r.grupo) ?? []), r])
  const ancho = Math.max(...resultados.map((r) => r.descripcion.length))
  console.log('\n  PRUEBA DE MEMBRESÍA — M17 · fases 1 y 2')
  console.log(`  App: ${APP}`)
  for (const [grupo, casos] of porGrupo) {
    console.log(`\n  ${grupo}\n  ${'─'.repeat(ancho + 30)}`)
    for (const c of casos) {
      console.log(`  ${c.ok ? '✓' : '✗'}  ${c.descripcion.padEnd(ancho)}  ${c.ok ? String(c.real) : `esperado ${c.esperado}, obtuvo ${c.real}`}`)
    }
  }
  const fallidas = resultados.filter((r) => !r.ok)
  console.log(`\n  ${'─'.repeat(ancho + 30)}`)
  console.log(
    fallidas.length === 0
      ? `  M17 (fases 1 y 2) EN VERDE — ${resultados.length}/${resultados.length} aserciones pasaron.`
      : `  ${fallidas.length} de ${resultados.length} aserciones FALLARON.`
  )
  for (const f of fallidas) console.log(`    ${f.grupo} · ${f.descripcion}: esperado ${f.esperado}, obtuvo ${f.real}`)
  console.log('')
  return fallidas.length === 0
}

// --- siembra y limpieza -----------------------------------------------------------

/**
 * Lo que el alta le deja a una cuenta QA FUERA de los cursos de la suite: los
 * cursos base reales ("Academia VADAI") inscriben a todo alumno que se da de
 * alta, también a uno QA. Se anota qué tenía al empezar y al final se quita
 * solo lo que apareció durante la corrida.
 */
async function inscripcionesDe(bd, email) {
  const { rows } = await bd.query(
    `select e.course_id from academia.enrollments e join academia.profiles p on p.user_id = e.user_id where lower(p.email) = $1`,
    [email]
  )
  return rows.map((r) => r.course_id)
}

async function quitarLoNuevo(bd, email, previas) {
  await bd.query(
    `delete from academia.enrollments e using academia.profiles p
      where p.user_id = e.user_id and lower(p.email) = $1 and not (e.course_id = any($2::uuid[]))`,
    [email, previas]
  )
}

/** La cuenta que crea el alta de la suite. Solo esa, por correo exacto. */
async function borrarCuentaDeLaSuite(bd) {
  const fila = await una(bd, `select user_id from academia.profiles where lower(email) = $1`, [CORREO])
  if (!fila) return
  await bd.query(`delete from academia.enrollments where user_id = $1`, [fila.user_id])
  await fetch(`${SUPABASE}/auth/v1/admin/users/${fila.user_id}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  })
  await bd.query(`delete from academia.profiles where user_id = $1`, [fila.user_id])
}

async function purgar(bd) {
  const deLaSuite = `(select id from academia.courses where slug like 'qa-vaip-%')`
  await bd.query(`delete from academia.posts where audience_course_id in ${deLaSuite}`)
  await bd.query(`delete from academia.community_posts where course_id in ${deLaSuite}`)
  await bd.query(`delete from academia.community_topics where course_id in ${deLaSuite}`)
  await bd.query(`delete from academia.cohort_sessions where cohort_id in (select id from academia.cohorts where course_id in ${deLaSuite})`)
  await bd.query(
    `delete from academia.enrollments where course_id in (select id from academia.courses where slug like 'qa-vaip-%')`
  )
  await bd.query(`delete from academia.membership_invoices where stripe_invoice_id like 'in_qavaip_%'`)
  await bd.query(`delete from academia.membership_cancellations where stripe_subscription_id like 'sub_qavaip_%'`)
  await bd.query(`delete from academia.memberships where stripe_subscription_id like 'sub_qavaip_%'`)
  await bd.query(`delete from academia.cohorts where course_id in (select id from academia.courses where slug like 'qa-vaip-%')`)
  await bd.query(`delete from academia.courses where slug like 'qa-vaip-%'`)
  await bd.query(`delete from academia.stripe_events where event_id like 'evt_qavaip_%'`)
}

async function sembrar(bd) {
  const plan = await una(bd, `select id from academia.membership_plans where slug = $1`, [PLAN])
  if (!plan) throw new Error('No existe el plan v-ai-p: aplica la migración academia_0040_membresia.')
  // M18: qué cursos da un plan vive en membership_plan_courses.
  const curso = async (slug, tipo) => {
    const id = (
      await bd.query(
        `insert into academia.courses (slug, title, course_type, status, certificate_enabled)
         values ($1, $2, $3, 'published', false) returning id`,
        [slug, `QA · ${slug} (test-membresia)`, tipo]
      )
    ).rows[0].id
    await bd.query(`insert into academia.membership_plan_courses (plan_id, course_id) values ($1, $2)`, [plan.id, id])
    return id
  }
  const casa = await curso('qa-vaip-casa', 'cohort')
  const extra = await curso('qa-vaip-extra', 'evergreen')
  const vitalicio = await curso('qa-vaip-vitalicio', 'evergreen')
  const { rows: [gen] } = await bd.query(
    `insert into academia.cohorts (course_id, name, starts_on, ends_on, open_for_enrollment)
     values ($1, 'Miembros', current_date, null, true) returning id`,
    [casa]
  )
  return { plan: plan.id, casa, extra, vitalicio, gen: gen.id }
}

// --- consultas --------------------------------------------------------------------

const una = async (bd, sql, params = []) => (await bd.query(sql, params)).rows[0] ?? null
const membresia = (bd, sub) =>
  una(bd, `select user_id, status, access_until, cancel_at_period_end, last_event_at from academia.memberships where stripe_subscription_id = $1`, [sub])
const inscripcion = (bd, email, curso) =>
  una(
    bd,
    `select e.source, e.status, e.expires_at, e.cohort_id from academia.enrollments e
       join academia.profiles p on p.user_id = e.user_id
      where lower(p.email) = $1 and e.course_id = $2`,
    [email, curso]
  )
const segundos = (iso) => (iso ? Math.round(new Date(iso).getTime() / 1000) : null)

/** Lo que una persona ve de `memberships` con su propia sesión (RLS). */
async function verComo(bd, userId) {
  await bd.query('begin')
  try {
    await bd.query(`set local role authenticated`)
    await bd.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: userId, role: 'authenticated' })])
    const { rows } = await bd.query(`select count(*)::int as n from academia.memberships where stripe_subscription_id like 'sub_qavaip_%'`)
    const { rows: cobros } = await bd.query(`select count(*)::int as n from academia.membership_invoices where stripe_invoice_id like 'in_qavaip_%'`)
    return { membresias: rows[0].n, cobros: cobros[0].n }
  } finally {
    await bd.query('rollback')
  }
}

// --- la prueba ----------------------------------------------------------------------

const bd = await conectarPostgres(vars)
let verde = false
let previasVitalicio = null
/** El nombre de qa-alumno1 al empezar: si algo falla a medias, se le regresa. */
let nombreOriginal = null
if (SOLO_LIMPIAR) {
  await purgar(bd)
  await borrarCuentaDeLaSuite(bd)
  await bd.end()
  console.log('\n  Escenario de test-membresia borrado.\n')
  process.exit(0)
}
try {
  await purgar(bd)
  await borrarCuentaDeLaSuite(bd)
  previasVitalicio = await inscripcionesDe(bd, CORREO_VITALICIO)
  const ids = await sembrar(bd)
  const t0 = ahora()
  const inicio = t0 - DIA
  const fin = t0 + 29 * DIA

  // 1. Fuera de orden: la suscripción llega antes que el checkout.
  let r = await enviar(evento('customer.subscription.created', suscripcion({ id: 'sub_qavaip_1', inicio, fin }), t0))
  afirmar('Alta', 'subscription.created responde 200', 200, r.status)
  let m = await membresia(bd, 'sub_qavaip_1')
  afirmar('Alta', 'la suscripción queda guardada sin persona todavía', 'null', String(m?.user_id ?? null))
  afirmar('Alta', 'acceso = fin del periodo + 2 días', fin + 2 * DIA, segundos(m?.access_until))

  const evCheckout = evento('checkout.session.completed', checkout({ id: 'cs_qavaip_1', sub: 'sub_qavaip_1', email: CORREO }), t0 + 1)
  r = await enviar(evCheckout)
  afirmar('Alta', 'checkout de suscripción responde 200', 200, r.status)
  m = await membresia(bd, 'sub_qavaip_1')
  afirmar('Alta', 'el checkout enlaza a la persona', true, Boolean(m?.user_id))
  afirmar('Alta', 'el estado no se pierde con el checkout', 'active', m?.status)
  let casa = await inscripcion(bd, CORREO, ids.casa)
  afirmar('Alta', 'inscrito en la casa con source membresia', 'membresia', casa?.source)
  afirmar('Alta', 'en la generación abierta de la casa', ids.gen, casa?.cohort_id)
  afirmar('Alta', 'la casa vence con la membresía', fin + 2 * DIA, segundos(casa?.expires_at))
  const extra = await inscripcion(bd, CORREO, ids.extra)
  afirmar('Alta', 'también recibe el otro curso del plan', 'membresia', extra?.source)

  // 2. Reenvío: no duplica.
  r = await enviar(evCheckout)
  afirmar('Alta', 'el reenvío se reconoce como duplicado', true, r.cuerpo?.duplicado === true)
  const { rows: [{ n: filas }] } = await bd.query(
    `select count(*)::int as n from academia.memberships where stripe_subscription_id = 'sub_qavaip_1'`
  )
  afirmar('Alta', 'una sola fila por suscripción', 1, filas)

  // 3. El cobro queda en la bitácora.
  r = await enviar(evento('invoice.paid', factura({ id: 'in_qavaip_1', sub: 'sub_qavaip_1', email: CORREO, inicio, fin }), t0 + 2))
  const cobro = await una(bd, `select status, amount::float as monto from academia.membership_invoices where stripe_invoice_id = 'in_qavaip_1'`)
  afirmar('Cobros', 'invoice.paid queda registrado', 'paid', cobro?.status)
  afirmar('Cobros', 'por el monto en pesos', 349, cobro?.monto)

  // 4. Renovación: el periodo avanza y el acceso con él.
  const fin2 = fin + 30 * DIA
  await enviar(evento('customer.subscription.updated', suscripcion({ id: 'sub_qavaip_1', inicio: fin, fin: fin2 }), t0 + 10))
  m = await membresia(bd, 'sub_qavaip_1')
  afirmar('Ciclo', 'la renovación alarga el acceso', fin2 + 2 * DIA, segundos(m?.access_until))
  casa = await inscripcion(bd, CORREO, ids.casa)
  afirmar('Ciclo', 'y la inscripción con él', fin2 + 2 * DIA, segundos(casa?.expires_at))

  // 5. Un evento viejo que llega tarde no regresa el estado.
  await enviar(evento('customer.subscription.updated', suscripcion({ id: 'sub_qavaip_1', status: 'canceled', inicio, fin, terminada: t0 }), t0 + 5))
  m = await membresia(bd, 'sub_qavaip_1')
  afirmar('Ciclo', 'un evento atrasado se ignora', 'active', m?.status)

  // 6. Cancela al fin del periodo: conserva lo pagado.
  await enviar(evento('customer.subscription.updated', suscripcion({ id: 'sub_qavaip_1', inicio: fin, fin: fin2, cancelaAlFinal: true }), t0 + 20))
  m = await membresia(bd, 'sub_qavaip_1')
  afirmar('Ciclo', 'cancelar al final queda marcado', true, m?.cancel_at_period_end)
  afirmar('Ciclo', 'y conserva el acceso pagado', fin2 + 2 * DIA, segundos(m?.access_until))

  // 7. Pago atrasado: gracia corta desde que empezó el periodo.
  const inicio3 = t0
  await enviar(evento('customer.subscription.updated', suscripcion({ id: 'sub_qavaip_1', status: 'past_due', inicio: inicio3, fin: inicio3 + 30 * DIA }), t0 + 30))
  m = await membresia(bd, 'sub_qavaip_1')
  afirmar('Ciclo', 'past_due da 5 días desde el inicio del periodo', inicio3 + 5 * DIA, segundos(m?.access_until))
  casa = await inscripcion(bd, CORREO, ids.casa)
  afirmar('Ciclo', 'y la inscripción se acorta a esa gracia', inicio3 + 5 * DIA, segundos(casa?.expires_at))

  // 8. Termina: estructura sí, contenido no.
  await enviar(evento('customer.subscription.deleted', suscripcion({ id: 'sub_qavaip_1', status: 'canceled', inicio: inicio3, fin: inicio3 + 30 * DIA, terminada: t0 - 60 }), t0 + 40))
  casa = await inscripcion(bd, CORREO, ids.casa)
  afirmar('Ciclo', 'al terminar la inscripción sigue (estructura)', 'active', casa?.status)
  afirmar('Ciclo', 'pero ya venció (contenido no)', true, casa?.expires_at !== null && new Date(casa.expires_at) < new Date())

  // 9. Vuelve con otra suscripción: recupera el acceso.
  await enviar(evento('customer.subscription.created', suscripcion({ id: 'sub_qavaip_2', inicio: t0, fin: t0 + 30 * DIA }), t0 + 50))
  await enviar(evento('checkout.session.completed', checkout({ id: 'cs_qavaip_2', sub: 'sub_qavaip_2', email: CORREO }), t0 + 51))
  casa = await inscripcion(bd, CORREO, ids.casa)
  afirmar('Ciclo', 'resuscribirse devuelve el acceso', t0 + 32 * DIA, segundos(casa?.expires_at))

  // 10. Un curso nuevo en el plan llega con el siguiente evento.
  const { rows: [{ id: nuevo }] } = await bd.query(
    `insert into academia.courses (slug, title, course_type, status, certificate_enabled)
     values ('qa-vaip-nuevo', 'QA · qa-vaip-nuevo (test-membresia)', 'evergreen', 'published', false) returning id`
  )
  await bd.query(`insert into academia.membership_plan_courses (plan_id, course_id) values ($1, $2)`, [ids.plan, nuevo])
  await enviar(evento('customer.subscription.updated', suscripcion({ id: 'sub_qavaip_2', inicio: t0, fin: t0 + 30 * DIA }), t0 + 60))
  afirmar('Ciclo', 'un curso agregado al plan llega a los miembros', 'membresia', (await inscripcion(bd, CORREO, nuevo))?.source)

  // 11. Otros negocios de la cuenta compartida.
  r = await enviar(evento('customer.subscription.created', suscripcion({ id: 'sub_qavaip_ajena', inicio, fin, marca: null, precio: 'price_otro_negocio' })))
  afirmar('Guardas', 'una suscripción ajena responde 200', 200, r.status)
  afirmar('Guardas', 'y no se guarda', null, await membresia(bd, 'sub_qavaip_ajena'))
  r = await enviar(evento('checkout.session.completed', checkout({ id: 'cs_qavaip_ajeno', sub: 'sub_qavaip_ajena2', email: 'qa-vaip-ajeno@academia.vadai.com.mx', marca: 'otro-negocio' })))
  afirmar('Guardas', 'un checkout de suscripción ajeno no da de alta', null, await membresia(bd, 'sub_qavaip_ajena2'))

  // 12. Un curso comprado aparte, de por vida, nunca se acorta.
  const vitalicioPerfil = await una(bd, `select user_id, full_name from academia.profiles where email = $1`, [CORREO_VITALICIO])
  const vitalicioId = vitalicioPerfil?.user_id
  const nombreVitalicio = vitalicioPerfil?.full_name
  nombreOriginal = nombreVitalicio ?? null
  await bd.query(
    `insert into academia.enrollments (user_id, course_id, source, status, expires_at) values ($1, $2, 'manual', 'active', null)`,
    [vitalicioId, ids.vitalicio]
  )
  await enviar(evento('customer.subscription.created', suscripcion({ id: 'sub_qavaip_3', inicio: t0, fin: t0 + 30 * DIA }), t0 + 70))
  await enviar(evento('checkout.session.completed', checkout({ id: 'cs_qavaip_3', sub: 'sub_qavaip_3', email: 'otro-correo-en-stripe@example.com', referencia: vitalicioId }), t0 + 71))
  afirmar('Guardas', 'client_reference_id gana sobre el correo del pago', vitalicioId, (await membresia(bd, 'sub_qavaip_3'))?.user_id)
  // El nombre del formulario de Stripe es el de la tarjeta: no pisa el del perfil (M18).
  afirmar('Guardas', 'el nombre de una cuenta que ya existía no cambia', nombreVitalicio, (await una(bd, `select full_name from academia.profiles where user_id = $1`, [vitalicioId]))?.full_name)
  await enviar(evento('customer.subscription.deleted', suscripcion({ id: 'sub_qavaip_3', status: 'canceled', inicio: t0, fin: t0 + 30 * DIA, terminada: t0 }), t0 + 80))
  const vit = await inscripcion(bd, CORREO_VITALICIO, ids.vitalicio)
  afirmar('Guardas', 'el curso de por vida sigue de por vida', 'manual · null', `${vit?.source} · ${vit?.expires_at}`)

  // 13. Un evento que falla se puede reintentar.
  const evMalo = evento('checkout.session.completed', checkout({ id: 'cs_qavaip_malo', sub: 'sub_qavaip_malo', email: 'esto-no-es-un-correo' }), t0 + 90)
  r = await enviar(evMalo)
  afirmar('Reintentos', 'un alta imposible responde 500', 500, r.status)
  const marca = await una(bd, `select 1 as hay from academia.stripe_events where event_id = $1`, [evMalo.id])
  afirmar('Reintentos', 'y el evento no queda marcado como procesado', null, marca)

  // 14. RLS: cada quien lo suyo; el community manager no ve pagos.
  const miembroId = (await membresia(bd, 'sub_qavaip_2'))?.user_id
  const cmId = (await una(bd, `select user_id from academia.profiles where email = $1`, [CORREO_CM]))?.user_id
  const comoMiembro = await verComo(bd, miembroId)
  afirmar('RLS', 'el miembro ve solo sus suscripciones', 2, comoMiembro.membresias)
  afirmar('RLS', 'y solo sus cobros', 1, comoMiembro.cobros)
  const comoCm = await verComo(bd, cmId)
  afirmar('RLS', 'el community manager no ve membresías', 0, comoCm.membresias)
  afirmar('RLS', 'ni cobros', 0, comoCm.cobros)

  // 15. Pantallas.
  const anonimo = await pedir('/vaip')
  afirmar('Pantallas', '/vaip abre sin sesión', 200, anonimo.status)
  afirmar('Pantallas', 'y es la página de venta', true, (await anonimo.text()).includes('MXN al mes'))
  const sesionMiembro = await entrar(CORREO)
  // M22: la membresía es la pestaña «Membresía» de Mi perfil. V-AI-P va en el logo (su nombre accesible).
  const perfil = await (await pedir('/perfil/membresia', sesionMiembro)).text()
  afirmar('Pantallas', 'Mi perfil → Membresía muestra la membresía', true, perfil.includes('aria-label="VADAI V-AI-P"') && perfil.includes('Administrar membresía'))
  const cm = await entrar(CORREO_CM)
  // M19: el portal es del equipo; los cobros siguen siendo solo de admin.
  afirmar('Pantallas', 'el community manager entra al portal de V-AI-P', 200, (await pedir('/admin/vaip', cm)).status)
  // M25: Cobros y Planes son una sola página, «Planes y cobros».
  const cobrosCm = await pedir('/admin/vaip/planes', cm)
  afirmar('Pantallas', 'pero Planes y cobros lo rebota', true, cobrosCm.status === 307 || cobrosCm.status === 303)
  const admin = await entrar(CORREO_ADMIN)
  const panel = await pedir('/admin/vaip', admin)
  afirmar('Pantallas', '/admin/vaip abre para admin', 200, panel.status)
  const qr = await pedir('/api/vaip/qr?destino=pagina', admin)
  afirmar('Pantallas', 'el QR se descarga en SVG', 'image/svg+xml; charset=utf-8', qr.headers.get('content-type'))

  // 16. No se elimina a un miembro activo.
  await bd.query(`update academia.memberships set status = 'active' where stripe_subscription_id = 'sub_qavaip_2'`)
  const activas = await una(
    bd,
    `select count(*)::int as n from academia.memberships where user_id = $1 and status in ('active','past_due','trialing','unpaid')`,
    [miembroId]
  )
  afirmar('Baja', 'el miembro activo cuenta como activo para la baja', true, activas.n > 0)

  // 16b. «Corregir nombre» en la ficha: desde que un alta ya no pisa el nombre
  // (16-oct-2026), es la forma deliberada de cambiarlo.
  const rutaFicha = `/admin/alumnos/${vitalicioId}`
  const corregir = formularioCon(await (await pedir(rutaFicha, admin)).text(), 'nuevo_nombre')
  afirmar('Nombre', 'la ficha trae «Corregir nombre»', true, corregir !== null)
  const nombreDe = async () => (await una(bd, `select full_name from academia.profiles where user_id = $1`, [vitalicioId]))?.full_name
  await enviarFormulario(rutaFicha, { ...corregir, nuevo_nombre: '  QA   Nombre Corregido ' }, admin)
  afirmar('Nombre', 'el equipo corrige el nombre (y le quita espacios de más)', 'QA Nombre Corregido', await nombreDe())
  await enviarFormulario(rutaFicha, { ...corregir, nuevo_nombre: nombreVitalicio }, admin)
  afirmar('Nombre', 'y lo puede regresar', nombreVitalicio, await nombreDe())

  // ===================================================================
  // FASE 2: el espacio de miembros.
  // ===================================================================

  // 17. Temas del muro: los crea el equipo, filtran, y no cruzan de curso.
  const alumno2Id = (await una(bd, `select user_id from academia.profiles where email = $1`, ['qa-alumno2@academia.vadai.com.mx']))?.user_id
  const intruso = await comoUsuario(
    bd,
    miembroId,
    `insert into academia.community_topics (course_id, name, slug) values ($1, 'QA intruso', 'qa-intruso') returning id`,
    [ids.casa]
  )
  afirmar('Temas', 'un alumno no puede crear temas (RLS)', '42501', intruso.error)
  const delEquipo = await comoUsuario(
    bd,
    cmId,
    `insert into academia.community_topics (course_id, name, slug) values ($1, 'QA del CM', 'qa-del-cm') returning id`,
    [ids.casa]
  )
  afirmar('Temas', 'el community manager sí puede', null, delEquipo.error)

  const tema = async (slug, nombre) =>
    (
      await bd.query(
        `insert into academia.community_topics (course_id, name, slug, position) values ($1, $2, $3, 0) returning id`,
        [ids.casa, nombre, slug]
      )
    ).rows[0].id
  const temaPrompts = await tema('qa-prompts', 'QA Prompts')
  const temaVentas = await tema('qa-ventas', 'QA Ventas')
  const visibles = await comoUsuario(bd, miembroId, `select count(*)::int as n from academia.community_topics where course_id = $1`, [ids.casa])
  afirmar('Temas', 'el miembro ve los temas de su curso', 2, visibles.filas[0]?.n)
  const ajeno = await comoUsuario(bd, alumno2Id, `select count(*)::int as n from academia.community_topics where course_id = $1`, [ids.casa])
  afirmar('Temas', 'quien no está inscrito no los ve', 0, ajeno.filas[0]?.n)

  const publicar = (titulo, temaId, curso = ids.casa) =>
    bd.query(
      `insert into academia.community_posts (course_id, cohort_id, user_id, title, topic_id) values ($1, $2, $3, $4, $5)`,
      [curso, curso === ids.casa ? ids.gen : null, miembroId, titulo, temaId]
    )
  await publicar('QA-TEMA-PROMPTS (test-membresia)', temaPrompts)
  await publicar('QA-TEMA-VENTAS (test-membresia)', temaVentas)
  let cruzado = null
  try {
    await publicar('QA-TEMA-CRUZADO (test-membresia)', temaPrompts, ids.extra)
  } catch (error) {
    cruzado = error.code
  }
  afirmar('Temas', 'un tema de otro curso se rechaza (trigger)', '23514', cruzado)

  const muro = await (await pedir('/curso/qa-vaip-casa/comunidad', sesionMiembro)).text()
  afirmar('Temas', 'el muro principal enseña todo', true, muro.includes('QA-TEMA-PROMPTS') && muro.includes('QA-TEMA-VENTAS'))
  const filtrado = await (await pedir('/curso/qa-vaip-casa/comunidad?tema=qa-prompts', sesionMiembro)).text()
  afirmar('Temas', 'filtrar por tema enseña solo ese tema', true, filtrado.includes('QA-TEMA-PROMPTS') && !filtrado.includes('QA-TEMA-VENTAS'))

  // 18. El espacio: ranking y logros calculados con la actividad real.
  // M22: el espacio tiene pestañas (Muro · Clases · Herramientas · Ranking); el ranking y los logros, en la suya.
  const muroDelMiembro = await (await pedir('/vaip', sesionMiembro)).text()
  afirmar('Espacio', 'el miembro ve su espacio, no la venta', true, muroDelMiembro.includes('aria-label="Secciones de V-AI-P"') && !muroDelMiembro.includes('MXN al mes'))
  const espacio = await (await pedir('/vaip/ranking', sesionMiembro)).text()
  afirmar('Espacio', 'su pestaña Ranking', true, espacio.includes('Ranking de V-AI-P'))
  afirmar('Espacio', 'va en primer lugar (es el único con actividad)', '1', espacio.match(/Vas <span[^>]*>#(?:<!-- -->)?(\d+)/)?.[1] ?? null)
  afirmar('Espacio', 'logro «Rompió el hielo» por publicar', 'Ganado', estadoDeLogro(espacio, 'Rompió el hielo'))
  afirmar('Espacio', 'logro «Miembro fundador» por entrar el primer mes', 'Ganado', estadoDeLogro(espacio, 'Miembro fundador'))
  afirmar('Espacio', 'logro «Top 10» por su lugar', 'Ganado', estadoDeLogro(espacio, 'Top 10'))
  afirmar('Espacio', 'un año todavía no', 'Pendiente', estadoDeLogro(espacio, 'Un año en V-AI-P'))

  // 19. El perfil de miembro: solo entre miembros vigentes de la casa, o para el equipo.
  // La casa REAL no se toca: las inscripciones viven dentro de una transacción que se revierte.
  const hub = (await una(bd, `select hub_course_id from academia.membership_plans where slug = $1`, [PLAN]))?.hub_course_id
  const verPerfil = async (quien, aQuien) => {
    await bd.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: quien, role: 'authenticated' })])
    return (await bd.query(`select count(*)::int as n from academia.academia_perfil_de_miembro($1)`, [aQuien])).rows[0].n
  }
  await bd.query('begin')
  try {
    await bd.query(
      `insert into academia.enrollments (user_id, course_id, source, status, expires_at)
       values ($1, $3, 'manual', 'active', null), ($2, $3, 'manual', 'active', null)
       on conflict (user_id, course_id) do update set status = 'active', expires_at = null`,
      // `do update` y no `do nothing`: el vitalicio ya tiene una inscripción a
      // la casa, VENCIDA por la cancelación de sub_qavaip_3 (paso 12). Dentro de
      // esta transacción —que se revierte— los dos tienen que estar vigentes.
      [miembroId, vitalicioId, hub]
    )
    await bd.query(`set local role authenticated`)
    afirmar('Perfil de miembro', 'un miembro ve a otro miembro', 1, await verPerfil(miembroId, vitalicioId))
    afirmar('Perfil de miembro', 'quien no es miembro no ve a nadie', 0, await verPerfil(alumno2Id, miembroId))
    afirmar('Perfil de miembro', 'un miembro no ve a quien no es miembro', 0, await verPerfil(miembroId, alumno2Id))
    afirmar('Perfil de miembro', 'el equipo ve a cualquier miembro', 1, await verPerfil(cmId, miembroId))
  } finally {
    await bd.query('rollback')
  }
  const sesionAlumno2 = await entrar('qa-alumno2@academia.vadai.com.mx')
  afirmar('Perfil de miembro', 'la página da 404 a quien no es miembro', 404, (await pedir(`/vaip/miembros/${miembroId}`, sesionAlumno2)).status)
  afirmar('Perfil de miembro', 'y abre para el equipo', 200, (await pedir(`/vaip/miembros/${miembroId}`, admin)).status)

  // 20. Serie quincenal desde el panel, con anuncio y correo (que a qa-* no sale).
  const rutaGen = `/admin/cursos/${ids.casa}?gen=${ids.gen}`
  const campos = formularioCon(await (await pedir(rutaGen, admin)).text(), 'titulo_base')
  afirmar('Serie quincenal', 'el panel trae el formulario de la serie', true, campos !== null)
  const primera = fechaCdmx(ahora() + 7 * DIA)
  const respuesta = await enviarFormulario(
    rutaGen,
    {
      ...campos,
      titulo_base: 'QA Clase',
      cantidad: '3',
      fecha: primera,
      hora: '19:00',
      cada: 'quincena',
      meet_url: 'https://meet.google.com/qa-vaip-prueba',
      anunciar: 'si',
      avisar: 'si',
    },
    admin
  )
  const avisoSerie = await respuesta.text()
  const { rows: clases } = await bd.query(
    `select title, extract(epoch from scheduled_at)::bigint as t from academia.cohort_sessions where cohort_id = $1 order by scheduled_at`,
    [ids.gen]
  )
  afirmar('Serie quincenal', 'se agendan las 3 clases', 3, clases.length)
  afirmar('Serie quincenal', 'la primera en la fecha pedida', primera, clases[0] ? fechaCdmx(Number(clases[0].t)) : null)
  afirmar(
    'Serie quincenal',
    'cada 14 días exactos',
    true,
    clases.length === 3 && clases.every((c, i) => i === 0 || Number(c.t) - Number(clases[i - 1].t) === 14 * DIA)
  )
  const anuncio = await una(
    bd,
    `select title, content_rich::text as cuerpo from academia.posts where audience_course_id = $1 and audience_cohort_id = $2 and post_type = 'announcement'`,
    [ids.casa, ids.gen]
  )
  // `qa-vaip-casa` es un curso INCLUIDO en el plan, no su casa: sus clases sí
  // se anuncian. Las de la casa ya no (M25), y eso lo prueban test-dos-mundos y test-api.
  afirmar('Serie quincenal', 'sale un anuncio para la generación', '3 clases en vivo agendadas', anuncio?.title ?? null)
  afirmar('Serie quincenal', 'con la liga a En vivo', true, Boolean(anuncio?.cuerpo.includes('/curso/qa-vaip-casa/en-vivo')))
  afirmar('Serie quincenal', 'el panel confirma el anuncio', true, avisoSerie.includes('Salió el anuncio.'))
  afirmar('Serie quincenal', 'y el correo no le sale a ninguna cuenta qa-*', true, avisoSerie.includes('Las fechas salieron a 0 alumnos'))

  verde = imprimir()
} catch (error) {
  console.error('\n  La prueba se cayó:', error)
} finally {
  // El curso base real que el alta le dio a qa-alumno1 se quita siempre: no hace falta para fotografiar.
  if (previasVitalicio) await quitarLoNuevo(bd, CORREO_VITALICIO, previasVitalicio).catch((e) => console.error('  Limpieza incompleta:', e.message))
  if (nombreOriginal) {
    await bd
      .query(`update academia.profiles set full_name = $2 where email = $1 and full_name <> $2`, [CORREO_VITALICIO, nombreOriginal])
      .catch((e) => console.error('  Limpieza incompleta:', e.message))
  }
  if (CONSERVAR) {
    console.log(`  --conservar: el escenario sigue armado (${CORREO}). Bórralo con --limpiar.\n`)
  } else {
    await purgar(bd).catch((e) => console.error('  Limpieza incompleta:', e.message))
    await borrarCuentaDeLaSuite(bd).catch((e) => console.error('  Limpieza incompleta:', e.message))
  }
  await bd.end()
  process.exitCode = verde ? 0 : 1
}
