import 'server-only'

import { cache } from 'react'

import { crearClienteServidor } from '@/lib/supabase/server'
import type { Tabla } from '@/lib/supabase/types'

import {
  claveCelda,
  contarCeldasDeCriterio,
  estadoEfectivo,
  ponderadoDeColumna,
  type EstadoDinamica,
  type FilaDinamica,
} from './comun'

/**
 * Lecturas del ADMIN para dinámicas empresariales (M13).
 *
 * Todas pasan por RLS con el cliente del usuario: las policies de 0028 ya le
 * dan al equipo lectura total, y así estas consultas respetan lo mismo que el
 * resto del panel. Las del alumno viven en `consultas-alumno.ts` y las del
 * tablero en `tablero.ts`.
 *
 * Selects PLANOS cruzados con `Map`, no anidados de PostgREST: `gen-types.mjs`
 * emite `Relationships: []`, así que un `dynamics(courses(title))` obliga a
 * tipar a mano con `as unknown as`. Con cinco tablas chicas es más barato
 * traer cada una y cruzar aquí (mismo criterio que lib/admin/alumnos.ts).
 */

export type Dinamica = Tabla<'dynamics'>

/**
 * Una fila con cuánto se está usando: es lo que el modal de borrar tiene que
 * decir ("se borran sus 14 calificaciones en 3 tableros").
 */
export type FilaConUso = FilaDinamica & {
  /** Calificaciones puestas en esta fila, sumando todos los tableros. */
  celdas: number
  /** En cuántos tableros distintos. */
  tableros: number
}

export type DinamicaCompleta = Dinamica & {
  curso: string
  cursoSlug: string
  cohorte: string | null
  filas: FilaConUso[]
  totalTableros: number
  /** Tableros con al menos un proyecto con todos los criterios calificados. */
  totalCompletos: number
  totalCeldas: number
  /** Una `open` con la fecha límite vencida llega como `closed`. */
  estadoEfectivo: EstadoDinamica
}

export type DinamicaEnLista = Dinamica & {
  curso: string
  cursoSlug: string
  cohorte: string | null
  totalCriterios: number
  totalTableros: number
  totalCompletos: number
  estadoEfectivo: EstadoDinamica
}

export type ResumenTablero = {
  id: string
  /** Null = tablero individual de alguien sin empresa (General). */
  empresa: string | null
  /** Quien lo abrió, cuando es individual. */
  dueno: string | null
  columnas: number
  /** Celdas de criterio con número. Las informativas no se "califican". */
  llenas: number
  /** columnas × criterios. */
  total: number
  mejor: { proyecto: string; valor: number } | null
  /** Quienes han creado un proyecto o puesto una calificación, sin repetir. */
  editores: string[]
  ultimaEdicion: string | null
}

export type EmpresaSinTablero = { id: string; nombre: string; alumnos: number }

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>

type FilaCruda = Pick<
  Tabla<'dynamic_rows'>,
  'id' | 'dynamic_id' | 'row_kind' | 'label' | 'weight' | 'position' | 'created_at'
>

type ColumnaCruda = Pick<
  Tabla<'dynamic_columns'>,
  'id' | 'board_id' | 'label' | 'position' | 'created_by' | 'created_at' | 'updated_at'
>

type CeldaCruda = Pick<
  Tabla<'dynamic_cells'>,
  'board_id' | 'column_id' | 'row_id' | 'numeric_value' | 'updated_by' | 'updated_at'
>

function registrarFallo(operacion: string, detalle: Record<string, unknown>, error: string) {
  console.error(JSON.stringify({ operacion, ...detalle, error }))
}

// --------------------------------------------------------------------------
// Piezas compartidas
// --------------------------------------------------------------------------

/** numeric(5,2) viaja como número en JSON, pero se normaliza por si acaso. */
function aFila(r: FilaCruda): FilaDinamica {
  return {
    id: r.id,
    tipo: r.row_kind,
    etiqueta: r.label,
    peso: r.weight === null ? null : Number(r.weight),
    posicion: r.position,
  }
}

/** Orden estable: position, y a igual position la más vieja primero. */
function ordenarFilas<T extends Pick<FilaCruda, 'position' | 'created_at' | 'id'>>(filas: T[]): T[] {
  return [...filas].sort(
    (a, b) =>
      a.position - b.position ||
      a.created_at.localeCompare(b.created_at) ||
      a.id.localeCompare(b.id)
  )
}

