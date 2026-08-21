/**
 * Lo que comparten el servidor y el cliente sobre elegibilidad.
 *
 * Vive aparte de `elegibilidad.ts` porque ese módulo es `server-only` —lee con
 * service role— y un client component que importe un VALOR de ahí revienta el
 * build. Los tipos se borran al compilar y podrían quedarse allá; `explicar` no.
 */

export type MotivoFaltante = 'sin-completar' | 'quiz-no-aprobado' | 'tarea-no-aprobada'

export type Faltante = {
  leccionId: string
  titulo: string
  tipo: string
  motivo: MotivoFaltante
}

const MOTIVOS: Record<MotivoFaltante, string> = {
  'sin-completar': 'Falta completarla',
  'quiz-no-aprobado': 'Falta aprobar el quiz',
  'tarea-no-aprobada': 'La tarea todavía no está aprobada',
}

export function explicar(motivo: MotivoFaltante): string {
  return MOTIVOS[motivo]
}
