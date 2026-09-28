import Link from 'next/link'

import { Avatar, Progreso } from '@/components/ui-vadai/superficie'
import type { AlumnoEnPuntos } from '@/lib/admin/puntos'
import { cn } from '@/lib/utils'

import { DiscoDeLugar } from './tabla-puntos'

/**
 * Los cinco con más puntos de la academia, como tarjetas (26-sep-2026).
 *
 * Tarjetas y no renglones porque el panel se proyecta: en sala, cinco
 * bloques con el nombre, los puntos y la barra al siguiente nivel se leen
 * desde el fondo; una tabla no. El primero va en lima, que es el color de lo
 * logrado en toda la plataforma.
 */
export function TopPuntos({ alumnos }: { alumnos: AlumnoEnPuntos[] }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {alumnos.map((a) => (
        <li key={a.userId}>
          <Link
            href={`/admin/alumnos/${a.userId}`}
            className={cn(
              'flex h-full flex-col gap-3 rounded-[10px] border bg-card p-4 transition-[border-color,box-shadow]',
              'hover:shadow-[0_1px_2px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.06)]',
              'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              a.posicion === 1 ? 'border-accent bg-accent/10 hover:border-accent' : 'border-border hover:border-primary/50'
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <DiscoDeLugar posicion={a.posicion} grande />
              <Avatar nombre={a.nombre} tamano={36} />
            </span>

            <span className="flex min-w-0 flex-col">
              <span className="line-clamp-2 font-medium leading-snug text-balance">{a.nombre}</span>
              <span className="truncate text-xs text-muted-foreground">{a.empresa?.nombre ?? 'General'}</span>
            </span>

            <span className="mt-auto flex flex-col gap-1.5">
              <span className="flex items-baseline gap-1.5">
                <span className="text-[1.75rem] leading-none font-medium text-primary tabular-nums">{a.puntos}</span>
                <span className="text-xs text-muted-foreground">puntos</span>
              </span>
              <span className="text-xs text-muted-foreground">
                Nivel {a.nivel.numero} · {a.nivel.nombre}
              </span>
              <Progreso
                porcentaje={a.nivel.progreso}
                etiqueta={
                  a.nivel.siguiente
                    ? `${a.nivel.progreso}% del camino a ${a.nivel.siguiente.nombre}`
                    : 'Nivel máximo'
                }
              />
              <span className="text-xs text-muted-foreground">
                {a.nivel.siguiente ? `faltan ${a.nivel.faltan} para ${a.nivel.siguiente.nombre}` : 'Nivel máximo'}
                {' · '}
                {a.porcentaje}% del curso
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  )
}
