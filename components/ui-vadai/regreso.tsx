import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * «← Noticias», «← Muro», «← Grupo»: el regreso de una página de detalle
 * (22-oct-2026). Como el botón de atrás de una app: arriba a la izquierda,
 * siempre en el mismo lugar y con el nombre de a dónde vuelves.
 */
export function Regreso({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="-ml-2 inline-flex h-9 w-fit items-center gap-1.5 rounded-full px-2 text-sm font-medium text-muted-foreground transition-colors pointer-coarse:h-11 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
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
        <path d="m15 18-6-6 6-6" />
      </svg>
      {children}
    </Link>
  )
}
