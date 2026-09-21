'use server'

import { revalidatePath } from 'next/cache'

import { exigirPerfil } from '@/lib/auth/sesion'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * "Ya vi la campana". Sella la hora; todo lo publicado después vuelve a
 * contar como nuevo.
 *
 * La llaman dos cosas: el botón "Marcar como vistas" del panel (un <form>, así
 * que funciona sin JavaScript) y, con JavaScript, el simple hecho de abrir la
 * campana. Va por el cliente del usuario: la policy `profiles_update_propio`
 * deja tocar la propia fila y el trigger solo protege rol, estado e identidad.
 */
export async function marcarNotificacionesVistas(): Promise<void> {
  const perfil = await exigirPerfil()
  const supabase = await crearClienteServidor()

  const { error } = await supabase
    .from('profiles')
    .update({ notifications_seen_at: new Date().toISOString() })
    .eq('user_id', perfil.user_id)

  if (error) {
    console.error(
      JSON.stringify({ operacion: 'marcarNotificacionesVistas', userId: perfil.user_id, error: error.message })
    )
  }

  revalidatePath('/', 'layout')
}
