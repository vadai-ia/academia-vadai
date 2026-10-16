import type { NextRequest } from 'next/server'

import { conApi } from '@/lib/api/contexto'
import { listarHilos } from '@/lib/api/recursos'

/** GET: los hilos del muro del plan. `?estado=sin` (por omisión): solo los que esperan al equipo. */
export async function GET(req: NextRequest) {
  return conApi(req, 'comunidad:leer', (ctx) => listarHilos(ctx, req.nextUrl.searchParams.get('estado') !== 'todos'))
}
