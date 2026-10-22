'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import type { Destino } from '@/components/marca/navegacion'
import { cn } from '@/lib/utils'

/**
 * La navegación del teléfono, abajo y fija, como en una app (22-oct-2026).
 *
 * Alejandro: «que la navegación sea muy simple, como si fuera una aplicación
 * móvil». Arriba, las cuatro pastillas eran una segunda fila del encabezado: con
 * la marca, la campana y la cuenta sumaban ~120 px pegajosos antes de cualquier
 * contenido, y quedaban lejos del pulgar. Aquí van icono sobre texto —el texto
 * se queda: un icono solo no dice qué sección es— y la activa lleva su icono en
 * una pastilla, que se distingue sin depender del color.
 *
 * Solo debajo de `md`; desde ahí siguen las pastillas del encabezado. Mide
 * `--alto-barra-inferior` (globals.css), con el que el contenido deja su lugar
 * y lo que se pega abajo —la barra de suscribir, la de las herramientas— se
 * pega ENCIMA de ella y no detrás.
 */
export function BarraInferior({ destinos }: { destinos: Destino[] }) {
  const ruta = usePathname()

  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-4">
        {destinos.map((d) => {
          const activa =
            (d.exacto ? ruta === d.href : ruta === d.href || ruta.startsWith(`${d.href}/`)) ||
            (d.tambien ?? []).some((prefijo) => ruta.startsWith(prefijo))

          return (
            <Link
              key={d.href}
              href={d.href}
              aria-current={activa ? 'page' : undefined}
              className={cn(
                'group flex flex-col items-center justify-center gap-1 text-[0.6875rem] leading-none font-medium transition-colors',
                'focus-visible:outline-none',
                activa ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <span
                className={cn(
                  'relative inline-flex h-8 w-14 items-center justify-center rounded-full transition-colors [&_svg]:size-[1.375rem]',
                  'group-focus-visible:ring-3 group-focus-visible:ring-ring/50',
                  activa ? 'bg-primary/12' : 'group-active:bg-muted'
                )}
              >
                {d.icono}
                {d.novedades && d.novedades > 0 ? (
                  <span
                    aria-label={`${d.novedades} sin ver`}
                    className="absolute -top-1 right-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] font-medium text-primary-foreground tabular-nums"
                  >
                    {d.novedades > 99 ? '99+' : d.novedades}
                  </span>
                ) : null}
              </span>
              {d.etiqueta}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
