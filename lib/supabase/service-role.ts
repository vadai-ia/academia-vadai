import 'server-only'

import { createClient } from '@supabase/supabase-js'

import { ESQUEMA, urlSupabase } from './env'
import type { Database } from './types'

/**
 * Cliente con service role: IGNORA RLS por completo.
 *
 * Uso permitido, y nada más (CLAUDE.md):
 *   - provisioning de cuentas (alta manual e invitaciones)
 *   - webhook de Stripe
 *   - generación de certificados PDF
 *   - verificación pública de certificado por folio
 *
 * El `import 'server-only'` de arriba hace que el build falle si alguien lo
 * importa desde un client component. Es a propósito: esta llave jamás debe
 * llegar al navegador.
 */
export function crearClienteServiceRole() {
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!llave) {
    throw new Error(
      'Falta SUPABASE_SERVICE_ROLE_KEY. Revisa .env.local y docs/M0-SETUP.md.'
    )
  }

  return createClient<Database, typeof ESQUEMA>(urlSupabase(), llave, {
    db: { schema: ESQUEMA },
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
