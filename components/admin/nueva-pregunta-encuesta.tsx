'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SIN_ESTADO } from '@/lib/admin/tipos'
import { LETRAS } from '@/lib/quiz/comun'
import { crearPreguntaEncuesta } from '@/lib/encuestas/acciones'
import { AYUDA_TIPO_PREGUNTA, ETIQUETA_TIPO_PREGUNTA, TIPOS_PREGUNTA } from '@/lib/encuestas/comun'
import { cn } from '@/lib/utils'

const claseSelect =
  'h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs ' +
  'outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

const claseResumen =
  'inline-flex w-fit cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 ' +
  'text-sm font-medium transition-colors select-none hover:bg-muted ' +
  'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ' +
  '[&::-webkit-details-marker]:hidden'

function Enviar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="outline" disabled={pending}>
      {pending ? 'Agregando…' : 'Agregar pregunta'}
    </Button>
  )
}

/**
 * Alta de una pregunta.
 *
 * Los ajustes que dependen del tipo NO se muestran y ocultan con estado de
 * cliente: van en `<details>` cerrados, cada uno diciendo a qué tipo aplica.
 *
 * La razón es la de siempre en este repo —un `<select>` que revela campos exige
 * JavaScript— pero aquí además sale más honesto: el admin ve de un vistazo que
 * una escala se puede reetiquetar, cosa que un campo escondido no le enseña
 * nunca. La acción ignora los ajustes que no correspondan al tipo elegido.
 */
export function NuevaPreguntaEncuesta({
  encuestaId,
  reinicio,
}: {
  encuestaId: string
  reinicio: number
}) {
  const [estado, accion] = useActionState(crearPreguntaEncuesta, SIN_ESTADO)

  return (
    <form
      key={reinicio}
      action={accion}
      className="flex flex-col gap-4 rounded-[10px] border border-dashed border-border p-4"
    >
      <input type="hidden" name="poll_id" value={encuestaId} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="preg-enunciado">Pregunta</Label>
        <Textarea
          id="preg-enunciado"
          name="prompt"
          required
          minLength={3}
          maxLength={300}
          placeholder="¿Cuál es tu mayor cuello de botella hoy?"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="preg-tipo">Cómo se contesta y cómo se ve</Label>
        <select id="preg-tipo" name="question_type" className={claseSelect} defaultValue="nube">
          {TIPOS_PREGUNTA.map((tipo) => (
            <option key={tipo} value={tipo}>
              {ETIQUETA_TIPO_PREGUNTA[tipo]}
            </option>
          ))}
        </select>
        <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          {TIPOS_PREGUNTA.map((tipo) => (
            <li key={tipo}>
              <span className="font-medium text-foreground">{ETIQUETA_TIPO_PREGUNTA[tipo]}:</span>{' '}
              {AYUDA_TIPO_PREGUNTA[tipo]}
            </li>
          ))}
        </ul>
      </div>

      <details className="border-t border-border pt-2">
        <summary className={claseResumen}>
          <Flecha /> Opciones · solo para opción múltiple
        </summary>
        <div className="flex flex-col gap-2 px-1 pt-3 pb-1">
          {LETRAS.map((letra) => (
            <div key={letra} className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-sm text-muted-foreground uppercase">{letra}</span>
              <Input
                name={`opcion_${letra}`}
                maxLength={120}
                placeholder={letra === 'a' ? 'Primera opción' : 'Opcional'}
              />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Deja vacías las que no uses. Con dos basta. Aquí no hay respuesta correcta: una
            encuesta no se califica.
          </p>
        </div>
      </details>

      <details className="border-t border-border pt-2">
        <summary className={claseResumen}>
          <Flecha /> Escala · solo para escala
        </summary>
        <div className="grid gap-3 px-1 pt-3 pb-1 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="preg-min">Del</Label>
            <Input id="preg-min" name="escala_min" type="number" defaultValue={1} min={0} max={9} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="preg-max">Al</Label>
            <Input id="preg-max" name="escala_max" type="number" defaultValue={10} min={2} max={10} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="preg-etq-min">Qué significa el mínimo</Label>
            <Input id="preg-etq-min" name="escala_etiqueta_min" maxLength={40} placeholder="Nada" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="preg-etq-max">Qué significa el máximo</Label>
            <Input
              id="preg-etq-max"
              name="escala_etiqueta_max"
              maxLength={40}
              placeholder="Muchísimo"
            />
          </div>
        </div>
      </details>

      <details className="border-t border-border pt-2">
        <summary className={claseResumen}>
          <Flecha /> Palabras por persona · solo para nube
        </summary>
        <div className="flex flex-col gap-1.5 px-1 pt-3 pb-1">
          <Label htmlFor="preg-palabras">Cuántas puede escribir cada quien</Label>
          <Input
            id="preg-palabras"
            name="nube_palabras"
            type="number"
            defaultValue={1}
            min={1}
            max={3}
            className="sm:max-w-32"
          />
          <p className="text-xs text-muted-foreground">
            Máximo tres. Con más, la nube deja de retratar a la sala y retrata a quien escribe
            más rápido.
          </p>
        </div>
      </details>

      <AvisoAccion estado={estado} />

      <div>
        <Enviar />
      </div>
    </form>
  )
}

function Flecha() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-3.5 transition-transform', '[details[open]>summary>&]:rotate-90')}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}
