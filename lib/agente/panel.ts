import 'server-only'

import { cache } from 'react'

import { hilosPorId, HORAS_DEL_AGENTE, type Hilo } from '@/lib/admin/comunidad'
import { claudeConfigurado } from '@/lib/agente/claude'
import type { ContenidoDelResumen } from '@/lib/agente/resumen'
import { esAdmin, exigirEquipo } from '@/lib/auth/sesion'
import { esCuentaQa, esCursoQa } from '@/lib/qa'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * Lo que el panel enseña del agente (M21). Con la sesión de quien mira: el
 * equipo lee borradores, ideas, resumen y cola por RLS; el gasto (`agent_runs`)
 * solo lo devuelve la base a un admin.
 *
 * Una cuenta real ve lo del agente real; una cuenta QA, lo de la suite
 * (`es_qa`), como en el resto del panel.
 */

export type BorradorDelPanel = {
  id: string
  tipo: 'respuesta' | 'noticia'
  curso: string | null
  titulo: string | null
  texto: string
  fuente: string | null
  certeza: number | null
  motivo: string | null
  creadoEn: string
  /** El hilo al que contesta, con lo último que escribió el alumno. */
  hilo: Hilo | null
}

/**
 * Una idea, con las veces que salió: el agente anota la misma petición cada
 * vez que alguien la hace, y en el panel se ve una vez con su cuenta.
 */
export type IdeaDelPanel = { ids: string[]; tipo: string; resumen: string; cursos: string[]; veces: number; ultimaVez: string }

export type GastoDelMes = { gastado: number; tope: number; llamadas: number; porTarea: Array<{ tarea: string; costo: number; llamadas: number }> }

export type TableroDelAgente = {
  esAdmin: boolean
  configurado: boolean
  ajustes: { modo: 'apagado' | 'borradores' | 'automatico'; pausado: boolean; noticias: boolean; busquedaWeb: boolean; tope: number; umbral: number } | null
  borradores: BorradorDelPanel[]
  ideas: IdeaDelPanel[]
  resumen: (ContenidoDelResumen & { fecha: string }) | null
  semana: { contestadas: number; borradores: number; omitidos: number; fallidos: number }
  contestadas48h: number
  gasto: GastoDelMes | null
}

/** El primer instante del mes en la Ciudad de México. */
export function inicioDelMesEnCdmx(ahora = new Date()): string {
  const [anio, mes] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit' })
    .format(ahora)
    .split('-')
  return new Date(`${anio}-${mes}-01T06:00:00Z`).toISOString()
}

/** Para la campana: cuántos borradores esperan a una persona. */
export const borradoresPendientes = cache(async (): Promise<number> => {
  const perfil = await exigirEquipo()
  const supabase = await crearClienteServidor()
  const { count } = await supabase
    .from('agent_drafts')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'pendiente')
    .eq('es_qa', esCuentaQa(perfil.email))
  return count ?? 0
})

/** Para el resumen del portal V-AI-P: borradores que esperan e ideas de la semana sin atender. */
export async function pendientesDelAgente(): Promise<{ borradores: number; ideas: number }> {
  const perfil = await exigirEquipo()
  const supabase = await crearClienteServidor()
  const hace7 = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString()
  const [borradores, { count }] = await Promise.all([
    borradoresPendientes(),
    supabase
      .from('community_insights')
      .select('id', { count: 'exact', head: true })
      .eq('es_qa', esCuentaQa(perfil.email))
      .eq('atendida', false)
      .gte('created_at', hace7),
  ])
  return { borradores, ideas: count ?? 0 }
}

export async function gastoDelMes(qa: boolean): Promise<GastoDelMes | null> {
  const supabase = await crearClienteServidor()
  const [{ data: ajustes }, { data: corridas, error }] = await Promise.all([
    supabase.from('agent_settings').select('tope_usd').eq('es_qa', qa).maybeSingle(),
    supabase
      .from('agent_runs')
      .select('tarea, estado, costo_usd, reservado_usd')
      .eq('es_qa', qa)
      .gte('created_at', inicioDelMesEnCdmx())
      .limit(20000),
  ])
  if (error || !ajustes) return null
  const porTarea = new Map<string, { costo: number; llamadas: number }>()
  let gastado = 0
  for (const c of corridas ?? []) {
    const costo = Number(c.estado === 'cerrada' ? c.costo_usd : c.reservado_usd)
    gastado += costo
    const t = porTarea.get(c.tarea) ?? { costo: 0, llamadas: 0 }
    t.costo += costo
    t.llamadas++
    porTarea.set(c.tarea, t)
  }
  return {
    gastado,
    tope: Number(ajustes.tope_usd),
    llamadas: (corridas ?? []).length,
    porTarea: [...porTarea.entries()].map(([tarea, v]) => ({ tarea, ...v })).sort((a, b) => b.costo - a.costo),
  }
}

