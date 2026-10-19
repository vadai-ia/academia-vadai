import { NextResponse, type NextRequest } from 'next/server'

import { prepararNoticias } from '@/lib/agente/noticias'
import { armarResumenDelDia } from '@/lib/agente/resumen'
import { cronAutorizado } from '@/lib/api/cron'

/**
 * Lo diario del agente (M21), a las 7:00 de la Ciudad de México (13:00 UTC,
 * vercel.json): el resumen de ayer y las noticias en borrador. Exige
 * CRON_SECRET. `?solo=resumen` o `?solo=noticias` corre una de las dos.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  const solo = req.nextUrl.searchParams.get('solo')
  const resumen = solo === 'noticias' ? null : await armarResumenDelDia()
  const noticias = solo === 'resumen' ? null : await prepararNoticias()
  const resultado = { resumen, noticias }
  console.log(JSON.stringify({ operacion: 'cron:agente-diario', ...resultado }))
  return NextResponse.json(resultado, { headers: { 'Cache-Control': 'no-store' } })
}
