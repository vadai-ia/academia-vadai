'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { esEquipo, exigirPerfil } from '@/lib/auth/sesion'
import { crearClienteServidor } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/types'

export type EstadoPost = { error?: string; aviso?: string }

/**
 * Comunidad por curso (§3.8).
 *
 * Quién puede publicar lo decide RLS: la policy de `community_posts` exige
 * acceso vigente al curso y, en el INSERT del alumno, `pinned = false`. Fijar es
 * prerrogativa del admin y esa regla vive en la base, no aquí.
 */

const BUCKET = 'academia-media'
const LIMITE_IMAGENES = 4

const esquemaPost = z.object({
  titulo: z
    .string()
    .trim()
    .min(3, 'El título necesita al menos 3 caracteres.')
    .max(160, 'El título es demasiado largo.'),
  cuerpo: z.string().trim().max(5000, 'El mensaje es demasiado largo.'),
})

/**
 * Convierte el texto plano del alumno en el mismo documento que produce Tiptap.
 *
 * El alumno escribe en un textarea, no en un editor rico: está en el celular y
 * quiere soltar una duda, no maquetar. Pero `content_rich` guarda el formato de
 * Tiptap, y `RenderRico` sabe pintarlo — así que se traduce aquí en vez de tener
 * dos formatos de contenido conviviendo en la misma columna.
 *
 * Como el texto entra como texto y sale por nodos conocidos, tampoco hay forma
 * de inyectar markup.
 */
function comoDocumento(texto: string): Json | null {
  if (texto === '') return null

  // Los <textarea> mandan CRLF, no LF: partir sin normalizar antes colapsa
  // todos los párrafos en uno solo.
  const parrafos = texto
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  if (parrafos.length === 0) return null

  return {
    type: 'doc',
    content: parrafos.map((p) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: p }],
    })),
  } as Json
}

function registrar(operacion: string, detalle: Record<string, unknown>) {
  console.error(JSON.stringify({ operacion, ...detalle }))
}

export async function publicarEnComunidad(
  _previo: EstadoPost,
  datos: FormData
): Promise<EstadoPost> {
  const perfil = await exigirPerfil()

  const cursoId = String(datos.get('course_id') ?? '')
  const cursoSlug = String(datos.get('curso_slug') ?? '')
  if (!cursoId) return { error: 'Falta el curso.' }

  const resultado = esquemaPost.safeParse({
    titulo: datos.get('titulo'),
    cuerpo: datos.get('cuerpo') ?? '',
  })
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? 'Revisa tu publicación.' }
  }

  const supabase = await crearClienteServidor()

  // --- imágenes ---
  const archivos = datos
    .getAll('imagenes')
    .filter((a): a is File => a instanceof File && a.size > 0)

  if (archivos.length > LIMITE_IMAGENES) {
    return { error: `Puedes subir hasta ${LIMITE_IMAGENES} imágenes.` }
  }

  const imagenes: Array<{ url: string; storage_path: string }> = []

  for (const archivo of archivos) {
    if (!archivo.type.startsWith('image/')) {
      return { error: 'Solo se pueden adjuntar imágenes.' }
    }

    const limpio = archivo.name.replace(/[^\w.\-]+/g, '_').slice(-100)
    const ruta = `comunidad/${perfil.user_id}/${Date.now()}-${limpio}`

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(ruta, archivo, { contentType: archivo.type, upsert: false })

    if (error) {
      registrar('publicarEnComunidad:imagen', { ruta, error: error.message })
      if (imagenes.length > 0) {
        await supabase.storage.from(BUCKET).remove(imagenes.map((i) => i.storage_path))
      }
      return {
        error: /exceeded|maximum/i.test(error.message)
          ? 'Alguna imagen excede el tamaño permitido.'
          : 'No se pudo subir una de las imágenes.',
      }
    }

    // El bucket es público, así que la URL es directa y no hay que firmarla.
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta)
    imagenes.push({ url: data.publicUrl, storage_path: ruta })
  }

  const { error } = await supabase.from('community_posts').insert({
    course_id: cursoId,
    user_id: perfil.user_id,
    title: resultado.data.titulo,
    content_rich: comoDocumento(resultado.data.cuerpo),
    images: imagenes,
    pinned: false,
    status: 'visible',
  })

  if (error) {
    registrar('publicarEnComunidad', { cursoId, error: error.message })
    if (imagenes.length > 0) {
      await supabase.storage.from(BUCKET).remove(imagenes.map((i) => i.storage_path))
    }
    return { error: 'No se pudo publicar.' }
  }

  revalidatePath(`/curso/${cursoSlug}/comunidad`)
  return { aviso: 'Publicado.' }
}

export async function comentarEnPost(
  _previo: EstadoPost,
  datos: FormData
): Promise<EstadoPost> {
  const perfil = await exigirPerfil()

  const postId = String(datos.get('post_id') ?? '')
  const cursoSlug = String(datos.get('curso_slug') ?? '')
  const contenido = String(datos.get('contenido') ?? '').trim()

  if (!postId) return { error: 'Falta la publicación.' }
  if (contenido.length < 2) return { error: 'Escribe algo antes de comentar.' }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('community_comments').insert({
    post_id: postId,
    user_id: perfil.user_id,
    content: contenido,
    status: 'visible',
  })

  if (error) {
    registrar('comentarEnPost', { postId, error: error.message })
    return { error: 'No se pudo publicar tu comentario.' }
  }

  revalidatePath(`/curso/${cursoSlug}/comunidad`)
  return { aviso: 'Comentario publicado.' }
}

/** Fijar es solo del admin: la policy del alumno exige `pinned = false`. */
export async function fijarPost(datos: FormData): Promise<void> {
  const perfil = await exigirPerfil()
  if (!esEquipo(perfil)) return

  const id = String(datos.get('id') ?? '')
  const cursoSlug = String(datos.get('curso_slug') ?? '')
  const fijar = String(datos.get('fijar') ?? '') === 'si'
  if (!id) return

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('community_posts').update({ pinned: fijar }).eq('id', id)

  if (error) registrar('fijarPost', { id, error: error.message })
  revalidatePath(`/curso/${cursoSlug}/comunidad`)
}

/** Moderación: ocultar es reversible; borrar rompería los hilos (§3.8). */
export async function moderarPost(datos: FormData): Promise<void> {
  const perfil = await exigirPerfil()
  if (!esEquipo(perfil)) return

  const id = String(datos.get('id') ?? '')
  const tipo = String(datos.get('tipo') ?? 'post')
  const cursoSlug = String(datos.get('curso_slug') ?? '')
  if (!id) return

  const supabase = await crearClienteServidor()
  const tabla = tipo === 'comentario' ? 'community_comments' : 'community_posts'
  const { error } = await supabase.from(tabla).update({ status: 'hidden' }).eq('id', id)

  if (error) registrar('moderarPost', { id, tipo, error: error.message })
  revalidatePath(`/curso/${cursoSlug}/comunidad`)
}

/** El autor borra lo suyo: lógico, para no romper los comentarios que cuelgan. */
export async function eliminarPostPropio(datos: FormData): Promise<void> {
  const perfil = await exigirPerfil()

  const id = String(datos.get('id') ?? '')
  const cursoSlug = String(datos.get('curso_slug') ?? '')
  if (!id) return

  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('community_posts')
    .update({ status: 'deleted' })
    .eq('id', id)
    .eq('user_id', perfil.user_id)

  if (error) registrar('eliminarPostPropio', { id, error: error.message })
  revalidatePath(`/curso/${cursoSlug}/comunidad`)
}
