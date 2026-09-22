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
}: {
  datos: ReaccionesDe
  postId?: string
  comentarioId?: string
  /** A dónde revalidar: el mismo feed desde el que se tocó. */
  ruta: string
  tamano?: 'normal' | 'chico'
}) {
  return (
    <form action={alternarReaccion} className="flex flex-wrap items-center gap-1">
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
              'inline-flex items-center gap-1 rounded-full border transition-colors',
              'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              tamano === 'chico' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
              mia
                ? 'border-primary/50 bg-primary/12 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/40 hover:bg-muted'
            )}
          >
            <span aria-hidden>{emoji}</span>
            <span className="sr-only">{etiqueta}</span>
            {cuantas > 0 ? <span className="tabular-nums">{cuantas}</span> : null}
          </button>
        )
      })}
    </form>
  )
}
