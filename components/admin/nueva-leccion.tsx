'use client'

import { useActionState, useRef } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { crearLeccion } from '@/lib/admin/acciones'
import { ETIQUETA_TIPO_LECCION, SIN_ESTADO } from '@/lib/admin/tipos'

import { AvisoAccion } from './aviso-accion'

function Boton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="ghost" size="sm" disabled={pending}>
      {pending ? 'Creando…' : '+ Lección'}
    </Button>
  )
}

export function NuevaLeccion({ moduloId, cursoId }: { moduloId: string; cursoId: string }) {
  const [estado, accion] = useActionState(crearLeccion, SIN_ESTADO)
  const campo = useRef<HTMLInputElement>(null)

  return (
    <form
      action={async (datos) => {
        await accion(datos)
        if (campo.current) campo.current.value = ''
      }}
      className="flex flex-col gap-2 border-t border-border px-3 py-2"
    >
      <input type="hidden" name="module_id" value={moduloId} />
      <input type="hidden" name="course_id" value={cursoId} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          ref={campo}
          name="title"
          placeholder="Título de la lección"
          aria-label="Título de la lección"
          className="h-8"
          required
          minLength={2}
        />
        <select
          name="lesson_type"
          aria-label="Tipo de lección"
          defaultValue="video"
          className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
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
  )
}
