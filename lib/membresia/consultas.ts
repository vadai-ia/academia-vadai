import 'server-only'

import { accesoMayor, vigente, type EstadoSuscripcion } from '@/lib/membresia/acceso'
import { crearClienteServidor } from '@/lib/supabase/server'
import { crearClienteServiceRole } from '@/lib/supabase/service-role'

/** El plan de la academia. Hoy hay uno. */
export const SLUG_VAIP = 'v-ai-p'

export type PlanVaip = {
  id: string
  nombre: string
  precioMxn: number
  linkDePago: string | null
  portal: string | null
  casa: { id: string; slug: string; publicada: boolean } | null
  /** Se puede suscribir: hay link de pago y la casa está publicada. */
  abierto: boolean
}

/**
 * El plan para la página pública /vaip, que no exige sesión.
 *
 * Service role a propósito y solo de lectura: son los datos de venta (nombre,
 * precio, link de pago), lo mismo que se imprime en el QR. Es el mismo criterio
 * que la verificación pública de certificados.
 */
export async function planVaip(): Promise<PlanVaip | null> {
  const supabase = crearClienteServiceRole()
  const { data: plan } = await supabase
    .from('membership_plans')
    .select('id, name, price_mxn, stripe_payment_link, portal_login_url, hub_course_id')
    .eq('slug', SLUG_VAIP)
    .maybeSingle()
  if (!plan) return null

  const { data: casa } = plan.hub_course_id
    ? await supabase.from('courses').select('id, slug, status').eq('id', plan.hub_course_id).maybeSingle()
    : { data: null }

  const publicada = casa?.status === 'published'
  return {
    id: plan.id,
    nombre: plan.name,
    precioMxn: Number(plan.price_mxn),
    linkDePago: plan.stripe_payment_link,
    portal: plan.portal_login_url,
    casa: casa ? { id: casa.id, slug: casa.slug, publicada } : null,
    abierto: Boolean(plan.stripe_payment_link) && publicada,
  }
}

export type MiMembresia = {
  estado: EstadoSuscripcion
  accesoHasta: string | null
  proximoCobro: string | null
  seCancela: boolean
  vigente: boolean
  /** Tiene más de una suscripción activa: algo que el equipo debe revisar. */
  duplicada: boolean
}

/**
 * La membresía de quien pide la página, con su sesión (RLS: cada quien ve la
 * suya). Si tiene varias —canceló y volvió—, manda la de mayor acceso.
 */
export async function miMembresia(planId: string): Promise<MiMembresia | null> {
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('memberships')
    .select('status, access_until, current_period_end, cancel_at_period_end')
    .eq('plan_id', planId)
  const filas = data ?? []
  const hasta = accesoMayor(filas.map((f) => f.access_until))
  const principal = filas.find((f) => f.access_until !== null && Date.parse(f.access_until) === Date.parse(hasta ?? '')) ?? filas[0]
  if (!principal) return null
  const vivas = filas.filter((f) => f.status === 'active' || f.status === 'past_due' || f.status === 'trialing')

  return {
    estado: principal.status,
    accesoHasta: hasta,
    proximoCobro:
      principal.status === 'active' && !principal.cancel_at_period_end ? principal.current_period_end : null,
    seCancela: principal.cancel_at_period_end,
    vigente: vigente(hasta),
    duplicada: vivas.length > 1,
  }
}

/**
 * El link de pago con la persona ya puesta: el correo de su cuenta y su id en
 * `client_reference_id`, para que el webhook la reconozca aunque cambie el
 * correo en el formulario de Stripe.
 */
export function enlaceDeSuscripcion(link: string, persona: { correo: string; userId: string } | null): string {
  if (!persona) return link
  try {
    const url = new URL(link)
    url.searchParams.set('prefilled_email', persona.correo)
    url.searchParams.set('client_reference_id', persona.userId)
    return url.toString()
  } catch {
    return link
  }
}

/** El portal de clientes con el correo puesto: la persona solo confirma el código que le llega. */
export function enlaceDelPortal(portal: string, correo: string | null): string {
  if (!correo) return portal
  try {
    const url = new URL(portal)
    url.searchParams.set('prefilled_email', correo)
    return url.toString()
  } catch {
    return portal
  }
}
