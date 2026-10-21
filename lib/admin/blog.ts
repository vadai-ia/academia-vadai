import 'server-only'

import { mundoVaip } from '@/lib/membresia/mundo'
import { crearClienteServidor } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/types'

export type PublicacionAdmin = {
  id: string
  titulo: string
  tipo: 'announcement' | 'blog'
  contenido: Json | null
  portada: string | null
  cursoAudiencia: string | null
  publicadoEn: string | null
  creadoEn: string
  /** Su audiencia es lo de V-AI-P: ya no se le muestra a nadie (M25). */
  deVaip: boolean
}

/** Todas las publicaciones, borradores incluidos. La policy da acceso al admin. */
export async function listarPublicaciones(): Promise<PublicacionAdmin[]> {
  const supabase = await crearClienteServidor()

  const { data, error } = await supabase
    .from('posts')
    .select('id, title, post_type, content_rich, cover_url, published_at, created_at, audience_course_id, courses(title)')
    .order('created_at', { ascending: false })
  const mundo = await mundoVaip()

  if (error) {
    console.error(JSON.stringify({ operacion: 'listarPublicaciones', error: error.message }))
    return []
  }

  type Anidado = {
    id: string
    title: string
    post_type: 'announcement' | 'blog'
    content_rich: Json | null
    cover_url: string | null
    published_at: string | null
    created_at: string
    audience_course_id: string | null
    courses: { title: string } | null
  }

  return (data as unknown as Anidado[]).map((p) => ({
    id: p.id,
    titulo: p.title,
    tipo: p.post_type,
    contenido: p.content_rich,
    portada: p.cover_url,
    cursoAudiencia: p.courses?.title ?? null,
    publicadoEn: p.published_at,
    creadoEn: p.created_at,
    // M25: los anuncios de V-AI-P ya no se muestran (sus avisos van fijados en el Muro).
    deVaip: mundo.ids.has(p.audience_course_id ?? ''),
  }))
}
