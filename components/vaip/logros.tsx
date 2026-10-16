import type { Logro } from '@/lib/gamificacion/logros'
import { cn } from '@/lib/utils'

/**
 * Los logros (M17): los ganados en lima con su destello —lima es «lo logrado»
 * en la marca—, los pendientes apagados y con cuánto falta, para que se vea
 * el siguiente paso.
 */
export function Logros({ logros, compacto = false }: { logros: Logro[]; compacto?: boolean }) {
  const ordenados = [...logros].sort((a, b) => Number(b.ganado) - Number(a.ganado))
  return (
    <ul className={cn('grid gap-2', compacto ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2')}>
      {ordenados.map((l) => (
        <li
          key={l.clave}
          className={cn(
            'flex items-center gap-3 rounded-[10px] border px-3 py-2.5',
            l.ganado ? 'border-accent bg-accent/15' : 'border-border'
          )}
        >
          <span
            aria-hidden
            className={cn(
              'grid size-8 shrink-0 place-items-center rounded-full',
              l.ganado ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
            )}
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
              <path d="M12 2c.6 4.7 2.6 6.7 7.3 7.3-4.7.6-6.7 2.6-7.3 7.3-.6-4.7-2.6-6.7-7.3-7.3 4.7-.6 6.7-2.6 7.3-7.3Z" />
            </svg>
          </span>
          <span className="flex min-w-0 flex-col">
            <span className={cn('text-sm font-medium', !l.ganado && 'text-muted-foreground')}>{l.nombre}</span>
            <span className="text-xs text-pretty text-muted-foreground">
              {l.ganado || !l.avance ? l.detalle : `${l.avance.actual} de ${l.avance.meta} · ${l.detalle}`}
            </span>
          </span>
          <span className="sr-only">{l.ganado ? 'Ganado' : 'Pendiente'}</span>
        </li>
      ))}
    </ul>
  )
}
