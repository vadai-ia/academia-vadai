import 'server-only'

import { cache } from 'react'

import { leerOpciones, type Opcion } from '@/lib/quiz/comun'
import { crearClienteServidor } from '@/lib/supabase/server'
import type { Tabla } from '@/lib/supabase/types'

import { leerAjustes, type AjustesPregunta, type TipoPregunta } from './comun'

/**
 * Lecturas del admin para encuestas en vivo.
 *
 * Todas usan el cliente de servidor con la llave anónima, o sea que pasan por
 * RLS. El service role de esta feature se reserva para el camino público
 * —unirse y responder desde el QR—, donde quien escribe puede no tener sesión.
 */

export type Encuesta = Tabla<'polls'>
export type PreguntaEncuesta = Tabla<'poll_questions'>

export type PreguntaCompleta = PreguntaEncuesta & {
  tipo: TipoPregunta
  opciones: Opcion[]
  ajustes: AjustesPregunta
  totalRespuestas: number
}

export type EncuestaEnLista = Encuesta & {
  curso: string
  cohorte: string | null
  totalPreguntas: number
  totalParticipantes: number
}

export type EncuestaCompleta = Encuesta & {
  curso: string
  cohorte: string | null
  preguntas: PreguntaCompleta[]
  /** De la corrida en curso. Las anteriores solo salen en la exportación. */
  totalParticipantes: number
  /** Cuántas corridas lleva, contando la actual. */
  totalCorridas: number
}

function registrarFallo(operacion: string, detalle: Record<string, unknown>, error: string) {
  console.error(JSON.stringify({ operacion, ...detalle, error }))
}

export async function listarEncuestas(): Promise<EncuestaEnLista[]> {
  const supabase = await crearClienteServidor()

  const { data, error } = await supabase
    .from('polls')
    .select('*, courses(title), cohorts(name), poll_questions(id), poll_participants(id)')
    .order('created_at', { ascending: false })

  if (error) {
    registrarFallo('listarEncuestas', {}, error.message)
    return []
  }

  type Anidado = Encuesta & {
    courses: { title: string } | null
    cohorts: { name: string } | null
    poll_questions: Array<{ id: string }>
    poll_participants: Array<{ id: string }>
  }

  return (data as unknown as Anidado[]).map((fila) => {
    const { courses, cohorts, poll_questions, poll_participants, ...resto } = fila
    return {
      ...resto,
      curso: courses?.title ?? 'Curso eliminado',
      cohorte: cohorts?.name ?? null,
      totalPreguntas: poll_questions?.length ?? 0,
      totalParticipantes: poll_participants?.length ?? 0,
    }
  })
}

export type MiEncuesta = {
  id: string
  titulo: string
  estado: 'draft' | 'live' | 'closed'
  joinCode: string
  entreEn: string
}

/**
 * Las encuestas en las que participó el usuario actual, con SU cuenta.
 *
 * Pasa por RLS. Lo que la hace posible son las dos policies de
 * `academia_0021`: sin ellas esto devolvía una lista vacía a quien sí había
 * participado, que es el caso de todo el que se registra desde el QR.
 *
 * Quien contestó como invitado —sin cuenta— no aparece aquí, y es correcto: no
 * hay ninguna sesión a la que atribuirle esa participación.
 */
export async function misEncuestas(): Promise<MiEncuesta[]> {
  const supabase = await crearClienteServidor()

  const { data, error } = await supabase
    .from('poll_participants')
    .select('joined_at, polls(id, title, status, join_code)')
    .order('joined_at', { ascending: false })

  if (error) {
    registrarFallo('misEncuestas', {}, error.message)
    return []
  }

  type Fila = {
    joined_at: string
    polls: { id: string; title: string; status: string; join_code: string } | null
  }

  return ((data ?? []) as unknown as Fila[]).flatMap((f) =>
    f.polls
      ? [
          {
            id: f.polls.id,
            titulo: f.polls.title,
            estado: f.polls.status as MiEncuesta['estado'],
            joinCode: f.polls.join_code,
            entreEn: f.joined_at,
          },
        ]
      : []
  )
}

export type RespuestaEnLista = {
  id: string
  texto: string | null
  opcion: string | null
  numero: number | null
  oculta: boolean
  autor: string
  creadaEn: string
}

