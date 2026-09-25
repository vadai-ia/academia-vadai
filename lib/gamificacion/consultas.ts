import 'server-only'

import { cache } from 'react'

import { crearClienteServidor } from '@/lib/supabase/server'

import {
  ACTIVIDAD_VACIA,
  nivelDe,
  puntosDe,
  sumarActividad,
  type Actividad,
  type Nivel,
} from './reglas'

/**
 * Puntos, nivel y ranking, leídos de la vista `actividad_por_curso`.
 *
 * La vista ya decide qué puede ver quien pregunta: los alumnos de los cursos
 * donde está inscrito, y nadie más. Aquí solo se suma y se ordena. Va por el
 * cliente del usuario, con su sesión: ni service role ni casts.
 */

type FilaActividad = {
  user_id: string | null
  course_id: string | null
  lecciones: number | null
  quizzes: number | null
  tareas: number | null
  tareas_aprobadas: number | null
  publicaciones: number | null
  comentarios: number | null
  certificados: number | null
  dinamicas: number | null
}

function actividadDe(f: FilaActividad): Actividad {
  return {
    lecciones: f.lecciones ?? 0,
    quizzes: f.quizzes ?? 0,
    tareas: f.tareas ?? 0,
    tareasAprobadas: f.tareas_aprobadas ?? 0,
    publicaciones: f.publicaciones ?? 0,
    comentarios: f.comentarios ?? 0,
    certificados: f.certificados ?? 0,
    dinamicas: f.dinamicas ?? 0,
  }
}

// `cache()`: /puntos la pedía tres veces en la misma petición —una para el
// nivel y una por cada ranking de curso— y son la misma vista con la misma
// sesión. Memorizada por petición, es un viaje (24-sep-2026).
const actividadVisible = cache(async function actividadVisible(): Promise<FilaActividad[]> {
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase.from('actividad_por_curso').select('*')
  if (error) {
    console.error(JSON.stringify({ operacion: 'actividadVisible', error: error.message }))
    return []
  }
  return (data ?? []) as FilaActividad[]
})

/** Ordena de más a menos puntos; a puntos iguales, más lecciones; luego nombre. */
function ordenar<T extends { puntos: number; actividad: Actividad; nombre: string }>(lista: T[]): T[] {
  return [...lista].sort(
    (a, b) =>
      b.puntos - a.puntos ||
      b.actividad.lecciones - a.actividad.lecciones ||
      a.nombre.localeCompare(b.nombre, 'es')
  )
}

export type PuestoEnRanking = {
  userId: string
  nombre: string
  avatar: string | null
  puntos: number
  nivel: Nivel
  actividad: Actividad
  posicion: number
  soyYo: boolean
}

export type RankingDeCurso = {
  puestos: PuestoEnRanking[]
  total: number
  /** Mi puesto aunque no esté entre los primeros; null si no estoy inscrito. */
  yo: PuestoEnRanking | null
}

/**
 * El ranking de un curso: todos los inscritos activos, ordenados.
 *
 * Los nombres salen de `public_profiles`, que ya deja ver nombre y avatar de
 * cualquier miembro de la academia. Es lo mismo que se ve en la comunidad.
 */
export async function rankingDelCurso(cursoId: string, userId: string): Promise<RankingDeCurso> {
  const filas = (await actividadVisible()).filter((f) => f.course_id === cursoId && f.user_id)
  if (filas.length === 0) return { puestos: [], total: 0, yo: null }

  const supabase = await crearClienteServidor()
  const ids = filas.map((f) => f.user_id as string)
  const { data: perfiles } = await supabase
    .from('public_profiles')
    .select('user_id, full_name, avatar_url')
    .in('user_id', ids)
  const perfil = new Map((perfiles ?? []).map((p) => [p.user_id as string, p]))

  const sinOrden = filas.map((f) => {
    const actividad = actividadDe(f)
    const puntos = puntosDe(actividad)
    const p = perfil.get(f.user_id as string)
    return {
      userId: f.user_id as string,
      nombre: p?.full_name?.trim() || 'Alumno',
      avatar: p?.avatar_url ?? null,
      puntos,
      nivel: nivelDe(puntos),
      actividad,
      soyYo: f.user_id === userId,
    }
  })

  const puestos = ordenar(sinOrden).map((p, i) => ({ ...p, posicion: i + 1 }))
  return { puestos, total: puestos.length, yo: puestos.find((p) => p.soyYo) ?? null }
}

export type MiNivel = {
  puntos: number
  nivel: Nivel
  actividad: Actividad
  porCurso: Array<{ cursoId: string; puntos: number; posicion: number; total: number }>
}

/**
 * Mis puntos en total y mi lugar en cada uno de mis cursos.
 *
 * Es una sola lectura de la vista: trae a todos los compañeros de todos mis
 * cursos, que es lo que hace falta para saber en qué lugar voy en cada uno.
 */
export async function miNivel(userId: string): Promise<MiNivel> {
  const filas = await actividadVisible()

  let actividad = ACTIVIDAD_VACIA
  const porCurso: MiNivel['porCurso'] = []

  const cursos = new Set(filas.filter((f) => f.user_id === userId).map((f) => f.course_id as string))
  for (const cursoId of cursos) {
    const delCurso = filas.filter((f) => f.course_id === cursoId && f.user_id)
    const conPuntos = ordenar(
      delCurso.map((f) => {
        const a = actividadDe(f)
        return { userId: f.user_id as string, nombre: '', puntos: puntosDe(a), actividad: a }
      })
    )
    const indice = conPuntos.findIndex((p) => p.userId === userId)
    const mio = conPuntos[indice]
    if (!mio) continue
    actividad = sumarActividad(actividad, mio.actividad)
    porCurso.push({ cursoId, puntos: mio.puntos, posicion: indice + 1, total: conPuntos.length })
  }

  const puntos = puntosDe(actividad)
  return { puntos, nivel: nivelDe(puntos), actividad, porCurso }
}
