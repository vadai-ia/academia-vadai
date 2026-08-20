import 'server-only'

import { createHash } from 'node:crypto'

/**
 * Bunny Stream (§7.2).
 *
 * ⚠️ SIN VERIFICAR contra la API real: las credenciales de Bunny todavía no
 * existen en .env.local. El código sigue la documentación de Bunny y el spec,
 * pero nadie lo ha ejecutado. Para comprobarlo en cuanto haya credenciales:
 *
 *   node scripts/check-bunny.mjs
 *
 * Mientras tanto funciona el respaldo que contempla §11: subir el video en el
 * panel de Bunny y pegar su GUID en el admin. Ese camino sí está probado.
 *
 * La llave `BUNNY_STREAM_API_KEY` jamás sale del servidor. El navegador solo
 * recibe una firma de subida con caducidad, nunca la llave.
 */

const API = 'https://video.bunnycdn.com'

type Configuracion = {
  libraryId: string
  apiKey: string
  cdnHostname: string
}

function configuracion(): Configuracion {
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID
  const apiKey = process.env.BUNNY_STREAM_API_KEY
  const cdnHostname = process.env.BUNNY_STREAM_CDN_HOSTNAME

  if (!libraryId || !apiKey || !cdnHostname) {
    throw new Error(
      'Faltan las variables de Bunny Stream (BUNNY_STREAM_LIBRARY_ID, ' +
        'BUNNY_STREAM_API_KEY, BUNNY_STREAM_CDN_HOSTNAME). Ver .env.local.example.'
    )
  }

  return { libraryId, apiKey, cdnHostname }
}

/** ¿Ya se puede usar Bunny, o seguimos con el respaldo manual? */
export function bunnyConfigurado(): boolean {
  return Boolean(
    process.env.BUNNY_STREAM_LIBRARY_ID &&
      process.env.BUNNY_STREAM_API_KEY &&
      process.env.BUNNY_STREAM_CDN_HOSTNAME
  )
}

export type VideoCreado = {
  guid: string
  libraryId: string
}

/**
 * Crea el registro del video en Bunny y devuelve su GUID.
 *
 * Es el primer paso de §7.2: se crea server-side (con la llave, que no puede
 * viajar al navegador) y después el cliente sube el archivo por TUS usando una
 * firma temporal.
 */
export async function crearVideo(titulo: string): Promise<VideoCreado> {
  const { libraryId, apiKey } = configuracion()

  const respuesta = await fetch(`${API}/library/${libraryId}/videos`, {
    method: 'POST',
    headers: {
      AccessKey: apiKey,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ title: titulo }),
  })

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '')
    throw new Error(`Bunny rechazó la creación del video (${respuesta.status}): ${detalle.slice(0, 200)}`)
  }

  const cuerpo = (await respuesta.json()) as { guid?: string }
  if (!cuerpo.guid) throw new Error('Bunny no devolvió el GUID del video.')

  return { guid: cuerpo.guid, libraryId }
}

export type FirmaDeSubida = {
  endpoint: string
  videoId: string
  libraryId: string
  expiracion: number
  firma: string
}

/**
 * Firma para que el navegador suba el archivo por TUS directo a Bunny.
 *
 * Bunny especifica: sha256(libraryId + apiKey + expiration + videoId), con
 * `expiration` en segundos UNIX. La llave entra en el hash pero nunca se
 * transmite: el navegador solo recibe el resultado.
 */
export function firmarSubida(videoId: string, minutosDeVida = 60): FirmaDeSubida {
  const { libraryId, apiKey } = configuracion()
  const expiracion = Math.floor(Date.now() / 1000) + minutosDeVida * 60

  const firma = createHash('sha256')
    .update(`${libraryId}${apiKey}${expiracion}${videoId}`)
    .digest('hex')

  return {
    endpoint: `${API}/tusupload`,
    videoId,
    libraryId,
    expiracion,
    firma,
  }
}

export type EstadoVideo = {
  guid: string
  titulo: string
  duracionSeg: number
  listo: boolean
}

/**
 * Consulta el estado del video. Bunny procesa en segundo plano: `status = 4`
 * (Finished) significa que ya se puede reproducir. Sirve para capturar la
 * duración automáticamente, como pide §3.2.
 */
export async function consultarVideo(videoId: string): Promise<EstadoVideo> {
  const { libraryId, apiKey } = configuracion()

  const respuesta = await fetch(`${API}/library/${libraryId}/videos/${videoId}`, {
    headers: { AccessKey: apiKey, accept: 'application/json' },
  })

  if (!respuesta.ok) {
    throw new Error(`Bunny no devolvió el video ${videoId} (${respuesta.status}).`)
  }

  const cuerpo = (await respuesta.json()) as {
    guid: string
    title: string
    length?: number
    status?: number
  }

  return {
    guid: cuerpo.guid,
    titulo: cuerpo.title,
    duracionSeg: cuerpo.length ?? 0,
    listo: cuerpo.status === 4,
  }
}
