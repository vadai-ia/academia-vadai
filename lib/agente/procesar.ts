import 'server-only'

import { z } from 'zod'

import type { LlamadaRpc } from '@/lib/alumno/catalogo'
import { ajustesDelAgente, vozDe, type AjustesAgente } from '@/lib/agente/ajustes'
import { anotarDecision, claudeConfigurado, llamar, type Tarea } from '@/lib/agente/claude'
import { encolarNuevos } from '@/lib/agente/cola'
import { AYUDA_DE_LA_PLATAFORMA, contextoDelCurso, type Enlace } from '@/lib/agente/conocimiento'
import { REGLAS } from '@/lib/agente/prompt'
import { cuentaDelBot, publicarRespuesta } from '@/lib/agente/publicar'
import { dbDelAgente, type ClienteAgente } from '@/lib/agente/servidor'
import { anonimizar, problemasDeLaRespuesta, textoPlanoDeModelo } from '@/lib/agente/validar'
import { esRolDeEquipo } from '@/lib/auth/roles'
import { textoPlano } from '@/lib/comunidad/documento'
import type { Database } from '@/lib/supabase/types'

/**
 * El agente de la comunidad, una corrida (M21). La llama el cron cada 5
 * minutos:
 *
 *   1. encola lo nuevo (lib/agente/cola.ts);
 *   2. toma hasta POR_CORRIDA trabajos que ya tocan, de forma atómica;
 *   3. por cada uno: carga el hilo y revisa que siga teniendo sentido
 *      contestar (visible, el último mensaje es del alumno y es este, el
 *      agente no lleva ya dos respuestas);
 *   4. Haiku decide con salida estructurada; si la duda es compleja o la
 *      certeza queda cerca del umbral, Sonnet decide UNA vez más;
 *   5. publica solo si el modo es automático, la certeza pasa el umbral y la
 *      respuesta no trae ligas, precios, fechas ni correos inventados; vuelve
 *      a revisar el hilo justo antes. Lo demás queda en borrador para el
 *      equipo, con su motivo.
 */

const POR_CORRIDA = 6
const MAX_TOKENS_RAPIDO = 1200
const MAX_TOKENS_FUERTE = 1500
/** Cuánto antes del umbral vale la pena preguntarle al modelo fuerte. */
const MARGEN_PARA_ESCALAR = 0.25

export const DecisionEsquema = z.object({
  accion: z.enum(['responder', 'borrador', 'ignorar']),
  certeza: z.number(),
  complejidad: z.enum(['baja', 'media', 'alta']),
  respuesta: z.string(),
  enlaces: z.array(z.string()),
  motivo: z.string(),
  ideas: z.array(z.object({ tipo: z.enum(['idea', 'peticion', 'queja', 'duda_frecuente', 'elogio']), resumen: z.string() })),
  temas: z.array(z.string()),
})
export type Decision = z.infer<typeof DecisionEsquema>

type Trabajo = Database['academia']['Tables']['agent_jobs']['Row']

type Mensaje = { id: string; autorId: string; quien: 'alumno' | 'equipo' | 'agente'; texto: string; creadoEn: string }

export type HiloCargado = {
  tipo: 'muro' | 'leccion'
  hiloId: string
  curso: { id: string; slug: string; titulo: string }
  cohortId: string | null
  lugar: string
  visible: boolean
  /** Solo los visibles, en orden; el primero es el que abrió el hilo. */
  mensajes: Mensaje[]
}

function registrar(operacion: string, detalle: Record<string, unknown>) {
  console.error(JSON.stringify({ operacion, ...detalle }))
}

const base = () => (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '')

// ==========================================================================
// El hilo
// ==========================================================================

