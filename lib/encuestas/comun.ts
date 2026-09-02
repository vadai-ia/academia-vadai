/**
 * Piezas de encuestas que necesitan tanto el servidor como el navegador.
 *
 * Vive aparte de `consultas.ts` porque ese módulo lleva `server-only`: los
 * formularios del constructor son client components y necesitan las etiquetas y
 * los ajustes por defecto. Importar un valor desde un módulo server-only rompe
 * el build, y con razón.
 *
 * Mismo criterio que `lib/quiz/comun.ts`, que resolvió esto antes para quizzes.
 */

export const TIPOS_PREGUNTA = ['nube', 'opcion', 'escala', 'muro'] as const
export type TipoPregunta = (typeof TIPOS_PREGUNTA)[number]

export const ESTADOS_ENCUESTA = ['draft', 'live', 'closed'] as const
export type EstadoEncuesta = (typeof ESTADOS_ENCUESTA)[number]

export const ESTADOS_PREGUNTA = ['pending', 'open', 'closed'] as const
export type EstadoPregunta = (typeof ESTADOS_PREGUNTA)[number]

/**
 * Cómo se nombra cada tipo en la interfaz.
 *
 * Se describe POR LO QUE SE VE EN LA PANTALLA, no por el tipo de dato. Quien
 * arma la encuesta está pensando "quiero una nube de palabras", no "quiero un
 * campo de texto corto agregado por frecuencia".
 */
export const ETIQUETA_TIPO_PREGUNTA: Record<TipoPregunta, string> = {
  nube: 'Nube de palabras',
  opcion: 'Opción múltiple',
  escala: 'Escala del 1 al 10',
  muro: 'Muro de respuestas',
}

export const AYUDA_TIPO_PREGUNTA: Record<TipoPregunta, string> = {
  nube: 'Cada quien escribe una palabra. Las que más se repiten se ven más grandes.',
  opcion: 'Eligen una de tus opciones. Se proyecta en barras que crecen en vivo.',
  escala: 'Califican con un número. Se proyecta el promedio y cómo se repartieron.',
  muro: 'Escriben una respuesta larga. Caen como tarjetas en la pantalla.',
}

export const ETIQUETA_ESTADO_ENCUESTA: Record<EstadoEncuesta, string> = {
  draft: 'Borrador',
  live: 'En vivo',
  closed: 'Cerrada',
}

export const ETIQUETA_ESTADO_PREGUNTA: Record<EstadoPregunta, string> = {
  pending: 'Sin abrir',
  open: 'Abierta',
  closed: 'Cerrada',
}

/** Topes. Existen porque el QR es una URL de escritura abierta a internet. */
export const TOPE_PALABRA = 24
export const TOPE_TEXTO_LARGO = 280
export const TOPE_PALABRAS_POR_PERSONA = 3

export type AjustesPregunta = {
  /** nube */
  maxPalabras?: number
  /** nube y muro */
  maxCaracteres?: number
  /** escala */
  min?: number
  max?: number
  etiquetaMin?: string
  etiquetaMax?: string
}

/**
 * Ajustes por defecto de cada tipo.
 *
 * La escala arranca en 1 y no en 0: "del 1 al 10" es como la gente califica en
 * español, y un 0 en una escala de satisfacción se lee como "no contesté".
 */
export function ajustesPorDefecto(tipo: TipoPregunta): AjustesPregunta {
  switch (tipo) {
    case 'nube':
      return { maxPalabras: 1, maxCaracteres: TOPE_PALABRA }
    case 'muro':
      return { maxCaracteres: TOPE_TEXTO_LARGO }
    case 'escala':
      return { min: 1, max: 10, etiquetaMin: '', etiquetaMax: '' }
    case 'opcion':
      return {}
  }
}

/**
 * Lee los ajustes, que en la base son jsonb.
 *
 * Se valida la forma en vez de confiar, igual que `leerOpciones`: un jsonb con
 * `max` en texto rompería la escala en silencio y nadie sabría por qué.
 */
export function leerAjustes(crudo: unknown, tipo: TipoPregunta): AjustesPregunta {
  const base = ajustesPorDefecto(tipo)
  if (typeof crudo !== 'object' || crudo === null || Array.isArray(crudo)) return base

  const entrada = crudo as Record<string, unknown>
  const numero = (llave: string) =>
    typeof entrada[llave] === 'number' && Number.isFinite(entrada[llave])
      ? (entrada[llave] as number)
      : undefined
  const texto = (llave: string) =>
    typeof entrada[llave] === 'string' ? (entrada[llave] as string) : undefined

  return {
    ...base,
    maxPalabras: numero('maxPalabras') ?? base.maxPalabras,
    maxCaracteres: numero('maxCaracteres') ?? base.maxCaracteres,
    min: numero('min') ?? base.min,
    max: numero('max') ?? base.max,
    etiquetaMin: texto('etiquetaMin') ?? base.etiquetaMin,
    etiquetaMax: texto('etiquetaMax') ?? base.etiquetaMax,
  }
}

/** La URL que se codifica en el QR y que la sala teclea si no puede escanear. */
export function urlDeEncuesta(base: string, joinCode: string): string {
  return `${base.replace(/\/+$/, '')}/e/${joinCode}`
}
