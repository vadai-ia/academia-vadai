/**
 * Lo que el agente NO puede decir por su cuenta (M21), y la limpieza de lo
 * que se le manda.
 *
 * El modelo tiene prohibido escribir ligas, correos, teléfonos, precios y
 * fechas (las ligas las arma el código desde el mapa). Si aun así aparecen,
 * la respuesta no se publica: va a borrador con el motivo. Es la red debajo
 * de la regla del prompt, no la regla.
 */

const MESES = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre'

const PROHIBIDO: Array<[RegExp, string]> = [
  [/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|mx|net|org|io|ai|app|co)\b/i, 'trae una liga que no salió del mapa'],
  [/[\w.+-]+@[\w-]+\.[\w.]+/, 'trae un correo'],
  [/(\+?\d[\d\s().-]{8,}\d)/, 'trae un teléfono o un número largo'],
  [/\$\s?\d|\d\s?(mxn|usd|pesos|d[oó]lares)\b|\b(mxn|usd)\s?\d/i, 'trae un precio o un monto'],
  [new RegExp(`\\b\\d{1,2}\\s+de\\s+(${MESES})\\b`, 'i'), 'trae una fecha'],
  [/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/, 'trae una fecha'],
  [/\b\d{1,2}:\d{2}\b/, 'trae una hora'],
]

/**
 * Nombres de producto que son dominio y que el curso enseña a abrir: decir
 * «entra a claude.ai» no es inventar una liga.
 */
const PRODUCTOS = /\b(claude\.ai|chatgpt\.com|gemini\.google\.com|notebooklm\.google\.com)\b/gi

/** Frases que parecen fecha u hora y no lo son: «24/7», «16:9». */
const NO_SON_FECHAS = /\b(24\/7|16:9|9:16|4:3|1:1)\b/g

/** Por qué no se puede publicar esta respuesta tal cual; vacío si se puede. */
export function problemasDeLaRespuesta(texto: string): string[] {
  const limpio = texto.replace(PRODUCTOS, 'producto').replace(NO_SON_FECHAS, 'frase')
  const problemas = new Set<string>()
  for (const [patron, motivo] of PROHIBIDO) if (patron.test(limpio)) problemas.add(motivo)
  return [...problemas]
}

/**
 * Lo que sale hacia el modelo: sin correos ni teléfonos. Los nombres ya no
 * van (cada mensaje dice «Alumno» o «Equipo VADAI»), pero alguien puede
 * escribir su correo o su WhatsApp en el texto.
 */
export function anonimizar(texto: string): string {
  return texto
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[correo]')
    .replace(/(\+?\d[\d\s().-]{8,}\d)/g, '[teléfono]')
}

/** Texto plano: el modelo a veces se escapa con negritas o viñetas de markdown. */
export function textoPlanoDeModelo(texto: string): string {
  return texto
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/^\s*[-*•]\s+/gm, '- ')
    .replace(/^#+\s*/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
