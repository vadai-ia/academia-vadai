import 'server-only'

import type { Perfil } from '@/lib/auth/sesion'
import { faltaFuncion, type LlamadaRpc } from '@/lib/alumno/catalogo'
import { misCursos, type CursoDelAlumno } from '@/lib/alumno/consultas'
import { sesionesDelAlumno, type SesionDelAlumno } from '@/lib/alumno/sesiones'
import { publicacionesParaAlumno, type AnuncioParaAlumno } from '@/lib/comunidad/posts'
import { logrosDe, type Logro } from '@/lib/gamificacion/logros'
import { ACTIVIDAD_VACIA, nivelDe, puntosDe, sumarActividad, type Actividad, type Nivel } from '@/lib/gamificacion/reglas'
import type { PlanVaip } from '@/lib/membresia/consultas'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * El espacio de V-AI-P (M17, fase 2): lo que ve un miembro en /vaip.
 *
 * Todo con la sesión de quien mira (RLS): la próxima clase y los anuncios son
 * los de su generación, y el ranking sale de `actividad_por_curso`, que solo
 * enseña a la gente de los cursos donde está inscrito.
 */

export type PuestoVaip = {
  userId: string
  nombre: string
  foto: string | null
  puntos: number
  nivel: Nivel
  actividad: Actividad
  lugar: number
  soyYo: boolean
}

export type RankingVaip = { puestos: PuestoVaip[]; yo: PuestoVaip | null; total: number }

/** Los cursos del plan que ve quien pregunta (los publicados; RLS hace el resto). */
async function idsDelPlan(planId: string): Promise<string[]> {
  const supabase = await crearClienteServidor()
  const { data } = await supabase.from('courses').select('id').eq('plan_id', planId)
  return (data ?? []).map((c) => c.id)
}

/**
 * El ranking de V-AI-P: la actividad sumada en TODOS los cursos del plan, no
 * solo en la casa. El lugar se calcula sobre la lista completa (como en
 * /admin/puntos): filtrar después no cambia en qué lugar va nadie.
 */
export async function rankingVaip(planId: string, userId: string): Promise<RankingVaip> {
  const supabase = await crearClienteServidor()
  const ids = await idsDelPlan(planId)
  if (ids.length === 0) return { puestos: [], yo: null, total: 0 }

  const { data: filas } = await supabase.from('actividad_por_curso').select('*').in('course_id', ids)
  const porPersona = new Map<string, Actividad>()
  for (const f of filas ?? []) {
    if (!f.user_id) continue
    const a: Actividad = {
      lecciones: f.lecciones ?? 0,
      quizzes: f.quizzes ?? 0,
      tareas: f.tareas ?? 0,
      tareasAprobadas: f.tareas_aprobadas ?? 0,
      publicaciones: f.publicaciones ?? 0,
      comentarios: f.comentarios ?? 0,
      certificados: f.certificados ?? 0,
      dinamicas: f.dinamicas ?? 0,
    }
    porPersona.set(f.user_id, sumarActividad(porPersona.get(f.user_id) ?? ACTIVIDAD_VACIA, a))
  }

  const personas = [...porPersona.keys()]
  const { data: perfiles } = personas.length
    ? await supabase.from('public_profiles').select('user_id, full_name, avatar_url, es_equipo').in('user_id', personas)
    : { data: [] }
  const perfilPorId = new Map((perfiles ?? []).map((p) => [p.user_id, p]))

  const ordenados = personas
    .filter((id) => !perfilPorId.get(id)?.es_equipo)
    .map((id) => {
      const actividad = porPersona.get(id) ?? ACTIVIDAD_VACIA
      const puntos = puntosDe(actividad)
      return {
        userId: id,
        nombre: perfilPorId.get(id)?.full_name || 'Miembro',
        foto: perfilPorId.get(id)?.avatar_url ?? null,
        puntos,
        nivel: nivelDe(puntos),
        actividad,
        lugar: 0,
        soyYo: id === userId,
      }
    })
    .sort((a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre, 'es'))
    .map((p, i) => ({ ...p, lugar: i + 1 }))

  return { puestos: ordenados, yo: ordenados.find((p) => p.soyYo) ?? null, total: ordenados.length }
}

