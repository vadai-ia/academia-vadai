/**
 * Tipos compartidos entre las server actions de auth y sus formularios.
 * Viven aparte porque un archivo con 'use server' solo puede exportar funciones.
 */

export type EstadoFormulario = {
  error?: string
  aviso?: string
}

export const ESTADO_INICIAL: EstadoFormulario = {}
