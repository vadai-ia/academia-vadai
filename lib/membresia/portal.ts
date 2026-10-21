import 'server-only'

import { cache } from 'react'

import { inscritosDelCurso, type Inscrito } from '@/lib/admin/inscritos'
import { bandejaDeComunidad } from '@/lib/admin/comunidad'
import { logrosDe, type Logro } from '@/lib/gamificacion/logros'
import { ACTIVIDAD_VACIA, nivelDe, puntosDe, sumarActividad, type Actividad, type Nivel } from '@/lib/gamificacion/reglas'
import { panelVaip, type MiembroDelPanel } from '@/lib/membresia/admin'
import type { PlanPublico } from '@/lib/membresia/consultas'
import { esCuentaQa, esCursoQa } from '@/lib/qa'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * El portal de la comunidad en el panel (M19): lo que ven el admin Y el
 * community manager en /admin/vaip.
 *
 * Todo con la sesión de quien mira. El community manager lee inscripciones,
 * perfiles, avance y actividad (`is_equipo()`), pero NO membresías ni cobros
 * (`is_admin()`): por eso un miembro aquí es quien tiene una inscripción
 * `source = 'membresia'` en algún curso del plan, y su vigencia es la de esas
 * inscripciones. Lo de Stripe (estado de la suscripción, próximo cobro) se
 * suma solo cuando mira un admin (`conCobros`).
 *
 * El avance y los puntos salen de `inscritosDelCurso`, curso por curso del
 * plan: es la misma cuenta que el resto del panel (resta las sesiones
 * exclusivas y solo cuenta alumnos), sumada sobre el plan.
 */

export type MiembroDelPortal = {
  userId: string
  nombre: string
  correo: string
  empresa: string | null
  vigente: boolean
  accesoHasta: string | null
  miembroDesde: string | null
  ultimoAcceso: string | null
  hechas: number
  total: number
  porcentaje: number
  actividad: Actividad
  puntos: number
  nivel: Nivel
  lugar: number
  logrosGanados: number
  /** Solo para admin: lo que dice Stripe. */
  cobro: Pick<MiembroDelPanel, 'estado' | 'proximoCobro' | 'seCancela'> | null
}

/** Los cursos del plan (con la sesión: `membership_plan_courses` la lee cualquiera con sesión). */
export const cursosDelPlanParaEquipo = cache(async (planId: string) => {
  const supabase = await crearClienteServidor()
  const { data: enlaces } = await supabase.from('membership_plan_courses').select('course_id').eq('plan_id', planId)
  const ids = (enlaces ?? []).map((e) => e.course_id)
  if (ids.length === 0) return []
  const { data } = await supabase
    .from('courses')
    .select('id, slug, title, status, cover_url, created_at')
    .in('id', ids)
    .order('created_at')
  return data ?? []
})

/** Memorizada por petición; con argumentos simples, que `cache` compara por identidad. */
export const miembrosDelPortal = cache(
  async (planId: string, conCobros: boolean, veQa: boolean): Promise<MiembroDelPortal[]> => {
    const opciones = { conCobros, veQa }
    const supabase = await crearClienteServidor()
    const cursos = (await cursosDelPlanParaEquipo(planId)).filter((c) => opciones.veQa || !esCursoQa(c.slug))
    if (cursos.length === 0) return []
    const ids = cursos.map((c) => c.id)

    const [{ data: deMembresia }, porCurso, panel] = await Promise.all([
      supabase
        .from('enrollments')
        .select('user_id, expires_at, created_at')
        .in('course_id', ids)
        .eq('source', 'membresia')
        .eq('status', 'active'),
      Promise.all(ids.map((id) => inscritosDelCurso(id))),
      opciones.conCobros ? panelVaip(planId) : Promise.resolve(null),
    ])

    // Quién es miembro y desde cuándo, de sus inscripciones de membresía.
    const membresias = new Map<string, { hasta: string | null; desde: string | null }>()
    for (const e of deMembresia ?? []) {
      const previo = membresias.get(e.user_id)
      const hasta =
        previo?.hasta && e.expires_at
          ? Date.parse(previo.hasta) > Date.parse(e.expires_at)
            ? previo.hasta
            : e.expires_at
          : (previo?.hasta ?? e.expires_at)
      const desde = previo?.desde && Date.parse(previo.desde) < Date.parse(e.created_at) ? previo.desde : e.created_at
      membresias.set(e.user_id, { hasta, desde })
    }

    // Avance y actividad, sumados sobre los cursos del plan.
    const suma = new Map<string, { base: Inscrito; hechas: number; total: number; actividad: Actividad }>()
    for (const { visibles } of porCurso) {
      for (const i of visibles) {
        if (!membresias.has(i.userId)) continue
        const previo = suma.get(i.userId)
        suma.set(i.userId, {
          base: previo?.base ?? i,
          hechas: (previo?.hechas ?? 0) + i.hechas,
          total: (previo?.total ?? 0) + i.total,
          actividad: sumarActividad(previo?.actividad ?? ACTIVIDAD_VACIA, i.actividad),
        })
      }
    }

    const cobroDe = new Map((panel?.miembros ?? []).filter((m) => m.userId).map((m) => [m.userId as string, m]))
    const ahora = Date.now()

    const filas = [...suma.entries()]
      .filter(([, s]) => opciones.veQa || !esCuentaQa(s.base.email))
      .map(([userId, s]) => {
        const m = membresias.get(userId)
        const puntos = puntosDe(s.actividad)
        const cobro = cobroDe.get(userId)
        return {
          userId,
          nombre: s.base.nombre,
          correo: s.base.email,
          empresa: s.base.empresa?.nombre ?? null,
          vigente: m?.hasta === null || (m?.hasta !== undefined && Date.parse(m.hasta) > ahora),
          accesoHasta: m?.hasta ?? null,
          miembroDesde: m?.desde ?? null,
          ultimoAcceso: s.base.ultimoAcceso,
          hechas: s.hechas,
          total: s.total,
          porcentaje: s.total === 0 ? 0 : Math.round((s.hechas / s.total) * 100),
          actividad: s.actividad,
          puntos,
          nivel: nivelDe(puntos),
          lugar: 0,
          logrosGanados: 0,
          cobro:
            opciones.conCobros && cobro
              ? { estado: cobro.estado, proximoCobro: cobro.proximoCobro, seCancela: cobro.seCancela }
              : null,
        }
      })
      // El lugar, sobre la lista completa (como /admin/puntos): filtrar después no lo cambia.
      .sort((a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre, 'es'))
      .map((f, i) => ({ ...f, lugar: i + 1 }))

    return filas.map((f) => ({
      ...f,
      logrosGanados: logrosDe({ actividad: f.actividad, miembroDesde: f.miembroDesde, lugar: f.lugar }).filter(
        (l: Logro) => l.ganado
      ).length,
    }))
  }
)