function ordenarColumnas(columnas: ColumnaCruda[]): ColumnaCruda[] {
  return [...columnas].sort(
    (a, b) =>
      a.position - b.position ||
      a.created_at.localeCompare(b.created_at) ||
      a.id.localeCompare(b.id)
  )
}

/** Las celdas indexadas como las lee `ponderadoDeColumna`. */
function mapaDeCeldas(
  celdas: ReadonlyArray<Pick<CeldaCruda, 'column_id' | 'row_id' | 'numeric_value'>>
): Map<string, { numero: number | null }> {
  const mapa = new Map<string, { numero: number | null }>()
  for (const c of celdas) mapa.set(claveCelda(c.row_id, c.column_id), { numero: c.numeric_value })
  return mapa
}

/** Un tablero está "completo" si algún proyecto tiene todos los criterios calificados. */
function tableroCompleto(
  filas: ReadonlyArray<FilaDinamica>,
  columnas: ReadonlyArray<Pick<ColumnaCruda, 'id'>>,
  celdas: ReadonlyMap<string, { numero: number | null }>
): boolean {
  return columnas.some((c) => ponderadoDeColumna(filas, celdas, c.id).completa)
}

function agrupar<T, K extends string>(items: ReadonlyArray<T>, clave: (item: T) => K): Map<K, T[]> {
  const mapa = new Map<K, T[]>()
  for (const item of items) {
    const k = clave(item)
    const lista = mapa.get(k)
    if (lista) lista.push(item)
    else mapa.set(k, [item])
  }
  return mapa
}

/**
 * Nombres para mostrar, por `public_profiles` (nombre y avatar, sin correo ni
 * rol crudo). Copia de `resolverAutores` en lib/comunidad/posts.ts, en lotes
 * de 50: un `.in()` con cien uuids ya pesa más de 4 KB de URL.
 */
async function resolverNombres(supabase: Cliente, userIds: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>()
  const unicos = [...new Set(userIds)]
  if (unicos.length === 0) return mapa

  type Fila = { user_id: string | null; full_name: string | null }

  for (let i = 0; i < unicos.length; i += 50) {
    const lote = unicos.slice(i, i + 50)
    const { data, error } = await supabase
      .from('public_profiles')
      .select('user_id, full_name')
      .in('user_id', lote)

    if (error) {
      registrarFallo('resolverNombres', { cuantos: lote.length }, error.message)
      continue
    }
    for (const p of (data ?? []) as Fila[]) {
      if (p.user_id) mapa.set(p.user_id, p.full_name?.trim() || 'Alumno')
    }
  }
  return mapa
}

async function columnasDe(supabase: Cliente, boardIds: string[]): Promise<ColumnaCruda[]> {
  if (boardIds.length === 0) return []
  const { data, error } = await supabase
    .from('dynamic_columns')
    .select('id, board_id, label, position, created_by, created_at, updated_at')
    .in('board_id', boardIds)
  if (error) {
    registrarFallo('columnasDe', { tableros: boardIds.length }, error.message)
    return []
  }
  return ordenarColumnas(data ?? [])
}

async function celdasDe(supabase: Cliente, boardIds: string[]): Promise<CeldaCruda[]> {
  if (boardIds.length === 0) return []
  const { data, error } = await supabase
    .from('dynamic_cells')
    .select('board_id, column_id, row_id, numeric_value, updated_by, updated_at')
    .in('board_id', boardIds)
  if (error) {
    registrarFallo('celdasDe', { tableros: boardIds.length }, error.message)
    return []
  }
  return data ?? []
}

async function cursoDe(
  supabase: Cliente,
  cursoId: string
): Promise<{ titulo: string; slug: string }> {
  const { data } = await supabase
    .from('courses')
    .select('title, slug')
    .eq('id', cursoId)
    .maybeSingle()
  return { titulo: data?.title ?? 'Curso eliminado', slug: data?.slug ?? '' }
}

async function cohorteDe(supabase: Cliente, cohorteId: string | null): Promise<string | null> {
  if (!cohorteId) return null
  const { data } = await supabase.from('cohorts').select('name').eq('id', cohorteId).maybeSingle()
  return data?.name ?? null
}

