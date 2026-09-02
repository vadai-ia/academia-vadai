'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import type { EstadoAccion } from '@/lib/admin/tipos'
import { exigirAdmin } from '@/lib/auth/sesion'
import { LETRAS } from '@/lib/quiz/comun'
import { crearClienteServidor } from '@/lib/supabase/server'

import { generarJoinCode, generarProjectionToken } from './codigo'
import { ajustesPorDefecto, TIPOS_PREGUNTA, TOPE_PALABRA, type TipoPregunta } from './comun'

/**
 * Administración de encuestas en vivo (M12, etapa 1).
 *
 * Todo lo de aquí pasa por RLS con el cliente del usuario: son operaciones de
 * admin y `exigirAdmin()` ya cortó antes. El service role de esta feature vive
 * en el camino público, donde quien escribe puede no tener cuenta.
 */

function registrarFallo(operacion: string, detalle: Record<string, unknown>, error: string) {
  console.error(JSON.stringify({ operacion, ...detalle, error }))
}

function primerError(resultado: { error?: { issues: Array<{ message: string }> } }) {
  return resultado.error?.issues[0]?.message ?? 'Revisa los datos.'
}

const esquemaEncuesta = z.object({
  course_id: z.uuid('Elige el curso al que pertenece.'),
  cohort_id: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  title: z.string().trim().min(3, 'La encuesta necesita un título.').max(160),
  description: z
    .string()
    .trim()
    .max(400, 'La descripción es muy larga.')
    .transform((v) => (v === '' ? null : v))
    .nullable(),
})

/**
 * Crea la encuesta y se va derecho a su editor.
 *
 * El join_code se reintenta ante colisión. Son 32^6 combinaciones y solo se
 * cruzan las encuestas que existen, así que chocar es rarísimo — pero el
 * `unique` de la tabla es quien manda y hay que responderle. Tres intentos
 * bastan; si fallan los tres, algo más está roto y conviene decirlo en vez de
 * seguir girando.
 */
export async function crearEncuesta(
  _previo: EstadoAccion,
  datos: FormData
): Promise<EstadoAccion> {
  const perfil = await exigirAdmin()

  const resultado = esquemaEncuesta.safeParse({
    course_id: datos.get('course_id'),
    cohort_id: datos.get('cohort_id') ?? '',
    title: datos.get('title'),
    description: datos.get('description') ?? '',
  })
  if (!resultado.success) return { error: primerError(resultado) }

  const supabase = await crearClienteServidor()
  let creada: string | null = null

  for (let intento = 0; intento < 3 && !creada; intento += 1) {
    const { data, error } = await supabase
      .from('polls')
      .insert({
        ...resultado.data,
        join_code: generarJoinCode(),
        projection_token: generarProjectionToken(),
        created_by: perfil.user_id,
      })
      .select('id')
      .maybeSingle()

    if (data) {
      creada = data.id
      break
    }

    // 23505 = unique_violation, o sea que el código chocó: reintentar tiene
    // sentido. Cualquier otro error no se arregla girando.
    if (error && error.code !== '23505') {
      registrarFallo('crearEncuesta', { curso: resultado.data.course_id }, error.message)
      return { error: 'No se pudo crear la encuesta.' }
    }
  }

  if (!creada) return { error: 'No se pudo generar un código libre. Vuelve a intentarlo.' }

  revalidatePath('/admin/encuestas')
  redirect(`/admin/encuestas/${creada}`)
}

export async function actualizarEncuesta(
  _previo: EstadoAccion,
  datos: FormData
): Promise<EstadoAccion> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  if (!id) return { error: 'Falta la encuesta.' }

  const resultado = esquemaEncuesta.safeParse({
    course_id: datos.get('course_id'),
    cohort_id: datos.get('cohort_id') ?? '',
    title: datos.get('title'),
    description: datos.get('description') ?? '',
  })
  if (!resultado.success) return { error: primerError(resultado) }

  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('polls')
    .update({
      ...resultado.data,
      // Una casilla sin marcar no viaja en el FormData. Su ausencia ES el false.
      allow_guests: datos.get('allow_guests') !== null,
      show_names: datos.get('show_names') !== null,
    })
    .eq('id', id)

  if (error) {
    registrarFallo('actualizarEncuesta', { id }, error.message)
    return { error: 'No se pudo guardar la encuesta.' }
  }

  revalidatePath(`/admin/encuestas/${id}`)
  revalidatePath('/admin/encuestas')
  return { aviso: 'Encuesta guardada.' }
}

export async function eliminarEncuesta(datos: FormData): Promise<void> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  if (!id) return

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('polls').delete().eq('id', id)

  if (error) {
    registrarFallo('eliminarEncuesta', { id }, error.message)
    return
  }

  revalidatePath('/admin/encuestas')
  redirect('/admin/encuestas')
}

// --------------------------------------------------------------------------
// Preguntas
// --------------------------------------------------------------------------

