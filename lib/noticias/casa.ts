import 'server-only'

import { esModoQa } from '@/lib/agente/claude'
import type { ClienteAgente } from '@/lib/agente/servidor'

/**
 * El muro donde publica el panel de V-AI-P (M21, movido aquí en M24): la casa
 * del plan V-AI-P. En el servidor de la suite (`ANTHROPIC_SIMULADO`), la del
 * plan `qa-agente`: una prueba nunca escribe en el muro real, que es el de
 * producción y lo ven los miembros.
 */
export function planDeNoticias(): string {
  return esModoQa() ? 'qa-agente' : 'v-ai-p'
}

export type Casa = { id: string; slug: string }

export async function casaDeNoticias(db: ClienteAgente): Promise<Casa | null> {
  const { data: plan } = await db.from('membership_plans').select('hub_course_id').eq('slug', planDeNoticias()).maybeSingle()
  if (!plan?.hub_course_id) return null
  const { data: curso } = await db.from('courses').select('id, slug').eq('id', plan.hub_course_id).maybeSingle()
  return curso
}

/**
 * La liga a una publicación del muro. La casa real vive en /vaip (M22); la de
 * la suite, en la página de comunidad de su curso.
 */
export function urlDelMuro(casa: Casa, tema: string | null, postId?: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '')
  const consulta = tema ? `?tema=${encodeURIComponent(tema)}` : ''
  const ancla = postId ? `#publicacion-${postId}` : ''
  return planDeNoticias() === 'v-ai-p'
    ? `${base}/vaip${consulta}${ancla}`
    : `${base}/curso/${casa.slug}/comunidad${consulta}${ancla}`
}

/** La generación donde se publica en la casa: la abierta, o la más reciente. */
export async function generacionDeLaCasa(db: ClienteAgente, casaId: string): Promise<string | null> {
  const { data } = await db
    .from('cohorts')
    .select('id')
    .eq('course_id', casaId)
    .order('open_for_enrollment', { ascending: false })
    .order('starts_on', { ascending: false })
    .limit(1)
  return data?.[0]?.id ?? null
}
