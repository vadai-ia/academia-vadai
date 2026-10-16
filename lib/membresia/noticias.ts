import 'server-only'

import { feedDelCurso, type PostDeComunidad } from '@/lib/comunidad/posts'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * Las noticias de V-AI-P (M19): las publicaciones del tema «Noticias» del muro
 * de la casa (academia_0043), donde solo publica el equipo. Son publicaciones
 * normales —comentarios, reacciones, puntos por comentar—; esto solo las
 * junta para el espacio del miembro y el portal del equipo.
 */

export const SLUG_NOTICIAS = 'noticias'

export type NoticiasDeVaip = {
  /** null si la casa todavía no tiene el tema (falta la migración 0043). */
  temaId: string | null
  generacionId: string | null
  noticias: PostDeComunidad[]
}

/**
 * Con la sesión de quien mira. `generacionId`: la del miembro en la casa; si
 * no la trae (alguien del equipo), la abierta de la casa.
 */
export async function noticiasDeVaip(
  casaId: string,
  usuarioActual: string,
  opciones: { generacionId?: string | null; cuantas?: number } = {}
): Promise<NoticiasDeVaip> {
  const supabase = await crearClienteServidor()
  const [{ data: tema }, { data: generaciones }] = await Promise.all([
    supabase.from('community_topics').select('id').eq('course_id', casaId).eq('slug', SLUG_NOTICIAS).maybeSingle(),
    opciones.generacionId
      ? Promise.resolve({ data: [{ id: opciones.generacionId }] })
      : supabase
          .from('cohorts')
          .select('id')
          .eq('course_id', casaId)
          .order('open_for_enrollment', { ascending: false })
          .order('starts_on', { ascending: false })
          .limit(1),
  ])
  const generacionId = generaciones?.[0]?.id ?? null
  if (!tema) return { temaId: null, generacionId, noticias: [] }

  const feed = await feedDelCurso(casaId, generacionId, usuarioActual, {
    temaId: tema.id,
    porPagina: opciones.cuantas ?? 3,
  })
  return { temaId: tema.id, generacionId, noticias: feed.posts }
}
