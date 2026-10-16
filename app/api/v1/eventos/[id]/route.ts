import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { ErrorApi, conApi } from '@/lib/api/contexto'
import { cancelarEvento } from '@/lib/api/recursos'

/** DELETE: cancela una clase o un evento del plan (M20). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return conApi(req, 'eventos:escribir', (ctx) => {
    if (!z.uuid().safeParse(id).success) throw new ErrorApi(404, 'No existe esa sesión.')
    return cancelarEvento(ctx, id)
  })
}
