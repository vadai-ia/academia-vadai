import { DURACION_MIN } from '@/lib/calendario/enlaces'

/**
 * En qué momento está una sesión en vivo.
 *
 * Vivía dentro del componente que pintaba la lista. Salió aquí (M14 · Fase 2)
 * porque ahora lo necesitan el servidor —para decidir qué sesión va en grande
 * y qué pestaña lleva insignia— y el cliente —para encender el botón de
 * "Unirse" sin recargar—. Que los dos usen la MISMA función es lo que evita
 * que el servidor pinte una cosa y el navegador otra (React 418).
 */

/** El botón de entrar se enciende 15 minutos antes. */
export const MINUTOS_ANTES = 15

/** Una sesión dura 2.5 h; se considera "en curso" hasta 3 h después de empezar. */
export const HORAS_DE_GRACIA = 3

export type EstadoSesion = 'proxima' | 'porEmpezar' | 'enCurso' | 'pasada'

export function estadoDe(iso: string, ahora: number): EstadoSesion {
  const inicio = new Date(iso).getTime()
  const abre = inicio - MINUTOS_ANTES * 60_000
  const cierra = inicio + HORAS_DE_GRACIA * 60 * 60_000
  if (ahora >= cierra) return 'pasada'
  if (ahora >= inicio) return 'enCurso'
  if (ahora >= abre) return 'porEmpezar'
  return 'proxima'
}

/** La que toca: la que está en curso, o la siguiente. Null si ya pasaron todas. */
export function proximaOActual<T extends { programadaEn: string }>(
  sesiones: T[],
  ahora: number
): T | null {
  return sesiones.find((s) => estadoDe(s.programadaEn, ahora) !== 'pasada') ?? null
}

/** Cuándo termina, para pintar el rango. */
export function terminaEn(iso: string): string {
  return new Date(new Date(iso).getTime() + DURACION_MIN * 60_000).toISOString()
}
