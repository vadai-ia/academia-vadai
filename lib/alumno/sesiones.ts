import 'server-only'

import { cache } from 'react'

import { crearClienteServidor } from '@/lib/supabase/server'

export type SesionDelAlumno = {
  id: string
  titulo: string
  descripcion: string | null
  /** ISO en UTC. Se pinta SIEMPRE en hora de la Ciudad de México (§3.10). */
  programadaEn: string
  meetUrl: string | null
  cohorteId: string
  cohorteNombre: string
  cursoSlug: string
  grabacionLeccionId: string | null
  /** Cuándo se agendó o se cambió por última vez: es lo que avisa la campana. */
  actualizadaEn: string
}

/**
 * Sesiones en vivo de la cohorte del alumno (§3.10).
 *
 * No hace falta filtrar por cohorte a mano: la policy de `cohort_sessions` exige
 * `pertenece_a_cohorte`, que además de la pertenencia comprueba la vigencia. Un
 * alumno de otra cohorte del mismo curso no ve estas sesiones, y uno con acceso
 * vencido no ve ninguna.
 *
 * Va con `cache()`: el layout del curso lo pide para la insignia de la pestaña
 * y la página vuelve a pedirlo para pintarlas. Sin esto serían dos viajes a
 * Supabase por carga.
 */
export const sesionesDelAlumno = cache(async function sesionesDelAlumno(): Promise<
  SesionDelAlumno[]
> {
  const supabase = await crearClienteServidor()

  const { data, error } = await supabase
    .from('cohort_sessions')
    .select('*, cohorts!inner(name, courses!inner(slug))')
    .order('scheduled_at', { ascending: true })

  if (error) {
    console.error(JSON.stringify({ operacion: 'sesionesDelAlumno', error: error.message }))
    return []
  }

  type Anidada = {
    id: string
    title: string
    description: string | null
    scheduled_at: string
    meet_url: string | null
    recording_lesson_id: string | null
    cohort_id: string
    created_at: string
    updated_at: string
    cohorts: { name: string; courses: { slug: string } }
  }

  return (data as unknown as Anidada[])
    .map((s) => ({
      id: s.id,
      titulo: s.title,
      descripcion: s.description,
      programadaEn: s.scheduled_at,
      meetUrl: s.meet_url,
      cohorteId: s.cohort_id,
      cohorteNombre: s.cohorts.name,
      cursoSlug: s.cohorts.courses.slug,
      grabacionLeccionId: s.recording_lesson_id,
      actualizadaEn: s.updated_at ?? s.created_at,
    }))
})

/**
 * Las de UN curso. Filtra en memoria sobre la consulta memorizada: antes
 * `sesionesDelAlumno(slug)` y `sesionesDelAlumno()` eran dos claves de caché
 * distintas y la campana y el layout del curso disparaban la misma consulta
 * dos veces por página (24-sep-2026).
 */
export async function sesionesDelCurso(cursoSlug: string): Promise<SesionDelAlumno[]> {
  return (await sesionesDelAlumno()).filter((s) => s.cursoSlug === cursoSlug)
}
