'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { crearPregunta } from '@/lib/admin/acciones-quizzes'
import { LETRAS } from '@/lib/quiz/comun'
import { SIN_ESTADO } from '@/lib/admin/tipos'

function Boton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="outline" disabled={pending}>
      {pending ? 'Agregando…' : 'Agregar pregunta'}
    </Button>
  )
}

export function NuevaPregunta({
  quizId,
  leccionId,
  reinicio,
}: {
  quizId: string
  leccionId: string
  reinicio: number
}) {
  const [estado, accion] = useActionState(crearPregunta, SIN_ESTADO)

  return (
    <form
      key={reinicio}
      action={accion}
      className="flex flex-col gap-4 rounded-lg border border-dashed border-border p-4"
    >
      <input type="hidden" name="quiz_id" value={quizId} />
      <input type="hidden" name="lesson_id" value={leccionId} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pregunta-enunciado">Pregunta</Label>
        <Input
          id="pregunta-enunciado"
          name="question"
          placeholder="¿Qué hace que un prompt sea reutilizable?"
          required
          minLength={3}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">
          Opciones{' '}
          <span className="font-normal text-muted-foreground">
            — deja vacías las que no uses y marca la correcta
          </span>
        </legend>

        {LETRAS.map((letra, i) => (
          <div key={letra} className="flex items-center gap-2">
            <input
              type="radio"
              name="correct_option_id"
              value={letra}
              id={`correcta-${letra}`}
              defaultChecked={i === 0}
              className="size-4 shrink-0 accent-vadai-lima"
              aria-label={`Marcar opción ${letra.toUpperCase()} como correcta`}
            />
            <label htmlFor={`correcta-${letra}`} className="w-4 shrink-0 text-xs text-muted-foreground">
              {letra.toUpperCase()}
            </label>
            <Input
              name={`opcion_${letra}`}
              placeholder={i < 2 ? `Opción ${letra.toUpperCase()}` : 'Opcional'}
              aria-label={`Texto de la opción ${letra.toUpperCase()}`}
              required={i < 2}
            />
          </div>
        ))}
      </fieldset>

      <AvisoAccion estado={estado} />

      <div>
        <Boton />
      </div>
    </form>
  )
}
