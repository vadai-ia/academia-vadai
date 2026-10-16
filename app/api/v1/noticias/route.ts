import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { conApi, leerCuerpo } from '@/lib/api/contexto'
import { crearNoticia, listarNoticias } from '@/lib/api/recursos'

/** GET: las noticias del plan, la más nueva primero. POST: publica una (M20). */

export async function GET(req: NextRequest) {
  return conApi(req, 'noticias:leer', (ctx) => {
    const limite = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get('limite') ?? 20) || 20))
    return listarNoticias(ctx, limite)
  })
}

const esquema = z.object({
  titulo: z.string().trim().min(3).max(200),
  cuerpo: z.string().trim().min(1).max(10000),
  fuente: z.url().refine((u) => /^https?:\/\//i.test(u), 'tiene que ser http(s)').nullish(),
})

export async function POST(req: NextRequest) {
  return conApi(req, 'noticias:escribir', async (ctx) => crearNoticia(ctx, await leerCuerpo(req, esquema)))
}
