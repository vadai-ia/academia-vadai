#!/usr/bin/env node
/**
 * stripe-vaip.mjs — Arma en Stripe todo lo de VADAI V-AI-P (M17). Lo corre Alejandro.
 *
 *   STRIPE_SETUP_KEY=sk_test_… node scripts/stripe-vaip.mjs --modo prueba
 *   STRIPE_SETUP_KEY=sk_live_… node scripts/stripe-vaip.mjs --modo real
 *
 * La app usa una llave restringida de SOLO LECTURA (lib/stripe/cliente.ts) y así
 * se queda. Para crear cosas hace falta una llave con escritura: va en
 * `STRIPE_SETUP_KEY`, solo en la terminal de esta corrida, y se borra después.
 * El script no la guarda en ningún lado.
 *
 * Crea o reusa (es idempotente: busca por `metadata.academia_plan` antes de crear):
 *   1. El producto «VADAI V-AI-P» y su precio de $349 MXN al mes.
 *   2. El Payment Link, con la marca del plan en el link Y en
 *      `subscription_data.metadata` (así cada suscripción y cada factura llegan
 *      marcadas al webhook), sin códigos de promoción, solo tarjeta, y de
 *      regreso a /vaip/gracias.
 *   3. Una configuración PROPIA del portal de clientes, con página de inicio de
 *      sesión: cancelar al fin del periodo, cambiar tarjeta, ver cobros. No toca
 *      el portal por defecto de la cuenta, que es de todos los negocios.
 *   4. Los eventos nuevos en el endpoint del webhook de la academia.
 *
 * Con `--modo real` además guarda los ids y las URLs en `academia.membership_plans`
 * y escribe los QR en contenido/v-ai-p/. Con `--modo prueba` solo imprime: un link
 * de prueba en la base de producción rompería la página de venta.
 *
 * No toca ningún ajuste de toda la cuenta: ni el portal por defecto, ni las
 * reglas de reintentos, ni los correos a clientes, ni Checkout.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import qrcode from 'qrcode-generator'
import Stripe from 'stripe'

import { RAIZ, cargarEnv, conectarPostgres, exigir, linea, titulo } from './lib/entorno.mjs'

const SLUG = 'v-ai-p'
const MARCA = { academia_plan: SLUG }
const PRECIO_CENTAVOS = 34900
const EVENTOS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
]

const modo = process.argv[process.argv.indexOf('--modo') + 1]
if (modo !== 'prueba' && modo !== 'real') {
  console.error('Uso: STRIPE_SETUP_KEY=… node scripts/stripe-vaip.mjs --modo prueba|real')
  process.exit(1)
}

const llave = process.env.STRIPE_SETUP_KEY ?? ''
const esReal = /_live_/.test(llave)
if (!llave) {
  console.error('Falta STRIPE_SETUP_KEY: una llave con escritura, solo para esta corrida.')
  process.exit(1)
}
if (esReal !== (modo === 'real')) {
  console.error(`La llave es de ${esReal ? 'producción' : 'prueba'} y pediste --modo ${modo}. No coinciden.`)
  process.exit(1)
}

const vars = cargarEnv()
const APP = exigir(vars, 'NEXT_PUBLIC_APP_URL').replace(/\/+$/, '')
const stripe = new Stripe(llave)
const esNuestro = (objeto) => objeto?.metadata?.academia_plan === SLUG

async function todos(lista) {
  const salida = []
  for await (const objeto of lista) salida.push(objeto)
  return salida
}

titulo(`V-AI-P EN STRIPE — modo ${modo}`)

// 1. Producto y precio ------------------------------------------------------
let producto = (await todos(stripe.products.list({ limit: 100, active: true }))).find(esNuestro)
if (!producto) {
  producto = await stripe.products.create({
    name: 'VADAI V-AI-P',
    description: 'La comunidad de la academia VADAI: clases en vivo cada quince días y lo nuevo para miembros.',
    metadata: MARCA,
  })
  linea('ok', 'producto creado', producto.id)
} else {
  linea('ok', 'producto ya existía', producto.id)
}

let precio = (await todos(stripe.prices.list({ product: producto.id, active: true, limit: 100 }))).find(
  (p) => p.unit_amount === PRECIO_CENTAVOS && p.currency === 'mxn' && p.recurring?.interval === 'month'
)
if (!precio) {
  precio = await stripe.prices.create({
    product: producto.id,
    unit_amount: PRECIO_CENTAVOS,
    currency: 'mxn',
    recurring: { interval: 'month' },
    nickname: 'V-AI-P mensual',
    metadata: MARCA,
  })
  linea('ok', 'precio creado', `${precio.id} · $349 MXN al mes`)
} else {
  linea('ok', 'precio ya existía', precio.id)
}

// 2. Payment Link -----------------------------------------------------------
const regreso = `${APP}/vaip/gracias?session_id={CHECKOUT_SESSION_ID}`
let link = (await todos(stripe.paymentLinks.list({ active: true, limit: 100 }))).find(esNuestro)
if (link) {
  const lineas = await stripe.paymentLinks.listLineItems(link.id, { limit: 5 })
  if (lineas.data[0]?.price?.id !== precio.id) {
    await stripe.paymentLinks.update(link.id, { active: false })
    linea('aviso', 'link viejo desactivado', `${link.id} cobraba otro precio`)
    link = null
  }
}
if (!link) {
  link = await stripe.paymentLinks.create({
    line_items: [{ price: precio.id, quantity: 1 }],
    metadata: MARCA,
    subscription_data: { metadata: MARCA },
    after_completion: { type: 'redirect', redirect: { url: regreso } },
    allow_promotion_codes: false,
    payment_method_types: ['card'],
  })
  linea('ok', 'link de pago creado', link.url)
} else {
  linea('ok', 'link de pago ya existía', link.url)
}

// 3. Portal de clientes propio ---------------------------------------------
let portal = (await todos(stripe.billingPortal.configurations.list({ limit: 100 }))).find(esNuestro)
const ajustesDelPortal = {
  business_profile: { headline: 'VADAI V-AI-P · Administra tu membresía' },
  features: {
    customer_update: { enabled: false },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: {
      enabled: true,
      mode: 'at_period_end',
      cancellation_reason: {
        enabled: true,
        options: ['too_expensive', 'unused', 'missing_features', 'other'],
      },
    },
    subscription_update: { enabled: false },
  },
  login_page: { enabled: true },
  default_return_url: `${APP}/perfil`,
  metadata: MARCA,
}
portal = portal
  ? await stripe.billingPortal.configurations.update(portal.id, ajustesDelPortal)
  : await stripe.billingPortal.configurations.create(ajustesDelPortal)
linea('ok', 'portal de clientes', portal.login_page?.url ?? '(sin página de inicio de sesión)')

// 4. Eventos del webhook ----------------------------------------------------
const destino = `${APP}/api/stripe/webhook`
const endpoint = (await todos(stripe.webhookEndpoints.list({ limit: 100 }))).find((e) => e.url === destino)
if (!endpoint) {
  linea('aviso', 'webhook', `no hay endpoint en ${destino} en este modo; agrégalo a mano con los eventos de arriba`)
} else {
  const faltan = EVENTOS.filter((e) => !endpoint.enabled_events.includes(e) && !endpoint.enabled_events.includes('*'))
  if (faltan.length > 0) {
    await stripe.webhookEndpoints.update(endpoint.id, {
      enabled_events: [...endpoint.enabled_events, ...faltan],
    })
    linea('ok', 'webhook', `eventos agregados: ${faltan.join(', ')}`)
  } else {
    linea('ok', 'webhook', 'ya escuchaba todos los eventos')
  }
  linea('aviso', 'versión de API del endpoint', endpoint.api_version ?? '(la de la cuenta)')
}

// 5. Guardar (solo real) -----------------------------------------------------
if (modo === 'real') {
  const bd = await conectarPostgres(vars)
  try {
    const r = await bd.query(
      `update academia.membership_plans
          set stripe_product_id = $2, stripe_price_id = $3, stripe_payment_link = $4, portal_login_url = $5
        where slug = $1`,
      [SLUG, producto.id, precio.id, link.url, portal.login_page?.url ?? null]
    )
    linea(r.rowCount === 1 ? 'ok' : 'falla', 'academia.membership_plans', r.rowCount === 1 ? 'guardado' : 'no existe el plan: aplica la migración 0040')
  } finally {
    await bd.end()
  }

  const carpeta = resolve(RAIZ, 'contenido', 'v-ai-p')
  mkdirSync(carpeta, { recursive: true })
  writeFileSync(resolve(carpeta, 'qr-vaip-pagina.svg'), svgDelQr(`${APP}/vaip`, `${APP.replace(/^https?:\/\//, '')}/vaip`))
  writeFileSync(resolve(carpeta, 'qr-vaip-pago.svg'), svgDelQr(link.url, 'Suscríbete · $349 MXN al mes'))
  linea('ok', 'QR', 'contenido/v-ai-p/qr-vaip-pagina.svg y qr-vaip-pago.svg')
} else {
  linea('aviso', 'modo prueba', 'no se guardó nada en la base')
}

console.log('')
console.log('  Listo. Ahora BORRA la llave STRIPE_SETUP_KEY de Stripe (o revócala).')
console.log('')

/** El mismo dibujo que lib/membresia/qr.ts (este script no importa TypeScript). */
function svgDelQr(texto, pie) {
  const codigo = qrcode(0, 'M')
  codigo.addData(texto)
  codigo.make()
  const n = codigo.getModuleCount()
  const margen = 4
  const lado = (n + margen * 2) * 10
  let d = ''
  for (let f = 0; f < n; f += 1) {
    for (let c = 0; c < n; c += 1) {
      if (!codigo.isDark(f, c)) continue
      let fin = c
      while (fin + 1 < n && codigo.isDark(f, fin + 1)) fin += 1
      d += `M${c + margen} ${f + margen}h${fin - c + 1}v1h-${fin - c + 1}z`
      c = fin
    }
  }
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado + 110}" width="${lado}" height="${lado + 110}">
  <rect width="${lado}" height="${lado + 110}" fill="#ffffff"/>
  <g transform="scale(10)" shape-rendering="crispEdges"><path d="${d}" fill="#0a1a2f"/></g>
  <text x="${lado / 2}" y="${lado + 42}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="800" fill="#0a1a2f">VADAI V-AI-P</text>
  <text x="${lado / 2}" y="${lado + 84}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="22" fill="#4e6572">${esc(pie)}</text>
</svg>
`
}
