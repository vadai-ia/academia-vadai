'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { responderEncuesta } from '@/lib/encuestas/acciones-publicas'
import { SIN_ESTADO_PUBLICO } from '@/lib/encuestas/tipos-publicos'
import type { PreguntaPublica } from '@/lib/encuestas/publico'

/**
 * El formulario que contesta una pregunta, desde el celular.
 *
 * Mobile-first de verdad: los blancos táctiles de 44 px de `globals.css` ya
 * aplican.
 *
 * La escala es una BARRA que se recorre, no diez botones (pedido por Alejandro
 * el 20-sep-2026, para que se vea como la barra de la proyección). Las tres
 * objeciones que tenía el deslizador se resuelven en la misma pieza:
 *
 *   - "imposible de acertar con el pulgar": hay botones − y + de 44 px que
 *     mueven de uno en uno; la barra es para ir rápido, los botones para afinar.
 *   - "no dice qué valor eligió": el número va en grande arriba de la barra,
 *     y cambia al instante.
 *   - "sin JavaScript no funciona": el `<input type="range">` es un campo de
 *     formulario normal y viaja con el POST aunque el JS no cargue; solo los
 *     botones − y + necesitan JS.
 */

/**
 * La barra de la escala. El valor arranca en medio del rango: una barra tiene
 * que empezar en algún lado, y el centro no empuja a nadie hacia un extremo.
 */
function EscalaDeslizable({
  min,
  max,
  etiquetaMin,
  etiquetaMax,
}: {
  min: number
  max: number
  etiquetaMin?: string
  etiquetaMax?: string
}) {
  const [valor, setValor] = useState(Math.round((min + max) / 2))
  const fijar = (v: number) => setValor(Math.max(min, Math.min(max, v)))
  const porcentaje = max === min ? 100 : ((valor - min) / (max - min)) * 100

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="sr-only">
        Elige un número del {min} al {max}
      </legend>

      <div className="flex items-end justify-center gap-1" aria-hidden>
        <span className="text-6xl leading-none font-medium text-primary tabular-nums">{valor}</span>
        <span className="pb-1 text-lg text-muted-foreground tabular-nums">/ {max}</span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => fijar(valor - 1)}
          disabled={valor <= min}
          aria-label="Uno menos"
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border text-2xl leading-none transition-colors hover:bg-muted disabled:opacity-40"
        >
          −
        </button>

        {/* La pista pintada hasta el valor, como la barra de la proyección. */}
        <input
          type="range"
          name="valor"
          min={min}
          max={max}
          step={1}
          value={valor}
          onChange={(e) => fijar(Number(e.currentTarget.value))}
          aria-valuetext={`${valor} de ${max}`}
          className="h-11 w-full cursor-pointer accent-vadai-cyan"
          style={{
            background: `linear-gradient(to right, var(--primary) ${porcentaje}%, var(--muted) ${porcentaje}%)`,
            borderRadius: 999,
            height: 10,
            appearance: 'auto',
          }}
        />

        <button
          type="button"
          onClick={() => fijar(valor + 1)}
          disabled={valor >= max}
          aria-label="Uno más"
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border text-2xl leading-none transition-colors hover:bg-muted disabled:opacity-40"
        >
          +
        </button>
      </div>

      <div className="flex justify-between px-14 text-xs text-muted-foreground tabular-nums">
        <span>
          {min}
          {etiquetaMin ? ` · ${etiquetaMin}` : ''}
        </span>
        <span>
          {etiquetaMax ? `${etiquetaMax} · ` : ''}
          {max}
        </span>
      </div>
    </fieldset>
  )
}

function Enviar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Enviando…' : 'Enviar'}
    </Button>
  )
}

export function ResponderPregunta({
  codigo,
  pregunta,
}: {
  codigo: string
  pregunta: PreguntaPublica
}) {
  const [estado, accion] = useActionState(responderEncuesta, SIN_ESTADO_PUBLICO)

  const min = pregunta.ajustes.min ?? 1
  const max = pregunta.ajustes.max ?? 10

  return (
    <form
      // El `key` con el estado reinicia los campos tras enviar, con un valor que
      // viene del servidor. Es el patrón del repo: nada de limpiar con onClick,
      // que rompería el $ACTION_ID del formulario.
      key={`${pregunta.id}-${estado.aviso ?? ''}`}
      action={accion}
      className="flex flex-col gap-5"
    >
      <input type="hidden" name="codigo" value={codigo} />
      <input type="hidden" name="pregunta_id" value={pregunta.id} />

      <h1 className="text-2xl leading-tight font-medium text-balance">{pregunta.prompt}</h1>

      {pregunta.tipo === 'nube' ? (
        <div className="flex flex-col gap-1.5">
          <Input
            name="valor"
            required
            maxLength={pregunta.ajustes.maxCaracteres ?? 24}
            autoFocus
            autoComplete="off"
            placeholder="Una palabra"
            aria-label="Tu palabra"
            className="h-14 text-lg"
          />
          <p className="text-xs text-muted-foreground">
            Una sola palabra. Las que más se repitan se verán más grandes en la pantalla.
          </p>
        </div>
      ) : null}

      {pregunta.tipo === 'muro' ? (
        <div className="flex flex-col gap-1.5">
          <Textarea
            name="valor"
            required
            maxLength={pregunta.ajustes.maxCaracteres ?? 280}
            autoFocus
            rows={4}
            placeholder="Escribe tu respuesta"
            aria-label="Tu respuesta"
            className="text-base"
          />
          <p className="text-xs text-muted-foreground">
            Hasta {pregunta.ajustes.maxCaracteres ?? 280} caracteres.
          </p>
        </div>
      ) : null}

      {pregunta.tipo === 'opcion' ? (
        <fieldset className="flex flex-col gap-2.5">
          <legend className="sr-only">Elige una opción</legend>
          {pregunta.opciones.map((opcion) => (
            <label
              key={opcion.id}
              className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-border px-4 py-3.5 text-base transition-colors has-checked:border-primary has-checked:bg-primary/10"
            >
              <input
                type="radio"
                name="valor"
                value={opcion.id}
                required
                className="size-5 shrink-0 accent-vadai-cyan"
              />
              <span>{opcion.text}</span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {pregunta.tipo === 'escala' ? (
        <EscalaDeslizable
          min={min}
          max={max}
          etiquetaMin={pregunta.ajustes.etiquetaMin}
          etiquetaMax={pregunta.ajustes.etiquetaMax}
        />
      ) : null}

      {estado.error ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {estado.error}
        </p>
      ) : null}

      {estado.aviso ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md border border-exito/40 bg-exito/10 px-3 py-2 text-sm text-exito"
        >
          {estado.aviso}
        </p>
      ) : null}

      <Enviar />
    </form>
  )
}
