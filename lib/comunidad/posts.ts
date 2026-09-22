import 'server-only'

import { crearClienteServidor } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/types'

import type { Autor } from './comentarios'

import { SIN_REACCIONES, type ReaccionesDe } from '@/lib/comunidad/emojis'
import { reaccionesDe } from '@/lib/comunidad/reacciones'

export type ImagenDePost = { url: string; storage_path: string }

export type ComentarioDePost = {
  id: string
  contenido: string
  creadoEn: string
  autor: Autor
  esMio: boolean
  reacciones: ReaccionesDe
}

export type PostDeComunidad = {
  id: string
  titulo: string
  contenido: Json | null
  imagenes: ImagenDePost[]
  fijado: boolean
  creadoEn: string
  autor: Autor
  esMio: boolean
  reacciones: ReaccionesDe
  comentarios: ComentarioDePost[]
}

const ANONIMO: Autor = { userId: '', nombre: 'Alumno', avatar: null, esEquipo: false }

function leerImagenes(crudo: Json | null): ImagenDePost[] {
  if (!Array.isArray(crudo)) return []
  return crudo.flatMap((i) => {
    if (typeof i !== 'object' || i === null) return []
    const { url, storage_path } = i as { url?: unknown; storage_path?: unknown }
    if (typeof url !== 'string') return []
    return [{ url, storage_path: typeof storage_path === 'string' ? storage_path : '' }]
  })
}

async function resolverAutores(userIds: string[]): Promise<Map<string, Autor>> {
  const mapa = new Map<string, Autor>()
  if (userIds.length === 0) return mapa

  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('public_profiles')
    .select('user_id, full_name, avatar_url, es_equipo')
    .in('user_id', userIds)

  type Fila = {
    user_id: string | null
    full_name: string | null
    avatar_url: string | null
    es_equipo: boolean | null
  }

  for (const p of (data ?? []) as Fila[]) {
    if (!p.user_id) continue
    mapa.set(p.user_id, {
      userId: p.user_id,
      nombre: p.full_name?.trim() || 'Alumno',
      avatar: p.avatar_url,
      esEquipo: p.es_equipo ?? false,
    })
  }
  return mapa
}

/**
 * Feed de la comunidad de un curso (§3.8).
 *
 * Los fijados van primero, luego lo más reciente. Nada de gamificación ni
 * categorías: el spec lo excluye explícitamente del MVP.
 *
 * Solo llegan los `visible`: lo oculto por el admin lo filtra RLS, no la UI.
 */
/** Cuántas publicaciones por página puede pedir alguien. `0` = todas. */
export const POR_PAGINA = [10, 25, 50, 100, 200, 0] as const

export type FeedDeComunidad = {
  posts: PostDeComunidad[]
  /** Publicaciones visibles en total, para saber cuántas páginas hay. */
  total: number
  pagina: number
  paginas: number
  porPagina: number
}

