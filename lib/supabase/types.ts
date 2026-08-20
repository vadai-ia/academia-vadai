/**
 * Tipos del schema `academia`.
 *
 * PLACEHOLDER. En M1, una vez aplicadas las migraciones, este archivo se
 * regenera con los tipos reales:
 *
 *   pnpm db:types
 *
 * Hasta entonces solo declara la forma mínima que `@supabase/supabase-js`
 * necesita para aceptar `{ db: { schema: 'academia' } }` sin recurrir a `any`.
 */

export type Json = string | number | boolean | null | { [clave: string]: Json | undefined } | Json[]

export type Database = {
  academia: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