const esquemaPregunta = z.object({
  prompt: z.string().trim().min(3, 'La pregunta necesita al menos 3 caracteres.').max(300),
  question_type: z.enum(TIPOS_PREGUNTA, { message: 'Elige un tipo de pregunta.' }),
})

/**
 * Agrega una pregunta.
 *
 * Las opciones llegan como `opcion_a`, `opcion_b`… igual que en el builder de
 * quizzes, y se descartan las vacías: así el admin usa dos opciones o cinco sin
 * cambiar nada.
 *
 * La diferencia con un quiz es que aquí NO hay respuesta correcta. Una encuesta
 * no se califica, y por eso `poll_questions` sí se le puede mostrar al alumno
 * mientras que `quiz_questions` es admin-only.
 */
export async function crearPreguntaEncuesta(
  _previo: EstadoAccion,
  datos: FormData
): Promise<EstadoAccion> {
  await exigirAdmin()

  const encuestaId = String(datos.get('poll_id') ?? '')
  if (!encuestaId) return { error: 'Falta la encuesta.' }

  const resultado = esquemaPregunta.safeParse({
    prompt: datos.get('prompt'),
    question_type: datos.get('question_type'),
  })
  if (!resultado.success) return { error: primerError(resultado) }

  const tipo: TipoPregunta = resultado.data.question_type
  const ajustes = ajustesPorDefecto(tipo)

  const opciones =
    tipo === 'opcion'
      ? LETRAS.map((letra) => ({
          id: letra,
          text: String(datos.get(`opcion_${letra}`) ?? '').trim(),
        })).filter((o) => o.text !== '')
      : []

  if (tipo === 'opcion' && opciones.length < 2) {
    return { error: 'Una pregunta de opción múltiple necesita al menos dos opciones.' }
  }

  if (tipo === 'escala') {
    const min = Number(datos.get('escala_min') ?? 1)
    const max = Number(datos.get('escala_max') ?? 10)
    if (!Number.isInteger(min) || !Number.isInteger(max) || max <= min) {
      return { error: 'La escala necesita un mínimo y un máximo, y el máximo debe ser mayor.' }
    }
    ajustes.min = min
    ajustes.max = max
    ajustes.etiquetaMin = String(datos.get('escala_etiqueta_min') ?? '').trim()
    ajustes.etiquetaMax = String(datos.get('escala_etiqueta_max') ?? '').trim()
  }

  if (tipo === 'nube') {
    const palabras = Number(datos.get('nube_palabras') ?? 1)
    // Tres es el tope duro: más palabras por persona y la nube deja de ser el
    // retrato de la sala para ser el retrato de quien escribe más rápido.
    ajustes.maxPalabras = Number.isInteger(palabras) && palabras > 0 ? Math.min(palabras, 3) : 1
    ajustes.maxCaracteres = TOPE_PALABRA
  }

  const supabase = await crearClienteServidor()

  const { data: ultima } = await supabase
    .from('poll_questions')
    .select('position')
    .eq('poll_id', encuestaId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('poll_questions').insert({
    poll_id: encuestaId,
    prompt: resultado.data.prompt,
    question_type: tipo,
    options: opciones,
    settings: ajustes,
    position: (ultima?.position ?? 0) + 1,
  })

  if (error) {
    registrarFallo('crearPreguntaEncuesta', { encuestaId, tipo }, error.message)
    return { error: 'No se pudo agregar la pregunta.' }
  }

  revalidatePath(`/admin/encuestas/${encuestaId}`)
  return { aviso: 'Pregunta agregada.' }
}

export async function eliminarPreguntaEncuesta(datos: FormData): Promise<void> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  const encuestaId = String(datos.get('poll_id') ?? '')
  if (!id) return

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('poll_questions').delete().eq('id', id)

  if (error) registrarFallo('eliminarPreguntaEncuesta', { id }, error.message)
  revalidatePath(`/admin/encuestas/${encuestaId}`)
}

/** Mismo intercambio con el vecino que módulos, lecciones y preguntas de quiz. */
export async function moverPreguntaEncuesta(datos: FormData): Promise<void> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  const encuestaId = String(datos.get('poll_id') ?? '')
  const direccion = String(datos.get('direccion') ?? '')
  if (!id || !encuestaId || (direccion !== 'arriba' && direccion !== 'abajo')) return

  const supabase = await crearClienteServidor()
  const arriba = direccion === 'arriba'

  const { data: actual } = await supabase
    .from('poll_questions')
    .select('id, position')
    .eq('id', id)
    .maybeSingle()
  if (!actual) return

  const consulta = supabase.from('poll_questions').select('id, position').eq('poll_id', encuestaId)
  const { data: vecina } = await (arriba
    ? consulta.lt('position', actual.position).order('position', { ascending: false })
    : consulta.gt('position', actual.position).order('position', { ascending: true })
  )
    .limit(1)
    .maybeSingle()

  if (!vecina) return

  await supabase.from('poll_questions').update({ position: vecina.position }).eq('id', actual.id)
  await supabase.from('poll_questions').update({ position: actual.position }).eq('id', vecina.id)

  revalidatePath(`/admin/encuestas/${encuestaId}`)
}

