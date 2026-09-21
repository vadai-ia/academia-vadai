'use client'

/**
 * "Expandir todo / Contraer todo" para una lista de <details>.
 *
 * Es solo comodidad con JavaScript: cada <details> se abre y se cierra solo
 * con su <summary>, sin script. Con muchos módulos o sesiones, abrirlos de
 * uno en uno cansa; esto los abre todos de un clic.
 */
export function ExpandirTodo({ selector }: { selector: string }) {
  const fijar = (abierto: boolean) => {
    document.querySelectorAll<HTMLDetailsElement>(selector).forEach((d) => {
      d.open = abierto
    })
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <button type="button" onClick={() => fijar(true)} className="rounded-md px-2 py-1 text-primary hover:bg-primary/10">
        Expandir todo
      </button>
      <span aria-hidden className="text-muted-foreground">
        ·
      </span>
      <button type="button" onClick={() => fijar(false)} className="rounded-md px-2 py-1 text-primary hover:bg-primary/10">
        Contraer todo
      </button>
    </span>
  )
}
