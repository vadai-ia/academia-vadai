import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { conApi, leerCuerpo } from '@/lib/api/contexto'
import { crearEvento, listarEventos } from '@/lib/api/recursos'

/**
 * GET: las clases y eventos del plan desde ayer (o desde `?desde=` ISO).
 * POST: agenda una clase o un evento; `anunciar: true` lo publica en Anuncios.
 * El correo de fechas a los miembros se manda desde el panel, no por la API.
 */

export async function GET(req: NextRequest) {
  return conApi(req, 'eventos:leer', (ctx) => {
    const crudo = req.nextUrl.searchParams.get('desde')
    const desde = crudo && !Number.isNaN(Date.parse(crudo)) ? new Date(crudo) : new Date(Date.now() - 24 * 60 * 60 * 1000)
    return listarEventos(ctx, desde)
  })
}

const liga = z.url().refine((u) => /^https:\/\//i.test(u), 'tiene que ser https')

const esquema = z.object({
  titulo: z.string().trim().min(2).max(200),
  inicio: z.iso.datetime({ offset: true }),
  tipo: z.enum(['clase', 'evento']).default('clase'),
  lugar: z.string().trim().max(200).nullish(),
  liga: liga.nullish(),
  descripcion: z.string().trim().max(2000).nullish(),
  anunciar: z.boolean().default(false),
})

export async function POST(req: NextRequest) {
  return conApi(req, 'eventos:escribir', async (ctx) => crearEvento(ctx, await leerCuerpo(req, esquema)))
}
