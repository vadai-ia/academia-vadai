import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { RUTAS, esDeAdmin, esDeAutenticacion, esPublica, rutaDeInicio } from '@/lib/auth/rutas'

import { ESQUEMA, llaveAnonima, urlSupabase } from './env'
import type { Database } from './types'

/**
 * Refresca la sesión y aplica el control de acceso en TODAS las rutas.
 *
 * Dos responsabilidades que van juntas por fuerza:
 *
 *   1. Refrescar el token. Los server components no pueden escribir cookies, así
 *      que si el middleware no renueva aquí, la sesión se cae sola.
 *   2. Decidir si esta petición puede seguir.
 *
 * El middleware es la primera línea, no la única: RLS sigue siendo la que de
 * verdad protege los datos. Si alguien saltara este control, no vería nada.
 */
export async function actualizarSesion(request: NextRequest) {
  let respuesta = NextResponse.next({ request })

  const supabase = createServerClient<Database, typeof ESQUEMA>(
    urlSupabase(),
    llaveAnonima(),
    {
      db: { schema: ESQUEMA },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesNuevas) {
          for (const { name, value } of cookiesNuevas) {
            request.cookies.set(name, value)
          }
          respuesta = NextResponse.next({ request })
          for (const { name, value, options } of cookiesNuevas) {
            respuesta.cookies.set(name, value, options)
          }
        },
      },
    }
  )

  // getUser() valida contra el servidor de Auth. getSession() solo lee la
  // cookie, así que una cookie manipulada pasaría: no se usa aquí.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const ruta = request.nextUrl.pathname

  const irA = (destino: string) => {
    const url = request.nextUrl.clone()
    url.pathname = destino
    url.search = ''
    return NextResponse.redirect(url)
  }

  // --- sin sesión ---------------------------------------------------------
  if (!user) {
    if (esPublica(ruta)) return respuesta

    // Se recuerda a dónde iba, para devolverlo ahí después del login.
    const url = request.nextUrl.clone()
    url.pathname = RUTAS.login
    url.search = ruta === RUTAS.misCursos ? '' : `?destino=${encodeURIComponent(ruta)}`
    return NextResponse.redirect(url)
  }

  // --- con sesión: ¿pertenece a la academia? ------------------------------
  const { data: perfil } = await supabase
    .from('profiles')
    .select('role, status')
    .eq('user_id', user.id)
    .maybeSingle()

  const pertenece = Boolean(perfil) && perfil?.status === 'active'

  if (!pertenece) {
    // Autenticado pero sin perfil (o suspendido): solo puede ver la pantalla
    // de sin-acceso y los callbacks de auth, para poder cerrar sesión.
    if (ruta === RUTAS.sinAcceso || ruta.startsWith('/auth/')) return respuesta
    return irA(RUTAS.sinAcceso)
  }

  const inicio = rutaDeInicio(perfil?.role)

  // Ya entró: no tiene sentido devolverlo al login.
  if (esDeAutenticacion(ruta) || ruta === RUTAS.sinAcceso) return irA(inicio)

  // Un alumno que husmea /admin vuelve a lo suyo. Aunque entrara, RLS no le
  // daría un solo dato: esto es para que la UI no se rompa, no la protección.
  if (esDeAdmin(ruta) && perfil?.role !== 'admin' && perfil?.role !== 'superadmin') {
    return irA(RUTAS.misCursos)
  }

  return respuesta
}
