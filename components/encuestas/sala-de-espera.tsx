/**
 * La sala de espera: quién va entrando, mientras el instructor presenta.
 *
 * Es la parte "social" de la dinámica y la que la vuelve un juego antes de que
 * haya juego. Ver aparecer tu propio nombre en la pared al segundo de escanear
 * es lo que hace que la gente le diga al de junto "escanea, sí funciona".
 *
 * Cada nombre nuevo entra con una animación corta y se queda quieto. React
 * conserva el nodo de los nombres que ya estaban (misma `key`), así que la
 * animación de entrada solo corre para los que acaban de llegar: la pared no
 * parpadea entera con cada sondeo.
 *
 * Es un componente puro: recibe la lista y la pinta. Quién puede verla y con
 * qué nombres lo decide el servidor (`recienLlegados()`), que ya respeta
 * `show_names`.
 */

const TONOS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
] as const

/** Un tono estable por persona, para que su ficha no cambie de color en cada sondeo. */
function tonoDe(id: string): string {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return TONOS[h % TONOS.length] ?? TONOS[0]
}

export function SalaDeEspera({
  llegados,
  total,
}: {
  llegados: Array<{ id: string; nombre: string }>
  total: number
}) {
  const sinNombre = llegados.length === 0

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 rounded-xl border border-dashed border-border px-8 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-3xl text-balance">Ya puedes entrar desde tu celular.</p>
        <p className="text-xl text-muted-foreground text-balance">
          {total === 0
            ? 'En cuanto escanees, tu nombre aparece aquí.'
            : total === 1
              ? 'Ya hay una persona dentro. ¿Quién sigue?'
              : `Ya hay ${total} personas dentro.`}
        </p>
      </div>

      {sinNombre ? null : (
        <ul
          className="flex max-w-5xl flex-wrap items-center justify-center gap-3"
          aria-live="polite"
          aria-label="Personas que ya entraron"
        >
          {llegados.map((persona, i) => (
            <li
              key={persona.id}
              // Entra con un pequeño rebote y se queda. Solo los recién
              // llegados lo hacen: los demás conservan su nodo entre sondeos.
              className="animate-in fade-in zoom-in-75 rounded-full border-2 bg-card px-5 py-2.5 text-2xl font-medium duration-500 ease-out"
              style={{
                borderColor: tonoDe(persona.id),
                // Escalonado suave para cuando llegan varios en el mismo sondeo.
                animationDelay: `${Math.min(i, 8) * 40}ms`,
                animationFillMode: 'both',
              }}
            >
              {persona.nombre}
            </li>
          ))}

          {total > llegados.length ? (
            <li className="rounded-full px-4 py-2 text-xl text-muted-foreground tabular-nums">
              +{total - llegados.length} más
            </li>
          ) : null}
        </ul>
      )}
    </div>
  )
}
