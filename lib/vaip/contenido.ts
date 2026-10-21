import 'server-only'

import { cache } from 'react'

import { contenidoDeLeccion, type ContenidoDeLeccion } from '@/lib/alumno/consultas'
import { BUCKET_DEL_MURO } from '@/lib/comunidad/imagenes'
import type { ContextoVaip } from '@/lib/membresia/espacio'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * Lo que ve un miembro de V-AI-P por dentro (M26, 21-oct-2026): las clases
 * grabadas, un mes por módulo, y las herramientas, videos cortos con etiquetas.
 *
 * Las dos son lecciones de la casa y se leen con la sesión de quien mira: RLS
 * solo entrega las publicadas de una casa donde tiene acceso vigente. Al
 * equipo RLS le da también los borradores, así que aquí se pide `published`
 * de forma explícita: en el portal el equipo ve lo mismo que un miembro.
 */

export type GrabacionEnLista = {
  id: string
  titulo: string
  /** El día de la clase, `YYYY-MM-DD`. */
  fecha: string
  duracionSeg: number | null
  vista: boolean
  materiales: number
  publicadaEn: string | null
}

export type MesDeGrabaciones = {
  id: string
  /** El día 1 del mes, `YYYY-MM-DD`. */
  mes: string
  titulo: string
  grabaciones: GrabacionEnLista[]
}

export type EtiquetaDeHerramienta = { id: string; slug: string; nombre: string }

export type HerramientaEnLista = {
  id: string
  titulo: string
  orientacion: 'horizontal' | 'vertical'
  /** La portada dibujada (URL pública de `academia-media`); null mientras no hay. */
  portada: string | null
  duracionSeg: number | null
  etiquetas: EtiquetaDeHerramienta[]
  vista: boolean
  publicadaEn: string | null
}

type Lugar = { casaId: string; generacionId: string; userId: string }

/** La casa y la generación desde donde se lee; null si quien mira todavía no tiene grupo. */
function lugarDe(ctx: ContextoVaip): Lugar | null {
  const casa = ctx.casa
  if (!casa || casa.sinGeneracion || !casa.generacion) return null
  return { casaId: casa.id, generacionId: casa.generacion.id, userId: ctx.perfil.user_id }
}

async function vistas(userId: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const supabase = await crearClienteServidor()
  // Con user_id: al equipo RLS le devuelve el avance de todos.
  const { data } = await supabase
    .from('lesson_progress')
    .select('lesson_id')
    .eq('user_id', userId)
    .eq('completed', true)
    .in('lesson_id', ids)
  return new Set((data ?? []).map((p) => p.lesson_id))
}

// ==========================================================================
// Clases grabadas
// ==========================================================================

/** Todas las grabaciones publicadas, por mes, del más nuevo al más viejo. Memorizado por petición. */
export const grabacionesDeVaip = cache(async (ctx: ContextoVaip): Promise<MesDeGrabaciones[]> => {
  const lugar = lugarDe(ctx)
  if (!lugar) return []
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('lessons')
    .select(
      'id, title, recorded_on, video_duration_sec, published_at, modules!inner(id, title, month, kind, course_id, cohort_id), lesson_attachments(count)'
    )
    .eq('status', 'published')
    .eq('modules.course_id', lugar.casaId)
    .eq('modules.cohort_id', lugar.generacionId)
    .eq('modules.kind', 'mes')
    .order('recorded_on', { ascending: false })
  if (error) {
    console.error(JSON.stringify({ operacion: 'grabacionesDeVaip', casa: lugar.casaId, error: error.message }))
    return []
  }

  type Fila = {
    id: string
    title: string
    recorded_on: string | null
    video_duration_sec: number | null
    published_at: string | null
    modules: { id: string; title: string; month: string | null }
    lesson_attachments: Array<{ count: number }>
  }
  const filas = (data ?? []) as unknown as Fila[]
  const vistasMias = await vistas(lugar.userId, filas.map((f) => f.id))

  const porMes = new Map<string, MesDeGrabaciones>()
  for (const f of filas) {
    if (!f.recorded_on || !f.modules.month) continue
    const mes = porMes.get(f.modules.id) ?? { id: f.modules.id, mes: f.modules.month, titulo: f.modules.title, grabaciones: [] }
    mes.grabaciones.push({
      id: f.id,
      titulo: f.title,
      fecha: f.recorded_on,
      duracionSeg: f.video_duration_sec,
      vista: vistasMias.has(f.id),
      materiales: f.lesson_attachments?.[0]?.count ?? 0,
      publicadaEn: f.published_at,
    })
    porMes.set(f.modules.id, mes)
  }
  return [...porMes.values()].sort((a, b) => b.mes.localeCompare(a.mes))
})

