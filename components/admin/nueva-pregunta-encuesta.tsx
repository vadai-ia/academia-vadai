'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SIN_ESTADO } from '@/lib/admin/tipos'
import { crearPreguntaEncuesta } from '@/lib/encuestas/acciones'
import { AYUDA_TIPO_PREGUNTA, ETIQUETA_TIPO_PREGUNTA, TIPOS_PREGUNTA } from '@/lib/encuestas/comun'
import { LETRAS } from '@/lib/quiz/comun'

const claseSelect =
  'h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs ' +
  'outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

function Enviar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Agregando…' : 'Agregar pregunta'}
    </Button>
  )
}

/**
 * Alta de una pregunta.
 *
 * SOLO SE VEN LOS CAMPOS DEL TIPO ELEGIDO, y eso lo hace CSS, no React.
 *
 * La versión anterior mostraba los tres bloques a la vez dentro de `<details>`
 * rotulados "solo para opción múltiple", "solo para escala"… Funcionaba, pero
 * obligaba a leer cuatro rótulos para decidir cuál abrir, y en la práctica se
 * llenaba el equivocado.
 *
 * Con estado de React sería trivial, pero el `<select>` dejaría de cambiar nada
 * sin JavaScript y el formulario solo podría crear preguntas del tipo por
 * defecto. La regla del repo es que la plataforma funciona sin JS, así que la
 * selección la sigue `:has()` sobre `option:checked` desde `globals.css`. En un
 * navegador sin `:has()` se ven todos los campos, que es el comportamiento
 * anterior: degrada hacia lo usable.
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
      className="flex flex-col gap-5 rounded-[10px] border border-dashed border-border p-4 sm:p-5"
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
          rows={2}
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

        {/* Solo la explicación del tipo elegido. Antes se listaban las cuatro y
            había que buscar la que aplicaba. */}
        {TIPOS_PREGUNTA.map((tipo) => (
          <p
            key={tipo}
            data-tipo-pregunta={tipo}
            className="text-xs text-muted-foreground"
          >
            {AYUDA_TIPO_PREGUNTA[tipo]}
          </p>
        ))}
      </div>

      {/* --- opción múltiple ------------------------------------------- */}
      <div data-tipo-pregunta="opcion" className="flex-col gap-2">
        <Label className="mb-1">Opciones de respuesta</Label>
        {LETRAS.map((letra, i) => (
          <div key={letra} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-sm text-muted-foreground uppercase">{letra}</span>
            <Input
              name={`opcion_${letra}`}
              maxLength={120}
              placeholder={i < 2 ? 'Escribe una opción' : 'Opcional'}
            />
          </div>
        ))}
        <p className="mt-1 text-xs text-muted-foreground">
          Con dos basta; deja vacías las que no uses. Aquí no hay respuesta correcta: una
          encuesta no se califica.
        </p>
      </div>

      {/* --- escala ----------------------------------------------------- */}
      <div data-tipo-pregunta="escala" className="flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="preg-min">Del</Label>
            <Input id="preg-min" name="escala_min" type="number" defaultValue={1} min={0} max={9} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="preg-max">Al</Label>
            <Input
              id="preg-max"
              name="escala_max"
              type="number"
              defaultValue={10}
              min={2}
              max={10}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="preg-etq-min">Qué significa el mínimo</Label>
            <Input
              id="preg-etq-min"
              name="escala_etiqueta_min"
              maxLength={40}
              placeholder="Nada preparada"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="preg-etq-max">Qué significa el máximo</Label>
            <Input
              id="preg-etq-max"
              name="escala_etiqueta_max"
              maxLength={40}
              placeholder="Totalmente lista"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Las etiquetas son opcionales, pero ayudan: un 7 solo no dice de qué.
        </p>
      </div>

      {/* --- nube ------------------------------------------------------- */}
      <div data-tipo-pregunta="nube" className="flex-col gap-1.5">
        <Label htmlFor="preg-palabras">Palabras por persona</Label>
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
          Máximo tres. Con más, la nube deja de retratar a la sala y retrata a quien escribe más
          rápido.
        </p>
      </div>

      {/* --- muro ------------------------------------------------------- */}
      <div data-tipo-pregunta="muro" className="flex-col gap-1.5">
        <p className="text-xs text-muted-foreground">
          No hay nada que configurar. Cada quien escribe hasta 280 caracteres y las respuestas
          caen como tarjetas en la pantalla, las más recientes arriba.
        </p>
      </div>

      <AvisoAccion estado={estado} />

      <div>
        <Enviar />
      </div>
    </form>
  )
}
