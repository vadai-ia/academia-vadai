import 'server-only'

import { crearClienteServidor } from '@/lib/supabase/server'

export type Autor = {
  userId: string
  nombre: string
  avatar: string | null
  esEquipo: boolean
}

export type Comentario = {
  id: string
  contenido: string
  creadoEn: string
  autor: Autor
  esMio: boolean
  editable: boolean
  respuestas: Comentario[]
}

/** Ventana de edición de §3.7. */
const VENTANA_MIN = 15

/**
 * Resuelve los autores de un conjunto de comentarios.
 *
 * Va por `academia.public_profiles`, la vista de M1 que expone nombre, avatar y
 * un booleano de equipo — nunca el correo ni el rol crudo. PostgREST no puede
 * embeberla automáticamente porque es una vista sin FK declarada, así que se
 * pide aparte. Son dos consultas en vez de una, a cambio de no filtrar correos.
 */
async function resolverAutores(userIds: string[]): Promise<Map<string, Autor>> {
  const mapa = new Map<string, Autor>()
  if (userIds.length === 0) return mapa

  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('public_profiles')
    .select('user_id, full_name, avatar_url, es_equipo')
    .in('user_id', userIds)

  type Fila = {
    user_id: string | null
    full_name: string | null
    avatar_url: string | null
    es_equipo: boolean | null
  }

  for (const p of (data ?? []) as Fila[]) {
    if (!p.user_id) continue
    mapa.set(p.user_id, {
      userId: p.user_id,
      nombre: p.full_name?.trim() || 'Alumno',
      avatar: p.avatar_url,
      esEquipo: p.es_equipo ?? false,
    })
  }
  return mapa
}

function dentroDeVentana(creadoEn: string): boolean {
  return Date.now() - new Date(creadoEn).getTime() < VENTANA_MIN * 60_000
}

/**
 * Hilo de comentarios de una lección (§3.7).
 *
 * Solo trae los `visible`: la policy de M1 ya filtra, así que un comentario
 * oculto por el admin sencillamente no llega. Es lo que pide el criterio de
 * cierre — "comentario oculto por admin desaparece para alumno" — y no depende
 * de que la UI se acuerde de filtrarlo.
 */
export async function comentariosDeLeccion(
  leccionId: string,
  usuarioActual: string
): Promise<Comentario[]> {
  const supabase = await crearClienteServidor()

  const { data, error } = await supabase
    .from('lesson_comments')
    .select('id, user_id, parent_id, content, created_at, status')
    .eq('lesson_id', leccionId)
    .eq('status', 'visible')
    .order('created_at', { ascending: true })

  if (error) {
    console.error(
      JSON.stringify({ operacion: 'comentariosDeLeccion', leccionId, error: error.message })
    )
    return []
  }

  const filas = data ?? []
  const autores = await resolverAutores([...new Set(filas.map((c) => c.user_id))])

  const anonimo: Autor = { userId: '', nombre: 'Alumno', avatar: null, esEquipo: false }

  const armar = (fila: (typeof filas)[number]): Comentario => ({
    id: fila.id,
    contenido: fila.content,
    creadoEn: fila.created_at,
    autor: autores.get(fila.user_id) ?? anonimo,
    esMio: fila.user_id === usuarioActual,
    editable: fila.user_id === usuarioActual && dentroDeVentana(fila.created_at),
    respuestas: [],
  })

  const raices = filas.filter((c) => !c.parent_id).map(armar)
  const porPadre = new Map(raices.map((c) => [c.id, c]))

  for (const fila of filas.filter((c) => c.parent_id)) {
    porPadre.get(fila.parent_id as string)?.respuestas.push(armar(fila))
  }

  return raices
}
