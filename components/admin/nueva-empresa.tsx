'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { Desplegable } from '@/components/admin/desplegable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { crearEmpresa } from '@/lib/admin/acciones-empresas'
import { SIN_ESTADO } from '@/lib/admin/tipos'

function Boton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Creando…' : 'Crear empresa'}
    </Button>
  )
}

/**
 * El botón "Nueva empresa" y, detrás, su formulario (M14).
 * `reinicio` cambia al crear una: el formulario se remonta limpio.
 */
export function NuevaEmpresa({ reinicio }: { reinicio: number }) {
  const [estado, accion] = useActionState(crearEmpresa, SIN_ESTADO)

  return (
    <Desplegable etiqueta="Nueva empresa" variante="primario" abierto={Boolean(estado.error || estado.aviso)}>
      <form key={reinicio} action={accion} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-64 flex-1 flex-col gap-1.5">
            <Label htmlFor="empresa-nombre">Nombre</Label>
            <Input id="empresa-nombre" name="nombre" placeholder="Grupo Aztlán" required minLength={2} />
          </div>
          <Boton />
        </div>
        <AvisoAccion estado={estado} />
      </form>
    </Desplegable>
  )
}
