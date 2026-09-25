import 'server-only'

import { cache } from 'react'

import { esEquipo, obtenerSesion, type Perfil } from '@/lib/auth/sesion'
import { crearClienteServidor } from '@/lib/supabase/server'
import type { Tabla } from '@/lib/supabase/types'

import {
  claveCelda,
  estaAbierta,
  estadoEfectivo,
  ponderadoDeColumna,
  type Escala,
  type EstadoDinamica,
  type FilaDinamica,
  type TableroParaPintar,
} from './comun'
import { obtenerTablero } from './tablero'

/**
 * Lecturas del ALUMNO para las dinámicas empresariales.
 *
 * Todo pasa por RLS con la sesión de quien pregunta: la policy de `dynamics`
 * ya esconde los borradores y la de `dynamic_boards` solo entrega el tablero
 * del que uno es miembro. Lo que sí decide el código es qué es "mío": igual
 * que en lib/alumno/consultas.ts, RLS dice qué se PUEDE leer y la consulta
 * dice qué es de quien pregunta (a alguien del equipo RLS le da todo).
 *
 * "Vigente" = has_active_access en TypeScript, desde las inscripciones
 * propias: la dinámica se ve con la inscripción (estructura) y se puntúa solo
 * con el acceso vivo (contenido). Es la misma pareja de helpers que en la base.
 */

export type TableroDeQuien = { tipo: 'empresa'; empresa: string } | { tipo: 'individual' }

export type DinamicaEnListaAlumno = {
  id: string
  titulo: string
  /** EFECTIVO: una abierta con fecha límite vencida llega como 'closed'. */
  estado: EstadoDinamica
  cursoId: string
  cursoTitulo: string
  cursoSlug: string
  /** Acceso vivo al curso. Con false se lee, no se puntúa. */
  vigente: boolean
  cierraEn: string | null
  cerroEn: string | null
  abiertaEn: string | null
  tablero: TableroDeQuien
  /** El tablero propio (de mi empresa o mío). Null si nadie lo ha abierto. */
  boardId: string | null
  /** Null mientras no exista tablero. */
  avance: { columnas: number; completas: number } | null
  /** El mejor ponderado completo, para las cerradas. */
  mejorPonderado: number | null
}

export type DinamicaParaAlumno = DinamicaEnListaAlumno & {
  descripcion: string | null
  escala: Escala
  linkRecompraMxn: string | null
  linkRecompraUsd: string | null
}

export type DinamicaParaCampana = {
  id: string
  titulo: string
  cursoTitulo: string
  abiertaEn: string
}

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>

type DinamicaConCurso = Tabla<'dynamics'> & {
  courses: {
    id: string
    title: string
    slug: string
    stripe_payment_link_mxn: string | null
    stripe_payment_link_usd: string | null
  } | null
}

type TableroPropio = {
  id: string
  dynamic_id: string
  company_id: string | null
  owner_user_id: string | null
}

type FilaCruda = {
  id: string
  dynamic_id: string
  row_kind: 'criterio' | 'informativa'
  label: string
  weight: number | null
  position: number
  created_at: string
}

const SELECT_CURSO =
  '*, courses(id, title, slug, stripe_payment_link_mxn, stripe_payment_link_usd)'

function registrarFallo(operacion: string, detalle: Record<string, unknown>, error: string) {
  console.error(JSON.stringify({ operacion, ...detalle, error }))
}

/** Curso → si el acceso sigue vivo, desde MIS inscripciones activas. */
async function vigenciaPorCurso(supabase: Cliente, userId: string): Promise<Map<string, boolean>> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('course_id, expires_at')
    .eq('user_id', userId)
    .eq('status', 'active')

  if (error) registrarFallo('vigenciaPorCurso', { userId }, error.message)

  const ahora = Date.now()
  const mapa = new Map<string, boolean>()
  for (const e of data ?? []) {
    const viva = !e.expires_at || new Date(e.expires_at).getTime() > ahora
    mapa.set(e.course_id, (mapa.get(e.course_id) ?? false) || viva)
  }
  return mapa
}

/**
 * MIS tableros: el de mi empresa, o los míos si no tengo empresa. Se filtra
 * explícito y no solo por RLS: al equipo RLS le devuelve los de todos.
 */
