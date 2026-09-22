import 'server-only'

import { createHash } from 'node:crypto'

/**
 * Firma de reproducción de Bunny Stream (§7.2).
 *
 * Bunny especifica: token = sha256(security_key + video_id + expiration), con
 * `expiration` en segundos UNIX. La `BUNNY_STREAM_TOKEN_KEY` entra en el hash
 * pero nunca se transmite.
 *
 * La firma se genera en el server component de la lección y SOLO si el
 * enrollment está vigente. Nunca en el cliente, nunca sin verificar acceso.
 * Caduca a las 6 horas: si alguien copia la URL del iframe, lo que reparte es
 * un pase que vence, no el video.
 */

/** 6 horas, según §7.2. */
const VIDA_SEG = 6 * 60 * 60

export type Reproduccion = {
  urlIframe: string
  expiraEn: number
}

export function firmarReproduccion(videoId: string): Reproduccion {
  const llave = process.env.BUNNY_STREAM_TOKEN_KEY
  const biblioteca = process.env.BUNNY_STREAM_LIBRARY_ID

  if (!llave || !biblioteca) {
    throw new Error(
      'Faltan BUNNY_STREAM_TOKEN_KEY o BUNNY_STREAM_LIBRARY_ID. Ver .env.local.example.'
    )
  }

  const expira = Math.floor(Date.now() / 1000) + VIDA_SEG
  const token = createHash('sha256').update(`${llave}${videoId}${expira}`).digest('hex')

  // `preload: false` desde el 22-sep-2026, con las grabaciones de sesión de
  // tres horas a la vista. Precargar gastaba datos del alumno en cuanto abría
  // la lección, aunque solo hubiera entrado a ver de qué iba; en un teléfono
  // con plan medido eso es cobrarle por no ver nada. El costo es que el play
  // tarda una fracción de segundo más en arrancar.
  const parametros = new URLSearchParams({
    token,
    expires: String(expira),
    autoplay: 'false',
    preload: 'false',
  })

  return {
    urlIframe: `https://iframe.mediadelivery.net/embed/${biblioteca}/${videoId}?${parametros}`,
    expiraEn: expira,
  }
}

export function reproduccionConfigurada(): boolean {
  return Boolean(process.env.BUNNY_STREAM_TOKEN_KEY && process.env.BUNNY_STREAM_LIBRARY_ID)
}
