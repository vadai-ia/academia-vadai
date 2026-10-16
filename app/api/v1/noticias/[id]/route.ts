import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { ErrorApi, conApi, leerCuerpo } from '@/lib/api/contexto'
import { editarNoticia, retirarNoticia } from '@/lib/api/recursos'

/** PATCH: edita una noticia. DELETE: la retira del muro (M20). */

const uuid = z.uuid()
const esquema = z.object({
  titulo: z.string().trim().min(3).max(200).optional(),
  cuerpo: z.string().trim().min(1).max(10000).optional(),
  fuente: z.url().refine((u) => /^https?:\/\//i.test(u), 'tiene que ser http(s)').nullish(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return conApi(req, 'noticias:escribir', async (ctx) => {
    if (!uuid.safeParse(id).success) throw new ErrorApi(404, 'No existe esa noticia.')
    return editarNoticia(ctx, id, await leerCuerpo(req, esquema))
  })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return conApi(req, 'noticias:escribir', async (ctx) => {
    if (!uuid.safeParse(id).success) throw new ErrorApi(404, 'No existe esa noticia.')
    return retirarNoticia(ctx, id)
  })
}
