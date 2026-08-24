import Image from 'next/image'

import { cn } from '@/lib/utils'

/**
 * Wordmark oficial de VADAI.
 *
 * El asset es arte NEGRO sobre transparente, así que sobre el navy del tema
 * oscuro sencillamente desaparece. Por eso va siempre sobre una placa blanca,
 * en los dos temas: en el claro se funde con la tarjeta y no se nota; en el
 * oscuro es un recuadro deliberado, que además es como se usa una marca sobre
 * fondos que no controla.
 *
 * Recolorearlo con filtros CSS no es opción: modificar los colores de una marca
 * es justo lo que las guías de uso prohíben, y el cyan del logo se perdería.
 *
 * `priority` porque aparece arriba del pliegue en la portada y en el encabezado:
 * cargarlo tarde deja un hueco donde va la marca.
 */

const PROPORCION = 900 / 305 // del archivo ya recortado

export function Wordmark({
  className,
  alto = 28,
  prioridad = false,
}: {
  className?: string
  /** Alto del logo en px. La placa crece con él. */
  alto?: number
  prioridad?: boolean
}) {
  const ancho = Math.round(alto * PROPORCION)

  return (
    <span
      className={cn(
        'placa-logo inline-flex shrink-0 items-center justify-center rounded-lg',
        className
      )}
      style={{ padding: `${Math.round(alto * 0.3)}px ${Math.round(alto * 0.45)}px` }}
    >
      <Image
        src="/vadai-wordmark.png"
        alt="VADAI · Tecnología para la evolución humana"
        width={ancho}
        height={alto}
        priority={prioridad}
        className="h-auto w-auto"
        style={{ height: alto, width: ancho }}
      />
    </span>
  )
}

/**
 * Sello circular, para donde el wordmark horizontal no cabe.
 *
 * Este NO lleva `placa-logo`: a diferencia del wordmark, el archivo ya trae su
 * disco blanco horneado, porque el mismo PNG se usa de favicon y ahí no hay CSS
 * que valga. Poner la placa encima sería un blanco sobre otro blanco.
 */
export function Sello({ className, tamano = 64 }: { className?: string; tamano?: number }) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center', className)}
    >
      <Image
        src="/vadai-sello.png"
        alt="VADAI"
        width={tamano}
        height={tamano}
        style={{ height: tamano, width: tamano }}
      />
    </span>
  )
}

/**
 * "ACADEMIA" en texto, para acompañar al wordmark.
 *
 * El logo dice VADAI, no VADAI Academia. Separarlo deja que el logo se use tal
 * cual —sin retocarlo— y que la palabra siga el color del tema.
 */
export function EtiquetaAcademia({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'text-[0.7rem] font-medium tracking-[0.32em] text-muted-foreground select-none',
        className
      )}
    >
      ACADEMIA
    </span>
  )
}
