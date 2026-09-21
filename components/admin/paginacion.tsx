import Link from 'next/link'

import { cn } from '@/lib/utils'

/**
 * "Mostrando 1–25 de 155" y las páginas como enlaces.
 *
 * Enlaces planos, no botones con estado: funcionan sin JavaScript, se
 * comparten y se vuelve con "atrás". La ventana enseña la primera, la última y
 * las vecinas de la actual; lo demás es "…".
 */
export function Paginacion({
  pagina,
  paginas,
  total,
  porPagina,
  hrefDe,
}: {
  pagina: number
  paginas: number
  total: number
  porPagina: number
  hrefDe: (pagina: number) => string
}) {
  const desde = total === 0 ? 0 : (pagina - 1) * porPagina + 1
  const hasta = Math.min(pagina * porPagina, total)

  const ventana = new Set([1, paginas, pagina - 1, pagina, pagina + 1].filter((p) => p >= 1 && p <= paginas))
  const numeros = [...ventana].sort((a, b) => a - b)

  const pastilla =
    'inline-flex min-h-9 min-w-9 items-center justify-center rounded-full border px-3 text-sm font-medium tabular-nums transition-colors'

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground tabular-nums">
        {total === 0 ? 'Sin resultados' : `Mostrando ${desde}–${hasta} de ${total}`}
      </p>

      {paginas > 1 ? (
        <nav aria-label="Páginas" className="flex flex-wrap items-center gap-1.5">
          {pagina > 1 ? (
            <Link rel="prev" href={hrefDe(pagina - 1)} className={cn(pastilla, 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground')}>
              Anterior
            </Link>
          ) : null}

          {numeros.map((n, i) => {
            const salto = i > 0 && n - (numeros[i - 1] ?? n) > 1
            const actual = n === pagina
            return (
              <span key={n} className="flex items-center gap-1.5">
                {salto ? <span className="px-1 text-muted-foreground">…</span> : null}
                <Link
                  href={hrefDe(n)}
                  aria-current={actual ? 'page' : undefined}
                  className={cn(
                    pastilla,
                    actual
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                  )}
                >
                  {n}
                </Link>
              </span>
            )
          })}

          {pagina < paginas ? (
            <Link rel="next" href={hrefDe(pagina + 1)} className={cn(pastilla, 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground')}>
              Siguiente
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  )
}
