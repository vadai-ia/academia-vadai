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
