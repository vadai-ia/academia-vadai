import 'server-only'

import { casaDeVaip } from '@/lib/membresia/consultas'
import { crearClienteServidor } from '@/lib/supabase/server'
import type { Perfil } from '@/lib/auth/sesion'

/**
 * Cuántas novedades tiene pendientes cada canal de la navegación.
 *
 * Blog y Comunidad dejaron de ser un rincón dentro del curso para ser dos
 * destinos de la barra principal (21-sep-2026), y un destino sin señal es un
 * destino al que nadie vuelve: hay que entrar a ver si hay algo, comprobar que
 * no, y dejar de entrar.
 *
 * Sigue SIN haber tabla de notificaciones, igual que en la campana: "nuevo" es
 * lo publicado después de la marca de visto del canal
 * (`profiles.blog_seen_at`, `profiles.community_seen_at`). Abrir el canal la
 * sella.
 *
 * Lo propio nunca cuenta. Ver un "1" y descubrir que era tu propio comentario
 * es la forma más rápida de enseñarle a alguien a ignorar el contador.
 *
 * M22 (20-oct-2026): la pastilla Comunidad salió del menú. Su marca
 * (`community_seen_at`) ahora es la del muro de V-AI-P: el número va en la
 * pastilla V-AI-P y se apaga al abrir su muro. RLS hace que a quien no es
 * miembro le dé cero. Las respuestas en los muros de los cursos avisan en la
 * campana («Te respondieron»).
 */

export type NovedadesDeCanales = { blog: number; vaip: number }

/** Quien nunca ha abierto un canal no ve "todo lo que existe" como pendiente. */
const TOPE = 99

/** Desde cuándo contar: la marca del canal, o el alta de la cuenta. */
function desdeCuando(marca: string | null, creadoEn: string | null): string {
  return marca ?? creadoEn ?? new Date(0).toISOString()
}

export async function novedadesDeCanales(perfil: Perfil): Promise<NovedadesDeCanales> {
  const supabase = await crearClienteServidor()

  const desdeBlog = desdeCuando(perfil.blog_seen_at, perfil.created_at)
  const desdeComunidad = desdeCuando(perfil.community_seen_at, perfil.created_at)

  const casa = await casaDeVaip()

  // Cuentan filas, no las traen: `head: true` con `count: 'exact'` devuelve el
  // número sin cuerpo. RLS decide qué entra en cada cuenta, así que nadie ve
  // novedades de un muro al que no pertenece.
  const [blog, posts, comentarios] = await Promise.all([
    supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('post_type', 'blog')
      .not('published_at', 'is', null)
      .gt('published_at', desdeBlog),

    casa
      ? supabase
          .from('community_posts')
          .select('id', { count: 'exact', head: true })
          .eq('course_id', casa.id)
          .eq('status', 'visible')
          .neq('user_id', perfil.user_id)
          .gt('created_at', desdeComunidad)
      : Promise.resolve({ count: 0, error: null }),

    // Los comentarios no traen su curso: se piden los nuevos y se cuentan los
    // que cuelgan de una publicación de la casa.
    casa
      ? supabase
          .from('community_comments')
          .select('post_id')
          .eq('status', 'visible')
          .neq('user_id', perfil.user_id)
          .gt('created_at', desdeComunidad)
          .limit(300)
      : Promise.resolve({ data: [] as Array<{ post_id: string }>, error: null }),
  ])

  const idsDePosts = [...new Set((comentarios.data ?? []).map((c) => c.post_id))]
  const { count: comentariosEnLaCasa } =
    casa && idsDePosts.length
      ? await supabase
          .from('community_posts')
          .select('id', { count: 'exact', head: true })
          .eq('course_id', casa.id)
          .in('id', idsDePosts)
      : { count: 0 }

  for (const [nombre, r] of Object.entries({ blog, posts, comentarios })) {
    if (r.error) {
      console.error(JSON.stringify({ operacion: 'novedadesDeCanales', consulta: nombre, error: r.error.message }))
    }
  }

  return {
    blog: Math.min(blog.count ?? 0, TOPE),
    // Aproximado a propósito: cuenta las publicaciones con comentarios nuevos,
    // no cada comentario. Para la pastilla basta con «hay algo nuevo».
    vaip: Math.min((posts.count ?? 0) + (comentariosEnLaCasa ?? 0), TOPE),
  }
}

/**
 * Sella un canal como visto. Lo llama la página del canal al abrirse.
 *
 * Falla en silencio con su renglón de log: que no se pueda sellar la marca no
 * puede impedir que la persona lea el canal que acaba de abrir.
 */
export async function sellarCanal(perfil: Perfil, canal: 'blog' | 'comunidad'): Promise<void> {
  const supabase = await crearClienteServidor()
  const ahora = new Date().toISOString()

  // Dos ramas explícitas y no una clave calculada: con `{ [columna]: valor }`
  // TypeScript pierde de vista qué columna es y rechaza el update entero.
  const cambio = canal === 'blog' ? { blog_seen_at: ahora } : { community_seen_at: ahora }

  const { error } = await supabase
    .from('profiles')
    .update(cambio)
    .eq('user_id', perfil.user_id)

  if (error) {
    console.error(JSON.stringify({ operacion: 'sellarCanal', canal, error: error.message }))
  }
}
