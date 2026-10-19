import { NextResponse, type NextRequest } from 'next/server'

import { correrAgente } from '@/lib/agente/procesar'
import { cronAutorizado } from '@/lib/api/cron'

/**
 * El agente de la comunidad (M21), cada 5 minutos (vercel.json): encola lo
 * nuevo y contesta lo que ya toca. Exige CRON_SECRET.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  const resultado = await correrAgente()
  console.log(JSON.stringify({ operacion: 'cron:agente', ...resultado }))
  return NextResponse.json(resultado, { headers: { 'Cache-Control': 'no-store' } })
}
