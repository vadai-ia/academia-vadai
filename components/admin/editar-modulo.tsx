'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { CerrarDesplegable } from '@/components/admin/cerrar-desplegable'
import { Desplegable } from '@/components/admin/desplegable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { renombrarModulo } from '@/lib/admin/acciones'
import { SIN_ESTADO } from '@/lib/admin/tipos'

function Guardar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Guardando…' : 'Guardar título'}
    </Button>
  )
}

/**
 * Cambiarle el nombre a un módulo sin salir del árbol (M14).
 *
 * Antes solo se podía mover arriba y abajo: para corregir un título había que
 * borrar el módulo —con sus lecciones— y volver a crearlo.
 */
export function EditarModulo({
  moduloId,
  cursoId,
  titulo,
  nombre,
}: {
  moduloId: string
  cursoId: string
  titulo: string
  /** Acordeón: abre este y se cierra el de "Nueva lección" del mismo módulo. */
  nombre?: string
}) {
  const [estado, accion] = useActionState(renombrarModulo, SIN_ESTADO)

  return (
    <Desplegable
      etiqueta="Editar módulo"
      variante="contorno"
      tamano="sm"
      icono="lapiz"
      nombre={nombre}
      abierto={Boolean(estado.error || estado.aviso)}
    >
      <form action={accion} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={moduloId} />
        <input type="hidden" name="course_id" value={cursoId} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`titulo-modulo-${moduloId}`}>Título del módulo</Label>
          <Input
            id={`titulo-modulo-${moduloId}`}
            name="title"
            defaultValue={titulo}
            required
            minLength={2}
            maxLength={200}
          />
          <p className="text-xs text-muted-foreground">
            Es lo que el alumno ve en el índice del curso.
          </p>
        </div>

        <AvisoAccion estado={estado} />

        <div className="flex flex-wrap gap-2">
          <Guardar />
          <CerrarDesplegable />
        </div>
      </form>
    </Desplegable>
  )
}
