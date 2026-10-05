'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { exigirEquipo } from '@/lib/auth/sesion'
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
  /** Una generación concreta (M16); el trigger exige que sea de `audience_course_id`. */
  audience_cohort_id: z
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

/**
 * «Para quién» viaja como un solo valor: vacío (todos), `curso:<id>` (el curso
 * con todas sus generaciones) o `gen:<id>` (una generación). Con `gen:` el
 * curso se resuelve en la base antes de insertar; aquí solo se reparte.
 */
function leerAudiencia(datos: FormData): { audience_course_id: string; audience_cohort_id: string } {
  const valor = String(datos.get('audiencia') ?? datos.get('audience_course_id') ?? '').trim()
  if (valor.startsWith('gen:')) return { audience_course_id: '', audience_cohort_id: valor.slice(4) }
  if (valor.startsWith('curso:')) return { audience_course_id: valor.slice(6), audience_cohort_id: '' }
  return { audience_course_id: valor, audience_cohort_id: '' }
}

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
  const perfil = await exigirEquipo()

  const resultado = esquema.safeParse({
    title: datos.get('title'),
    post_type: datos.get('post_type'),
    cover_url: datos.get('cover_url') ?? '',
    ...leerAudiencia(datos),
    content_rich: datos.get('content_rich') ?? '',
  })

  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? 'Revisa los datos.' }
  }

  const publicarYa = String(datos.get('publicar') ?? '') === 'si'

  const supabase = await crearClienteServidor()

  // Una generación implica su curso: así la policy del alumno y el trigger de
  // coherencia tienen los dos datos.
  if (resultado.data.audience_cohort_id && !resultado.data.audience_course_id) {
    const { data: g } = await supabase
      .from('cohorts')
      .select('course_id')
      .eq('id', resultado.data.audience_cohort_id)
      .maybeSingle()
    if (!g) return { error: 'Esa generación ya no existe.' }
    resultado.data.audience_course_id = g.course_id
  }

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
  await exigirEquipo()

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
  await exigirEquipo()

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
