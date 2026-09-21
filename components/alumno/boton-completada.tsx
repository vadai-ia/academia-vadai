'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { alternarCompletada } from '@/lib/alumno/acciones'
import { PUNTOS } from '@/lib/gamificacion/reglas'

/**
 * Marcar una lección como completada.
 *
 * Al completarla aparece "+10 puntos" al lado del botón, con un zoom y un
 * ascenso, y se va solo a los tres segundos. Es el refuerzo inmediato de la
 * gamificación: el número grande está en Mis cursos, pero el momento en que
 * se ganan los puntos es aquí, y tiene que sentirse aquí. Al desmarcar no
 * sale nada: quitar puntos no se festeja.
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

  return (
    <span className="inline-flex items-center gap-3">
      <Button
        type="button"
        variant={completada ? 'outline' : 'default'}
        disabled={pendiente}
        onClick={() =>
          iniciar(async () => {
            const siguiente = !completada
            const resultado = await alternarCompletada(leccionId, siguiente, cursoSlug)
            if (resultado.ok) {
              setCompletada(siguiente)
              if (siguiente) setFestejo(true)
              // El % del curso vive en el servidor: hay que releerlo.
              router.refresh()
            }
          })
        }
      >
        {pendiente
          ? 'Guardando…'
          : completada
            ? '✓ Completada'
            : 'Marcar como completada'}
      </Button>

      {festejo ? (
        <span
          role="status"
          className="inline-flex animate-in items-center gap-1 rounded-full bg-vadai-lima px-2.5 py-1 text-sm font-semibold text-vadai-navy zoom-in slide-in-from-bottom-2 duration-500"
        >
          +{PUNTOS.leccion} puntos
        </span>
      ) : null}
    </span>
  )
}
