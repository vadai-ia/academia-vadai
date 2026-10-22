import Link from 'next/link'

import type { GeneracionParaSelector } from '@/lib/alumno/generaciones-equipo'
import { cn } from '@/lib/utils'

/**
 * El selector de generación que ve el EQUIPO en la comunidad (M16). El alumno
 * nunca lo ve: su muro es el de su generación.
 *
 * Era una segunda fila de pestañas debajo de las del curso (22-oct-2026,
 * Alejandro: «un conjunto de sub botones… lo hace un poco confuso»). Ahora es
 * UNA pastilla que dice qué generación estás viendo y abre la lista: sigue
 * contestando «¿de qué generación están escribiendo?» (3-oct-2026) sin
 * parecer otra navegación. Un `<details>` con enlaces `?gen=`: sin JavaScript
 * funciona igual.
 */
export function SelectorDeGeneracion({
  base,
  generaciones,
  activa,
}: {
  /** La ruta de la comunidad, con o sin `?curso=`. */
  base: string
  generaciones: GeneracionParaSelector[]
  activa: string | null
}) {
  const separador = base.includes('?') ? '&' : '?'
  const actual = generaciones.find((g) => g.id === activa) ?? generaciones[0]
  if (!actual) return null

  return (
    <details className="group/gen relative w-fit max-w-full">
      <summary
        className={cn(
          'flex h-9 max-w-full cursor-pointer list-none items-center gap-2 rounded-full whitespace-nowrap border border-dashed border-primary/50 px-3.5 text-sm transition-colors select-none pointer-coarse:h-11',
          'hover:bg-primary/5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
          '[&::-webkit-details-marker]:hidden'
        )}
      >
        <span className="shrink-0 text-muted-foreground">Equipo · viendo</span>
        <span className="min-w-0 truncate font-medium text-primary">{actual.nombre}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open/gen:rotate-180"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <nav
        aria-label="Generaciones del curso (solo el equipo)"
        className="absolute top-full left-0 z-30 mt-1 flex w-72 max-w-[calc(100vw-2.5rem)] flex-col rounded-[10px] border border-border bg-card p-1 shadow-[0_4px_16px_rgba(0,0,0,0.1)]"
      >
        {generaciones.map((g) => {
          const esta = g.id === actual.id
          return (
            <Link
              key={g.id}
              href={`${base}${separador}gen=${g.id}`}
              aria-current={esta ? 'page' : undefined}
              className={cn(
                'flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition-colors pointer-coarse:min-h-11',
                esta ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-muted'
              )}
            >
              {g.nombre}
              {g.estado === 'abierta' ? (
                <span className="text-xs text-muted-foreground">Abierta</span>
              ) : g.estado === 'terminada' ? (
                <span className="text-xs text-muted-foreground">Terminada</span>
              ) : null}
            </Link>
          )
        })}
      </nav>
    </details>
  )
}