export async function cargarHilo(db: ClienteAgente, tipoOrigen: Trabajo['tipo_origen'], hiloId: string): Promise<HiloCargado | null> {
  type Crudo = { id: string; user_id: string; texto: string; created_at: string; via: string }
  let crudos: Crudo[] = []
  let cursoId: string
  let cohortId: string | null
  let visible: boolean
  let lugar: (curso: string) => string

  if (tipoOrigen === 'leccion') {
    const { data: raiz } = await db
      .from('lesson_comments')
      .select('id, lesson_id, user_id, content, status, created_at, via')
      .eq('id', hiloId)
      .maybeSingle()
    if (!raiz) return null
    const [{ data: respuestas }, { data: leccion }] = await Promise.all([
      db
        .from('lesson_comments')
        .select('id, user_id, content, created_at, via')
        .eq('parent_id', raiz.id)
        .eq('status', 'visible')
        .order('created_at'),
      db.from('lessons').select('title, module_id').eq('id', raiz.lesson_id).maybeSingle(),
    ])
    if (!leccion) return null
    const { data: modulo } = await db.from('modules').select('title, course_id, cohort_id').eq('id', leccion.module_id).maybeSingle()
    if (!modulo) return null
    cursoId = modulo.course_id
    cohortId = modulo.cohort_id
    visible = raiz.status === 'visible'
    crudos = [
      { id: raiz.id, user_id: raiz.user_id, texto: raiz.content, created_at: raiz.created_at, via: raiz.via },
      ...(respuestas ?? []).map((r) => ({ id: r.id, user_id: r.user_id, texto: r.content, created_at: r.created_at, via: r.via })),
    ]
    lugar = (curso) => `Pregunta en la lección «${leccion.title}» (módulo «${modulo.title}») del curso «${curso}»`
  } else {
    const { data: post } = await db
      .from('community_posts')
      .select('id, course_id, cohort_id, user_id, title, content_rich, status, created_at, via')
      .eq('id', hiloId)
      .maybeSingle()
    if (!post) return null
    const { data: comentarios } = await db
      .from('community_comments')
      .select('id, user_id, content, created_at, via')
      .eq('post_id', post.id)
      .eq('status', 'visible')
      .order('created_at')
    cursoId = post.course_id
    cohortId = post.cohort_id
    visible = post.status === 'visible'
    const cuerpo = textoPlano(post.content_rich).trim()
    crudos = [
      { id: post.id, user_id: post.user_id, texto: cuerpo ? `${post.title}\n${cuerpo}` : post.title, created_at: post.created_at, via: post.via },
      ...(comentarios ?? []).map((c) => ({ id: c.id, user_id: c.user_id, texto: c.content, created_at: c.created_at, via: c.via })),
    ]
    lugar = (curso) => `Publicación en el muro del curso «${curso}»`
  }

  const [{ data: curso }, { data: perfiles }] = await Promise.all([
    db.from('courses').select('id, slug, title').eq('id', cursoId).maybeSingle(),
    db
      .from('profiles')
      .select('user_id, role, es_bot')
      .in('user_id', [...new Set(crudos.map((c) => c.user_id))]),
  ])
  if (!curso) return null
  const perfil = new Map((perfiles ?? []).map((p) => [p.user_id, p]))

  return {
    tipo: tipoOrigen === 'leccion' ? 'leccion' : 'muro',
    hiloId,
    curso: { id: curso.id, slug: curso.slug, titulo: curso.title },
    cohortId,
    lugar: lugar(curso.title),
    visible,
    mensajes: crudos.map((c) => {
      const p = perfil.get(c.user_id)
      const quien: Mensaje['quien'] =
        p?.es_bot && (c.via === 'agente' || c.via === 'agente_revisado') ? 'agente' : p && esRolDeEquipo(p.role) ? 'equipo' : 'alumno'
      return { id: c.id, autorId: c.user_id, quien, texto: c.texto, creadoEn: c.created_at }
    }),
  }
}

/** Por qué ya no se contesta este trabajo; null si sí. */
export function porQueNo(h: HiloCargado, origenId: string): string | null {
  if (!h.visible) return 'El hilo se ocultó o se borró.'
  if (!h.mensajes.some((m) => m.id === origenId)) return 'El mensaje se ocultó o se borró.'
  const ultimo = h.mensajes[h.mensajes.length - 1]
  if (!ultimo || ultimo.quien !== 'alumno') return 'Ya contestó el equipo.'
  if (ultimo.id !== origenId) return 'Hay un mensaje más nuevo en el hilo: se contesta ese.'
  if (h.mensajes.filter((m) => m.quien === 'agente').length >= 2) return 'Ya van dos respuestas del agente en este hilo.'
  return null
}