// --------------------------------------------------------------------------
// Lista y detalle
// --------------------------------------------------------------------------

/**
 * Todas las dinámicas, con lo que la lista necesita al lado de cada una.
 *
 * Trae las cinco tablas completas y cruza aquí: con una decena de dinámicas y
 * unas decenas de tableros son unos cientos de filas. Cuando sean miles, esto
 * se vuelve una vista; hoy sería optimizar lo que no duele.
 */
export async function listarDinamicas(): Promise<DinamicaEnLista[]> {
  const supabase = await crearClienteServidor()

  const [dinamicas, filas, tableros, columnas, celdas, cursos, cohortes] = await Promise.all([
    supabase.from('dynamics').select('*').order('created_at', { ascending: false }),
    supabase
      .from('dynamic_rows')
      .select('id, dynamic_id, row_kind, label, weight, position, created_at'),
    supabase.from('dynamic_boards').select('id, dynamic_id'),
    supabase.from('dynamic_columns').select('id, board_id'),
    supabase.from('dynamic_cells').select('column_id, row_id, numeric_value'),
    supabase.from('courses').select('id, title, slug'),
    supabase.from('cohorts').select('id, name'),
  ])

  if (dinamicas.error) {
    registrarFallo('listarDinamicas', {}, dinamicas.error.message)
    return []
  }
  for (const [nombre, r] of Object.entries({ filas, tableros, columnas, celdas, cursos, cohortes })) {
    if (r.error) registrarFallo('listarDinamicas', { consulta: nombre }, r.error.message)
  }

  const cursoPorId = new Map((cursos.data ?? []).map((c) => [c.id, c]))
  const cohortePorId = new Map((cohortes.data ?? []).map((c) => [c.id, c.name]))
  const filasPorDinamica = agrupar(filas.data ?? [], (f) => f.dynamic_id)
  const tablerosPorDinamica = agrupar(tableros.data ?? [], (t) => t.dynamic_id)
  const columnasPorTablero = agrupar(columnas.data ?? [], (c) => c.board_id)
  const mapaCeldas = mapaDeCeldas(celdas.data ?? [])
  const ahora = Date.now()

  return (dinamicas.data ?? []).map((d) => {
    const curso = cursoPorId.get(d.course_id)
    const filasDeEsta = ordenarFilas(filasPorDinamica.get(d.id) ?? []).map(aFila)
    const tablerosDeEsta = tablerosPorDinamica.get(d.id) ?? []
    const completos = tablerosDeEsta.filter((t) =>
      tableroCompleto(filasDeEsta, columnasPorTablero.get(t.id) ?? [], mapaCeldas)
    ).length

    return {
      ...d,
      curso: curso?.title ?? 'Curso eliminado',
      cursoSlug: curso?.slug ?? '',
      cohorte: d.cohort_id ? (cohortePorId.get(d.cohort_id) ?? null) : null,
      totalCriterios: filasDeEsta.filter((f) => f.tipo === 'criterio').length,
      totalTableros: tablerosDeEsta.length,
      totalCompletos: completos,
      estadoEfectivo: estadoEfectivo(d, ahora),
    }
  })
}

/**
 * Una dinámica con sus filas ordenadas y los conteos de su encabezado.
 *
 * Va envuelta en `cache()` de React, que memoriza POR PETICIÓN: el layout la
 * pide para el encabezado y las pestañas, y la página hija la vuelve a pedir
 * para su sección. Sin esto serían dos viajes idénticos por carga.
 */
