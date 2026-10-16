#!/usr/bin/env node
/**
 * test-membresia.mjs — Criterio de cierre de M17, fase 1 (VADAI V-AI-P).
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
 *   PORT=3117 pnpm start
 *   node scripts/test-membresia.mjs
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

const pedir = (ruta, frasco) =>
  fetch(`${APP}${ruta}`, { redirect: 'manual', headers: frasco?.tamano ? { cookie: frasco.encabezado() } : {} })

// --- reporte --------------------------------------------------------------------

const resultados = []
const afirmar = (grupo, descripcion, esperado, real) =>
  resultados.push({ grupo, descripcion, esperado, real, ok: esperado === real })

function imprimir() {
  const porGrupo = new Map()
  for (const r of resultados) porGrupo.set(r.grupo, [...(porGrupo.get(r.grupo) ?? []), r])
  const ancho = Math.max(...resultados.map((r) => r.descripcion.length))
  console.log('\n  PRUEBA DE MEMBRESÍA — M17 · fase 1')
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
      ? `  M17 (fase 1) EN VERDE — ${resultados.length}/${resultados.length} aserciones pasaron.`
      : `  ${fallidas.length} de ${resultados.length} aserciones FALLARON.`
  )
  for (const f of fallidas) console.log(`    ${f.grupo} · ${f.descripcion}: esperado ${f.esperado}, obtuvo ${f.real}`)
  console.log('')
  return fallidas.length === 0
}

// --- siembra y limpieza -----------------------------------------------------------

async function purgar(bd) {
  await bd.query(
    `delete from academia.enrollments where course_id in (select id from academia.courses where slug like 'qa-vaip-%')`
  )
  await bd.query(`delete from academia.membership_invoices where stripe_invoice_id like 'in_qavaip_%'`)
  await bd.query(`delete from academia.memberships where stripe_subscription_id like 'sub_qavaip_%'`)
  await bd.query(`delete from academia.cohorts where course_id in (select id from academia.courses where slug like 'qa-vaip-%')`)
  await bd.query(`delete from academia.courses where slug like 'qa-vaip-%'`)
  await bd.query(`delete from academia.stripe_events where event_id like 'evt_qavaip_%'`)
}

async function sembrar(bd) {
  const plan = await una(bd, `select id from academia.membership_plans where slug = $1`, [PLAN])
  if (!plan) throw new Error('No existe el plan v-ai-p: aplica la migración academia_0040_membresia.')
  const curso = async (slug, tipo) =>
    (
      await bd.query(
        `insert into academia.courses (slug, title, course_type, status, certificate_enabled, plan_id)
         values ($1, $2, $3, 'published', false, $4) returning id`,
        [slug, `QA · ${slug} (test-membresia)`, tipo, plan.id]
      )
    ).rows[0].id
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
try {
  await purgar(bd)
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
    `insert into academia.courses (slug, title, course_type, status, certificate_enabled, plan_id)
     values ('qa-vaip-nuevo', 'QA · qa-vaip-nuevo (test-membresia)', 'evergreen', 'published', false, $1) returning id`,
    [ids.plan]
  )
  await enviar(evento('customer.subscription.updated', suscripcion({ id: 'sub_qavaip_2', inicio: t0, fin: t0 + 30 * DIA }), t0 + 60))
  afirmar('Ciclo', 'un curso agregado al plan llega a los miembros', 'membresia', (await inscripcion(bd, CORREO, nuevo))?.source)

  // 11. Otros negocios de la cuenta compartida.
  r = await enviar(evento('customer.subscription.created', suscripcion({ id: 'sub_qavaip_ajena', inicio, fin, marca: null, precio: 'price_otro_negocio' })))
  afirmar('Guardas', 'una suscripción ajena responde 200', 200, r.status)
  afirmar('Guardas', 'y no se guarda', null, await membresia(bd, 'sub_qavaip_ajena'))
  r = await enviar(evento('checkout.session.completed', checkout({ id: 'cs_qavaip_ajeno', sub: 'sub_qavaip_ajena2', email: 'qa-vaip-ajeno@academia.vadai.com.mx', marca: 'otro-negocio' })))
  afirmar('Guardas', 'un checkout de suscripción ajeno no da de alta', null, await membresia(bd, 'sub_qavaip_ajena2'))

  // 12. Un curso comprado aparte, de por vida, nunca se acorta.
  const vitalicioId = (await una(bd, `select user_id from academia.profiles where email = $1`, [CORREO_VITALICIO]))?.user_id
  await bd.query(
    `insert into academia.enrollments (user_id, course_id, source, status, expires_at) values ($1, $2, 'manual', 'active', null)`,
    [vitalicioId, ids.vitalicio]
  )
  await enviar(evento('customer.subscription.created', suscripcion({ id: 'sub_qavaip_3', inicio: t0, fin: t0 + 30 * DIA }), t0 + 70))
  await enviar(evento('checkout.session.completed', checkout({ id: 'cs_qavaip_3', sub: 'sub_qavaip_3', email: 'otro-correo-en-stripe@example.com', referencia: vitalicioId }), t0 + 71))
  afirmar('Guardas', 'client_reference_id gana sobre el correo del pago', vitalicioId, (await membresia(bd, 'sub_qavaip_3'))?.user_id)
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
  const perfil = await (await pedir('/perfil', sesionMiembro)).text()
  afirmar('Pantallas', '/perfil muestra la membresía', true, perfil.includes('Tu membresía V-AI-P'))
  const cm = await entrar(CORREO_CM)
  const adminCm = await pedir('/admin/vaip', cm)
  afirmar('Pantallas', '/admin/vaip rebota al community manager', true, adminCm.status === 307 || adminCm.status === 303)
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

  verde = imprimir()
} catch (error) {
  console.error('\n  La prueba se cayó:', error)
} finally {
  await purgar(bd).catch((e) => console.error('  Limpieza incompleta:', e.message))
  await bd.end()
  process.exitCode = verde ? 0 : 1
}
