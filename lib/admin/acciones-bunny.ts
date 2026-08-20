'use server'

import { revalidatePath } from 'next/cache'

import { exigirAdmin } from '@/lib/auth/sesion'
import { consultarVideo, crearVideo, firmarSubida } from '@/lib/bunny/cliente'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * Subida de video a Bunny Stream (§7.2).
 *
 * El archivo NO pasa por nuestro servidor: viaja del navegador a Bunny por TUS
 * resumible. Un video de 2 GB reventaría el límite de body de cualquier server
 * action, y además pagaríamos el ancho de banda dos veces.
 *
 * Lo que sí ocurre en el servidor es lo único que no puede ocurrir en el
 * navegador: crear el registro del video y firmar la subida. La
 * BUNNY_STREAM_API_KEY nunca sale de aquí; el cliente solo recibe una firma
 * que caduca.
 */

export type PreparacionSubida =
  | { ok: true; guid: string; libraryId: string; endpoint: string; expiracion: number; firma: string }
  | { ok: false; error: string }

/** Paso 1: crea el video en Bunny y devuelve la firma para subirlo. */
export async function prepararSubida(
  leccionId: string,
  titulo: string
): Promise<PreparacionSubida> {
  await exigirAdmin()

  try {
    const { guid } = await crearVideo(titulo || 'Lección sin título')
    const firma = firmarSubida(guid)

    // Se guarda el GUID de inmediato: si la subida se corta a medio camino, el
    // video existe en Bunny y se puede reanudar o reemplazar sin perder el
    // vínculo con la lección.
    const supabase = await crearClienteServidor()
    const { error } = await supabase
      .from('lessons')
      .update({ bunny_video_id: guid })
      .eq('id', leccionId)

    if (error) {
      console.error(JSON.stringify({ operacion: 'prepararSubida', leccionId, error: error.message }))
      return { ok: false, error: 'Se creó el video pero no se pudo asociar a la lección.' }
    }

    return {
      ok: true,
      guid,
      libraryId: firma.libraryId,
      endpoint: firma.endpoint,
      expiracion: firma.expiracion,
      firma: firma.firma,
    }
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : 'Error desconocido'
    console.error(JSON.stringify({ operacion: 'prepararSubida', leccionId, error: mensaje }))
    return {
      ok: false,
      error: /Faltan las variables/.test(mensaje)
        ? 'Bunny Stream no está configurado. Revisa las variables BUNNY_STREAM_*.'
        : 'Bunny rechazó la creación del video.',
    }
  }
}

export type ResultadoConfirmacion = {
  ok: boolean
  mensaje: string
  duracionSeg?: number
  listo?: boolean
}

/**
 * Paso 2: terminada la subida, se le pregunta a Bunny cuánto dura el video y se
 * guarda. Es la "duración auto-capturada" de §3.2.
 *
 * Bunny procesa en segundo plano, así que puede tardar en reportar la duración.
 * Si todavía no la tiene, se dice y el admin puede reintentar; no se bloquea la
 * pantalla esperando.
 */
export async function confirmarSubida(
  leccionId: string,
  guid: string,
  cursoId: string
): Promise<ResultadoConfirmacion> {
  await exigirAdmin()

  try {
    const video = await consultarVideo(guid)

    const supabase = await crearClienteServidor()
    const { error } = await supabase
      .from('lessons')
      .update({
        bunny_video_id: guid,
        video_duration_sec: video.duracionSeg > 0 ? video.duracionSeg : null,
      })
      .eq('id', leccionId)

    if (error) {
      console.error(JSON.stringify({ operacion: 'confirmarSubida', leccionId, error: error.message }))
      return { ok: false, mensaje: 'El video subió pero no se pudo guardar en la lección.' }
    }

    revalidatePath(`/admin/lecciones/${leccionId}`)
    revalidatePath(`/admin/cursos/${cursoId}`)

    return {
      ok: true,
      duracionSeg: video.duracionSeg,
      listo: video.listo,
      mensaje: video.listo
        ? `Video listo${video.duracionSeg ? ` · ${Math.round(video.duracionSeg / 60)} min` : ''}.`
        : 'Video subido. Bunny lo está procesando; la duración aparecerá en unos minutos.',
    }
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : 'Error desconocido'
    console.error(JSON.stringify({ operacion: 'confirmarSubida', leccionId, error: mensaje }))
    return { ok: false, mensaje: 'No se pudo consultar el estado del video en Bunny.' }
  }
}
