import 'server-only'

import { esModoQa } from '@/lib/agente/claude'
import { dbDelAgente } from '@/lib/agente/servidor'
import { casaDeNoticias, urlDelMuro, type Casa } from '@/lib/noticias/casa'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * Lo que leen las pestañas Noticias y Publicar del panel de V-AI-P (M24).
 * Con la sesión de quien mira (la RLS deja al equipo ver búsquedas,
 * propuestas y el muro); solo la casa se resuelve con el cliente del agente,
 * porque el plan puede estar en borrador y el community manager no lo ve.
 */

export type Busqueda = {
  id: string
  tipo: 'caceria' | 'liga'
  estado: 'buscando' | 'lista' | 'sin_resultados' | 'fallida'
  paso: string | null
  detalle: string | null
  urlPedida: string | null
  iniciada: string
  terminada: string | null
  descartes: Record<string, number>
  /** Lo que costó (solo lo ve el admin: `agent_runs` es de admin). */
  costo: number | null
}

export type Propuesta = {
  id: string
  titulo: string
  resumen: string
  texto: string
  url: string
  medio: string | null
  tipoFuente: 'articulo' | 'video'
  publicadoEnFuente: string | null
  notas: string | null
  creada: string
  origen: 'caceria' | 'liga'
}

export type Historial = {
  id: string
  titulo: string
  estado: 'publicada' | 'descartada'
  revisada: string | null
  urlDelMuro: string | null
}

export type TableroDeNoticias = {
  casa: Casa | null
  busquedaEnCurso: Busqueda | null
  ultima: Busqueda | null
  propuestas: Propuesta[]
  historial: Historial[]
  hoy: { cacerias: number; ligas: number }
}

const inicioDelDiaEnCdmx = () => {
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  // CDMX no cambia de horario desde 2022: el día empieza a las 06:00 UTC.
  return new Date(`${dia}T06:00:00Z`).toISOString()
}

function contarDescartes(crudo: unknown): Record<string, number> {
  const cuenta: Record<string, number> = {}
  if (!Array.isArray(crudo)) return cuenta
  for (const d of crudo) {
    const motivo = typeof d === 'object' && d && 'motivo' in d ? String((d as { motivo: unknown }).motivo) : 'otro'
    cuenta[motivo] = (cuenta[motivo] ?? 0) + 1
  }
  return cuenta
}

export async function tableroDeNoticias(busquedaId: string | null): Promise<TableroDeNoticias> {
  const qa = esModoQa()
  const supabase = await crearClienteServidor()
  const casa = await casaDeNoticias(dbDelAgente())

  const [{ data: busquedas }, { data: propuestas }, { data: historial }, { data: hoy }] = await Promise.all([
    supabase
      .from('news_hunts')
      .select('id, tipo, estado, paso, detalle, url_pedida, started_at, finished_at, descartes')
      .eq('es_qa', qa)
      .order('started_at', { ascending: false })
      .limit(10),
    supabase
      .from('news_items')
      .select('id, titulo, resumen, texto, url, medio, tipo_fuente, publicado_en_fuente, notas, created_at, hunt_id, orden')
      .eq('es_qa', qa)
      .eq('estado', 'propuesta')
      .order('created_at', { ascending: false })
      .order('orden', { ascending: true })
      .limit(30),
    supabase
      .from('news_items')
      .select('id, titulo, estado, revisado_en, post_id')
      .eq('es_qa', qa)
      .in('estado', ['publicada', 'descartada'])
      .order('revisado_en', { ascending: false, nullsFirst: false })
      .limit(15),
    supabase.from('news_hunts').select('tipo, estado').eq('es_qa', qa).gte('started_at', inicioDelDiaEnCdmx()),
  ])

  const ids = (busquedas ?? []).map((b) => b.id)
  const { data: corridas } = ids.length
    ? await supabase.from('agent_runs').select('news_hunt_id, costo_usd, reservado_usd, estado').in('news_hunt_id', ids)
    : { data: [] }
  const costoDe = (id: string) => {
    const suyas = (corridas ?? []).filter((c) => c.news_hunt_id === id)
    return suyas.length ? suyas.reduce((s, c) => s + Number(c.estado === 'cerrada' ? c.costo_usd : c.reservado_usd), 0) : null
  }
  const aBusqueda = (b: NonNullable<typeof busquedas>[number]): Busqueda => ({
    id: b.id,
    tipo: b.tipo as Busqueda['tipo'],
    estado: b.estado as Busqueda['estado'],
    paso: b.paso,
    detalle: b.detalle,
    urlPedida: b.url_pedida,
    iniciada: b.started_at,
    terminada: b.finished_at,
    descartes: contarDescartes(b.descartes),
    costo: costoDe(b.id),
  })

  const todas = (busquedas ?? []).map(aBusqueda)
  const enCurso = todas.find((b) => b.estado === 'buscando') ?? null
  const pedida = busquedaId ? (todas.find((b) => b.id === busquedaId) ?? null) : null
  const tipoDe = new Map(todas.map((b) => [b.id, b.tipo]))

  return {
    casa,
    busquedaEnCurso: enCurso,
    ultima: pedida ?? todas[0] ?? null,
    propuestas: (propuestas ?? []).map((p) => ({
      id: p.id,
      titulo: p.titulo,
      resumen: p.resumen,
      texto: p.texto,
      url: p.url,
      medio: p.medio,
      tipoFuente: p.tipo_fuente as Propuesta['tipoFuente'],
      publicadoEnFuente: p.publicado_en_fuente,
      notas: p.notas,
      creada: p.created_at,
      origen: (p.hunt_id ? tipoDe.get(p.hunt_id) : null) ?? 'caceria',
    })),
    historial: (historial ?? []).map((h) => ({
      id: h.id,
      titulo: h.titulo,
      estado: h.estado as Historial['estado'],
      revisada: h.revisado_en,
      urlDelMuro: h.post_id && casa ? urlDelMuro(casa, 'noticias', h.post_id) : null,
    })),
    hoy: {
      cacerias: (hoy ?? []).filter((h) => h.tipo === 'caceria' && h.estado !== 'fallida').length,
      ligas: (hoy ?? []).filter((h) => h.tipo === 'liga' && h.estado !== 'fallida').length,
    },
  }
}

