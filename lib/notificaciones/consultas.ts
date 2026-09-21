import 'server-only'

import { sesionesDelAlumno } from '@/lib/alumno/sesiones'
import type { Perfil } from '@/lib/auth/sesion'
import { describirHorario } from '@/lib/calendario/enlaces'
import { publicacionesParaAlumno } from '@/lib/comunidad/posts'
import { dinamicasAbiertasParaCampana } from '@/lib/dinamicas/consultas-alumno'

/**
 * Las novedades de la campana: anuncios, entradas de blog y sesiones en vivo.
 *
 * "Nuevo" es todo lo publicado —o agendado, o cambiado— después de la última
 * vez que la persona abrió la campana (`profiles.notifications_seen_at`). Si
 * nunca la ha abierto, cuenta desde que se creó su cuenta: lo publicado antes
 * de que existiera no es una novedad para ella, y estrenar la campana con
 * doce avisos viejos en rojo es la forma más rápida de que deje de mirarla.
 *
 * Las sesiones entraron el 21-sep-2026: agendar o mover una sesión avisa a
 * los inscritos de su cohorte. Se usa `updated_at`, que el trigger sella en
 * cada cambio, y solo cuentan las futuras: mover una sesión pasada no es
 * noticia. La policy de `cohort_sessions` ya decide quién ve cuál.
 *
 * Las dinámicas empresariales entraron con M13: abrir una (o reabrirla, que
 * vuelve a sellar `opened_at`) avisa a los inscritos del curso. Solo cuentan
 * las abiertas de verdad —fecha límite incluida—, que es lo que RLS y
 * `estaAbierta()` ya deciden.
 *
 * No hay tabla de notificaciones: son las mismas consultas del blog, del
 * calendario y de las dinámicas con una marca de tiempo encima.
 */

export type Notificacion = {
  id: string
  titulo: string
  tipo: 'announcement' | 'blog' | 'sesion' | 'dinamica'
  /** Cuándo pasó lo que se avisa. */
  publicadoEn: string
  /** Una línea más, cuando hace falta: el horario de la sesión, el curso de la dinámica. */
  detalle?: string
  href: string
  nueva: boolean
}

export type Novedades = { lista: Notificacion[]; nuevas: number }

const CUANTAS = 8
/** Una sesión sigue siendo noticia hasta 3 horas después de empezar. */
const HORAS_DE_GRACIA = 3

export async function notificacionesDelAlumno(perfil: Perfil): Promise<Novedades> {
  const [publicaciones, sesiones, dinamicas] = await Promise.all([
    publicacionesParaAlumno(),
    sesionesDelAlumno(),
    dinamicasAbiertasParaCampana(),
  ])
  const desde = new Date(perfil.notifications_seen_at ?? perfil.created_at ?? 0).getTime()
  const ahora = Date.now()

  const dePosts: Notificacion[] = publicaciones.map((p) => ({
    id: p.id,
    titulo: p.titulo,
    tipo: p.tipo,
    publicadoEn: p.publicadoEn,
    href: p.tipo === 'blog' ? '/blog' : '/mis-cursos',
    nueva: new Date(p.publicadoEn).getTime() > desde,
  }))

  const deSesiones: Notificacion[] = sesiones
    .filter((s) => new Date(s.programadaEn).getTime() >= ahora - HORAS_DE_GRACIA * 60 * 60 * 1000)
    .map((s) => ({
      id: `sesion-${s.id}`,
      titulo: s.titulo,
      tipo: 'sesion' as const,
      publicadoEn: s.actualizadaEn,
      detalle: describirHorario(s.programadaEn),
      href: `/curso/${s.cursoSlug}/en-vivo`,
      nueva: new Date(s.actualizadaEn).getTime() > desde,
    }))

  const deDinamicas: Notificacion[] = dinamicas.map((d) => ({
    id: `dinamica-${d.id}`,
    titulo: d.titulo,
    tipo: 'dinamica' as const,
    publicadoEn: d.abiertaEn,
    detalle: d.cursoTitulo,
    href: `/dinamicas/${d.id}`,
    nueva: new Date(d.abiertaEn).getTime() > desde,
  }))

  const todas = [...dePosts, ...deSesiones, ...deDinamicas].sort(
    (a, b) => new Date(b.publicadoEn).getTime() - new Date(a.publicadoEn).getTime()
  )

  // Se cuentan TODAS las nuevas, no solo las ocho de la lista.
  return { lista: todas.slice(0, CUANTAS), nuevas: todas.filter((n) => n.nueva).length }
}