async function misTableros(
  supabase: Cliente,
  perfil: Perfil,
  dynamicId?: string
): Promise<TableroPropio[]> {
  let c = supabase.from('dynamic_boards').select('id, dynamic_id, company_id, owner_user_id')
  c = perfil.company_id
    ? c.eq('company_id', perfil.company_id)
    : c.eq('owner_user_id', perfil.user_id)
  if (dynamicId) c = c.eq('dynamic_id', dynamicId)

  const { data, error } = await c
  if (error) {
    registrarFallo('misTableros', { userId: perfil.user_id }, error.message)
    return []
  }
  return data ?? []
}

async function nombreDeEmpresa(supabase: Cliente, companyId: string | null): Promise<string | null> {
  if (!companyId) return null
  const { data } = await supabase.from('companies').select('name').eq('id', companyId).maybeSingle()
  return data?.name ?? null
}

function tableroDeQuien(perfil: Perfil, empresa: string | null): TableroDeQuien {
  return perfil.company_id ? { tipo: 'empresa', empresa: empresa ?? 'tu empresa' } : { tipo: 'individual' }
}

function aFila(f: FilaCruda): FilaDinamica {
  return {
    id: f.id,
    tipo: f.row_kind,
    etiqueta: f.label,
    peso: f.weight === null ? null : Number(f.weight),
    posicion: f.position,
  }
}

async function filasDe(supabase: Cliente, dynamicIds: string[]): Promise<FilaCruda[]> {
  if (dynamicIds.length === 0) return []
  const { data, error } = await supabase
    .from('dynamic_rows')
    .select('id, dynamic_id, row_kind, label, weight, position, created_at')
    .in('dynamic_id', dynamicIds)
    .order('position')
    .order('created_at')
  if (error) registrarFallo('filasDe', { cuantas: dynamicIds.length }, error.message)
  return data ?? []
}

async function columnasDe(
  supabase: Cliente,
  boardIds: string[]
): Promise<Array<{ id: string; board_id: string }>> {
  if (boardIds.length === 0) return []
  const { data, error } = await supabase
    .from('dynamic_columns')
    .select('id, board_id')
    .in('board_id', boardIds)
  if (error) registrarFallo('columnasDe', { cuantos: boardIds.length }, error.message)
  return data ?? []
}

async function celdasDe(
  supabase: Cliente,
  boardIds: string[]
): Promise<Array<{ board_id: string; column_id: string; row_id: string; numeric_value: number | null }>> {
  if (boardIds.length === 0) return []
  const { data, error } = await supabase
    .from('dynamic_cells')
    .select('board_id, column_id, row_id, numeric_value')
    .in('board_id', boardIds)
  if (error) registrarFallo('celdasDe', { cuantos: boardIds.length }, error.message)
  return data ?? []
}

/** Columnas del tablero → cuántas hay, cuántas están completas y el mejor ponderado. */
function resumirTablero(
  filas: FilaDinamica[],
  columnas: Array<{ id: string }>,
  celdas: ReadonlyMap<string, { numero: number | null }>
): { avance: { columnas: number; completas: number }; mejorPonderado: number | null } {
  let completas = 0
  let mejor: number | null = null
  for (const c of columnas) {
    const p = ponderadoDeColumna(filas, celdas, c.id)
    if (!p.completa || p.valor === null) continue
    completas += 1
    if (mejor === null || p.valor > mejor) mejor = p.valor
  }
  return { avance: { columnas: columnas.length, completas }, mejorPonderado: mejor }
}

function ordenarParaLista(lista: DinamicaEnListaAlumno[]): DinamicaEnListaAlumno[] {
  const tiempo = (iso: string | null, siNulo: number) => (iso ? new Date(iso).getTime() : siNulo)
  return [...lista].sort((a, b) => {
    if (a.estado !== b.estado) return a.estado === 'open' ? -1 : 1
    if (a.estado === 'open') {
      // La que cierra antes, primero; sin fecha límite, al final; luego la más nueva.
      return (
        tiempo(a.cierraEn, Infinity) - tiempo(b.cierraEn, Infinity) ||
        tiempo(b.abiertaEn, 0) - tiempo(a.abiertaEn, 0)
      )
    }
    return tiempo(b.cerroEn, 0) - tiempo(a.cerroEn, 0)
  })
}

