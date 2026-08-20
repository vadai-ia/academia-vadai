'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { urlDeAdjunto } from '@/lib/alumno/acciones'

function tamanoLegible(bytes: number | null): string {
  if (bytes === null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type Adjunto = { id: string; nombre: string; ruta: string; bytes: number | null }

/**
 * Descarga por URL firmada de 5 minutos.
 *
 * No hay enlace permanente que copiar y repartir: la firma se pide al hacer clic
 * y la autoriza la policy de storage, que exige acceso vigente.
 */
function Fila({ adjunto }: { adjunto: Adjunto }) {
  const [pendiente, iniciar] = useTransition()
  const [fallo, setFallo] = useState(false)

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm">{adjunto.nombre}</span>
        <span className="text-xs text-muted-foreground">{tamanoLegible(adjunto.bytes)}</span>
      </span>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pendiente}
        onClick={() =>
          iniciar(async () => {
            const url = await urlDeAdjunto(adjunto.ruta)
            if (url) window.open(url, '_blank', 'noopener,noreferrer')
            else setFallo(true)
          })
        }
      >
        {pendiente ? 'Abriendo…' : fallo ? 'No disponible' : 'Descargar'}
      </Button>
    </li>
  )
}

export function AdjuntosAlumno({ adjuntos }: { adjuntos: Adjunto[] }) {
  if (adjuntos.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">Material de la lección</h2>
      <ul className="flex flex-col gap-2">
        {adjuntos.map((adjunto) => (
          <Fila key={adjunto.id} adjunto={adjunto} />
        ))}
      </ul>
    </section>
  )
}
