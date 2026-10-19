#!/usr/bin/env node
/**
 * test-planes.mjs — Criterio de cierre de M18: cobrar desde el panel.
 *
 * Stripe se SIMULA: la cuenta de Stripe es compartida con otros negocios, y una
 * suite que publicara planes de verdad la llenaría de productos QA. La suite
 * levanta un Stripe falso en 127.0.0.1:4801 que registra cada llamada, y la app
 * se levanta apuntando a él:
 *
 *   STRIPE_ADMIN_SIMULADO=http://127.0.0.1:4801 PORT=3117 pnpm start
 *   node scripts/test-planes.mjs
 *
 * Aunque alguien la corra contra un servidor SIN el simulado, un plan `qa-…`
 * nunca toca el Stripe real (lib/stripe/admin.ts lo detiene).
 *
 * Cubre lo que pidió Alejandro y lo que la revisión del plan marcó:
 *   - el panel: crear, validar, editar cursos, publicar (producto, precio, link
 *     y portal, con su marca y su idempotencia), volver a publicar sin duplicar,
 *     cambiar el precio (precio y link nuevos, los viejos apagados), archivar;
 *   - el webhook reconoce un precio VIEJO del plan;
 *   - la cancelación en tres pasos y «Seguir con mi membresía», con el motivo
 *     también en Stripe y en la bitácora;
 *   - no se puede cancelar una suscripción de otro negocio ni de otro cliente;
 *   - el motivo del portal de Stripe cae en la bitácora; una baja por falta de
 *     pago no es una cancelación;
 *   - un curso que dan dos planes no se corta cuando vence uno de ellos;
 *   - RLS: el community manager no ve cancelaciones.
 *
 * Todo se verifica en Postgres y en el registro del Stripe falso. Lo suyo lo
 * borra por marca exacta: planes y cursos `qa-plan-*`, suscripciones
 * `sub_qaplan_*`, eventos `evt_qaplan_*` y la cuenta qa-plan1.
 */

import { createHmac } from 'node:crypto'
import { createServer } from 'node:http'

import { cargarEnv, conectarPostgres, exigir } from './lib/entorno.mjs'

const vars = cargarEnv()
const SUPABASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')
const SECRETO = exigir(vars, 'STRIPE_WEBHOOK_SECRET')
const APP = (process.env.APP_URL ?? 'http://localhost:3117').replace(/\/+$/, '')
const PUERTO_STRIPE = Number(process.env.STRIPE_SIMULADO_PUERTO ?? 4801)

const VAIP = 'v-ai-p'
const CORREO = 'qa-plan1@academia.vadai.com.mx'
const CORREO_AJENO = 'qa-alumno2@academia.vadai.com.mx'
const CORREO_CM = 'qa-cm@academia.vadai.com.mx'
const CORREO_ADMIN = 'qa-admin@academia.vadai.com.mx'
const DIA = 24 * 60 * 60
const ahora = () => Math.floor(Date.now() / 1000)

// ============================================================================
// El Stripe falso
// ============================================================================

const stripe = {
  llamadas: [],
  objetos: new Map(),
  porIdempotencia: new Map(),
  contador: 0,
  suscripciones: new Map(),
  llamadasA(metodo, prefijo) {
    return this.llamadas.filter((l) => l.metodo === metodo && l.ruta.startsWith(prefijo))
  },
}

function nuevoId(prefijo) {
  stripe.contador += 1
  return `${prefijo}_qasim_${stripe.contador}`
}

/** Los parámetros de Stripe vienen como formulario con llaves anidadas: `metadata[academia_plan]`. */
const campo = (p, llave) => p.get(llave)
const metadataDe = (p, prefijo = 'metadata') => {
  const salida = {}
  for (const [k, v] of p.entries()) {
    const m = k.match(new RegExp(`^${prefijo.replace(/[[\]]/g, '\\$&')}\\[([^\\]]+)\\]$`))
    if (m) salida[m[1]] = v
  }
  return salida
}

function suscripcionStripe({ id, customer, marca, inicio, fin, status = 'active', cancela = false, detalles = null }) {
  return {
    id,
    object: 'subscription',
    status,
    customer,
    cancel_at_period_end: cancela,
    ended_at: status === 'canceled' ? fin : null,
    metadata: marca,
    cancellation_details: detalles ?? { feedback: null, comment: null, reason: null },
    items: {
      object: 'list',
      data: [{ id: `si_${id}`, object: 'subscription_item', current_period_start: inicio, current_period_end: fin, price: { id: 'price_qaplan_vaip', object: 'price' } }],
    },
  }
}

function responder(res, estado, cuerpo) {
  res.writeHead(estado, { 'content-type': 'application/json', 'request-id': `req_qasim_${stripe.contador}` })
  res.end(JSON.stringify(cuerpo))
}

