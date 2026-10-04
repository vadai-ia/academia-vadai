import 'server-only'

import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * Lo que toca una moderación: el post, o todas sus copias si se publicó en
 * «todas las generaciones» (M16). Quien lo publicó en todas quiere fijarlo,
 * ocultarlo o borrarlo en todas.
 *
 * Vive aparte porque lo usan dos lugares: el muro del portal
 * (`acciones-posts.ts`) y la bandeja de Comunidad del panel.
 */
export async function filtroDeModeracion(id: string): Promise<{ columna: 'id' | 'broadcast_id'; valor: string }> {
  const supabase = await crearClienteServidor()
  const { data } = await supabase.from('community_posts').select('broadcast_id').eq('id', id).maybeSingle()
  return data?.broadcast_id ? { columna: 'broadcast_id', valor: data.broadcast_id } : { columna: 'id', valor: id }
}
