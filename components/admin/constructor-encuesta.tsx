import { NuevaPreguntaEncuesta } from '@/components/admin/nueva-pregunta-encuesta'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Seccion } from '@/components/ui-vadai/superficie'
import {
  eliminarPreguntaEncuesta,
  moverPreguntaEncuesta,
} from '@/lib/encuestas/acciones'
import {
  ETIQUETA_ESTADO_PREGUNTA,
  ETIQUETA_TIPO_PREGUNTA,
  type AjustesPregunta,
  type TipoPregunta,
} from '@/lib/encuestas/comun'
import type { EncuestaCompleta } from '@/lib/encuestas/consultas'

/**
 * Las preguntas de una encuesta, en el orden en que se van a proyectar.
 *
 * Server component: cada acción es un `<form>` con su server action, sin estado
 * de cliente, igual que el árbol del curso y el builder de quizzes.
 */

const VARIANTE_ESTADO = {
  pending: 'outline',
  open: 'default',
  closed: 'secondary',
} as const

/** Una línea que resume los ajustes, para no tener que abrir cada pregunta. */
function resumenDeAjustes(tipo: TipoPregunta, ajustes: AjustesPregunta): string | null {
  switch (tipo) {
    case 'escala': {
      const rango = `del ${ajustes.min ?? 1} al ${ajustes.max ?? 10}`
      const etiquetas = [ajustes.etiquetaMin, ajustes.etiquetaMax].filter(Boolean).join(' → ')
      return etiquetas ? `${rango} · ${etiquetas}` : rango
    }
    case 'nube':
      return (ajustes.maxPalabras ?? 1) > 1
        ? `${ajustes.maxPalabras} palabras por persona`
        : 'una palabra por persona'
    case 'muro':
      return `hasta ${ajustes.maxCaracteres ?? 280} caracteres`
    case 'opcion':
      return null
  }
}

export function ConstructorEncuesta({ encuesta }: { encuesta: EncuestaCompleta }) {
  const { preguntas } = encuesta

  return (
    <Seccion
      titulo="Preguntas"
      apoyo={
        preguntas.length === 0
          ? 'Todavía no hay ninguna. Agrega la primera abajo.'
          : `${preguntas.length} pregunta(s), en el orden en que las vas a abrir.`
      }
    >
      {preguntas.length > 0 ? (
        <ol className="flex flex-col gap-3">
          {preguntas.map((pregunta, indice) => {
            const resumen = resumenDeAjustes(pregunta.tipo, pregunta.ajustes)
            return (
              <li
                key={pregunta.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-[10px] border border-border px-4 py-3"
              >
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {indice + 1}.
                    </span>
                    <span className="font-medium">{pregunta.prompt}</span>
                    <Badge variant={VARIANTE_ESTADO[pregunta.status]} className="shrink-0">
                      {ETIQUETA_ESTADO_PREGUNTA[pregunta.status]}
                    </Badge>
                  </span>

                  <span className="text-xs text-muted-foreground">
                    {ETIQUETA_TIPO_PREGUNTA[pregunta.tipo]}
                    {resumen ? ` · ${resumen}` : ''} · {pregunta.totalRespuestas} respuesta(s)
                  </span>

                  {pregunta.opciones.length > 0 ? (
                    <ul className="flex flex-wrap gap-1.5">
                      {pregunta.opciones.map((opcion) => (
                        <li
                          key={opcion.id}
                          className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                        >
                          {opcion.text}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <form action={moverPreguntaEncuesta}>
                    <input type="hidden" name="id" value={pregunta.id} />
                    <input type="hidden" name="poll_id" value={encuesta.id} />
                    <input type="hidden" name="direccion" value="arriba" />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon-sm"
                      disabled={indice === 0}
                      aria-label={`Subir la pregunta ${indice + 1}`}
                    >
                      <Flecha arriba />
                    </Button>
                  </form>

                  <form action={moverPreguntaEncuesta}>
                    <input type="hidden" name="id" value={pregunta.id} />
                    <input type="hidden" name="poll_id" value={encuesta.id} />
                    <input type="hidden" name="direccion" value="abajo" />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon-sm"
                      disabled={indice === preguntas.length - 1}
                      aria-label={`Bajar la pregunta ${indice + 1}`}
                    >
                      <Flecha />
                    </Button>
                  </form>

                  <form action={eliminarPreguntaEncuesta}>
                    <input type="hidden" name="id" value={pregunta.id} />
                    <input type="hidden" name="poll_id" value={encuesta.id} />
                    <Button
                      type="submit"
                      variant="destructive"
                      size="sm"
                      aria-label={`Eliminar la pregunta ${indice + 1}`}
                    >
                      Eliminar
                    </Button>
                  </form>
                </div>
              </li>
            )
          })}
        </ol>
      ) : null}

      <NuevaPreguntaEncuesta encuestaId={encuesta.id} reinicio={preguntas.length} />
    </Seccion>
  )
}

function Flecha({ arriba = false }: { arriba?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5"
    >
      {arriba ? <path d="m18 15-6-6-6 6" /> : <path d="m6 9 6 6 6-6" />}
    </svg>
  )
}
