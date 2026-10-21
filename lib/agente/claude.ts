import 'server-only'

import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { z } from 'zod'

import type { LlamadaRpc } from '@/lib/alumno/catalogo'
import { costoReal, LIMITE_DE_ENTRADA, peorCaso, tokensEstimados, type Uso } from '@/lib/agente/costos'
import { dbDelAgente } from '@/lib/agente/servidor'

/**
 * Las llamadas a Claude del agente (M21), todas por aquí.
 *
 * Cada llamada:
 *   1. estima su peor caso y lo RESERVA contra el tope del mes
 *      (`academia_agente_reservar`, con candado en la base). Si no cabe, no se
 *      llama: el agente se pausa solo y lo dice en el panel;
 *   2. llama con un reintento a lo más (`maxRetries: 1`);
 *   3. cierra la corrida con lo que costó de verdad (o con lo reservado si la
 *      conexión se cortó y no sabemos si se cobró).
 *
 * `ANTHROPIC_SIMULADO` (solo para la suite) manda todo a un Claude falso en
 * localhost con una llave falsa, y pone al agente en modo QA: sus ajustes, su
 * cola y su gasto son los de la fila `es_qa = true`.
 */

export type Tarea = 'responder' | 'escalar' | 'resumen' | 'noticias' | 'probador' | 'noticias_redactar' | 'noticia_liga'

export function esModoQa(): boolean {
  return Boolean(process.env.ANTHROPIC_SIMULADO)
}

export function claudeConfigurado(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_SIMULADO)
}

function cliente(): Anthropic {
  const simulado = process.env.ANTHROPIC_SIMULADO
  if (simulado) {
    const url = new URL(simulado)
    if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      throw new Error('ANTHROPIC_SIMULADO solo puede apuntar a localhost.')
    }
    return new Anthropic({ apiKey: 'sk-ant-simulado', baseURL: simulado, maxRetries: 0, timeout: 20_000 })
  }
  const llave = process.env.ANTHROPIC_API_KEY
  if (!llave) throw new Error('Falta ANTHROPIC_API_KEY (ver docs/M21.md).')
  return new Anthropic({ apiKey: llave, maxRetries: 1, timeout: 90_000 })
}

export type Bloque = { texto: string; cache?: boolean }

export type Llamada<T> = {
  tarea: Tarea
  modelo: string
  sistema: Bloque[]
  mensaje: string
  maxTokens: number
  effort: 'low' | 'medium'
  /** Con esquema la salida es JSON validado; sin él, texto. */
  esquema?: z.ZodType<T>
  /** Búsqueda web. Sin `dominios`, busca en toda la web. */
  busqueda?: { maxUsos: number; dominios?: string[] }
  jobId?: string | null
  /** La búsqueda de noticias a la que pertenece la corrida (M24). */
  huntId?: string | null
}

/** Una página que devolvió la búsqueda web: la única fuente de ligas válida (M24). */
export type FuenteDeBusqueda = { url: string; titulo: string; edad: string | null }

/**
 * Lo que pesa, por lo alto, lo que regresa cada búsqueda web: sus resultados
 * entran como tokens de entrada y se cobran. M21 no los reservaba (M24).
 */
const TOKENS_POR_BUSQUEDA = 15_000

export type Resultado<T> =
  | {
      ok: true
      datos: T | null
      texto: string
      runId: string
      costo: number
      rechazo: boolean
      corte: boolean
      busquedas: number
      fuentes: FuenteDeBusqueda[]
    }
  | { ok: false; motivo: 'sin_presupuesto' | 'sin_llave' | 'muy_largo' | 'error'; detalle?: string }

function registrar(operacion: string, detalle: Record<string, unknown>) {
  console.error(JSON.stringify({ operacion, ...detalle }))
}

/** Saca el primer objeto JSON de un texto (las noticias vienen como texto con búsqueda web). */
export function primerJson(texto: string): unknown {
  const inicio = texto.indexOf('{')
  const fin = texto.lastIndexOf('}')
  if (inicio < 0 || fin <= inicio) return null
  try {
    return JSON.parse(texto.slice(inicio, fin + 1))
  } catch {
    return null
  }
}

