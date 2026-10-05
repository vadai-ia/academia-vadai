'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { publicarEnComunidad } from '@/lib/comunidad/acciones-posts'
import { filtroDeModeracion } from '@/lib/comunidad/moderacion'
import { exigirEquipo } from '@/lib/auth/sesion'
import { crearClienteServidor } from '@/lib/supabase/server'
import type { EstadoAccion } from '@/lib/admin/tipos'

/**
 * Lo que el equipo hace desde la bandeja de Comunidad (3-oct-2026):
 * contestar, fijar, ocultar y borrar sin entrar al portal como alumno.
 *
 * Todo vuelve a la misma vista de la bandeja con un `?aviso=`, por redirect:
 * al contestar, el hilo pasa a «Respondidas» y desaparece de la pestaña donde
 * estabas, así que un aviso dentro de su tarjeta no lo vería nadie. El aviso
 * va arriba de la lista. Sin JavaScript funciona igual.
 *
 * Quién puede qué lo decide RLS, como en el portal: aquí solo se exige ser del
 * equipo para no ofrecer el formulario a quien no le toca.
 */

const BANDEJA = '/admin/comunidad'

function registrar(operacion: string, detalle: Record<string, unknown>) {
  console.error(JSON.stringify({ operacion, ...detalle }))
}

/** La vista de la bandeja de la que vino el formulario, con su aviso. */
function volver(datos: FormData, aviso: string, hilo?: string): never {
  const crudo = String(datos.get('vuelta') ?? '')
  const url = new URL(crudo.startsWith(BANDEJA) ? crudo : BANDEJA, 'http://x')
  url.searchParams.delete('aviso')
  url.searchParams.delete('hilo')
  url.searchParams.set('aviso', aviso)
  if (hilo) url.searchParams.set('hilo', hilo)
  redirect(`${url.pathname}?${url.searchParams.toString()}`)
}

function revalidar() {
  // La campana del panel vive en el layout: se recalcula en todo /admin.
  revalidatePath('/admin', 'layout')
  revalidatePath('/curso/[slug]', 'layout')
  revalidatePath('/comunidad')
}

const esquemaRespuesta = z.object({
  tipo: z.enum(['muro', 'leccion']),
  id: z.string().uuid(),
  contenido: z
    .string()
    .trim()
    .min(2, 'Escribe algo antes de responder.')
    .max(2000, 'La respuesta es demasiado larga.'),
})

/**
 * Contestar un hilo. En el muro es un comentario de la publicación; en una
 * lección, una respuesta al comentario raíz (un solo nivel, como en el portal).
 * La fila es de quien contesta: el alumno ve «Equipo VADAI» junto a su nombre.
 */
export async function responderHilo(datos: FormData): Promise<void> {
  const perfil = await exigirEquipo()
  const r = esquemaRespuesta.safeParse({
    tipo: datos.get('tipo'),
    id: datos.get('id'),
    contenido: datos.get('contenido'),
  })
  if (!r.success) volver(datos, 'vacia')

  const { tipo, id, contenido } = r.data
  const supabase = await crearClienteServidor()

  let error: { message: string; code?: string } | null = null
  if (tipo === 'muro') {
    ;({ error } = await supabase
      .from('community_comments')
      .insert({ post_id: id, user_id: perfil.user_id, content: contenido, status: 'visible' }))
  } else {
    const { data: raiz } = await supabase.from('lesson_comments').select('lesson_id').eq('id', id).maybeSingle()
    if (!raiz) volver(datos, 'error')
    ;({ error } = await supabase.from('lesson_comments').insert({
      lesson_id: raiz.lesson_id,
      user_id: perfil.user_id,
      parent_id: id,
      content: contenido,
      status: 'visible',
    }))
  }

  if (error) {
    registrar('responderHilo', { tipo, id, porQuien: perfil.user_id, error: error.message })
    volver(datos, error.code === '42501' ? 'sinPermiso' : 'error', id)
  }

  revalidar()
  volver(datos, 'respondida', id)
}

const esquemaModeracion = z.object({
  /** `post` y `comentario` son del muro; `pregunta` es de una lección. */
  tipo: z.enum(['post', 'comentario', 'pregunta']),
  id: z.string().uuid(),
})

/** Ocultar o volver a mostrar. Reversible, y no rompe el hilo. */
export async function alternarVisibilidad(datos: FormData): Promise<void> {
  await exigirEquipo()
  const r = esquemaModeracion.safeParse({ tipo: datos.get('tipo'), id: datos.get('id') })
  if (!r.success) volver(datos, 'error')
  const ocultar = String(datos.get('ocultar') ?? '') === 'si'
  const status = ocultar ? ('hidden' as const) : ('visible' as const)
  const { tipo, id } = r.data

  const supabase = await crearClienteServidor()
  const { error } =
    tipo === 'pregunta'
      ? await supabase.from('lesson_comments').update({ status }).eq('id', id)
      : tipo === 'comentario'
        ? await supabase.from('community_comments').update({ status }).eq('id', id)
        : await (async () => {
            const filtro = await filtroDeModeracion(id)
            return supabase.from('community_posts').update({ status }).eq(filtro.columna, filtro.valor)
          })()

  if (error) {
    registrar('alternarVisibilidad', { tipo, id, ocultar, error: error.message })
    volver(datos, 'error')
  }
  revalidar()
  volver(datos, ocultar ? 'oculta' : 'visible')
}

