import 'server-only'

import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * Empresas: de dónde viene cada alumno.
 *
 * Es una tabla y no un texto libre porque "Aztlán", "Grupo Aztlan" y "aztlan"
 * serían tres empresas distintas en un ranking. El admin las da de alta antes
 * y las elige después; el importador las crea solo cuando el archivo trae la
 * columna Empresa, y las reúsa si ya existen.
 */

export type Empresa = { id: string; nombre: string; alumnos: number }

/** Todas, con cuántos alumnos tiene cada una. Ordenadas por nombre. */
export async function listarEmpresas(): Promise<Empresa[]> {
  const supabase = await crearClienteServidor()
  const [empresas, perfiles] = await Promise.all([
    supabase.from('companies').select('id, name').order('name'),
    supabase.from('profiles').select('company_id').eq('role', 'alumno').eq('status', 'active'),
  ])

  if (empresas.error) {
    console.error(JSON.stringify({ operacion: 'listarEmpresas', error: empresas.error.message }))
    return []
  }

  const cuenta = new Map<string, number>()
  for (const p of perfiles.data ?? []) {
    if (p.company_id) cuenta.set(p.company_id, (cuenta.get(p.company_id) ?? 0) + 1)
  }

  return (empresas.data ?? []).map((e) => ({ id: e.id, nombre: e.name, alumnos: cuenta.get(e.id) ?? 0 }))
}

/**
 * Encuentra la empresa por nombre, sin distinguir mayúsculas ni espacios, o la
 * crea. Es lo que usa el alta masiva con la columna Empresa: doce filas que
 * digan "Innovaglass" tienen que caer en UNA empresa, exista o no de antes.
 */
export async function empresaPorNombre(nombre: string): Promise<string | null> {
  const limpio = nombre.trim().replace(/\s+/g, ' ')
  if (!limpio) return null

  const supabase = await crearClienteServidor()
  const { data: existente } = await supabase
    .from('companies')
    .select('id')
    .ilike('name', limpio)
    .maybeSingle()
  if (existente) return existente.id

  const { data: creada, error } = await supabase
    .from('companies')
    .insert({ name: limpio })
    .select('id')
    .single()

  if (error) {
    // Carrera con otra fila del mismo archivo, o el índice único por
    // minúsculas: se vuelve a buscar en vez de fallar.
    const { data: otra } = await supabase.from('companies').select('id').ilike('name', limpio).maybeSingle()
    if (otra) return otra.id
    console.error(JSON.stringify({ operacion: 'empresaPorNombre', nombre: limpio, error: error.message }))
    return null
  }
  return creada.id
}
