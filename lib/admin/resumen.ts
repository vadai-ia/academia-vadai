import 'server-only'

import { crearClienteServidor } from '@/lib/supabase/server'

export type ResumenAdmin = {
  cursosPublicados: number
  cursosBorrador: number
  alumnosActivos: number
  alumnosVencidos: number
  entregasPendientes: number
  certificadosEmitidos: number
  proximaSesion: { titulo: string; empiezaEn: string; cursoSlug: string | null } | null
}

/**
 * Las cifras del panel de administración.
 *
 * Reemplaza a la lista de milestones que estaba ahí desde el scaffold, y que
 * seguía anunciando "M10 Certificados · pendiente" con M10 cerrado hacía días.
 * Un tablero de progreso del proyecto envejece mal por definición; estas cifras
 * salen de la base y no pueden mentir.
 *
 * Se eligieron por una regla: cada una tiene que responder a algo que el admin
 * haría al abrir el panel. `entregasPendientes` manda —es trabajo que le toca a
 * él y que un alumno está esperando— y por eso va destacada y con acceso
 * directo. Un conteo de filas por curiosidad no entra.
 *
 * Todo va por el cliente del usuario: las policies de admin ya le dan acceso
 * completo, así que usar service role aquí sería saltarse RLS sin necesidad.
 */
export async function resumenAdmin(): Promise<ResumenAdmin> {
  const supabase = await crearClienteServidor()

  const ahora = new Date().toISOString()

  const [cursos, inscripciones, entregas, certificados, sesiones] = await Promise.all([
    supabase.from('courses').select('status'),
    supabase.from('enrollments').select('status, expires_at'),
    supabase.from('assignment_submissions').select('id').eq('status', 'submitted'),
    supabase.from('certificates').select('id'),
    supabase
      .from('cohort_sessions')
      .select('title, scheduled_at, cohort_id')
      .gte('scheduled_at', ahora)
      .order('scheduled_at', { ascending: true })
      .limit(1),
  ])

  const filasCurso = cursos.data ?? []
  const filasInscripcion = inscripciones.data ?? []

  const vigente = (fila: { status: string; expires_at: string | null }) =>
    fila.status === 'active' &&
    (!fila.expires_at || new Date(fila.expires_at).getTime() > Date.now())

  const proxima = sesiones.data?.[0]

  return {
    cursosPublicados: filasCurso.filter((c) => c.status === 'published').length,
    cursosBorrador: filasCurso.filter((c) => c.status !== 'published').length,
    alumnosActivos: filasInscripcion.filter(vigente).length,
    alumnosVencidos: filasInscripcion.filter((f) => f.status === 'active' && !vigente(f)).length,
    entregasPendientes: entregas.data?.length ?? 0,
    certificadosEmitidos: certificados.data?.length ?? 0,
    proximaSesion: proxima
      ? { titulo: proxima.title, empiezaEn: proxima.scheduled_at, cursoSlug: null }
      : null,
  }
}