const servidorStripe = createServer((req, res) => {
  let crudo = ''
  req.on('data', (d) => (crudo += d))
  req.on('end', () => {
    const url = new URL(req.url, 'http://x')
    const p = new URLSearchParams(crudo)
    const idem = req.headers['idempotency-key'] ?? null
    stripe.llamadas.push({ metodo: req.method, ruta: url.pathname, p, idem })
    if (idem && stripe.porIdempotencia.has(idem)) return responder(res, 200, stripe.porIdempotencia.get(idem))

    const partes = url.pathname.split('/').filter(Boolean) // v1, recurso, [id]
    const ruta = partes.slice(1).join('/')
    const guardar = (obj) => {
      stripe.objetos.set(obj.id, obj)
      if (idem) stripe.porIdempotencia.set(idem, obj)
      return responder(res, 200, obj)
    }
    const actualizar = (id, cambios) => {
      const obj = stripe.objetos.get(id)
      if (!obj) return responder(res, 404, { error: { type: 'invalid_request_error', message: `No such object: ${id}` } })
      Object.assign(obj, cambios)
      return responder(res, 200, obj)
    }
    const activo = () => (p.has('active') ? p.get('active') === 'true' : undefined)

    if (req.method === 'POST' && ruta === 'products') {
      return guardar({ id: nuevoId('prod'), object: 'product', active: true, name: campo(p, 'name'), metadata: metadataDe(p) })
    }
    if (req.method === 'POST' && ruta.startsWith('products/')) {
      return actualizar(partes[2], { name: campo(p, 'name'), metadata: metadataDe(p) })
    }
    if (req.method === 'GET' && ruta.startsWith('prices/')) {
      const obj = stripe.objetos.get(partes[2])
      return obj ? responder(res, 200, obj) : responder(res, 404, { error: { type: 'invalid_request_error', message: 'No such price' } })
    }
    if (req.method === 'POST' && ruta === 'prices') {
      return guardar({
        id: nuevoId('price'),
        object: 'price',
        active: true,
        unit_amount: Number(campo(p, 'unit_amount')),
        currency: campo(p, 'currency'),
        recurring: { interval: campo(p, 'recurring[interval]') },
        product: campo(p, 'product'),
        metadata: metadataDe(p),
      })
    }
    if (req.method === 'POST' && ruta.startsWith('prices/')) return actualizar(partes[2], { active: activo() })
    if (req.method === 'POST' && ruta === 'payment_links') {
      const id = nuevoId('plink')
      return guardar({
        id,
        object: 'payment_link',
        active: true,
        url: `https://buy.stripe.com/test_${id}`,
        metadata: metadataDe(p),
        precio: campo(p, 'line_items[0][price]'),
        marcaSuscripcion: metadataDe(p, 'subscription_data[metadata]'),
        regreso: campo(p, 'after_completion[redirect][url]'),
      })
    }
    if (req.method === 'POST' && ruta.startsWith('payment_links/')) return actualizar(partes[2], { active: activo() })
    if (req.method === 'POST' && ruta === 'billing_portal/configurations') {
      return guardar({
        id: nuevoId('bpc'),
        object: 'billing_portal.configuration',
        login_page: { enabled: true, url: 'https://billing.stripe.com/p/login/test_qasim' },
        cancelar: campo(p, 'features[subscription_cancel][enabled]'),
      })
    }
    if (req.method === 'POST' && ruta.startsWith('billing_portal/configurations/')) {
      return actualizar(partes[3], { cancelar: campo(p, 'features[subscription_cancel][enabled]') })
    }
    if (ruta.startsWith('subscriptions/')) {
      const sub = stripe.suscripciones.get(partes[2])
      if (!sub) return responder(res, 404, { error: { type: 'invalid_request_error', message: 'No such subscription' } })
      if (req.method === 'POST') {
        if (p.has('cancel_at_period_end')) sub.cancel_at_period_end = p.get('cancel_at_period_end') === 'true'
        if (p.has('cancellation_details[feedback]')) {
          sub.cancellation_details = {
            ...sub.cancellation_details,
            feedback: p.get('cancellation_details[feedback]') || null,
            comment: p.get('cancellation_details[comment]') || null,
          }
        }
      }
      return responder(res, 200, sub)
    }
    return responder(res, 404, { error: { type: 'invalid_request_error', message: `Ruta simulada desconocida: ${req.method} ${ruta}` } })
  })
})

// ============================================================================
// Webhook firmado, sesión y formularios (como test-membresia)
// ============================================================================

let cuenta = 0
function evento(tipo, objeto, creado = ahora()) {
  cuenta += 1
  return { id: `evt_qaplan_${Date.now()}_${cuenta}`, object: 'event', type: tipo, api_version: '2026-07-29.dahlia', created: creado, data: { object: objeto } }
}

