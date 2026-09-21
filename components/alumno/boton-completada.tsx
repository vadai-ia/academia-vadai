'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { alternarCompletada } from '@/lib/alumno/acciones'
import { PUNTOS } from '@/lib/gamificacion/reglas'

/**
 * Marcar una lección como completada.
 *
 * **Rediseñado el 21-sep-2026**: "lo de marcar completado no es la cosa más
 * intuitiva". Antes era un solo botón que cambiaba de texto entre "Marcar como
 * completada" y "✓ Completada". Dos problemas: nada decía PARA QUÉ sirve
 * marcarla, y ya marcada seguía pareciendo un botón que había que apretar, así
 * que la gente la desmarcaba sin querer.
 *
 * Ahora son dos estados que se ven distintos:
 *   - Pendiente: un botón grande con un círculo vacío —la forma universal de
 *     "falta esto"— y debajo, en chico, qué gana al apretarlo.
 *   - Hecha: ya no es un botón. Es una placa verde con palomita que dice
 *     "Completada", y deshacer queda en una liga discreta al lado.
 *
 * Al completarla aparece "+10 puntos", con un zoom y un ascenso, y se va solo a
 * los tres segundos. Es el refuerzo inmediato de la gamificación: el número
 * grande está en Mis cursos, pero el momento en que se ganan los puntos es
 * aquí. Al desmarcar no sale nada: quitar puntos no se festeja.
 */
export function BotonCompletada({
  leccionId,
  cursoSlug,
  completadaInicial,
}: {
  leccionId: string
  cursoSlug: string
  completadaInicial: boolean
}) {
  const router = useRouter()
  const [completada, setCompletada] = useState(completadaInicial)
  const [festejo, setFestejo] = useState(false)
  const [pendiente, iniciar] = useTransition()

  useEffect(() => {
    if (!festejo) return
    const t = setTimeout(() => setFestejo(false), 3000)
    return () => clearTimeout(t)
  }, [festejo])

  const alternar = (siguiente: boolean) =>
    iniciar(async () => {
      const resultado = await alternarCompletada(leccionId, siguiente, cursoSlug)
      if (resultado.ok) {
        setCompletada(siguiente)
        if (siguiente) setFestejo(true)
        // El % del curso vive en el servidor: hay que releerlo.
        router.refresh()
      }
    })

  if (completada) {
    return (
      <span className="flex flex-wrap items-center gap-3">
        <span
          className="inline-flex items-center gap-2 rounded-[10px] border border-exito/40 bg-exito/10 px-3 py-2 text-sm font-medium text-exito"
          role="status"
        >
          <Palomita />
          Completada
        </span>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pendiente}
          onClick={() => alternar(false)}
          className="text-muted-foreground"
        >
          {pendiente ? 'Guardando…' : 'Desmarcar'}
        </Button>

        {festejo ? (
          <span
            role="status"
            className="inline-flex animate-in items-center gap-1 rounded-full bg-vadai-lima px-2.5 py-1 text-sm font-semibold text-vadai-navy duration-500 zoom-in slide-in-from-bottom-2"
          >
            +{PUNTOS.leccion} puntos
          </span>
        ) : null}
      </span>
    )
  }

  return (
    <span className="flex flex-col gap-1.5">
      <Button
        type="button"
        size="lg"
        disabled={pendiente}
        onClick={() => alternar(true)}
        className="w-full sm:w-auto"
      >
        <Circulo />
        {pendiente ? 'Guardando…' : 'Marcar como completada'}
      </Button>
      <span className="text-xs text-muted-foreground">
        Suma {PUNTOS.leccion} puntos y avanza tu barra del curso.
      </span>
    </span>
  )
}

function Circulo() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="size-4"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

function Palomita() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  )
}
