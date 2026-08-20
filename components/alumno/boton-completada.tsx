'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { alternarCompletada } from '@/lib/alumno/acciones'

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
  const [pendiente, iniciar] = useTransition()

  return (
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
  )
}
