import { alternarReaccion } from '@/lib/comunidad/acciones-reacciones'
import { EMOJIS, type ReaccionesDe } from '@/lib/comunidad/emojis'
import { cn } from '@/lib/utils'

/**
 * La fila de emojis bajo una publicación o un comentario.
 *
 * UN SOLO `<form>` con seis botones de envío, cada uno con su `value`. Es HTML
 * de toda la vida y por eso funciona con JavaScript apagado; seis formularios
 * anidados no son válidos y `onClick` dejaría la fila muerta sin JS, que es
 * justo lo que CLAUDE.md prohíbe.
 *
 * Los que nadie ha tocado se pintan igual que los demás, en gris y sin número.
 * Esconderlos hasta que alguien reaccione es el error clásico: si no se ven, la
 * primera reacción no ocurre nunca.
 */
export function Reacciones({
  datos,
  postId,
  comentarioId,
  ruta,
  tamano = 'normal',
  sinBorde = false,
}: {
  datos: ReaccionesDe
  postId?: string
  comentarioId?: string
  /** A dónde revalidar: el mismo feed desde el que se tocó. */
  ruta: string
  tamano?: 'normal' | 'chico'
  /** Dentro del selector de `Reaccionar`: emojis grandes y sin contorno. */
  sinBorde?: boolean
}) {
  return (
    <form action={alternarReaccion} className={cn('flex items-center gap-1', !sinBorde && 'flex-wrap')}>
      {postId ? <input type="hidden" name="post_id" value={postId} /> : null}
      {comentarioId ? <input type="hidden" name="comentario_id" value={comentarioId} /> : null}
      <input type="hidden" name="ruta" value={ruta} />

      {EMOJIS.map(({ emoji, etiqueta }) => {
        const cuantas = datos.conteo[emoji] ?? 0
        const mia = datos.mias.includes(emoji)

        return (
          <button
            key={emoji}
            type="submit"
            name="emoji"
            value={emoji}
            aria-pressed={mia}
            // El título dice qué es y qué pasa al tocarlo. El emoji solo se
            // anuncia con su nombre Unicode, que no ayuda a nadie.
            title={mia ? `Quitar «${etiqueta}»` : etiqueta}
            className={cn(
              'inline-flex items-center justify-center gap-1 rounded-full border transition-colors',
              // M23: 44 px para el dedo; con ratón se quedan compactas.
              'pointer-coarse:min-h-11 pointer-coarse:min-w-11',
              'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              sinBorde
                ? 'size-10 border-transparent text-xl'
                : tamano === 'chico'
                  ? 'px-2 py-0.5 text-xs'
                  : 'px-2.5 py-1 text-sm',
              mia
                ? 'border-primary/50 bg-primary/12 text-primary'
                : sinBorde
                  ? 'hover:bg-muted'
                  : 'border-border text-muted-foreground hover:border-primary/40 hover:bg-muted'
            )}
          >
            <span aria-hidden>{emoji}</span>
            <span className="sr-only">{etiqueta}</span>
            {cuantas > 0 && !sinBorde ? <span className="tabular-nums">{cuantas}</span> : null}
          </button>
        )
      })}
    </form>
  )
}

/**
 * Las reacciones en una línea: los tres emojis más usados y el total
 * (22-oct-2026). En la tarjeta del feed, donde seis botones por publicación
 * eran justo el ruido que hacía pesado el muro. Sin reacciones no pinta nada.
 */
export function ResumenDeReacciones({ datos, className }: { datos: ReaccionesDe; className?: string }) {
  if (datos.total === 0) return null
  const top = EMOJIS.map((e) => ({ ...e, n: datos.conteo[e.emoji] ?? 0 }))
    .filter((e) => e.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 3)
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-sm text-muted-foreground', className)}
      aria-label={`${datos.total} reacci${datos.total === 1 ? 'ón' : 'ones'}`}
    >
      <span aria-hidden className="tracking-tight">
        {top.map((e) => e.emoji).join('')}
      </span>
      <span aria-hidden className="tabular-nums">
        {datos.total}
      </span>
    </span>
  )
}

/**
 * Reaccionar con un solo botón (22-oct-2026): «Me gusta» de un toque y, al
 * lado, el selector con los seis. Si ya reaccionaste, el botón enseña tu
 * emoji y tocarlo lo quita.
 *
 * El selector es un `<details>` con el mismo formulario de seis botones: abre
 * sin JavaScript y cada botón envía. El componente que lo pinta lleva en su
 * `key` el total de reacciones, así que al volver del servidor se remonta
 * cerrado.
 */
export function Reaccionar({
  datos,
  postId,
  comentarioId,
  ruta,
  chico = false,
}: {
  datos: ReaccionesDe
  postId?: string
  comentarioId?: string
  ruta: string
  /** En una respuesta: más bajo y con letra menor (el dedo sigue con 44 px). */
  chico?: boolean
}) {
  const alto = chico ? 'h-7 text-xs pointer-coarse:h-11' : 'h-9 text-sm pointer-coarse:h-11'
  const mia = EMOJIS.find((e) => datos.mias.includes(e.emoji))
  const principal = mia ?? EMOJIS[0]

  return (
    <div className="relative z-10 flex items-center">
      <form action={alternarReaccion}>
        {postId ? <input type="hidden" name="post_id" value={postId} /> : null}
        {comentarioId ? <input type="hidden" name="comentario_id" value={comentarioId} /> : null}
        <input type="hidden" name="ruta" value={ruta} />
        <button
          type="submit"
          name="emoji"
          value={principal.emoji}
          aria-pressed={Boolean(mia)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-l-full border border-r-0 pr-2.5 pl-3 font-medium transition-colors',
            alto,
            'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
            mia
              ? 'border-primary/50 bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <span aria-hidden>{principal.emoji}</span>
          {mia ? principal.etiqueta : 'Me gusta'}
        </button>
      </form>

      <details className="group/selector relative">
        <summary
          aria-label="Más reacciones"
          className={cn(
            'flex cursor-pointer list-none items-center rounded-r-full border px-2.5 text-muted-foreground transition-colors select-none',
            alto,
            'hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
            '[&::-webkit-details-marker]:hidden',
            mia ? 'border-primary/50' : 'border-border'
          )}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="size-4 transition-transform group-open/selector:rotate-45"
            aria-hidden
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </summary>
        <div className="absolute bottom-full left-0 z-20 mb-2 rounded-full border border-border bg-card p-1 shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
          <Reacciones datos={datos} postId={postId} comentarioId={comentarioId} ruta={ruta} sinBorde />
        </div>
      </details>
    </div>
  )
}
