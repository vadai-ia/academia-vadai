'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { EditorRico } from '@/components/admin/editor-rico'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { actualizarTarea } from '@/lib/admin/acciones-tareas'
import type { TareaConEntregas } from '@/lib/admin/tareas'
import { SIN_ESTADO } from '@/lib/admin/tipos'

function Boton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="outline" disabled={pending}>
      {pending ? 'Guardando…' : 'Guardar tarea'}
    </Button>
  )
}

export function FormularioTarea({
  tarea,
  leccionId,
}: {
  tarea: TareaConEntregas
  leccionId: string
}) {
  const [estado, accion] = useActionState(actualizarTarea, SIN_ESTADO)

  return (
    <form action={accion} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={tarea.id} />
      <input type="hidden" name="lesson_id" value={leccionId} />

      <EditorRico
        nombre="instructions_rich"
        contenidoInicial={tarea.instructions_rich}
        etiqueta="Instrucciones"
        ayuda="Qué tiene que hacer y entregar el alumno."
      />

      <fieldset className="flex flex-col gap-2">
        <Label asChild>
          <legend className="mb-1">Qué puede entregar</legend>
        </Label>

        <label className="flex items-center gap-2 text-sm">
          <input
            name="allow_text"
            type="checkbox"
            value="true"
            defaultChecked={tarea.allow_text}
            className="size-4 accent-vadai-cyan"
          />
          Texto escrito
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            name="allow_files"
            type="checkbox"
            value="true"
            defaultChecked={tarea.allow_files}
            className="size-4 accent-vadai-cyan"
          />
          Archivos adjuntos
        </label>

        <p className="text-xs text-muted-foreground">
          Al menos una de las dos. Los archivos del alumno se guardan en su propia
          carpeta privada.
        </p>
      </fieldset>

      <AvisoAccion estado={estado} />

      <div>
        <Boton />
      </div>
    </form>
  )
}
