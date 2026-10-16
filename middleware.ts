import { NextResponse, type NextRequest } from 'next/server'

import { actualizarSesion } from '@/lib/supabase/middleware'

/**
 * Se aplica en TODAS las rutas (CLAUDE.md). Las excepciones del matcher son
 * solo assets estáticos, que no llevan datos.
 *
 * La API pública (/api/v1, M20) y las tareas programadas (/api/cron) no usan
 * sesión: se autentican con su llave o con CRON_SECRET en cada ruta. Se dejan
 * pasar sin leer ni refrescar cookies.
 */
export async function middleware(request: NextRequest) {
  const ruta = request.nextUrl.pathname
  if (ruta.startsWith('/api/v1/') || ruta.startsWith('/api/cron/')) return NextResponse.next()
  return await actualizarSesion(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
}
