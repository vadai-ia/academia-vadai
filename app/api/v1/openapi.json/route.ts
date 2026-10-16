import { NextResponse } from 'next/server'

import { especificacion } from '@/lib/api/openapi'

/** La especificación de la API (M20). Pública: describe, no trae datos. */
export function GET() {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '')
  return NextResponse.json(especificacion(base), { headers: { 'Cache-Control': 'public, max-age=300' } })
}
