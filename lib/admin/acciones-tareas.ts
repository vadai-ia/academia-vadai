'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { exigirAdmin } from '@/lib/auth/sesion'
import { crearClienteServidor } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/types'

import type { EstadoAccion } from './tipos'

/**
 * Tareas: builder y revisión (§3.5).
 */

const BUCKET = 'academia-adjuntos'

function registrarFallo(operacion: string, detalle: Record<string, unknown>, error: string) {
  console.error(JSON.stringify({ operacion, ...detalle, error }))
}

/** Crea la tarea de una lección si todavía no existe. */
export async function crearTarea(datos: FormData): Promise<void> {
  await exigirAdmin()

  const leccionId = String(datos.get('lesson_id') ?? '')
  if (!leccionId) return

  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('assignments')
    .insert({ lesson_id: leccionId, allow_files: true, allow_text: true })

  if (error && error.code !== '23505') registrarFallo('crearTarea', { leccionId }, error.message)

  revalidatePath(`/admin/lecciones/${leccionId}`)
}

const esquemaTarea = z.object({
  instructions_rich: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === '') return null
      try {
        return JSON.parse(v) as Json
      } catch {
        ctx.addIssue({ code: 'custom', message: 'Las instrucciones no son válidas.' })
        return null
      }
    })
    .nullable(),
  allow_files: z.coerce.boolean(),
  allow_text: z.coerce.boolean(),
})

export async function actualizarTarea(
  _previo: EstadoAccion,
  datos: FormData
): Promise<EstadoAccion> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  const leccionId = String(datos.get('lesson_id') ?? '')
  if (!id) return { error: 'Falta la tarea.' }

  const resultado = esquemaTarea.safeParse({
    instructions_rich: datos.get('instructions_rich') ?? '',
    allow_files: datos.get('allow_files') ?? false,
    allow_text: datos.get('allow_text') ?? false,
  })
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? 'Revisa los datos.' }
  }

  // El CHECK de la base lo impide igual, pero un error de Postgres crudo no le
  // dice nada al admin. Aquí sí.
  if (!resultado.data.allow_files && !resultado.data.allow_text) {
    return { error: 'La tarea tiene que aceptar al menos texto o archivos.' }
  }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('assignments').update(resultado.data).eq('id', id)

  if (error) {
    registrarFallo('actualizarTarea', { id }, error.message)
    return { error: 'No se pudo guardar la tarea.' }
  }

  revalidatePath(`/admin/lecciones/${leccionId}`)
  return { aviso: 'Tarea guardada.' }
}

/**
 * Revisa una entrega: aprobada o rechazada, con feedback (§3.5).
 *
 * `reviewed_by` y `reviewed_at` se llenan siempre: el CHECK
 * `assignment_submissions_revision_completa` de M1 exige que una entrega
 * revisada diga quién y cuándo. Sin eso la base rechaza el update.
 */
export async function revisarEntrega(
  _previo: EstadoAccion,
  datos: FormData
): Promise<EstadoAccion> {
  const perfil = await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  const decision = String(datos.get('decision') ?? '')
  const feedback = String(datos.get('feedback') ?? '').trim()

  if (!id) return { error: 'Falta la entrega.' }
  if (decision !== 'approved' && decision !== 'rejected') {
    return { error: 'Elige aprobar o pedir correcciones.' }
  }

  // Rechazar sin decir por qué deja al alumno adivinando qué corregir, y §3.5
  // dice que rechazada permite reentrega: sin feedback esa reentrega es a ciegas.
  if (decision === 'rejected' && feedback.length < 5) {
    return { error: 'Explica qué debe corregir antes de pedir cambios.' }
  }

  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('assignment_submissions')
    .update({
      status: decision,
      feedback: feedback || null,
      reviewed_by: perfil.user_id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    registrarFallo('revisarEntrega', { id, decision }, error.message)
    return { error: 'No se pudo guardar la revisión.' }
  }

  revalidatePath('/admin/entregas')
  return {
    aviso: decision === 'approved' ? 'Entrega aprobada.' : 'Se le pidieron correcciones.',
  }
}

/** URL firmada para que el admin descargue un archivo entregado. */
export async function urlDeEntrega(rutaStorage: string): Promise<string | null> {
  await exigirAdmin()

  const supabase = await crearClienteServidor()
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(rutaStorage, 60 * 5)

  if (error) {
    registrarFallo('urlDeEntrega', { rutaStorage }, error.message)
    return null
  }
  return data.signedUrl
}
