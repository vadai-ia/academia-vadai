import 'server-only'

import { faltaFuncion, type LlamadaRpc } from '@/lib/alumno/catalogo'
import { BUCKET_DEL_MURO } from '@/lib/comunidad/imagenes'
import { planDelEspacio, type PlanPublico } from '@/lib/membresia/consultas'
import { crearClienteServidor } from '@/lib/supabase/server'
import type { Json, Tabla } from '@/lib/supabase/types'

/**
 * Lo que el panel lee del contenido de V-AI-P (M26): grabaciones por mes y
 * herramientas con etiquetas, con borradores incluidos. Todo con la sesión del
 * equipo (RLS: `is_equipo` ve todas las lecciones); nada de service role.
 */

export type CasaDelPanel = {
  plan: PlanPublico
  casa: { id: string; slug: string; publicada: boolean }
  /** La generación donde se sube el contenido (`academia_generacion_de_la_casa`). */
  generacionId: string | null
}

/** La casa del plan del espacio (la real; la QA solo en el servidor de pruebas). */
export async function casaDelPanel(): Promise<CasaDelPanel | null> {
  const plan = await planDelEspacio()
  if (!plan?.casa) return null
  const supabase = await crearClienteServidor()
  const rpc = (supabase.rpc as unknown as LlamadaRpc).bind(supabase)
  const { data, error } = await rpc('academia_generacion_de_la_casa', { p_casa: plan.casa.id })
  if (error && !faltaFuncion(error)) {
    console.error(JSON.stringify({ operacion: 'casaDelPanel', casa: plan.casa.id, error: error.message }))
  }
  return { plan, casa: plan.casa, generacionId: typeof data === 'string' ? data : null }
}

export type EstadoDeContenido = 'borrador' | 'sinVideo' | 'publicada'

function estadoDe(status: string, videoId: string | null): EstadoDeContenido {
  if (status === 'published') return 'publicada'
  return videoId ? 'borrador' : 'sinVideo'
}

// ==========================================================================
// Grabaciones
// ==========================================================================

export type GrabacionDelPanel = {
  id: string
  titulo: string
  fecha: string
  estado: EstadoDeContenido
  duracionSeg: number | null
  clase: { id: string; titulo: string } | null
}

export type MesDelPanel = { id: string; mes: string; titulo: string; grabaciones: GrabacionDelPanel[] }

/** Todas las grabaciones de la generación, por mes, del más nuevo al más viejo. */
export async function grabacionesDelPanel(casaId: string, generacionId: string): Promise<MesDelPanel[]> {
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('modules')
    .select('id, title, month, lessons(id, title, recorded_on, status, bunny_video_id, video_duration_sec)')
    .eq('course_id', casaId)
    .eq('cohort_id', generacionId)
    .eq('kind', 'mes')
    .order('month', { ascending: false })
  if (error) {
    console.error(JSON.stringify({ operacion: 'grabacionesDelPanel', casaId, error: error.message }))
    return []
  }
  // Los tipos generados no traen relaciones: la forma anidada se declara aquí.
  type Mes = {
    id: string
    title: string
    month: string | null
    lessons: Array<{
      id: string
      title: string
      recorded_on: string | null
      status: string
      bunny_video_id: string | null
      video_duration_sec: number | null
    }> | null
  }
  const meses = (data ?? []) as unknown as Mes[]
  const ids = meses.flatMap((m) => (m.lessons ?? []).map((l) => l.id))
  const { data: clases } = ids.length
    ? await supabase.from('cohort_sessions').select('id, title, recording_lesson_id').in('recording_lesson_id', ids)
    : { data: [] }
  const claseDe = new Map((clases ?? []).map((c) => [c.recording_lesson_id, { id: c.id, titulo: c.title }]))

  // Un mes que se quedó vacío (su grabación se movió de fecha) no se pinta.
  return meses
    .filter((m) => m.month && (m.lessons ?? []).length > 0)
    .map((m) => ({
      id: m.id,
      mes: m.month as string,
      titulo: m.title,
      grabaciones: [...(m.lessons ?? [])]
        .sort((a, b) => (b.recorded_on ?? '').localeCompare(a.recorded_on ?? ''))
        .map((l) => ({
          id: l.id,
          titulo: l.title,
          fecha: l.recorded_on ?? (m.month as string),
          estado: estadoDe(l.status, l.bunny_video_id),
          duracionSeg: l.video_duration_sec,
          clase: claseDe.get(l.id) ?? null,
        })),
    }))
}

