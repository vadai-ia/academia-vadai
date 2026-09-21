'use client'

import { useActionState } from 'react'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { Button } from '@/components/ui/button'
import { recordarAccesoPendientes } from '@/lib/admin/acciones-alumnos'
import { SIN_ESTADO } from '@/lib/admin/tipos'

/**
 * "Mandar recordatorio a los que nunca han entrado", todos de un clic.
 *
 * Sale por el endpoint de lote de Resend: ochenta correos son una petición,
 * así que ya no hace falta ir de diez en diez. El botón se deshabilita mientras
 * sale el lote y el aviso dice a cuántos llegó.
 */
export function ReenviarPendientes({ pendientes }: { pendientes: number }) {
  const [estado, accion, enviando] = useActionState(recordarAccesoPendientes, SIN_ESTADO)

  if (pendientes === 0 && !estado.aviso && !estado.error) return null

  return (
    <div className="flex flex-col gap-2">
      <form action={accion} className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" size="sm" disabled={enviando || pendientes === 0}>
          {enviando
            ? 'Mandando…'
            : `Mandar recordatorio a los ${pendientes} que nunca han entrado`}
        </Button>
        <span className="text-xs text-muted-foreground">
          Correo de recordatorio con liga de 30 días. No repite a quien ya recibió uno hoy.
        </span>
      </form>
      <AvisoAccion estado={estado} />
    </div>
  )
}
