'use client'

import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { abrirTablero } from '@/lib/dinamicas/acciones-tablero'

/**
 * "Empezar el tablero": la única acción grande de /dinamicas/[id].
 *
 * El tablero se crea con un POST, nunca con el GET de la página: los
 * escáneres de enlaces del correo abren páginas, no envían formularios. La
 * acción va directa al <form> (sin closure) para que funcione sin JavaScript;
 * `useFormStatus` solo agrega el "Abriendo…" cuando sí lo hay.
 */

function Boton({ etiqueta }: { etiqueta: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? 'Abriendo…' : etiqueta}
    </Button>
  )
}

export function EmpezarTablero({ dynamicId, etiqueta }: { dynamicId: string; etiqueta: string }) {
  return (
    <form action={abrirTablero}>
      <input type="hidden" name="dynamic_id" value={dynamicId} />
      <Boton etiqueta={etiqueta} />
    </form>
  )
}
