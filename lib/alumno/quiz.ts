import 'server-only'

import { obtenerSesion } from '@/lib/auth/sesion'
import { leerOpciones, type Opcion } from '@/lib/quiz/comun'
import { crearClienteServidor } from '@/lib/supabase/server'

export type PreguntaParaAlumno = {
  id: string
  enunciado: string
  opciones: Opcion[]
  posicion: number
}

export type IntentoPrevio = {
  score: number
  passed: boolean
  fecha: string
  respuestas: Record<string, string>
}

export type QuizParaAlumno = {
  id: string
  puntajeMinimo: number
  revelaRespuestas: boolean
  preguntas: PreguntaParaAlumno[]
  ultimoIntento: IntentoPrevio | null
  totalIntentos: number
  aprobado: boolean
}

/**
 * Quiz tal como lo ve el alumno.
 *
 * Las preguntas salen de `academia.quiz_questions_public`, la vista que NO
 * proyecta `correct_option_id` (M1). No es una precaución de estilo: con la
 * tabla directa, cualquiera con las herramientas del navegador vería la
 * respuesta antes de contestar.
 *
 * Todo pasa por el cliente del usuario, así que RLS decide: sin acceso vigente
 * al curso, esto devuelve null.
 */
export async function quizParaAlumno(leccionId: string): Promise<QuizParaAlumno | null> {
  const supabase = await crearClienteServidor()

  const { data: quiz } = await supabase
    .from('quizzes')
    .select('id, passing_score, reveal_answers')
    .eq('lesson_id', leccionId)
    .maybeSingle()

  if (!quiz) return null

  const sesion = await obtenerSesion()
  if (sesion.tipo !== 'activo') return null

  // "Lo mío" lo dice la consulta, no RLS: a alguien del equipo RLS le devuelve
  // las filas de TODA la academia (`user_id = auth.uid() OR is_admin()`). Ver
  // `miUserId` en lib/alumno/consultas.ts.
  // Las preguntas y los intentos solo necesitan el id del quiz, que ya está:
  // en serie eran dos viajes de red donde cabe uno.
  const [{ data: preguntas }, { data: intentos }] = await Promise.all([
    supabase.from('quiz_questions_public').select('*').eq('quiz_id', quiz.id),
    supabase
      .from('quiz_attempts')
      .select('score, passed, answers, created_at')
      .eq('user_id', sesion.perfil.user_id)
      .eq('quiz_id', quiz.id)
      .order('created_at', { ascending: false }),
  ])

  const lista = intentos ?? []
  const ultimo = lista[0]

  type FilaPublica = {
    id: string | null
    question: string | null
    options: unknown
    position: number | null
  }

  return {
    id: quiz.id,
    puntajeMinimo: quiz.passing_score,
    revelaRespuestas: quiz.reveal_answers,
    preguntas: ((preguntas ?? []) as FilaPublica[])
      .flatMap((p) =>
        p.id
          ? [
              {
                id: p.id,
                enunciado: p.question ?? '',
                opciones: leerOpciones(p.options),
                posicion: p.position ?? 0,
              },
            ]
          : []
      )
      .sort((a, b) => a.posicion - b.posicion),
    ultimoIntento: ultimo
      ? {
          score: ultimo.score,
          passed: ultimo.passed,
          fecha: ultimo.created_at,
          respuestas: (ultimo.answers ?? {}) as Record<string, string>,
        }
      : null,
    totalIntentos: lista.length,
    aprobado: lista.some((i) => i.passed),
  }
}
