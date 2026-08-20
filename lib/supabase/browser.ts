import { createBrowserClient } from '@supabase/ssr'

import { ESQUEMA, llaveAnonima, urlSupabase } from './env'
import type { Database } from './types'

/**
 * Cliente de Supabase para client components.
 *
 * Usa la llave anónima: todo lo que devuelva pasa por RLS. Nunca sirve para
 * provisionar cuentas ni para leer datos de otros usuarios.
 */
export function crearClienteNavegador() {
  return createBrowserClient<Database, typeof ESQUEMA>(urlSupabase(), llaveAnonima(), {
    db: { schema: ESQUEMA },
  })
}