export const obtenerDinamica = cache(async function obtenerDinamica(
  id: string
): Promise<DinamicaCompleta | null> {
  const supabase = await crearClienteServidor()

  const [dinamica, filas, tableros] = await Promise.all([
    supabase.from('dynamics').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('dynamic_rows')
      .select('id, dynamic_id, row_kind, label, weight, position, created_at')
      .eq('dynamic_id', id),
    supabase.from('dynamic_boards').select('id').eq('dynamic_id', id),
  ])

  if (dinamica.error) {
    registrarFallo('obtenerDinamica', { id }, dinamica.error.message)
    return null
  }
  if (!dinamica.data) return null
  if (filas.error) registrarFallo('obtenerDinamica', { id, consulta: 'filas' }, filas.error.message)
  if (tableros.error) {
    registrarFallo('obtenerDinamica', { id, consulta: 'tableros' }, tableros.error.message)
  }

  const d = dinamica.data
  const boardIds = (tableros.data ?? []).map((t) => t.id)

  const [curso, cohorte, columnas, celdas] = await Promise.all([
    cursoDe(supabase, d.course_id),
    cohorteDe(supabase, d.cohort_id),
    columnasDe(supabase, boardIds),
    celdasDe(supabase, boardIds),
  ])

  const filasOrdenadas = ordenarFilas(filas.data ?? []).map(aFila)
  const mapaCeldas = mapaDeCeldas(celdas)
  const columnasPorTablero = agrupar(columnas, (c) => c.board_id)
  const celdasPorFila = agrupar(celdas, (c) => c.row_id)

  const completos = boardIds.filter((boardId) =>
    tableroCompleto(filasOrdenadas, columnasPorTablero.get(boardId) ?? [], mapaCeldas)
  ).length

  return {
    ...d,
    curso: curso.titulo,
    cursoSlug: curso.slug,
    cohorte,
    filas: filasOrdenadas.map((f) => {
      const suyas = celdasPorFila.get(f.id) ?? []
      return { ...f, celdas: suyas.length, tableros: new Set(suyas.map((c) => c.board_id)).size }
    }),
    totalTableros: boardIds.length,
    totalCompletos: completos,
    totalCeldas: celdas.length,
    estadoEfectivo: estadoEfectivo(d),
  }
})

// --------------------------------------------------------------------------
// Tableros de una dinámica (pestaña Tableros)
// --------------------------------------------------------------------------

/**
 * Un resumen por tablero: empresa o dueño, cuántos proyectos, cuánto llevan
 * calificado, el mejor ponderado y quiénes han editado. Primero los de
 * empresa por nombre; luego los individuales por dueño.
 */
export async function tablerosDeDinamica(dynamicId: string): Promise<ResumenTablero[]> {
  const supabase = await crearClienteServidor()

  const [filas, tableros, empresas] = await Promise.all([
    supabase
      .from('dynamic_rows')
      .select('id, dynamic_id, row_kind, label, weight, position, created_at')
      .eq('dynamic_id', dynamicId),
    supabase
      .from('dynamic_boards')
      .select('id, company_id, owner_user_id, updated_at')
      .eq('dynamic_id', dynamicId),
    supabase.from('companies').select('id, name'),
  ])

  if (tableros.error) {
    registrarFallo('tablerosDeDinamica', { dynamicId }, tableros.error.message)
    return []
  }
  if (filas.error) {
    registrarFallo('tablerosDeDinamica', { dynamicId, consulta: 'filas' }, filas.error.message)
  }

  const lista = tableros.data ?? []
  if (lista.length === 0) return []

  const boardIds = lista.map((t) => t.id)
  const [columnas, celdas] = await Promise.all([
    columnasDe(supabase, boardIds),
    celdasDe(supabase, boardIds),
  ])

  const nombres = await resolverNombres(supabase, [
    ...lista.flatMap((t) => (t.owner_user_id ? [t.owner_user_id] : [])),
    ...columnas.flatMap((c) => (c.created_by ? [c.created_by] : [])),
    ...celdas.flatMap((c) => (c.updated_by ? [c.updated_by] : [])),
  ])

  const filasOrdenadas = ordenarFilas(filas.data ?? []).map(aFila)
  const empresaPorId = new Map((empresas.data ?? []).map((e) => [e.id, e.name]))
  const columnasPorTablero = agrupar(columnas, (c) => c.board_id)
  const celdasPorTablero = agrupar(celdas, (c) => c.board_id)
  const mapaCeldas = mapaDeCeldas(celdas)

  const resumenes = lista.map((t): ResumenTablero => {
    const suyas = columnasPorTablero.get(t.id) ?? []
    const celdasSuyas = celdasPorTablero.get(t.id) ?? []
    // El mismo conteo que el tablero del admin y el Excel (comun.ts).
    const { llenas, total } = contarCeldasDeCriterio(
      filasOrdenadas,
      suyas,
      celdasSuyas.map((c) => ({ filaId: c.row_id, columnaId: c.column_id, numero: c.numeric_value }))
    )

    let mejor: ResumenTablero['mejor'] = null
    for (const c of suyas) {
      const p = ponderadoDeColumna(filasOrdenadas, mapaCeldas, c.id)
      if (p.valor !== null && (mejor === null || p.valor > mejor.valor)) {
        mejor = { proyecto: c.label, valor: p.valor }
      }
    }

    const editores = new Set<string>()
    let ultima: string | null = null
    for (const c of suyas) {
      if (c.created_by) editores.add(c.created_by)
      if (!ultima || c.updated_at > ultima) ultima = c.updated_at
    }
    for (const c of celdasSuyas) {
      if (c.updated_by) editores.add(c.updated_by)
      if (!ultima || c.updated_at > ultima) ultima = c.updated_at
    }

    return {
      id: t.id,
      empresa: t.company_id ? (empresaPorId.get(t.company_id) ?? 'Empresa eliminada') : null,
      dueno: t.owner_user_id ? (nombres.get(t.owner_user_id) ?? 'Alumno') : null,
      columnas: suyas.length,
      llenas,
      total,
      mejor,
      editores: [...editores]
        .map((id) => nombres.get(id) ?? 'Alumno')
        .sort((a, b) => a.localeCompare(b, 'es')),
      ultimaEdicion: ultima,
    }
  })

  return resumenes.sort((a, b) => {
    if ((a.empresa === null) !== (b.empresa === null)) return a.empresa === null ? 1 : -1
    return (a.empresa ?? a.dueno ?? '').localeCompare(b.empresa ?? b.dueno ?? '', 'es')
  })
}

