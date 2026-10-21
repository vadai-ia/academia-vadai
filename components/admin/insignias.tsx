import { contadoresDelPanel, type ClaveDeContador } from '@/lib/admin/contadores'

/**
 * El número de una entrada de la barra lateral (M26). Asíncrono y dentro de un
 * `<Suspense>` en el layout, como la campana: contar no frena el panel, y el
 * número llega en cuanto está. En 0 no pinta nada. El lector de pantalla
 * escucha «3 por atender», no un número suelto.
 */
export async function InsigniaDelPanel({ clave }: { clave: ClaveDeContador }) {
  const n = (await contadoresDelPanel())[clave]
  if (!n) return null
  return <Numero n={n} clave={clave} />
}

/** La suma, en el resumen «Menú» del teléfono: dice que hay algo sin abrir el menú. */
export async function TotalDelPanel() {
  const c = await contadoresDelPanel()
  const n = Object.values(c).reduce((a, b) => a + b, 0)
  if (!n) return null
  return <Numero n={n} clave="total" />
}

function Numero({ n, clave }: { n: number; clave: string }) {
  return (
    <span
      data-insignia={clave}
      className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] leading-none font-semibold text-primary-foreground tabular-nums"
    >
      {n > 99 ? '99+' : n}
      <span className="sr-only"> por atender</span>
    </span>
  )
}
