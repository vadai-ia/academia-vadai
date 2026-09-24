'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

/**
 * La rayita de arriba que dice "ya voy" cuando tocas un enlace (24-sep-2026).
 *
 * Las páginas del alumno se piden completas al servidor en cada clic —son
 * personales, no se pueden precalcular— y por diseño no llevan `loading.tsx`
 * (ver components/marca/esqueleto.tsx). Eso deja un hueco: entre el clic y la
 * página nueva no pasa NADA visible durante medio segundo, y medio segundo sin
 * señal se siente como un clic que no entró. La gente vuelve a apretar.
 *
 * Esto no acelera nada; hace visible que algo está pasando, que es la mitad de
 * lo que "rápido" significa para quien usa la plataforma.
 *
 * Escucha los clics en enlaces internos de la página y se apaga en cuanto
 * cambia la ruta. Sin JavaScript no existe, y no hace falta: sin JavaScript el
 * navegador ya muestra su propio indicador de carga.
 */
export function BarraDeNavegacion() {
  const ruta = usePathname()
  const parametros = useSearchParams()
  const [activa, setActiva] = useState(false)

  // Llegó la página nueva: se apaga.
  useEffect(() => {
    setActiva(false)
  }, [ruta, parametros])

  useEffect(() => {
    const alClic = (evento: MouseEvent) => {
      if (evento.defaultPrevented || evento.button !== 0) return
      if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return

      const enlace = (evento.target as Element | null)?.closest('a[href]')
      if (!(enlace instanceof HTMLAnchorElement)) return
      if (enlace.target === '_blank' || enlace.hasAttribute('download')) return

      const destino = new URL(enlace.href, window.location.href)
      if (destino.origin !== window.location.origin) return
      // Un ancla en la misma página no navega.
      if (destino.pathname === window.location.pathname && destino.search === window.location.search) return

      setActiva(true)
    }

    document.addEventListener('click', alClic)
    return () => document.removeEventListener('click', alClic)
  }, [])

  // Red de seguridad: si algo impidió que cambiara la ruta, no se queda
  // encendida para siempre.
  useEffect(() => {
    if (!activa) return
    const reloj = setTimeout(() => setActiva(false), 10_000)
    return () => clearTimeout(reloj)
  }, [activa])

  if (!activa) return null

  return (
    <div
      role="progressbar"
      aria-label="Cargando la página"
      aria-valuetext="Cargando"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-primary/15"
    >
      <div className="h-full w-1/3 rounded-full bg-primary motion-safe:animate-[barra-de-navegacion_1.1s_ease-in-out_infinite]" />
    </div>
  )
}