export async function feedDelCurso(
  cursoId: string,
  usuarioActual: string,
  opciones: { pagina?: number; porPagina?: number } = {}
): Promise<FeedDeComunidad> {
  const supabase = await crearClienteServidor()

  // `0` significa "todas". Se traduce a un tope alto y no a "sin límite": una
  // consulta sin techo es una bomba de relojería el día que el feed crezca.
  const porPagina = opciones.porPagina && opciones.porPagina > 0 ? opciones.porPagina : 1000
  const pedida = Math.max(1, opciones.pagina ?? 1)

  const base = () =>
    supabase
      .from('community_posts')
      .select(
        'id, user_id, title, content_rich, images, pinned, created_at, community_comments(id, user_id, content, created_at, status)',
        { count: 'exact' }
      )
      .eq('course_id', cursoId)
      .eq('status', 'visible')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })

  const desde = (pedida - 1) * porPagina
  let { data, error, count } = await base().range(desde, desde + porPagina - 1)

  // PostgREST responde 416 cuando el rango se pasa del final. Pasa al llegar
  // por una URL vieja, o al bajar de 100 por página estando en la página 7.
  if (error && (error.code === 'PGRST103' || /range/i.test(error.message))) {
    const reintento = await base().range(0, porPagina - 1)
    data = reintento.data
    error = reintento.error
    count = reintento.count
  }

  if (error) {
    console.error(JSON.stringify({ operacion: 'feedDelCurso', cursoId, error: error.message }))
    return { posts: [], total: 0, pagina: 1, paginas: 1, porPagina }
  }

  const total = count ?? 0
  const paginas = Math.max(1, Math.ceil(total / porPagina))
  const pagina = Math.min(pedida, paginas)

  type Anidado = {
    id: string
    user_id: string
    title: string
    content_rich: Json | null
    images: Json
    pinned: boolean
    created_at: string
    community_comments: Array<{
      id: string
      user_id: string
      content: string
      created_at: string
      status: string
    }>
  }

  const filas = (data ?? []) as unknown as Anidado[]

  const ids = new Set<string>()
  for (const p of filas) {
    ids.add(p.user_id)
    for (const c of p.community_comments ?? []) ids.add(c.user_id)
  }
  const autores = await resolverAutores([...ids])

  // Las reacciones de todo el feed en una sola consulta, no una por tarjeta.
  const comentarioIds = filas.flatMap((p) =>
    (p.community_comments ?? []).filter((c) => c.status === 'visible').map((c) => c.id)
  )
  const reacciones = await reaccionesDe(
    filas.map((p) => p.id),
    comentarioIds,
    usuarioActual
  )

  const posts = filas.map((p) => ({
    id: p.id,
    titulo: p.title,
    contenido: p.content_rich,
    imagenes: leerImagenes(p.images),
    fijado: p.pinned,
    creadoEn: p.created_at,
    autor: autores.get(p.user_id) ?? ANONIMO,
    esMio: p.user_id === usuarioActual,
    reacciones: reacciones.posts.get(p.id) ?? SIN_REACCIONES,
    comentarios: (p.community_comments ?? [])
      .filter((c) => c.status === 'visible')
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((c) => ({
        id: c.id,
        contenido: c.content,
        creadoEn: c.created_at,
        autor: autores.get(c.user_id) ?? ANONIMO,
        esMio: c.user_id === usuarioActual,
        reacciones: reacciones.comentarios.get(c.id) ?? SIN_REACCIONES,
      })),
  }))

  return { posts, total, pagina, paginas, porPagina }
}

export type AnuncioParaAlumno = {
  id: string
  titulo: string
  contenido: Json | null
  portada: string | null
  tipo: 'announcement' | 'blog'
  publicadoEn: string
}

/**
 * Anuncios y blog visibles para el alumno (§3.9).
 *
 * La policy de `posts` ya filtra por publicado y por audiencia: si el post
 * apunta a un curso, solo lo ven los inscritos a ese curso. Aquí solo se ordena
 * y se separa por tipo.
 */
export async function publicacionesParaAlumno(
  tipo?: 'announcement' | 'blog'
): Promise<AnuncioParaAlumno[]> {
  const supabase = await crearClienteServidor()

  let consulta = supabase
    .from('posts')
    .select('id, title, content_rich, cover_url, post_type, published_at')
    .order('published_at', { ascending: false })

  if (tipo) consulta = consulta.eq('post_type', tipo)

  const { data, error } = await consulta

  if (error) {
    console.error(JSON.stringify({ operacion: 'publicacionesParaAlumno', error: error.message }))
    return []
  }

  type Fila = {
    id: string
    title: string
    content_rich: Json | null
    cover_url: string | null
    post_type: 'announcement' | 'blog'
    published_at: string | null
  }

  return (data as Fila[])
    .filter((p) => p.published_at !== null)
    .map((p) => ({
      id: p.id,
      titulo: p.title,
      contenido: p.content_rich,
      portada: p.cover_url,
      tipo: p.post_type,
      publicadoEn: p.published_at as string,
    }))
}
