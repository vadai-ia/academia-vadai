import 'server-only'

import type Stripe from 'stripe'

import { accesoHasta } from '@/lib/membresia/acceso'
import { cursosDelPlan, sincronizarMembresia } from '@/lib/membresia/sincronizar'
import {
  esUuid,
  leerCheckout,
  leerFactura,
  leerSuscripcion,
  type FacturaLeida,
  type SuscripcionLeida,
} from '@/lib/membresia/stripe'
import { esCuentaQa } from '@/lib/qa'
import { darDeAlta } from '@/lib/stripe/provisioning'
import { crearClienteServiceRole } from '@/lib/supabase/service-role'

/**
 * Los eventos de Stripe de la membresía V-AI-P (M17).
 *
 * La cuenta de Stripe es COMPARTIDA con otros negocios de VADAI, y en cuanto el
 * endpoint escucha suscripciones recibe las de todos. Un evento es nuestro solo
 * si trae la marca del plan (`metadata.academia_plan`) o cobra el precio de un
 * plan nuestro. Lo demás se responde 200 sin tocar nada.
 *
 * Stripe no garantiza el orden: la suscripción puede llegar antes que el
 * checkout, y un `updated` viejo después de uno nuevo. Por eso todo hace upsert
 * por `stripe_subscription_id` y el estado solo avanza con eventos más nuevos
 * que el último aplicado (`last_event_at`).
 */

export const EVENTOS_DE_MEMBRESIA = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
] as const

function registrar(operacion: string, detalle: Record<string, unknown>) {
  console.log(JSON.stringify({ operacion, ...detalle }))
}

type Plan = { id: string; slug: string; stripe_price_id: string | null; hub_course_id: string | null }

async function planes(): Promise<Plan[]> {
  const supabase = crearClienteServiceRole()
  const { data, error } = await supabase
    .from('membership_plans')
    .select('id, slug, stripe_price_id, hub_course_id')
  if (error) throw new Error(`No se pudieron leer los planes: ${error.message}`)
  return data ?? []
}

function planDe(todos: Plan[], marca: string | null, precios: string[]): Plan | null {
  return (
    todos.find((p) => marca !== null && p.slug === marca) ??
    todos.find((p) => p.stripe_price_id !== null && precios.includes(p.stripe_price_id)) ??
    null
  )
}

async function membresiaPorSuscripcion(subscriptionId: string) {
  const supabase = crearClienteServiceRole()
  const { data } = await supabase
    .from('memberships')
    .select('id, plan_id, user_id, email, access_until, last_event_at')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle()
  return data
}

/**
 * La fila de la suscripción, si todavía no existe. Nace provisional —activa,
 * con el periodo que se conozca— y el primer evento de la suscripción la
 * corrige: `last_event_at` null deja que cualquiera la pise.
 */
async function asegurarMembresia(
  plan: Plan,
  subscriptionId: string,
  datos: { customerId: string | null; email: string | null; inicio?: string | null; fin?: string | null }
): Promise<void> {
  const supabase = crearClienteServiceRole()
  const provisional = {
    status: 'active' as const,
    current_period_start: datos.inicio ?? null,
    current_period_end: datos.fin ?? null,
    ended_at: null,
  }
  const { error } = await supabase.from('memberships').upsert(
    {
      plan_id: plan.id,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: datos.customerId,
      email: datos.email,
      ...provisional,
      access_until: accesoHasta(provisional),
    },
    { onConflict: 'stripe_subscription_id', ignoreDuplicates: true }
  )
  if (error) throw new Error(`No se pudo registrar la membresía: ${error.message}`)
}

/**
 * Le pone persona a la suscripción: la cuenta, la casa de V-AI-P y el resto de
 * los cursos del plan. La persona sale de `client_reference_id` (se suscribió
 * con sesión) o del correo del pago.
 */
