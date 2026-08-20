'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { crearModulo } from '@/lib/admin/acciones'
import { SIN_ESTADO } from '@/lib/admin/tipos'

import { AvisoAccion } from './aviso-accion'

function Boton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="outline" disabled={pending}>
      {pending ? 'Creando…' : 'Agregar módulo'}
    </Button>
  )
}

export function NuevoModulo({ cursoId, reinicio }: { cursoId: string; reinicio: number }) {
  const [estado, accion] = useActionState(crearModulo, SIN_ESTADO)

  return (
    <form key={reinicio} action={accion} className="flex flex-col gap-2">
      <input type="hidden" name="course_id" value={cursoId} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          name="title"
          placeholder="Nombre del módulo"
          aria-label="Nombre del módulo"
          required
          minLength={2}
        />
        <Boton />
      </div>
      <AvisoAccion estado={estado} />
    </form>
  )
}
