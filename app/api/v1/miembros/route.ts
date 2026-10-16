import type { NextRequest } from 'next/server'

import { conApi } from '@/lib/api/contexto'
import { listarMiembros } from '@/lib/api/recursos'

/**
 * GET: los miembros del plan con su acceso, último acceso y puntos.
 *   ?estado=vigentes|vencidos|todos (todos por omisión)
 *   ?inactivos_dias=7  solo quien no entra hace 7 días o más (o nunca)
 * El correo, solo con `miembros:pii`; la suscripción, solo con `cobros:leer`.
 */
export async function GET(req: NextRequest) {
  return conApi(req, 'miembros:leer', (ctx) => {
    const p = req.nextUrl.searchParams
    const estado = p.get('estado')
    const dias = Number(p.get('inactivos_dias'))
    return listarMiembros(ctx, {
      estado: estado === 'vigentes' || estado === 'vencidos' ? estado : 'todos',
      inactivosDias: p.has('inactivos_dias') && Number.isFinite(dias) && dias >= 0 ? dias : null,
    })
  })
}
