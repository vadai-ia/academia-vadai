import 'server-only'

import { crearClienteServidor } from '@/lib/supabase/server'
import { rutaDeContenido } from '@/lib/vaip/rutas'

/**
 * «Te respondieron» (M22, 20-oct-2026): lo que trae de vuelta a una
 * conversación. Antes la campana avisaba de anuncios, blog, sesiones y
 * dinámicas, pero no de que alguien contestó lo que escribiste: volver a un
 * hilo dependía de acordarse.
 *
 * Cuenta como respuesta:
 *   - en un muro, un comentario de otra persona en una publicación tuya, o en
 *     una donde comentaste (solo lo que llegó después de tu último comentario);
 *   - en una lección, una respuesta de otra persona a tu pregunta.
 *
 * Un aviso por hilo, con cuántas respuestas lleva. Sin tabla: todo con la
 * sesión de quien pregunta (RLS) y ventanas cortas.
 */

export type Respuestas = {
  /** El id del hilo: la publicación o la pregunta de la lección. */
  id: string
  titulo: string
  cuantas: number
  /** La respuesta más reciente: es lo que decide si es «nueva». */
  ultimaEn: string
  /** Dónde está la conversación. */
  href: string
  donde: string
}

const DIAS_PROPIOS = 60
const DIAS_RESPUESTAS = 30

const haceDias = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()