/**
 * Las respuestas de una pregunta, una por una y con su autor.
 *
 * Es lo que alimenta el botón de pánico del control en vivo: para ocultar una
 * grosería hay que poder señalarla, y un agregado no tiene ids que señalar.
 *
 * Pasa por RLS con el cliente del usuario. La policy de `poll_answers` es
 * admin-only, así que si un alumno llegara aquí recibiría una lista vacía en vez
 * de los nombres y las respuestas de toda la sala.
 */
export async function respuestasDePregunta(
  preguntaId: string,
  corrida: number,
  limite = 40
): Promise<RespuestaEnLista[]> {
  const supabase = await crearClienteServidor()

  const { data, error } = await supabase
    .from('poll_answers')
    .select(
      'id, text_value, option_id, numeric_value, hidden, created_at, poll_participants(display_name)'
    )
    .eq('question_id', preguntaId)
    // Solo la corrida en curso: moderar es una acción sobre lo que está en la
    // pared ahora, no sobre lo que dijo un grupo de hace tres meses.
    .eq('corrida', corrida)
    .order('created_at', { ascending: false })
    .limit(limite)

  if (error) {
    registrarFallo('respuestasDePregunta', { preguntaId }, error.message)
    return []
  }

  type Fila = {
    id: string
    text_value: string | null
    option_id: string | null
    numeric_value: number | null
    hidden: boolean
    created_at: string
    poll_participants: { display_name: string } | null
  }

  return ((data ?? []) as unknown as Fila[]).map((f) => ({
    id: f.id,
    texto: f.text_value,
    opcion: f.option_id,
    numero: f.numeric_value,
    oculta: f.hidden,
    autor: f.poll_participants?.display_name ?? 'Sin nombre',
    creadaEn: f.created_at,
  }))
}

/**
 * Una encuesta con sus preguntas, ya ordenadas por `position`.
 *
 * El conteo de respuestas por pregunta viene del anidado y no de un count() por
 * separado: son cuatro o cinco preguntas, y un viaje de red extra por cada una
 * es justo lo que M11 quitó de las vistas del alumno.
 *
 * Va envuelta en `cache()` de React, que memoriza POR PETICIÓN: el layout de la
 * encuesta la pide para pintar el encabezado y la página la vuelve a pedir para
 * su sección. Sin esto serían dos viajes idénticos a Supabase en cada carga.
 */
export const obtenerEncuesta = cache(async function obtenerEncuesta(
  id: string
): Promise<EncuestaCompleta | null> {
  const supabase = await crearClienteServidor()

  const { data, error } = await supabase
    .from('polls')
    .select(
      '*, courses(title), cohorts(name), poll_participants(id, corrida), poll_questions(*, poll_answers(id, corrida))'
    )
    .eq('id', id)
    .maybeSingle()

  if (error) {
    registrarFallo('obtenerEncuesta', { id }, error.message)
    return null
  }
  if (!data) return null

  type Anidado = Encuesta & {
    courses: { title: string } | null
    cohorts: { name: string } | null
    poll_participants: Array<{ id: string; corrida: number }>
    poll_questions: Array<
      PreguntaEncuesta & { poll_answers: Array<{ id: string; corrida: number }> }
    >
  }

  const fila = data as unknown as Anidado
  const { courses, cohorts, poll_participants, poll_questions, ...resto } = fila

  return {
    ...resto,
    curso: courses?.title ?? 'Curso eliminado',
    cohorte: cohorts?.name ?? null,
    totalParticipantes: (poll_participants ?? []).filter((a) => a.corrida === resto.corrida)
      .length,
    // Cuántas corridas lleva: la actual es la más alta, así que el número ES la
    // cuenta. Un entero, no un `count` sobre las respuestas.
    totalCorridas: resto.corrida,
    preguntas: [...(poll_questions ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((p) => {
        const tipo = p.question_type as TipoPregunta
        return {
          ...p,
          tipo,
          opciones: leerOpciones(p.options),
          ajustes: leerAjustes(p.settings, tipo),
          // Solo las de la corrida en curso: es lo que se está proyectando.
          totalRespuestas: (p.poll_answers ?? []).filter((r) => r.corrida === resto.corrida)
            .length,
        }
      }),
  }
})
