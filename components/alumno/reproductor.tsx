'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

import { guardarAvance } from '@/lib/alumno/acciones'
import { cn } from '@/lib/utils'

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
 *
 * Cuando el servidor la da por completa, la página se refresca: el bloque de
 * cierre (`cierre-de-leccion.tsx`) pasa a "Completada" y la barra del curso
 * avanza. Antes este componente pintaba su propio "Lección completada" en
 * chico bajo el video mientras el botón de abajo seguía diciendo "Marcar como
 * completada": dos verdades en la misma pantalla (25-sep-2026).
 */

const CONTEXTO = 'player.js'

/** Nunca más seguido que esto, nunca más espaciado que aquello. */
const MINIMO_SEG = 15
const MAXIMO_SEG = 60

/**
 * Cada cuánto se guarda el avance, según lo que dure el video.
 *
 * Era fijo en 15 segundos, pensado para lecciones de cinco minutos. Con las
 * grabaciones de sesión —tres horas— eso son 720 guardados por persona y por
 * visualización, cada uno su propia llamada al servidor: ciento y pico de
 * alumnos convertían una grabación en cien mil invocaciones, para un dato que
 * solo sirve para retomar donde te quedaste.
 *
 * Proporcional: unos 240 guardados pase lo que pase. Una lección corta sigue
 * guardando cada 15 segundos; una de tres horas, cada 45.
 */
function cadaCuanto(duracionSeg: number | null): number {
  if (!duracionSeg || duracionSeg <= 0) return MINIMO_SEG
  return Math.min(MAXIMO_SEG, Math.max(MINIMO_SEG, Math.round(duracionSeg / 240)))
}

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
  className,
}: {
  urlIframe: string
  leccionId: string
  cursoSlug: string
  duracionSeg: number | null
  yaCompletada: boolean
  titulo: string
  className?: string
}) {
  const router = useRouter()
  const iframe = useRef<HTMLIFrameElement>(null)
  const ultimoGuardado = useRef(0)
  const completada = useRef(yaCompletada)

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

        if (segundos - ultimoGuardado.current < cadaCuanto(duracion || duracionSeg)) return
        ultimoGuardado.current = segundos

        void guardarAvance(leccionId, segundos, duracion || duracionSeg, cursoSlug).then(
          (resultado) => {
            if (resultado.completada && !completada.current) {
              completada.current = true
              router.refresh()
            }
          }
        )
      }
    }

    window.addEventListener('message', alRecibir)
    return () => window.removeEventListener('message', alRecibir)
  }, [leccionId, cursoSlug, duracionSeg, router])

  return (
    // En el teléfono el video va de borde a borde, sin marco: cada píxel de
    // ancho es imagen. A partir de `sm` recupera el radio y el borde de las
    // demás superficies.
    <div
      className={cn(
        'relative aspect-video overflow-hidden bg-black sm:rounded-[10px] sm:border sm:border-border',
        className
      )}
    >
      <iframe
        ref={iframe}
        src={urlIframe}
        title={titulo}
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        className="absolute inset-0 size-full"
      />
    </div>
  )
}
