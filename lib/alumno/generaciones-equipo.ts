import 'server-only'

import { estadoDeGeneracion, type EstadoGeneracion } from '@/lib/generaciones'
import { crearClienteServidor } from '@/lib/supabase/server'

export type GeneracionParaSelector = {
  id: string
  nombre: string
  estado: EstadoGeneracion
}

/**
 * Las generaciones de un curso, para el selector que ve el EQUIPO en la
 * comunidad (M16). A un alumno la policy de `cohorts` solo le devuelve la
 * suya, así que esta misma consulta le daría una lista de uno y el selector no
 * se pinta; aun así solo se llama para el equipo.
 */
export async function generacionesParaEquipo(cursoId: string): Promise<GeneracionParaSelector[]> {
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('cohorts')
    .select('id, name, starts_on, ends_on, open_for_enrollment')
    .eq('course_id', cursoId)
    .order('starts_on', { ascending: false, nullsFirst: false })

  if (error) {
    console.error(JSON.stringify({ operacion: 'generacionesParaEquipo', cursoId, error: error.message }))
    return []
  }
  return (data ?? []).map((g) => ({ id: g.id, nombre: g.name, estado: estadoDeGeneracion(g) }))
}
