'use client'

import { useEffect, useRef, useState } from 'react'

import { guardarAvance } from '@/lib/alumno/acciones'

/**
 * Player de Bunny con autocompletado al 90% (§3.3).
 *
 * El iframe implementa el protocolo Player.js, que se habla por postMessage. No
 * hace falta librería: son dos mensajes, uno para suscribirse y otro que llega
 * con el tiempo. Menos dependencias, menos superficie.
 *
 * Handshake:
 *   iframe → { context: 'player.js', event: 'ready' }
 *   nosotros → { context: 'player.js', method: 'addEventListener', value: 'timeupdate' }
 *   iframe → { context: 'player.js', event: 'timeupdate', value: { seconds, duration } }
 *
 * El avance se guarda cada 15 segundos, no en cada evento: `timeupdate` dispara
 * varias veces por segundo y sería una tormenta de escrituras.
 *
 * Quién decide que la lección está completa es el SERVIDOR. Aquí solo se reporta
 * cuántos segundos van; si el cliente pudiera declarar "ya terminé", completar
 * el curso entero sería una sola petición.
 */

const CONTEXTO = 'player.js'
const CADA_SEG = 15

type MensajePlayer = {
  context?: string
  event?: string
  value?: { seconds?: number; duration?: number }
}

export function Reproductor({
  urlIframe,
  leccionId,
  cursoSlug,
  duracionSeg,
  yaCompletada,
  titulo,
}: {
  urlIframe: string
  leccionId: string
  cursoSlug: string
  duracionSeg: number | null
  yaCompletada: boolean
  titulo: string
}) {
  const iframe = useRef<HTMLIFrameElement>(null)
  const ultimoGuardado = useRef(0)
  const [completada, setCompletada] = useState(yaCompletada)

  useEffect(() => {
    function alRecibir(evento: MessageEvent) {
      // Solo mensajes del iframe del player, y solo del protocolo esperado.
      if (evento.source !== iframe.current?.contentWindow) return

      let datos: MensajePlayer
      try {
        datos = typeof evento.data === 'string' ? JSON.parse(evento.data) : evento.data
      } catch {
        return
      }
      if (datos?.context !== CONTEXTO) return

      if (datos.event === 'ready') {
        evento.source?.postMessage(
          JSON.stringify({
            context: CONTEXTO,
            version: '0.0.11',
            method: 'addEventListener',
            value: 'timeupdate',
            listener: 'timeupdate',
          }),
          { targetOrigin: '*' }
        )
        return
      }

      if (datos.event === 'timeupdate') {
        const segundos = Math.floor(datos.value?.seconds ?? 0)
        const duracion = Math.floor(datos.value?.duration ?? duracionSeg ?? 0)
        if (segundos <= 0) return

        if (segundos - ultimoGuardado.current < CADA_SEG) return
        ultimoGuardado.current = segundos

        void guardarAvance(leccionId, segundos, duracion || duracionSeg, cursoSlug).then(
          (resultado) => {
            if (resultado.completada) setCompletada(true)
          }
        )
      }
    }

    window.addEventListener('message', alRecibir)
    return () => window.removeEventListener('message', alRecibir)
  }, [leccionId, cursoSlug, duracionSeg])

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-black">
        <iframe
          ref={iframe}
          src={urlIframe}
          title={titulo}
          loading="lazy"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="absolute inset-0 size-full"
        />
      </div>

      {completada ? (
        <p className="text-xs text-exito" role="status">
          Lección completada
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Se marca sola cuando llegues al 90% del video.
        </p>
      )}
    </div>
  )
}