/** La conversación como la ve el modelo: sin nombres, sin correos ni teléfonos. */
export function conversacionParaModelo(h: HiloCargado): string {
  const abre = h.mensajes[0]
  const ultimos = h.mensajes.length > 12 ? [abre, ...h.mensajes.slice(-11)] : h.mensajes
  const lineas = ultimos.filter(Boolean).map((m, i) => {
    const quien =
      m!.quien === 'alumno' ? (m!.autorId === abre?.autorId ? 'Alumno (abrió el hilo)' : 'Otro alumno') : 'Equipo VADAI'
    return `[${i + 1}] ${quien}:\n${anonimizar(m!.texto).slice(0, 2000)}`
  })
  return `<lugar>${h.lugar}</lugar>\n<conversacion>\n${lineas.join('\n\n')}\n</conversacion>\nDecide qué hacer con el último mensaje ([${lineas.length}]).`
}

// ==========================================================================
// Decidir
// ==========================================================================

export type Decidido =
  | {
      tipo: 'ok'
      decision: Decision
      modelo: string
      escalado: boolean
      costo: number
      /** La respuesta lista para publicar, con las ligas del mapa al final. */
      texto: string
      enlaces: Enlace[]
      problemas: string[]
      fuentes: string[]
    }
  | { tipo: 'sin_respuesta'; costo: number; motivo: string }
  | { tipo: 'sin_presupuesto'; costo: number }
  | { tipo: 'error'; costo: number; detalle: string }

export async function decidir(
  db: ClienteAgente,
  a: AjustesAgente,
  entrada: { curso: HiloCargado['curso']; cohortId: string | null; conversacion: string; jobId: string | null; tarea?: Tarea }
): Promise<Decidido> {
  const ctx = await contextoDelCurso(db, entrada.curso, entrada.cohortId, entrada.conversacion)
  const sistema = [
    { texto: `${REGLAS}\n\n<voz>\n${vozDe(a)}\n</voz>\n\n<ayuda>\n${AYUDA_DE_LA_PLATAFORMA}\n</ayuda>`, cache: true },
    {
      texto: `<mapa>\n${ctx.mapa}\n</mapa>\n\n<conocimiento>\n${ctx.conocimiento || '(No hay material sobre este tema: si la respuesta no está en la ayuda, deja borrador.)'}\n</conocimiento>`,
    },
  ]

  let costo = 0
  const intento = async (modelo: string, tarea: Tarea, maxTokens: number) => {
    const r = await llamar({ tarea, modelo, sistema, mensaje: entrada.conversacion, maxTokens, effort: 'low', esquema: DecisionEsquema, jobId: entrada.jobId })
    if (r.ok) costo += r.costo
    return r
  }

  const primera = await intento(a.modelo_rapido, entrada.tarea ?? 'responder', MAX_TOKENS_RAPIDO)
  if (!primera.ok) {
    return primera.motivo === 'sin_presupuesto'
      ? { tipo: 'sin_presupuesto', costo }
      : { tipo: 'error', costo, detalle: primera.detalle ?? primera.motivo }
  }
  if (!primera.datos) {
    return { tipo: 'sin_respuesta', costo, motivo: primera.rechazo ? 'El modelo no quiso contestar.' : 'El modelo no devolvió una decisión válida.' }
  }

  let decision = normalizar(primera.datos)
  let modelo = a.modelo_rapido
  let escalado = false
  await anotarDecision(primera.runId, decision.accion, decision.certeza, decision.motivo)

  const cerca = decision.certeza >= Number(a.umbral) - MARGEN_PARA_ESCALAR && decision.certeza < Number(a.umbral)
  if (decision.accion === 'responder' && (decision.complejidad === 'alta' || cerca) && a.modelo_fuerte && a.modelo_fuerte !== a.modelo_rapido) {
    const segunda = await intento(a.modelo_fuerte, entrada.tarea === 'probador' ? 'probador' : 'escalar', MAX_TOKENS_FUERTE)
    if (segunda.ok && segunda.datos) {
      decision = normalizar(segunda.datos)
      modelo = a.modelo_fuerte
      escalado = true
      await anotarDecision(segunda.runId, decision.accion, decision.certeza, decision.motivo)
    }
  }

  const respuesta = textoPlanoDeModelo(decision.respuesta)
  const problemas = decision.accion === 'ignorar' ? [] : problemasDeLaRespuesta(respuesta)
  const enlaces = [...new Set(decision.enlaces)]
    .map((k) => ctx.enlaces.get(k.trim()))
    .filter((e): e is Enlace => Boolean(e))
    .slice(0, 3)
  if (decision.enlaces.some((k) => !ctx.enlaces.has(k.trim()))) problemas.push('citó una clave que no está en el mapa')
  const ligas = enlaces.map((e) => `${e.titulo}: ${base()}${e.ruta}`).join('\n')
  const texto = respuesta && ligas ? `${respuesta}\n\n${ligas}` : respuesta

  return { tipo: 'ok', decision, modelo, escalado, costo, texto, enlaces, problemas, fuentes: ctx.fuentes }
}