export type FiltrosDeMiembros = { q?: string; estado?: string }

export function filtrarMiembros(miembros: MiembroDelPortal[], filtros: FiltrosDeMiembros): MiembroDelPortal[] {
  const q = (filtros.q ?? '').trim().toLowerCase()
  return miembros.filter((m) => {
    if (filtros.estado === 'vigentes' && !m.vigente) return false
    if (filtros.estado === 'vencidos' && m.vigente) return false
    if (!q) return true
    return [m.nombre, m.correo, m.empresa ?? ''].some((t) => t.toLowerCase().includes(q))
  })
}

export type ResumenDelPortal = {
  vigentes: number
  nuevosEsteMes: number
  vencieronEsteMes: number
  proxima: { titulo: string; programadaEn: string; tipo: 'clase' | 'evento'; lugar: string | null } | null
  /** Hilos del muro de V-AI-P que esperan respuesta del equipo; null si no se pudo leer. */
  sinRespuesta: number | null
  /** Solo admin. */
  cobros: { cobradoEsteMes: number; atrasados: number; seCancelan: number; alertas: number } | null
}

export async function resumenDelPortal(
  plan: PlanPublico,
  opciones: { conCobros: boolean; veQa: boolean }
): Promise<ResumenDelPortal> {
  const supabase = await crearClienteServidor()
  const inicioDeMes = new Date()
  inicioDeMes.setUTCDate(1)
  inicioDeMes.setUTCHours(0, 0, 0, 0)
  const ahora = Date.now()

  const [miembros, proxima, bandeja, panel] = await Promise.all([
    miembrosDelPortal(plan.id, opciones.conCobros, opciones.veQa),
    plan.casa
      ? supabase
          .from('cohort_sessions')
          .select('title, scheduled_at, kind, location, cohorts!inner(course_id)')
          .eq('cohorts.course_id', plan.casa.id)
          .gt('scheduled_at', new Date(ahora - 150 * 60 * 1000).toISOString())
          .order('scheduled_at')
          .limit(1)
      : Promise.resolve({ data: [] }),
    // M25: la bandeja de V-AI-P (su muro y las preguntas en sus clases).
    plan.casa ? bandejaDeComunidad({}, 'vaip') : Promise.resolve(null),
    opciones.conCobros ? panelVaip(plan.id) : Promise.resolve(null),
  ])

  const siguiente = (proxima.data ?? [])[0] as
    | { title: string; scheduled_at: string; kind: 'clase' | 'evento'; location: string | null }
    | undefined

  return {
    vigentes: miembros.filter((m) => m.vigente).length,
    nuevosEsteMes: miembros.filter((m) => m.miembroDesde && Date.parse(m.miembroDesde) >= inicioDeMes.getTime()).length,
    vencieronEsteMes: miembros.filter(
      (m) => !m.vigente && m.accesoHasta && Date.parse(m.accesoHasta) >= inicioDeMes.getTime()
    ).length,
    proxima: siguiente
      ? { titulo: siguiente.title, programadaEn: siguiente.scheduled_at, tipo: siguiente.kind, lugar: siguiente.location }
      : null,
    sinRespuesta: bandeja && !bandeja.fallo ? bandeja.conteos.sin : null,
    cobros: panel
      ? {
          cobradoEsteMes: panel.cifras.cobradoEsteMes,
          atrasados: panel.cifras.atrasados,
          seCancelan: panel.cifras.seCancelan,
          alertas: panel.alertas.atrasados.length + panel.alertas.duplicados.length + panel.alertas.sinCuenta.length,
        }
      : null,
  }
}

