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

const LIMITE_FOTO = 3 * 1024 * 1024

/**
 * Foto y bio (M17): lo que ven los demás miembros de V-AI-P en el perfil y lo
 * que sale junto al nombre en el muro.
 *
 * La foto se sube con la sesión de la persona a `academia-media/avatares/<su
 * id>/`: las políticas de storage de 0015 solo la dejan escribir en su propia
 * carpeta. El bucket es público, como las imágenes del muro.
 */
const esquemaBio = z.object({
  bio: z.string().trim().max(160, 'La bio es de una línea: hasta 160 caracteres.'),
})

export async function actualizarFotoYBio(
  _previo: EstadoPerfil,
  datos: FormData
): Promise<EstadoPerfil> {
  const perfil = await exigirPerfil()
  const resultado = esquemaBio.safeParse({ bio: datos.get('bio') ?? '' })
  if (!resultado.success) return { error: resultado.error.issues[0]?.message ?? 'Revisa tu bio.' }

  const supabase = await crearClienteServidor()
  const cambios: { bio: string | null; avatar_url?: string | null } = { bio: resultado.data.bio || null }

  const foto = datos.get('foto')
  if (datos.get('quitar_foto') === 'si') {
    cambios.avatar_url = null
  } else if (foto instanceof File && foto.size > 0) {
    if (!foto.type.startsWith('image/')) return { error: 'La foto tiene que ser una imagen.' }
    if (foto.size > LIMITE_FOTO) return { error: 'La foto pesa más de 3 MB. Usa una más ligera.' }
    const extension = (foto.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg'
    const ruta = `avatares/${perfil.user_id}/${Date.now()}.${extension}`
    const { error: errorSubida } = await supabase.storage
      .from('academia-media')
      .upload(ruta, foto, { contentType: foto.type, upsert: false })
    if (errorSubida) {
      console.error(JSON.stringify({ operacion: 'actualizarFotoYBio:subida', ruta, error: errorSubida.message }))
      return { error: 'No se pudo subir la foto.' }
    }
    cambios.avatar_url = supabase.storage.from('academia-media').getPublicUrl(ruta).data.publicUrl
  }

  const { error } = await supabase.from('profiles').update(cambios).eq('user_id', perfil.user_id)
  if (error) {
    console.error(JSON.stringify({ operacion: 'actualizarFotoYBio', error: error.message }))
    return { error: 'No se pudo guardar.' }
  }

  revalidatePath('/perfil')
  revalidatePath('/vaip')
  return { aviso: 'Listo: así te ven los demás miembros.' }
}