export type ClaseParaSubir = { id: string; titulo: string; programadaEn: string }

/**
 * Las clases que ya pasaron y no tienen grabación: lo que ofrece «Subir
 * grabación». Una clase cuenta como pasada tres horas después de empezar.
 */
export async function clasesSinGrabacion(generacionId: string, ahora = Date.now()): Promise<ClaseParaSubir[]> {
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('cohort_sessions')
    .select('id, title, scheduled_at')
    .eq('cohort_id', generacionId)
    .eq('kind', 'clase')
    .is('recording_lesson_id', null)
    .lte('scheduled_at', new Date(ahora - 3 * 60 * 60 * 1000).toISOString())
    .order('scheduled_at', { ascending: false })
    .limit(30)
  return (data ?? []).map((s) => ({ id: s.id, titulo: s.title, programadaEn: s.scheduled_at }))
}

type Adjunto = Tabla<'lesson_attachments'>

export type ContenidoDelPanel = {
  id: string
  titulo: string
  descripcion: Json | null
  estado: EstadoDeContenido
  status: 'draft' | 'published'
  videoId: string | null
  duracionSeg: number | null
  orientacion: 'horizontal' | 'vertical'
  fecha: string | null
  portadaRuta: string | null
  portada: string | null
  publicadaEn: string | null
  cursoId: string
  generacionId: string | null
  tipo: 'mes' | 'herramientas'
  adjuntos: Adjunto[]
  /** Solo grabaciones: la clase del calendario que la tiene ligada. */
  clase: { id: string; titulo: string; programadaEn: string } | null
  /** Solo herramientas: los ids de sus etiquetas. */
  etiquetas: string[]
}

