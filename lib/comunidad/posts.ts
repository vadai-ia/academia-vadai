import 'server-only'

import { esCuentaQa } from '@/lib/qa'
import { obtenerSesion } from '@/lib/auth/sesion'
import { mundoVaip } from '@/lib/membresia/mundo'
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
  /** M21: cómo llegó (la firma del agente sale de aquí). */
  via: string
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
  /** M17: el tema del muro, o null. */
  temaId: string | null
  /** M24: la noticia (resumen y liga «Leer más»), o null si es una publicación normal. */
  noticia: { resumen: string | null; url: string | null; medio: string | null } | null
  autor: Autor
  via: string
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

/** Lo que se pide de cada publicación: el feed, la noticia y la página propia. */
const SELECCION =
  'id, user_id, title, content_rich, images, pinned, created_at, topic_id, via, resumen, enlace_url, enlace_medio, course_id, cohort_id, community_comments(id, user_id, content, created_at, status, via)'

type Anidado = {
  course_id: string
  cohort_id: string | null
  id: string
  user_id: string
  title: string
  content_rich: Json | null
  images: Json
  pinned: boolean
  created_at: string
  topic_id: string | null
  via: string
  resumen: string | null
  enlace_url: string | null
  enlace_medio: string | null
  community_comments: Array<{
    id: string
    user_id: string
    content: string
    created_at: string
    status: string
    via: string
  }>
}

/** Filas crudas → publicaciones con autores, reacciones y respuestas visibles. */
async function armarPosts(filas: Anidado[], usuarioActual: string): Promise<PostDeComunidad[]> {
  const ids = new Set<string>()
  for (const p of filas) {
    ids.add(p.user_id)
    for (const c of p.community_comments ?? []) ids.add(c.user_id)
  }
  // Autores y reacciones solo dependen de las publicaciones ya en mano: en
  // paralelo son un viaje, no dos encadenados (24-sep-2026).
  const comentarioIds = filas.flatMap((p) =>
    (p.community_comments ?? []).filter((c) => c.status === 'visible').map((c) => c.id)
  )
  const [autores, reacciones] = await Promise.all([
    resolverAutores([...ids]),
    reaccionesDe(
      filas.map((p) => p.id),
      comentarioIds,
      usuarioActual
    ),
  ])

  return filas.map((p) => ({
    id: p.id,
    titulo: p.title,
    contenido: p.content_rich,
    imagenes: leerImagenes(p.images),
    fijado: p.pinned,
    creadoEn: p.created_at,
    temaId: p.topic_id,
    noticia: p.resumen || p.enlace_url ? { resumen: p.resumen, url: p.enlace_url, medio: p.enlace_medio } : null,
    autor: autores.get(p.user_id) ?? ANONIMO,
    via: p.via,
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
        via: c.via,
        esMio: c.user_id === usuarioActual,
        reacciones: reacciones.comentarios.get(c.id) ?? SIN_REACCIONES,
      })),
  }))

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

/**
 * `cohortId`: la generación cuyo muro se pide; `null` en cursos sin
 * generaciones. RLS ya esconde al alumno las demás generaciones; el filtro
 * explícito es por el equipo, que las ve todas y elige una con el selector.
 */
export async function feedDelCurso(
  cursoId: string,
  cohortId: string | null,
  usuarioActual: string,
  opciones: {
    pagina?: number
    porPagina?: number
    temaId?: string | null
    soloNoticias?: boolean
    /** El muro de V-AI-P sin noticias: van en su carrusel y en su pestaña. */
    sinNoticias?: boolean
  } = {}
): Promise<FeedDeComunidad> {
  const supabase = await crearClienteServidor()

  // M24: los fijados con fecha que ya vencieron se apagan antes de leer (no
  // hay pg_cron). Es una actualización sobre un índice parcial: casi nunca hay
  // nada que tocar.
  await (supabase.rpc as unknown as (f: string) => PromiseLike<unknown>)('academia_desfijar_vencidos')

  // `0` significa "todas". Se traduce a un tope alto y no a "sin límite": una
  // consulta sin techo es una bomba de relojería el día que el feed crezca.
  const porPagina = opciones.porPagina && opciones.porPagina > 0 ? opciones.porPagina : 1000
  const pedida = Math.max(1, opciones.pagina ?? 1)

  const base = () => {
    let consulta = supabase
      .from('community_posts')
      .select(SELECCION, { count: 'exact' })
      .eq('course_id', cursoId)
      .eq('status', 'visible')
    // M17: el muro principal muestra todo; el tema solo filtra.
    if (opciones.temaId) consulta = consulta.eq('topic_id', opciones.temaId)
    // 22-oct-2026: la sección Noticias de V-AI-P, solo lo que trae resumen o liga.
    if (opciones.soloNoticias) consulta = consulta.or('resumen.not.is.null,enlace_url.not.is.null')
    if (opciones.sinNoticias) consulta = consulta.is('resumen', null).is('enlace_url', null)
    return (cohortId ? consulta.eq('cohort_id', cohortId) : consulta.is('cohort_id', null))
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
  }

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

  const posts = await armarPosts((data ?? []) as unknown as Anidado[], usuarioActual)

  return { posts, total, pagina, paginas, porPagina }
}

/**
 * Una publicación, para su página propia (22-oct-2026: el feed enseña tarjetas
 * y cada una se abre entera, con sus respuestas). Lo que RLS no deja ver —otra
 * generación, el acceso vencido, lo oculto— llega como null, igual que lo que
 * no existe.
 */
