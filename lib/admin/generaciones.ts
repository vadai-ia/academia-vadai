import 'server-only'

import { estadoDeGeneracion, type EstadoGeneracion } from '@/lib/generaciones'
import { crearClienteServidor } from '@/lib/supabase/server'
import type { Tabla } from '@/lib/supabase/types'

/**
 * Generaciones de un curso (M16). En la base la tabla sigue siendo `cohorts`
 * y la FK `cohort_id`; en todo lo visible se dice «generación».
 */

export type Generacion = Tabla<'cohorts'>
export type Sesion = Tabla<'cohort_sessions'>

export type SesionConGrabacion = Sesion & {
  grabacionTitulo: string | null
}

export type GeneracionConSesiones = Generacion & {
  cursoId: string
  cursoTitulo: string
  cursoSlug: string
  sesiones: SesionConGrabacion[]
  inscritos: number
  estado: EstadoGeneracion
}

/** Una generación con todo lo que pinta su pestaña en la página del curso. */
export type GeneracionCompleta = GeneracionConSesiones & {
  totalSesiones: number
  modulos: number
}

/**
 * Las generaciones de un curso con sus sesiones, en UNA consulta (24-sep-2026).
 *
 * El título de la grabación entra como join anidado por la FK
 * `recording_lesson_id`; con ocho sesiones PostgREST lo resuelve sin
 * despeinarse. Desde M16 trae también cuántos módulos tiene cada una, para
 * saber si se puede borrar y para la pestaña.
 *
 * Orden: la más reciente primero (por `starts_on`), que es la que el equipo
 * está operando.
 */
export async function generacionesDelCurso(cursoId: string): Promise<GeneracionCompleta[]> {
  const supabase = await crearClienteServidor()

  const { data, error } = await supabase
    .from('cohorts')
    .select(
      '*, courses!inner(id, title, slug), cohort_sessions(*, lessons(title)), enrollments(count), modules(count)'
    )
    .eq('course_id', cursoId)
    .order('starts_on', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error(JSON.stringify({ operacion: 'generacionesDelCurso', cursoId, error: error.message }))
    return []
  }

  type Anidada = Generacion & {
    courses: { id: string; title: string; slug: string }
    cohort_sessions: Array<Sesion & { lessons: { title: string } | null }>
    enrollments: Array<{ count: number }>
    modules: Array<{ count: number }>
  }

  return (data as unknown as Anidada[]).map((c) => {
    const { courses, cohort_sessions, enrollments, modules, ...resto } = c
    const sesiones = (cohort_sessions ?? [])
      .map(({ lessons, ...s }) => ({ ...s, grabacionTitulo: lessons?.title ?? null }))
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
    return {
      ...resto,
      cursoId: courses.id,
      cursoTitulo: courses.title,
      cursoSlug: courses.slug,
      inscritos: enrollments?.[0]?.count ?? 0,
      modulos: modules?.[0]?.count ?? 0,
      totalSesiones: sesiones.length,
      sesiones,
      estado: estadoDeGeneracion(resto),
    }
  })
}

export type GeneracionAgendable = {
  id: string
  nombre: string
  cursoTitulo: string
  estado: EstadoGeneracion
}

/**
 * Las generaciones de cursos que siguen vivos, para agendar una sesión desde
 * el panel principal sin pasar por el curso. Un curso archivado ya no agenda.
 *
 * Dos consultas planas y no un select anidado: los tipos generados no traen
 * las relaciones, y así no hace falta ningún cast.
 */
export async function generacionesParaAgendar(): Promise<GeneracionAgendable[]> {
  const supabase = await crearClienteServidor()
  const [generaciones, cursos] = await Promise.all([
    supabase
      .from('cohorts')
      .select('id, name, course_id, starts_on, ends_on, open_for_enrollment')
      .order('starts_on', { ascending: false }),
    supabase.from('courses').select('id, title, status'),
  ])

  const fallo = generaciones.error ?? cursos.error
  if (fallo) {
    console.error(JSON.stringify({ operacion: 'generacionesParaAgendar', error: fallo.message }))
    return []
  }

  const curso = new Map((cursos.data ?? []).map((c) => [c.id, c]))
  return (generaciones.data ?? []).flatMap((g) => {
    const suyo = curso.get(g.course_id)
    if (!suyo || suyo.status === 'archived') return []
    return [{ id: g.id, nombre: g.name, cursoTitulo: suyo.title, estado: estadoDeGeneracion(g) }]
  })
}

export type SesionProxima = {
  id: string
  titulo: string
  empiezaEn: string
  ligaUrl: string | null
  cohorteId: string
  generacion: string
  cursoId: string
  cursoTitulo: string
}

