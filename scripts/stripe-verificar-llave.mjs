#!/usr/bin/env node
/**
 * stripe-verificar-llave.mjs — ¿La llave del panel (STRIPE_ADMIN_KEY) tiene
 * exactamente los permisos que debe? (M18)
 *
 *   node scripts/stripe-verificar-llave.mjs
 *
 * Solo LEE, y de cada recurso pide un elemento y no imprime nada de él: la
 * cuenta de Stripe es compartida con otros negocios. Lo que el panel necesita
 * (productos, precios, links de pago, portal y suscripciones) tiene que
 * responder: si no, falla.
 *
 * Lo demás (clientes, cargos, saldo, webhooks) sale como AVISO: Alejandro
 * decidió el 16-oct-2026 dejarle permisos amplios a la llave para reusarla en
 * otras cosas. El código de la academia no los usa (lib/stripe/admin.ts).
 */

import Stripe from 'stripe'

import { cargarEnv, exigir, linea, titulo } from './lib/entorno.mjs'

const llave = exigir(cargarEnv(), 'STRIPE_ADMIN_KEY')
if (!llave.startsWith('rk_')) {
  console.error('\n  STRIPE_ADMIN_KEY no es una llave restringida (rk_). No se usa una llave completa en la app.\n')
  process.exit(1)
}
const stripe = new Stripe(llave, { maxNetworkRetries: 0 })

const DEBE_PODER = {
  'productos': () => stripe.products.list({ limit: 1 }),
  'precios': () => stripe.prices.list({ limit: 1 }),
  'links de pago': () => stripe.paymentLinks.list({ limit: 1 }),
  'portal de clientes': () => stripe.billingPortal.configurations.list({ limit: 1 }),
  'suscripciones': () => stripe.subscriptions.list({ limit: 1 }),
}
const NO_DEBE_PODER = {
  'clientes': () => stripe.customers.list({ limit: 1 }),
  'cargos': () => stripe.charges.list({ limit: 1 }),
  'saldo': () => stripe.balance.retrieve(),
  'webhooks': () => stripe.webhookEndpoints.list({ limit: 1 }),
}

async function probar(llamada) {
  try {
    await llamada()
    return 'permitido'
  } catch (error) {
    if (error?.statusCode === 403 || error?.type === 'StripePermissionError') return 'negado'
    return `error: ${error?.message ?? error}`
  }
}

titulo(`LLAVE DEL PANEL · ${llave.startsWith('rk_live_') ? 'PRODUCCIÓN' : 'PRUEBA'}`)
let bien = true
for (const [nombre, llamada] of Object.entries(DEBE_PODER)) {
  const r = await probar(llamada)
  const ok = r === 'permitido'
  bien &&= ok
  linea(ok ? 'ok' : 'falla', nombre, ok ? 'puede' : `debería poder (${r})`)
}
for (const [nombre, llamada] of Object.entries(NO_DEBE_PODER)) {
  const r = await probar(llamada)
  linea(r === 'negado' ? 'ok' : 'aviso', nombre, r === 'negado' ? 'negado' : `también puede (${r}); la academia no lo usa`)
}
console.log(bien ? '\n  La llave tiene lo que el panel necesita.\n' : '\n  A la llave le faltan permisos del panel: ajústalos en Stripe.\n')
process.exitCode = bien ? 0 : 1
