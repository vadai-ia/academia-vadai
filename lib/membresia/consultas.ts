import 'server-only'

import { cache } from 'react'

import { obtenerSesion } from '@/lib/auth/sesion'
import { accesoMayor, vigente, type EstadoSuscripcion } from '@/lib/membresia/acceso'
import { crearClienteServidor } from '@/lib/supabase/server'
import { crearClienteServiceRole } from '@/lib/supabase/service-role'

/** El plan de la comunidad. Vive en /vaip; los demás planes, en /membresias/<slug> (M18). */
export const SLUG_VAIP = 'v-ai-p'

export type PlanPublico = {
  id: string
  slug: string
  nombre: string
  precioMxn: number
  /** El precio de referencia que se tacha («precio de graduado»). Nunca se cobra. */
  precioTachadoMxn: number | null
  frase: string | null
  descripcion: string | null
  imagen: string | null
  linkDePago: string | null
  portal: string | null
  casa: { id: string; slug: string; publicada: boolean } | null
  /** Los cursos publicados que trae, para la página de venta. */
  cursos: string[]
  /** Se puede suscribir: activo, con link de pago y con algo publicado que dar. */
  abierto: boolean
}

/** Compatibilidad: así se llamaba cuando había un solo plan (M17). */
export type PlanVaip = PlanPublico

/**
 * Un plan ACTIVO para su página pública, que no exige sesión.
 *
 * Service role a propósito y solo de lectura: son los datos de venta (nombre,
 * precio, link de pago), lo mismo que se imprime en el QR. Es el mismo criterio
 * que la verificación pública de certificados. Un plan en borrador o archivado
 * no existe para el público.
 */
export async function planPublico(
  slug: string,
  opciones: { cualquierEstado?: boolean } = {}
): Promise<PlanPublico | null> {
  const supabase = crearClienteServiceRole()
  const consulta = supabase
    .from('membership_plans')
    .select(
      'id, slug, name, price_mxn, price_compare_mxn, tagline, description, image_url, stripe_payment_link, portal_login_url, hub_course_id, status'
    )
    .eq('slug', slug)
  // `cualquierEstado`: para quien ya es miembro (administrar o cancelar un plan
  // que después se archivó). La venta pública solo ve los activos.
  const { data: plan } = await (opciones.cualquierEstado ? consulta : consulta.eq('status', 'active')).maybeSingle()
  if (!plan) return null

  const { data: enlaces } = await supabase.from('membership_plan_courses').select('course_id').eq('plan_id', plan.id)
  const ids = (enlaces ?? []).map((e) => e.course_id)
  const { data: filas } = ids.length
    ? await supabase.from('courses').select('id, slug, title, status').in('id', ids)
    : { data: [] }
  const cursos = filas ?? []
  const casa = cursos.find((c) => c.id === plan.hub_course_id) ?? null
  const publicados = cursos.filter((c) => c.status === 'published')
  const publicada = casa?.status === 'published'

  return {
    id: plan.id,
    slug: plan.slug,
    nombre: plan.name,
    precioMxn: Number(plan.price_mxn),
    precioTachadoMxn: plan.price_compare_mxn === null ? null : Number(plan.price_compare_mxn),
    frase: plan.tagline,
    descripcion: plan.description,
    imagen: plan.image_url,
    linkDePago: plan.stripe_payment_link,
    portal: plan.portal_login_url,
    casa: casa ? { id: casa.id, slug: casa.slug, publicada } : null,
    cursos: publicados.map((c) => c.title),
    // Con casa, la casa tiene que estar publicada (es donde vive la comunidad);
    // sin casa, basta con un curso publicado que dar.
    abierto: plan.status === 'active' && Boolean(plan.stripe_payment_link) && (casa ? publicada : publicados.length > 0),
  }
}

export const planVaip = (): Promise<PlanPublico | null> => planPublico(SLUG_VAIP)

/**
 * Los cursos que trae V-AI-P, con la sesión de quien pregunta (la lista es
 * información de venta: la lee cualquiera con sesión). Memorizado por
 * petición: lo piden Mis cursos, el índice del curso y el espacio.
 */
export const cursosDeVaip = cache(async (): Promise<Set<string>> => {
  const supabase = await crearClienteServidor()
  const { data: plan } = await supabase.from('membership_plans').select('id').eq('slug', SLUG_VAIP).maybeSingle()
  if (!plan) return new Set()
  const { data } = await supabase.from('membership_plan_courses').select('course_id').eq('plan_id', plan.id)
  return new Set((data ?? []).map((f) => f.course_id))
})

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
 * La membresía de quien pide la página. Si tiene varias —canceló y volvió—,
 * manda la de mayor acceso.
 *
 * Filtrada por usuario a propósito: la RLS deja al admin leer TODAS las
 * membresías, y sin el filtro «Tu membresía» de un admin era la de todos.
 */
export async function miMembresia(planId: string): Promise<MiMembresia | null> {
  const sesion = await obtenerSesion()
  if (sesion.tipo !== 'activo') return null
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('memberships')
    .select('status, access_until, current_period_end, cancel_at_period_end')
    .eq('plan_id', planId)
    .eq('user_id', sesion.perfil.user_id)
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

export type MembresiaDePlan = {
  plan: { id: string; slug: string; nombre: string; linkDePago: string | null; portal: string | null; activo: boolean }
  membresia: MiMembresia
}

/**
 * Todas las membresías de quien entra, una por plan (M18), V-AI-P primero.
 * Los datos del plan salen con service role: son de venta (nombre, link,
 * portal), y un plan archivado sigue siendo de quien lo pagó.
 */
export async function misMembresias(): Promise<MembresiaDePlan[]> {
  const sesion = await obtenerSesion()
  if (sesion.tipo !== 'activo') return []
  const supabase = await crearClienteServidor()
  const { data: suyas } = await supabase
    .from('memberships')
    .select('plan_id')
    .eq('user_id', sesion.perfil.user_id)
  const ids = [...new Set((suyas ?? []).map((m) => m.plan_id))]
  if (ids.length === 0) return []

  const { data: planes } = await crearClienteServiceRole()
    .from('membership_plans')
    .select('id, slug, name, stripe_payment_link, portal_login_url, status')
    .in('id', ids)

  const salida: MembresiaDePlan[] = []
  for (const p of planes ?? []) {
    const membresia = await miMembresia(p.id)
    if (!membresia) continue
    salida.push({
      plan: {
        id: p.id,
        slug: p.slug,
        nombre: p.name,
        linkDePago: p.stripe_payment_link,
        portal: p.portal_login_url,
        activo: p.status === 'active',
      },
      membresia,
    })
  }
  return salida.sort((a, b) => Number(b.plan.slug === SLUG_VAIP) - Number(a.plan.slug === SLUG_VAIP))
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
