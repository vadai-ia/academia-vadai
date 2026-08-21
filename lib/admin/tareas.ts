import 'server-only'

import { crearClienteServidor } from '@/lib/supabase/server'
import type { Json, Tabla } from '@/lib/supabase/types'

export type Tarea = Tabla<'assignments'>
export type Entrega = Tabla<'assignment_submissions'>

export type ArchivoEntregado = { storage_path: string; name: string }

export type TareaConEntregas = Tarea & {
  entregas: number
  pendientes: number
}

export type EntregaEnBandeja = {
  id: string
  estado: string
  texto: string | null
  archivos: ArchivoEntregado[]
  feedback: string | null
  entregadaEn: string
  revisadaEn: string | null
  alumnoNombre: string
  alumnoEmail: string
  leccionTitulo: string
  cursoTitulo: string
  cursoId: string
}

/**
 * Lee el jsonb de archivos entregados.
 *
 * Se valida la forma en vez de confiar: una entrada sin `storage_path` haría
 * fallar la descarga en silencio, justo cuando el admin está revisando.
 */
export function leerArchivos(crudo: Json | null): ArchivoEntregado[] {
  if (!Array.isArray(crudo)) return []
  return crudo.flatMap((a) => {
    if (typeof a !== 'object' || a === null) return []
    const { storage_path, name } = a as { storage_path?: unknown; name?: unknown }
    if (typeof storage_path !== 'string') return []
    return [{ storage_path, name: typeof name === 'string' ? name : storage_path }]
  })
}

/** Tarea de una lección, con el conteo de entregas para el admin. */
export async function tareaDeLeccion(leccionId: string): Promise<TareaConEntregas | null> {
  const supabase = await crearClienteServidor()

  const { data, error } = await supabase
    .from('assignments')
    .select('*, assignment_submissions(id, status)')
    .eq('lesson_id', leccionId)
    .maybeSingle()

  if (error) {
    console.error(JSON.stringify({ operacion: 'tareaDeLeccion', leccionId, error: error.message }))
    return null
  }
  if (!data) return null

  type Anidado = Tarea & { assignment_submissions: Array<{ id: string; status: string }> }
  const tarea = data as unknown as Anidado
  const { assignment_submissions, ...resto } = tarea

  return {
    ...resto,
    entregas: assignment_submissions?.length ?? 0,
    pendientes: (assignment_submissions ?? []).filter((e) => e.status === 'submitted').length,
  }
}

/**
 * Bandeja de revisión (§3.5).
 *
 * Por default trae solo lo pendiente, que es lo que el admin necesita atender.
 * Las ya revisadas se pueden pedir para consultar o corregir una calificación.
 */
export async function bandejaDeEntregas(
  soloPendientes = true
): Promise<EntregaEnBandeja[]> {
  const supabase = await crearClienteServidor()

  let consulta = supabase
    .from('assignment_submissions')
    .select(
      'id, status, text_content, files, feedback, created_at, reviewed_at, ' +
        'profiles!assignment_submissions_user_id_fkey(full_name, email), ' +
        'assignments!inner(lessons!inner(title, modules!inner(course_id, courses!inner(title))))'
    )
    .order('created_at', { ascending: true })

  if (soloPendientes) consulta = consulta.eq('status', 'submitted')

  const { data, error } = await consulta

  if (error) {
    console.error(JSON.stringify({ operacion: 'bandejaDeEntregas', error: error.message }))
    return []
  }

  type Anidado = {
    id: string
    status: string
    text_content: string | null
    files: Json
    feedback: string | null
    created_at: string
    reviewed_at: string | null
    profiles: { full_name: string; email: string } | null
    assignments: {
      lessons: { title: string; modules: { course_id: string; courses: { title: string } } }
    }
  }

  return (data as unknown as Anidado[]).map((e) => ({
    id: e.id,
    estado: e.status,
    texto: e.text_content,
    archivos: leerArchivos(e.files),
    feedback: e.feedback,
    entregadaEn: e.created_at,
    revisadaEn: e.reviewed_at,
    alumnoNombre: e.profiles?.full_name || (e.profiles?.email ?? 'Alumno'),
    alumnoEmail: e.profiles?.email ?? '',
    leccionTitulo: e.assignments.lessons.title,
    cursoTitulo: e.assignments.lessons.modules.courses.title,
    cursoId: e.assignments.lessons.modules.course_id,
  }))
}
