/**
 * Configuración validada de Supabase.
 *
 * Las variables NEXT_PUBLIC_* se leen de forma ESTÁTICA a propósito: Next solo
 * sustituye `process.env.NEXT_PUBLIC_X` por su valor en el bundle del cliente
 * cuando la encuentra escrita literal. Un acceso dinámico (`process.env[nombre]`)
 * quedaría `undefined` en el navegador sin ningún error visible.
 */

/** Único schema que esta app puede tocar. Regla Cero — ver CLAUDE.md. */
export const ESQUEMA = 'academia' as const

function exigir(valor: string | undefined, nombre: string): string {
  if (!valor) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. ` +
        'Revisa .env.local (plantilla en .env.local.example) y docs/M0-SETUP.md.'
    )
  }
  return valor
}

export function urlSupabase(): string {
  return exigir(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL')
}

export function llaveAnonima(): string {
  return exigir(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
}
