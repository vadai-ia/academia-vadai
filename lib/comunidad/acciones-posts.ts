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
  // La generación del muro (M16). Para un alumno es informativa: el trigger
  // `community_posts_sella_generacion` le pone la suya. El equipo elige
  // publicar en esta generación o en todas las del curso.
  const cohortId = String(datos.get('cohort_id') ?? '') || null
  const enTodas = esEquipo(perfil) && String(datos.get('alcance') ?? '') === 'todas'

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

  const base = {
    course_id: cursoId,
    user_id: perfil.user_id,
    title: resultado.data.titulo,
    content_rich: comoDocumento(resultado.data.cuerpo),
    images: imagenes,
    pinned: false,
    status: 'visible' as const,
  }

  // «Todas las generaciones»: una copia por generación, hermanadas por
  // `broadcast_id` para fijarlas, ocultarlas o borrarlas juntas. Las
  // respuestas quedan en la generación donde se escriben.
  let generaciones: Array<string | null> = [cohortId]
  if (enTodas) {
    const { data } = await supabase.from('cohorts').select('id').eq('course_id', cursoId)
    generaciones = (data ?? []).map((g) => g.id)
    if (generaciones.length === 0) generaciones = [cohortId]
  }
  const broadcast = generaciones.length > 1 ? crypto.randomUUID() : null

  const { error } = await supabase
    .from('community_posts')
    .insert(generaciones.map((g) => ({ ...base, cohort_id: g, broadcast_id: broadcast })))

  if (error) {
    registrar('publicarEnComunidad', { cursoId, cohortId, enTodas, error: error.message })
    if (imagenes.length > 0) {
      await supabase.storage.from(BUCKET).remove(imagenes.map((i) => i.storage_path))
    }
    return { error: error.code === '42501' ? 'No puedes publicar en esa generación.' : 'No se pudo publicar.' }
  }

  revalidatePath(`/curso/${cursoSlug}/comunidad`)
  revalidatePath('/comunidad')
  return {
    aviso: generaciones.length > 1 ? `Publicado en ${generaciones.length} generaciones.` : 'Publicado.',
  }
}

/**
 * Lo que toca una moderación: el post, o todas sus copias si se publicó en
 * «todas las generaciones» (M16). Quien lo publicó en todas quiere fijarlo,
 * ocultarlo o borrarlo en todas.
 */
async function filtroDeModeracion(id: string): Promise<{ columna: 'id' | 'broadcast_id'; valor: string }> {
  const supabase = await crearClienteServidor()
  const { data } = await supabase.from('community_posts').select('broadcast_id').eq('id', id).maybeSingle()
  return data?.broadcast_id ? { columna: 'broadcast_id', valor: data.broadcast_id } : { columna: 'id', valor: id }
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
  const fijar = String(datos.get('fijar') ?? '') === 'si'
  if (!id) return

  const supabase = await crearClienteServidor()
  const filtro = await filtroDeModeracion(id)
  const { error } = await supabase
    .from('community_posts')
    .update({ pinned: fijar })
    .eq(filtro.columna, filtro.valor)

  if (error) registrar('fijarPost', { id, error: error.message })
  revalidatePath(rutaDeVuelta(datos))
}

/**
 * A dónde volver tras moderar.
 *
 * El mismo feed se pinta en dos rutas desde que la comunidad es una sección
 * propia (21-sep-2026): dentro del curso y en /comunidad. El formulario manda
 * cuál, y se revalida esa; sin esto, moderar desde /comunidad dejaba la
 * pantalla igual y parecía que el botón no había hecho nada.
 */
function rutaDeVuelta(datos: FormData): string {
  const ruta = String(datos.get('ruta') ?? '')
  if (ruta.startsWith('/')) return ruta
  const cursoSlug = String(datos.get('curso_slug') ?? '')
  return `/curso/${cursoSlug}/comunidad`
}

/** Moderación: ocultar es reversible y no rompe el hilo. */
export async function moderarPost(datos: FormData): Promise<void> {
  const perfil = await exigirPerfil()
  if (!esEquipo(perfil)) return

  const id = String(datos.get('id') ?? '')
  const tipo = String(datos.get('tipo') ?? 'post')
  if (!id) return

  const supabase = await crearClienteServidor()
  const { error } =
    tipo === 'comentario'
      ? await supabase.from('community_comments').update({ status: 'hidden' }).eq('id', id)
      : await (async () => {
          const filtro = await filtroDeModeracion(id)
          return supabase.from('community_posts').update({ status: 'hidden' }).eq(filtro.columna, filtro.valor)
        })()

  if (error) registrar('moderarPost', { id, tipo, error: error.message })
  revalidatePath(rutaDeVuelta(datos))
}

/**
 * Borrado de verdad, para el equipo (21-sep-2026).
 *
 * Ocultar basta para lo que estorba; esto es para lo que no debe quedar ni
 * guardado —un insulto, un dato personal de alguien más, spam—. Alejandro lo
 * pidió así: "podemos eliminar y ocultar cualquier comentario para poder ver si
 * no hay alguno mala leche".
 *
 * Quién puede lo decide RLS (`community_*_delete_admin`), no este archivo.
 * Borrar una publicación se lleva sus comentarios por la FK en cascada, y eso
 * es lo que se quiere: un hilo entero que no debía existir.
 */
export async function eliminarComoEquipo(datos: FormData): Promise<void> {
  const perfil = await exigirPerfil()
  if (!esEquipo(perfil)) return

  const id = String(datos.get('id') ?? '')
  const tipo = String(datos.get('tipo') ?? 'post')
  if (!id) return

  const supabase = await crearClienteServidor()
  const { error } =
    tipo === 'comentario'
      ? await supabase.from('community_comments').delete().eq('id', id)
      : await (async () => {
          const filtro = await filtroDeModeracion(id)
          return supabase.from('community_posts').delete().eq(filtro.columna, filtro.valor)
        })()

  if (error) registrar('eliminarComoEquipo', { id, tipo, error: error.message })
  revalidatePath(rutaDeVuelta(datos))
}

/** El autor borra lo suyo: lógico, para no romper los comentarios que cuelgan. */
export async function eliminarPostPropio(datos: FormData): Promise<void> {
  const perfil = await exigirPerfil()

  const id = String(datos.get('id') ?? '')
  if (!id) return

  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('community_posts')
    .update({ status: 'deleted' })
    .eq('id', id)
    .eq('user_id', perfil.user_id)

  if (error) registrar('eliminarPostPropio', { id, error: error.message })
  revalidatePath(rutaDeVuelta(datos))
}
