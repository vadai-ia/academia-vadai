import 'server-only'

import type { crearClienteServidor } from '@/lib/supabase/server'

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>

/**
 * Sella el último inicio de sesión en el perfil.
 *
 * `academia.profiles.last_sign_in_at` es un espejo de lo que Auth guarda en
 * `auth.users`, que PostgREST no expone y que la Regla Cero prohíbe replicar
 * con un trigger. Se escribe aquí, desde la app, en los cuatro lugares donde
 * nace una sesión: contraseña, liga de 30 días, enlace de correo y Google.
 *
 * Va con el cliente de la sesión recién abierta: la policy `profiles_update_propio`
 * deja que cada quien escriba su propia fila, y el trigger de protección no
 * cubre esta columna a propósito. Que un alumno pudiera sellar su propio
 * "último acceso" es inocuo.
 *
 * Falla en silencio: entrar NUNCA depende de esto. Un usuario sin perfil
 * (autenticado pero fuera de la academia) actualiza cero filas, y está bien.
 */
export async function registrarInicioDeSesion(
  supabase: Cliente,
  userId: string | null | undefined
): Promise<void> {
  if (!userId) return

  const { error } = await supabase
    .from('profiles')
    .update({ last_sign_in_at: new Date().toISOString() })
    .eq('user_id', userId)

  if (error) {
    console.error(JSON.stringify({ operacion: 'registrarInicioDeSesion', userId, error: error.message }))
  }
}