export type GrabacionDeVaip = {
  leccion: ContenidoDeLeccion
  fecha: string
  mes: MesDeGrabaciones
  /** La clase de antes y la de después, por fecha. */
  anterior: GrabacionEnLista | null
  siguiente: GrabacionEnLista | null
}

/**
 * Una grabación con su mes y sus vecinas. null si no es una grabación
 * publicada de ESTA casa (o quien mira no tiene acceso): la página regresa a
 * Clases.
 */
export async function grabacionDeVaip(ctx: ContextoVaip, leccionId: string): Promise<GrabacionDeVaip | null> {
  const [meses, leccion] = await Promise.all([grabacionesDeVaip(ctx), contenidoDeLeccion(leccionId)])
  if (!leccion || leccion.tipoDeModulo !== 'mes') return null
  const mes = meses.find((m) => m.grabaciones.some((g) => g.id === leccionId))
  if (!mes) return null
  // La lista va de la más nueva a la más vieja: la «anterior» es la que sigue.
  const todas = meses.flatMap((m) => m.grabaciones)
  const i = todas.findIndex((g) => g.id === leccionId)
  const actual = todas[i]
  if (!actual) return null
  return {
    leccion,
    fecha: actual.fecha,
    mes,
    anterior: todas[i + 1] ?? null,
    siguiente: i > 0 ? (todas[i - 1] ?? null) : null,
  }
}

// ==========================================================================
// Herramientas
// ==========================================================================

/** Las etiquetas activas de la casa, en su orden. */
async function etiquetasDeLaCasa(casaId: string): Promise<EtiquetaDeHerramienta[]> {
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('tool_tags')
    .select('id, slug, name')
    .eq('course_id', casaId)
    .eq('archived', false)
    .order('position')
    .order('name')
  return (data ?? []).map((t) => ({ id: t.id, slug: t.slug, nombre: t.name }))
}

export type HerramientasDeVaip = {
  /** Las herramientas publicadas, de la más nueva a la más vieja. */
  todas: HerramientaEnLista[]
  /** Solo las etiquetas que tienen al menos una herramienta, con cuántas. */
  etiquetas: Array<EtiquetaDeHerramienta & { cuantas: number }>
}

/** Memorizado por petición: lo piden la galería, el detalle y «Lo nuevo». */
export const herramientasDeVaip = cache(async (ctx: ContextoVaip): Promise<HerramientasDeVaip> => {
  const lugar = lugarDe(ctx)
  if (!lugar) return { todas: [], etiquetas: [] }
  const supabase = await crearClienteServidor()
  const [{ data, error }, etiquetas] = await Promise.all([
    supabase
      .from('lessons')
      .select(
        'id, title, orientation, cover_path, video_duration_sec, published_at, created_at, modules!inner(kind, course_id, cohort_id), lesson_tool_tags(tag_id)'
      )
      .eq('status', 'published')
      .eq('modules.course_id', lugar.casaId)
      .eq('modules.cohort_id', lugar.generacionId)
      .eq('modules.kind', 'herramientas')
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false }),
    etiquetasDeLaCasa(lugar.casaId),
  ])
  if (error) {
    console.error(JSON.stringify({ operacion: 'herramientasDeVaip', casa: lugar.casaId, error: error.message }))
    return { todas: [], etiquetas: [] }
  }

  type Fila = {
    id: string
    title: string
    orientation: string
    cover_path: string | null
    video_duration_sec: number | null
    published_at: string | null
    lesson_tool_tags: Array<{ tag_id: string }>
  }
  const filas = (data ?? []) as unknown as Fila[]
  const vistasMias = await vistas(lugar.userId, filas.map((f) => f.id))
  const publica = (ruta: string | null) =>
    ruta ? supabase.storage.from(BUCKET_DEL_MURO).getPublicUrl(ruta).data.publicUrl : null

  const todas: HerramientaEnLista[] = filas.map((f) => {
    const suyas = new Set((f.lesson_tool_tags ?? []).map((t) => t.tag_id))
    return {
      id: f.id,
      titulo: f.title,
      orientacion: f.orientation === 'horizontal' ? 'horizontal' : 'vertical',
      portada: publica(f.cover_path),
      duracionSeg: f.video_duration_sec,
      // En el orden de las etiquetas, no en el que se marcaron; las archivadas no salen.
      etiquetas: etiquetas.filter((e) => suyas.has(e.id)),
      vista: vistasMias.has(f.id),
      publicadaEn: f.published_at,
    }
  })

  return {
    todas,
    etiquetas: etiquetas
      .map((e) => ({ ...e, cuantas: todas.filter((h) => h.etiquetas.some((x) => x.id === e.id)).length }))
      .filter((e) => e.cuantas > 0),
  }
})