function agruparIdeas(filas: Array<{ id: string; tipo: string; resumen: string; curso: string; creadoEn: string }>): IdeaDelPanel[] {
  const llave = (tipo: string, t: string) =>
    `${tipo}|${t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9ñ]+/g, ' ').trim()}`
  const grupos = new Map<string, IdeaDelPanel>()
  for (const f of filas) {
    const k = llave(f.tipo, f.resumen)
    const g = grupos.get(k)
    if (!g) {
      grupos.set(k, { ids: [f.id], tipo: f.tipo, resumen: f.resumen, cursos: [f.curso], veces: 1, ultimaVez: f.creadoEn })
      continue
    }
    g.ids.push(f.id)
    g.veces++
    if (!g.cursos.includes(f.curso)) g.cursos.push(f.curso)
    if (f.creadoEn > g.ultimaVez) g.ultimaVez = f.creadoEn
  }
  return [...grupos.values()].sort((a, b) => b.veces - a.veces || b.ultimaVez.localeCompare(a.ultimaVez))
}

export async function tableroDelAgente(): Promise<TableroDelAgente> {
  const perfil = await exigirEquipo()
  const admin = esAdmin(perfil)
  const qa = esCuentaQa(perfil.email)
  const supabase = await crearClienteServidor()
  const hace7 = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString()
  const hace30 = new Date(Date.now() - 30 * 24 * 3_600_000).toISOString()
  const hace48 = new Date(Date.now() - HORAS_DEL_AGENTE * 3_600_000).toISOString()

  const [ajustes, borradores, ideas, resumen, trabajos, cursos, contestadas] = await Promise.all([
    supabase.from('agent_settings').select('modo, pausado_por_tope, noticias, busqueda_web, tope_usd, umbral').eq('es_qa', qa).maybeSingle(),
    supabase
      .from('agent_drafts')
      .select('id, tipo, course_id, hilo_id, titulo, texto, fuente, certeza, motivo, created_at')
      .eq('estado', 'pendiente')
      .eq('es_qa', qa)
      .order('created_at', { ascending: true })
      .limit(50),
    supabase
      .from('community_insights')
      .select('id, tipo, resumen, course_id, created_at')
      .eq('es_qa', qa)
      .eq('atendida', false)
      .gte('created_at', hace30)
      .order('created_at', { ascending: false })
      .limit(60),
    supabase.from('agent_digests').select('fecha, contenido').eq('es_qa', qa).order('fecha', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('agent_jobs').select('estado').eq('es_qa', qa).gte('updated_at', hace7).limit(5000),
    supabase.from('courses').select('id, title, slug'),
    supabase.from('agent_jobs').select('id', { count: 'exact', head: true }).eq('es_qa', qa).eq('estado', 'hecho').gte('updated_at', hace48),
  ])

  const tituloDeCurso = new Map((cursos.data ?? []).filter((c) => esCursoQa(c.slug) === qa).map((c) => [c.id, c.title]))
  const hilos = await hilosPorId((borradores.data ?? []).map((b) => b.hilo_id).filter((h): h is string => Boolean(h)))

  const semana = { contestadas: 0, borradores: 0, omitidos: 0, fallidos: 0 }
  for (const t of trabajos.data ?? []) {
    if (t.estado === 'hecho') semana.contestadas++
    else if (t.estado === 'borrador') semana.borradores++
    else if (t.estado === 'omitido') semana.omitidos++
    else if (t.estado === 'fallido') semana.fallidos++
  }

  return {
    esAdmin: admin,
    configurado: claudeConfigurado(),
    ajustes: ajustes.data
      ? {
          modo: ajustes.data.modo,
          pausado: ajustes.data.pausado_por_tope,
          noticias: ajustes.data.noticias,
          busquedaWeb: ajustes.data.busqueda_web,
          tope: Number(ajustes.data.tope_usd),
          umbral: Number(ajustes.data.umbral),
        }
      : null,
    borradores: (borradores.data ?? []).map((b) => ({
      id: b.id,
      tipo: b.tipo,
      curso: b.course_id ? (tituloDeCurso.get(b.course_id) ?? null) : null,
      titulo: b.titulo,
      texto: b.texto,
      fuente: b.fuente,
      certeza: b.certeza === null ? null : Number(b.certeza),
      motivo: b.motivo,
      creadoEn: b.created_at,
      hilo: b.hilo_id ? (hilos.get(b.hilo_id) ?? null) : null,
    })),
    ideas: agruparIdeas(
      (ideas.data ?? []).map((i) => ({
        id: i.id,
        tipo: i.tipo,
        resumen: i.resumen,
        curso: i.course_id ? (tituloDeCurso.get(i.course_id) ?? 'Academia') : 'Academia',
        creadoEn: i.created_at,
      }))
    ),
    resumen: resumen.data ? { ...(resumen.data.contenido as unknown as ContenidoDelResumen), fecha: resumen.data.fecha } : null,
    semana,
    contestadas48h: contestadas.count ?? 0,
    gasto: admin ? await gastoDelMes(qa) : null,
  }
}
