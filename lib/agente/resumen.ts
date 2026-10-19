import 'server-only'

import { z } from 'zod'

import { ajustesDelAgente } from '@/lib/agente/ajustes'
import { llamar } from '@/lib/agente/claude'
import { cursoDelAgente } from '@/lib/agente/cola'
import { REGLAS_RESUMEN } from '@/lib/agente/prompt'
import { dbDelAgente } from '@/lib/agente/servidor'
import { anonimizar } from '@/lib/agente/validar'
import { esRolDeEquipo } from '@/lib/auth/roles'
import { textoPlano } from '@/lib/comunidad/documento'
import { esCuentaQa } from '@/lib/qa'
import type { Json } from '@/lib/supabase/types'

/**
 * El resumen del día (M21): qué se habló ayer en la comunidad, los temas que
 * suben, las dudas que se repiten y quién necesita a una persona. Lo arma
 * Haiku una vez al día (cron de las 7:00 CDMX) y se lee en la pestaña Agente.
 *
 * Si ayer no hubo conversaciones, no se llama al modelo.
 */

const ResumenEsquema = z.object({
  resumen: z.string(),
  temas: z.array(z.object({ tema: z.string(), conversaciones: z.number() })),
  dudas_frecuentes: z.array(z.string()),
  atencion: z.array(z.object({ clave: z.string(), por_que: z.string() })),
  ideas: z.array(z.string()),
})

export type ContenidoDelResumen = {
  resumen: string
  temas: Array<{ tema: string; conversaciones: number }>
  dudasFrecuentes: string[]
  atencion: Array<{ titulo: string; curso: string; porQue: string; href: string }>
  ideas: string[]
  cifras: { conversaciones: number; mensajesDeAlumnos: number; respuestasDelAgente: number; respuestasDelEquipo: number }
  generadoEn: string
}

const MAX_HILOS = 40

function hoyEnCdmx(fecha = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(fecha)
}

