import 'server-only'

import { crearClienteServiceRole } from '@/lib/supabase/service-role'

import type { Faltante } from './comun'

/**
 * ¿Este alumno terminó el curso? (§3.6)
 *
 * El spec pide dos cosas a la vez, y son distintas:
 *
 *   "100% de lecciones obligatorias (y aprobar quizzes/tareas marcadas como
 *    obligatorias)"
 *
 * La segunda no es un adorno de la primera. En el player hay un botón "Marcar
 * como completada" (§3.3) que el alumno puede pulsar en CUALQUIER lección,
 * incluida una de quiz o de tarea. Si el certificado se contentara con
 * `lesson_progress.completed`, cualquiera lo obtendría sin contestar un quiz ni
 * entregar una tarea: dos clics y a la pared.
 *
 * Por eso se verifican los dos lados. Para las lecciones obligatorias de tipo
 * `quiz` se exige un intento con `passed = true`, y para las de tipo
 * `assignment` una entrega con `status = 'approved'`. La marca de completada no
 * basta y no se le cree.
 *
 * Todo se lee con service role a propósito: esto decide si se emite un
 * documento, y no puede depender de lo que el cliente del alumno alcance a ver.
 */

export type Elegibilidad = {
  cumple: boolean
  totalObligatorias: number
  cubiertas: number
  faltantes: Faltante[]
}

export async function revisarElegibilidad(
  userId: string,
  cursoId: string
): Promise<Elegibilidad> {
  const servicio = crearClienteServiceRole()

  const { data: modulos } = await servicio
    .from('modules')
    .select('id')
    .eq('course_id', cursoId)

  const idsModulo = (modulos ?? []).map((m) => m.id)

  if (idsModulo.length === 0) {
    return { cumple: false, totalObligatorias: 0, cubiertas: 0, faltantes: [] }
  }

  // Solo cuentan las publicadas: un borrador no puede bloquear un certificado.
  const { data: lecciones } = await servicio
    .from('lessons')
    .select('id, title, lesson_type')
    .in('module_id', idsModulo)
    .eq('is_required', true)
    .eq('status', 'published')

  const obligatorias = lecciones ?? []

  if (obligatorias.length === 0) {
    return { cumple: false, totalObligatorias: 0, cubiertas: 0, faltantes: [] }
  }

  const ids = obligatorias.map((l) => l.id)

  const { data: progreso } = await servicio
    .from('lesson_progress')
    .select('lesson_id, completed')
    .eq('user_id', userId)
    .in('lesson_id', ids)

  const completadas = new Set(
    (progreso ?? []).filter((p) => p.completed).map((p) => p.lesson_id)
  )

  // Quizzes aprobados. El join va por `quizzes.lesson_id`, que es único.
  const idsQuiz = obligatorias.filter((l) => l.lesson_type === 'quiz').map((l) => l.id)
  const quizAprobado = new Set<string>()

  if (idsQuiz.length > 0) {
    const { data: quizzes } = await servicio
      .from('quizzes')
      .select('id, lesson_id')
      .in('lesson_id', idsQuiz)

    const porQuiz = new Map((quizzes ?? []).map((q) => [q.id, q.lesson_id]))

    if (porQuiz.size > 0) {
      const { data: intentos } = await servicio
        .from('quiz_attempts')
        .select('quiz_id')
        .eq('user_id', userId)
        .eq('passed', true)
        .in('quiz_id', [...porQuiz.keys()])

      for (const intento of intentos ?? []) {
        const leccion = porQuiz.get(intento.quiz_id)
        if (leccion) quizAprobado.add(leccion)
      }
    }
  }

  // Tareas aprobadas, por el mismo camino.
  const idsTarea = obligatorias
    .filter((l) => l.lesson_type === 'assignment')
    .map((l) => l.id)
  const tareaAprobada = new Set<string>()

  if (idsTarea.length > 0) {
    const { data: tareas } = await servicio
      .from('assignments')
      .select('id, lesson_id')
      .in('lesson_id', idsTarea)

    const porTarea = new Map((tareas ?? []).map((t) => [t.id, t.lesson_id]))

    if (porTarea.size > 0) {
      const { data: entregas } = await servicio
        .from('assignment_submissions')
        .select('assignment_id')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .in('assignment_id', [...porTarea.keys()])

      for (const entrega of entregas ?? []) {
        const leccion = porTarea.get(entrega.assignment_id)
        if (leccion) tareaAprobada.add(leccion)
      }
    }
  }

  const faltantes: Faltante[] = []

  for (const leccion of obligatorias) {
    const base = { leccionId: leccion.id, titulo: leccion.title, tipo: leccion.lesson_type }

    if (leccion.lesson_type === 'quiz' && !quizAprobado.has(leccion.id)) {
      faltantes.push({ ...base, motivo: 'quiz-no-aprobado' })
      continue
    }

    if (leccion.lesson_type === 'assignment' && !tareaAprobada.has(leccion.id)) {
      faltantes.push({ ...base, motivo: 'tarea-no-aprobada' })
      continue
    }

    if (!completadas.has(leccion.id)) {
      faltantes.push({ ...base, motivo: 'sin-completar' })
    }
  }

  return {
    cumple: faltantes.length === 0,
    totalObligatorias: obligatorias.length,
    cubiertas: obligatorias.length - faltantes.length,
    faltantes,
  }
}
