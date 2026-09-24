'use server'

import { revalidatePath } from 'next/cache'

import type { EstadoAccion } from '@/lib/admin/tipos'
import { exigirAdmin } from '@/lib/auth/sesion'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * Subida de adjuntos directo del navegador a Supabase Storage (24-sep-2026).
 *
 * Nació de un error en producción: Alejandro arrastró el manual del curso a
 * una lección nueva, apretó "Subir", y la plataforma le devolvió la pantalla
 * de error genérica. El archivo nunca llegó. Next.js corta el cuerpo de una
 * server action en 1 MB, y Vercel en 4.5 MB: cualquier PDF de verdad se
 * quedaba en el camino, antes de que nuestro código lo tocara, y por eso ni
 * siquiera había un mensaje que dar.
 *
 * Es el mismo patrón que el video con Bunny: el archivo NO pasa por nuestro
 * servidor. Aquí solo ocurre lo que no puede ocurrir en el navegador —firmar
 * la subida y registrar el resultado— y el bucket es quien pone el techo:
 * 100 MB (academia_0015_storage.sql).
 *
 * El formulario sin JavaScript sigue existiendo, con `subirAdjunto` de
 * lib/admin/acciones.ts, para archivos chicos. Este es el camino con JS.
 */

const BUCKET = 'academia-adjuntos'

/** El del bucket. Se revisa aquí para poder decirlo con palabras. */
const MAXIMO_BYTES = 100 * 1024 * 1024

function registrarFallo(operacion: string, detalle: Record<string, unknown>, error: string) {
  console.error(JSON.stringify({ operacion, ...detalle, error }))
}

export type PreparacionAdjunto =
  | { ok: true; ruta: string; urlFirmada: string }
  | { ok: false; error: string }

/**
 * Paso 1: la URL firmada para subir UN archivo a UNA ruta.
 *
 * La firma vale dos horas y solo sirve para esa ruta: lo más que permitiría a
 * quien la copiara es subir algo a la carpeta de esta lección, que es lo que el
 * admin iba a hacer de todas formas.
 */
export async function prepararSubidaDeAdjunto(
  leccionId: string,
  nombre: string,
  tamano: number
): Promise<PreparacionAdjunto> {
  await exigirAdmin()

  if (!leccionId) return { ok: false, error: 'Falta la lección.' }
  if (!nombre) return { ok: false, error: 'Elige un archivo.' }
  if (tamano <= 0) return { ok: false, error: 'El archivo está vacío.' }
  if (tamano > MAXIMO_BYTES) {
    return {
      ok: false,
      error: `El archivo pesa ${(tamano / 1048576).toFixed(0)} MB y el máximo es 100 MB.`,
    }
  }

  // Misma convención que la subida sin JS: prefijo por lección y marca de
  // tiempo, para que dos archivos con el mismo nombre no se pisen.
  const limpio = nombre.replace(/[^\w.\-]+/g, '_').slice(-120)
  const ruta = `lecciones/${leccionId}/${Date.now()}-${limpio}`

  const supabase = await crearClienteServidor()
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(ruta)

  if (error || !data) {
    registrarFallo('prepararSubidaDeAdjunto', { leccionId, ruta }, error?.message ?? 'sin datos')
    return { ok: false, error: 'No se pudo preparar la subida. Intenta de nuevo.' }
  }

  return { ok: true, ruta: data.path, urlFirmada: data.signedUrl }
}

/**
 * Paso 2: el archivo ya está en el bucket; se registra en la lección.
 *
 * Antes de registrar se comprueba que el objeto exista de verdad. Sin eso, una
 * subida cortada a la mitad dejaría una fila que apunta a nada, y el alumno
 * vería un adjunto que al descargar da error.
 */
export async function confirmarAdjunto(opciones: {
  leccionId: string
  cursoId: string
  ruta: string
  nombre: string
  mime: string | null
  tamano: number
}): Promise<EstadoAccion> {
  await exigirAdmin()

  const { leccionId, cursoId, ruta, nombre, mime, tamano } = opciones
  if (!leccionId || !ruta || !nombre) return { error: 'Faltan datos del archivo.' }

  // La ruta tiene que ser de ESTA lección: no se registra en una lección un
  // archivo subido a la carpeta de otra.
  if (!ruta.startsWith(`lecciones/${leccionId}/`)) {
    return { error: 'La ruta del archivo no corresponde a esta lección.' }
  }

  const supabase = await crearClienteServidor()

  const carpeta = ruta.slice(0, ruta.lastIndexOf('/'))
  const objeto = ruta.slice(ruta.lastIndexOf('/') + 1)
  const { data: existentes, error: errorLista } = await supabase.storage
    .from(BUCKET)
    .list(carpeta, { search: objeto, limit: 5 })

  if (errorLista || !existentes?.some((o) => o.name === objeto)) {
    registrarFallo('confirmarAdjunto:noExiste', { leccionId, ruta }, errorLista?.message ?? 'no está')
    return { error: 'El archivo no llegó completo al almacén. Vuelve a subirlo.' }
  }

  const { error } = await supabase.from('lesson_attachments').insert({
    lesson_id: leccionId,
    storage_path: ruta,
    file_name: nombre,
    mime_type: mime || null,
    size_bytes: tamano,
  })

  if (error) {
    // La fila no se creó: el archivo quedaría huérfano en el bucket.
    await supabase.storage.from(BUCKET).remove([ruta])
    registrarFallo('confirmarAdjunto:registro', { leccionId, ruta }, error.message)
    return { error: 'Se subió el archivo pero no se pudo registrar. Intenta de nuevo.' }
  }

  revalidatePath(`/admin/lecciones/${leccionId}`)
  if (cursoId) revalidatePath(`/admin/cursos/${cursoId}`)
  return { aviso: `"${nombre}" agregado.` }
}
