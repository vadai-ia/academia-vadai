import 'server-only'

import { cache } from 'react'

import { esEquipo, obtenerSesion, type Perfil } from '@/lib/auth/sesion'
import { faltaFuncion, type LlamadaRpc } from '@/lib/alumno/catalogo'
import { cursoDelAlumno, misCursos, type CursoDelAlumno } from '@/lib/alumno/consultas'
import { sesionesDelAlumno, type SesionDelAlumno } from '@/lib/alumno/sesiones'
import { publicacionesParaAlumno, type AnuncioParaAlumno } from '@/lib/comunidad/posts'
import { logrosDe, type Logro } from '@/lib/gamificacion/logros'
import { ACTIVIDAD_VACIA, nivelDe, puntosDe, sumarActividad, type Actividad, type Nivel } from '@/lib/gamificacion/reglas'
import { miMembresia, planVaip, type PlanVaip } from '@/lib/membresia/consultas'
import { noticiasDeVaip } from '@/lib/membresia/noticias'
import type { PostDeComunidad } from '@/lib/comunidad/posts'
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

/** Los cursos del plan (`membership_plan_courses`). La actividad de cada uno la filtra RLS. */
async function idsDelPlan(planId: string): Promise<string[]> {
  const supabase = await crearClienteServidor()
  const { data } = await supabase.from('membership_plan_courses').select('course_id').eq('plan_id', planId)
  return (data ?? []).map((c) => c.course_id)
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
  /** M19: las últimas del tema «Noticias» del muro. */
  noticias: PostDeComunidad[]
  /** M19: las herramientas (cursos con área), por área. */
  herramientas: Record<'creativas' | 'administrativas' | 'comerciales', CursoDelAlumno[]>
  /** Los demás cursos del plan. */
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
    // Con user_id: la RLS deja al admin leer las membresías de todos.
    supabase.from('memberships').select('started_at').eq('plan_id', plan.id).eq('user_id', perfil.user_id),
  ])

  const casa = plan.casa
  const ahora = Date.now()
  const enLaCasa = cursos.find((c) => c.id === casa?.id)
  const { noticias } = casa
    ? await noticiasDeVaip(casa.id, perfil.user_id, { generacionId: enLaCasa?.generacion?.id ?? null, cuantas: 3 })
    : { noticias: [] }
  const delPlan = cursos.filter((c) => c.enVaip && c.id !== casa?.id)
  const proximaClase =
    sesiones.find(
      (s) => s.cursoSlug === casa?.slug && new Date(s.programadaEn).getTime() + VENTANA_EN_CURSO > ahora
    ) ?? null
  const miembroDesde = (membresias ?? []).map((m) => m.started_at).sort()[0] ?? null

  return {
    proximaClase,
    anuncios: anuncios.filter((a) => a.cursoId !== null && a.cursoId === casa?.id).slice(0, 3),
    noticias,
    herramientas: {
      creativas: delPlan.filter((c) => c.categoria === 'creativas'),
      administrativas: delPlan.filter((c) => c.categoria === 'administrativas'),
      comerciales: delPlan.filter((c) => c.categoria === 'comerciales'),
    },
    biblioteca: delPlan.filter((c) => c.categoria === null),
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

// ==========================================================================
// M22 (20-oct-2026): V-AI-P con pestañas propias — Muro · Clases ·
// Herramientas · Ranking — en vez de un tablero que mandaba a un «curso casa»
// con barra de avance.
// ==========================================================================

export type ContextoVaip = {
  perfil: Perfil
  plan: PlanVaip
  equipo: boolean
  /** La casa como curso de quien mira (su muro, sus clases, sus grabaciones); null si no hay o no está publicada. */
  casa: CursoDelAlumno | null
}

/**
 * Quién entra al espacio: un miembro vigente, o alguien del equipo (para
 * revisarlo). null = cualquier otra persona, a quien le toca la página de
 * venta. Memorizado por petición: lo piden la página y su encabezado.
 */
export const contextoVaip = cache(async (): Promise<ContextoVaip | null> => {
  const plan = await planVaip()
  if (!plan) return null
  const sesion = await obtenerSesion()
  if (sesion.tipo !== 'activo') return null
  const perfil = sesion.perfil
  const equipo = esEquipo(perfil)
  const membresia = equipo ? null : await miMembresia(plan.id)
  if (!equipo && !membresia?.vigente) return null
  const casa = plan.casa && (plan.casa.publicada || equipo) ? await cursoDelAlumno(plan.casa.slug) : null
  return { perfil, plan, equipo, casa }
})

const AREAS_DE_HERRAMIENTAS = ['creativas', 'administrativas', 'comerciales'] as const

/** Los cursos del plan menos la casa: por área (Herramientas) y sin área (Biblioteca). */
export async function herramientasDeVaip(plan: PlanVaip): Promise<Pick<EspacioVaip, 'herramientas' | 'biblioteca'>> {
  const cursos = await misCursos()
  const delPlan = cursos.filter((c) => c.enVaip && c.id !== plan.casa?.id)
  const herramientas = Object.fromEntries(
    AREAS_DE_HERRAMIENTAS.map((a) => [a, delPlan.filter((c) => c.categoria === a)])
  ) as EspacioVaip['herramientas']
  return { herramientas, biblioteca: delPlan.filter((c) => c.categoria === null) }
}

/** El ranking de V-AI-P y los logros de quien mira. */
export async function rankingYLogrosDeVaip(
  perfil: Perfil,
  plan: PlanVaip
): Promise<Pick<EspacioVaip, 'ranking' | 'logros'>> {
  const supabase = await crearClienteServidor()
  const [ranking, { data: membresias }] = await Promise.all([
    rankingVaip(plan.id, perfil.user_id),
    supabase.from('memberships').select('started_at').eq('plan_id', plan.id).eq('user_id', perfil.user_id),
  ])
  return {
    ranking,
    logros: logrosDe({
      actividad: ranking.yo?.actividad ?? ACTIVIDAD_VACIA,
      miembroDesde: (membresias ?? []).map((m) => m.started_at).sort()[0] ?? null,
      lugar: ranking.yo?.lugar ?? null,
    }),
  }
}

/**
 * Los cursos que se muestran como cursos (Inicio, Mis cursos): sin la casa de
 * V-AI-P —es V-AI-P, no un curso— y, para el miembro, sin las herramientas del
 * plan, que viven en V-AI-P → Herramientas. Así nada sale dos veces.
 */
export async function cursosFueraDeVaip(cursos: CursoDelAlumno[]): Promise<CursoDelAlumno[]> {
  const [ctx, plan] = await Promise.all([contextoVaip(), planVaip()])
  const casaId = plan?.casa?.id ?? null
  return cursos.filter((c) => c.id !== casaId && !(ctx !== null && c.enVaip))
}