function normalizar(d: Decision): Decision {
  return {
    ...d,
    certeza: Math.min(1, Math.max(0, Number.isFinite(d.certeza) ? d.certeza : 0)),
    respuesta: d.respuesta.slice(0, 1200),
    motivo: d.motivo.slice(0, 400),
    ideas: d.ideas.slice(0, 3).map((i) => ({ ...i, resumen: i.resumen.slice(0, 300) })),
    temas: d.temas.slice(0, 3),
  }
}

// ==========================================================================
// Una corrida
// ==========================================================================

type Desenlace = 'hecho' | 'borrador' | 'omitido' | 'reintento' | 'fallido'

export type ResumenDeCorrida = {
  estado: 'listo' | 'apagado' | 'sin_llave' | 'sin_ajustes'
  encolados: number
  desenlaces: Record<Desenlace, number>
  /** Borradores que se retiraron porque el equipo ya contestó el hilo. */
  retirados?: number
}

export async function correrAgente(ahora = new Date()): Promise<ResumenDeCorrida> {
  const desenlaces: Record<Desenlace, number> = { hecho: 0, borrador: 0, omitido: 0, reintento: 0, fallido: 0 }
  const a = await ajustesDelAgente()
  if (!a) return { estado: 'sin_ajustes', encolados: 0, desenlaces }
  if (a.modo === 'apagado') return { estado: 'apagado', encolados: 0, desenlaces }
  if (!claudeConfigurado()) return { estado: 'sin_llave', encolados: 0, desenlaces }

  const db = dbDelAgente()
  const rpc = (db.rpc as unknown as LlamadaRpc).bind(db)

  // Pausado por el tope: se quita solo cuando ya cabe (cambió el mes o subieron el tope).
  if (a.pausado_por_tope) {
    const { data: gastado } = await rpc('academia_agente_gastado', { p_qa: a.es_qa })
    if (gastado !== null && Number(gastado) < Number(a.tope_usd) * 0.98) {
      await db.from('agent_settings').update({ pausado_por_tope: false }).eq('es_qa', a.es_qa)
      a.pausado_por_tope = false
    }
  }

  const encolados = await encolarNuevos(db, a, ahora)
  const { data: tomados, error } = await rpc('academia_agente_tomar', { p_n: POR_CORRIDA, p_qa: a.es_qa })
  if (error) registrar('agente:tomar', { error: error.message })
  const trabajos = (Array.isArray(tomados) ? tomados : []) as Trabajo[]
  const botId = trabajos.length ? await cuentaDelBot(db) : null

  for (const t of trabajos) {
    let desenlace: Desenlace
    try {
      desenlace = await procesarTrabajo(db, a, t, botId)
    } catch (e) {
      registrar('agente:trabajo', { job: t.id, error: e instanceof Error ? e.message : String(e) })
      desenlace = await cerrarTrabajo(db, t, 'reintento', 'Falló al procesar.')
    }
    desenlaces[desenlace]++
  }
  const retirados = await retirarBorradoresResueltos(db, a)
  return { estado: 'listo', encolados, desenlaces, retirados }
}

