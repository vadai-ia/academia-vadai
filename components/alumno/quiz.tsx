'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { calificarQuiz, type ResultadoQuiz } from '@/lib/alumno/acciones-quiz'
import type { QuizParaAlumno } from '@/lib/alumno/quiz'
import { cn } from '@/lib/utils'

/**
 * Quiz del alumno (§3.4).
 *
 * Las opciones que ve nunca incluyen cuál es la correcta: vienen de la vista
 * `quiz_questions_public`. La calificación ocurre en el servidor y este
 * componente solo muestra lo que le devuelvan.
 *
 * Reintentos ilimitados por default, así que el error no se castiga: se marca
 * qué falló y se ofrece intentar de nuevo.
 *
 * Es un `<form>` con server action, no un onClick: así funciona aunque el JS
 * falle y se puede probar por HTTP, igual que el resto de la app.
 */

function BotonEnviar({ habilitado, faltan }: { habilitado: boolean; faltan: number }) {
  const { pending } = useFormStatus()
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" disabled={!habilitado || pending}>
        {pending ? 'Calificando…' : 'Enviar respuestas'}
      </Button>
      {faltan > 0 ? (
        <span className="text-sm text-muted-foreground">Te faltan {faltan}</span>
      ) : null}
    </div>
  )
}
export function Quiz({
  quiz,
  leccionId,
  cursoSlug,
}: {
  quiz: QuizParaAlumno
  leccionId: string
  cursoSlug: string
}) {
  const router = useRouter()
  const [respuestas, setRespuestas] = useState<Record<string, string>>({})
  const [resultado, accion] = useActionState<ResultadoQuiz, FormData>(calificarQuiz, {
    ok: false,
  })
  const [reinicio, setReinicio] = useState(0)

  const total = quiz.preguntas.length
  const contestadas = quiz.preguntas.filter((p) => respuestas[p.id]).length
  const completo = contestadas === total && total > 0

  // Al aprobar, el % del curso y el índice los recalcula el servidor. Va en un
  // efecto y no en el render: llamar a refresh() al renderizar entra en bucle.
  const aprobadoAhora = resultado.ok && resultado.aprobado === true
  useEffect(() => {
    if (aprobadoAhora) router.refresh()
  }, [aprobadoAhora, router])

  function reintentar() {
    setRespuestas({})
    // Remontar el formulario limpia el estado de la acción y los radios.
    setReinicio((n) => n + 1)
  }

  const fallada = (id: string) => resultado?.falladas?.includes(id) ?? false
  const calificado = Boolean(resultado?.ok)

  if (total === 0) {
    return (
      <section className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">Este quiz todavía se está preparando.</p>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Quiz</h2>
        <p className="text-sm text-muted-foreground">
          {total} pregunta{total === 1 ? '' : 's'} · necesitas {quiz.puntajeMinimo}% para aprobar
          {quiz.totalIntentos > 0 ? ` · ${quiz.totalIntentos} intento(s)` : ''}
        </p>
      </div>

      {quiz.aprobado && !resultado ? (
        <p className="rounded-md border border-vadai-lima/40 bg-vadai-lima/10 px-4 py-2.5 text-sm text-vadai-lima">
          Ya aprobaste este quiz
          {quiz.ultimoIntento ? ` con ${quiz.ultimoIntento.score}%` : ''}. Puedes volver a
          intentarlo si quieres.
        </p>
      ) : null}

      <form key={reinicio} action={accion} className="flex flex-col gap-5">
      <input type="hidden" name="quiz_id" value={quiz.id} />
      <input type="hidden" name="lesson_id" value={leccionId} />
      <input type="hidden" name="curso_slug" value={cursoSlug} />

      <ol className="flex flex-col gap-5">
        {quiz.preguntas.map((pregunta, i) => (
          <li key={pregunta.id} className="flex flex-col gap-2.5">
            <p className="flex items-baseline gap-2 text-sm font-medium">
              <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>
              <span>{pregunta.enunciado}</span>
            </p>

            <ul className="flex flex-col gap-1.5">
              {pregunta.opciones.map((opcion) => {
                const elegida = respuestas[pregunta.id] === opcion.id
                const esCorrecta = resultado?.correctas?.[pregunta.id] === opcion.id

                return (
                  <li key={opcion.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors',
                        elegida ? 'border-vadai-cyan bg-vadai-cyan/5' : 'border-border',
                        calificado && 'cursor-default',
                        // Al calificar: verde la correcta, roja la que eligió si falló.
                        esCorrecta && 'border-vadai-lima bg-vadai-lima/10',
                        calificado && elegida && fallada(pregunta.id) && !esCorrecta &&
                          'border-destructive bg-destructive/10'
                      )}
                    >
                      <input
                        type="radio"
                        name={pregunta.id}
                        value={opcion.id}
                        checked={elegida}
                        disabled={calificado}
                        onChange={() =>
                          setRespuestas((previo) => ({ ...previo, [pregunta.id]: opcion.id }))
                        }
                        className="mt-0.5 size-4 shrink-0 accent-vadai-cyan"
                      />
                      <span>{opcion.text}</span>
                    </label>
                  </li>
                )
              })}
            </ul>

            {calificado && fallada(pregunta.id) ? (
              <p className="text-xs text-destructive">
                {resultado?.correctas
                  ? 'Esta la fallaste. La correcta está marcada en verde.'
                  : 'Esta la fallaste.'}
              </p>
            ) : null}
          </li>
        ))}
      </ol>

      {resultado && !resultado.ok ? (
        <p role="status" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {resultado.motivo}
        </p>
      ) : null}

      {calificado ? (
        <div className="flex flex-col gap-3">
          <p
            role="status"
            className={cn(
              'rounded-md border px-4 py-3 text-sm',
              resultado?.aprobado
                ? 'border-vadai-lima/40 bg-vadai-lima/10 text-vadai-lima'
                : 'border-destructive/40 bg-destructive/10 text-destructive'
            )}
          >
            {resultado?.aprobado
              ? `¡Aprobado con ${resultado.score}%! La lección quedó marcada como completada.`
              : `Obtuviste ${resultado?.score}% y necesitas ${quiz.puntajeMinimo}%. ` +
                'Puedes intentarlo otra vez, las veces que quieras.'}
          </p>

          <div>
            <Button type="button" variant="outline" onClick={reintentar}>
              {resultado?.aprobado ? 'Volver a intentarlo' : 'Intentar de nuevo'}
            </Button>
          </div>
        </div>
      ) : (
        <BotonEnviar habilitado={completo} faltan={total - contestadas} />
      )}
      </form>
    </section>
  )
}