/**
 * Empresas con alumnos inscritos al curso —y con acceso vigente, que es lo
 * que hace falta para abrir un tablero— que todavía no tienen el suyo.
 *
 * Se cruzan inscripciones y perfiles en memoria en vez de un `.in()` con
 * ciento cincuenta uuids: son dos consultas planas y el cruce es trivial.
 */
export async function empresasDelCursoSinTablero(dynamicId: string): Promise<EmpresaSinTablero[]> {
  const supabase = await crearClienteServidor()

  const { data: dinamica, error } = await supabase
    .from('dynamics')
    .select('course_id')
    .eq('id', dynamicId)
    .maybeSingle()

  if (error) {
    registrarFallo('empresasDelCursoSinTablero', { dynamicId }, error.message)
    return []
  }
  if (!dinamica) return []

  const [inscripciones, perfiles, tableros, empresas] = await Promise.all([
    supabase
      .from('enrollments')
      .select('user_id, expires_at')
      .eq('course_id', dinamica.course_id)
      .eq('status', 'active'),
    supabase
      .from('profiles')
      .select('user_id, company_id')
      .eq('role', 'alumno')
      .eq('status', 'active')
      .not('company_id', 'is', null),
    supabase
      .from('dynamic_boards')
      .select('company_id')
      .eq('dynamic_id', dynamicId)
      .not('company_id', 'is', null),
    supabase.from('companies').select('id, name').order('name'),
  ])

  for (const [nombre, r] of Object.entries({ inscripciones, perfiles, tableros, empresas })) {
    if (r.error) {
      registrarFallo('empresasDelCursoSinTablero', { dynamicId, consulta: nombre }, r.error.message)
    }
  }

  const ahora = Date.now()
  const inscritos = new Set(
    (inscripciones.data ?? [])
      .filter((e) => !e.expires_at || new Date(e.expires_at).getTime() > ahora)
      .map((e) => e.user_id)
  )
  const conTablero = new Set(
    (tableros.data ?? []).flatMap((t) => (t.company_id ? [t.company_id] : []))
  )

  const alumnosPorEmpresa = new Map<string, number>()
  for (const p of perfiles.data ?? []) {
    if (!p.company_id || !inscritos.has(p.user_id)) continue
    alumnosPorEmpresa.set(p.company_id, (alumnosPorEmpresa.get(p.company_id) ?? 0) + 1)
  }

  return (empresas.data ?? []).flatMap((e) => {
    const alumnos = alumnosPorEmpresa.get(e.id) ?? 0
    if (alumnos === 0 || conTablero.has(e.id)) return []
    return [{ id: e.id, nombre: e.name, alumnos }]
  })
}
