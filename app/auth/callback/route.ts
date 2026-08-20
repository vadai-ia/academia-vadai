import { NextResponse, type NextRequest } from 'next/server'

import { RUTAS, rutaDeInicio } from '@/lib/auth/rutas'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * Regreso de Google OAuth.
 *
 * Supabase manda aquí con un `code` de un solo uso que se canjea por sesión.
 * Después se decide el destino según el rol: si el correo de Google no
 * corresponde a nadie de la academia, cae en la pantalla de sin-acceso.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const codigo = searchParams.get('code')
  const descripcion = searchParams.get('error_description')

  if (descripcion) {
    console.error(JSON.stringify({ operacion: 'callbackGoogle', error: descripcion }))
    return NextResponse.redirect(`${origin}${RUTAS.login}?error=google`)
  }

  if (!codigo) {
    return NextResponse.redirect(`${origin}${RUTAS.login}?error=google`)
  }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.auth.exchangeCodeForSession(codigo)

  if (error) {
    console.error(JSON.stringify({ operacion: 'callbackGoogle', error: error.message }))
    return NextResponse.redirect(`${origin}${RUTAS.login}?error=google`)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.redirect(`${origin}${RUTAS.login}?error=google`)

  const { data: perfil } = await supabase
    .from('profiles')
    .select('role, status')
    .eq('user_id', user.id)
    .maybeSingle()

  const destino =
    perfil && perfil.status === 'active' ? rutaDeInicio(perfil.role) : RUTAS.sinAcceso

  return NextResponse.redirect(`${origin}${destino}`)
}
