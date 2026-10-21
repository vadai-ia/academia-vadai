import { cn } from '@/lib/utils'
import type { EstadoAccion } from '@/lib/admin/tipos'

/**
 * Resultado de una server action del admin. No renderiza nada si no hay.
 * `lista` (M25) va debajo: las direcciones a las que no salió un correo.
 */
export function AvisoAccion({ estado }: { estado: EstadoAccion }) {
  const texto = estado.error ?? estado.aviso
  if (!texto) return null

  const esError = Boolean(estado.error)
  const lista = estado.lista ?? []

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'rounded-md border px-3 py-2 text-sm',
        esError
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : 'border-exito/40 bg-exito/10 text-exito'
      )}
    >
      {texto}
      {lista.length > 0 ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 [overflow-wrap:anywhere]">
          {lista.map((renglon) => (
            <li key={renglon}>{renglon}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
