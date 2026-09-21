'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Desplegable } from '@/components/admin/desplegable'
import { claseSelect } from '@/components/admin/estilos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { crearLeccion } from '@/lib/admin/acciones'
import { ETIQUETA_TIPO_LECCION, SIN_ESTADO } from '@/lib/admin/tipos'

import { AvisoAccion } from './aviso-accion'

function Boton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Creando…' : 'Agregar lección'}
    </Button>
  )
}

/** El botón "Nueva lección" al pie de cada módulo y, detrás, su formulario (M14). */
export function NuevaLeccion({
  moduloId,
  cursoId,
  reinicio,
}: {
  moduloId: string
  cursoId: string
  reinicio: number
}) {
  const [estado, accion] = useActionState(crearLeccion, SIN_ESTADO)

  return (
    <Desplegable
      etiqueta="Nueva lección"
      variante="discreto"
      tamano="sm"
      abierto={Boolean(estado.error || estado.aviso)}
    >
      <form key={reinicio} action={accion} className="flex flex-col gap-2">
        <input type="hidden" name="module_id" value={moduloId} />
        <input type="hidden" name="course_id" value={cursoId} />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            name="title"
            placeholder="Título de la lección"
            aria-label="Título de la lección"
            required
            minLength={2}
          />
          <select
            name="lesson_type"
            aria-label="Tipo de lección"
            defaultValue="video"
            className={`${claseSelect} sm:w-auto`}
          >
            {Object.entries(ETIQUETA_TIPO_LECCION).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
          <Boton />
        </div>

        <AvisoAccion estado={estado} />
      </form>
    </Desplegable>
  )
}
