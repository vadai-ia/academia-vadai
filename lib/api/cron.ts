import 'server-only'

import { timingSafeEqual } from 'node:crypto'

import type { NextRequest } from 'next/server'

/**
 * Las tareas programadas (Vercel Cron) mandan `Authorization: Bearer
 * <CRON_SECRET>`. Sin CRON_SECRET en el servidor ninguna ruta de cron hace
 * nada: nunca queda abierta por olvido.
 */
export function cronAutorizado(req: NextRequest): boolean {
  const secreto = process.env.CRON_SECRET ?? ''
  if (secreto.length < 16) return false
  const recibido = Buffer.from(req.headers.get('authorization') ?? '')
  const esperado = Buffer.from(`Bearer ${secreto}`)
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado)
}
