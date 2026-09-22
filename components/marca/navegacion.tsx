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
 *
 * SOBRE EL DESBORDE — la queja que motivó la fila propia en el encabezado:
 *
 * En escritorio (`md` en adelante) las pastillas ENVUELVEN a un segundo
 * renglón si no caben. Nunca se recortan y nunca se desplazan: un menú que se
 * esconde es peor que uno que no existe, porque nadie sabe que le falta algo.
 *
 * En móvil sí se desplazan en horizontal —apilar seis pastillas a 375 px
 * ocuparía media pantalla— pero el contenedor lleva un DEGRADADO en el borde
 * derecho mientras hay más contenido. Es la pista que faltaba: la barra de
 * scroll iba oculta y el recorte parecía un error de diseño. El degradado se
 * hace con `mask-image`, así que las pastillas se desvanecen hacia el borde en
 * vez de cortarse en seco.
 */

export type Destino = {
  href: string
  etiqueta: string
  icono: ReactNode
  /** Exacto para la raíz de una sección; por prefijo para sus hijas. */
  exacto?: boolean
  /**
   * Cuántas novedades hay sin ver en ese destino. 0 o ausente no pinta nada:
   * un cero en un contador es ruido, y peor, se lee como si algo fallara.
   */
  novedades?: number
}

export function NavegacionPrincipal({ destinos }: { destinos: Destino[] }) {
  const ruta = usePathname()

  return (
    <nav
      aria-label="Secciones"
      className={cn(
        // Móvil: una fila que se desplaza, con el borde derecho desvanecido
        // mientras haya más. El padding derecho extra deja que la última
        // pastilla se lea completa al llegar al final del desplazamiento.
        '-mx-5 flex items-center gap-1 overflow-x-auto px-5 pr-10',
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        '[mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)]',
        // Escritorio: sin desplazamiento y sin máscara. Si no caben, envuelven.
        'md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pr-0 md:[mask-image:none]'
      )}
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
            {d.novedades && d.novedades > 0 ? (
              <span
                // El número va DENTRO del texto accesible, no solo en color:
                // "Comunidad, 3 sin ver" se lee entero en un lector de pantalla.
                aria-label={`${d.novedades} sin ver`}
                className={cn(
                  'inline-flex min-w-5 items-center justify-center rounded-full px-1.5',
                  'text-xs font-medium tabular-nums',
                  activa ? 'bg-primary text-primary-foreground' : 'bg-primary/15 text-primary'
                )}
              >
                {d.novedades > 99 ? '99+' : d.novedades}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}

// Los iconos viven en ./iconos-navegacion.tsx, que NO es de cliente. Exportar
// elementos ya construidos desde un archivo 'use client' rompe el lector de RSC
// en desarrollo; la explicación completa está allá.
