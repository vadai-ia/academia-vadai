'use server'

import { revalidatePath } from 'next/cache'

import { exigirPerfil } from '@/lib/auth/sesion'
import { esEmoji } from '@/lib/comunidad/emojis'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * Poner y quitar una reacción, con el mismo botón.
 *
 * Es un `alternar`, no un "dar me gusta": el segundo toque en el mismo emoji lo
 * retira. Sin eso, una reacción puesta sin querer no se puede deshacer, que es
 * exactamente lo que vuelve a la gente reacia a tocar nada.
 *
 * No devuelve estado: la acción va directa en el `action` de un `<form>` y lo
 * que se ve al terminar es la lista ya actualizada. Un error aquí no merece una
 * pantalla —reaccionar no es publicar— pero sí un renglón en el log.
 *
 * Quién puede reaccionar lo decide RLS (`academia_0030`), no este archivo:
 * hay que poder ver el hilo. El equipo puede en cualquier curso, igual que
 * puede comentar.
 */
export async function alternarReaccion(datos: FormData): Promise<void> {
  const perfil = await exigirPerfil()

  const emoji = String(datos.get('emoji') ?? '')
  const postId = String(datos.get('post_id') ?? '')
  const comentarioId = String(datos.get('comentario_id') ?? '')
  const rutaDeVuelta = String(datos.get('ruta') ?? '')

  // La lista es cerrada aquí y en el constraint de la base. Aquí para no gastar
  // un viaje; allá porque es la que manda.
  if (!esEmoji(emoji)) return
  if (!postId && !comentarioId) return
  if (postId && comentarioId) return

  const supabase = await crearClienteServidor()

  // Dos ramas explícitas en vez de una clave calculada: con `{ [col]: valor }`
  // TypeScript pierde de vista qué columna es y rechaza la consulta entera.
  const buscar = supabase
    .from('community_reactions')
    .select('id')
    .eq('user_id', perfil.user_id)
    .eq('emoji', emoji)

  const { data: ya } = await (postId
    ? buscar.eq('post_id', postId)
    : buscar.eq('comment_id', comentarioId)
  ).maybeSingle()

  if (ya) {
    const { error } = await supabase.from('community_reactions').delete().eq('id', ya.id)
    if (error) {
      console.error(JSON.stringify({ operacion: 'alternarReaccion:quitar', error: error.message }))
    }
  } else {
    // Dos inserts literales y no uno con la fila en una variable: con la
    // union, TypeScript no puede casarla con la firma de `insert`.
    const { error } = postId
      ? await supabase
          .from('community_reactions')
          .insert({ post_id: postId, user_id: perfil.user_id, emoji })
      : await supabase
          .from('community_reactions')
          .insert({ comment_id: comentarioId, user_id: perfil.user_id, emoji })

    if (error) {
      console.error(JSON.stringify({ operacion: 'alternarReaccion:poner', error: error.message }))
    }
  }

  // La ruta viaja en el formulario porque el mismo botón se pinta en la
  // comunidad de un curso y en la comunidad general, y hay que refrescar
  // aquella desde la que se tocó.
  if (rutaDeVuelta.startsWith('/')) revalidatePath(rutaDeVuelta)
}
