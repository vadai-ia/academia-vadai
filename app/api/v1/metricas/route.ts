import type { NextRequest } from 'next/server'

import { conApi } from '@/lib/api/contexto'
import { metricas } from '@/lib/api/recursos'

/** GET: cómo va la comunidad del plan hoy. Lo cobrado del mes, solo con `cobros:leer`. */
export async function GET(req: NextRequest) {
  return conApi(req, 'metricas:leer', (ctx) => metricas(ctx))
}
