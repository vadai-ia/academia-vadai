import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { ESQUEMA, llaveAnonima, urlSupabase } from './env'
import type { Database } from './types'

/**
 * Cliente de Supabase para server components, server actions y route handlers.
 *
 * Actúa como el usuario de la sesión: todas sus queries pasan por RLS. Es el
 * cliente por default de la app. Para provisionar cuentas o generar PDFs, ver
 * `service-role.ts`.
 */
export async function crearClienteServidor() {
  const almacen = await cookies()

  return createServerClient<Database, typeof ESQUEMA>(urlSupabase(), llaveAnonima(), {
    db: { schema: ESQUEMA },
    cookies: {
      getAll() {
        return almacen.getAll()
      },
      setAll(cookiesNuevas) {
        try {
          for (const { name, value, options } of cookiesNuevas) {
            almacen.set(name, value, options)
          }
        } catch {
          // Los server components no pueden escribir cookies. No es un error:
          // el middleware es quien refresca la sesión en cada request.
        }
      },
    },
  })
}
