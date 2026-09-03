'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SIN_ESTADO } from '@/lib/admin/tipos'
import { actualizarPregunta } from '@/lib/encuestas/acciones'
import {
  AYUDA_TIPO_PREGUNTA,
  ETIQUETA_TIPO_PREGUNTA,
  TIPOS_PREGUNTA,
  type AjustesPregunta,
  type TipoPregunta,
} from '@/lib/encuestas/comun'
import type { Opcion } from '@/lib/quiz/comun'
import { LETRAS } from '@/lib/quiz/comun'

const claseSelect =
  'h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs ' +
  'outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

function Guardar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Guardando…' : 'Guardar cambios'}
    </Button>
  )
}

/**
 * Edita una pregunta ya guardada.
 *
 * Va dentro de un `<details>`, no detrás de un `useState`: sin JavaScript un
 * botón con onClick no abre nada y el desplegable nativo sí.
 *
 * CUANDO YA HAY RESPUESTAS el tipo se muestra fijo, no como `<select>`. No es
 * solo una guarda de servidor duplicada en la interfaz: es que ofrecer un menú
 * que va a ser rechazado es peor que no ofrecerlo. El servidor lo valida igual,
 * porque un formulario se puede reenviar a mano.
 */
export function EditarPreguntaEncuesta({
  encuestaId,
  pregunta,
}: {
  encuestaId: string
  pregunta: {
    id: string
    prompt: string
    tipo: TipoPregunta
    opciones: Opcion[]
    ajustes: AjustesPregunta
    totalRespuestas: number
  }
}) {
  const [estado, accion] = useActionState(actualizarPregunta, SIN_ESTADO)
  const bloqueada = pregunta.totalRespuestas > 0
  const textoDe = (letra: string) => pregunta.opciones.find((o) => o.id === letra)?.text ?? ''

  /** Los campos de un tipo concreto, sin depender del `<select>`. */
  const camposDe = (tipo: TipoPregunta) => {
    if (tipo === 'opcion') {
      return (
        <div className="flex flex-col gap-2">
          <Label className="mb-1">Opciones de respuesta</Label>
          {LETRAS.map((letra, i) => (
            <div key={letra} className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-sm text-muted-foreground uppercase">{letra}</span>
              <Input
                name={`opcion_${letra}`}
                defaultValue={textoDe(letra)}
                maxLength={120}
                placeholder={i < 2 ? 'Escribe una opción' : 'Opcional'}
              />
            </div>
          ))}
          <p className="mt-1 text-xs text-muted-foreground">
            {bloqueada
              ? 'Puedes corregir el texto de una opción: los votos cuelgan de su letra, no de su texto. Lo que no puedes es borrar una que ya tenga votos.'
              : 'Con dos basta; deja vacías las que no uses.'}
          </p>
        </div>
      )
    }

    if (tipo === 'escala') {
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`ed-min-${pregunta.id}`}>Del</Label>
            <Input
              id={`ed-min-${pregunta.id}`}
              name="escala_min"
              type="number"
              defaultValue={pregunta.ajustes.min ?? 1}
              min={0}
              max={9}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`ed-max-${pregunta.id}`}>Al</Label>
            <Input
              id={`ed-max-${pregunta.id}`}
              name="escala_max"
              type="number"
              defaultValue={pregunta.ajustes.max ?? 10}
              min={2}
              max={10}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`ed-etqmin-${pregunta.id}`}>Qué significa el mínimo</Label>
            <Input
              id={`ed-etqmin-${pregunta.id}`}
              name="escala_etiqueta_min"
              defaultValue={pregunta.ajustes.etiquetaMin ?? ''}
              maxLength={40}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`ed-etqmax-${pregunta.id}`}>Qué significa el máximo</Label>
            <Input
              id={`ed-etqmax-${pregunta.id}`}
              name="escala_etiqueta_max"
              defaultValue={pregunta.ajustes.etiquetaMax ?? ''}
              maxLength={40}
            />
          </div>
        </div>
      )
    }

    if (tipo === 'nube') {
      return (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`ed-palabras-${pregunta.id}`}>Palabras por persona</Label>
          <Input
            id={`ed-palabras-${pregunta.id}`}
            name="nube_palabras"
            type="number"
            defaultValue={pregunta.ajustes.maxPalabras ?? 1}
            min={1}
            max={3}
            className="sm:max-w-32"
          />
        </div>
      )
    }

    return (
      <p className="text-xs text-muted-foreground">
        No hay nada que configurar: cada quien escribe hasta 280 caracteres.
      </p>
    )
  }

  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={pregunta.id} />
      <input type="hidden" name="poll_id" value={encuestaId} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`ed-prompt-${pregunta.id}`}>Pregunta</Label>
        <Textarea
          id={`ed-prompt-${pregunta.id}`}
          name="prompt"
          defaultValue={pregunta.prompt}
          required
          minLength={3}
          maxLength={300}
          rows={2}
        />
      </div>

      {bloqueada ? (
        <>
          <input type="hidden" name="question_type" value={pregunta.tipo} />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {ETIQUETA_TIPO_PREGUNTA[pregunta.tipo]}
            </span>{' '}
            · el formato no se puede cambiar porque ya tiene {pregunta.totalRespuestas}{' '}
            respuesta(s), y dejarían de poder leerse. Duplica la pregunta si necesitas otra.
          </p>
          {camposDe(pregunta.tipo)}
        </>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`ed-tipo-${pregunta.id}`}>Cómo se contesta y cómo se ve</Label>
            <select
              id={`ed-tipo-${pregunta.id}`}
              name="question_type"
              className={claseSelect}
              defaultValue={pregunta.tipo}
            >
              {TIPOS_PREGUNTA.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {ETIQUETA_TIPO_PREGUNTA[tipo]}
                </option>
              ))}
            </select>
            {TIPOS_PREGUNTA.map((tipo) => (
              <p key={tipo} data-tipo-pregunta={tipo} className="text-xs text-muted-foreground">
                {AYUDA_TIPO_PREGUNTA[tipo]}
              </p>
            ))}
          </div>

          {/* Mismo mecanismo que el alta: los campos los muestra el CSS
              siguiendo al `<select>`, así el formulario funciona sin JS. */}
          {TIPOS_PREGUNTA.map((tipo) => (
            <div key={tipo} data-tipo-pregunta={tipo} className="flex-col gap-2">
              {camposDe(tipo)}
            </div>
          ))}
        </>
      )}

      <AvisoAccion estado={estado} />

      <div>
        <Guardar />
      </div>
    </form>
  )
}
