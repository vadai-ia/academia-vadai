'use server'

import { faltaFuncion, type LlamadaRpc } from '@/lib/alumno/catalogo'
import { esEquipo, exigirPerfil } from '@/lib/auth/sesion'
import { programaPorClave } from '@/lib/diplomas/programas'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * Marca que la persona abrió o descargó su diploma (academia_0039_diplomas).
 *
 * Se llama desde los botones del diploma y nunca debe estorbar: si falla, la
 * animación y la descarga siguen igual, y solo queda el registro en los logs.
 * El equipo no se cuenta: sus vistas previas inflarían las cifras del panel.
 */
export async function marcarDiploma(clave: string, evento: 'abierto' | 'descargado'): Promise<void> {
  const perfil = await exigirPerfil()
  if (esEquipo(perfil)) return
  if (!programaPorClave(clave) || (evento !== 'abierto' && evento !== 'descargado')) return

  const supabase = await crearClienteServidor()
  const rpc = (supabase.rpc as unknown as LlamadaRpc).bind(supabase)
  const { error } = await rpc('academia_marcar_diploma', { p_clave: clave, p_evento: evento })
  if (error && !faltaFuncion(error)) {
    console.error(JSON.stringify({ operacion: 'marcarDiploma', clave, evento, usuario: perfil.user_id, error: error.message }))
  }
}
