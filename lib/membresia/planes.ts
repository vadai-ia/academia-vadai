import 'server-only'

import { vigente } from '@/lib/membresia/acceso'
import { esCuentaQa, esCursoQa } from '@/lib/qa'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * Los planes en el panel (M18). Con la sesión del admin: `membership_plans`
 * en borrador, los precios, las membresías y las cancelaciones solo los lee
 * `is_admin()`. El community manager no llega aquí.
 */

export type EstadoDePlan = 'draft' | 'active' | 'archived'

export const ETIQUETA_ESTADO_PLAN: Record<EstadoDePlan, string> = {
  draft: 'Borrador',
  active: 'A la venta',
  archived: 'Archivado',
}

export type PlanDelPanel = {
  id: string
  slug: string
  nombre: string
  precioMxn: number
  precioTachadoMxn: number | null
  frase: string | null
  descripcion: string | null
  imagen: string | null
  estado: EstadoDePlan
  casaId: string | null
  cursos: string[]
  linkDePago: string | null
  portal: string | null
  /** Ya existe en Stripe: el slug queda fijo. */
  enStripe: boolean
  /** Lo que cobra hoy el link de pago, o null si no hay link. */
  precioEnStripe: number | null
  miembrosVigentes: number
  stripe: {
    productId: string | null
    priceId: string | null
    linkId: string | null
    portalId: string | null
  }
}

type FilaPlan = {
  id: string
  slug: string
  name: string
  price_mxn: number
  price_compare_mxn: number | null
  tagline: string | null
  description: string | null
  image_url: string | null
  status: EstadoDePlan
  hub_course_id: string | null
  stripe_product_id: string | null
  stripe_price_id: string | null
  stripe_payment_link: string | null
  stripe_payment_link_id: string | null
  stripe_portal_config_id: string | null
  portal_login_url: string | null
}

const COLUMNAS =
  'id, slug, name, price_mxn, price_compare_mxn, tagline, description, image_url, status, hub_course_id, stripe_product_id, stripe_price_id, stripe_payment_link, stripe_payment_link_id, stripe_portal_config_id, portal_login_url'

async function armar(filas: FilaPlan[]): Promise<PlanDelPanel[]> {
  if (filas.length === 0) return []
  const supabase = await crearClienteServidor()
  const ids = filas.map((f) => f.id)
  const [{ data: enlaces }, { data: precios }, { data: membresias }] = await Promise.all([
    supabase.from('membership_plan_courses').select('plan_id, course_id').in('plan_id', ids),
    supabase.from('membership_plan_prices').select('stripe_price_id, amount_mxn').in('plan_id', ids),
    supabase.from('memberships').select('plan_id, user_id, email, access_until').in('plan_id', ids),
  ])
  const montoDe = new Map((precios ?? []).map((p) => [p.stripe_price_id, Number(p.amount_mxn)]))

  return filas.map((f) => {
    // Una persona cuenta una vez aunque tenga varias suscripciones. Sin QA.
    const vigentes = new Set(
      (membresias ?? [])
        .filter((m) => m.plan_id === f.id && m.user_id !== null && !esCuentaQa(m.email) && vigente(m.access_until))
        .map((m) => m.user_id)
    )
    return {
      id: f.id,
      slug: f.slug,
      nombre: f.name,
      precioMxn: Number(f.price_mxn),
      precioTachadoMxn: f.price_compare_mxn === null ? null : Number(f.price_compare_mxn),
      frase: f.tagline,
      descripcion: f.description,
      imagen: f.image_url,
      estado: f.status,
      casaId: f.hub_course_id,
      cursos: (enlaces ?? []).filter((e) => e.plan_id === f.id).map((e) => e.course_id),
      linkDePago: f.stripe_payment_link,
      portal: f.portal_login_url,
      enStripe: f.stripe_product_id !== null,
      precioEnStripe: f.stripe_price_id ? (montoDe.get(f.stripe_price_id) ?? null) : null,
      miembrosVigentes: vigentes.size,
      stripe: {
        productId: f.stripe_product_id,
        priceId: f.stripe_price_id,
        linkId: f.stripe_payment_link_id,
        portalId: f.stripe_portal_config_id,
      },
    }
  })
}

export async function listarPlanes(): Promise<PlanDelPanel[]> {
  const supabase = await crearClienteServidor()
  const { data } = await supabase.from('membership_plans').select(COLUMNAS).order('created_at')
  const planes = await armar(data ?? [])
  // A la venta primero; archivados al final.
  const orden: Record<EstadoDePlan, number> = { active: 0, draft: 1, archived: 2 }
  return planes.sort((a, b) => orden[a.estado] - orden[b.estado])
}

export async function planDelPanel(id: string): Promise<PlanDelPanel | null> {
  const supabase = await crearClienteServidor()
  const { data } = await supabase.from('membership_plans').select(COLUMNAS).eq('id', id).maybeSingle()
  return data ? ((await armar([data]))[0] ?? null) : null
}

export type CursoElegible = { id: string; titulo: string; publicado: boolean }

/** Los cursos que se pueden meter en un plan. Los QA solo los ve una cuenta QA. */
export async function cursosElegibles(correoDeQuienMira: string): Promise<CursoElegible[]> {
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('courses')
    .select('id, slug, title, status')
    .neq('status', 'archived')
    .order('title')
  const veQa = esCuentaQa(correoDeQuienMira)
  return (data ?? [])
    .filter((c) => veQa || !esCursoQa(c.slug))
    .map((c) => ({ id: c.id, titulo: c.title, publicado: c.status === 'published' }))
}

export type CancelacionDelPanel = {
  id: string
  correo: string | null
  nombre: string | null
  motivo: string
  comentario: string | null
  origen: 'plataforma' | 'portal'
  fecha: string
  revertida: boolean
}

/** Las últimas cancelaciones de un plan, con su motivo. Sin QA. */
export async function cancelacionesDelPlan(planId: string, limite = 30): Promise<CancelacionDelPanel[]> {
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('membership_cancellations')
    .select('id, user_id, stripe_subscription_id, reason, comment, origin, created_at, reverted_at')
    .eq('plan_id', planId)
    .order('created_at', { ascending: false })
    .limit(limite * 2)
  const filas = data ?? []
  const ids = [...new Set(filas.map((f) => f.user_id).filter((v): v is string => v !== null))]
  const { data: perfiles } = ids.length
    ? await supabase.from('profiles').select('user_id, email, full_name').in('user_id', ids)
    : { data: [] }
  const perfilDe = new Map((perfiles ?? []).map((p) => [p.user_id, p]))

  return filas
    .map((f) => {
      const perfil = f.user_id ? perfilDe.get(f.user_id) : undefined
      return {
        id: f.id,
        correo: perfil?.email ?? null,
        nombre: perfil?.full_name ?? null,
        motivo: f.reason,
        comentario: f.comment,
        origen: f.origin,
        fecha: f.created_at,
        revertida: f.reverted_at !== null,
      }
    })
    .filter((c) => !esCuentaQa(c.correo))
    .slice(0, limite)
}
