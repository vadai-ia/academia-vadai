import 'server-only'

import type Stripe from 'stripe'

import { accesoHasta } from '@/lib/membresia/acceso'
import { motivoDeStripe, type ClaveDeMotivo } from '@/lib/membresia/motivos'
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
 * si trae la marca del plan (`metadata.academia_plan` o, desde M18,
 * `academia_plan_id`) o cobra un precio que un plan nuestro haya tenido
 * (`membership_plan_prices`: quien pagó el precio viejo lo sigue pagando). Lo
 * demás se responde 200 sin tocar nada.
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

export type Plan = { id: string; slug: string; hub_course_id: string | null; precios: string[] }

async function planes(): Promise<Plan[]> {
  const supabase = crearClienteServiceRole()
  const [{ data, error }, { data: historial, error: errorHistorial }] = await Promise.all([
    supabase.from('membership_plans').select('id, slug, stripe_price_id, hub_course_id'),
    supabase.from('membership_plan_prices').select('plan_id, stripe_price_id'),
  ])
  if (error || errorHistorial) {
    throw new Error(`No se pudieron leer los planes: ${(error ?? errorHistorial)?.message}`)
  }
  return (data ?? []).map((p) => ({
    id: p.id,
    slug: p.slug,
    hub_course_id: p.hub_course_id,
    precios: [
      ...(p.stripe_price_id ? [p.stripe_price_id] : []),
      ...(historial ?? []).filter((h) => h.plan_id === p.id).map((h) => h.stripe_price_id),
    ],
  }))
}

function planDe(todos: Plan[], marca: { slug: string | null; id: string | null }, precios: string[]): Plan | null {
  return (
    todos.find((p) => marca.id !== null && p.id === marca.id) ??
    todos.find((p) => marca.slug !== null && p.slug === marca.slug) ??
    todos.find((p) => p.precios.some((precio) => precios.includes(precio))) ??
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

/**
 * `deStripeAhora`: la suscripción no viene de un evento sino de la respuesta de
 * Stripe a un cambio que la plataforma acaba de hacer (cancelar o seguir). Es
 * el estado actual, así que no pasa por el candado de eventos atrasados: con
 * el reloj de Stripe un poco adelantado al nuestro, el evento anterior parecía
 * más nuevo y «Seguir con mi membresía» no se aplicaba (lo encontró
 * test-planes). `last_event_at` se queda en la fecha más reciente de las dos,
 * para que el siguiente evento real sí entre.
 */
async function aplicarSuscripcion(
  plan: Plan,
  s: SuscripcionLeida,
  creado: string,
  deStripeAhora = false
): Promise<void> {
  const supabase = crearClienteServiceRole()
  const previa = await membresiaPorSuscripcion(s.subscriptionId)
  const anterior = previa?.last_event_at ? Date.parse(previa.last_event_at) : null

  if (!deStripeAhora && anterior !== null && anterior > Date.parse(creado)) {
    registrar('membresia:eventoAtrasado', { subscriptionId: s.subscriptionId, creado })
    return
  }
  const marca = anterior !== null && anterior > Date.parse(creado) ? new Date(anterior).toISOString() : creado

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
      last_event_at: marca,
    },
    { onConflict: 'stripe_subscription_id' }
  )
  if (error) throw new Error(`No se pudo guardar la suscripción: ${error.message}`)

  registrar('membresia:suscripcion', {
    subscriptionId: s.subscriptionId,
    estado: s.status,
    cancelaAlFinal: s.cancel_at_period_end,
  })

  await anotarCancelacion(plan, s, previa?.user_id ?? null)
  if (previa?.user_id) await sincronizarMembresia(previa.user_id, plan.id)
}

