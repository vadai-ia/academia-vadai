import { NextResponse, type NextRequest } from 'next/server'

import { generarIcsVarios } from '@/lib/calendario/enlaces'
import { obtenerSesion } from '@/lib/auth/sesion'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * Un solo .ics con TODAS las sesiones futuras de una cohorte: "agregar las
 * ocho a mi calendario" de un clic, desde el correo de fechas o desde la
 * plataforma. Con la sesión del alumno y la policy de `cohort_sessions`:
 * una cohorte ajena devuelve vacío, y vacío es 404.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await obtenerSesion()
  if (sesion.tipo !== 'activo') return new NextResponse('Inicia sesión.', { status: 401 })

  const { id } = await params
  const supabase = await crearClienteServidor()
  const [{ data: sesiones }, { data: cohorte }] = await Promise.all([
    supabase
      .from('cohort_sessions')
      .select('id, title, description, scheduled_at, meet_url')
      .eq('cohort_id', id)
      .gte('scheduled_at', new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString())
      .order('scheduled_at'),
    supabase.from('cohorts').select('name, courses!inner(title)').eq('id', id).maybeSingle(),
  ])

  if (!sesiones || sesiones.length === 0) return new NextResponse('Sin sesiones.', { status: 404 })

  const curso = (cohorte as unknown as { courses?: { title?: string } } | null)?.courses?.title ?? 'VADAI Academia'

  const ics = generarIcsVarios(
    sesiones.map((s) => ({
      id: s.id,
      titulo: s.title,
      descripcion: s.description,
      inicio: s.scheduled_at,
      ligaUrl: s.meet_url,
      curso,
    }))
  )

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="sesiones-en-vivo.ics"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