/** La galería con la etiqueta elegida (o todas). */
export function filtrarPorEtiqueta(datos: HerramientasDeVaip, etiqueta: string | null): HerramientaEnLista[] {
  if (!etiqueta) return datos.todas
  return datos.todas.filter((h) => h.etiquetas.some((e) => e.slug === etiqueta))
}

export type HerramientaDeVaip = {
  leccion: ContenidoDeLeccion
  herramienta: HerramientaEnLista
  /** La etiqueta por la que se navega, si la herramienta la tiene. */
  etiqueta: EtiquetaDeHerramienta | null
  anterior: HerramientaEnLista | null
  siguiente: HerramientaEnLista | null
  posicion: number
  total: number
}

/**
 * Una herramienta y sus vecinas DENTRO de la etiqueta por la que se llegó
 * (`?etiqueta=`): quien está viendo las de RH sigue en RH. Sin etiqueta, o si
 * la herramienta no la lleva, las vecinas son las de la galería completa.
 */
export async function herramientaDeVaip(
  ctx: ContextoVaip,
  leccionId: string,
  etiquetaPedida: string | null
): Promise<HerramientaDeVaip | null> {
  const [datos, leccion] = await Promise.all([herramientasDeVaip(ctx), contenidoDeLeccion(leccionId)])
  if (!leccion || leccion.tipoDeModulo !== 'herramientas') return null
  const herramienta = datos.todas.find((h) => h.id === leccionId)
  if (!herramienta) return null

  const etiqueta = herramienta.etiquetas.find((e) => e.slug === etiquetaPedida) ?? null
  const lista = filtrarPorEtiqueta(datos, etiqueta?.slug ?? null)
  const i = lista.findIndex((h) => h.id === leccionId)
  return {
    leccion,
    herramienta,
    etiqueta,
    // La galería va de la más nueva a la más vieja: «siguiente» baja por la lista.
    anterior: i > 0 ? (lista[i - 1] ?? null) : null,
    siguiente: lista[i + 1] ?? null,
    posicion: i + 1,
    total: lista.length,
  }
}

// ==========================================================================
// «Lo nuevo», arriba del muro
// ==========================================================================

export type LoNuevo = {
  grabacion: GrabacionEnLista | null
  herramientas: HerramientaEnLista[]
  /** Cuántas herramientas salieron en la semana (pueden ser más de las que se pintan). */
  herramientasDeLaSemana: number
}

const DIA = 24 * 60 * 60 * 1000

/**
 * Lo que salió hace poco: la grabación más reciente (si se publicó en los
 * últimos 30 días) y hasta cuatro herramientas de los últimos siete. La
 * próxima clase la pone la página, que ya la tiene.
 */
export async function loNuevoDeVaip(ctx: ContextoVaip, ahora = Date.now()): Promise<LoNuevo> {
  const [meses, datos] = await Promise.all([grabacionesDeVaip(ctx), herramientasDeVaip(ctx)])
  const reciente = (iso: string | null, dias: number) => iso !== null && ahora - new Date(iso).getTime() <= dias * DIA
  const grabacion =
    meses
      .flatMap((m) => m.grabaciones)
      .filter((g) => reciente(g.publicadaEn, 30))
      .sort((a, b) => b.fecha.localeCompare(a.fecha))[0] ?? null
  const deLaSemana = datos.todas.filter((h) => reciente(h.publicadaEn, 7))
  return { grabacion, herramientas: deLaSemana.slice(0, 4), herramientasDeLaSemana: deLaSemana.length }
}
