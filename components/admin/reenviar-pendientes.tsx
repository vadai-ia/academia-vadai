'use client'

import { useActionState } from 'react'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { Button } from '@/components/ui/button'
import { reenviarAccesoPendientes } from '@/lib/admin/acciones-alumnos'
import { SIN_ESTADO } from '@/lib/admin/tipos'

/**
 * "Mandar acceso a quien falta", de diez en diez.
 *
 * Es un botón y no un proceso de fondo porque no hay proceso de fondo: la
 * plataforma es Vercel + Postgres, sin colas. Cada clic manda un lote, dice
 * cuántos quedan y espera el siguiente clic. Con setenta y cinco pendientes
 * son ocho clics, y el admin ve salir cada lote.
 */
export function ReenviarPendientes({ pendientes }: { pendientes: number }) {
  const [estado, accion, enviando] = useActionState(reenviarAccesoPendientes, SIN_ESTADO)

  if (pendientes === 0 && !estado.aviso && !estado.error) return null

  return (
    <div className="flex flex-col gap-2">
      <form action={accion} className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" size="sm" disabled={enviando || pendientes === 0}>
          {enviando
            ? 'Mandando…'
            : `Mandar acceso a ${Math.min(pendientes, 10)} de los ${pendientes} que nunca han entrado`}
        </Button>
        <span className="text-xs text-muted-foreground">
          Liga de 30 días. No repite a quien ya recibió una hoy.
        </span>
      </form>
      <AvisoAccion estado={estado} />
    </div>
  )
}