/**
 * Las dinámicas que puedo ver, con el estado de MI tablero en cada una.
 *
 * Dos rondas de consultas: la primera trae dinámicas, vigencia, mis tableros
 * y mi empresa (independientes entre sí); la segunda, filas, columnas y celdas
 * de lo que salió en la primera. Nunca N+1.
 */
export async function misDinamicas(cursoId?: string): Promise<DinamicaEnListaAlumno[]> {
  const sesion = await obtenerSesion()
  if (sesion.tipo !== 'activo') return []
  const perfil = sesion.perfil
  const equipo = esEquipo(perfil)
  const supabase = await crearClienteServidor()

  // RLS ya esconde los borradores al alumno; el `neq` es para que al equipo,
  // en "Vista de alumno", tampoco le salgan: aquí se ve lo que ve el alumno.
  let filtro = supabase.from('dynamics').select(SELECT_CURSO).neq('status', 'draft')
  if (cursoId) filtro = filtro.eq('course_id', cursoId)

  const [dinamicas, vigencia, tableros, empresa] = await Promise.all([
    filtro.order('created_at', { ascending: false }),
    vigenciaPorCurso(supabase, perfil.user_id),
    misTableros(supabase, perfil),
    nombreDeEmpresa(supabase, perfil.company_id),
  ])

  if (dinamicas.error) {
    registrarFallo('misDinamicas', { cursoId: cursoId ?? null }, dinamicas.error.message)
    return []
  }

  const lista = (dinamicas.data ?? []) as unknown as DinamicaConCurso[]
  if (lista.length === 0) return []

  const idsDinamicas = new Set(lista.map((d) => d.id))
  const misBoards = tableros.filter((b) => idsDinamicas.has(b.dynamic_id))
  const idsBoards = misBoards.map((b) => b.id)

  const [filas, columnas, celdas] = await Promise.all([
    filasDe(supabase, [...idsDinamicas]),
    columnasDe(supabase, idsBoards),
    celdasDe(supabase, idsBoards),
  ])

  const filasPorDinamica = new Map<string, FilaDinamica[]>()
  for (const f of filas) {
    const lista = filasPorDinamica.get(f.dynamic_id) ?? []
    lista.push(aFila(f))
    filasPorDinamica.set(f.dynamic_id, lista)
  }

  const columnasPorTablero = new Map<string, Array<{ id: string }>>()
  for (const c of columnas) {
    const lista = columnasPorTablero.get(c.board_id) ?? []
    lista.push({ id: c.id })
    columnasPorTablero.set(c.board_id, lista)
  }

  const celdasPorTablero = new Map<string, Map<string, { numero: number | null }>>()
  for (const c of celdas) {
    const mapa = celdasPorTablero.get(c.board_id) ?? new Map<string, { numero: number | null }>()
    mapa.set(claveCelda(c.row_id, c.column_id), { numero: c.numeric_value })
    celdasPorTablero.set(c.board_id, mapa)
  }

  const deQuien = tableroDeQuien(perfil, empresa)

  const resultado = lista.map((d): DinamicaEnListaAlumno => {
    const board = misBoards.find((b) => b.dynamic_id === d.id) ?? null
    const estado = estadoEfectivo(d)
    const resumen = board
      ? resumirTablero(
          filasPorDinamica.get(d.id) ?? [],
          columnasPorTablero.get(board.id) ?? [],
          celdasPorTablero.get(board.id) ?? new Map()
        )
      : null

    return {
      id: d.id,
      titulo: d.title,
      estado,
      cursoId: d.course_id,
      cursoTitulo: d.courses?.title ?? 'Curso',
      cursoSlug: d.courses?.slug ?? '',
      vigente: equipo || (vigencia.get(d.course_id) ?? false),
      cierraEn: d.closes_at,
      cerroEn: d.closed_at ?? (estado === 'closed' ? d.closes_at : null),
      abiertaEn: d.opened_at,
      tablero: deQuien,
      boardId: board?.id ?? null,
      avance: resumen?.avance ?? null,
      mejorPonderado: resumen?.mejorPonderado ?? null,
    }
  })

  return ordenarParaLista(resultado)
}

