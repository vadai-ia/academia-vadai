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
 * Dos estados que se ven distintos:
 *   - Pendiente: un botón grande en el lima de la marca —el color de los CTAs,
 *     y el único botón lima de la pantalla (25-sep-2026)— con un círculo vacío,
 *     la forma universal de "falta esto". Qué gana al apretarlo lo dice el
 *     bloque que lo contiene (`cierre-de-leccion.tsx`), no el botón.
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
          className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-accent px-4 text-[0.95rem] font-medium text-accent-foreground"
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
            className="inline-flex animate-in items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-sm font-medium text-accent-foreground duration-500 zoom-in slide-in-from-bottom-2"
          >
            +{PUNTOS.leccion} puntos
          </span>
        ) : null}
      </span>
    )
  }

  return (
    <Button
      type="button"
      variant="acento"
      size="lg"
      disabled={pendiente}
      onClick={() => alternar(true)}
      className="h-10 w-full px-5 text-[0.95rem] sm:w-auto"
    >
      <Circulo />
      {pendiente ? 'Guardando…' : 'Marcar como completada'}
    </Button>
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
