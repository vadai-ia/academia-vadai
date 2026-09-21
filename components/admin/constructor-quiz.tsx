import { AjustesQuiz } from '@/components/admin/ajustes-quiz'
import { ConfirmarConModal } from '@/components/admin/confirmar-con-modal'
import { NuevaPregunta } from '@/components/admin/nueva-pregunta'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { crearQuiz, eliminarPregunta, moverPregunta } from '@/lib/admin/acciones-quizzes'
import type { QuizCompleto } from '@/lib/admin/quizzes'

/**
 * Builder de quizzes (§3.4).
 *
 * Server component: cada acción es un `<form>` con su server action, sin estado
 * de cliente, igual que el árbol del curso.
 *
 * La respuesta correcta se muestra aquí porque el admin la necesita para
 * revisar lo que cargó. Es seguro: `quiz_questions` es admin-only por RLS y esta
 * página vive tras `exigirAdmin()`.
 */
export function ConstructorQuiz({
  quiz,
  leccionId,
}: {
  quiz: QuizCompleto | null
  leccionId: string
}) {
  if (!quiz) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Quiz</h2>
        <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Esta lección es de tipo quiz pero todavía no tiene preguntas.
          </p>
          <form action={crearQuiz}>
            <input type="hidden" name="lesson_id" value={leccionId} />
            <Button type="submit" variant="outline">
              Crear el quiz
            </Button>
          </form>
        </div>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Quiz</h2>
        <p className="text-sm text-muted-foreground">
          {quiz.preguntas.length} pregunta(s) · {quiz.intentos} intento(s) ·{' '}
          {quiz.aprobados} aprobado(s)
        </p>
      </div>

      <AjustesQuiz
        quizId={quiz.id}
        leccionId={leccionId}
        puntajeMinimo={quiz.passing_score}
        revelaRespuestas={quiz.reveal_answers}
      />

      {quiz.preguntas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Todavía no hay preguntas. Agrega la primera con &ldquo;Agregar pregunta&rdquo;.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {quiz.preguntas.map((pregunta, i) => (
            <li key={pregunta.id} className="flex flex-col gap-2 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="flex min-w-0 items-baseline gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>
                  <span className="text-sm font-medium">{pregunta.question}</span>
                </p>

                <div className="flex shrink-0 items-center">
                  {(['arriba', 'abajo'] as const).map((direccion) => (
                    <form key={direccion} action={moverPregunta}>
                      <input type="hidden" name="id" value={pregunta.id} />
                      <input type="hidden" name="quiz_id" value={quiz.id} />
                      <input type="hidden" name="lesson_id" value={leccionId} />
                      <input type="hidden" name="direccion" value={direccion} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        disabled={direccion === 'arriba' ? i === 0 : i === quiz.preguntas.length - 1}
                        aria-label={`Mover pregunta ${direccion}`}
                      >
                        {direccion === 'arriba' ? '↑' : '↓'}
                      </Button>
                    </form>
                  ))}

                  <ConfirmarConModal
                    idModal={`eliminar-pregunta-${pregunta.id}`}
                    accion={eliminarPregunta}
                    campos={{ id: pregunta.id, lesson_id: leccionId }}
                    boton={{ texto: 'Eliminar', etiquetaAccesible: `Eliminar la pregunta ${i + 1}`, tono: 'destructivo' }}
                    titulo={`¿Eliminar la pregunta ${i + 1}?`}
                    confirmar={{ texto: 'Sí, eliminar', enCurso: 'Eliminando…', tono: 'destructivo' }}
                  >
                    <p>{pregunta.question}</p>
                    <p>No se puede deshacer.</p>
                  </ConfirmarConModal>
                </div>
              </div>

              <ul className="flex flex-col gap-1">
                {pregunta.opciones.map((opcion) => {
                  const esCorrecta = opcion.id === pregunta.correct_option_id
                  return (
                    <li
                      key={opcion.id}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <span className="w-4 shrink-0 font-mono text-xs uppercase">{opcion.id}</span>
                      <span className={esCorrecta ? 'text-exito' : undefined}>
                        {opcion.text}
                      </span>
                      {esCorrecta ? (
                        <Badge className="bg-vadai-lima text-vadai-navy">Correcta</Badge>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <NuevaPregunta
        quizId={quiz.id}
        leccionId={leccionId}
        reinicio={quiz.preguntas.length}
      />
    </section>
  )
}
