import type Stripe from 'stripe'

import type { EstadoSuscripcion } from '@/lib/membresia/acceso'

/**
 * Lee los eventos de Stripe de la membresía y los deja en una forma plana.
 *
 * Por qué una capa aparte: la forma del payload la decide la versión de API del
 * ENDPOINT del webhook, no la del SDK. Desde `2025-03-31.basil` el periodo vive
 * en cada item de la suscripción y la factura llega por `parent`; en versiones
 * anteriores, en la suscripción y en `invoice.subscription`. Aquí se leen las
 * dos sin `any`: lo que no se reconoce queda en null y quien llama decide.
 *
 * Sin llamadas a Stripe: todo sale del evento. Así las suites lo prueban con
 * eventos firmados, sin mover dinero.
 */

/** La marca que lleva cada objeto de la membresía en `metadata` (Payment Link y suscripción). */
export const MARCA_PLAN = 'academia_plan'
/** Desde M18 también el id del plan: el slug no cambia, pero el id es inequívoco. */
export const MARCA_PLAN_ID = 'academia_plan_id'

const ESTADOS: readonly EstadoSuscripcion[] = [
  'incomplete',
  'incomplete_expired',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'paused',
]

function propiedad(objeto: unknown, clave: string): unknown {
  return typeof objeto === 'object' && objeto !== null ? (objeto as Record<string, unknown>)[clave] : undefined
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor !== '' ? valor : null
}

function epoch(valor: unknown): string | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? new Date(valor * 1000).toISOString() : null
}

/** Un id que puede venir como cadena o como objeto expandido. */
function id(valor: unknown): string | null {
  return texto(valor) ?? texto(propiedad(valor, 'id'))
}

function marcaDe(metadata: unknown): string | null {
  return texto(propiedad(metadata, MARCA_PLAN))
}

function marcaIdDe(metadata: unknown): string | null {
  return texto(propiedad(metadata, MARCA_PLAN_ID))
}

export type SuscripcionLeida = {
  subscriptionId: string
  customerId: string | null
  status: EstadoSuscripcion
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  ended_at: string | null
  plan: string | null
  planId: string | null
  precios: string[]
  /**
   * `cancellation_details`: por qué terminó o va a terminar. `motivo` es lo
   * que la persona eligió (portal o plataforma); `razon`, quién la terminó
   * (`cancellation_requested`, `payment_failed`, `payment_disputed`).
   */
  cancelacion: { motivo: string | null; comentario: string | null; razon: string | null }
}

export function leerSuscripcion(sub: Stripe.Subscription): SuscripcionLeida | null {
  const subscriptionId = texto(sub.id)
  const status = ESTADOS.find((e) => e === sub.status)
  if (!subscriptionId || !status) return null

  const items = Array.isArray(sub.items?.data) ? sub.items.data : []
  // basil+: en el item. Antes: en la suscripción.
  const inicios = items.map((i) => epoch(propiedad(i, 'current_period_start'))).filter((v): v is string => v !== null)
  const fines = items.map((i) => epoch(propiedad(i, 'current_period_end'))).filter((v): v is string => v !== null)

  return {
    subscriptionId,
    customerId: id(sub.customer),
    status,
    current_period_start: inicios.sort()[0] ?? epoch(propiedad(sub, 'current_period_start')),
    current_period_end: fines.sort().reverse()[0] ?? epoch(propiedad(sub, 'current_period_end')),
    cancel_at_period_end: sub.cancel_at_period_end === true,
    ended_at: epoch(sub.ended_at),
    plan: marcaDe(sub.metadata),
    planId: marcaIdDe(sub.metadata),
    precios: items.map((i) => id(propiedad(i, 'price'))).filter((v): v is string => v !== null),
    cancelacion: {
      motivo: texto(propiedad(sub.cancellation_details, 'feedback')),
      comentario: texto(propiedad(sub.cancellation_details, 'comment')),
      razon: texto(propiedad(sub.cancellation_details, 'reason')),
    },
  }
}

export type FacturaLeida = {
  invoiceId: string
  subscriptionId: string | null
  customerId: string | null
  email: string | null
  nombre: string | null
  /** En pesos, no en centavos. */
  monto: number
  moneda: string
  period_start: string | null
  period_end: string | null
  plan: string | null
  planId: string | null
  precios: string[]
}

export function leerFactura(inv: Stripe.Invoice, pagada: boolean): FacturaLeida | null {
  const invoiceId = texto(inv.id)
  if (!invoiceId) return null

  const detalles = propiedad(propiedad(inv, 'parent'), 'subscription_details')
  const lineas = Array.isArray(inv.lines?.data) ? inv.lines.data : []
  const periodos = lineas.map((l) => propiedad(l, 'period'))
  const inicios = periodos.map((p) => epoch(propiedad(p, 'start'))).filter((v): v is string => v !== null)
  const fines = periodos.map((p) => epoch(propiedad(p, 'end'))).filter((v): v is string => v !== null)

  // basil+: `line.pricing.price_details.price`. Antes: `line.price.id`.
  const precios = lineas
    .map((l) => id(propiedad(propiedad(propiedad(l, 'pricing'), 'price_details'), 'price')) ?? id(propiedad(l, 'price')))
    .filter((v): v is string => v !== null)

  const centavos = pagada ? inv.amount_paid : inv.amount_due
  return {
    invoiceId,
    subscriptionId: id(propiedad(detalles, 'subscription')) ?? id(propiedad(inv, 'subscription')),
    customerId: id(inv.customer),
    email: texto(inv.customer_email)?.toLowerCase() ?? null,
    nombre: texto(inv.customer_name),
    monto: typeof centavos === 'number' ? centavos / 100 : 0,
    moneda: (texto(inv.currency) ?? 'mxn').toLowerCase(),
    period_start: inicios.sort()[0] ?? null,
    period_end: fines.sort().reverse()[0] ?? null,
    plan: marcaDe(propiedad(detalles, 'metadata')),
    planId: marcaIdDe(propiedad(detalles, 'metadata')),
    precios,
  }
}

export type CheckoutLeido = {
  sessionId: string
  subscriptionId: string | null
  customerId: string | null
  email: string | null
  nombre: string | null
  /** El `user_id` que mandó /vaip cuando la persona ya tenía sesión. */
  referencia: string | null
  pagado: boolean
  plan: string | null
  planId: string | null
}

export function leerCheckout(sesion: Stripe.Checkout.Session): CheckoutLeido | null {
  const sessionId = texto(sesion.id)
  if (!sessionId || sesion.mode !== 'subscription') return null
  return {
    sessionId,
    subscriptionId: id(sesion.subscription),
    customerId: id(sesion.customer),
    email: (texto(sesion.customer_details?.email) ?? texto(sesion.customer_email))?.toLowerCase() ?? null,
    nombre: texto(sesion.customer_details?.name),
    referencia: texto(sesion.client_reference_id),
    pagado: sesion.payment_status === 'paid',
    plan: marcaDe(sesion.metadata),
    planId: marcaIdDe(sesion.metadata),
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function esUuid(valor: string | null): valor is string {
  return Boolean(valor && UUID.test(valor))
}
