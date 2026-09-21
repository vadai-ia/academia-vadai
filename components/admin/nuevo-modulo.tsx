'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { CerrarDesplegable } from '@/components/admin/cerrar-desplegable'
import { Desplegable } from '@/components/admin/desplegable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { crearModulo } from '@/lib/admin/acciones'
import { SIN_ESTADO } from '@/lib/admin/tipos'

import { AvisoAccion } from './aviso-accion'

function Boton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Creando…' : 'Agregar módulo'}
    </Button>
  )
}

/** El botón "Nuevo módulo" al pie del árbol y, detrás, su formulario (M14). */
export function NuevoModulo({ cursoId, reinicio }: { cursoId: string; reinicio: number }) {
  const [estado, accion] = useActionState(crearModulo, SIN_ESTADO)

  return (
    <Desplegable etiqueta="Nuevo módulo" variante="contorno" abierto={Boolean(estado.error || estado.aviso)}>
      <form key={reinicio} action={accion} className="flex flex-col gap-3">
        <input type="hidden" name="course_id" value={cursoId} />
        <Input
          name="title"
          placeholder="Nombre del módulo"
          aria-label="Nombre del módulo"
          required
          minLength={2}
        />
        <AvisoAccion estado={estado} />
        <div className="flex flex-wrap gap-2">
          <Boton />
          <CerrarDesplegable />
        </div>
      </form>
    </Desplegable>
  )
}