/** Una grabación o herramienta para su editor; null si la lección no es de V-AI-P. */
export async function contenidoDelPanel(leccionId: string): Promise<ContenidoDelPanel | null> {
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('lessons')
    .select('*, lesson_attachments(*), modules!inner(kind, course_id, cohort_id), lesson_tool_tags(tag_id)')
    .eq('id', leccionId)
    .maybeSingle()
  if (error || !data) {
    if (error) console.error(JSON.stringify({ operacion: 'contenidoDelPanel', leccionId, error: error.message }))
    return null
  }
  const fila = data as unknown as Tabla<'lessons'> & {
    lesson_attachments: Adjunto[] | null
    modules: { kind: string; course_id: string; cohort_id: string | null }
    lesson_tool_tags: Array<{ tag_id: string }> | null
  }
  const modulo = fila.modules
  const tipo = modulo.kind === 'mes' || modulo.kind === 'herramientas' ? modulo.kind : null
  if (!tipo) return null

  const { data: clase } =
    tipo === 'mes'
      ? await supabase
          .from('cohort_sessions')
          .select('id, title, scheduled_at')
          .eq('recording_lesson_id', leccionId)
          .order('scheduled_at')
          .limit(1)
          .maybeSingle()
      : { data: null }

  return {
    id: fila.id,
    titulo: fila.title,
    descripcion: fila.description_rich,
    estado: estadoDe(fila.status, fila.bunny_video_id),
    status: fila.status === 'published' ? 'published' : 'draft',
    videoId: fila.bunny_video_id,
    duracionSeg: fila.video_duration_sec,
    orientacion: fila.orientation === 'vertical' ? 'vertical' : 'horizontal',
    fecha: fila.recorded_on,
    portadaRuta: fila.cover_path,
    portada: fila.cover_path ? supabase.storage.from(BUCKET_DEL_MURO).getPublicUrl(fila.cover_path).data.publicUrl : null,
    publicadaEn: fila.published_at,
    cursoId: modulo.course_id,
    generacionId: modulo.cohort_id,
    tipo,
    adjuntos: [...(fila.lesson_attachments ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    clase: clase ? { id: clase.id, titulo: clase.title, programadaEn: clase.scheduled_at } : null,
    etiquetas: (fila.lesson_tool_tags ?? []).map((t) => t.tag_id),
  }
}

// ==========================================================================
// Herramientas y etiquetas
// ==========================================================================

export type EtiquetaDelPanel = { id: string; nombre: string; slug: string; archivada: boolean; cuantas: number }

export type HerramientaDelPanel = {
  id: string
  titulo: string
  estado: EstadoDeContenido
  orientacion: 'horizontal' | 'vertical'
  portada: string | null
  duracionSeg: number | null
  etiquetas: string[]
  creadaEn: string
}

export async function herramientasDelPanel(
  casaId: string,
  generacionId: string
): Promise<{ herramientas: HerramientaDelPanel[]; etiquetas: EtiquetaDelPanel[] }> {
  const supabase = await crearClienteServidor()
  const [{ data: filas, error }, { data: tags }] = await Promise.all([
    supabase
      .from('lessons')
      .select(
        'id, title, status, bunny_video_id, orientation, cover_path, video_duration_sec, created_at, published_at, modules!inner(kind, course_id, cohort_id), lesson_tool_tags(tag_id)'
      )
      .eq('modules.course_id', casaId)
      .eq('modules.cohort_id', generacionId)
      .eq('modules.kind', 'herramientas')
      .order('created_at', { ascending: false }),
    supabase.from('tool_tags').select('id, name, slug, archived, position').eq('course_id', casaId).order('position').order('name'),
  ])
  if (error) console.error(JSON.stringify({ operacion: 'herramientasDelPanel', casaId, error: error.message }))

  type Fila = Pick<
    Tabla<'lessons'>,
    'id' | 'title' | 'status' | 'bunny_video_id' | 'orientation' | 'cover_path' | 'video_duration_sec' | 'created_at'
  > & { lesson_tool_tags: Array<{ tag_id: string }> | null }
  const herramientas: HerramientaDelPanel[] = ((filas ?? []) as unknown as Fila[]).map((f) => ({
    id: f.id,
    titulo: f.title,
    estado: estadoDe(f.status, f.bunny_video_id),
    orientacion: f.orientation === 'vertical' ? 'vertical' : 'horizontal',
    portada: f.cover_path ? supabase.storage.from(BUCKET_DEL_MURO).getPublicUrl(f.cover_path).data.publicUrl : null,
    duracionSeg: f.video_duration_sec,
    etiquetas: (f.lesson_tool_tags ?? []).map((t) => t.tag_id),
    creadaEn: f.created_at,
  }))

  const etiquetas = (tags ?? []).map((t) => ({
    id: t.id,
    nombre: t.name,
    slug: t.slug,
    archivada: t.archived,
    cuantas: herramientas.filter((h) => h.etiquetas.includes(t.id)).length,
  }))
  return { herramientas, etiquetas }
}

/** Las etiquetas de la casa (también las archivadas), con cuántas herramientas lleva cada una. */
export async function etiquetasDelPanel(casaId: string): Promise<EtiquetaDelPanel[]> {
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('tool_tags')
    .select('id, name, slug, archived, position, lesson_tool_tags(count)')
    .eq('course_id', casaId)
    .order('position')
    .order('name')
  type Fila = { id: string; name: string; slug: string; archived: boolean; lesson_tool_tags: Array<{ count: number }> | null }
  return ((data ?? []) as unknown as Fila[]).map((t) => ({
    id: t.id,
    nombre: t.name,
    slug: t.slug,
    archivada: t.archived,
    cuantas: t.lesson_tool_tags?.[0]?.count ?? 0,
  }))
}
