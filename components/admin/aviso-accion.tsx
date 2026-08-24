import { cn } from '@/lib/utils'
import type { EstadoAccion } from '@/lib/admin/tipos'

/** Resultado de una server action del admin. No renderiza nada si no hay. */
export function AvisoAccion({ estado }: { estado: EstadoAccion }) {
  const texto = estado.error ?? estado.aviso
  if (!texto) return null

  const esError = Boolean(estado.error)

  return (
    <p
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
    </p>
  )
}
