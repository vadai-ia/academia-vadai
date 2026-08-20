import type { NextRequest } from 'next/server'

import { actualizarSesion } from '@/lib/supabase/middleware'

/**
 * Se aplica en TODAS las rutas (CLAUDE.md). Las excepciones del matcher son
 * solo assets estáticos, que no llevan datos.
 */
export async function middleware(request: NextRequest) {
  return await actualizarSesion(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
}
