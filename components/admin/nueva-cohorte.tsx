'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { CerrarDesplegable } from '@/components/admin/cerrar-desplegable'
import { Desplegable } from '@/components/admin/desplegable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { crearCohorte } from '@/lib/admin/acciones-cohortes'
import { SIN_ESTADO } from '@/lib/admin/tipos'

function Boton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Creando…' : 'Crear cohorte'}
    </Button>
  )
}

/** El botón "Nueva cohorte" y, detrás, su formulario (M14). */
export function NuevaCohorte({ cursoId, reinicio }: { cursoId: string; reinicio: number }) {
  const [estado, accion] = useActionState(crearCohorte, SIN_ESTADO)

  return (
    <Desplegable etiqueta="Nueva cohorte" variante="contorno" abierto={Boolean(estado.error || estado.aviso)}>
      <form key={reinicio} action={accion} className="flex flex-col gap-3">
        <input type="hidden" name="course_id" value={cursoId} />

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="cohorte-nombre">Nombre</Label>
            <Input
              id="cohorte-nombre"
              name="name"
              placeholder="Generación 2 · nov–dic 2026"
              required
              minLength={2}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cohorte-inicio">Inicia</Label>
            <Input id="cohorte-inicio" name="starts_on" type="date" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cohorte-fin">Termina</Label>
            <Input id="cohorte-fin" name="ends_on" type="date" />
          </div>
        </div>

        <AvisoAccion estado={estado} />

        <div className="flex flex-wrap gap-2">
          <Boton />
          <CerrarDesplegable />
        </div>
      </form>
    </Desplegable>
  )
}