const esquemaAtencion = z.object({
  tipo: z.enum(['muro', 'leccion']),
  id: z.string().uuid(),
})

/**
 * Dar por atendido un hilo sin escribir nada (0037): se resolvió en la sesión
 * en vivo, por WhatsApp, o no pedía respuesta. Sale de «Sin respuesta» y de la
 * campana; si el alumno vuelve a escribir, regresa solo. «Volver a pendiente»
 * quita la marca.
 */
export async function marcarAtendida(datos: FormData): Promise<void> {
  const perfil = await exigirEquipo()
  const r = esquemaAtencion.safeParse({ tipo: datos.get('tipo'), id: datos.get('id') })
  if (!r.success) volver(datos, 'error')
  const atender = String(datos.get('atender') ?? '') === 'si'
  const cambios = atender
    ? { attended_at: new Date().toISOString(), attended_by: perfil.user_id }
    : { attended_at: null, attended_by: null }

  const supabase = await crearClienteServidor()
  const { error } =
    r.data.tipo === 'muro'
      ? await supabase.from('community_posts').update(cambios).eq('id', r.data.id)
      : await supabase.from('lesson_comments').update(cambios).eq('id', r.data.id)

  if (error) {
    registrar('marcarAtendida', { ...r.data, atender, porQuien: perfil.user_id, error: error.message })
    volver(datos, 'error')
  }
  revalidar()
  volver(datos, atender ? 'atendida' : 'pendiente', r.data.id)
}

/** Fijar arriba del muro de su generación (o de todas, si se publicó en todas). */
export async function alternarFijado(datos: FormData): Promise<void> {
  await exigirEquipo()
  const id = z.string().uuid().safeParse(datos.get('id'))
  if (!id.success) volver(datos, 'error')
  const fijar = String(datos.get('fijar') ?? '') === 'si'

  const supabase = await crearClienteServidor()
  const filtro = await filtroDeModeracion(id.data)
  const { error } = await supabase.from('community_posts').update({ pinned: fijar }).eq(filtro.columna, filtro.valor)

  if (error) {
    registrar('alternarFijado', { id: id.data, fijar, error: error.message })
    volver(datos, 'error')
  }
  revalidar()
  volver(datos, fijar ? 'fijada' : 'desfijada')
}

/**
 * Borrar de verdad: para lo que no debe quedar ni guardado. Borrar una
 * publicación se lleva sus comentarios (FK en cascada); borrar una pregunta de
 * lección, sus respuestas. Va detrás de un modal (`ConfirmarConModal`).
 */
export async function eliminarDeComunidad(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirEquipo()
  const r = esquemaModeracion.safeParse({ tipo: datos.get('tipo'), id: datos.get('id') })
  if (!r.success) return { error: 'No se encontró qué borrar.' }
  const { tipo, id } = r.data

  const supabase = await crearClienteServidor()
  const { error } =
    tipo === 'pregunta'
      ? await supabase.from('lesson_comments').delete().eq('id', id)
      : tipo === 'comentario'
        ? await supabase.from('community_comments').delete().eq('id', id)
        : await (async () => {
            const filtro = await filtroDeModeracion(id)
            return supabase.from('community_posts').delete().eq(filtro.columna, filtro.valor)
          })()

  if (error) {
    registrar('eliminarDeComunidad', { tipo, id, error: error.message })
    return { error: 'No se pudo borrar. Intenta de nuevo.' }
  }
  revalidar()
  volver(datos, 'eliminada')
}

/**
 * Publicar en el muro desde el panel: un aviso para una generación o para
 * todas las de un curso. Es la misma acción del portal; aquí solo se traduce
 * el destino elegido («curso::generación» o «curso::todas») a sus campos.
 */
export async function publicarDesdeElPanel(previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirEquipo()
  const [cursoId = '', destino = ''] = String(datos.get('destino') ?? '').split('::')
  if (!cursoId) return { error: 'Elige en qué muro publicar.' }

  const supabase = await crearClienteServidor()
  const { data: curso } = await supabase.from('courses').select('slug').eq('id', cursoId).maybeSingle()
  if (!curso) return { error: 'Ese curso ya no existe.' }

  datos.set('course_id', cursoId)
  datos.set('curso_slug', curso.slug)
  if (destino === 'todas') datos.set('alcance', 'todas')
  else if (destino) datos.set('cohort_id', destino)

  const resultado = await publicarEnComunidad(previo, datos)
  if (resultado.error) return resultado
  revalidar()
  return resultado
}
