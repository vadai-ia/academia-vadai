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

/** Qué es, dicho como lo diría la persona: "Excel", no "xlsx". */
function tipoLegible(nombre: string): string {
  const ext = (nombre.split('.').pop() ?? '').toLowerCase()
  if (ext === 'pdf') return 'PDF'
  if (['xlsx', 'xls', 'csv'].includes(ext)) return 'Excel'
  if (['docx', 'doc'].includes(ext)) return 'Word'
  if (['pptx', 'ppt'].includes(ext)) return 'PowerPoint'
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'Imagen'
  if (['zip', 'rar'].includes(ext)) return 'ZIP'
  if (['mp3', 'm4a', 'wav'].includes(ext)) return 'Audio'
  if (['mp4', 'mov'].includes(ext)) return 'Video'
  return ext ? ext.toUpperCase() : 'Archivo'
}

type Adjunto = { id: string; nombre: string; ruta: string; bytes: number | null }

/**
 * Cada archivo es una LOSETA casi cuadrada, y la loseta entera descarga
 * (25-sep-2026). Alejandro, sobre el renglón anterior: "que se vea fácil cada
 * archivo para poder descargarlo, pero que no sea solo un bloquesito que
 * pueda pasar desapercibido".
 *
 * Lo que hace que no pase desapercibida: el icono en un disco cyan, el tipo
 * dicho en cristiano ("Excel · 32 KB") y una pastilla lima que dice
 * "Descargar" —el color de la acción en toda la plataforma—. Dos por fila:
 * en la columna de la lección y en el teléfono caben justas.
 *
 * Descarga por URL firmada de 5 minutos. No hay enlace permanente que copiar
 * y repartir: la firma se pide al hacer clic y la autoriza la policy de
 * storage, que exige acceso vigente.
 */
function Loseta({ adjunto }: { adjunto: Adjunto }) {
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
        className={cn(
          'group flex aspect-[5/6] w-full flex-col items-center justify-between gap-2 rounded-[10px] border border-border bg-card p-3 text-center',
          'transition-[border-color,box-shadow] hover:border-primary/60 hover:shadow-[0_1px_2px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.06)]',
          'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60'
        )}
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <IconoArchivo />
        </span>

        <span className="flex min-w-0 flex-col items-center gap-0.5">
          <span className="line-clamp-2 text-sm leading-snug font-medium break-words">
            {adjunto.nombre}
          </span>
          <span className={cn('text-xs', fallo ? 'text-destructive' : 'text-muted-foreground')}>
            {fallo
              ? 'No se pudo abrir'
              : [tipoLegible(adjunto.nombre), tamanoLegible(adjunto.bytes)].filter(Boolean).join(' · ')}
          </span>
        </span>

        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground transition-[filter] group-hover:brightness-95">
          {pendiente ? 'Abriendo…' : fallo ? 'Reintentar' : 'Descargar'}
          <IconoDescarga />
        </span>
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
      <ul className="grid grid-cols-2 gap-3">
        {adjuntos.map((adjunto) => (
          <Loseta key={adjunto.id} adjunto={adjunto} />
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
      className="size-5"
      aria-hidden
    >
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M9 13h6M9 17h6" />
    </svg>
  )
}

function IconoDescarga() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5"
      aria-hidden
    >
      <path d="M12 4v11" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  )
}
