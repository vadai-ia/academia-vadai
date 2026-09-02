'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import type { CursoOpcion } from '@/components/admin/dar-de-alta'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SIN_ESTADO } from '@/lib/admin/tipos'
import { crearEncuesta } from '@/lib/encuestas/acciones'
import { cn } from '@/lib/utils'

const claseSelect =
  'h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs ' +
  'outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

function Enviar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Creando…' : 'Crear encuesta'}
    </Button>
  )
}

/**
 * Alta de una encuesta en vivo.
 *
 * Va dentro de un `<details>` y no detrás de un `useState`: sin JavaScript un
 * botón con onClick no hace nada, y el desplegable nativo sí.
 *
 * La cohorte se deja suelta a propósito. El `<select>` no se recarga al cambiar
 * de curso —eso exigiría JavaScript— así que muestra las cohortes de todos los
 * cursos con su curso al lado. Con dos o tres cursos es más simple que
 * cualquier alternativa, y elegir mal se corrige en el editor.
 */
export function NuevaEncuesta({
  cursos,
  reinicio,
}: {
  cursos: CursoOpcion[]
  reinicio: number
}) {
  const [estado, accion] = useActionState(crearEncuesta, SIN_ESTADO)

  if (cursos.length === 0) {
    return (
      <p className="rounded-[10px] border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
        Crea un curso antes de armar una encuesta. Toda encuesta cuelga de uno.
      </p>
    )
  }

  return (
    <details className="group/encuesta">
      <summary
        className={cn(
          'inline-flex w-fit cursor-pointer list-none items-center gap-2 rounded-lg px-4 py-2.5',
          'bg-primary text-sm font-medium text-primary-foreground select-none',
          'transition-all hover:-translate-y-px hover:brightness-110',
          'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
          '[&::-webkit-details-marker]:hidden'
        )}
      >
        <Mas /> Nueva encuesta
      </summary>

      <form
        key={reinicio}
        action={accion}
        className="mt-4 flex flex-col gap-4 rounded-[10px] border border-border bg-card p-4 sm:p-5"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="enc-titulo">Título</Label>
          <Input
            id="enc-titulo"
            name="title"
            placeholder="¿Qué tan lista está tu empresa para la IA?"
            required
            minLength={3}
            maxLength={160}
          />
          <p className="text-xs text-muted-foreground">
            Es lo que la sala va a ver proyectado mientras escanea.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="enc-curso">Curso</Label>
            <select id="enc-curso" name="course_id" required className={claseSelect}>
              {cursos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.titulo}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="enc-cohorte">Cohorte</Label>
            <select id="enc-cohorte" name="cohort_id" className={claseSelect}>
              <option value="">Todo el curso</option>
              {cursos.flatMap((c) =>
                c.cohortes.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.nombre} · {c.titulo}
                  </option>
                ))
              )}
            </select>
            <p className="text-xs text-muted-foreground">
              Opcional. Sirve para saber en qué grupo se corrió.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="enc-descripcion">Descripción</Label>
          <Textarea
            id="enc-descripcion"
            name="description"
            maxLength={400}
            placeholder="Para qué es esta dinámica. Solo la ves tú."
          />
        </div>

        <AvisoAccion estado={estado} />

        <p className="text-xs text-muted-foreground">
          Se crea en borrador, con su código y su QR listos. Las preguntas se agregan después.
        </p>

        <div>
          <Enviar />
        </div>
      </form>
    </details>
  )
}

function Mas() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="size-4 transition-transform group-open/encuesta:rotate-45"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
