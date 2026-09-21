import { NextResponse, type NextRequest } from 'next/server'

import { generarIcsVarios } from '@/lib/calendario/enlaces'
import { firmaValida } from '@/lib/calendario/firma'
import { obtenerSesion } from '@/lib/auth/sesion'
import { crearClienteServidor } from '@/lib/supabase/server'
import { crearClienteServiceRole } from '@/lib/supabase/service-role'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Un solo .ics con TODAS las sesiones futuras de una cohorte: "agregar las
 * ocho a mi calendario" de un clic.
 *
 * Dos formas de abrirlo:
 *   - Con sesión (desde la plataforma): la policy de `cohort_sessions` hace el
 *     trabajo; una cohorte ajena devuelve vacío, y vacío es 404.
 *   - Con la firma `?t=` (desde el correo de fechas, lib/calendario/firma.ts):
 *     quien lee el correo en el teléfono no tiene sesión en ese navegador. Sin
 *     firma válida y sin sesión, 401.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) return new NextResponse('Sin sesiones.', { status: 404 })

  const firmado = firmaValida(id, req.nextUrl.searchParams.get('t'))
  if (!firmado) {
    const sesion = await obtenerSesion()
    if (sesion.tipo !== 'activo') return new NextResponse('Inicia sesión.', { status: 401 })
  }

  const supabase = firmado ? crearClienteServiceRole() : await crearClienteServidor()
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
