'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { Button } from '@/components/ui/button'
import { SIN_ESTADO } from '@/lib/admin/tipos'
import { sincronizarAccesos } from '@/lib/membresia/acciones'

function Boton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? 'Sincronizando…' : 'Sincronizar accesos'}
    </Button>
  )
}

/** Después de agregar un curso a V-AI-P: les da el curso a todos los miembros vigentes. */
export function SincronizarAccesos() {
  const [estado, accion] = useActionState(sincronizarAccesos, SIN_ESTADO)
  return (
    <form action={accion} className="flex flex-col items-start gap-2">
      <Boton />
      <AvisoAccion estado={estado} />
    </form>
  )
}
