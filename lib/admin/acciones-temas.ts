'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { generarSlug } from '@/lib/admin/esquemas'
import type { EstadoAccion } from '@/lib/admin/tipos'
import { exigirEquipo } from '@/lib/auth/sesion'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * Los temas del muro (M17, academia_0041). Los maneja el equipo: el muro
 * principal sigue mostrando todo, y el tema solo filtra. Archivar esconde el
 * tema de los filtros sin quitárselo a las publicaciones que ya lo tienen.
 */

const esquemaTema = z.object({
  course_id: z.uuid('Curso inválido.'),
  nombre: z.string().trim().min(2, 'El tema necesita al menos 2 letras.').max(40, 'Hasta 40 caracteres.'),
})

export async function crearTema(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirEquipo()
  const r = esquemaTema.safeParse({ course_id: datos.get('course_id'), nombre: datos.get('nombre') })
  if (!r.success) return { error: r.error.issues[0]?.message ?? 'Revisa el tema.' }

  const slug = generarSlug(r.data.nombre).slice(0, 40)
  if (slug.length < 2) return { error: 'Ese nombre no sirve para un tema.' }

  const supabase = await crearClienteServidor()
  const { count } = await supabase
    .from('community_topics')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', r.data.course_id)
  const { error } = await supabase
    .from('community_topics')
    .insert({ course_id: r.data.course_id, name: r.data.nombre, slug, position: count ?? 0 })
  if (error) {
    if (error.code === '23505') return { error: 'Ya hay un tema con ese nombre.' }
    console.error(JSON.stringify({ operacion: 'crearTema', curso: r.data.course_id, error: error.message }))
    return { error: 'No se pudo crear el tema.' }
  }

  revalidatePath('/admin/vaip/muro')
  revalidatePath('/curso/[slug]/comunidad', 'page')
  return { aviso: `Tema «${r.data.nombre}» creado.` }
}

/** Archiva o reactiva un tema. Formulario simple, sin estado: funciona sin JS. */
export async function alternarTema(datos: FormData): Promise<void> {
  await exigirEquipo()
  const id = String(datos.get('id') ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(id)) return
  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('community_topics')
    .update({ archived: datos.get('archivar') === 'si' })
    .eq('id', id)
  if (error) console.error(JSON.stringify({ operacion: 'alternarTema', id, error: error.message }))
  revalidatePath('/admin/vaip/muro')
  revalidatePath('/curso/[slug]/comunidad', 'page')
}
