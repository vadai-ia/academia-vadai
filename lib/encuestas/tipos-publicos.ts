/**
 * Resultado de las acciones públicas de una encuesta.
 *
 * Vive aparte de `acciones-publicas.ts` por la misma razón que `lib/admin/tipos.ts`
 * vive aparte de las acciones del admin: **un archivo con `'use server'` solo
 * puede exportar funciones asíncronas**. Exportar de ahí una constante compila
 * sin quejarse y revienta en tiempo de ejecución con
 *
 *   A "use server" file can only export async functions, found object.
 *
 * y el síntoma aparece lejos de la causa: el formulario contesta 500 y parece un
 * problema de la base o de la validación.
 */
export type EstadoPublico = {
  error?: string
  aviso?: string
}

export const SIN_ESTADO_PUBLICO: EstadoPublico = {}
