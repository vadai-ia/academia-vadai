/**
 * Lo que cuesta cada llamada del agente (M21), en US$.
 *
 * Precios de la skill `claude-api` (6-oct-2026), por millón de tokens:
 *   - Haiku 5.5: $0.10 de entrada y $0.50 de salida mientras la petición pese
 *     100 mil tokens o menos; arriba, $0.50 y $2.50. Por eso cada petición del
 *     agente se corta bajo LIMITE_DE_ENTRADA.
 *   - Sonnet 5.5: $2 y $10.
 *   - Caché: escribir cuesta 1.25× la entrada (TTL de 1 hora: 2×); leer, 0.1×.
 *   - Búsqueda web: $10 por mil búsquedas.
 *
 * Un modelo que no está en la tabla se cobra como Sonnet: si alguien pone uno
 * caro en Ajustes, el tope lo frena antes, no después.
 */

type Tarifa = { entrada: number; salida: number }

const TARIFAS: Record<string, Tarifa> = {
  'claude-haiku-5-5': { entrada: 0.1, salida: 0.5 },
  'claude-sonnet-5-5': { entrada: 2, salida: 10 },
}
const TARIFA_HAIKU_LARGA: Tarifa = { entrada: 0.5, salida: 2.5 }
const POR_DEFECTO: Tarifa = TARIFAS['claude-sonnet-5-5'] as Tarifa
const POR_BUSQUEDA = 0.01
// La caché del agente es de 1 hora: escribirla cuesta el doble de la entrada.
const ESCRITURA_DE_CACHE = 2
const LECTURA_DE_CACHE = 0.1

/** Tokens de entrada que una petición nunca pasa (Haiku cobra el doble arriba de 100 mil). */
export const LIMITE_DE_ENTRADA = 90_000

export type Uso = {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number | null
  cache_read_input_tokens?: number | null
  server_tool_use?: { web_search_requests?: number | null } | null
}

function tarifa(modelo: string, entradaTotal: number): Tarifa {
  if (modelo === 'claude-haiku-5-5' && entradaTotal > 100_000) return TARIFA_HAIKU_LARGA
  return TARIFAS[modelo] ?? POR_DEFECTO
}

/**
 * Tokens de un texto, por lo alto. El tokenizador de Haiku 5.5 cuenta ~30 %
 * más que los anteriores y el español rinde menos que el inglés: 2.5 letras
 * por token sobreestima, que es lo que se quiere para reservar.
 */
export function tokensEstimados(texto: string): number {
  return Math.ceil(texto.length / 2.5)
}

/**
 * El peor caso de una llamada: toda la entrada como escritura de caché (lo más
 * caro que puede costar), toda la salida al máximo y todas las búsquedas.
 * Esto es lo que se reserva contra el tope ANTES de llamar.
 */
export function peorCaso(modelo: string, tokensDeEntrada: number, maxTokens: number, busquedas = 0): number {
  const t = tarifa(modelo, tokensDeEntrada)
  return (tokensDeEntrada * t.entrada * ESCRITURA_DE_CACHE + maxTokens * t.salida) / 1_000_000 + busquedas * POR_BUSQUEDA
}

/** Lo que costó de verdad, con el `usage` que devolvió la API. */
export function costoReal(modelo: string, uso: Uso): number {
  const escritura = uso.cache_creation_input_tokens ?? 0
  const lectura = uso.cache_read_input_tokens ?? 0
  const t = tarifa(modelo, uso.input_tokens + escritura + lectura)
  const tokens =
    uso.input_tokens * t.entrada +
    escritura * t.entrada * ESCRITURA_DE_CACHE +
    lectura * t.entrada * LECTURA_DE_CACHE +
    uso.output_tokens * t.salida
  return tokens / 1_000_000 + (uso.server_tool_use?.web_search_requests ?? 0) * POR_BUSQUEDA
}

export function dolares(n: number): string {
  return `US$${n.toFixed(n < 1 ? 3 : 2)}`
}