export async function llamar<T>(l: Llamada<T>): Promise<Resultado<T>> {
  if (!claudeConfigurado()) return { ok: false, motivo: 'sin_llave' }
  const qa = esModoQa()
  const tokens = tokensEstimados(l.sistema.map((b) => b.texto).join('\n') + l.mensaje) + 800
  if (tokens > LIMITE_DE_ENTRADA) return { ok: false, motivo: 'muy_largo', detalle: `${tokens} tokens estimados` }

  const db = dbDelAgente()
  const rpc = (db.rpc as unknown as LlamadaRpc).bind(db)
  const usos = l.busqueda?.maxUsos ?? 0
  const reserva = peorCaso(l.modelo, tokens + usos * TOKENS_POR_BUSQUEDA, l.maxTokens, usos)
  const { data: runId, error: errorReserva } = await rpc('academia_agente_reservar', {
    p_monto: Number(reserva.toFixed(6)),
    p_tarea: l.tarea,
    p_modelo: l.modelo,
    p_job: l.jobId ?? null,
    p_qa: qa,
  })
  if (errorReserva) {
    registrar('agente:reservar', { tarea: l.tarea, error: errorReserva.message })
    return { ok: false, motivo: 'error', detalle: 'No se pudo reservar el gasto.' }
  }
  if (typeof runId !== 'string') return { ok: false, motivo: 'sin_presupuesto' }

  const cerrar = async (costo: number, uso: Uso | null, extra: { decision?: string; motivo?: string } = {}) => {
    const { error } = await db
      .from('agent_runs')
      .update({
        estado: 'cerrada',
        costo_usd: Number(costo.toFixed(6)),
        tokens_entrada: uso?.input_tokens ?? 0,
        tokens_salida: uso?.output_tokens ?? 0,
        tokens_cache_lectura: uso?.cache_read_input_tokens ?? 0,
        tokens_cache_escritura: uso?.cache_creation_input_tokens ?? 0,
        busquedas: uso?.server_tool_use?.web_search_requests ?? 0,
        ...(l.huntId ? { news_hunt_id: l.huntId } : {}),
        ...extra,
      })
      .eq('id', runId)
    if (error) registrar('agente:cerrar', { runId, error: error.message })
  }

  // Haiku 5.5 acepta apagar el razonamiento; Sonnet 5.5 no (400): ahí
  // `between_tools` lo apaga salvo entre herramientas.
  const thinking = l.modelo.includes('haiku') ? ({ type: 'disabled' } as const) : ({ type: 'between_tools' } as const)
  const sistema = l.sistema.map((b) => ({
    type: 'text' as const,
    text: b.texto,
    ...(b.cache ? { cache_control: { type: 'ephemeral' as const, ttl: '1h' as const } } : {}),
  }))

  try {
    const respuesta = await cliente().messages.create({
      model: l.modelo,
      max_tokens: l.maxTokens,
      system: sistema,
      messages: [{ role: 'user', content: l.mensaje }],
      thinking,
      output_config: l.esquema ? { effort: l.effort, format: zodOutputFormat(l.esquema) } : { effort: l.effort },
      ...(l.busqueda
        ? {
            tools: [
              {
                type: 'web_search_20260209' as const,
                name: 'web_search' as const,
                max_uses: l.busqueda.maxUsos,
                ...(l.busqueda.dominios?.length ? { allowed_domains: l.busqueda.dominios } : {}),
              },
            ],
          }
        : {}),
    })

    const uso = respuesta.usage as Uso
    const costo = costoReal(l.modelo, uso)
    const texto = respuesta.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
    const rechazo = respuesta.stop_reason === 'refusal'
    // `pause_turn`: el servidor cortó el ciclo de herramientas a la mitad. No es
    // una respuesta terminada; se trata como cortada (M24).
    const corte = respuesta.stop_reason === 'max_tokens' || respuesta.stop_reason === 'pause_turn'
    const fuentes: FuenteDeBusqueda[] = []
    for (const bloque of respuesta.content) {
      if (bloque.type !== 'web_search_tool_result' || !Array.isArray(bloque.content)) continue
      for (const r of bloque.content) fuentes.push({ url: r.url, titulo: r.title, edad: r.page_age ?? null })
    }

    let datos: T | null = null
    if (l.esquema && !rechazo && !corte) {
      const crudo = primerJson(texto)
      const r = l.esquema.safeParse(crudo)
      if (r.success) datos = r.data
      else registrar('agente:salida-invalida', { tarea: l.tarea, runId, problema: r.error.issues[0]?.message })
    }

    await cerrar(costo, uso, rechazo ? { motivo: 'El modelo se negó a contestar.' } : corte ? { motivo: 'Se cortó por max_tokens.' } : {})
    return {
      ok: true,
      datos,
      texto,
      runId,
      costo,
      rechazo,
      corte,
      busquedas: uso.server_tool_use?.web_search_requests ?? 0,
      fuentes,
    }
  } catch (e) {
    // Rechazada por la API (4xx/5xx): no se cobró. Conexión cortada o tiempo
    // agotado: no sabemos, y se cuenta lo reservado para no pasarse del tope.
    const rechazadaPorApi = e instanceof Anthropic.APIError && typeof e.status === 'number'
    await cerrar(rechazadaPorApi ? 0 : reserva, null, { motivo: e instanceof Error ? e.message.slice(0, 300) : 'error' })
    registrar('agente:llamada', { tarea: l.tarea, modelo: l.modelo, runId, error: e instanceof Error ? e.message : String(e) })
    return { ok: false, motivo: 'error', detalle: e instanceof Error ? e.message : String(e) }
  }
}

/** Anota en la corrida qué decidió el modelo (para el panel). */
export async function anotarDecision(runId: string, decision: string, certeza: number | null, motivo: string | null): Promise<void> {
  const { error } = await dbDelAgente()
    .from('agent_runs')
    .update({ decision, certeza: certeza === null ? null : Number(certeza.toFixed(2)), motivo: motivo?.slice(0, 500) ?? null })
    .eq('id', runId)
  if (error) registrar('agente:anotar', { runId, error: error.message })
}
