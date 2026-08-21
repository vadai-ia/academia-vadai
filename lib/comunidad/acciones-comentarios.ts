'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { esEquipo, exigirPerfil } from '@/lib/auth/sesion'
import { crearClienteServidor } from '@/lib/supabase/server'

export type EstadoComentario = { error?: string; aviso?: string }

/**
 * Comentarios por lección (§3.7).
 *
 * Ninguna acción comprueba a mano quién puede qué: las policies de M1 ya lo
 * hacen. Un alumno solo escribe con acceso vigente, solo edita lo suyo dentro de
 * la ventana de 15 minutos, y solo el admin puede ocultar. Aquí se traduce el
 * resultado a algo legible, no se reimplementa la regla.
 */

const esquema = z.object({
  contenido: z
    .string()
    .trim()
    .min(2, 'Escribe algo antes de publicar.')
    .max(2000, 'El comentario es demasiado largo.'),
})

function ruta(cursoSlug: string, leccionId: string) {
  return `/curso/${cursoSlug}/${leccionId}`
}

export async function publicarComentario(
  _previo: EstadoComentario,
  datos: FormData
): Promise<EstadoComentario> {
  const perfil = await exigirPerfil()

  const leccionId = String(datos.get('lesson_id') ?? '')
  const cursoSlug = String(datos.get('curso_slug') ?? '')
  const padre = String(datos.get('parent_id') ?? '')

  const resultado = esquema.safeParse({ contenido: datos.get('contenido') })
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? 'Revisa tu comentario.' }
  }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('lesson_comments').insert({
    lesson_id: leccionId,
    user_id: perfil.user_id,
    parent_id: padre || null,
    content: resultado.data.contenido,
    status: 'visible',
  })

  if (error) {
    console.error(
      JSON.stringify({ operacion: 'publicarComentario', leccionId, error: error.message })
    )
    // El trigger de M1 impide respuestas a respuestas: un solo nivel (§3.7).
    return {
      error: /un solo nivel/i.test(error.message)
        ? 'Solo se puede responder a un comentario, no a una respuesta.'
        : 'No se pudo publicar tu comentario.',
    }
  }

  revalidatePath(ruta(cursoSlug, leccionId))
  return { aviso: 'Comentario publicado.' }
}

/**
 * Borrado del alumno: lógico, no físico.
 *
 * La policy solo deja pasar de 'visible' a 'deleted' y dentro de la ventana de
 * 15 minutos. Fuera de ella, Postgres no actualiza ninguna fila y la acción lo
 * dice en vez de fingir que funcionó.
 */
export async function eliminarComentario(datos: FormData): Promise<void> {
  const perfil = await exigirPerfil()

  const id = String(datos.get('id') ?? '')
  const leccionId = String(datos.get('lesson_id') ?? '')
  const cursoSlug = String(datos.get('curso_slug') ?? '')
  if (!id) return

  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('lesson_comments')
    .update({ status: 'deleted' })
    .eq('id', id)
    .eq('user_id', perfil.user_id)

  if (error) {
    console.error(
      JSON.stringify({ operacion: 'eliminarComentario', id, error: error.message })
    )
  }

  revalidatePath(ruta(cursoSlug, leccionId))
}

/**
 * Moderación (§3.7): el admin oculta cualquier comentario.
 *
 * Es un `status = 'hidden'`, no un DELETE: la moderación tiene que ser
 * reversible, y borrar de verdad rompería los hilos que cuelgan de él.
 * §6.4 pide que esto sea de dos clics desde el propio hilo, y por eso el botón
 * vive junto al comentario, no en una pantalla aparte.
 */
export async function moderarComentario(datos: FormData): Promise<void> {
  const perfil = await exigirPerfil()
  if (!esEquipo(perfil)) return

  const id = String(datos.get('id') ?? '')
  const leccionId = String(datos.get('lesson_id') ?? '')
  const cursoSlug = String(datos.get('curso_slug') ?? '')
  const ocultar = String(datos.get('ocultar') ?? '') === 'si'
  if (!id) return

  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('lesson_comments')
    .update({ status: ocultar ? 'hidden' : 'visible' })
    .eq('id', id)

  if (error) {
    console.error(JSON.stringify({ operacion: 'moderarComentario', id, error: error.message }))
  }

  revalidatePath(ruta(cursoSlug, leccionId))
}
