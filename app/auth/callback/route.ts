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
/**
 * Traduce lo que manda Supabase a un motivo que la pantalla sepa explicar.
 *
 * La distinción que importa: "el correo no tiene cuenta" NO es lo mismo que
 * "algo falló". El primero es el sistema funcionando —el sign-up público está
 * deshabilitado a propósito (§2), así que entrar con Google solo sirve si la
 * cuenta ya existe— y decirle a esa persona "intenta de nuevo" la manda a
 * repetir algo que no va a funcionar nunca.
 */
function motivo(searchParams: URLSearchParams): 'sinCuenta' | 'cancelado' | 'google' {
  const codigo = searchParams.get('error_code') ?? ''
  const descripcion = searchParams.get('error_description') ?? ''
  const error = searchParams.get('error') ?? ''

  if (codigo === 'signup_disabled' || /signup|not allowed/i.test(descripcion)) {
    return 'sinCuenta'
  }
  if (error === 'access_denied' && /denied|cancel/i.test(descripcion)) return 'cancelado'
  return 'google'
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const codigo = searchParams.get('code')
  const descripcion = searchParams.get('error_description')

  if (descripcion || searchParams.get('error')) {
    const cual = motivo(searchParams)
    console.error(
      JSON.stringify({ operacion: 'callbackGoogle', motivo: cual, error: descripcion })
    )
    return NextResponse.redirect(`${origin}${RUTAS.login}?error=${cual}`)
  }

  if (!codigo) {
    return NextResponse.redirect(`${origin}${RUTAS.login}?error=google`)
  }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.auth.exchangeCodeForSession(codigo)

  if (error) {
    console.error(JSON.stringify({ operacion: 'callbackGoogle', error: error.message }))
    const cual = /signup|not allowed/i.test(error.message) ? 'sinCuenta' : 'google'
    return NextResponse.redirect(`${origin}${RUTAS.login}?error=${cual}`)
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
