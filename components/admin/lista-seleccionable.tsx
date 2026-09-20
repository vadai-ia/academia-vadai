'use client'

import type { ChangeEvent } from 'react'

import { cn } from '@/lib/utils'

/**
 * Lista para elegir varios: un toque marca, otro toque desmarca.
 *
 * Sustituye al `<select multiple>`, que en escritorio exige Ctrl + clic —nadie
 * lo adivina— y en el teléfono abre un selector del sistema distinto en cada
 * marca. Aquí cada opción es una casilla de verdad dentro de un renglón de 44 px:
 * se comporta igual con ratón, con dedo y con teclado, y sigue siendo un campo
 * de formulario normal. Sin JavaScript se envía igual.
 *
 * `unaSola` es para los grupos de un mismo curso: una inscripción solo puede
 * pertenecer a uno. Al marcar uno se desmarcan sus hermanos. Eso es solo una
 * cortesía del navegador: quien valida de verdad es la acción del servidor.
 */

export type OpcionSeleccionable = {
  valor: string
  etiqueta: string
  detalle?: string
}

export type GrupoSeleccionable = {
  clave: string
  /** Encabezado del bloque. Sin título, las opciones van sueltas. */
  titulo?: string
  /** true = dentro de este bloque solo puede quedar una marcada. */
  unaSola?: boolean
  opciones: OpcionSeleccionable[]
}

/**
 * Cursos → renglones. Un curso sin grupos es un renglón suelto; uno con grupos
 * es un bloque donde cada grupo es un renglón y solo puede quedar uno marcado.
 *
 * Cada valor es un par `cursoId|cohorteId` (la cohorte vacía = sin grupo), que
 * es lo que leen `altaManual` y `darAccesoACursos`. Así un solo control resuelve
 * curso Y grupo sin JavaScript: un segundo selector que dependiera del primero
 * no se podría actualizar sin él.
 */
export function gruposDesdeCursos(
  cursos: Array<{ id: string; titulo: string; cohortes: Array<{ id: string; nombre: string }> }>
): GrupoSeleccionable[] {
  return cursos.map((curso) =>
    curso.cohortes.length === 0
      ? { clave: curso.id, opciones: [{ valor: `${curso.id}|`, etiqueta: curso.titulo }] }
      : {
          clave: curso.id,
          titulo: curso.titulo,
          unaSola: true,
          opciones: [
            { valor: `${curso.id}|`, etiqueta: 'Sin grupo' },
            ...curso.cohortes.map((grupo) => ({
              valor: `${curso.id}|${grupo.id}`,
              etiqueta: grupo.nombre,
            })),
          ],
        }
  )
}

export function ListaSeleccionable({
  nombre,
  leyenda,
  grupos,
  conScroll = false,
}: {
  /** `name` de las casillas: el servidor lo lee con `getAll`. */
  nombre: string
  leyenda: string
  grupos: GrupoSeleccionable[]
  /** Para listas largas (personas): tope de alto y desplazamiento propio. */
  conScroll?: boolean
}) {
  function alCambiar(evento: ChangeEvent<HTMLInputElement>) {
    const casilla = evento.currentTarget
    const bloque = casilla.dataset.unaSola
    if (!casilla.checked || !bloque) return

    casilla
      .closest('fieldset')
      ?.querySelectorAll<HTMLInputElement>(`input[data-una-sola="${CSS.escape(bloque)}"]`)
      .forEach((otra) => {
        if (otra !== casilla) otra.checked = false
      })
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className="pb-1.5 text-sm font-medium">{leyenda}</legend>

      <div className={cn('flex flex-col gap-1.5', conScroll && 'max-h-80 overflow-y-auto pr-1')}>
        {grupos.map((grupo) => (
          <div
            key={grupo.clave}
            role={grupo.titulo ? 'group' : undefined}
            aria-label={grupo.titulo}
            className="flex flex-col gap-1.5"
          >
            {grupo.titulo ? (
              <p className="px-1 pt-1.5 text-xs font-medium text-muted-foreground">
                {grupo.titulo}
                {grupo.unaSola ? ' · elige un grupo' : ''}
              </p>
            ) : null}

            {grupo.opciones.map((opcion) => (
              <label
                key={opcion.valor}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2',
                  'text-sm transition-colors select-none hover:bg-muted',
                  'has-[:checked]:border-primary has-[:checked]:bg-primary/10',
                  'has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50'
                )}
              >
                <input
                  type="checkbox"
                  name={nombre}
                  value={opcion.valor}
                  data-una-sola={grupo.unaSola ? grupo.clave : undefined}
                  onChange={alCambiar}
                  className="size-4 shrink-0 accent-primary"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{opcion.etiqueta}</span>
                  {opcion.detalle ? (
                    <span className="truncate text-xs text-muted-foreground">{opcion.detalle}</span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </fieldset>
  )
}
