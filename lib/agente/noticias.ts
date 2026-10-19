import 'server-only'

import { z } from 'zod'

import { ajustesDelAgente } from '@/lib/agente/ajustes'
import { esModoQa, llamar, primerJson } from '@/lib/agente/claude'
import { DOMINIOS_DE_NOTICIAS, REGLAS_NOTICIAS } from '@/lib/agente/prompt'
import { dbDelAgente, type ClienteAgente } from '@/lib/agente/servidor'

/**
 * Las noticias del día (M21): cada mañana Sonnet busca en la web, solo en los
 * dominios de DOMINIOS_DE_NOTICIAS, y deja de 1 a 3 noticias EN BORRADOR, con
 * su fuente. Una persona las publica con un clic en el tema «Noticias» del
 * muro de V-AI-P (pestaña Agente). Nada de internet se publica solo.
 *
 * Corre solo si en Ajustes están encendidas las noticias Y la búsqueda web
 * (la búsqueda va apagada por defecto). El agente de la suite deja sus
 * borradores en la casa del plan `qa-agente`, nunca en la de V-AI-P.
 */

const NoticiasEsquema = z.object({
  noticias: z.array(z.object({ titulo: z.string(), texto: z.string(), fuente: z.string() })),
})

const MAX_BUSQUEDAS = 5

export function planDeNoticias(): string {
  return esModoQa() ? 'qa-agente' : 'v-ai-p'
}

/** La casa del plan de noticias: donde se publican. */
export async function casaDeNoticias(db: ClienteAgente): Promise<{ id: string; slug: string } | null> {
  const { data: plan } = await db.from('membership_plans').select('hub_course_id').eq('slug', planDeNoticias()).maybeSingle()
  if (!plan?.hub_course_id) return null
  const { data: curso } = await db.from('courses').select('id, slug').eq('id', plan.hub_course_id).maybeSingle()
  return curso
}

function fuentePermitida(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return false
    return DOMINIOS_DE_NOTICIAS.some((d) => u.hostname === d || u.hostname.endsWith(`.${d}`))
  } catch {
    return false
  }
}

export async function prepararNoticias(): Promise<{ borradores: number } | null> {
  const a = await ajustesDelAgente()
  if (!a || a.modo === 'apagado' || !a.noticias || !a.busqueda_web) return null
  const db = dbDelAgente()
  const casa = await casaDeNoticias(db)
  if (!casa) {
    console.error(JSON.stringify({ operacion: 'agente:noticias', error: `El plan ${planDeNoticias()} no tiene casa.` }))
    return null
  }

  // Lo que ya salió o espera en la última semana, para no repetir.
  const hace7 = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString()
  const { data: recientes } = await db
    .from('agent_drafts')
    .select('titulo')
    .eq('tipo', 'noticia')
    .eq('es_qa', a.es_qa)
    .neq('estado', 'descartado')
    .gte('created_at', hace7)
  const yaSalieron = (recientes ?? []).map((r) => r.titulo).filter(Boolean)

  const hoy = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'full' }).format(new Date())
  const r = await llamar({
    tarea: 'noticias',
    modelo: a.modelo_fuerte,
    sistema: [{ texto: REGLAS_NOTICIAS }],
    mensaje: `Hoy es ${hoy}.${yaSalieron.length ? `\n\nEstas ya se publicaron o están en borrador, no las repitas:\n${yaSalieron.map((t) => `- ${t}`).join('\n')}` : ''}`,
    maxTokens: 2500,
    effort: 'medium',
    busqueda: { maxUsos: MAX_BUSQUEDAS, dominios: DOMINIOS_DE_NOTICIAS },
  })
  if (!r.ok) {
    console.error(JSON.stringify({ operacion: 'agente:noticias', motivo: r.motivo, detalle: r.detalle }))
    return null
  }
  const lectura = NoticiasEsquema.safeParse(primerJson(r.texto))
  if (!lectura.success) {
    console.error(JSON.stringify({ operacion: 'agente:noticias', motivo: 'salida inválida' }))
    return { borradores: 0 }
  }

  const filas = lectura.data.noticias
    .filter((n) => n.titulo.trim() && n.texto.trim() && fuentePermitida(n.fuente))
    .slice(0, 3)
    .map((n) => ({
      tipo: 'noticia' as const,
      es_qa: a.es_qa,
      course_id: casa.id,
      titulo: n.titulo.trim().slice(0, 160),
      texto: n.texto.trim().slice(0, 2000),
      fuente: n.fuente,
      motivo: `Preparada con búsqueda web (${r.busquedas} búsquedas).`,
    }))
  if (filas.length === 0) return { borradores: 0 }
  const { error } = await db.from('agent_drafts').insert(filas)
  if (error) {
    console.error(JSON.stringify({ operacion: 'agente:noticias:guardar', error: error.message }))
    return { borradores: 0 }
  }
  return { borradores: filas.length }
}
