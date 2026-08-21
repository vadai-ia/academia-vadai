import 'server-only'

import { leerOpciones, type Opcion } from '@/lib/quiz/comun'
import { crearClienteServidor } from '@/lib/supabase/server'
import type { Tabla } from '@/lib/supabase/types'

export type Quiz = Tabla<'quizzes'>
export type Pregunta = Tabla<'quiz_questions'>

export type QuizCompleto = Quiz & {
  preguntas: Array<Pregunta & { opciones: Opcion[] }>
  intentos: number
  aprobados: number
}

/**
 * Quiz de una lección, con su respuesta correcta.
 *
 * Solo para el admin: la policy de `quiz_questions` es admin-only (M1). El
 * alumno pasa por `academia.quiz_questions_public`, que no proyecta
 * `correct_option_id`.
 */
export async function quizDeLeccion(leccionId: string): Promise<QuizCompleto | null> {
  const supabase = await crearClienteServidor()

  const { data, error } = await supabase
    .from('quizzes')
    .select('*, quiz_questions(*), quiz_attempts(id, passed)')
    .eq('lesson_id', leccionId)
    .maybeSingle()

  if (error) {
    console.error(JSON.stringify({ operacion: 'quizDeLeccion', leccionId, error: error.message }))
    return null
  }
  if (!data) return null

  type Anidado = Quiz & {
    quiz_questions: Pregunta[]
    quiz_attempts: Array<{ id: string; passed: boolean }>
  }
  const quiz = data as unknown as Anidado
  const { quiz_questions, quiz_attempts, ...resto } = quiz

  return {
    ...resto,
    preguntas: [...(quiz_questions ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((p) => ({ ...p, opciones: leerOpciones(p.options) })),
    intentos: quiz_attempts?.length ?? 0,
    aprobados: (quiz_attempts ?? []).filter((a) => a.passed).length,
  }
}
