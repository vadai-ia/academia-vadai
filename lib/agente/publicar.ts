import 'server-only'

import { revalidatePath } from 'next/cache'

import type { ClienteAgente } from '@/lib/agente/servidor'

/**
 * Publicar a nombre de la cuenta «Equipo VADAI» (M21). Lo usan el cron (lo
 * que el agente contesta solo, `via = 'agente'`) y el panel (un borrador que
 * una persona revisó, `via = 'agente_revisado'`).
 *
 * `agent_job_id` tiene índice único: el mismo trabajo no se publica dos veces
 * aunque el cron y una persona le den publicar al mismo tiempo.
 */

export type Via = 'agente' | 'agente_revisado'

const LARGO_MAXIMO = 1900

export async function cuentaDelBot(db: ClienteAgente): Promise<string | null> {
  const { data } = await db.from('profiles').select('user_id').eq('es_bot', true).eq('status', 'active').limit(1).maybeSingle()
  return data?.user_id ?? null
}

export async function publicarRespuesta(
  db: ClienteAgente,
  r: { tipoOrigen: 'post' | 'comentario' | 'leccion'; hiloId: string; texto: string; via: Via; jobId: string | null; botId: string }
): Promise<{ id: string } | { error: string }> {
  const contenido = r.texto.trim().slice(0, LARGO_MAXIMO)
  if (contenido.length < 2) return { error: 'La respuesta está vacía.' }

  if (r.tipoOrigen === 'leccion') {
    const { data: raiz } = await db.from('lesson_comments').select('id, lesson_id, status').eq('id', r.hiloId).maybeSingle()
    if (!raiz || raiz.status !== 'visible') return { error: 'La pregunta ya no está visible.' }
    const { data, error } = await db
      .from('lesson_comments')
      .insert({ lesson_id: raiz.lesson_id, user_id: r.botId, parent_id: raiz.id, content: contenido, status: 'visible', via: r.via, agent_job_id: r.jobId })
      .select('id')
      .single()
    if (error || !data) return { error: error?.code === '23505' ? 'Esa respuesta ya se publicó.' : `No se pudo publicar: ${error?.message}` }
    const ruta = await rutaDeLeccion(db, raiz.lesson_id)
    if (ruta) revalidatePath(ruta)
    revalidatePath('/admin/comunidad')
    return { id: data.id }
  }

  const { data: post } = await db.from('community_posts').select('id, course_id, status').eq('id', r.hiloId).maybeSingle()
  if (!post || post.status !== 'visible') return { error: 'La publicación ya no está visible.' }
  const { data, error } = await db
    .from('community_comments')
    .insert({ post_id: post.id, user_id: r.botId, content: contenido, status: 'visible', via: r.via, agent_job_id: r.jobId })
    .select('id')
    .single()
  if (error || !data) return { error: error?.code === '23505' ? 'Esa respuesta ya se publicó.' : `No se pudo publicar: ${error?.message}` }
  const { data: curso } = await db.from('courses').select('slug').eq('id', post.course_id).maybeSingle()
  if (curso) revalidatePath(`/curso/${curso.slug}/comunidad`)
  revalidatePath('/comunidad')
  revalidatePath('/admin/comunidad')
  return { id: data.id }
}

async function rutaDeLeccion(db: ClienteAgente, leccionId: string): Promise<string | null> {
  const { data: leccion } = await db.from('lessons').select('module_id').eq('id', leccionId).maybeSingle()
  if (!leccion) return null
  const { data: modulo } = await db.from('modules').select('course_id').eq('id', leccion.module_id).maybeSingle()
  if (!modulo) return null
  const { data: curso } = await db.from('courses').select('slug').eq('id', modulo.course_id).maybeSingle()
  return curso ? `/curso/${curso.slug}/${leccionId}` : null
}
