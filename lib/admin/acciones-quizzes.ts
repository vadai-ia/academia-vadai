'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { exigirAdmin } from '@/lib/auth/sesion'
import { crearClienteServidor } from '@/lib/supabase/server'

import { LETRAS } from '@/lib/quiz/comun'
import type { EstadoAccion } from './tipos'

/**
 * Builder de quizzes (§3.4).
 *
 * El alumno nunca escribe aquí: `quiz_questions` es admin-only por RLS y los
 * intentos los crea el servidor tras calificar. Ver `lib/alumno/quiz.ts`.
 */

function registrarFallo(operacion: string, detalle: Record<string, unknown>, error: string) {
  console.error(JSON.stringify({ operacion, ...detalle, error }))
}

const esquemaAjustes = z.object({
  passing_score: z.coerce
    .number()
    .int('El puntaje debe ser un número entero.')
    .min(0, 'El puntaje mínimo es 0.')
    .max(100, 'El puntaje máximo es 100.'),
  reveal_answers: z.coerce.boolean(),
})

/** Crea el quiz de una lección si todavía no existe. */
export async function crearQuiz(datos: FormData): Promise<void> {
  await exigirAdmin()

  const leccionId = String(datos.get('lesson_id') ?? '')
  if (!leccionId) return

  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('quizzes')
    .insert({ lesson_id: leccionId, passing_score: 80, reveal_answers: false })

  if (error && error.code !== '23505') {
    registrarFallo('crearQuiz', { leccionId }, error.message)
  }

  revalidatePath(`/admin/lecciones/${leccionId}`)
}

export async function actualizarQuiz(
  _previo: EstadoAccion,
  datos: FormData
): Promise<EstadoAccion> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  const leccionId = String(datos.get('lesson_id') ?? '')
  if (!id) return { error: 'Falta el quiz.' }

  const resultado = esquemaAjustes.safeParse({
    passing_score: datos.get('passing_score'),
    reveal_answers: datos.get('reveal_answers') ?? false,
  })
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? 'Revisa los datos.' }
  }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('quizzes').update(resultado.data).eq('id', id)

  if (error) {
    registrarFallo('actualizarQuiz', { id }, error.message)
    return { error: 'No se pudo guardar el quiz.' }
  }

  revalidatePath(`/admin/lecciones/${leccionId}`)
  return { aviso: 'Ajustes guardados.' }
}

/**
 * Agrega una pregunta con sus opciones.
 *
 * Las opciones llegan como campos `opcion_a`, `opcion_b`… y la correcta como
 * la letra elegida. Se descartan las vacías, así que el admin puede usar dos
 * opciones o cinco sin cambiar nada.
 */
export async function crearPregunta(
  _previo: EstadoAccion,
  datos: FormData
): Promise<EstadoAccion> {
  await exigirAdmin()

  const quizId = String(datos.get('quiz_id') ?? '')
  const leccionId = String(datos.get('lesson_id') ?? '')
  const enunciado = String(datos.get('question') ?? '').trim()
  const correcta = String(datos.get('correct_option_id') ?? '').trim()

  if (!quizId) return { error: 'Falta el quiz.' }
  if (enunciado.length < 3) return { error: 'La pregunta necesita al menos 3 caracteres.' }

  const opciones = LETRAS.map((letra) => ({
    id: letra,
    text: String(datos.get(`opcion_${letra}`) ?? '').trim(),
  })).filter((o) => o.text !== '')

  if (opciones.length < 2) return { error: 'Escribe al menos dos opciones.' }

  // La correcta tiene que ser una de las opciones que sí se escribieron. Sin
  // esta validación, una pregunta con la correcta apuntando a una opción vacía
  // sería imposible de aprobar, y el alumno nunca sabría por qué.
  if (!opciones.some((o) => o.id === correcta)) {
    return { error: 'Marca cuál de las opciones escritas es la correcta.' }
  }

  const supabase = await crearClienteServidor()

  const { data: ultima } = await supabase
    .from('quiz_questions')
    .select('position')
    .eq('quiz_id', quizId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('quiz_questions').insert({
    quiz_id: quizId,
    question: enunciado,
    options: opciones,
    correct_option_id: correcta,
    position: (ultima?.position ?? 0) + 1,
  })

  if (error) {
    registrarFallo('crearPregunta', { quizId }, error.message)
    return { error: 'No se pudo agregar la pregunta.' }
  }

  revalidatePath(`/admin/lecciones/${leccionId}`)
  return { aviso: 'Pregunta agregada.' }
}

export async function eliminarPregunta(datos: FormData): Promise<void> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  const leccionId = String(datos.get('lesson_id') ?? '')
  if (!id) return

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('quiz_questions').delete().eq('id', id)

  if (error) registrarFallo('eliminarPregunta', { id }, error.message)
  revalidatePath(`/admin/lecciones/${leccionId}`)
}

/** Mismo intercambio con el vecino que módulos y lecciones (§3.2). */
export async function moverPregunta(datos: FormData): Promise<void> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  const quizId = String(datos.get('quiz_id') ?? '')
  const leccionId = String(datos.get('lesson_id') ?? '')
  const direccion = String(datos.get('direccion') ?? '')
  if (!id || !quizId || (direccion !== 'arriba' && direccion !== 'abajo')) return

  const supabase = await crearClienteServidor()
  const arriba = direccion === 'arriba'

  const { data: actual } = await supabase
    .from('quiz_questions')
    .select('id, position')
    .eq('id', id)
    .maybeSingle()
  if (!actual) return

  const consulta = supabase.from('quiz_questions').select('id, position').eq('quiz_id', quizId)
  const { data: vecina } = await (arriba
    ? consulta.lt('position', actual.position).order('position', { ascending: false })
    : consulta.gt('position', actual.position).order('position', { ascending: true })
  )
    .limit(1)
    .maybeSingle()

  if (!vecina) return

  await supabase.from('quiz_questions').update({ position: vecina.position }).eq('id', actual.id)
  await supabase.from('quiz_questions').update({ position: actual.position }).eq('id', vecina.id)

  revalidatePath(`/admin/lecciones/${leccionId}`)
}
