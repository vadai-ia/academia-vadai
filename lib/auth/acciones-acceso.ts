'use server'

import { redirect } from 'next/navigation'

import { marcarUsoDeEnlace, resolverEnlaceDurable } from '@/lib/auth/enlace-durable'
import { registrarInicioDeSesion } from '@/lib/auth/inicio-de-sesion'
import { RUTAS } from '@/lib/auth/rutas'
import { generarEnlaceDeAcceso } from '@/lib/stripe/provisioning'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * El botón de /acceso/[token].
 *
 * Es un POST a propósito. La página (GET) solo dice "hola, da clic"; lo que
 * pide a Supabase un token de recovery fresco y lo canjea es esto. Así un
 * escáner de correo que abra la liga no gasta nada, y la persona que da clic
 * dos veces entra dos veces.
 *
 * CORREGIDO 21-sep-2026, día del lanzamiento. La primera versión hacía
 * `redirect('/auth/confirmar?token_hash=…')` y dejaba que ese route handler
 * canjeara el token. Sin JavaScript funcionaba (un 303 y el navegador sigue);
 * CON JavaScript, que es como llega todo el mundo, el cliente de Next sigue el
 * redirect de una server action pidiendo la ruta como página RSC, y un route
 * handler no responde eso: "An unexpected response was received from the
 * server", y la persona no podía crear su contraseña. Tres reportes en la
 * primera hora, en Windows y en iPhone.
 *
 * Ahora la acción canjea el token AQUÍ MISMO —`verifyOtp` escribe las cookies
 * de sesión; una server action puede— y redirige a una página de verdad.
 */
export async function entrarConEnlace(datos: FormData): Promise<void> {
  const token = String(datos.get('token') ?? '')

  const enlace = await resolverEnlaceDurable(token)
  if (!enlace.ok) redirect(`${RUTAS.login}?error=enlace`)

  const absoluta = await generarEnlaceDeAcceso(enlace.email, RUTAS.nuevaContrasena)
  if (!absoluta) {
    console.error(JSON.stringify({ operacion: 'entrarConEnlace:sinRecovery', email: enlace.email }))
    redirect(`${RUTAS.login}?error=enlace`)
  }

  const tokenHash = new URL(absoluta).searchParams.get('token_hash') ?? ''
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
  if (error) {
    console.error(JSON.stringify({ operacion: 'entrarConEnlace:verifyOtp', email: enlace.email, error: error.message }))
    redirect(`${RUTAS.login}?error=enlace`)
  }

  // Nace una sesión: se sella el último acceso en el perfil (M14).
  await registrarInicioDeSesion(supabase, data.user?.id)
  await marcarUsoDeEnlace(token)
  redirect(RUTAS.nuevaContrasena)
}
