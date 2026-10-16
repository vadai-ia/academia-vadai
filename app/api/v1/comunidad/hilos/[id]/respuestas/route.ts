import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { ErrorApi, conApi, leerCuerpo } from '@/lib/api/contexto'
import { responderHilo } from '@/lib/api/recursos'

/** POST: responde un hilo del muro como «Equipo VADAI» (M20). */
const esquema = z.object({ texto: z.string().trim().min(2).max(5000) })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return conApi(req, 'comunidad:escribir', async (ctx) => {
    if (!z.uuid().safeParse(id).success) throw new ErrorApi(404, 'No existe ese hilo.')
    const { texto } = await leerCuerpo(req, esquema)
    return responderHilo(ctx, id, texto)
  })
}
