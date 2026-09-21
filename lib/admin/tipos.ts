/**
 * Resultado de una server action del admin.
 * Aparte de acciones.ts porque un archivo con 'use server' solo puede exportar
 * funciones.
 */
export type EstadoAccion = {
  error?: string
  aviso?: string
}

export const SIN_ESTADO: EstadoAccion = {}

/** Etiquetas en español para la UI. La base guarda los valores en inglés. */
export const ETIQUETA_ESTADO_CURSO = {
  draft: 'Borrador',
  published: 'Publicado',
  archived: 'Archivado',
} as const

export const ETIQUETA_TIPO_CURSO = {
  cohort: 'Por generación',
  evergreen: 'Siempre abierto',
} as const

export const ETIQUETA_TIPO_LECCION = {
  video: 'Video',
  text: 'Texto',
  quiz: 'Quiz',
  assignment: 'Tarea',
} as const

export const ETIQUETA_ESTADO_LECCION = {
  draft: 'Borrador',
  published: 'Publicada',
} as const
