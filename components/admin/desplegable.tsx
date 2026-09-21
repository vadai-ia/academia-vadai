import type { ReactNode } from 'react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Un formulario —o cualquier cosa— que solo aparece cuando se pide.
 *
 * Nace en M14 · Fase 1 (21-sep-2026). El panel tenía los formularios de
 * agendar, crear y editar siempre abiertos, y una pantalla llena de campos
 * vacíos es ruido para quien vino a otra cosa. Ahora cada uno vive detrás de
 * su botón, y el botón dice qué va a pasar: "Agendar sesión", "Nuevo módulo".
 *
 * Es <details>/<summary> nativo y no estado de React: sin JavaScript el botón
 * sigue abriendo (CLAUDE.md). El <summary> se viste con `buttonVariants` para
 * que sea IDÉNTICO a un <Button>, y lleva data-slot="button" para heredar los
 * 44 px táctiles de app/globals.css.
 *
 * `abierto` lo decide el SERVIDOR, nunca un useState. El componente dueño del
 * `useActionState` pasa `abierto={Boolean(estado.error || estado.aviso)}`, y
 * el panel se abre solo cuando hay algo que ver: el error de validación o el
 * aviso de éxito. Eso funciona también en el envío sin JavaScript, porque
 * React siembra `useActionState` con lo que devolvió la acción al volver a
 * pintar la página.
 *
 * `nombre` es el `name` nativo de <details>: varios con el mismo nombre se
 * cierran entre sí, sin una línea de JavaScript.
 */

export type VarianteDesplegable = 'primario' | 'contorno' | 'discreto'

const VARIANTE = { primario: 'default', contorno: 'outline', discreto: 'ghost' } as const

export function Desplegable({
  etiqueta,
  variante = 'contorno',
  tamano = 'default',
  icono = 'mas',
  abierto = false,
  id,
  nombre,
  ayuda,
  className,
  children,
}: {
  etiqueta: string
  variante?: VarianteDesplegable
  tamano?: 'default' | 'sm'
  icono?: 'mas' | 'lapiz' | 'ninguno'
  /** Lo decide el servidor: el estado de la acción o un parámetro de la URL. */
  abierto?: boolean
  /** Ancla (#agendar) para llegar aquí desde otra pantalla. */
  id?: string
  /** `name` nativo: los <details> con el mismo nombre se cierran entre sí. */
  nombre?: string
  /** Frase corta a la derecha del botón. */
  ayuda?: string
  className?: string
  children: ReactNode
}) {
  return (
    <details id={id} name={nombre} open={abierto || undefined} className={cn('group/desplegable', className)}>
      <summary
        data-slot="button"
        className={cn(
          buttonVariants({ variant: VARIANTE[variante], size: tamano }),
          'w-fit list-none [&::-webkit-details-marker]:hidden'
        )}
      >
        {icono === 'mas' ? <IconoMas /> : icono === 'lapiz' ? <IconoLapiz /> : null}
        {etiqueta}
      </summary>

      {ayuda ? <span className="ml-3 text-xs text-muted-foreground">{ayuda}</span> : null}

      <div className="mt-3 rounded-[10px] border border-border bg-card p-4 sm:p-5">{children}</div>
    </details>
  )
}

/** El "+" que gira a "×" cuando el panel está abierto. */
function IconoMas() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className="size-4 transition-transform group-open/desplegable:rotate-45"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function IconoLapiz() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}
