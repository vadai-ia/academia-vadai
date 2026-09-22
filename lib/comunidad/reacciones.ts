import 'server-only'

import { type ReaccionesDe } from '@/lib/comunidad/emojis'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * Leer las reacciones de la comunidad (21-sep-2026).
 *
 * Nacieron porque la única forma de responderle a alguien era escribir un
 * comentario, y para "me gustó" eso es demasiado trabajo: la publicación se
 * queda sin una sola señal y quien la escribió cree que a nadie le importó.
 *
 * La lista de emojis vive en `emojis.ts`, que no es `server-only` porque
 * también la pinta el cliente.
 */

/**
 * Las reacciones de un lote de publicaciones y comentarios, en UNA consulta.
 *
 * Se piden todas juntas y se agrupan en memoria. La alternativa —una consulta
 * por publicación— eran cuarenta viajes para pintar un feed de veinte.
 */
export async function reaccionesDe(
  postIds: string[],
  comentarioIds: string[],
  usuarioActual: string
): Promise<{ posts: Map<string, ReaccionesDe>; comentarios: Map<string, ReaccionesDe> }> {
  const posts = new Map<string, ReaccionesDe>()
  const comentarios = new Map<string, ReaccionesDe>()

  if (postIds.length === 0 && comentarioIds.length === 0) return { posts, comentarios }

  const supabase = await crearClienteServidor()

  // `or` con dos `in`: una sola ida, las dos dianas.
  const partes: string[] = []
  if (postIds.length > 0) partes.push(`post_id.in.(${postIds.join(',')})`)
  if (comentarioIds.length > 0) partes.push(`comment_id.in.(${comentarioIds.join(',')})`)

  const { data, error } = await supabase
    .from('community_reactions')
    .select('post_id, comment_id, user_id, emoji')
    .or(partes.join(','))

  if (error) {
    console.error(JSON.stringify({ operacion: 'reaccionesDe', error: error.message }))
    return { posts, comentarios }
  }

  const sumar = (mapa: Map<string, ReaccionesDe>, id: string, emoji: string, mia: boolean) => {
    const actual = mapa.get(id) ?? { conteo: {}, mias: [] as string[], total: 0 }
    actual.conteo[emoji] = (actual.conteo[emoji] ?? 0) + 1
    actual.total += 1
    if (mia && !actual.mias.includes(emoji)) actual.mias.push(emoji)
    mapa.set(id, actual)
  }

  for (const r of data ?? []) {
    const mia = r.user_id === usuarioActual
    if (r.post_id) sumar(posts, r.post_id, r.emoji, mia)
    else if (r.comment_id) sumar(comentarios, r.comment_id, r.emoji, mia)
  }

  return { posts, comentarios }
}
