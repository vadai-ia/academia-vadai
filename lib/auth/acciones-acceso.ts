'use server'

import { redirect } from 'next/navigation'

import { marcarUsoDeEnlace, resolverEnlaceDurable } from '@/lib/auth/enlace-durable'
import { RUTAS } from '@/lib/auth/rutas'
import { generarEnlaceDeAcceso } from '@/lib/stripe/provisioning'

/**
 * El botón de /acceso/[token].
 *
 * Es un POST a propósito. La página (GET) solo dice "hola, da clic"; lo que
 * pide a Supabase un token de recovery fresco y lo canjea es esto. Así un
 * escáner de correo que abra la liga no gasta nada, y la persona que da clic
 * dos veces entra dos veces.
 *
 * Se redirige a /auth/confirmar por RUTA RELATIVA, no por la URL absoluta que
 * arma `generarEnlaceDeAcceso`: esa lleva NEXT_PUBLIC_APP_URL, y en pruebas
 * eso mandaría al servidor local a producción.
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

  await marcarUsoDeEnlace(token)

  const url = new URL(absoluta)
  redirect(`${url.pathname}${url.search}`)
}
