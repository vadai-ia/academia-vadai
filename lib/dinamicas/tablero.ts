import 'server-only'

import { crearClienteServidor } from '@/lib/supabase/server'
import type { Tabla } from '@/lib/supabase/types'

import {
  estadoEfectivo,
  type CeldaTablero,
  type ColumnaTablero,
  type FilaDinamica,
  type TableroParaPintar,
} from './comun'

/**
 * Un tablero listo para pintarse, leído con la sesión de quien pregunta.
 *
 * Sirve igual al miembro de la empresa que al equipo: RLS decide qué filas
 * llegan y aquí solo se arman. Selects planos en `Promise.all` y un `Map` para
 * cruzarlos (mismo criterio que lib/admin/alumnos.ts): PostgREST no puede
 * embeber `public_profiles` porque es una vista sin FK, y los nombres de quien
 * calificó salen de ahí a propósito — nunca el correo ni el rol.
 */

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>

function registrarFallo(operacion: string, detalle: Record<string, unknown>, error: string) {
  console.error(JSON.stringify({ operacion, ...detalle, error }))
}

/** Nombre visible de cada cuenta, vía `public_profiles`. Sin correo ni rol. */
export async function nombresDe(userIds: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>()
  const unicos = [...new Set(userIds)]
  if (unicos.length === 0) return mapa

  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('public_profiles')
    .select('user_id, full_name')
    .in('user_id', unicos)

  if (error) {
    registrarFallo('nombresDe', { cuantos: unicos.length }, error.message)
    return mapa
  }

  for (const p of data ?? []) {
    if (!p.user_id) continue
    mapa.set(p.user_id, p.full_name?.trim() || 'Alumno')
  }
  return mapa
}

async function nombreDeEmpresa(supabase: Cliente, companyId: string | null): Promise<string | null> {
  if (!companyId) return null
  const { data } = await supabase.from('companies').select('name').eq('id', companyId).maybeSingle()
  return data?.name ?? null
}

/** El nombre de quien es dueño de un tablero individual (General). Null si es de empresa. */
export async function duenoDeTablero(boardId: string): Promise<string | null> {
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('dynamic_boards')
    .select('owner_user_id')
    .eq('id', boardId)
    .maybeSingle()
  if (!data?.owner_user_id) return null
  const nombres = await nombresDe([data.owner_user_id])
  return nombres.get(data.owner_user_id) ?? 'Alumno'
}

type DinamicaConCurso = Tabla<'dynamics'> & {
  courses: { id: string; title: string; slug: string } | null
}

export async function obtenerTablero(boardId: string): Promise<TableroParaPintar | null> {
  const supabase = await crearClienteServidor()

  const { data: tablero, error } = await supabase
    .from('dynamic_boards')
    .select('id, dynamic_id, company_id, owner_user_id, version')
    .eq('id', boardId)
    .maybeSingle()

  if (error) {
    registrarFallo('obtenerTablero', { boardId }, error.message)
    return null
  }
  if (!tablero) return null

  // Las cinco son independientes entre sí: en serie serían cinco viajes.
  const [dinamica, filas, columnas, celdas, empresa] = await Promise.all([
    supabase
      .from('dynamics')
      .select('*, courses(id, title, slug)')
      .eq('id', tablero.dynamic_id)
      .maybeSingle(),
    supabase
      .from('dynamic_rows')
      .select('*')
      .eq('dynamic_id', tablero.dynamic_id)
      .order('position')
      .order('created_at'),
    supabase
      .from('dynamic_columns')
      .select('*')
      .eq('board_id', boardId)
      .order('position')
      .order('created_at')
      .order('id'),
    supabase.from('dynamic_cells').select('*').eq('board_id', boardId),
    nombreDeEmpresa(supabase, tablero.company_id),
  ])

  const d = dinamica.data as unknown as DinamicaConCurso | null
  if (!d) return null

  const listaColumnas = columnas.data ?? []
  const listaCeldas = celdas.data ?? []

  // Quien ha creado un proyecto o puesto una calificación, sin repetir.
  const ids = new Set<string>()
  for (const c of listaColumnas) if (c.created_by) ids.add(c.created_by)
  for (const c of listaCeldas) if (c.updated_by) ids.add(c.updated_by)
  const nombres = await nombresDe([...ids])

  const filasListas: FilaDinamica[] = (filas.data ?? []).map((f) => ({
    id: f.id,
    tipo: f.row_kind,
    etiqueta: f.label,
    peso: f.weight === null ? null : Number(f.weight),
    posicion: f.position,
  }))

  const columnasListas: ColumnaTablero[] = listaColumnas.map((c) => ({
    id: c.id,
    etiqueta: c.label,
    posicion: c.position,
    creadaPor: c.created_by,
    creadaPorNombre: c.created_by ? (nombres.get(c.created_by) ?? null) : null,
    creadaEn: c.created_at,
  }))

  const celdasListas: CeldaTablero[] = listaCeldas.map((c) => ({
    filaId: c.row_id,
    columnaId: c.column_id,
    numero: c.numeric_value,
    texto: c.text_value,
    editadaPor: c.updated_by,
    editadaPorNombre: c.updated_by ? (nombres.get(c.updated_by) ?? null) : null,
    editadaEn: c.updated_at,
  }))

  const editores = [...ids]
    .map((userId) => ({ userId, nombre: nombres.get(userId) ?? 'Alumno' }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  const estado = estadoEfectivo(d)

  return {
    id: tablero.id,
    dinamicaId: d.id,
    version: Number(tablero.version),
    titulo: d.title,
    descripcion: d.description,
    cursoId: d.course_id,
    cursoTitulo: d.courses?.title ?? 'Curso',
    cursoSlug: d.courses?.slug ?? '',
    empresa,
    estado,
    cierraEn: d.closes_at,
    // Una abierta que venció por fecha no tiene closed_at: cerró en su fecha límite.
    cerroEn: d.closed_at ?? (estado === 'closed' ? d.closes_at : null),
    escala: { min: d.scale_min, max: d.scale_max },
    filas: filasListas,
    columnas: columnasListas,
    celdas: celdasListas,
    editores,
  }
}
