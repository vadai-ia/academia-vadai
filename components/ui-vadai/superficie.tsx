import Link from 'next/link'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Los primitivos de superficie de la plataforma.
 *
 * La geometría está tomada de Skool, medida de su CSS y no de memoria:
 *
 *   radio         10 px en 33 de 51 declaraciones
 *   borde         hairline de 1 px, muy claro (#e4e4e4 en su tema)
 *   sombra        casi ninguna — dos capas mínimas, y solo al levantar
 *   peso de letra 500 en 40 de 41 declaraciones: casi nada en negritas
 *   escala        18 px como tamaño dominante, no 14
 *
 * Lo que se copia es esa GEOMETRÍA y esa densidad, no su paleta: Skool es
 * blanco cálido con ámbar, y la marca de §9 es navy con cyan. Copiar sus
 * colores sería tirar la identidad que el logo acaba de establecer.
 *
 * Lo que hace que se vea "Skool-limpio" y no "LMS corporativo" es una decisión
 * concreta y contraintuitiva: la jerarquía la carga el ESPACIO y el tamaño, no
 * el color ni las negritas. Por eso casi todo es peso 500, casi nada lleva
 * sombra, y las tarjetas se separan del fondo con un borde de 1 px en vez de
 * flotar.
 */

/** Tarjeta base. Plana, con borde fino; se levanta solo si es clickeable. */
export function Tarjeta({
  children,
  className,
  interactiva = false,
}: {
  children: ReactNode
  className?: string
  interactiva?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-[10px] border border-border bg-card',
        interactiva &&
          'transition-[border-color,box-shadow] hover:border-primary/50 hover:shadow-[0_1px_2px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.06)]',
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * Tarjeta que es un enlace entero.
 *
 * El área clickeable es toda la tarjeta y no solo el título: en móvil apuntar a
 * un renglón de texto es justo lo que la guía de blancos táctiles pide evitar.
 */
export function TarjetaEnlace({
  href,
  children,
  className,
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group block rounded-[10px] border border-border bg-card',
        'transition-[border-color,box-shadow] hover:border-primary/50',
        'hover:shadow-[0_1px_2px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.06)]',
        'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        className
      )}
    >
      {children}
    </Link>
  )
}

/**
 * Encabezado de página.
 *
 * Un solo <h1> por pantalla y siempre en el mismo lugar: la jerarquía de
 * títulos tiene que ser predecible para quien navega con lector de pantalla.
 */
export function Titulo({
  children,
  apoyo,
  acciones,
}: {
  children: ReactNode
  apoyo?: ReactNode
  acciones?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-[1.75rem] leading-tight font-medium tracking-tight text-balance">
          {children}
        </h1>
        {apoyo ? <p className="text-[0.95rem] text-muted-foreground">{apoyo}</p> : null}
      </div>
      {acciones ? <div className="flex shrink-0 items-center gap-2">{acciones}</div> : null}
    </header>
  )
}

/** Título de sección, un escalón por debajo del <h1>. */
export function Seccion({
  titulo,
  apoyo,
  accion,
  children,
}: {
  titulo: string
  apoyo?: string
  accion?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-lg font-medium tracking-tight">{titulo}</h2>
          {apoyo ? <p className="text-sm text-muted-foreground">{apoyo}</p> : null}
        </div>
        {accion}
      </div>
      {children}
    </section>
  )
}

/**
 * Cifra grande con su etiqueta.
 *
 * `tabular-nums` no es capricho: sin él, un 1 ocupa menos que un 8 y la fila de
 * cifras se mueve sola cada vez que cambia un número.
 */
export function Cifra({
  valor,
  etiqueta,
  detalle,
  destacada = false,
}: {
  valor: number | string
  etiqueta: string
  detalle?: string
  destacada?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className={cn(
          'text-[1.75rem] leading-none font-medium tabular-nums',
          destacada && 'text-primary'
        )}
      >
        {valor}
      </span>
      <span className="text-sm text-muted-foreground">{etiqueta}</span>
      {detalle ? <span className="text-xs text-muted-foreground/80">{detalle}</span> : null}
    </div>
  )
}

/**
 * Avatar de iniciales.
 *
 * Sin foto, la alternativa es un icono genérico repetido: en un hilo de
 * comentarios eso hace que todos los mensajes se vean iguales. Las iniciales
 * distinguen de un vistazo quién habla, que es para lo que sirve el avatar.
 */
export function Avatar({
  nombre,
  tamano = 36,
  className,
}: {
  nombre: string
  tamano?: number
  className?: string
}) {
  const iniciales =
    nombre
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() || '·'

  // Tres tonos de marca, elegidos por el nombre y no al azar: la misma
  // persona siempre sale del mismo color, y en un hilo se distinguen entre sí
  // (25-sep-2026). Los tres cumplen AA en los dos temas.
  const TONOS = [
    'bg-primary/15 text-primary',
    'bg-accent text-accent-foreground',
    'bg-secondary text-secondary-foreground',
  ] as const
  let suma = 0
  for (const c of nombre) suma = (suma + c.charCodeAt(0)) % TONOS.length
  const tono = TONOS[suma] ?? TONOS[0]

  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        'font-medium select-none',
        tono,
        className
      )}
      style={{ width: tamano, height: tamano, fontSize: Math.round(tamano * 0.38) }}
    >
      {iniciales}
    </span>
  )
}

/** Barra de progreso fina, del ancho del contenedor. */
export function Progreso({
  porcentaje,
  className,
  etiqueta,
}: {
  porcentaje: number
  className?: string
  etiqueta?: string
}) {
  const valor = Math.max(0, Math.min(100, Math.round(porcentaje)))

  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}
      role="progressbar"
      aria-valuenow={valor}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={etiqueta ?? `${valor}% completado`}
    >
      {/* Al 100 % se pone lima: lo logrado es lima en toda la plataforma. */}
      <span
        className={cn(
          'block h-full rounded-full transition-[width,background-color] duration-500',
          valor >= 100 ? 'bg-accent' : 'bg-primary'
        )}
        style={{ width: `${valor}%` }}
      />
    </div>
  )
}
