import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

import { registrarInicioDeSesion } from '@/lib/auth/inicio-de-sesion'
import { RUTAS, rutaDeInicio } from '@/lib/auth/rutas'
import { crearClienteServidor } from '@/lib/supabase/server'

const TIPOS_VALIDOS: EmailOtpType[] = ['invite', 'recovery', 'email', 'signup', 'email_change']

/**
 * Aterrizaje de los enlaces que manda Supabase por correo: invitación de alta
 * manual (§3.1-A) y recuperación de contraseña.
 *
 * El enlace trae un token de un solo uso que se canjea por sesión. De ahí:
 *   - invitación  -> a definir contraseña (aún no tiene)
 *   - recuperación -> a cambiar contraseña
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl

  const tokenHash = searchParams.get('token_hash')
  const tipo = searchParams.get('type') as EmailOtpType | null
  const proximo = searchParams.get('proximo')

  if (!tokenHash || !tipo || !TIPOS_VALIDOS.includes(tipo)) {
    return NextResponse.redirect(`${origin}${RUTAS.login}?error=enlace`)
  }

  const supabase = await crearClienteServidor()
  const { data, error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash })

  if (error) {
    console.error(JSON.stringify({ operacion: 'confirmarEnlace', tipo, error: error.message }))
    return NextResponse.redirect(`${origin}${RUTAS.login}?error=enlace`)
  }

  // Nace una sesión: se sella el último acceso en el perfil (M14).
  await registrarInicioDeSesion(supabase, data.user?.id)

  // Invitación y recuperación terminan igual: el usuario define su contraseña.
  if (tipo === 'invite' || tipo === 'recovery') {
    const destino = proximo?.startsWith('/') ? proximo : RUTAS.nuevaContrasena
    return NextResponse.redirect(`${origin}${destino}`)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.redirect(`${origin}${RUTAS.login}?error=enlace`)

  const { data: perfil } = await supabase
    .from('profiles')
    .select('role, status')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.redirect(
    `${origin}${perfil && perfil.status === 'active' ? rutaDeInicio(perfil.role) : RUTAS.sinAcceso}`
  )
}
