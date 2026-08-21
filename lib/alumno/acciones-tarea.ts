'use server'

import { revalidatePath } from 'next/cache'

import { exigirPerfil } from '@/lib/auth/sesion'
import { crearClienteServidor } from '@/lib/supabase/server'

export type ResultadoEntrega = {
  ok: boolean
  error?: string
  aviso?: string
}

const BUCKET = 'academia-adjuntos'
const LIMITE_ARCHIVOS = 5

/**
 * Entrega de tarea (§3.5).
 *
 * Los archivos van a `entregas/<user_id>/…`, el prefijo que la policy de storage
 * de M1 reserva a cada quien. El alumno no puede escribir fuera de su carpeta ni
 * leer la de otro: lo decide Postgres, no este código.
 *
 * La reentrega tras un rechazo funciona por la policy
 * `assignment_submissions_reentrega`, que solo deja pasar de 'rejected' a
 * 'submitted'. Un alumno no puede aprobarse solo aunque manipule la petición.
 */
export async function entregarTarea(
  _previo: ResultadoEntrega,
  datos: FormData
): Promise<ResultadoEntrega> {
  const perfil = await exigirPerfil()

  const tareaId = String(datos.get('assignment_id') ?? '')
  const leccionId = String(datos.get('lesson_id') ?? '')
  const cursoSlug = String(datos.get('curso_slug') ?? '')
  const texto = String(datos.get('texto') ?? '').trim()

  if (!tareaId) return { ok: false, error: 'Falta la tarea.' }

  const supabase = await crearClienteServidor()

  // ¿Puede verla? Lo decide RLS: sin acceso vigente esto no devuelve nada.
  const { data: tarea } = await supabase
    .from('assignments')
    .select('id, allow_files, allow_text')
    .eq('id', tareaId)
    .maybeSingle()

  if (!tarea) return { ok: false, error: 'No tienes acceso a esta tarea.' }

  const { data: previa } = await supabase
    .from('assignment_submissions')
    .select('id, status, files, text_content')
    .eq('assignment_id', tareaId)
    .maybeSingle()

  if (previa?.status === 'approved') {
    return { ok: false, error: 'Esta tarea ya está aprobada.' }
  }

  // --- archivos ---
  const nuevos = datos
    .getAll('archivos')
    .filter((a): a is File => a instanceof File && a.size > 0)

  if (nuevos.length > 0 && !tarea.allow_files) {
    return { ok: false, error: 'Esta tarea no acepta archivos.' }
  }
  if (nuevos.length > LIMITE_ARCHIVOS) {
    return { ok: false, error: `Puedes subir hasta ${LIMITE_ARCHIVOS} archivos.` }
  }

  const anteriores = Array.isArray(previa?.files)
    ? (previa.files as Array<{ storage_path?: string; name?: string }>)
    : []

  let archivos = anteriores
    .filter((a) => typeof a.storage_path === 'string')
    .map((a) => ({ storage_path: a.storage_path as string, name: a.name ?? 'archivo' }))

  if (nuevos.length > 0) {
    const subidos: Array<{ storage_path: string; name: string }> = []

    for (const archivo of nuevos) {
      const limpio = archivo.name.replace(/[^\w.\-]+/g, '_').slice(-120)
      const ruta = `entregas/${perfil.user_id}/${tareaId}/${Date.now()}-${limpio}`

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(ruta, archivo, { contentType: archivo.type || undefined, upsert: false })

      if (error) {
        console.error(
          JSON.stringify({ operacion: 'entregarTarea:subida', ruta, error: error.message })
        )
        // Se limpia lo ya subido para no dejar basura de una entrega a medias.
        if (subidos.length > 0) {
          await supabase.storage.from(BUCKET).remove(subidos.map((s) => s.storage_path))
        }
        return {
          ok: false,
          error: /exceeded|maximum/i.test(error.message)
            ? 'Alguno de tus archivos excede el tamaño permitido.'
            : 'No se pudo subir uno de los archivos. Intenta de nuevo.',
        }
      }

      subidos.push({ storage_path: ruta, name: archivo.name })
    }

    // Los nuevos reemplazan a los anteriores, y los viejos se borran del bucket.
    if (archivos.length > 0) {
      await supabase.storage.from(BUCKET).remove(archivos.map((a) => a.storage_path))
    }
    archivos = subidos
  }

  // --- validación de contenido ---
  const textoFinal = tarea.allow_text ? texto : ''
  if (textoFinal === '' && archivos.length === 0) {
    return {
      ok: false,
      error: tarea.allow_text
        ? 'Escribe tu respuesta o adjunta un archivo.'
        : 'Adjunta al menos un archivo.',
    }
  }

  // --- guardar ---
  const fila = {
    assignment_id: tareaId,
    user_id: perfil.user_id,
    text_content: textoFinal || null,
    files: archivos,
    status: 'submitted' as const,
  }

  const { error } = previa
    ? await supabase.from('assignment_submissions').update(fila).eq('id', previa.id)
    : await supabase.from('assignment_submissions').insert(fila)

  if (error) {
    console.error(
      JSON.stringify({ operacion: 'entregarTarea', tareaId, error: error.message })
    )
    return { ok: false, error: 'No se pudo guardar tu entrega.' }
  }

  revalidatePath(`/curso/${cursoSlug}/${leccionId}`)

  return {
    ok: true,
    aviso: previa
      ? 'Reenviaste tu tarea. La revisaremos de nuevo.'
      : 'Tarea entregada. Te avisamos cuando la revisemos.',
  }
}

/** URL firmada para que el alumno descargue lo que él mismo entregó. */
export async function urlDeArchivoEntregado(rutaStorage: string): Promise<string | null> {
  await exigirPerfil()

  const supabase = await crearClienteServidor()
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(rutaStorage, 60 * 5)

  if (error) {
    console.error(
      JSON.stringify({ operacion: 'urlDeArchivoEntregado', rutaStorage, error: error.message })
    )
    return null
  }
  return data.signedUrl
}
