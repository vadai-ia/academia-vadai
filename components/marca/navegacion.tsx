'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Navegación principal, como pastillas.
 *
 * Antes eran enlaces de texto gris en el encabezado. El problema no era estético
 * sino funcional: no había forma de saber que eran clickeables sin pasar el
 * ratón por encima, y en un teléfono no existe el "pasar por encima". Tampoco
 * se veía en cuál estabas.
 *
 * Una pastilla resuelve las dos cosas a la vez: tiene forma de control, así que
 * se lee como algo que se toca, y la activa se rellena — no solo cambia de
 * color, que es lo único que distinguiría un subrayado.
 *
 * Cada pastilla lleva icono Y texto. Un icono solo ahorra espacio y cuesta
 * comprensión: nadie adivina qué sección es un cuadrito.
 */

export type Destino = {
  href: string
  etiqueta: string
  icono: ReactNode
  /** Exacto para la raíz de una sección; por prefijo para sus hijas. */
  exacto?: boolean
}

export function NavegacionPrincipal({ destinos }: { destinos: Destino[] }) {
  const ruta = usePathname()

  return (
    <nav
      aria-label="Secciones"
      className="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {destinos.map((d) => {
        const activa = d.exacto ? ruta === d.href : ruta === d.href || ruta.startsWith(`${d.href}/`)

        return (
          <Link
            key={d.href}
            href={d.href}
            aria-current={activa ? 'page' : undefined}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2',
              'text-sm font-medium whitespace-nowrap transition-colors',
              'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              activa
                ? 'bg-primary/12 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <span className="shrink-0">{d.icono}</span>
            {d.etiqueta}
          </Link>
        )
      })}
    </nav>
  )
}

/* Iconos de línea, mismo grosor y mismo tamaño en todos. */

function marco(hijos: ReactNode) {
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
      {hijos}
    </svg>
  )
}

export const IconoInicio = marco(
  <>
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M9 22V12h6v10" />
  </>
)

export const IconoCursos = marco(
  <>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
  </>
)

export const IconoBlog = marco(
  <>
    <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9h4" />
    <path d="M10 6h8M10 10h8M10 14h4" />
  </>
)

export const IconoPerfil = marco(
  <>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </>
)

export const IconoPanel = marco(
  <>
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </>
)
