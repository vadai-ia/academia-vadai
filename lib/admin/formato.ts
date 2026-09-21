/**
 * Formatos del admin. Puros: sirven en servidor y en cliente, siempre en hora
 * de la Ciudad de México (CLAUDE.md: la UI no pinta la hora del navegador).
 */

const ZONA = 'America/Mexico_City'

/** "21 sep 2026". Null = "—". */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: ZONA,
  }).format(new Date(iso))
}

/** "21 de septiembre de 2026, 6:00 p.m.". Null = "—". */
export function fechaConHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: ZONA,
  }).format(new Date(iso))
}

/**
 * `amount` ya viene en pesos o dólares, no en centavos: el webhook divide
 * entre 100 al guardar (app/api/stripe/webhook/route.ts) y el seed siembra
 * 14999.00. Dividir otra vez mostraba el pago de $14,999 como $150.
 */
export function dinero(monto: number, moneda: string): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: moneda.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(monto)
}
