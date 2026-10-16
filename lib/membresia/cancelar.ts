'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { exigirPerfil } from '@/lib/auth/sesion'
import { SLUG_VAIP } from '@/lib/membresia/consultas'
import { esMotivo } from '@/lib/membresia/motivos'
import { aplicarDesdeLaPlataforma, anotarMotivoPropio, planParaStripe } from '@/lib/membresia/webhook'
import { cancelarAlFinalDelPeriodo, seguirConLaMembresia, suscripcionDelPlan } from '@/lib/stripe/admin'
import { crearClienteServidor } from '@/lib/supabase/server'
import { crearClienteServiceRole } from '@/lib/supabase/service-role'

/**
 * Cancelar y «Seguir con mi membresía» desde la plataforma (M18).
 *
 * Formularios sin estado que redirigen con el resultado en la URL: funcionan
 * sin JavaScript, como los pasos de /perfil/membresia.
 *
 * La suscripción que se toca sale SOLO de las membresías de quien tiene la
 * sesión (filtradas por su user_id), nunca del formulario. Antes de cambiarla
 * se comprueba en Stripe que sea de este plan y de este cliente: la cuenta es
 * de varios negocios. Después se aplica de inmediato (sin esperar al webhook)
 * con el mismo camino que el evento: eso escribe `memberships` y la bitácora
 * con service role, como el webhook.
 */

function registrar(operacion: string, detalle: Record<string, unknown>) {
  console.error(JSON.stringify({ operacion, ...detalle }))
}

const VIVAS = ['active', 'trialing', 'past_due'] as const

function volver(slug: string, extra: string): never {
  redirect(`/perfil/membresia?plan=${encodeURIComponent(slug)}&${extra}`)
}

async function planPorSlug(slug: string) {
  // Cualquier estado: quien pagó un plan que después se archivó sigue pudiendo cancelarlo.
  const { data } = await crearClienteServiceRole()
    .from('membership_plans')
    .select('id, slug')
    .eq('slug', slug)
    .maybeSingle()
  return data
}

/** La suscripción viva de quien pide, en este plan. La de mayor acceso, si tiene varias. */
async function miSuscripcion(planId: string, userId: string) {
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('memberships')
    .select('stripe_subscription_id, stripe_customer_id, cancel_at_period_end, access_until')
    .eq('plan_id', planId)
    .eq('user_id', userId)
    .in('status', [...VIVAS])
    .order('access_until', { ascending: false, nullsFirst: false })
    .limit(1)
  return data?.[0] ?? null
}

export async function cancelarMembresia(datos: FormData): Promise<void> {
  const perfil = await exigirPerfil()
  const slug = String(datos.get('plan') ?? SLUG_VAIP)
  const motivo = String(datos.get('motivo') ?? '')
  const comentario = String(datos.get('comentario') ?? '').trim().slice(0, 1000) || null
  if (!esMotivo(motivo)) volver(slug, 'paso=2&error=motivo')

  const plan = await planPorSlug(slug)
  if (!plan) redirect('/perfil')
  const mia = await miSuscripcion(plan.id, perfil.user_id)
  if (!mia) volver(slug, 'error=sin-membresia')
  if (mia.cancel_at_period_end) volver(slug, 'listo=cancelada')

  let resultado: 'ok' | 'no-coincide' | 'stripe' = 'ok'
  try {
    const sub = await suscripcionDelPlan(mia.stripe_subscription_id, plan, mia.stripe_customer_id)
    if (!sub) {
      resultado = 'no-coincide'
      registrar('membresia:cancelarNoCoincide', { userId: perfil.user_id, subscriptionId: mia.stripe_subscription_id })
    } else {
      const actualizada = await cancelarAlFinalDelPeriodo(sub.id, motivo, comentario)
      await anotarMotivoPropio(plan.id, { subscriptionId: sub.id, userId: perfil.user_id, motivo, comentario })
      const conPrecios = await planParaStripe(plan.id)
      if (conPrecios) await aplicarDesdeLaPlataforma(conPrecios, actualizada)
    }
  } catch (error) {
    resultado = 'stripe'
    registrar('membresia:cancelarFallo', {
      userId: perfil.user_id,
      subscriptionId: mia.stripe_subscription_id,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  revalidatePath('/perfil')
  revalidatePath('/perfil/membresia')
  revalidatePath('/vaip')
  if (resultado !== 'ok') volver(slug, `paso=3&motivo=${motivo}&error=${resultado}`)
  volver(slug, 'listo=cancelada')
}

export async function reactivarMembresia(datos: FormData): Promise<void> {
  const perfil = await exigirPerfil()
  const slug = String(datos.get('plan') ?? SLUG_VAIP)
  const plan = await planPorSlug(slug)
  if (!plan) redirect('/perfil')
  const mia = await miSuscripcion(plan.id, perfil.user_id)
  if (!mia) volver(slug, 'error=sin-membresia')
  if (!mia.cancel_at_period_end) volver(slug, 'listo=sigue')

  let resultado: 'ok' | 'no-coincide' | 'stripe' = 'ok'
  try {
    const sub = await suscripcionDelPlan(mia.stripe_subscription_id, plan, mia.stripe_customer_id)
    if (!sub) {
      resultado = 'no-coincide'
      registrar('membresia:reactivarNoCoincide', { userId: perfil.user_id, subscriptionId: mia.stripe_subscription_id })
    } else {
      const actualizada = await seguirConLaMembresia(sub.id)
      const conPrecios = await planParaStripe(plan.id)
      if (conPrecios) await aplicarDesdeLaPlataforma(conPrecios, actualizada)
    }
  } catch (error) {
    resultado = 'stripe'
    registrar('membresia:reactivarFallo', {
      userId: perfil.user_id,
      subscriptionId: mia.stripe_subscription_id,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  revalidatePath('/perfil')
  revalidatePath('/perfil/membresia')
  revalidatePath('/vaip')
  if (resultado !== 'ok') volver(slug, `error=${resultado}`)
  volver(slug, 'listo=sigue')
}
