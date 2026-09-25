'use client'

import { useState, useTransition } from 'react'

import { urlDeAdjunto } from '@/lib/alumno/acciones'
import { cn } from '@/lib/utils'

function tamanoLegible(bytes: number | null): string {
  if (bytes === null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type Adjunto = { id: string; nombre: string; ruta: string; bytes: number | null }

/**
 * Un archivo es UN renglón y el renglón entero descarga (25-sep-2026).
 *
 * Antes cada archivo era una tarjeta a todo lo ancho con el nombre a la
 * izquierda y un botón "Descargar" suelto en la otra punta: en escritorio
 * había que cruzar media pantalla para bajar lo que acababas de leer, y en el
 * teléfono el botón caía debajo, como si fuera otra cosa. Ahora el blanco es
 * toda la fila, con el icono del archivo, su nombre y su peso.
 *
 * Descarga por URL firmada de 5 minutos. No hay enlace permanente que copiar
 * y repartir: la firma se pide al hacer clic y la autoriza la policy de
 * storage, que exige acceso vigente.
 */
function Fila({ adjunto }: { adjunto: Adjunto }) {
  const [pendiente, iniciar] = useTransition()
  const [fallo, setFallo] = useState(false)

  return (
    <li>
      <button
        type="button"
        disabled={pendiente}
        title={adjunto.nombre}
        aria-label={`Descargar ${adjunto.nombre}`}
        onClick={() =>
          iniciar(async () => {
            setFallo(false)
            const url = await urlDeAdjunto(adjunto.ruta)
            if (url) window.open(url, '_blank', 'noopener,noreferrer')
            else setFallo(true)
          })
        }
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60"
      >
        <IconoArchivo />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{adjunto.nombre}</span>
          <span className={cn('text-xs', fallo ? 'text-destructive' : 'text-muted-foreground')}>
            {pendiente ? 'Abriendo…' : fallo ? 'No se pudo abrir. Intenta de nuevo.' : tamanoLegible(adjunto.bytes)}
          </span>
        </span>
        <IconoDescarga />
      </button>
    </li>
  )
}

export function AdjuntosAlumno({ adjuntos, className }: { adjuntos: Adjunto[]; className?: string }) {
  if (adjuntos.length === 0) return null

  return (
    <section aria-labelledby="material" className={cn('flex flex-col gap-2', className)}>
      <h2 id="material" className="text-sm font-medium">
        Material de esta lección
      </h2>
      <ul className="divide-y divide-border overflow-hidden rounded-[10px] border border-border bg-card">
        {adjuntos.map((adjunto) => (
          <Fila key={adjunto.id} adjunto={adjunto} />
        ))}
      </ul>
    </section>
  )
}

function IconoArchivo() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 shrink-0 text-muted-foreground"
      aria-hidden
    >
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
    </svg>
  )
}

function IconoDescarga() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0 text-muted-foreground"
      aria-hidden
    >
      <path d="M12 4v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  )
}