/**
 * Un borrador deja de hacer falta si el equipo contestó el hilo por su cuenta
 * (desde la bandeja, por ejemplo) o el hilo se ocultó: se retira solo, para
 * que la pestaña Agente y la campana no pidan revisar lo ya atendido.
 */
async function retirarBorradoresResueltos(db: ClienteAgente, a: AjustesAgente): Promise<number> {
  const { data } = await db
    .from('agent_drafts')
    .select('id, tipo_origen, hilo_id, motivo')
    .eq('es_qa', a.es_qa)
    .eq('estado', 'pendiente')
    .eq('tipo', 'respuesta')
    .limit(100)
  let n = 0
  for (const b of data ?? []) {
    if (!b.hilo_id || !b.tipo_origen) continue
    const h = await cargarHilo(db, b.tipo_origen, b.hilo_id)
    const ultimo = h?.mensajes[h.mensajes.length - 1]
    const porque = !h || !h.visible ? 'el hilo se ocultó o se borró' : ultimo && ultimo.quien !== 'alumno' ? 'el equipo ya contestó' : null
    if (!porque) continue
    const { error } = await db
      .from('agent_drafts')
      .update({ estado: 'descartado', revisado_en: new Date().toISOString(), motivo: `${b.motivo ?? ''} Ya no hace falta: ${porque}.`.trim().slice(0, 1000) })
      .eq('id', b.id)
      .eq('estado', 'pendiente')
    if (error) registrar('agente:retirar', { borrador: b.id, error: error.message })
    else n++
  }
  return n
}

async function cerrarTrabajo(db: ClienteAgente, t: Trabajo, desenlace: Desenlace, resultado: string): Promise<Desenlace> {
  let estado: Trabajo['estado']
  let final = desenlace
  if (desenlace === 'reintento') {
    if (t.intentos >= 3) {
      estado = 'fallido'
      final = 'fallido'
    } else estado = 'pendiente'
  } else estado = desenlace === 'fallido' ? 'fallido' : desenlace
  const { error } = await db
    .from('agent_jobs')
    .update({
      estado,
      resultado: resultado.slice(0, 500),
      bloqueado_hasta: null,
      updated_at: new Date().toISOString(),
      ...(estado === 'pendiente' ? { toca_en: new Date(Date.now() + 15 * 60_000).toISOString() } : {}),
    })
    .eq('id', t.id)
  if (error) registrar('agente:cerrarTrabajo', { job: t.id, error: error.message })
  return final
}

