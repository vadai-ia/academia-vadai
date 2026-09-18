'use client'

import { useActionState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { SIN_ESTADO, type EstadoAccion } from '@/lib/admin/tipos'

import { AvisoAccion } from './aviso-accion'

/**
 * Un botón que, antes de ejecutar su acción, pide confirmarla en un modal.
 *
 * Lo usan "Archivar curso" y "Suspender cuenta": las dos sacan algo de la vista
 * de alguien más, y un clic suelto en una fila no debería bastar.
 *
 * El modal es un `popover` nativo, no un diálogo de React. `popovertarget` lo
 * abre y lo cierra desde HTML, así que el botón hace algo aunque el JavaScript
 * no haya cargado — con `useState` + `onClick` no haría nada (CLAUDE.md). De
 * paso el navegador pone lo demás: capa superior, Esc, clic afuera para cerrar
 * y el foco de vuelta en el botón.
 *
 * La acción va directa al `<form>` (vía `useActionState`), nunca envuelta en un
 * closure: eso le quitaría el `$ACTION_ID` y dejaría de enviar sin JavaScript.
 *
 * El cuerpo llega como `children` desde el servidor: lo que se explica en el
 * modal se arma donde están los datos, y este archivo no sabe de cursos ni de
 * alumnos.
 */

type Tono = 'destructivo' | 'neutro'

function Confirmar({ texto, enCurso, tono }: { texto: string; enCurso: string; tono: Tono }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant={tono === 'destructivo' ? 'destructive' : 'default'} disabled={pending}>
      {pending ? enCurso : texto}
    </Button>
  )
}

export function ConfirmarConModal({
  idModal,
  accion,
  campos,
  boton,
  titulo,
  confirmar,
  children,
}: {
  /** Único en la página: es el `id` del popover. */
  idModal: string
  accion: (previo: EstadoAccion, datos: FormData) => Promise<EstadoAccion>
  /** Viajan como inputs ocultos. */
  campos: Record<string, string>
  boton: { texto: string; etiquetaAccesible: string; tono?: Tono }
  titulo: string
  confirmar: { texto: string; enCurso: string; tono?: Tono }
  children: ReactNode
}) {
  const [estado, enviar] = useActionState(accion, SIN_ESTADO)
  const idTitulo = `${idModal}-titulo`

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={
          boton.tono === 'destructivo' ? 'text-destructive hover:text-destructive' : undefined
        }
        popoverTarget={idModal}
        aria-haspopup="dialog"
        aria-label={boton.etiquetaAccesible}
      >
        {boton.texto}
      </Button>

      {/* Sin clase de `display` aquí: pisaría el `display: none` con el que el
          navegador esconde un popover cerrado. Y `m-auto` porque el reset de
          Tailwind borra el margen que lo centra. */}
      <div
        id={idModal}
        popover="auto"
        role="dialog"
        aria-labelledby={idTitulo}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-lg backdrop:bg-black/50"
      >
        <form action={enviar} className="flex flex-col gap-4 p-5">
          {Object.entries(campos).map(([nombre, valor]) => (
            <input key={nombre} type="hidden" name={nombre} value={valor} />
          ))}

          <h2 id={idTitulo} className="text-lg font-medium">
            {titulo}
          </h2>

          <div className="flex flex-col gap-3 text-sm text-muted-foreground">{children}</div>

          <AvisoAccion estado={estado} />

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              popoverTarget={idModal}
              popoverTargetAction="hide"
            >
              Cancelar
            </Button>
            <Confirmar
              texto={confirmar.texto}
              enCurso={confirmar.enCurso}
              tono={confirmar.tono ?? 'neutro'}
            />
          </div>
        </form>
      </div>
    </>
  )
}