/**
 * Una dinámica con MI tablero (el de mi empresa o el mío), para /dinamicas/[id].
 *
 * Memorizada por petición: la piden `generateMetadata` y la página.
 */
export const obtenerDinamicaParaAlumno = cache(async function obtenerDinamicaParaAlumno(
  id: string
): Promise<{ dinamica: DinamicaParaAlumno; tablero: TableroParaPintar | null } | null> {
  const sesion = await obtenerSesion()
  if (sesion.tipo !== 'activo') return null
  const perfil = sesion.perfil
  const supabase = await crearClienteServidor()

  const [dinamica, vigencia, tableros, empresa] = await Promise.all([
    supabase.from('dynamics').select(SELECT_CURSO).eq('id', id).maybeSingle(),
    vigenciaPorCurso(supabase, perfil.user_id),
    misTableros(supabase, perfil, id),
    nombreDeEmpresa(supabase, perfil.company_id),
  ])

  if (dinamica.error) {
    registrarFallo('obtenerDinamicaParaAlumno', { id }, dinamica.error.message)
    return null
  }

  const d = dinamica.data as unknown as DinamicaConCurso | null
  // Un borrador no existe para el alumno (RLS ya lo esconde; al equipo se le
  // manda al admin antes de llegar aquí).
  if (!d || d.status === 'draft') return null

  const board = tableros[0] ?? null
  const tablero = board ? await obtenerTablero(board.id) : null

  const estado = estadoEfectivo(d)
  const resumen = tablero
    ? resumirTablero(
        tablero.filas,
        tablero.columnas,
        new Map(tablero.celdas.map((c) => [claveCelda(c.filaId, c.columnaId), { numero: c.numero }]))
      )
    : null

  return {
    dinamica: {
      id: d.id,
      titulo: d.title,
      descripcion: d.description,
      estado,
      escala: { min: d.scale_min, max: d.scale_max },
      cursoId: d.course_id,
      cursoTitulo: d.courses?.title ?? 'Curso',
      cursoSlug: d.courses?.slug ?? '',
      vigente: esEquipo(perfil) || (vigencia.get(d.course_id) ?? false),
      cierraEn: d.closes_at,
      cerroEn: d.closed_at ?? (estado === 'closed' ? d.closes_at : null),
      abiertaEn: d.opened_at,
      tablero: tableroDeQuien(perfil, empresa),
      boardId: board?.id ?? null,
      avance: resumen?.avance ?? null,
      mejorPonderado: resumen?.mejorPonderado ?? null,
      linkRecompraMxn: d.courses?.stripe_payment_link_mxn ?? null,
      linkRecompraUsd: d.courses?.stripe_payment_link_usd ?? null,
    },
    tablero,
  }
})

/** Para la insignia de la pestaña del curso: abiertas de verdad, hoy. */
export async function contarDinamicasAbiertas(cursoId: string): Promise<number> {
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('dynamics')
    .select('id, status, closes_at')
    .eq('course_id', cursoId)
    .eq('status', 'open')

  if (error) {
    registrarFallo('contarDinamicasAbiertas', { cursoId }, error.message)
    return 0
  }
  return (data ?? []).filter((d) => estaAbierta(d)).length
}

/**
 * Las abiertas que le tocan a quien pregunta, para la campana.
 *
 * RLS ya acota a los cursos donde está inscrito. Al equipo le salen todas las
 * abiertas de la academia en "Vista de alumno": aceptado en el plan.
 */
export async function dinamicasAbiertasParaCampana(): Promise<DinamicaParaCampana[]> {
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('dynamics')
    .select('id, title, status, closes_at, opened_at, courses(title)')
    .eq('status', 'open')
    .order('opened_at', { ascending: false })

  if (error) {
    registrarFallo('dinamicasAbiertasParaCampana', {}, error.message)
    return []
  }

  type Fila = {
    id: string
    title: string
    status: string
    closes_at: string | null
    opened_at: string | null
    courses: { title: string } | null
  }

  return ((data ?? []) as unknown as Fila[]).flatMap((d) =>
    d.opened_at && estaAbierta(d)
      ? [{ id: d.id, titulo: d.title, cursoTitulo: d.courses?.title ?? 'Curso', abiertaEn: d.opened_at }]
      : []
  )
}
