import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * El botón de suscribirse de las páginas de venta (M23, 20-oct-2026).
 *
 * Todas las llamadas a la acción de una página salen de aquí, así comparten
 * la misma regla: el mismo link de pago (ya personalizado con el correo de
 * quien tiene sesión) y nada pintado cuando la suscripción no abre todavía.
 * Un `<a>` de servidor, sin JavaScript: funciona con JS apagado y no espera a
 * hidratar.
 *
 * `lugar` va en `data-cta`: lo cuentan la suite (test-venta-vaip) y la
 * auditoría de capturas, que mide si el del encabezado se ve sin hacer scroll.
 */
export function BotonSuscribir({
  enlace,
  lugar,
  sobreFoto = false,
  className,
  children,
}: {
  /** El link de pago ya personalizado, o null si la suscripción no abre todavía. */
  enlace: string | null
  lugar: string
  /** Encima del flyer navy: lima fijo, que no cambia con el tema. */
  sobreFoto?: boolean
  className?: string
  children: ReactNode
}) {
  if (!enlace) return null
  return (
    <Button
      asChild
      size="lg"
      variant={sobreFoto ? 'default' : 'acento'}
      className={cn(
        'h-12 w-full px-6 text-base sm:w-fit sm:px-8',
        sobreFoto && 'bg-vadai-lima text-vadai-navy hover:bg-vadai-lima hover:brightness-105',
        className
      )}
    >
      <a href={enlace} data-cta={lugar}>
        {children}
      </a>
    </Button>
  )
}

/** Lo que va en lugar del botón mientras la suscripción no abre. */
export function SuscripcionCerrada({ sobreFoto = false, className }: { sobreFoto?: boolean; className?: string }) {
  return (
    <p
      className={cn(
        'rounded-lg border border-dashed px-4 py-3 text-center text-sm sm:w-fit',
        sobreFoto ? 'border-white/30 text-white/80' : 'border-border text-muted-foreground',
        className
      )}
    >
      La suscripción abre muy pronto.
    </p>
  )
}

/**
 * La barra de suscribirse, pegada abajo en teléfono y tableta.
 *
 * Va con `sticky` como ÚLTIMO hijo del bloque de secciones que sigue al
 * encabezado, pegada encima de la barra inferior del portal si la hay
 * (`--alto-barra-inferior`). Así funciona sin JavaScript y sin tapar nada: no puede
 * aparecer encima del encabezado (su bloque todavía no empieza) y al final del
 * scroll se asienta en su lugar, arriba del cierre, en vez de flotar sobre él.
 * Donde el navegador anima con el scroll (`app/globals.css`, `.barra-suscribir`)
 * entra cuando el botón del encabezado ya salió de la vista.
 *
 * `pb-seguro` deja libre la barrita de inicio del iPhone. Desde `lg` no existe:
 * en escritorio el botón del encabezado y los de cada sección bastan.
 */
export function BarraSuscribir({
  enlace,
  precio,
  etiqueta = 'Unirme',
}: {
  enlace: string | null
  /** El precio ya con formato, p. ej. «$349». */
  precio: string
  etiqueta?: string
}) {
  if (!enlace) return null
  return (
    <div
      data-barra-inferior
      className="barra-suscribir sticky bottom-[var(--alto-barra-inferior,0px)] z-20 -mx-5 border-t border-border bg-background/95 px-5 pt-3 pb-seguro backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="text-lg font-semibold tabular-nums">
            {precio} <span className="text-sm font-normal text-muted-foreground">MXN al mes</span>
          </span>
          <span className="text-xs text-muted-foreground">Cancelas cuando quieras</span>
        </div>
        <BotonSuscribir enlace={enlace} lugar="barra" className="w-auto shrink-0">
          {etiqueta}
        </BotonSuscribir>
      </div>
    </div>
  )
}
