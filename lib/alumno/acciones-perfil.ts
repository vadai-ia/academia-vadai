'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { exigirPerfil } from '@/lib/auth/sesion'
import { crearClienteServidor } from '@/lib/supabase/server'

export type EstadoPerfil = { error?: string; aviso?: string }

/**
 * El alumno edita su nombre.
 *
 * Existe por el certificado: es el nombre que se imprime y el que aparece en la
 * página pública de verificación, así que tiene que poder corregirlo él —viene
 * de Stripe o de un alta manual, y ahí se escriben mal los apellidos todo el
 * tiempo.
 *
 * Solo el nombre. `role`, `status` y `email` los bloquea el trigger
 * `proteger_campos_de_perfil` (migración `academia_0016`), no esta función: si
 * alguien llamara a PostgREST directamente, la base seguiría diciendo que no.
 */
const esquema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, 'Escribe tu nombre completo.')
    .max(120, 'El nombre es demasiado largo.'),
})

export async function actualizarNombre(
  _previo: EstadoPerfil,
  datos: FormData
): Promise<EstadoPerfil> {
  const perfil = await exigirPerfil()

  const resultado = esquema.safeParse({ full_name: datos.get('full_name') })
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? 'Revisa tu nombre.' }
  }

  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: resultado.data.full_name })
    .eq('user_id', perfil.user_id)

  if (error) {
    console.error(JSON.stringify({ operacion: 'actualizarNombre', error: error.message }))
    return { error: 'No se pudo guardar tu nombre.' }
  }

  revalidatePath('/perfil')
  revalidatePath('/mis-cursos')

  return { aviso: 'Nombre actualizado.' }
}