async function procesarTrabajo(db: ClienteAgente, a: AjustesAgente, t: Trabajo, botId: string | null): Promise<Desenlace> {
  const hilo = await cargarHilo(db, t.tipo_origen, t.hilo_id)
  if (!hilo) return cerrarTrabajo(db, t, 'omitido', 'El hilo ya no existe.')
  const razon = porQueNo(hilo, t.origen_id)
  if (razon) return cerrarTrabajo(db, t, 'omitido', razon)
  if (a.pausado_por_tope) return cerrarTrabajo(db, t, 'omitido', 'Se llegó al tope de gasto del mes: lo atiende el equipo.')

  const d = await decidir(db, a, { curso: hilo.curso, cohortId: hilo.cohortId, conversacion: conversacionParaModelo(hilo), jobId: t.id })

  if (d.tipo === 'sin_presupuesto') return cerrarTrabajo(db, t, 'omitido', 'Se llegó al tope de gasto del mes: lo atiende el equipo.')
  if (d.tipo === 'error') return cerrarTrabajo(db, t, 'reintento', `Falló la llamada: ${d.detalle}`)
  if (d.tipo === 'sin_respuesta') {
    await guardarBorrador(db, a, t, { texto: '', certeza: null, motivo: `${d.motivo} Contéstalo tú.`, fuente: null })
    return cerrarTrabajo(db, t, 'borrador', d.motivo)
  }

  await guardarIdeas(db, a, t, d.decision)
  if (d.decision.accion === 'ignorar') return cerrarTrabajo(db, t, 'omitido', `No había nada que contestar: ${d.decision.motivo}`)

  const umbral = Number(a.umbral)
  const motivos: string[] = []
  if (a.modo !== 'automatico') motivos.push('El agente está en modo borradores.')
  if (d.decision.accion === 'borrador') motivos.push(d.decision.motivo || 'El modelo prefirió que lo viera una persona.')
  if (d.decision.accion === 'responder' && d.decision.certeza < umbral) motivos.push(`Certeza ${d.decision.certeza.toFixed(2)}, debajo del umbral ${umbral.toFixed(2)}.`)
  if (d.problemas.length) motivos.push(`La respuesta ${d.problemas.join(', ')}.`)
  if (!d.texto) motivos.push('No propuso texto.')
  if (!botId) motivos.push('Falta la cuenta «Equipo VADAI».')

  if (motivos.length === 0 && botId) {
    // Justo antes de publicar: ¿sigue teniendo sentido? (el equipo pudo contestar
    // mientras el modelo pensaba, o alguien apagó el agente).
    const [ahora, ajustes] = await Promise.all([cargarHilo(db, t.tipo_origen, t.hilo_id), ajustesDelAgente(a.es_qa)])
    const ultimaRazon = !ahora ? 'El hilo ya no existe.' : porQueNo(ahora, t.origen_id)
    if (ultimaRazon) return cerrarTrabajo(db, t, 'omitido', ultimaRazon)
    if (ajustes?.modo !== 'automatico' || ajustes.pausado_por_tope) {
      motivos.push('El agente dejó de estar en automático.')
    } else {
      const r = await publicarRespuesta(db, { tipoOrigen: t.tipo_origen, hiloId: t.hilo_id, texto: d.texto, via: 'agente', jobId: t.id, botId })
      if ('id' in r) return cerrarTrabajo(db, t, 'hecho', `Contestó (${d.modelo}${d.escalado ? ', escalado' : ''}, certeza ${d.decision.certeza.toFixed(2)}).`)
      motivos.push(r.error)
    }
  }

  await guardarBorrador(db, a, t, {
    texto: d.texto,
    certeza: d.decision.certeza,
    motivo: motivos.join(' '),
    fuente: d.fuentes.slice(0, 5).join(' · ') || null,
  })
  return cerrarTrabajo(db, t, 'borrador', motivos.join(' '))
}

async function guardarBorrador(
  db: ClienteAgente,
  a: AjustesAgente,
  t: Trabajo,
  b: { texto: string; certeza: number | null; motivo: string; fuente: string | null }
): Promise<void> {
  const { error } = await db.from('agent_drafts').insert({
    tipo: 'respuesta',
    es_qa: a.es_qa,
    job_id: t.id,
    course_id: t.course_id,
    tipo_origen: t.tipo_origen,
    hilo_id: t.hilo_id,
    texto: b.texto.slice(0, 10000),
    certeza: b.certeza === null ? null : Number(b.certeza.toFixed(2)),
    motivo: b.motivo.slice(0, 1000),
    fuente: b.fuente,
  })
  if (error) registrar('agente:borrador', { job: t.id, error: error.message })
}

async function guardarIdeas(db: ClienteAgente, a: AjustesAgente, t: Trabajo, d: Decision): Promise<void> {
  const ideas = d.ideas.filter((i) => i.resumen.trim().length >= 3)
  if (ideas.length === 0) return
  const { error } = await db.from('community_insights').insert(
    ideas.map((i) => ({ tipo: i.tipo, resumen: i.resumen.trim(), es_qa: a.es_qa, course_id: t.course_id, hilo_id: t.hilo_id }))
  )
  if (error) registrar('agente:ideas', { job: t.id, error: error.message })
}