export async function misRespuestas(userId: string, casaSlug: string | null): Promise<Respuestas[]> {
  const supabase = await crearClienteServidor()
  const [{ data: misPosts }, { data: misComentarios }, { data: misPreguntas }] = await Promise.all([
    supabase
      .from('community_posts')
      .select('id, created_at')
      .eq('user_id', userId)
      .eq('status', 'visible')
      .gte('created_at', haceDias(DIAS_PROPIOS))
      .limit(50),
    supabase
      .from('community_comments')
      .select('post_id, created_at')
      .eq('user_id', userId)
      .eq('status', 'visible')
      .gte('created_at', haceDias(DIAS_PROPIOS))
      .limit(100),
    supabase
      .from('lesson_comments')
      .select('id, lesson_id, content, created_at')
      .eq('user_id', userId)
      .is('parent_id', null)
      .eq('status', 'visible')
      .gte('created_at', haceDias(DIAS_PROPIOS))
      .limit(50),
  ])

  // Desde cuándo cuenta cada hilo del muro: si es tuyo, todo; si solo
  // comentaste, lo que vino después de tu último comentario.
  const desde = new Map<string, string>()
  for (const p of misPosts ?? []) desde.set(p.id, p.created_at)
  for (const c of misComentarios ?? []) {
    const previo = desde.get(c.post_id)
    if (!previo || (!(misPosts ?? []).some((p) => p.id === c.post_id) && c.created_at > previo)) desde.set(c.post_id, c.created_at)
  }

  const idsPosts = [...desde.keys()]
  const idsPreguntas = (misPreguntas ?? []).map((q) => q.id)
  const [{ data: comentarios }, { data: replicas }] = await Promise.all([
    idsPosts.length
      ? supabase
          .from('community_comments')
          .select('post_id, created_at')
          .in('post_id', idsPosts)
          .neq('user_id', userId)
          .eq('status', 'visible')
          .gte('created_at', haceDias(DIAS_RESPUESTAS))
      : Promise.resolve({ data: [] as Array<{ post_id: string; created_at: string }> }),
    idsPreguntas.length
      ? supabase
          .from('lesson_comments')
          .select('parent_id, created_at')
          .in('parent_id', idsPreguntas)
          .neq('user_id', userId)
          .eq('status', 'visible')
          .gte('created_at', haceDias(DIAS_RESPUESTAS))
      : Promise.resolve({ data: [] as Array<{ parent_id: string | null; created_at: string }> }),
  ])

  // --- muros ---------------------------------------------------------------
  const porPost = new Map<string, { cuantas: number; ultimaEn: string }>()
  for (const c of comentarios ?? []) {
    if (c.created_at <= (desde.get(c.post_id) ?? '')) continue
    const g = porPost.get(c.post_id) ?? { cuantas: 0, ultimaEn: c.created_at }
    g.cuantas++
    if (c.created_at > g.ultimaEn) g.ultimaEn = c.created_at
    porPost.set(c.post_id, g)
  }
  const idsConRespuesta = [...porPost.keys()]
  const { data: posts } = idsConRespuesta.length
    ? await supabase.from('community_posts').select('id, title, course_id').in('id', idsConRespuesta).eq('status', 'visible')
    : { data: [] as Array<{ id: string; title: string; course_id: string }> }

  // --- lecciones -----------------------------------------------------------
  const porPregunta = new Map<string, { cuantas: number; ultimaEn: string }>()
  for (const r of replicas ?? []) {
    if (!r.parent_id) continue
    const g = porPregunta.get(r.parent_id) ?? { cuantas: 0, ultimaEn: r.created_at }
    g.cuantas++
    if (r.created_at > g.ultimaEn) g.ultimaEn = r.created_at
    porPregunta.set(r.parent_id, g)
  }
  const preguntas = (misPreguntas ?? []).filter((q) => porPregunta.has(q.id))
  const { data: lecciones } = preguntas.length
    ? await supabase.from('lessons').select('id, title, module_id').in('id', [...new Set(preguntas.map((q) => q.lesson_id))])
    : { data: [] as Array<{ id: string; title: string; module_id: string }> }
  const { data: modulos } = (lecciones ?? []).length
    ? await supabase.from('modules').select('id, course_id, kind').in('id', [...new Set((lecciones ?? []).map((l) => l.module_id))])
    : { data: [] as Array<{ id: string; course_id: string; kind: 'curso' | 'mes' | 'herramientas' }> }

  const idsCursos = [...new Set([...(posts ?? []).map((p) => p.course_id), ...(modulos ?? []).map((m) => m.course_id)])]
  const { data: cursos } = idsCursos.length
    ? await supabase.from('courses').select('id, slug, title').in('id', idsCursos)
    : { data: [] as Array<{ id: string; slug: string; title: string }> }
  const curso = new Map((cursos ?? []).map((c) => [c.id, c]))
  const cursoDeModulo = new Map((modulos ?? []).map((m) => [m.id, m.course_id]))
  const tipoDeModulo = new Map((modulos ?? []).map((m) => [m.id, m.kind]))
  const leccion = new Map((lecciones ?? []).map((l) => [l.id, l]))

  const salida: Respuestas[] = []
  for (const p of posts ?? []) {
    const g = porPost.get(p.id)
    const c = curso.get(p.course_id)
    if (!g || !c) continue
    const esCasa = c.slug === casaSlug
    salida.push({
      id: p.id,
      titulo: p.title,
      cuantas: g.cuantas,
      ultimaEn: g.ultimaEn,
      href: esCasa ? `/vaip#publicacion-${p.id}` : `/curso/${c.slug}/comunidad#publicacion-${p.id}`,
      // M25: «Comunidad» es solo V-AI-P; el canal de un curso es su «Grupo».
      donde: esCasa ? 'Muro de V-AI-P' : `Grupo · ${c.title}`,
    })
  }
  for (const q of preguntas) {
    const g = porPregunta.get(q.id)
    const l = leccion.get(q.lesson_id)
    const c = l ? curso.get(cursoDeModulo.get(l.module_id) ?? '') : undefined
    if (!g || !l || !c) continue
    // M26: las grabaciones y herramientas de V-AI-P viven en /vaip, no en un curso.
    const tipo = tipoDeModulo.get(l.module_id) ?? 'curso'
    salida.push({
      id: q.id,
      titulo: q.content.length > 90 ? `${q.content.slice(0, 87)}…` : q.content,
      cuantas: g.cuantas,
      ultimaEn: g.ultimaEn,
      href: `${tipo === 'curso' ? `/curso/${c.slug}/${l.id}` : rutaDeContenido(tipo, l.id)}#comentario-${q.id}`,
      donde: `${tipo === 'mes' ? 'Clase grabada' : tipo === 'herramientas' ? 'Herramienta' : 'Lección'} · ${l.title}`,
    })
  }
  return salida.sort((a, b) => b.ultimaEn.localeCompare(a.ultimaEn))
}