/**
 * Las siguientes sesiones en vivo de todos los cursos vivos, en orden.
 *
 * Es lo que el panel principal enseña arriba: qué toca esta semana y con qué
 * liga. Las de cursos archivados no cuentan; la víspera del lanzamiento el
 * panel anunciaba la sesión de prueba QA por eso.
 */
export async function proximasSesiones(limite = 5): Promise<SesionProxima[]> {
  const supabase = await crearClienteServidor()
  const [sesiones, generaciones, cursos] = await Promise.all([
    supabase
      .from('cohort_sessions')
      .select('id, title, scheduled_at, meet_url, cohort_id')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(limite * 4),
    supabase.from('cohorts').select('id, name, course_id'),
    supabase.from('courses').select('id, title, status'),
  ])

  const fallo = sesiones.error ?? generaciones.error ?? cursos.error
  if (fallo) {
    console.error(JSON.stringify({ operacion: 'proximasSesiones', error: fallo.message }))
    return []
  }

  const curso = new Map((cursos.data ?? []).map((c) => [c.id, c]))
  const generacion = new Map((generaciones.data ?? []).map((g) => [g.id, g]))

  return (sesiones.data ?? [])
    .flatMap((s) => {
      const g = generacion.get(s.cohort_id)
      const cu = g ? curso.get(g.course_id) : undefined
      if (!g || !cu || cu.status === 'archived') return []
      return [
        {
          id: s.id,
          titulo: s.title,
          empiezaEn: s.scheduled_at,
          ligaUrl: s.meet_url,
          cohorteId: g.id,
          generacion: g.name,
          cursoId: cu.id,
          cursoTitulo: cu.title,
        },
      ]
    })
    .slice(0, limite)
}

/**
 * A qué curso pertenece una generación. Es lo único que necesita la ruta vieja
 * `/admin/generaciones/<id>` para mandar a la pestaña correcta del curso.
 */
export async function cursoDeGeneracion(id: string): Promise<string | null> {
  const supabase = await crearClienteServidor()
  const { data } = await supabase.from('cohorts').select('course_id').eq('id', id).maybeSingle()
  return data?.course_id ?? null
}

/**
 * Lecciones de tipo video del curso, para poder ligar una como grabación
 * (§3.10). Con generación, solo las de esa generación: la grabación de la
 * sesión 3 de la Generación 2 es una lección de la Generación 2.
 */
export async function leccionesLigables(
  cursoId: string,
  cohortId: string | null = null
): Promise<Array<{ id: string; titulo: string; modulo: string }>> {
  const supabase = await crearClienteServidor()

  let consulta = supabase
    .from('modules')
    .select('title, position, cohort_id, lessons(id, title, position, lesson_type)')
    .eq('course_id', cursoId)
  consulta = cohortId ? consulta.eq('cohort_id', cohortId) : consulta.is('cohort_id', null)
  const { data } = await consulta

  type Anidado = {
    title: string
    position: number
    lessons: Array<{ id: string; title: string; position: number; lesson_type: string }>
  }

  return ((data ?? []) as unknown as Anidado[])
    .sort((a, b) => a.position - b.position)
    .flatMap((m) =>
      [...(m.lessons ?? [])]
        .filter((l) => l.lesson_type === 'video')
        .sort((a, b) => a.position - b.position)
        .map((l) => ({ id: l.id, titulo: l.title, modulo: m.title }))
    )
}

/**
 * La generación que lleva una dinámica o una encuesta (M16). Curso sin
 * generaciones: ninguna. Curso por generaciones: la elegida, o la abierta a
 * inscripciones; sin abierta, hay que elegir. Nunca «todo el curso».
 */
export async function generacionObligatoria(
  cursoId: string,
  elegida: string | null
): Promise<{ id: string | null } | { error: string }> {
  const supabase = await crearClienteServidor()
  const { data: curso } = await supabase
    .from('courses')
    .select('title, course_type, cohorts(id, open_for_enrollment, ends_on)')
    .eq('id', cursoId)
    .maybeSingle()
  if (!curso) return { error: 'El curso no existe.' }

  type Anidado = {
    title: string
    course_type: string
    cohorts: Array<{ id: string; open_for_enrollment: boolean; ends_on: string | null }>
  }
  const c = curso as unknown as Anidado
  if (c.course_type !== 'cohort') return { id: null }
  if (elegida) {
    if (!(c.cohorts ?? []).some((g) => g.id === elegida)) return { error: 'Esa generación no es de este curso.' }
    return { id: elegida }
  }
  const abierta = (c.cohorts ?? []).find((g) => estadoDeGeneracion(g) === 'abierta')
  if (abierta) return { id: abierta.id }
  return { error: `"${c.title}" es por generaciones y no tiene una abierta: elige la generación.` }
}
