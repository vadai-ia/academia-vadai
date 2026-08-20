import 'server-only'

import Stripe from 'stripe'

/**
 * Cliente de Stripe.
 *
 * No se fija `apiVersion`: el SDK trae pinneada la versión con la que fue
 * construido y probado. Forzar otra a mano es la vía rápida a un payload que no
 * coincide con los tipos.
 *
 * La llave debe ser restringida (`rk_`). Este backend solo LEE de Stripe —
 * sesiones, clientes y cargos— y nunca escribe. Si la llave se filtra, no
 * permite cobrar ni mover dinero.
 */
export function crearClienteStripe(): Stripe {
  const llave = process.env.STRIPE_SECRET_KEY
  if (!llave) {
    throw new Error('Falta STRIPE_SECRET_KEY. Ver .env.local.example.')
  }
  return new Stripe(llave)
}

export function secretoDeWebhook(): string {
  const secreto = process.env.STRIPE_WEBHOOK_SECRET
  if (!secreto) {
    throw new Error('Falta STRIPE_WEBHOOK_SECRET. Sale del endpoint en el dashboard de Stripe.')
  }
  return secreto
}

export function stripeConfigurado(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET)
}

/** ¿Estamos apuntando a dinero real? Sirve para avisar en la UI del admin. */
export function stripeEnVivo(): boolean {
  return /_live_/.test(process.env.STRIPE_SECRET_KEY ?? '')
}