export async function publicacionPorId(
  postId: string,
  usuarioActual: string
): Promise<{ post: PostDeComunidad; cursoId: string; cohortId: string | null } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(postId)) return null
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('community_posts')
    .select(SELECCION)
    .eq('id', postId)
    .eq('status', 'visible')
    .maybeSingle()

  if (error) {
    console.error(JSON.stringify({ operacion: 'publicacionPorId', postId, error: error.message }))
    return null
  }
  if (!data) return null
  const fila = data as unknown as Anidado
  const [post] = await armarPosts([fila], usuarioActual)
  return post ? { post, cursoId: fila.course_id, cohortId: fila.cohort_id } : null
}

/**
 * Las noticias más recientes de un muro menos una: el «Sigue leyendo» al pie de
 * cada noticia, para pasar a la siguiente sin volver a la lista.
 */
export async function otrasNoticias(
  cursoId: string,
  cohortId: string | null,
  excepto: string,
  usuarioActual: string,
  cuantas = 3
): Promise<PostDeComunidad[]> {
  const supabase = await crearClienteServidor()
  const consulta = supabase
    .from('community_posts')
    .select(SELECCION)
    .eq('course_id', cursoId)
    .eq('status', 'visible')
    .neq('id', excepto)
    .or('resumen.not.is.null,enlace_url.not.is.null')
  const { data, error } = await (cohortId ? consulta.eq('cohort_id', cohortId) : consulta.is('cohort_id', null))
    .order('created_at', { ascending: false })
    .limit(cuantas)

  if (error) {
    console.error(JSON.stringify({ operacion: 'otrasNoticias', cursoId, error: error.message }))
    return []
  }
  return armarPosts((data ?? []) as unknown as Anidado[], usuarioActual)
}

/**
 * Ordena unos cursos por su conversación más reciente.
 *
 * Es lo que decide en qué comunidad abre `/comunidad` cuando alguien tiene
 * varias. Sin esto caía en el primero que devolviera la consulta —el curso base,
 * casi siempre vacío— y la sección parecía muerta aunque hubiera hilos activos
 * al lado.
 *
 * Una sola consulta para todos los cursos: se piden las publicaciones visibles
 * ordenadas por fecha y se toma la primera de cada curso.
 */
export async function cursosPorActividad<T extends { id: string; generacion: { id: string } | null }>(
  cursos: T[]
): Promise<T[]> {
  if (cursos.length < 2) return cursos

  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('community_posts')
    .select('course_id, cohort_id, created_at')
    .eq('status', 'visible')
    .in('course_id', cursos.map((c) => c.id))
    .order('created_at', { ascending: false })

  if (error) {
    console.error(JSON.stringify({ operacion: 'cursosPorActividad', error: error.message }))
    return cursos
  }

  // La conversación que cuenta es la de MI generación (M16).
  const clave = (cursoId: string, cohortId: string | null) => `${cursoId}::${cohortId ?? ''}`
  const ultima = new Map<string, string>()
  for (const fila of data ?? []) {
    const k = clave(fila.course_id, fila.cohort_id)
    if (!ultima.has(k)) ultima.set(k, fila.created_at)
  }
  const de = (c: T) => ultima.get(clave(c.id, c.generacion?.id ?? null)) ?? ''

  // `toSorted` no: el arreglo llega de otra consulta y no se gana nada mutando
  // fuera. Los cursos sin una sola publicación caen al final, no desaparecen.
  return [...cursos].sort((a, b) => de(b).localeCompare(de(a)))
}

export type AnuncioParaAlumno = {
  id: string
  titulo: string
  contenido: Json | null
  portada: string | null
  tipo: 'announcement' | 'blog'
  publicadoEn: string
  /** El curso al que va dirigido, o null si es para toda la academia (M17: el espacio de V-AI-P filtra los suyos). */
  cursoId: string | null
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
    .select('id, title, content_rich, cover_url, post_type, published_at, audience_course_id, audience_cohort_id')
    .order('published_at', { ascending: false })

  if (tipo) consulta = consulta.eq('post_type', tipo)

  // Al equipo RLS le enseña todos los anuncios, también los del curso de
  // pruebas: una cuenta real no los ve (lib/qa.ts, 9-oct-2026).
  const [{ data, error }, sesion, { data: cursosQa }, mundo] = await Promise.all([
    consulta,
    obtenerSesion(),
    supabase.from('courses').select('id, cohorts(id)').like('slug', 'qa-%'),
    mundoVaip(),
  ])
  const cuentaQa = sesion.tipo === 'activo' && esCuentaQa(sesion.perfil.email)
  type CursoQa = { id: string; cohorts: Array<{ id: string }> | null }
  const deQa = new Set(
    ((cursosQa ?? []) as unknown as CursoQa[]).flatMap((c) => [c.id, ...(c.cohorts ?? []).map((g) => g.id)])
  )

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
    audience_course_id: string | null
    audience_cohort_id: string | null
  }

  return ((data ?? []) as Fila[])
    .filter((p) => p.published_at !== null)
    .filter(
      (p) =>
        cuentaQa ||
        !((p.audience_course_id && deQa.has(p.audience_course_id)) || (p.audience_cohort_id && deQa.has(p.audience_cohort_id)))
    )
    // M25: los anuncios son de los cursos. Los que quedaron dirigidos a V-AI-P
    // (antes cada clase agendada publicaba uno) ya no se enseñan: su clase
    // está en Clases y en la campana, y sus avisos van fijados en el Muro.
    .filter((p) => !(p.post_type === 'announcement' && p.audience_course_id && mundo.casas.has(p.audience_course_id)))
    .map((p) => ({
      id: p.id,
      titulo: p.title,
      contenido: p.content_rich,
      portada: p.cover_url,
      tipo: p.post_type,
      publicadoEn: p.published_at as string,
      cursoId: p.audience_course_id,
    }))
}
