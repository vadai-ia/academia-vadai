import { Avatar } from '@/components/ui-vadai/superficie'
import { rankingDelCurso } from '@/lib/gamificacion/consultas'

/**
 * El ranking del grupo, arriba del feed de la comunidad.
 *
 * Los tres primeros llevan medalla; el resto, su número. Tu fila se resalta
 * aunque vayas en el lugar 30, y si no estás entre los primeros cinco se
 * agrega tu renglón abajo con una línea de "…" en medio: lo que se busca es
 * "¿dónde voy yo?", no la lista completa. La lista completa está en un
 * <details>, para quien quiera verla.
 *
 * Server component: lee la vista con la sesión del alumno y pinta. Las
 * animaciones de entrada son CSS puro (tw-animate-css) con un retraso por
 * fila, y se apagan con reduced-motion.
 */

const CUANTOS_ARRIBA = 5

export async function Ranking({ cursoId, userId }: { cursoId: string; userId: string }) {
  const ranking = await rankingDelCurso(cursoId, userId)
  if (ranking.total === 0) return null

  const arriba = ranking.puestos.slice(0, CUANTOS_ARRIBA)
  const yoAbajo = ranking.yo && ranking.yo.posicion > CUANTOS_ARRIBA ? ranking.yo : null

  return (
    <section
      aria-labelledby="ranking-del-grupo"
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="ranking-del-grupo" className="font-medium">
          Ranking del grupo
        </h2>
        <span className="text-xs text-muted-foreground">
          {ranking.total} {ranking.total === 1 ? 'persona' : 'personas'}
          {ranking.yo ? ` · vas en el lugar ${ranking.yo.posicion}` : ''}
        </span>
      </div>

      <ol className="flex flex-col gap-1.5">
        {arriba.map((p, i) => (
          <Fila key={p.userId} puesto={p} retraso={i * 70} />
        ))}
        {yoAbajo ? (
          <>
            <li aria-hidden className="py-0.5 text-center text-xs text-muted-foreground">
              ···
            </li>
            <Fila puesto={yoAbajo} retraso={CUANTOS_ARRIBA * 70} />
          </>
        ) : null}
      </ol>

      {ranking.total > CUANTOS_ARRIBA ? (
        <details className="group/todos text-sm">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-primary select-none underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
            Ver a todo el grupo
            <span aria-hidden className="transition-transform group-open/todos:rotate-90">›</span>
          </summary>
          <ol className="mt-3 flex flex-col gap-1">
            {ranking.puestos.slice(CUANTOS_ARRIBA).map((p) => (
              <Fila key={p.userId} puesto={p} compacta />
            ))}
          </ol>
        </details>
      ) : null}
    </section>
  )
}

function Fila({
  puesto,
  retraso = 0,
  compacta = false,
}: {
  puesto: Awaited<ReturnType<typeof rankingDelCurso>>['puestos'][number]
  retraso?: number
  compacta?: boolean
}) {
  const medalla = puesto.posicion <= 3
  return (
    <li
      className={
        'flex animate-in items-center gap-3 rounded-xl px-3 fade-in slide-in-from-bottom-2 duration-500 ' +
        (compacta ? 'py-1.5 ' : 'py-2 ') +
        (puesto.soyYo
          ? 'border border-primary/40 bg-primary/5'
          : medalla && !compacta
            ? 'bg-muted/60'
            : '')
      }
      style={{ animationDelay: `${retraso}ms`, animationFillMode: 'backwards' }}
      aria-current={puesto.soyYo ? 'true' : undefined}
    >
      <span
        className={
          'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums ' +
          (puesto.posicion === 1
            ? 'bg-vadai-lima text-vadai-navy'
            : puesto.posicion === 2
              ? 'bg-foreground/10 text-foreground'
              : puesto.posicion === 3
                ? 'bg-accent/40 text-foreground'
                : 'text-muted-foreground')
        }
        aria-label={`Lugar ${puesto.posicion}`}
      >
        {puesto.posicion}
      </span>
      <Avatar nombre={puesto.nombre} tamano={compacta ? 28 : 32} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">
          {puesto.nombre}
          {puesto.soyYo ? <span className="ml-1.5 text-xs font-normal text-primary">(tú)</span> : null}
        </span>
        {!compacta ? (
          <span className="text-xs text-muted-foreground">
            Nivel {puesto.nivel.numero} · {puesto.nivel.nombre}
          </span>
        ) : null}
      </span>
      <span className="shrink-0 text-sm font-semibold text-primary tabular-nums">
        {puesto.puntos} <span className="text-xs font-normal text-muted-foreground">pts</span>
      </span>
    </li>
  )
}
