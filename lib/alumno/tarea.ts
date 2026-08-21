import 'server-only'

import { leerArchivos, type ArchivoEntregado } from '@/lib/admin/tareas'
import { crearClienteServidor } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/types'

export type EntregaDelAlumno = {
  id: string
  estado: 'submitted' | 'approved' | 'rejected'
  texto: string | null
  archivos: ArchivoEntregado[]
  feedback: string | null
  revisadaEn: string | null
}

export type TareaParaAlumno = {
  id: string
  instrucciones: Json | null
  aceptaArchivos: boolean
  aceptaTexto: boolean
  entrega: EntregaDelAlumno | null
}

/**
 * Tarea tal como la ve el alumno, con su propia entrega si ya la hizo.
 *
 * Todo pasa por el cliente del usuario: RLS deja ver la tarea solo con acceso
 * vigente, y de `assignment_submissions` solo las filas propias.
 */
export async function tareaParaAlumno(leccionId: string): Promise<TareaParaAlumno | null> {
  const supabase = await crearClienteServidor()

  const { data: tarea } = await supabase
    .from('assignments')
    .select('id, instructions_rich, allow_files, allow_text')
    .eq('lesson_id', leccionId)
    .maybeSingle()

  if (!tarea) return null

  const { data: entrega } = await supabase
    .from('assignment_submissions')
    .select('id, status, text_content, files, feedback, reviewed_at')
    .eq('assignment_id', tarea.id)
    .maybeSingle()

  return {
    id: tarea.id,
    instrucciones: tarea.instructions_rich,
    aceptaArchivos: tarea.allow_files,
    aceptaTexto: tarea.allow_text,
    entrega: entrega
      ? {
          id: entrega.id,
          estado: entrega.status,
          texto: entrega.text_content,
          archivos: leerArchivos(entrega.files),
          feedback: entrega.feedback,
          revisadaEn: entrega.reviewed_at,
        }
      : null,
  }
}