// --------------------------------------------------------------------------
// Control en vivo
//
// Es lo que el admin toca desde su celular mientras la sala mira la pared.
// Todo revalida las DOS rutas: la de control, que es la que él está viendo, y
// la proyección, que se refresca sola por sondeo pero conviene dejar al día por
// si alguien la recarga.
// --------------------------------------------------------------------------

function refrescar(encuestaId: string) {
  revalidatePath(`/admin/encuestas/${encuestaId}`)
  revalidatePath(`/admin/encuestas/${encuestaId}/control`)
}

/** Abre la encuesta: a partir de aquí la gente puede escanear y entrar. */
export async function iniciarEncuesta(datos: FormData): Promise<void> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  if (!id) return

  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('polls')
    .update({ status: 'live', opened_at: new Date().toISOString() })
    .eq('id', id)

  if (error) registrarFallo('iniciarEncuesta', { id }, error.message)
  refrescar(id)
}

/**
 * Cierra la encuesta y, de paso, la pregunta que hubiera quedado abierta.
 *
 * Lo segundo no es cortesía: una pregunta abierta en una encuesta cerrada
 * seguiría aceptando respuestas de quien tuviera la pestaña abierta, y esas
 * respuestas llegarían después de que la sala ya vio el resultado final.
 */
export async function cerrarEncuesta(datos: FormData): Promise<void> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  if (!id) return

  const supabase = await crearClienteServidor()

  await supabase
    .from('poll_questions')
    .update({ status: 'closed' })
    .eq('poll_id', id)
    .eq('status', 'open')

  const { error } = await supabase
    .from('polls')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', id)

  if (error) registrarFallo('cerrarEncuesta', { id }, error.message)
  refrescar(id)
}

/**
 * Abre una pregunta y cierra la anterior.
 *
 * El orden importa: primero se cierra la que estaba abierta, porque el índice
 * único parcial `poll_questions_una_abierta` no deja que haya dos. Si dos
 * peticiones llegaran a la vez, una de las dos choca contra el índice y no pasa
 * nada raro — que es justamente para lo que está.
 *
 * Si la encuesta seguía en borrador se pone en vivo aquí mismo. Sin eso, el
 * admin abriría la primera pregunta y la sala no podría entrar, porque `entrar`
 * exige que la encuesta esté en vivo; y el síntoma —"no me deja"— no señalaría
 * al botón que faltaba tocar.
 */
export async function abrirPregunta(datos: FormData): Promise<void> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  const encuestaId = String(datos.get('poll_id') ?? '')
  if (!id || !encuestaId) return

  const supabase = await crearClienteServidor()

  await supabase
    .from('poll_questions')
    .update({ status: 'closed' })
    .eq('poll_id', encuestaId)
    .eq('status', 'open')

  const { error } = await supabase
    .from('poll_questions')
    .update({ status: 'open' })
    .eq('id', id)
    .eq('status', 'pending')

  if (error) registrarFallo('abrirPregunta', { id }, error.message)

  await supabase
    .from('polls')
    .update({ status: 'live', opened_at: new Date().toISOString() })
    .eq('id', encuestaId)
    .eq('status', 'draft')

  refrescar(encuestaId)
}

export async function cerrarPregunta(datos: FormData): Promise<void> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  const encuestaId = String(datos.get('poll_id') ?? '')
  if (!id || !encuestaId) return

  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('poll_questions')
    .update({ status: 'closed' })
    .eq('id', id)
    .eq('status', 'open')

  if (error) registrarFallo('cerrarPregunta', { id }, error.message)
  refrescar(encuestaId)
}

/**
 * El botón de pánico.
 *
 * Un QR proyectado frente a una sala es una caja de texto abierta a internet:
 * tarde o temprano llega algo que no puede quedarse en la pared. Esto la saca de
 * la proyección en el siguiente sondeo, o sea en menos de un segundo.
 *
 * NO la borra. El dato sigue ahí y sale en la exportación marcado como oculto:
 * si alguien escribió una grosería en una capacitación de empresa, el cliente va
 * a querer saber que ocurrió, no que desapareciera sin rastro.
 */
export async function alternarRespuestaOculta(datos: FormData): Promise<void> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  const encuestaId = String(datos.get('poll_id') ?? '')
  const ocultar = String(datos.get('ocultar') ?? '') === 'si'
  if (!id || !encuestaId) return

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('poll_answers').update({ hidden: ocultar }).eq('id', id)

  if (error) registrarFallo('alternarRespuestaOculta', { id }, error.message)
  refrescar(encuestaId)
}