/**
 * La bitácora de cancelaciones (M18), desde lo que dice la suscripción:
 *
 *   - pidió cancelar (al fin del periodo, o terminó por petición) y no hay una
 *     cancelación abierta: se abre con el motivo que dejó en el portal;
 *   - volvió atrás (ya no cancela y sigue viva): la abierta se cierra.
 *
 * Una que termina por falta de pago no es una cancelación: no la eligió nadie.
 * La plataforma abre la suya con su propio motivo (`anotarMotivoPropio`); si
 * el webhook llega primero, la plataforma la corrige.
 */
async function anotarCancelacion(plan: Plan, s: SuscripcionLeida, userId: string | null): Promise<void> {
  const supabase = crearClienteServiceRole()
  const pidio =
    s.cancel_at_period_end || (s.status === 'canceled' && s.cancelacion.razon === 'cancellation_requested')
  const viva = s.status === 'active' || s.status === 'trialing' || s.status === 'past_due'

  if (pidio) {
    const { error } = await supabase.from('membership_cancellations').insert({
      plan_id: plan.id,
      stripe_subscription_id: s.subscriptionId,
      user_id: userId,
      reason: motivoDeStripe(s.cancelacion.motivo),
      comment: s.cancelacion.comentario?.slice(0, 1000) ?? null,
      origin: 'portal',
    })
    // 23505: ya había una abierta (la de la plataforma, o un evento repetido).
    if (error && error.code !== '23505') {
      registrar('membresia:cancelacionFallida', { subscriptionId: s.subscriptionId, error: error.message })
    }
  } else if (viva) {
    await supabase
      .from('membership_cancellations')
      .update({ reverted_at: new Date().toISOString() })
      .eq('stripe_subscription_id', s.subscriptionId)
      .is('reverted_at', null)
  }
}

/**
 * El motivo elegido en los pasos de /perfil/membresia. Si el webhook ya abrió
 * la cancelación (llegó antes que la respuesta de Stripe a la plataforma), se
 * corrige con el motivo propio, que es más fino que el de Stripe.
 */
export async function anotarMotivoPropio(
  planId: string,
  datos: { subscriptionId: string; userId: string; motivo: ClaveDeMotivo; comentario: string | null }
): Promise<void> {
  const supabase = crearClienteServiceRole()
  const fila = { reason: datos.motivo, comment: datos.comentario, origin: 'plataforma' as const }
  const { error } = await supabase.from('membership_cancellations').insert({
    ...fila,
    plan_id: planId,
    stripe_subscription_id: datos.subscriptionId,
    user_id: datos.userId,
  })
  if (error?.code === '23505') {
    await supabase
      .from('membership_cancellations')
      .update(fila)
      .eq('stripe_subscription_id', datos.subscriptionId)
      .is('reverted_at', null)
  } else if (error) {
    registrar('membresia:motivoFallido', { subscriptionId: datos.subscriptionId, error: error.message })
  }
}

/**
 * Lo que la plataforma acaba de cambiar en Stripe (cancelar o seguir), aplicado
 * de inmediato sin esperar al webhook: la persona ve el resultado al recargar.
 * Es el mismo camino que el evento; el evento que llegue después trae lo mismo.
 */
export async function aplicarDesdeLaPlataforma(plan: Plan, sub: Stripe.Subscription): Promise<void> {
  const s = leerSuscripcion(sub)
  if (!s) throw new Error('Stripe devolvió una suscripción que no se pudo leer.')
  await aplicarSuscripcion(plan, s, new Date().toISOString(), true)
}

/** El plan con sus precios, para quien cambia una suscripción fuera del webhook. */
export async function planParaStripe(planId: string): Promise<Plan | null> {
  return (await planes()).find((p) => p.id === planId) ?? null
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
      const plan = planDe(await planes(), { slug: c.plan, id: c.planId }, [])
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
      const plan =
        planDe(todos, { slug: s.plan, id: s.planId }, s.precios) ?? todos.find((p) => p.id === previa?.plan_id) ?? null
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
      const plan =
        planDe(todos, { slug: f.plan, id: f.planId }, f.precios) ?? todos.find((p) => p.id === previa?.plan_id) ?? null
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