export async function armarResumenDelDia(ahora = new Date()): Promise<{ fecha: string; llamoAlModelo: boolean } | null> {
  const a = await ajustesDelAgente()
  if (!a || a.modo === 'apagado') return null
  const db = dbDelAgente()
  const qa = a.es_qa
  const desde = new Date(ahora.getTime() - 24 * 3_600_000).toISOString()

  const [{ data: cursos }, { data: posts }, { data: comentarios }, { data: preguntas }, { data: ideas }] = await Promise.all([
    db.from('courses').select('id, slug, title').neq('status', 'archived'),
    db.from('community_posts').select('id, course_id, user_id, title, content_rich, created_at, via').eq('status', 'visible').gte('created_at', desde),
    db.from('community_comments').select('id, post_id, user_id, content, created_at, via').eq('status', 'visible').gte('created_at', desde),
    db.from('lesson_comments').select('id, lesson_id, parent_id, user_id, content, created_at, via').eq('status', 'visible').gte('created_at', desde),
    db.from('community_insights').select('tipo, resumen').eq('es_qa', qa).gte('created_at', desde).limit(60),
  ])

  const cursoPorId = new Map((cursos ?? []).filter((c) => cursoDelAgente(c.slug, qa)).map((c) => [c.id, c]))

  // Los hilos con actividad: la publicación o la pregunta raíz, con lo nuevo.
  const idsDePosts = new Set<string>([...(posts ?? []).map((p) => p.id), ...(comentarios ?? []).map((c) => c.post_id)])
  const idsDeRaices = new Set<string>((preguntas ?? []).map((p) => p.parent_id ?? p.id))
  const [{ data: postsHilo }, { data: raices }] = await Promise.all([
    idsDePosts.size ? db.from('community_posts').select('id, course_id, title, content_rich, user_id').in('id', [...idsDePosts]).eq('status', 'visible') : Promise.resolve({ data: [] as Array<{ id: string; course_id: string; title: string; content_rich: Json | null; user_id: string }> }),
    idsDeRaices.size ? db.from('lesson_comments').select('id, lesson_id, content, user_id').in('id', [...idsDeRaices]).eq('status', 'visible') : Promise.resolve({ data: [] as Array<{ id: string; lesson_id: string; content: string; user_id: string }> }),
  ])
  const idsDeLecciones = [...new Set((raices ?? []).map((r) => r.lesson_id))]
  const { data: lecciones } = idsDeLecciones.length ? await db.from('lessons').select('id, title, module_id').in('id', idsDeLecciones) : { data: [] as Array<{ id: string; title: string; module_id: string }> }
  const { data: modulos } = (lecciones ?? []).length ? await db.from('modules').select('id, course_id').in('id', (lecciones ?? []).map((l) => l.module_id)) : { data: [] as Array<{ id: string; course_id: string }> }
  const cursoDeModulo = new Map((modulos ?? []).map((m) => [m.id, m.course_id]))
  const leccionPorId = new Map((lecciones ?? []).map((l) => [l.id, { titulo: l.title, cursoId: cursoDeModulo.get(l.module_id) ?? '' }]))

  const autores = new Set<string>()
  for (const x of [...(posts ?? []), ...(comentarios ?? []), ...(preguntas ?? []), ...(postsHilo ?? []), ...(raices ?? [])]) autores.add(x.user_id)
  const { data: perfiles } = autores.size ? await db.from('profiles').select('user_id, role, email, es_bot').in('user_id', [...autores]) : { data: [] as Array<{ user_id: string; role: string; email: string; es_bot: boolean }> }
  const perfil = new Map((perfiles ?? []).map((p) => [p.user_id, p]))
  const cuenta = (uid: string) => esCuentaQa(perfil.get(uid)?.email) === qa || Boolean(perfil.get(uid)?.es_bot)
  const quien = (uid: string, via: string) => {
    const p = perfil.get(uid)
    if (p?.es_bot && (via === 'agente' || via === 'agente_revisado')) return 'Equipo (agente)'
    return p && esRolDeEquipo(p.role) ? 'Equipo' : 'Alumno'
  }

  type HiloResumen = { clave: string; titulo: string; curso: string; href: string; lineas: string[] }
  const hilos: HiloResumen[] = []
  const cifras = { conversaciones: 0, mensajesDeAlumnos: 0, respuestasDelAgente: 0, respuestasDelEquipo: 0 }
  const contar = (uid: string, via: string) => {
    const q = quien(uid, via)
    if (q === 'Alumno') cifras.mensajesDeAlumnos++
    else if (q === 'Equipo (agente)') cifras.respuestasDelAgente++
    else cifras.respuestasDelEquipo++
  }

  for (const p of postsHilo ?? []) {
    const curso = cursoPorId.get(p.course_id)
    if (!curso || !cuenta(p.user_id)) continue
    const nuevos = (comentarios ?? []).filter((c) => c.post_id === p.id && cuenta(c.user_id))
    const propio = (posts ?? []).find((x) => x.id === p.id)
    if (propio) contar(propio.user_id, propio.via)
    nuevos.forEach((c) => contar(c.user_id, c.via))
    hilos.push({
      clave: `C${hilos.length + 1}`,
      titulo: p.title,
      curso: curso.title,
      href: `/curso/${curso.slug}/comunidad#publicacion-${p.id}`,
      lineas: [
        `Alumno: ${p.title}. ${textoPlano(p.content_rich).slice(0, 500)}`,
        ...nuevos.map((c) => `${quien(c.user_id, c.via)}: ${c.content.slice(0, 400)}`),
      ],
    })
  }
  for (const r of raices ?? []) {
    const leccion = leccionPorId.get(r.lesson_id)
    const curso = leccion ? cursoPorId.get(leccion.cursoId) : undefined
    if (!leccion || !curso || !cuenta(r.user_id)) continue
    const nuevas = (preguntas ?? []).filter((q) => (q.parent_id === r.id || q.id === r.id) && cuenta(q.user_id))
    nuevas.forEach((q) => contar(q.user_id, q.via))
    hilos.push({
      clave: `C${hilos.length + 1}`,
      titulo: `Pregunta en «${leccion.titulo}»`,
      curso: curso.title,
      href: `/curso/${curso.slug}/${r.lesson_id}#comentario-${r.id}`,
      lineas: [
        `Alumno: ${r.content.slice(0, 500)}`,
        ...nuevas.filter((q) => q.id !== r.id).map((q) => `${quien(q.user_id, q.via)}: ${q.content.slice(0, 400)}`),
      ],
    })
  }
  cifras.conversaciones = hilos.length
  const fecha = hoyEnCdmx(ahora)

  let contenido: ContenidoDelResumen
  let llamoAlModelo = false
  if (hilos.length === 0) {
    contenido = { resumen: 'Ayer no hubo conversaciones nuevas en la comunidad.', temas: [], dudasFrecuentes: [], atencion: [], ideas: [], cifras, generadoEn: ahora.toISOString() }
  } else {
    const datos = [
      ...hilos.slice(0, MAX_HILOS).map((h) => `<hilo clave="${h.clave}" curso="${h.curso}">\n${anonimizar(h.lineas.join('\n')).slice(0, 1500)}\n</hilo>`),
      (ideas ?? []).length ? `<ideas>\n${(ideas ?? []).map((i) => `- (${i.tipo}) ${i.resumen}`).join('\n')}\n</ideas>` : '',
    ].join('\n\n')
    const r = await llamar({
      tarea: 'resumen',
      modelo: a.modelo_rapido,
      sistema: [{ texto: REGLAS_RESUMEN }],
      mensaje: datos,
      maxTokens: 1500,
      effort: 'low',
      esquema: ResumenEsquema,
    })
    llamoAlModelo = true
    if (!r.ok || !r.datos) {
      console.error(JSON.stringify({ operacion: 'agente:resumen', motivo: r.ok ? 'sin datos' : r.motivo }))
      return null
    }
    const porClave = new Map(hilos.map((h) => [h.clave, h]))
    contenido = {
      resumen: r.datos.resumen.slice(0, 1200),
      temas: r.datos.temas.slice(0, 6).map((t) => ({ tema: t.tema.slice(0, 80), conversaciones: Math.max(0, Math.round(t.conversaciones)) })),
      dudasFrecuentes: r.datos.dudas_frecuentes.slice(0, 5).map((d) => d.slice(0, 300)),
      atencion: r.datos.atencion
        .slice(0, 5)
        .flatMap((x) => {
          const h = porClave.get(x.clave.trim())
          return h ? [{ titulo: h.titulo, curso: h.curso, porQue: x.por_que.slice(0, 300), href: h.href }] : []
        }),
      ideas: r.datos.ideas.slice(0, 5).map((i) => i.slice(0, 300)),
      cifras,
      generadoEn: ahora.toISOString(),
    }
  }

  const { error } = await db.from('agent_digests').upsert({ fecha, es_qa: qa, contenido: contenido as unknown as Json }, { onConflict: 'fecha,es_qa' })
  if (error) console.error(JSON.stringify({ operacion: 'agente:resumen:guardar', error: error.message }))
  return { fecha, llamoAlModelo }
}
