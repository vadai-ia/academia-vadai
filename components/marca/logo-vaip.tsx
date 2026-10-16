import { cn } from '@/lib/utils'

/**
 * El micro logo de VADAI V-AI-P (M17).
 *
 * Alejandro (15-oct-2026): «Es como VIP pero es con IA, entonces que se juegue
 * con eso pero de forma visual con un micro logo, no solo escrito». La idea es
 * un PASE: un boleto de acceso con muescas a los lados, con la V y la P en
 * el color del texto y el «AI» en una placa lima, que es lo que vuelve VIP en
 * V-AI-P. El destello de la placa es el mismo gesto de «IA» que usa la marca.
 *
 * Colores por token, nunca a mano: el contorno y las letras van en
 * `currentColor` (sigue al tema), la placa en `accent` (lima) y su texto en
 * `accent-foreground` (navy), que da contraste en los dos temas.
 */

const BOLETO =
  'M11 1H109A10 10 0 0 1 119 11V18A6 6 0 0 0 119 30V37A10 10 0 0 1 109 47H11A10 10 0 0 1 1 37V30A6 6 0 0 0 1 18V11A10 10 0 0 1 11 1Z'

/** Destello de cuatro puntas, centrado en (0, 0). */
const DESTELLO = 'M0 -6C0.6 -2 2 -0.6 6 0C2 0.6 0.6 2 0 6C-0.6 2 -2 0.6 -6 0C-2 -0.6 -0.6 -2 0 -6Z'

export function LogoVaip({ className, titulo = 'VADAI V-AI-P' }: { className?: string; titulo?: string }) {
  return (
    <svg
      viewBox="0 0 120 48"
      role="img"
      aria-label={titulo}
      className={cn('h-8 w-auto shrink-0', className)}
    >
      <title>{titulo}</title>
      <path d={BOLETO} fill="none" stroke="currentColor" strokeWidth="2" />
      <text
        x="23"
        y="32.5"
        textAnchor="middle"
        fill="currentColor"
        fontSize="21"
        fontWeight="800"
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
      >
        V
      </text>
      <rect x="38" y="10" width="44" height="28" rx="8" className="fill-accent" />
      <text
        x="60"
        y="31.2"
        textAnchor="middle"
        className="fill-accent-foreground"
        fontSize="19"
        fontWeight="800"
        letterSpacing="0.5"
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
      >
        AI
      </text>
      <path d={DESTELLO} transform="translate(81 10) scale(0.85)" fill="currentColor" />
      <text
        x="97"
        y="32.5"
        textAnchor="middle"
        fill="currentColor"
        fontSize="21"
        fontWeight="800"
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
      >
        P
      </text>
    </svg>
  )
}

/** El logo con su nombre al lado, para encabezados. */
export function MarcaVaip({ className, compacta = false }: { className?: string; compacta?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoVaip className={compacta ? 'h-6' : 'h-9'} />
      <span className="flex flex-col leading-none">
        <span className="text-[0.65rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          VADAI
        </span>
        <span className={cn('font-semibold tracking-tight', compacta ? 'text-sm' : 'text-lg')}>V-AI-P</span>
      </span>
    </span>
  )
}
