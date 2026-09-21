'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { exigirAdmin } from '@/lib/auth/sesion'
import { crearClienteServidor } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/types'

import type { EstadoAccion } from './tipos'

/**
 * Blog y anuncios (§3.9).
 *
 * Los crea solo el admin. La diferencia entre los dos tipos no es de formato
 * sino de dónde aparecen:
 *   announcement → destacado en el panel del alumno
 *   blog         → en /blog
 *
 * `published_at` gobierna la visibilidad: null es borrador, y una fecha futura
 * queda programada, porque la policy del alumno exige `published_at <= now()`.
 */

const esquema = z.object({
  title: z.string().trim().min(3, 'El título necesita al menos 3 caracteres.').max(200),
  post_type: z.enum(['announcement', 'blog']),
  cover_url: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  audience_course_id: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  content_rich: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === '') return null
      try {
        return JSON.parse(v) as Json
      } catch {
        ctx.addIssue({ code: 'custom', message: 'El contenido no es válido.' })
        return null
      }
    })
    .nullable(),
})

function registrarFallo(operacion: string, detalle: Record<string, unknown>, error: string) {
  console.error(JSON.stringify({ operacion, ...detalle, error }))
}

function refrescar() {
  revalidatePath('/admin/publicaciones')
  revalidatePath('/blog')
  revalidatePath('/mis-cursos')
}

export async function crearPublicacion(
  _previo: EstadoAccion,
  datos: FormData
): Promise<EstadoAccion> {
  const perfil = await exigirAdmin()

  const resultado = esquema.safeParse({
    title: datos.get('title'),
    post_type: datos.get('post_type'),
    cover_url: datos.get('cover_url') ?? '',
    audience_course_id: datos.get('audience_course_id') ?? '',
    content_rich: datos.get('content_rich') ?? '',
  })

  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? 'Revisa los datos.' }
  }

  const publicarYa = String(datos.get('publicar') ?? '') === 'si'

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('posts').insert({
    ...resultado.data,
    author_id: perfil.user_id,
    published_at: publicarYa ? new Date().toISOString() : null,
  })

  if (error) {
    registrarFallo('crearPublicacion', {}, error.message)
    return { error: 'No se pudo crear la publicación.' }
  }

  refrescar()
  return {
    aviso: publicarYa ? 'Publicado.' : 'Guardado como borrador.',
  }
}

/** Publica un borrador o lo regresa a borrador. */
export async function alternarPublicacion(datos: FormData): Promise<void> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  const publicar = String(datos.get('publicar') ?? '') === 'si'
  if (!id) return

  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('posts')
    .update({ published_at: publicar ? new Date().toISOString() : null })
    .eq('id', id)

  if (error) registrarFallo('alternarPublicacion', { id }, error.message)
  refrescar()
}

/** Con confirmación en modal (M14). */
export async function eliminarPublicacion(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  if (!id) return { error: 'Falta la publicación.' }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('posts').delete().eq('id', id)

  if (error) {
    registrarFallo('eliminarPublicacion', { id }, error.message)
    return { error: 'No se pudo eliminar la publicación. Inténtalo otra vez.' }
  }

  refrescar()
  return { aviso: 'Publicación eliminada.' }
}