async function webhook(e) {
  const cuerpo = JSON.stringify(e)
  const t = ahora()
  const firma = `t=${t},v1=${createHmac('sha256', SECRETO).update(`${t}.${cuerpo}`).digest('hex')}`
  const r = await fetch(`${APP}/api/stripe/webhook`, {
    method: 'POST',
    headers: { 'stripe-signature': firma, 'content-type': 'application/json' },
    body: cuerpo,
  })
  return r.status
}

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
  fetch(`${APP}${ruta}`, { redirect: 'manual', ...opciones, headers: frasco?.tamano ? { cookie: frasco.encabezado() } : {} })
const html = async (ruta, frasco) => (await pedir(ruta, frasco)).text()

/** El formulario (con su acción de servidor) que cumple `prueba` sobre su HTML. */
function formulario(pagina, prueba) {
  for (const bloque of pagina.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)) {
    if (!prueba(bloque[1])) continue
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
const conCampo = (pagina, nombre) => formulario(pagina, (b) => b.includes(`name="${nombre}"`))
const conAccion = (pagina, accion) => formulario(pagina, (b) => b.includes(`name="accion" value="${accion}"`))

async function enviar(ruta, campos, frasco) {
  const cuerpo = new FormData()
  for (const [nombre, valor] of Object.entries(campos)) {
    for (const v of Array.isArray(valor) ? valor : [valor]) cuerpo.append(nombre, v)
  }
  return pedir(ruta, frasco, { method: 'POST', body: cuerpo })
}

// ============================================================================
// Reporte
// ============================================================================

const resultados = []
const afirmar = (grupo, descripcion, esperado, real) =>
  resultados.push({ grupo, descripcion, esperado, real, ok: esperado === real })

function imprimir() {
  const porGrupo = new Map()
  for (const r of resultados) porGrupo.set(r.grupo, [...(porGrupo.get(r.grupo) ?? []), r])
  const ancho = Math.max(...resultados.map((r) => r.descripcion.length))
  console.log('\n  PRUEBA DE PLANES — M18 · cobrar desde el panel')
  console.log(`  App: ${APP} · Stripe simulado: 127.0.0.1:${PUERTO_STRIPE}`)
  for (const [grupo, casos] of porGrupo) {
    console.log(`\n  ${grupo}\n  ${'─'.repeat(ancho + 30)}`)
    for (const c of casos) console.log(`  ${c.ok ? '✓' : '✗'}  ${c.descripcion.padEnd(ancho)}  ${c.ok ? String(c.real) : `esperado ${c.esperado}, obtuvo ${c.real}`}`)
  }
  const fallidas = resultados.filter((r) => !r.ok)
  console.log(`\n  ${'─'.repeat(ancho + 30)}`)
  console.log(
    fallidas.length === 0
      ? `  M18 EN VERDE — ${resultados.length}/${resultados.length} aserciones pasaron.`
      : `  ${fallidas.length} de ${resultados.length} aserciones FALLARON.`
  )
  for (const f of fallidas) console.log(`    ${f.grupo} · ${f.descripcion}: esperado ${f.esperado}, obtuvo ${f.real}`)
  console.log('')
  return fallidas.length === 0
}

// ============================================================================
// Base: siembra y limpieza (solo lo suyo, por marca exacta)
// ============================================================================

const una = async (bd, sql, params = []) => (await bd.query(sql, params)).rows[0] ?? null
const segundos = (iso) => (iso ? Math.round(new Date(iso).getTime() / 1000) : null)

async function idDe(bd, email) {
  return (await una(bd, `select user_id from academia.profiles where lower(email) = $1`, [email]))?.user_id ?? null
}

async function inscripcionesDe(bd, email) {
  const { rows } = await bd.query(
    `select e.course_id from academia.enrollments e join academia.profiles p on p.user_id = e.user_id where lower(p.email) = $1`,
    [email]
  )
  return rows.map((r) => r.course_id)
}

async function purgar(bd) {
  const cursosQa = `(select id from academia.courses where slug like 'qa-plan-%')`
  await bd.query(`delete from academia.membership_cancellations where stripe_subscription_id like 'sub_qaplan_%'`)
  await bd.query(`delete from academia.membership_invoices where stripe_subscription_id like 'sub_qaplan_%'`)
  await bd.query(`delete from academia.memberships where stripe_subscription_id like 'sub_qaplan_%'`)
  await bd.query(`delete from academia.membership_cancellations where plan_id in (select id from academia.membership_plans where slug like 'qa-plan-%')`)
  await bd.query(`delete from academia.membership_plans where slug like 'qa-plan-%'`)
  await bd.query(`delete from academia.enrollments where course_id in ${cursosQa}`)
  await bd.query(`delete from academia.cohorts where course_id in ${cursosQa}`)
  await bd.query(`delete from academia.courses where slug like 'qa-plan-%'`)
  await bd.query(`delete from academia.stripe_events where event_id like 'evt_qaplan_%'`)
}

async function borrarCuenta(bd) {
  const id = await idDe(bd, CORREO)
  if (!id) return
  await bd.query(`delete from academia.enrollments where user_id = $1`, [id])
  await fetch(`${SUPABASE}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } })
  await bd.query(`delete from academia.profiles where user_id = $1`, [id])
}

async function cursoQa(bd, slug) {
  return (
    await bd.query(
      `insert into academia.courses (slug, title, course_type, status, certificate_enabled)
       values ($1, $2, 'evergreen', 'published', false) returning id`,
      [slug, `QA · ${slug} (test-planes)`]
    )
  ).rows[0].id
}

/** Lo que una persona ve con su sesión (RLS), en una transacción que se revierte. */
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

// ============================================================================
// La prueba
// ============================================================================

await new Promise((resolve) => servidorStripe.listen(PUERTO_STRIPE, '127.0.0.1', resolve))
const bd = await conectarPostgres(vars)
let verde = false
let previasAjeno = null

try {
  await purgar(bd)
  await borrarCuenta(bd)
  previasAjeno = await inscripcionesDe(bd, CORREO_AJENO)
  const vaip = await una(bd, `select id, status from academia.membership_plans where slug = $1`, [VAIP])
  if (!vaip) throw new Error('No existe el plan v-ai-p (migración 0040).')
  const cursoDelPlan = await cursoQa(bd, 'qa-plan-curso')
  const compartido = await cursoQa(bd, 'qa-plan-compartido')
  const deVaip = await cursoQa(bd, 'qa-plan-vaip')
  await bd.query(`insert into academia.membership_plan_courses (plan_id, course_id) values ($1, $2), ($1, $3)`, [vaip.id, deVaip, compartido])

  const admin = await entrar(CORREO_ADMIN)
  const cm = await entrar(CORREO_CM)

  // --- 1. El panel ---------------------------------------------------------
  const cmPlanes = await pedir('/admin/vaip/planes', cm)
  afirmar('Panel', 'Planes rebota al community manager', true, cmPlanes.status === 307 || cmPlanes.status === 303)
  const lista = await html('/admin/vaip/planes', admin)
  afirmar('Panel', 'Planes abre para admin', true, lista.includes('Cada plan es una suscripción mensual'))

  const nuevo = conCampo(lista, 'precio')
  const malo = await enviar('/admin/vaip/planes', { ...nuevo, nombre: 'QA Plan Malo', slug: 'qa-plan-malo', precio: '300', tachado: '200' }, admin)
  afirmar('Panel', 'el tachado menor que el precio se rechaza', true, (await malo.text()).includes('El precio tachado tiene que ser mayor'))
  afirmar('Panel', 'y no se crea nada', null, await una(bd, `select id from academia.membership_plans where slug = 'qa-plan-malo'`))

  const creado = await enviar('/admin/vaip/planes', { ...nuevo, nombre: 'QA Plan Prueba', slug: 'qa-plan-prueba', precio: '199', tachado: '299' }, admin)
  const destino = creado.headers.get('location') ?? ''
  afirmar('Panel', 'crear lleva a la página del plan', true, /\/admin\/vaip\/planes\/[0-9a-f-]{36}\?creado=1/.test(destino))
  let plan = await una(bd, `select id, status, price_compare_mxn::float as tachado from academia.membership_plans where slug = 'qa-plan-prueba'`)
  afirmar('Panel', 'nace en borrador', 'draft', plan?.status)
  afirmar('Panel', 'con su precio tachado', 299, plan?.tachado)
  const rutaPlan = `/admin/vaip/planes/${plan.id}`

  let pagina = await html(rutaPlan, admin)
  const edicion = conCampo(pagina, 'descripcion')
  await enviar(
    rutaPlan,
    { ...edicion, frase: 'Precio de lanzamiento', descripcion: 'QA: plan de prueba.', casa: '', cursos: [cursoDelPlan, compartido] },
    admin
  )
  const { rows: susCursos } = await bd.query(`select course_id from academia.membership_plan_courses where plan_id = $1`, [plan.id])
  afirmar('Panel', 'guardar iguala los cursos del plan', 2, susCursos.length)

  afirmar('Panel', 'un borrador no tiene página pública', 404, (await pedir('/membresias/qa-plan-prueba')).status)
  const ajenoId = await idDe(bd, CORREO_AJENO)
  afirmar('Panel', 'ni lo ve un alumno (RLS)', 0, (await comoUsuario(bd, ajenoId, `select id from academia.membership_plans where slug = 'qa-plan-prueba'`)).length)

  // --- 2. Publicar en Stripe ----------------------------------------------
  pagina = await html(rutaPlan, admin)
  let respuesta = await (await enviar(rutaPlan, conAccion(pagina, 'publicar'), admin)).text()
  if (stripe.llamadas.length === 0) {
    throw new Error(`La app no llamó al Stripe simulado. Levántala con STRIPE_ADMIN_SIMULADO=http://127.0.0.1:${PUERTO_STRIPE}.`)
  }
  afirmar('Publicar', 'el panel confirma la publicación', true, respuesta.includes('Publicado en Stripe'))
  const producto = stripe.llamadasA('POST', '/v1/products')[0]
  afirmar('Publicar', 'producto con la marca del plan', 'qa-plan-prueba', producto?.p.get('metadata[academia_plan]'))
  afirmar('Publicar', 'y con el id del plan', plan.id, producto?.p.get('metadata[academia_plan_id]'))
  afirmar('Publicar', 'creado con idempotencyKey', true, Boolean(producto?.idem))
  const precio1 = [...stripe.objetos.values()].find((o) => o.object === 'price')
  afirmar('Publicar', 'precio de $199 MXN al mes', '19900 mxn month', `${precio1?.unit_amount} ${precio1?.currency} ${precio1?.recurring.interval}`)
  const link1 = [...stripe.objetos.values()].find((o) => o.object === 'payment_link')
  afirmar('Publicar', 'el link marca cada suscripción', plan.id, link1?.marcaSuscripcion.academia_plan_id)
  afirmar('Publicar', 'y regresa a su página de gracias', true, Boolean(link1?.regreso?.includes('/membresias/qa-plan-prueba/gracias')))
  const portal = [...stripe.objetos.values()].find((o) => o.object === 'billing_portal.configuration')
  afirmar('Publicar', 'el portal no cancela (se cancela en la plataforma)', 'false', portal?.cancelar)
  plan = await una(
    bd,
    `select id, status, stripe_price_id, stripe_payment_link, stripe_payment_link_id from academia.membership_plans where id = $1`,
    [plan.id]
  )
  afirmar('Publicar', 'queda a la venta', 'active', plan.status)
  afirmar('Publicar', 'con su link guardado', link1?.url, plan.stripe_payment_link)
  afirmar('Publicar', 'y el precio en el historial', 1, (await bd.query(`select 1 from academia.membership_plan_prices where plan_id = $1`, [plan.id])).rowCount)

  const publica = await pedir('/membresias/qa-plan-prueba')
  const textoPublico = await publica.text()
  afirmar('Publicar', 'la página pública abre sin sesión', 200, publica.status)
  afirmar('Publicar', 'con el link de pago', true, textoPublico.includes(link1?.url ?? '—'))
  afirmar('Publicar', 'con el precio tachado y su frase', true, textoPublico.includes('$299') && textoPublico.includes('Precio de lanzamiento'))

  const preciosAntes = stripe.llamadasA('POST', '/v1/prices').filter((l) => l.ruta === '/v1/prices').length
  pagina = await html(rutaPlan, admin)
  await enviar(rutaPlan, conAccion(pagina, 'publicar'), admin)
  afirmar('Publicar', 'volver a publicar no duplica el precio', preciosAntes, stripe.llamadasA('POST', '/v1/prices').filter((l) => l.ruta === '/v1/prices').length)
  afirmar('Publicar', 'ni el link', 1, stripe.llamadasA('POST', '/v1/payment_links').filter((l) => l.ruta === '/v1/payment_links').length)

  // --- 3. Cambiar el precio -------------------------------------------------
  pagina = await html(rutaPlan, admin)
  await enviar(rutaPlan, { ...conCampo(pagina, 'descripcion'), precio: '249', cursos: [cursoDelPlan, compartido] }, admin)
  pagina = await html(rutaPlan, admin)
  afirmar('Precio nuevo', 'el panel avisa del cambio de precio', true, pagina.includes('Cambiaste el precio'))
  respuesta = await (await enviar(rutaPlan, conAccion(pagina, 'publicar'), admin)).text()
  afirmar('Precio nuevo', 'el panel lo explica', true, respuesta.includes('Quien ya pagaba sigue con su precio'))
  const precios = [...stripe.objetos.values()].filter((o) => o.object === 'price')
  afirmar('Precio nuevo', 'se crea un precio de $249', true, precios.some((p) => p.unit_amount === 24900 && p.active))
  afirmar('Precio nuevo', 'y el de $199 se archiva', false, stripe.objetos.get(precio1.id)?.active)
  afirmar('Precio nuevo', 'el link viejo se apaga', false, stripe.objetos.get(link1.id)?.active)
  const actual = await una(bd, `select stripe_payment_link_id from academia.membership_plans where id = $1`, [plan.id])
  afirmar('Precio nuevo', 'y hay un link nuevo', true, actual.stripe_payment_link_id !== link1.id && stripe.objetos.get(actual.stripe_payment_link_id)?.active === true)
  afirmar('Precio nuevo', 'el historial guarda los dos precios', 2, (await bd.query(`select 1 from academia.membership_plan_prices where plan_id = $1`, [plan.id])).rowCount)

  const t0 = ahora()
  const viejo = suscripcionStripe({ id: 'sub_qaplan_viejo', customer: 'cus_qaplan_viejo', marca: {}, inicio: t0, fin: t0 + 30 * DIA })
  viejo.items.data[0].price.id = precio1.id
  await webhook(evento('customer.subscription.created', viejo))
  afirmar('Precio nuevo', 'el webhook reconoce el precio viejo', plan.id, (await una(bd, `select plan_id from academia.memberships where stripe_subscription_id = 'sub_qaplan_viejo'`))?.plan_id)

  // --- 4. Archivar ----------------------------------------------------------
  pagina = await html(rutaPlan, admin)
  const archivar = conAccion(pagina, 'archivar')
  respuesta = await (await enviar(rutaPlan, { ...archivar, id: vaip.id }, admin)).text()
  afirmar('Archivar', 'V-AI-P no se archiva (aunque se fuerce el id)', true, respuesta.includes('V-AI-P no se archiva'))
  afirmar('Archivar', 'y sigue a la venta', vaip.status, (await una(bd, `select status from academia.membership_plans where id = $1`, [vaip.id]))?.status)
  await enviar(rutaPlan, archivar, admin)
  afirmar('Archivar', 'archivar apaga el link en Stripe', false, stripe.objetos.get(actual.stripe_payment_link_id)?.active)
  afirmar('Archivar', 'el plan queda archivado', 'archived', (await una(bd, `select status from academia.membership_plans where id = $1`, [plan.id]))?.status)
  afirmar('Archivar', 'y su página da 404', 404, (await pedir('/membresias/qa-plan-prueba')).status)

  // --- 5. Cancelar desde la plataforma (V-AI-P) -----------------------------
  const sub = suscripcionStripe({ id: 'sub_qaplan_c1', customer: 'cus_qaplan_c1', marca: { academia_plan: VAIP }, inicio: t0 - DIA, fin: t0 + 29 * DIA })
  stripe.suscripciones.set(sub.id, sub)
  await webhook(evento('customer.subscription.created', structuredClone(sub), t0))
  await webhook(
    evento(
      'checkout.session.completed',
      {
        id: 'cs_qaplan_c1',
        object: 'checkout.session',
        mode: 'subscription',
        payment_status: 'paid',
        subscription: sub.id,
        customer: sub.customer,
        customer_details: { email: CORREO, name: 'QA Planes' },
        customer_email: CORREO,
        client_reference_id: null,
        metadata: { academia_plan: VAIP },
      },
      t0 + 1
    )
  )
  const miembroId = await idDe(bd, CORREO)
  afirmar('Cancelar', 'el miembro existe', true, Boolean(miembroId))
  const miembro = await entrar(CORREO)
  // M22: la membresía es la pestaña «Membresía» de Mi perfil.
  const perfil = await html('/perfil/membresia', miembro)
  afirmar('Cancelar', 'Mi perfil → Membresía trae «Administrar membresía»', true, perfil.includes('/perfil/membresia?plan=v-ai-p') && perfil.includes('Administrar membresía'))
  const base = '/perfil/membresia?plan=v-ai-p'
  afirmar('Cancelar', 'la salida es un enlace discreto', true, (await html(base, miembro)).includes('Cancelar mi membresía'))
  afirmar('Cancelar', 'paso 1: lo que dejas', true, (await html(`${base}&paso=1`, miembro)).includes('Antes de irte'))
  afirmar('Cancelar', 'paso 2: por qué te vas', true, (await html(`${base}&paso=2`, miembro)).includes('name="motivo"'))
  const paso3 = await html(`${base}&paso=3&motivo=precio`, miembro)
  afirmar('Cancelar', 'paso 3: confirmar', true, paso3.includes('Confirma tu cancelación'))

  const antes = await una(bd, `select access_until from academia.memberships where stripe_subscription_id = $1`, [sub.id])
  const cancelacion = await enviar(base, { ...conCampo(paso3, 'comentario'), comentario: 'QA: muy caro por ahora' }, miembro)
  afirmar('Cancelar', 'cancelar redirige a la confirmación', true, (cancelacion.headers.get('location') ?? '').includes('listo=cancelada'))
  const enStripe = stripe.llamadasA('POST', `/v1/subscriptions/${sub.id}`).at(-1)
  afirmar('Cancelar', 'Stripe cancela al fin del periodo', 'true', enStripe?.p.get('cancel_at_period_end'))
  afirmar('Cancelar', 'con el motivo también en Stripe', 'too_expensive', enStripe?.p.get('cancellation_details[feedback]'))
  let membresia = await una(bd, `select cancel_at_period_end, access_until from academia.memberships where stripe_subscription_id = $1`, [sub.id])
  afirmar('Cancelar', 'la membresía queda marcada al momento', true, membresia?.cancel_at_period_end)
  afirmar('Cancelar', 'y conserva el acceso pagado', segundos(antes?.access_until), segundos(membresia?.access_until))
  let bitacora = await bd.query(`select reason, comment, origin, reverted_at from academia.membership_cancellations where stripe_subscription_id = $1`, [sub.id])
  afirmar('Cancelar', 'la bitácora guarda el motivo propio', 'precio · plataforma', `${bitacora.rows[0]?.reason} · ${bitacora.rows[0]?.origin}`)
  afirmar('Cancelar', 'y el comentario', 'QA: muy caro por ahora', bitacora.rows[0]?.comment)

  await webhook(evento('customer.subscription.updated', structuredClone(stripe.suscripciones.get(sub.id)), ahora() + 5))
  bitacora = await bd.query(`select origin from academia.membership_cancellations where stripe_subscription_id = $1`, [sub.id])
  afirmar('Cancelar', 'el webhook que llega después no la duplica', '1 · plataforma', `${bitacora.rowCount} · ${bitacora.rows[0]?.origin}`)

  const cancelada = await html(base, miembro)
  afirmar('Seguir', 'la página ofrece seguir', true, cancelada.includes('Cancelaste la renovación') && cancelada.includes('Seguir con mi membresía'))
  const seguir = await enviar(base, conCampo(cancelada, 'plan'), miembro)
  afirmar('Seguir', '«Seguir» redirige', true, (seguir.headers.get('location') ?? '').includes('listo=sigue'))
  afirmar('Seguir', 'Stripe deja de cancelar', 'false', stripe.llamadasA('POST', `/v1/subscriptions/${sub.id}`).at(-1)?.p.get('cancel_at_period_end'))
  membresia = await una(bd, `select cancel_at_period_end from academia.memberships where stripe_subscription_id = $1`, [sub.id])
  afirmar('Seguir', 'la membresía vuelve a renovarse', false, membresia?.cancel_at_period_end)
  afirmar('Seguir', 'y la cancelación se cierra', true, Boolean((await una(bd, `select reverted_at from academia.membership_cancellations where stripe_subscription_id = $1`, [sub.id]))?.reverted_at))

  // --- 6. Lo que no es suyo -------------------------------------------------
  const ajena = suscripcionStripe({ id: 'sub_qaplan_ajena', customer: 'cus_qaplan_ajena', marca: { academia_plan: 'otro-negocio' }, inicio: t0, fin: t0 + 30 * DIA })
  stripe.suscripciones.set(ajena.id, ajena)
  await bd.query(
    `insert into academia.memberships (plan_id, user_id, email, stripe_customer_id, stripe_subscription_id, status,
                                       current_period_start, current_period_end, access_until)
     values ($1, $2, $3, 'cus_qaplan_ajena', 'sub_qaplan_ajena', 'active', to_timestamp($4), to_timestamp($5), to_timestamp($6))`,
    [vaip.id, ajenoId, CORREO_AJENO, t0, t0 + 30 * DIA, t0 + 32 * DIA]
  )
  const otro = await entrar(CORREO_AJENO)
  const paso3Ajeno = await html(`${base}&paso=3&motivo=otro`, otro)
  let intento = await enviar(base, conCampo(paso3Ajeno, 'comentario'), otro)
  afirmar('Ajenas', 'una suscripción de otro negocio no se cancela', true, (intento.headers.get('location') ?? '').includes('error=no-coincide'))
  ajena.metadata = { academia_plan: VAIP }
  ajena.customer = 'cus_de_otra_persona'
  intento = await enviar(base, conCampo(paso3Ajeno, 'comentario'), otro)
  afirmar('Ajenas', 'ni una de otro cliente', true, (intento.headers.get('location') ?? '').includes('error=no-coincide'))
  afirmar('Ajenas', 'Stripe nunca recibió el cambio', 0, stripe.llamadasA('POST', '/v1/subscriptions/sub_qaplan_ajena').length)
  afirmar('Ajenas', 'ni se anotó una cancelación', null, await una(bd, `select id from academia.membership_cancellations where stripe_subscription_id = 'sub_qaplan_ajena'`))

  // --- 7. Desde el portal de Stripe, y lo que no es cancelar -----------------
  await webhook(
    evento(
      'customer.subscription.updated',
      suscripcionStripe({
        id: 'sub_qaplan_portal',
        customer: 'cus_qaplan_portal',
        marca: { academia_plan: VAIP },
        inicio: t0,
        fin: t0 + 30 * DIA,
        cancela: true,
        detalles: { feedback: 'unused', comment: 'QA desde el portal', reason: 'cancellation_requested' },
      })
    )
  )
  const delPortal = await una(bd, `select reason, origin, comment from academia.membership_cancellations where stripe_subscription_id = 'sub_qaplan_portal'`)
  afirmar('Portal', 'el motivo del portal cae en la bitácora', 'tiempo · portal · QA desde el portal', `${delPortal?.reason} · ${delPortal?.origin} · ${delPortal?.comment}`)
  await webhook(
    evento(
      'customer.subscription.deleted',
      suscripcionStripe({
        id: 'sub_qaplan_falla',
        customer: 'cus_qaplan_falla',
        marca: { academia_plan: VAIP },
        inicio: t0 - 40 * DIA,
        fin: t0 - 10 * DIA,
        status: 'canceled',
        detalles: { feedback: null, comment: null, reason: 'payment_failed' },
      })
    )
  )
  afirmar('Portal', 'una baja por falta de pago no es cancelación', null, await una(bd, `select id from academia.membership_cancellations where stripe_subscription_id = 'sub_qaplan_falla'`))

  const cmId = await idDe(bd, CORREO_CM)
  const adminId = await idDe(bd, CORREO_ADMIN)
  const contar = `select count(*)::int as n from academia.membership_cancellations where stripe_subscription_id like 'sub_qaplan_%'`
  const todas = (await una(bd, contar)).n
  afirmar('RLS', 'el community manager no ve cancelaciones', 0, (await comoUsuario(bd, cmId, contar))[0].n)
  afirmar('RLS', 'el miembro tampoco', 0, (await comoUsuario(bd, miembroId, contar))[0].n)
  afirmar('RLS', 'el admin ve todas', todas, (await comoUsuario(bd, adminId, contar))[0].n)
  const paginaVaip = await html(`/admin/vaip/planes/${vaip.id}`, admin)
  afirmar('RLS', 'las cuentas QA no salen en «Por qué se van»', true, paginaVaip.includes('QA desde el portal') && !paginaVaip.includes('QA: muy caro por ahora'))

  // --- 8. Un curso que dan dos planes ---------------------------------------
  const delVaip = await una(bd, `select access_until from academia.memberships where stripe_subscription_id = $1`, [sub.id])
  await webhook(
    evento(
      'customer.subscription.created',
      suscripcionStripe({ id: 'sub_qaplan_m1', customer: sub.customer, marca: { academia_plan_id: plan.id }, inicio: t0 - 40 * DIA, fin: t0 - 10 * DIA })
    )
  )
  await bd.query(`update academia.memberships set user_id = $1, email = $2 where stripe_subscription_id = 'sub_qaplan_m1'`, [miembroId, CORREO])
  await webhook(
    evento(
      'customer.subscription.deleted',
      suscripcionStripe({ id: 'sub_qaplan_m1', customer: sub.customer, marca: { academia_plan_id: plan.id }, inicio: t0 - 40 * DIA, fin: t0 - 10 * DIA, status: 'canceled' }),
      ahora() + 10
    )
  )
  const enCompartido = await una(
    bd,
    `select expires_at from academia.enrollments where user_id = $1 and course_id = $2`,
    [miembroId, compartido]
  )
  afirmar('Varios planes', 'vencer un plan no corta el curso que da otro', segundos(delVaip?.access_until), segundos(enCompartido?.expires_at))
  const enElOtro = await una(bd, `select expires_at from academia.enrollments where user_id = $1 and course_id = $2`, [miembroId, cursoDelPlan])
  afirmar('Varios planes', 'el curso que solo daba ese plan no se regala', true, enElOtro === null || new Date(enElOtro.expires_at) < new Date())

  verde = imprimir()
} catch (error) {
  console.error('\n  La prueba se cayó:', error)
} finally {
  await purgar(bd).catch((e) => console.error('  Limpieza incompleta:', e.message))
  await borrarCuenta(bd).catch((e) => console.error('  Limpieza incompleta:', e.message))
  if (previasAjeno) {
    await bd
      .query(
        `delete from academia.enrollments e using academia.profiles p
          where p.user_id = e.user_id and lower(p.email) = $1 and not (e.course_id = any($2::uuid[]))`,
        [CORREO_AJENO, previasAjeno]
      )
      .catch((e) => console.error('  Limpieza incompleta:', e.message))
  }
  await bd.end()
  servidorStripe.close()
  process.exitCode = verde ? 0 : 1
}
