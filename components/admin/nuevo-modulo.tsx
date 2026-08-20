'use client'

import { useActionState, useRef } from 'react'
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

export function NuevoModulo({ cursoId }: { cursoId: string }) {
  const [estado, accion] = useActionState(crearModulo, SIN_ESTADO)
  const campo = useRef<HTMLInputElement>(null)

  return (
    <form
      action={async (datos) => {
        await accion(datos)
        // Deja el campo listo para el siguiente módulo sin recargar.
        if (campo.current) campo.current.value = ''
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="course_id" value={cursoId} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          ref={campo}
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
