'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { actualizarQuiz } from '@/lib/admin/acciones-quizzes'
import { SIN_ESTADO } from '@/lib/admin/tipos'

function Boton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? 'Guardando…' : 'Guardar ajustes'}
    </Button>
  )
}

export function AjustesQuiz({
  quizId,
  leccionId,
  puntajeMinimo,
  revelaRespuestas,
}: {
  quizId: string
  leccionId: string
  puntajeMinimo: number
  revelaRespuestas: boolean
}) {
  const [estado, accion] = useActionState(actualizarQuiz, SIN_ESTADO)

  return (
    <form action={accion} className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <input type="hidden" name="id" value={quizId} />
      <input type="hidden" name="lesson_id" value={leccionId} />

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="passing_score">Puntaje mínimo (%)</Label>
          <Input
            id="passing_score"
            name="passing_score"
            type="number"
            min="0"
            max="100"
            step="1"
            defaultValue={puntajeMinimo}
            className="w-28"
          />
        </div>

        <label className="flex h-9 items-center gap-2 text-sm">
          <input
            name="reveal_answers"
            type="checkbox"
            value="true"
            defaultChecked={revelaRespuestas}
            className="size-4 accent-vadai-cyan"
          />
          Revelar las respuestas correctas al reprobar
        </label>

        <Boton />
      </div>

      <p className="text-xs text-muted-foreground">
        Los reintentos son ilimitados. Si revelas las respuestas al reprobar, el
        segundo intento se vuelve trivial.
      </p>

      <AvisoAccion estado={estado} />
    </form>
  )
}
