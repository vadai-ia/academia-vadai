'use client'

import { useActionState } from 'react'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { Desplegable } from '@/components/admin/desplegable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { enviarPruebaDeRecordatorio, recordarAccesoPendientes } from '@/lib/admin/acciones-alumnos'
import { SIN_ESTADO } from '@/lib/admin/tipos'

/**
 * "Mandar recordatorio a los que nunca han entrado", todos de un clic, y una
 * prueba a un correo antes de hacerlo.
 *
 * Sale por el endpoint de lote de Resend: ochenta correos son una petición,
 * así que ya no hace falta ir de diez en diez. El botón se deshabilita mientras
 * sale el lote y el aviso dice a cuántos llegó.
 *
 * La prueba manda el MISMO correo a la dirección que se escriba, con una liga
 * a la cuenta de quien lo pide: se abre en el propio buzón y se comprueba que
 * la liga entra antes de mandarlo a todos.
 *
 * Vive detrás de su botón (M14): se usa una vez por lanzamiento, no cada vez
 * que se abre la lista.
 */
export function ReenviarPendientes({ pendientes, correoAdmin }: { pendientes: number; correoAdmin: string }) {
  const [estado, accion, enviando] = useActionState(recordarAccesoPendientes, SIN_ESTADO)
  const [estadoPrueba, probar, probando] = useActionState(enviarPruebaDeRecordatorio, SIN_ESTADO)

  return (
    <Desplegable
      etiqueta="Mandar recordatorio a quien falta"
      variante="contorno"
      icono="ninguno"
      ayuda={pendientes > 0 ? `${pendientes} nunca han entrado` : 'Todos han entrado'}
      abierto={Boolean(estado.error || estado.aviso || estadoPrueba.error || estadoPrueba.aviso)}
    >
      <div className="flex flex-col gap-3">
        <form action={probar} className="flex flex-wrap items-center gap-2">
          <Input
            name="para"
            type="email"
            defaultValue={correoAdmin}
            aria-label="Correo para la prueba"
            className="h-9 max-w-xs"
          />
          <Button type="submit" variant="outline" size="sm" disabled={probando}>
            {probando ? 'Mandando prueba…' : 'Mandarme una prueba'}
          </Button>
          <span className="text-xs text-muted-foreground">El mismo correo que recibirán, con liga a tu cuenta.</span>
        </form>
        <AvisoAccion estado={estadoPrueba} />

        <form action={accion} className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" disabled={enviando || pendientes === 0}>
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
    </Desplegable>
  )
}