// ==========================================================================
// Publicar: temas y lo que publicó el equipo
// ==========================================================================

export type Tema = { slug: string; nombre: string; soloEquipo: boolean }

export type PublicacionDelEquipo = {
  id: string
  titulo: string
  tema: string | null
  autor: string
  fijada: boolean
  fijadaHasta: string | null
  visible: boolean
  creada: string
  comentarios: number
  url: string
}

export async function paraPublicar(): Promise<{ casa: Casa | null; temas: Tema[]; publicaciones: PublicacionDelEquipo[] }> {
  const casa = await casaDeNoticias(dbDelAgente())
  if (!casa) return { casa: null, temas: [], publicaciones: [] }
  const supabase = await crearClienteServidor()

  const [{ data: temas }, { data: posts }] = await Promise.all([
    supabase.from('community_topics').select('id, slug, name, solo_equipo').eq('course_id', casa.id).eq('archived', false).order('position'),
    supabase
      .from('community_posts')
      .select('id, title, topic_id, user_id, pinned, pinned_until, status, created_at')
      .eq('course_id', casa.id)
      .neq('status', 'deleted')
      .order('created_at', { ascending: false })
      .limit(60),
  ])
  const autores = [...new Set((posts ?? []).map((p) => p.user_id))]
  const { data: perfiles } = autores.length
    ? await supabase.from('profiles').select('user_id, full_name, email, role, es_bot').in('user_id', autores)
    : { data: [] }
  const delEquipo = new Map(
    (perfiles ?? [])
      .filter((p) => p.es_bot || ['admin', 'superadmin', 'community_manager'].includes(p.role))
      .map((p) => [p.user_id, p.full_name || p.email])
  )
  const deEquipo = (posts ?? []).filter((p) => delEquipo.has(p.user_id)).slice(0, 20)
  const ids = deEquipo.map((p) => p.id)
  const { data: comentarios } = ids.length
    ? await supabase.from('community_comments').select('post_id').in('post_id', ids).eq('status', 'visible')
    : { data: [] }
  const temaDe = new Map((temas ?? []).map((t) => [t.id, t]))
  const ahora = Date.now()

  return {
    casa,
    temas: (temas ?? []).map((t) => ({ slug: t.slug, nombre: t.name, soloEquipo: t.solo_equipo })),
    publicaciones: deEquipo.map((p) => {
      const tema = p.topic_id ? temaDe.get(p.topic_id) : undefined
      const vigente = p.pinned && (!p.pinned_until || Date.parse(p.pinned_until) > ahora)
      return {
        id: p.id,
        titulo: p.title,
        tema: tema?.name ?? null,
        autor: delEquipo.get(p.user_id) ?? 'Equipo VADAI',
        fijada: vigente,
        fijadaHasta: vigente ? p.pinned_until : null,
        visible: p.status === 'visible',
        creada: p.created_at,
        comentarios: (comentarios ?? []).filter((c) => c.post_id === p.id).length,
        url: urlDelMuro(casa, tema?.slug ?? null, p.id),
      }
    }),
  }
}
