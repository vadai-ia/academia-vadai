import 'server-only'

import { folioDeDiploma } from '@/lib/diplomas/folio'
import { PROGRAMAS, type Programa } from '@/lib/diplomas/programas'
import { esCuentaQa } from '@/lib/qa'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * El control de diplomas en el panel (academia_0039_diplomas): por generación,
 * quién lo tiene, quién ya lo abrió y quién ya lo descargó, con búsqueda por
 * nombre, correo, empresa o folio. Con la sesión del equipo (RLS).
 */

export const ESTADOS_DIPLOMA = ['todos', 'sin-abrir', 'abiertos', 'descargados'] as const
export type EstadoDiploma = (typeof ESTADOS_DIPLOMA)[number]

export type FiltrosDiplomas = { gen?: string; q?: string; estado?: string }

export type FilaDiploma = {
  userId: string
  nombre: string
  correo: string
  empresa: string | null
  folio: string
  abiertoPrimero: string | null
  abiertoUltimo: string | null
  aperturas: number
  descargadoPrimero: string | null
  descargadoUltimo: string | null
  descargas: number
}

export type TablaDiplomas = {
  programa: Programa
  filas: FilaDiploma[]
  cifras: { total: number; abiertos: number; descargados: number; sinAbrir: number }
  filtros: { q: string; estado: EstadoDiploma }
}

/** Minúsculas y sin acentos, para que «martinez» encuentre a «Martínez». */
const plano = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

export async function tablaDeDiplomas(filtros: FiltrosDiplomas): Promise<TablaDiplomas | null> {
  const programa = PROGRAMAS.find((p) => p.clave === filtros.gen) ?? PROGRAMAS[0]
  if (!programa) return null
  const estado = (ESTADOS_DIPLOMA as readonly string[]).includes(filtros.estado ?? '')
    ? (filtros.estado as EstadoDiploma)
    : 'todos'
  const q = (filtros.q ?? '').trim()

  const supabase = await crearClienteServidor()
  const { data: inscritos } = await supabase
    .from('enrollments')
    .select('user_id')
    .eq('cohort_id', programa.cohortId)
    .eq('status', 'active')
  const ids = [...new Set((inscritos ?? []).map((i) => i.user_id))]

  const [{ data: perfiles }, { data: eventos }] = await Promise.all([
    ids.length
      ? supabase.from('profiles').select('user_id, full_name, email, company_id, role').in('user_id', ids)
      : Promise.resolve({ data: [] }),
    // Si la migración aún no está aplicada, esto falla y se lee como «sin eventos».
    supabase.from('diploma_events').select('*').eq('clave', programa.clave),
  ])
  const empresas = [...new Set((perfiles ?? []).map((p) => p.company_id).filter((v): v is string => v !== null))]
  const { data: nombresDeEmpresa } = empresas.length
    ? await supabase.from('companies').select('id, name').in('id', empresas)
    : { data: [] }
  const empresaPorId = new Map((nombresDeEmpresa ?? []).map((e) => [e.id, e.name]))
  const eventoPorUsuario = new Map((eventos ?? []).map((e) => [e.user_id, e]))

  const todas: FilaDiploma[] = (perfiles ?? [])
    .filter((p) => p.role === 'alumno' && !esCuentaQa(p.email))
    .map((p) => {
      const e = eventoPorUsuario.get(p.user_id)
      return {
        userId: p.user_id,
        nombre: p.full_name || p.email,
        correo: p.email,
        empresa: p.company_id ? (empresaPorId.get(p.company_id) ?? null) : null,
        folio: folioDeDiploma(programa.clave, p.user_id),
        abiertoPrimero: e?.abierto_primero ?? null,
        abiertoUltimo: e?.abierto_ultimo ?? null,
        aperturas: e?.aperturas ?? 0,
        descargadoPrimero: e?.descargado_primero ?? null,
        descargadoUltimo: e?.descargado_ultimo ?? null,
        descargas: e?.descargas ?? 0,
      }
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  const cifras = {
    total: todas.length,
    abiertos: todas.filter((f) => f.aperturas > 0).length,
    descargados: todas.filter((f) => f.descargas > 0).length,
    sinAbrir: todas.filter((f) => f.aperturas === 0).length,
  }

  const busqueda = plano(q)
  const filas = todas.filter((f) => {
    if (estado === 'sin-abrir' && f.aperturas > 0) return false
    if (estado === 'abiertos' && f.aperturas === 0) return false
    if (estado === 'descargados' && f.descargas === 0) return false
    if (!busqueda) return true
    return (
      plano(f.nombre).includes(busqueda) ||
      plano(f.correo).includes(busqueda) ||
      plano(f.empresa ?? '').includes(busqueda) ||
      f.folio.toLowerCase().includes(busqueda.replace(/\s+/g, ''))
    )
  })

  return { programa, filas, cifras, filtros: { q, estado } }
}