async function enlazarPersona(
  plan: Plan,
  subscriptionId: string,
  datos: { email: string | null; nombre: string | null; referencia: string | null }
): Promise<void> {
  const supabase = crearClienteServiceRole()
  const membresia = await membresiaPorSuscripcion(subscriptionId)
  if (!membresia) return

  if (membresia.user_id) {
    await sincronizarMembresia(membresia.user_id, plan.id)
    return
  }

  let correo = datos.email
  if (esUuid(datos.referencia)) {
    const { data: perfil } = await supabase
      .from('profiles')
      .select('email')
      .eq('user_id', datos.referencia)
      .maybeSingle()
    if (perfil) correo = perfil.email
  }
  if (!correo) {
    registrar('membresia:sinCorreo', { subscriptionId })
    return
  }

  // La bienvenida nombra todo lo que trae la membresía, en un solo correo.
  const cursos = await cursosDelPlan(plan.id, esCuentaQa(correo))
  const casa = cursos.find((c) => c.id === plan.hub_course_id) ?? null

  const alta = await darDeAlta({
    email: correo,
    nombre: datos.nombre,
    courseId: casa?.id ?? null,
    origen: 'membresia',
    expiraEn: membresia.access_until,
    titulosParaCorreo: cursos.map((c) => c.title),
    urlRedireccion: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/nueva-contrasena`,
  })
  if (!alta.ok || !alta.userId) {
    // Se lanza para que Stripe reintente: el alta es idempotente.
    throw new Error(`Alta de membresía fallida: ${alta.motivo ?? 'sin motivo'}`)
  }

  const { error } = await supabase
    .from('memberships')
    .update({ user_id: alta.userId, email: correo })
    .eq('stripe_subscription_id', subscriptionId)
  if (error) throw new Error(`No se pudo enlazar la membresía: ${error.message}`)

  // La bienvenida (o el aviso) ya nombró los cursos: aquí no se repite.
  await sincronizarMembresia(alta.userId, plan.id, { avisar: false })
  registrar('membresia:enlazada', { subscriptionId, userId: alta.userId, cuentaNueva: alta.creado })
}

async function aplicarSuscripcion(plan: Plan, s: SuscripcionLeida, creado: string): Promise<void> {
  const supabase = crearClienteServiceRole()
  const previa = await membresiaPorSuscripcion(s.subscriptionId)

  if (previa?.last_event_at && Date.parse(previa.last_event_at) > Date.parse(creado)) {
    registrar('membresia:eventoAtrasado', { subscriptionId: s.subscriptionId, creado })
    return
  }

  const { error } = await supabase.from('memberships').upsert(
    {
      plan_id: plan.id,
      stripe_subscription_id: s.subscriptionId,
      ...(s.customerId ? { stripe_customer_id: s.customerId } : {}),
      status: s.status,
      current_period_start: s.current_period_start,
      current_period_end: s.current_period_end,
      cancel_at_period_end: s.cancel_at_period_end,
      ended_at: s.ended_at,
      access_until: accesoHasta(s),
      last_event_at: creado,
    },
    { onConflict: 'stripe_subscription_id' }
  )
  if (error) throw new Error(`No se pudo guardar la suscripción: ${error.message}`)

  registrar('membresia:suscripcion', {
    subscriptionId: s.subscriptionId,
    estado: s.status,
    cancelaAlFinal: s.cancel_at_period_end,
  })

  if (previa?.user_id) await sincronizarMembresia(previa.user_id, plan.id)
}

async function registrarFactura(plan: Plan, f: FacturaLeida, pagada: boolean): Promise<void> {
  if (!f.subscriptionId) return
  const supabase = crearClienteServiceRole()
  const membresia = await membresiaPorSuscripcion(f.subscriptionId)

  const { error } = await supabase.from('membership_invoices').upsert(
    {
      stripe_invoice_id: f.invoiceId,
      stripe_subscription_id: f.subscriptionId,
      plan_id: plan.id,
      user_id: membresia?.user_id ?? null,
      email: f.email ?? membresia?.email ?? null,
      amount: f.monto,
      currency: f.moneda,
      period_start: f.period_start,
      period_end: f.period_end,
      status: pagada ? 'paid' : 'failed',
    },
    { onConflict: 'stripe_invoice_id' }
  )
  if (error) throw new Error(`No se pudo registrar el cobro: ${error.message}`)
}

/**
 * Atiende un evento si es de la membresía. Devuelve false si no lo es, para que
 * el webhook siga con sus otros caminos (o lo dé por ajeno).
 */
export async function manejarEventoDeMembresia(evento: Stripe.Event): Promise<boolean> {
  const creado = new Date(evento.created * 1000).toISOString()

  switch (evento.type) {
    case 'checkout.session.completed': {
      const c = leerCheckout(evento.data.object)
      if (!c) return false
      const plan = planDe(await planes(), c.plan, [])
      if (!plan) {
        registrar('membresia:checkoutAjeno', { sesion: c.sessionId })
        return true
      }
      if (!c.pagado || !c.subscriptionId) {
        registrar('membresia:checkoutSinPagar', { sesion: c.sessionId })
        return true
      }
      await asegurarMembresia(plan, c.subscriptionId, { customerId: c.customerId, email: c.email })
      await enlazarPersona(plan, c.subscriptionId, { email: c.email, nombre: c.nombre, referencia: c.referencia })
      return true
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const s = leerSuscripcion(evento.data.object)
      if (!s) return true
      const todos = await planes()
      const previa = await membresiaPorSuscripcion(s.subscriptionId)
      const plan = planDe(todos, s.plan, s.precios) ?? todos.find((p) => p.id === previa?.plan_id) ?? null
      if (!plan) {
        registrar('membresia:suscripcionAjena', { subscriptionId: s.subscriptionId })
        return true
      }
      await aplicarSuscripcion(plan, s, creado)
      return true
    }

    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const pagada = evento.type === 'invoice.paid'
      const f = leerFactura(evento.data.object, pagada)
      if (!f?.subscriptionId) return true
      const todos = await planes()
      const previa = await membresiaPorSuscripcion(f.subscriptionId)
      const plan = planDe(todos, f.plan, f.precios) ?? todos.find((p) => p.id === previa?.plan_id) ?? null
      if (!plan) {
        registrar('membresia:facturaAjena', { factura: f.invoiceId })
        return true
      }
      if (pagada) {
        await asegurarMembresia(plan, f.subscriptionId, {
          customerId: f.customerId,
          email: f.email,
          inicio: f.period_start,
          fin: f.period_end,
        })
      }
      await registrarFactura(plan, f, pagada)
      if (pagada) {
        await enlazarPersona(plan, f.subscriptionId, { email: f.email, nombre: f.nombre, referencia: null })
      }
      return true
    }

    default:
      return false
  }
}
