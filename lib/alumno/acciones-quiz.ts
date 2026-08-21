'use server'

import { revalidatePath } from 'next/cache'

import { exigirPerfil } from '@/lib/auth/sesion'
import { crearClienteServidor } from '@/lib/supabase/server'
import { crearClienteServiceRole } from '@/lib/supabase/service-role'

export type ResultadoQuiz = {
  ok: boolean
  motivo?: string
  score?: number
  aprobado?: boolean
  /** Ids de las preguntas que falló. */
  falladas?: string[]
  /** Solo se llena si el quiz revela respuestas o si aprobó (§3.4). */
  correctas?: Record<string, string>
}

/**
 * Califica un intento de quiz (§3.4).
 *
 * ⚠️ AQUÍ HAY QUE TENER CUIDADO. Calificar exige leer `correct_option_id`, que
 * es admin-only por RLS, así que este código usa service role — y el service
 * role SALTA RLS por completo. Sin una verificación explícita, cualquier alumno
 * podría calificar el quiz de un curso que no compró.
 *
 * La defensa: primero se consulta con el cliente del USUARIO, donde RLS sí
 * aplica. Si esa consulta no devuelve el quiz, el alumno no tiene acceso y se
 * corta. El service role solo entra después, y únicamente para leer las
 * respuestas correctas.
 *
 * Por qué el servidor califica y no el navegador: si el cliente pudiera declarar
 * "aprobé", habilitar el certificado sería una petición. Es la misma razón por
 * la que en M1 se quitó la policy de INSERT sobre quiz_attempts.
 */
export async function calificarQuiz(
  _previo: ResultadoQuiz,
  datos: FormData
): Promise<ResultadoQuiz> {
  const perfil = await exigirPerfil()

  const quizId = String(datos.get('quiz_id') ?? '')
  const leccionId = String(datos.get('lesson_id') ?? '')
  const cursoSlug = String(datos.get('curso_slug') ?? '')
  if (!quizId || !leccionId) return { ok: false, motivo: 'Falta el quiz.' }

  // 1. ¿Puede este alumno ver este quiz? Lo decide RLS, no nosotros.
  const supabase = await crearClienteServidor()
  const { data: visible } = await supabase
    .from('quizzes')
    .select('id, passing_score, reveal_answers')
    .eq('id', quizId)
    .eq('lesson_id', leccionId)
    .maybeSingle()

  if (!visible) {
    console.error(
      JSON.stringify({ operacion: 'calificarQuiz:sinAcceso', quizId, usuario: perfil.user_id })
    )
    return { ok: false, motivo: 'No tienes acceso a este quiz.' }
  }

  // 2. Ya con el acceso confirmado, se leen las respuestas correctas.
  const servicio = crearClienteServiceRole()
  const { data: preguntas, error } = await servicio
    .from('quiz_questions')
    .select('id, correct_option_id')
    .eq('quiz_id', quizId)

  if (error || !preguntas || preguntas.length === 0) {
    console.error(
      JSON.stringify({ operacion: 'calificarQuiz:sinPreguntas', quizId, error: error?.message })
    )
    return { ok: false, motivo: 'Este quiz todavía no tiene preguntas.' }
  }

  // 3. Calificación.
  //     Las respuestas vienen del formulario, un campo por pregunta nombrado con
  //     su id. Se leen contra la lista de preguntas REAL, no contra lo que mandó
  //     el cliente: así, campos de más no cuentan y campos de menos se toman
  //     como error, no como pregunta inexistente.
  const respuestas: Record<string, string> = {}
  const falladas: string[] = []

  for (const pregunta of preguntas) {
    const elegida = String(datos.get(pregunta.id) ?? '')
    respuestas[pregunta.id] = elegida
    if (elegida !== pregunta.correct_option_id) falladas.push(pregunta.id)
  }

  const aciertos = preguntas.length - falladas.length
  const score = Math.round((aciertos / preguntas.length) * 100)
  const aprobado = score >= visible.passing_score

  // 4. El intento se guarda con service role: el alumno no tiene INSERT sobre
  //    quiz_attempts, justamente para que no pueda inventarse un aprobado.
  const { error: errorIntento } = await servicio.from('quiz_attempts').insert({
    quiz_id: quizId,
    user_id: perfil.user_id,
    answers: respuestas,
    score,
    passed: aprobado,
  })

  if (errorIntento) {
    console.error(
      JSON.stringify({ operacion: 'calificarQuiz:intento', quizId, error: errorIntento.message })
    )
    return { ok: false, motivo: 'No se pudo guardar tu intento.' }
  }

  // 5. "Un quiz aprobado marca su lección como completada" (§3.4).
  if (aprobado) {
    const { error: errorProgreso } = await servicio.from('lesson_progress').upsert(
      {
        user_id: perfil.user_id,
        lesson_id: leccionId,
        completed: true,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,lesson_id' }
    )

    if (errorProgreso) {
      console.error(
        JSON.stringify({
          operacion: 'calificarQuiz:progreso',
          leccionId,
          error: errorProgreso.message,
        })
      )
    }
  }

  revalidatePath(`/curso/${cursoSlug}`)
  revalidatePath(`/curso/${cursoSlug}/${leccionId}`)

  // 6. Las respuestas correctas solo se devuelven si el quiz lo permite o si ya
  //    aprobó. Revelarlas al reprobar convertiría los reintentos ilimitados en
  //    "falla una vez y copia".
  const correctas =
    visible.reveal_answers || aprobado
      ? Object.fromEntries(preguntas.map((p) => [p.id, p.correct_option_id]))
      : undefined

  console.log(
    JSON.stringify({
      operacion: 'calificarQuiz:ok',
      quizId,
      usuario: perfil.user_id,
      score,
      aprobado,
    })
  )

  return { ok: true, score, aprobado, falladas, correctas }
}
