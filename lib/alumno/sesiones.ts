import 'server-only'

import { crearClienteServidor } from '@/lib/supabase/server'

export type SesionDelAlumno = {
  id: string
  titulo: string
  descripcion: string | null
  /** ISO en UTC. La hora local la calcula el navegador (§3.10). */
  programadaEn: string
  meetUrl: string | null
  cohorteNombre: string
  cursoSlug: string
  grabacionLeccionId: string | null
}

/**
 * Sesiones en vivo de la cohorte del alumno (§3.10).
 *
 * No hace falta filtrar por cohorte a mano: la policy de `cohort_sessions` exige
 * `pertenece_a_cohorte`, que además de la pertenencia comprueba la vigencia. Un
 * alumno de otra cohorte del mismo curso no ve estas sesiones, y uno con acceso
 * vencido no ve ninguna.
 */
export async function sesionesDelAlumno(cursoSlug?: string): Promise<SesionDelAlumno[]> {
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
    cohorts: { name: string; courses: { slug: string } }
  }

  return (data as unknown as Anidada[])
    .map((s) => ({
      id: s.id,
      titulo: s.title,
      descripcion: s.description,
      programadaEn: s.scheduled_at,
      meetUrl: s.meet_url,
      cohorteNombre: s.cohorts.name,
      cursoSlug: s.cohorts.courses.slug,
      grabacionLeccionId: s.recording_lesson_id,
    }))
    .filter((s) => !cursoSlug || s.cursoSlug === cursoSlug)
}
