'use client'

import { useActionState } from 'react'
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
 * aplican, y la escala se contesta con botones grandes en vez de un deslizador.
 * Un `<input type="range">` es imposible de acertar con el pulgar, no dice qué
 * valor eligió sin JavaScript, y no se puede leer con lector de pantalla sin
 * trabajo extra. Diez botones se tocan y se ven.
 */

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
  const escala = Array.from({ length: max - min + 1 }, (_, i) => min + i)

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
        <fieldset className="flex flex-col gap-3">
          <legend className="sr-only">Elige un número</legend>
          <div className="grid grid-cols-5 gap-2">
            {escala.map((valor) => (
              <label
                key={valor}
                className="flex cursor-pointer items-center justify-center rounded-[10px] border border-border py-3.5 text-lg font-medium tabular-nums transition-colors has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground"
              >
                <input type="radio" name="valor" value={valor} required className="sr-only" />
                {valor}
              </label>
            ))}
          </div>
          {pregunta.ajustes.etiquetaMin || pregunta.ajustes.etiquetaMax ? (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{pregunta.ajustes.etiquetaMin}</span>
              <span>{pregunta.ajustes.etiquetaMax}</span>
            </div>
          ) : null}
        </fieldset>
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