export type EspacioVaip = {
  proximaClase: SesionDelAlumno | null
  anuncios: AnuncioParaAlumno[]
  biblioteca: CursoDelAlumno[]
  ranking: RankingVaip
  logros: Logro[]
}

/** Las clases de la casa en curso o por empezar (una clase dura ~2.5 h). */
const VENTANA_EN_CURSO = 150 * 60 * 1000

export async function espacioVaip(perfil: Perfil, plan: PlanVaip): Promise<EspacioVaip> {
  const supabase = await crearClienteServidor()
  const [sesiones, anuncios, cursos, ranking, { data: membresias }] = await Promise.all([
    sesionesDelAlumno(),
    publicacionesParaAlumno('announcement'),
    misCursos(),
    rankingVaip(plan.id, perfil.user_id),
    supabase.from('memberships').select('started_at').eq('plan_id', plan.id),
  ])

  const casa = plan.casa
  const ahora = Date.now()
  const proximaClase =
    sesiones.find(
      (s) => s.cursoSlug === casa?.slug && new Date(s.programadaEn).getTime() + VENTANA_EN_CURSO > ahora
    ) ?? null
  const miembroDesde = (membresias ?? []).map((m) => m.started_at).sort()[0] ?? null

  return {
    proximaClase,
    anuncios: anuncios.filter((a) => a.cursoId !== null && a.cursoId === casa?.id).slice(0, 3),
    biblioteca: cursos.filter((c) => c.enVaip && c.id !== casa?.id),
    ranking,
    logros: logrosDe({
      actividad: ranking.yo?.actividad ?? ACTIVIDAD_VACIA,
      miembroDesde,
      lugar: ranking.yo?.lugar ?? null,
    }),
  }
}

export type PerfilDeMiembro = {
  userId: string
  nombre: string
  foto: string | null
  bio: string | null
  empresa: string | null
  esEquipo: boolean
  puesto: PuestoVaip | null
  logros: Logro[]
}

/**
 * Lo que un miembro ve de otro (academia_perfil_de_miembro): solo entre
 * miembros vigentes, o para el equipo. Null = no existe o no le toca verlo.
 */
export async function perfilDeMiembro(planId: string, userId: string, quienMira: string): Promise<PerfilDeMiembro | null> {
  const supabase = await crearClienteServidor()
  const rpc = (supabase.rpc as unknown as LlamadaRpc).bind(supabase)
  const { data, error } = await rpc('academia_perfil_de_miembro', { p_user: userId })
  if (error) {
    if (!faltaFuncion(error)) console.error(JSON.stringify({ operacion: 'perfilDeMiembro', userId, error: error.message }))
    return null
  }
  type Fila = {
    user_id: string
    full_name: string
    avatar_url: string | null
    bio: string | null
    empresa: string | null
    es_equipo: boolean
    miembro_desde: string | null
  }
  const fila = (Array.isArray(data) ? (data as Fila[]) : [])[0]
  if (!fila) return null

  const ranking = await rankingVaip(planId, quienMira)
  const puesto = ranking.puestos.find((p) => p.userId === userId) ?? null
  return {
    userId: fila.user_id,
    nombre: fila.full_name || 'Miembro',
    foto: fila.avatar_url,
    bio: fila.bio,
    empresa: fila.empresa,
    esEquipo: fila.es_equipo,
    puesto,
    logros: logrosDe({
      actividad: puesto?.actividad ?? ACTIVIDAD_VACIA,
      miembroDesde: fila.miembro_desde,
      lugar: puesto?.lugar ?? null,
    }),
  }
}
