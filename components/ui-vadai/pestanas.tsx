'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

/**
 * Pestañas de sección, al estilo de Skool.
 *
 * Es la pieza que más cambia la sensación de la plataforma. Antes cada parte de
 * un curso era una página suelta a la que se llegaba por un enlace perdido en
 * el cuerpo: el contenido por el índice, la comunidad por una tarjeta a media
 * página, las sesiones por otra. No había forma de saber qué más había ahí
 * dentro sin bajar a buscarlo.
 *
 * Skool resuelve eso con una fila de pestañas fija bajo el encabezado del
 * grupo. Todo lo que el grupo ofrece está a la vista y a un clic, y el subrayado
 * dice siempre dónde estás. Eso es lo que se replica.
 *
 * Detalles que sostienen la copia:
 *
 *   - `aria-current="page"` además del subrayado. El color solo no basta:
 *     quien no distingue ese contraste, o usa lector de pantalla, necesita que
 *     la pestaña activa lo diga.
 *   - Deshabilitadas con motivo. Una pestaña que no aplica —la comunidad con el
 *     acceso vencido— se muestra apagada CON su explicación, en vez de
 *     desaparecer: si desaparece, el alumno cree que la plataforma perdió algo.
 *   - Desplazamiento horizontal en móvil, sin barra visible. Cuatro pestañas no
 *     caben a 375 px, y apilarlas rompería la metáfora.
 */

export type Pestana = {
  href: string
  etiqueta: string
  /** Exacto para la raíz de la sección; por prefijo para las hijas. */
  exacto?: boolean
  /**
   * Manda sobre la detección por ruta. Es para pestañas que filtran con
   * `?ver=…`: todas comparten la misma ruta, así que solo el servidor —que sí
   * lee los parámetros— sabe cuál está activa.
   */
  activa?: boolean
  deshabilitada?: boolean
  motivo?: string
  insignia?: string | number
  /** `vivo` pinta la insignia en lima: es para "Ahora", que sí urge. */
  tono?: 'vivo'
}

export function Pestanas({
  pestanas,
  etiqueta = 'Secciones del curso',
}: {
  pestanas: Pestana[]
  /** Para el lector de pantalla. Estas pestañas ya no son solo de un curso. */
  etiqueta?: string
}) {
  const ruta = usePathname()

  return (
    <nav
      aria-label={etiqueta}
      className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex min-w-max items-center gap-1 border-b border-border">
        {pestanas.map((p) => {
          const activa =
            p.activa ??
            (p.exacto ? ruta === p.href : ruta === p.href || ruta.startsWith(`${p.href}/`))

          const clases = cn(
            'relative -mb-px inline-flex items-center gap-2 border-b-2 px-3.5 py-3',
            'text-[0.95rem] font-medium whitespace-nowrap transition-colors',
            'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
            activa
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
          )

          if (p.deshabilitada) {
            return (
              <li key={p.href}>
                <span
                  className={cn(clases, 'cursor-not-allowed opacity-50 hover:border-transparent')}
                  title={p.motivo}
                  aria-disabled="true"
                >
                  {p.etiqueta}
                  <Candado />
                </span>
              </li>
            )
          }

          return (
            <li key={p.href}>
              <Link href={p.href} className={clases} aria-current={activa ? 'page' : undefined}>
                {p.etiqueta}
                {p.insignia !== undefined && p.insignia !== 0 ? (
                  <span
                    className={cn(
                      'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs tabular-nums',
                      p.tono === 'vivo' ? 'bg-accent text-accent-foreground' : 'bg-muted'
                    )}
                  >
                    {p.insignia}
                  </span>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function Candado() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5"
      aria-hidden
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}
