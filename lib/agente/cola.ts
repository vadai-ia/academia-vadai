import 'server-only'

import { tocaEn, type AjustesAgente } from '@/lib/agente/ajustes'
import type { ClienteAgente } from '@/lib/agente/servidor'
import { esCuentaQa, esCursoQa } from '@/lib/qa'
import type { Database } from '@/lib/supabase/types'

/**
 * La cola del agente (M21): de cada mensaje de un alumno sale un trabajo.
 *
 * El cron barre cada 5 minutos lo escrito en las últimas 48 horas y encola lo
 * que falte. No se encola desde la acción del alumno: el agente espera al
 * menos 25 minutos para contestar, así que 5 de barrido no se notan, y la
 * acción del alumno sigue sin tocar el service role.
 *
 * Qué entra: publicaciones del muro, comentarios en publicaciones y preguntas
 * en lecciones, visibles, `via = 'humano'`, de un alumno (no del equipo ni de
 * la cuenta del bot), en un curso no archivado. El agente real nunca encola
 * cursos ni cuentas QA; el de la suite, solo eso. El índice único
 * (tipo_origen, origen_id) impide encolar dos veces lo mismo aunque dos
 * barridos corran juntos.
 */

const VENTANA_HORAS = 48

/**
 * Qué cursos atiende el agente de este servidor. El real: todos menos los QA.
 * El de la suite: solo los suyos (`qa-agente-…`), no los de las demás suites,
 * que corren antes en `test-todo` y dejan publicaciones recientes.
 */
export function cursoDelAgente(slug: string, qa: boolean): boolean {
  return qa ? slug.startsWith('qa-agente-') : !esCursoQa(slug)
}

type NuevoTrabajo = Database['academia']['Tables']['agent_jobs']['Insert']

function registrar(operacion: string, detalle: Record<string, unknown>) {
  console.error(JSON.stringify({ operacion, ...detalle }))
}

export async function encolarNuevos(db: ClienteAgente, a: AjustesAgente, ahora = new Date()): Promise<number> {
  if (a.modo === 'apagado') return 0
  const qa = a.es_qa
  const desde = new Date(ahora.getTime() - VENTANA_HORAS * 3_600_000).toISOString()

  const { data: cursos, error: errorCursos } = await db.from('courses').select('id, slug').neq('status', 'archived')
  if (errorCursos) {
    registrar('agente:encolar', { error: errorCursos.message })
    return 0
  }
  const cursosVivos = new Set((cursos ?? []).filter((c) => cursoDelAgente(c.slug, qa)).map((c) => c.id))
  if (cursosVivos.size === 0) return 0

  const [posts, comentarios, preguntas] = await Promise.all([
    db
      .from('community_posts')
      .select('id, course_id, cohort_id, user_id, created_at')
      .gte('created_at', desde)
      .eq('status', 'visible')
      .eq('via', 'humano'),
    db
      .from('community_comments')
      .select('id, post_id, user_id, created_at')
      .gte('created_at', desde)
      .eq('status', 'visible')
      .eq('via', 'humano'),
    db
      .from('lesson_comments')
      .select('id, lesson_id, parent_id, user_id, created_at')
      .gte('created_at', desde)
      .eq('status', 'visible')
      .eq('via', 'humano'),
  ])
  const fallo = posts.error ?? comentarios.error ?? preguntas.error
  if (fallo) {
    registrar('agente:encolar', { error: fallo.message })
    return 0
  }

  // El curso de cada comentario sale de su publicación; el de cada pregunta, de su lección.
  const idsDePosts = [...new Set((comentarios.data ?? []).map((c) => c.post_id))]
  const idsDeLecciones = [...new Set((preguntas.data ?? []).map((p) => p.lesson_id))]
  const [padres, lecciones] = await Promise.all([
    idsDePosts.length
      ? db.from('community_posts').select('id, course_id, status').in('id', idsDePosts)
      : Promise.resolve({ data: [] as Array<{ id: string; course_id: string; status: string }> }),
    idsDeLecciones.length
      ? db.from('lessons').select('id, module_id').in('id', idsDeLecciones)
      : Promise.resolve({ data: [] as Array<{ id: string; module_id: string }> }),
  ])
  const idsDeModulos = [...new Set((lecciones.data ?? []).map((l) => l.module_id))]
  const { data: modulos } = idsDeModulos.length
    ? await db.from('modules').select('id, course_id').in('id', idsDeModulos)
    : { data: [] as Array<{ id: string; course_id: string }> }
  const cursoDeModulo = new Map((modulos ?? []).map((m) => [m.id, m.course_id]))
  const cursoDeLeccion = new Map((lecciones.data ?? []).map((l) => [l.id, cursoDeModulo.get(l.module_id) ?? null]))
  const padrePorId = new Map((padres.data ?? []).map((p) => [p.id, p]))

  const candidatos: Array<NuevoTrabajo & { user_id: string; creado: string }> = []
  for (const p of posts.data ?? []) {
    if (!cursosVivos.has(p.course_id)) continue
    candidatos.push({ tipo_origen: 'post', origen_id: p.id, course_id: p.course_id, hilo_id: p.id, toca_en: '', es_qa: qa, user_id: p.user_id, creado: p.created_at })
  }
  for (const c of comentarios.data ?? []) {
    const padre = padrePorId.get(c.post_id)
    if (!padre || padre.status !== 'visible' || !cursosVivos.has(padre.course_id)) continue
    candidatos.push({ tipo_origen: 'comentario', origen_id: c.id, course_id: padre.course_id, hilo_id: c.post_id, toca_en: '', es_qa: qa, user_id: c.user_id, creado: c.created_at })
  }
  for (const q of preguntas.data ?? []) {
    const curso = cursoDeLeccion.get(q.lesson_id)
    if (!curso || !cursosVivos.has(curso)) continue
    candidatos.push({ tipo_origen: 'leccion', origen_id: q.id, course_id: curso, hilo_id: q.parent_id ?? q.id, toca_en: '', es_qa: qa, user_id: q.user_id, creado: q.created_at })
  }
  if (candidatos.length === 0) return 0

  // Solo lo de alumnos: ni el equipo, ni el bot, ni (en el agente real) una cuenta QA.
  const autores = [...new Set(candidatos.map((c) => c.user_id))]
  const { data: perfiles } = await db.from('profiles').select('user_id, role, email, es_bot').in('user_id', autores)
  const alumnos = new Set(
    (perfiles ?? []).filter((p) => p.role === 'alumno' && !p.es_bot && esCuentaQa(p.email) === qa).map((p) => p.user_id)
  )

  const { data: existentes } = await db
    .from('agent_jobs')
    .select('origen_id')
    .in(
      'origen_id',
      candidatos.map((c) => c.origen_id)
    )
  const yaEstan = new Set((existentes ?? []).map((e) => e.origen_id))

  const nuevos: NuevoTrabajo[] = candidatos
    .filter((c) => alumnos.has(c.user_id) && !yaEstan.has(c.origen_id))
    .map(({ user_id: _autor, creado, ...t }) => ({ ...t, toca_en: tocaEn(new Date(creado), a, ahora).toISOString() }))
  if (nuevos.length === 0) return 0

  const { error } = await db.from('agent_jobs').upsert(nuevos, { onConflict: 'tipo_origen,origen_id', ignoreDuplicates: true })
  if (error) {
    registrar('agente:encolar', { nuevos: nuevos.length, error: error.message })
    return 0
  }
  return nuevos.length
}
