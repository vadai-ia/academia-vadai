import { NextResponse, type NextRequest } from 'next/server'

import { generarIcs } from '@/lib/calendario/enlaces'
import { obtenerSesion } from '@/lib/auth/sesion'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * El archivo .ics de una sesión en vivo, para Apple Calendar y cualquier otro.
 *
 * Route handler porque entrega un archivo, igual que los PDF de certificados.
 * Va con la sesión del alumno y la policy de `cohort_sessions` decide: solo
 * ve las sesiones de su cohorte, así que una id ajena da 404.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await obtenerSesion()
  if (sesion.tipo !== 'activo') return new NextResponse('Inicia sesión.', { status: 401 })

  const { id } = await params
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('cohort_sessions')
    .select('id, title, description, scheduled_at, meet_url, cohorts!inner(courses!inner(title))')
    .eq('id', id)
    .maybeSingle()

  if (!data) return new NextResponse('No encontrada.', { status: 404 })

  type Fila = {
    id: string
    title: string
    description: string | null
    scheduled_at: string
    meet_url: string | null
    cohorts: { courses: { title: string } }
  }
  const s = data as unknown as Fila

  const ics = generarIcs({
    id: s.id,
    titulo: s.title,
    descripcion: s.description,
    inicio: s.scheduled_at,
    ligaUrl: s.meet_url,
    curso: s.cohorts.courses.title,
  })

  const nombre = s.title.replace(/[^\p{L}\p{N} ._-]/gu, '').trim().replace(/\s+/g, '-') || 'sesion'
  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nombre}.ics"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
