'use client'

import { useEffect, useState } from 'react'

import { LLAVE_TEMA, type Tema } from '@/lib/tema/guion'
import { cn } from '@/lib/utils'

/**
 * Botón de tema, arriba a la derecha.
 *
 * Mientras nadie lo toque, el tema lo decide el sistema operativo — y eso lo
 * resuelve el CSS con `light-dark()`, no este componente. Al primer clic la
 * elección se guarda y manda sobre el sistema, que es lo que espera quien se
 * toma la molestia de cambiarlo.
 *
 * Tres detalles que parecen de adorno y no lo son:
 *
 *   1. Antes de montar no se pinta ningún icono. El servidor no sabe qué tema
 *      tiene el visitante, así que dibujar uno al azar mostraría el icono
 *      equivocado durante un instante. Se reserva el espacio exacto para que
 *      el encabezado no salte cuando aparezca.
 *   2. `.cambiando-tema` habilita la transición de color SOLO durante el
 *      cambio. Dejarla siempre puesta volvería pastoso el hover de todo.
 *   3. Mientras no haya elección guardada, sigue al sistema en vivo: si el
 *      equipo cambia de modo a media tarde, la página cambia con él.
 */
export function CambiarTema({ className }: { className?: string }) {
  const [oscuro, setOscuro] = useState<boolean | null>(null)

  useEffect(() => {
    const raiz = document.documentElement

    /** Lo que se está viendo ahora, venga de la clase o del sistema. */
    const leerActual = () => {
      if (raiz.classList.contains('dark')) return true
      if (raiz.classList.contains('light')) return false
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }

    setOscuro(leerActual())

    const consulta = window.matchMedia('(prefers-color-scheme: dark)')
    const alCambiarSistema = (evento: MediaQueryListEvent) => {
      // Con elección guardada, el sistema ya no manda.
      try {
        if (localStorage.getItem(LLAVE_TEMA)) return
      } catch {
        return
      }
      setOscuro(evento.matches)
    }

    consulta.addEventListener('change', alCambiarSistema)
    return () => consulta.removeEventListener('change', alCambiarSistema)
  }, [])

  function alternar() {
    const siguiente: Tema = oscuro ? 'claro' : 'oscuro'
    const raiz = document.documentElement

    raiz.classList.add('cambiando-tema')
    raiz.classList.toggle('dark', siguiente === 'oscuro')
    raiz.classList.toggle('light', siguiente === 'claro')

    try {
      localStorage.setItem(LLAVE_TEMA, siguiente)
    } catch {
      // Almacenamiento bloqueado: el cambio vale para esta sesión y ya.
    }

    window.setTimeout(() => raiz.classList.remove('cambiando-tema'), 220)
    setOscuro(siguiente === 'oscuro')
  }

  const clases = cn(
    'inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full',
    'text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
    'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
    className
  )

  // Sin montar todavía: hueco del mismo tamaño para que nada salte.
  if (oscuro === null) {
    return <span className={clases} aria-hidden />
  }

  return (
    <button
      type="button"
      onClick={alternar}
      className={clases}
      aria-label={oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      title={oscuro ? 'Tema claro' : 'Tema oscuro'}
    >
      {oscuro ? <IconoSol /> : <IconoLuna />}
    </button>
  )
}

/* Iconos en SVG y no emoji: el emoji cambia de forma en cada sistema, no hereda
   el color del texto y no se puede alinear con precisión. */

function IconoLuna() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[18px]"
      aria-hidden
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  )
}

function IconoSol() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[18px]"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}
