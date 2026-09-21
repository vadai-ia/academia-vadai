'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import type { CursoOpcion } from '@/components/admin/dar-de-alta'
import { claseSelect } from '@/components/admin/estilos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SIN_ESTADO } from '@/lib/admin/tipos'
import { crearDinamica } from '@/lib/dinamicas/acciones'
import { TOPE_DESCRIPCION, TOPE_TITULO } from '@/lib/dinamicas/comun'
import { cn } from '@/lib/utils'

function Enviar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Creando…' : 'Crear dinámica'}
    </Button>
  )
}

/**
 * Alta de una dinámica empresarial. Calco de `nueva-encuesta.tsx`.
 *
 * Va dentro de un `<details>` y no detrás de un `useState`: sin JavaScript un
 * botón con onClick no hace nada, y el desplegable nativo sí.
 *
 * SOLO pide título, curso, cohorte y descripción. La escala y la fecha límite
 * viven en Configuración: al crearla nadie sabe todavía cuándo va a cerrar, y
 * la escala 1–10 es la correcta casi siempre. Pedirlas aquí sería llenar el
 * alta de campos que se van a dejar como están.
 *
 * La cohorte se deja suelta a propósito, igual que en encuestas: el `<select>`
 * no se recarga al cambiar de curso —eso exigiría JavaScript— así que muestra
 * las cohortes de todos los cursos con su curso al lado.
 */
export function NuevaDinamica({
  cursos,
  reinicio,
}: {
  cursos: CursoOpcion[]
  reinicio: number
}) {
  const [estado, accion] = useActionState(crearDinamica, SIN_ESTADO)

  if (cursos.length === 0) {
    return (
      <p className="rounded-[10px] border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
        Crea un curso antes de armar una dinámica. Toda dinámica cuelga de uno.
      </p>
    )
  }

  return (
    <details className="group/dinamica">
      <summary
        className={cn(
          'inline-flex w-fit cursor-pointer list-none items-center gap-2 rounded-lg px-4 py-2.5',
          'bg-primary text-sm font-medium text-primary-foreground select-none',
          'transition-all hover:-translate-y-px hover:brightness-110',
          'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
          '[&::-webkit-details-marker]:hidden'
        )}
      >
        <Mas /> Nueva dinámica
      </summary>

      <form
        key={reinicio}
        action={accion}
        className="mt-4 flex flex-col gap-4 rounded-[10px] border border-border bg-card p-4 sm:p-5"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="din-titulo">Título</Label>
          <Input
            id="din-titulo"
            name="title"
            placeholder="Hoja de decisión"
            required
            minLength={3}
            maxLength={TOPE_TITULO}
          />
          <p className="text-xs text-muted-foreground">
            Es lo que cada empresa ve arriba de su tablero.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="din-curso">Curso</Label>
            <select id="din-curso" name="course_id" required className={claseSelect}>
              {cursos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.titulo}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="din-cohorte">Cohorte</Label>
            <select id="din-cohorte" name="cohort_id" className={claseSelect}>
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
              Opcional. Sirve para saber con qué grupo se corrió.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="din-descripcion">Descripción</Label>
          <Textarea
            id="din-descripcion"
            name="description"
            maxLength={TOPE_DESCRIPCION}
            placeholder="Qué tiene que decidir la empresa y con qué criterios. La ven los alumnos arriba del tablero."
          />
        </div>

        <AvisoAccion estado={estado} />

        <p className="text-xs text-muted-foreground">
          Se crea en borrador con escala del 1 al 10. Los criterios, la escala y la fecha límite se
          ajustan después.
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
      className="size-4 transition-transform group-open/dinamica:rotate-45"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
