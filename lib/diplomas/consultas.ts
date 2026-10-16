import 'server-only'

import { esEquipo, type Perfil } from '@/lib/auth/sesion'
import { claveDelFolio, folioDeDiploma } from '@/lib/diplomas/folio'
import { PROGRAMAS, programaPorClave, yaVisible, type Programa } from '@/lib/diplomas/programas'
import { crearClienteServidor } from '@/lib/supabase/server'
import { crearClienteServiceRole } from '@/lib/supabase/service-role'

export type DiplomaDeAlumno = {
  programa: Programa
  nombre: string
  folio: string
  /** El equipo lo ve antes de la hora, para revisarlo. */
  vistaPrevia: boolean
}

/**
 * Los diplomas de quien pide la página. Con su sesión: sus inscripciones las
 * lee él mismo (RLS). Cuenta toda inscripción en la generación, vigente o no:
 * el diploma es por haber sido parte de ella.
 */
export async function misDiplomas(perfil: Perfil): Promise<DiplomaDeAlumno[]> {
  const equipo = esEquipo(perfil)
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('enrollments')
    .select('cohort_id, status')
    .eq('user_id', perfil.user_id)
    .in(
      'cohort_id',
      PROGRAMAS.map((p) => p.cohortId)
    )
  const suyas = new Set((data ?? []).filter((e) => e.status === 'active').map((e) => e.cohort_id))

  return PROGRAMAS.filter((p) => (suyas.has(p.cohortId) && yaVisible(p)) || equipo).map((p) => ({
    programa: p,
    nombre: perfil.full_name || perfil.email,
    folio: folioDeDiploma(p.clave, perfil.user_id),
    vistaPrevia: !yaVisible(p),
  }))
}

/** Los que ya le tocan pero todavía no se abren: para avisarle a qué hora. */
export async function diplomasPorAbrir(perfil: Perfil): Promise<Programa[]> {
  if (esEquipo(perfil)) return []
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('enrollments')
    .select('cohort_id, status')
    .eq('user_id', perfil.user_id)
    .in(
      'cohort_id',
      PROGRAMAS.map((p) => p.cohortId)
    )
  const suyas = new Set((data ?? []).filter((e) => e.status === 'active').map((e) => e.cohort_id))
  return PROGRAMAS.filter((p) => suyas.has(p.cohortId) && !yaVisible(p))
}

export type DiplomaVerificado = { programa: Programa; nombre: string; folio: string }

/**
 * Verificación pública por folio. Service role y solo lectura, como
 * /certificado/[folio]: quien verifica no tiene cuenta. Se recalcula el folio
 * de cada inscrito en la generación hasta dar con el que coincide.
 */
export async function verificarDiploma(folio: string): Promise<DiplomaVerificado | null> {
  const limpio = folio.trim().toUpperCase()
  const clave = claveDelFolio(limpio)
  const programa = clave ? programaPorClave(clave) : null
  if (!programa || !yaVisible(programa)) return null

  const supabase = crearClienteServiceRole()
  const { data } = await supabase
    .from('enrollments')
    .select('user_id')
    .eq('cohort_id', programa.cohortId)
    .eq('status', 'active')

  const dueno = (data ?? []).find((fila) => folioDeDiploma(programa.clave, fila.user_id) === limpio)
  if (!dueno) return null
  const { data: perfil } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('user_id', dueno.user_id)
    .maybeSingle()
  return { programa, nombre: perfil?.full_name || perfil?.email || 'Alumno VADAI', folio: limpio }
}
