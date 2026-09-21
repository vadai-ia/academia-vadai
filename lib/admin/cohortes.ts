import 'server-only'

import { crearClienteServidor } from '@/lib/supabase/server'
import type { Tabla } from '@/lib/supabase/types'

export type Cohorte = Tabla<'cohorts'>
export type Sesion = Tabla<'cohort_sessions'>

export type SesionConGrabacion = Sesion & {
  grabacionTitulo: string | null
}

export type CohorteConSesiones = Cohorte & {
  cursoId: string
  cursoTitulo: string
  cursoSlug: string
  sesiones: SesionConGrabacion[]
  inscritos: number
}

export type CohorteEnLista = Cohorte & {
  totalSesiones: number
  inscritos: number
}

/** Cohortes de un curso, para la pantalla del curso en el admin. */
export async function cohortesDelCurso(cursoId: string): Promise<CohorteEnLista[]> {
  const supabase = await crearClienteServidor()

  const { data, error } = await supabase
    .from('cohorts')
    .select('*, cohort_sessions(id), enrollments(id)')
    .eq('course_id', cursoId)
    .order('starts_on', { ascending: false })

  if (error) {
    console.error(JSON.stringify({ operacion: 'cohortesDelCurso', cursoId, error: error.message }))
    return []
  }

  type Anidada = Cohorte & {
    cohort_sessions: Array<{ id: string }>
    enrollments: Array<{ id: string }>
  }

  return (data as unknown as Anidada[]).map((c) => {
    const { cohort_sessions, enrollments, ...resto } = c
    return {
      ...resto,
      totalSesiones: cohort_sessions?.length ?? 0,
      inscritos: enrollments?.length ?? 0,
    }
  })
}

export type CohorteAgendable = { id: string; nombre: string; cursoTitulo: string }

/**
 * Las cohortes de cursos que siguen vivos, para agendar una sesión desde el
 * panel principal sin pasar por el curso. Un curso archivado ya no agenda.
 *
 * Dos consultas planas y no un select anidado: los tipos generados no traen
 * las relaciones, y así no hace falta ningún cast.
 */
export async function cohortesParaAgendar(): Promise<CohorteAgendable[]> {
  const supabase = await crearClienteServidor()
  const [cohortes, cursos] = await Promise.all([
    supabase.from('cohorts').select('id, name, course_id, starts_on').order('starts_on', { ascending: false }),
    supabase.from('courses').select('id, title, status'),
  ])

  const fallo = cohortes.error ?? cursos.error
  if (fallo) {
    console.error(JSON.stringify({ operacion: 'cohortesParaAgendar', error: fallo.message }))
    return []
  }

  const curso = new Map((cursos.data ?? []).map((c) => [c.id, c]))
  return (cohortes.data ?? []).flatMap((c) => {
    const suyo = curso.get(c.course_id)
    if (!suyo || suyo.status === 'archived') return []
    return [{ id: c.id, nombre: c.name, cursoTitulo: suyo.title }]
  })
}

export type SesionProxima = {
  id: string
  titulo: string
  empiezaEn: string
  ligaUrl: string | null
  cohorteId: string
  cohorte: string
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
  const [sesiones, cohortes, cursos] = await Promise.all([
    supabase
      .from('cohort_sessions')
      .select('id, title, scheduled_at, meet_url, cohort_id')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(limite * 4),
    supabase.from('cohorts').select('id, name, course_id'),
    supabase.from('courses').select('id, title, status'),
  ])

  const fallo = sesiones.error ?? cohortes.error ?? cursos.error
  if (fallo) {
    console.error(JSON.stringify({ operacion: 'proximasSesiones', error: fallo.message }))
    return []
  }

  const curso = new Map((cursos.data ?? []).map((c) => [c.id, c]))
  const cohorte = new Map((cohortes.data ?? []).map((c) => [c.id, c]))

  return (sesiones.data ?? [])
    .flatMap((s) => {
      const co = cohorte.get(s.cohort_id)
      const cu = co ? curso.get(co.course_id) : undefined
      if (!co || !cu || cu.status === 'archived') return []
      return [
        {
          id: s.id,
          titulo: s.title,
          empiezaEn: s.scheduled_at,
          ligaUrl: s.meet_url,
          cohorteId: co.id,
          cohorte: co.name,
          cursoTitulo: cu.title,
        },
      ]
    })
    .slice(0, limite)
}

/** Cohorte con su calendario completo. */
export async function obtenerCohorte(id: string): Promise<CohorteConSesiones | null> {
  const supabase = await crearClienteServidor()

  const { data, error } = await supabase
    .from('cohorts')
    .select('*, courses!inner(id, title, slug), cohort_sessions(*), enrollments(id)')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error(JSON.stringify({ operacion: 'obtenerCohorte', id, error: error.message }))
    return null
  }
  if (!data) return null

  type Anidada = Cohorte & {
    courses: { id: string; title: string; slug: string }
    cohort_sessions: Sesion[]
    enrollments: Array<{ id: string }>
  }
  const cohorte = data as unknown as Anidada
  const { courses, cohort_sessions, enrollments, ...resto } = cohorte

  // El título de la grabación se resuelve aparte: son pocas sesiones y así se
  // evita un join anidado que PostgREST resuelve peor.
  const idsGrabacion = (cohort_sessions ?? [])
    .map((s) => s.recording_lesson_id)
    .filter((v): v is string => Boolean(v))

  const titulos = new Map<string, string>()
  if (idsGrabacion.length > 0) {
    const { data: lecciones } = await supabase
      .from('lessons')
      .select('id, title')
      .in('id', idsGrabacion)
    for (const l of lecciones ?? []) titulos.set(l.id, l.title)
  }

  return {
    ...resto,
    cursoId: courses.id,
    cursoTitulo: courses.title,
    cursoSlug: courses.slug,
    inscritos: enrollments?.length ?? 0,
    sesiones: (cohort_sessions ?? [])
      .map((s) => ({
        ...s,
        grabacionTitulo: s.recording_lesson_id
          ? (titulos.get(s.recording_lesson_id) ?? null)
          : null,
      }))
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)),
  }
}

/** Lecciones de tipo video del curso, para poder ligar una como grabación (§3.10). */
export async function leccionesLigables(
  cursoId: string
): Promise<Array<{ id: string; titulo: string; modulo: string }>> {
  const supabase = await crearClienteServidor()

  const { data } = await supabase
    .from('modules')
    .select('title, position, lessons(id, title, position, lesson_type)')
    .eq('course_id', cursoId)

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
