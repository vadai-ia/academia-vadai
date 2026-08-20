import { cn } from '@/lib/utils'

/**
 * Wordmark VADAI en texto.
 *
 * §9 del master document contempla un logo como asset en /public, que Alejandro
 * todavía no entrega. Mientras tanto esto respeta la paleta y se ve intencional;
 * cuando llegue el SVG solo se cambia aquí.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-baseline gap-2 select-none', className)}>
      <span className="text-xl font-bold tracking-[0.18em] text-vadai-texto">VADAI</span>
      <span className="text-xl font-light tracking-[0.18em] text-vadai-cyan">ACADEMIA</span>
    </span>
  )
}
