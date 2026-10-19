import { NextResponse, type NextRequest } from 'next/server'

import { cronAutorizado } from '@/lib/api/cron'
import { entregarPendientes } from '@/lib/api/webhooks'
import { crearClienteServiceRole } from '@/lib/supabase/service-role'

/**
 * Tarea programada (Vercel Cron, cada 5 minutos; vercel.json). Reintenta los
 * webhooks que no se entregaron y borra la bitácora de la API con más de 30
 * días y la cuota de más de 2.
 *
 * Vercel manda `Authorization: Bearer <CRON_SECRET>`. Sin CRON_SECRET en el
 * servidor la ruta no hace nada: nunca queda abierta por olvido.
 */
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const resultado = await entregarPendientes()
  const db = crearClienteServiceRole()
  const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const hace2 = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  await Promise.all([
    db.from('api_bitacora').delete().lt('created_at', hace30),
    db.from('api_uso').delete().lt('hora', hace2),
  ])
  console.log(JSON.stringify({ operacion: 'cron:webhooks', ...resultado }))
  return NextResponse.json(resultado, { headers: { 'Cache-Control': 'no-store' } })
}
