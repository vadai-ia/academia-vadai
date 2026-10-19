/**
 * La firma de lo que publica la cuenta «Equipo VADAI» según cómo llegó (M21).
 * Un solo lugar para el texto, que Alejandro aprueba en captura.
 *
 *   - 'agente': lo contestó Claude solo. Dice que es IA, como pide el aviso.
 *   - 'agente_revisado': lo propuso Claude y una persona del equipo lo revisó
 *     antes de publicarlo. Nunca se dice «revisado» de algo que nadie revisó.
 *   - 'api' y 'humano': sin firma extra.
 */

export type Via = 'humano' | 'api' | 'agente' | 'agente_revisado'

export function firmaDeVia(via: string | null | undefined): string | null {
  if (via === 'agente') return 'con Claude, nuestra IA'
  if (via === 'agente_revisado') return 'con Claude · revisado por el equipo'
  return null
}

/**
 * La insignia junto al nombre: la firma del agente si la hay; si no,
 * «Equipo VADAI» para el equipo, salvo cuando el nombre ya lo dice (la cuenta
 * del bot se llama así y saldría repetido).
 */
export function insigniaDeAutor(autor: { nombre: string; esEquipo: boolean }, via: string | null | undefined): string | null {
  const firma = firmaDeVia(via)
  if (firma) return firma
  if (!autor.esEquipo) return null
  return autor.nombre.trim().toLowerCase() === 'equipo vadai' ? null : 'Equipo VADAI'
}
