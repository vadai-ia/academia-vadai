'use client'

import { useEffect, useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { estadoDe, type EstadoSesion } from '@/lib/calendario/estado'

/**
 * El botón de entrar a una sesión en vivo.
 *
 * Es el ÚNICO pedazo de cliente de la pestaña En vivo, y solo porque necesita
 * un reloj: se enciende quince minutos antes sin que nadie recargue.
 *
 * `estadoInicial` lo calcula el servidor y es lo que se pinta en el primer
 * render: así el HTML del servidor y el primer render del navegador dicen
 * exactamente lo mismo (si no, React tira la página entera — el 418 del día
 * del lanzamiento). A partir de ahí, el reloj manda.
 */
export function BotonUnirse({
  inicioIso,
  meetUrl,
  estadoInicial,
  tamano = 'lg',
}: {
  inicioIso: string
  meetUrl: string | null
  estadoInicial: EstadoSesion
  tamano?: 'lg' | 'sm'
}) {
  const [ahora, setAhora] = useState(0)
  const idAyuda = useId()

  useEffect(() => {
    setAhora(Date.now())
    const reloj = setInterval(() => setAhora(Date.now()), 30_000)
    return () => clearInterval(reloj)
  }, [])

  const estado = ahora === 0 ? estadoInicial : estadoDe(inicioIso, ahora)

  if (!meetUrl) {
    return (
      <span className="text-sm text-muted-foreground">
        La liga para entrar se publica aquí antes de la sesión.
      </span>
    )
  }
  if (estado === 'pasada') return null

  if (estado === 'proxima') {
    return (
      <span className="flex flex-col gap-1">
        <Button size={tamano} disabled aria-describedby={idAyuda}>
          Unirse a la sesión
        </Button>
        {/* Visible, no en un `title`: en un teléfono no hay a dónde apuntar. */}
        <span id={idAyuda} className="text-xs text-muted-foreground">
          El botón se activa 15 minutos antes.
        </span>
      </span>
    )
  }

  return (
    <Button asChild size={tamano}>
      <a href={meetUrl} target="_blank" rel="noopener noreferrer">
        {estado === 'enCurso' ? 'Entrar a la sesión' : 'Unirse a la sesión'}
      </a>
    </Button>
  )
}
