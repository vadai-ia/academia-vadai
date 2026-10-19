import 'server-only'

import { crearClienteServiceRole } from '@/lib/supabase/service-role'

/**
 * SERVICE ROLE del agente (quinta excepción de CLAUDE.md, «agente de la
 * comunidad»). Este archivo es el único de `lib/agente` que crea el cliente.
 *
 * Por qué hace falta: el agente corre en un cron, sin sesión de nadie; lee
 * los muros de todos los cursos, publica a nombre de la cuenta «Equipo VADAI»
 * con `via = 'agente'` (el trigger de 0044/0045 solo deja firmar así al
 * servidor) y lleva la cola y el gasto, que ninguna persona escribe.
 *
 * Quién lo usa: las rutas de cron (con CRON_SECRET) y las acciones del panel
 * DESPUÉS de `exigirEquipo()` o `exigirAdmin()`. Nunca una ruta pública.
 */
export function dbDelAgente() {
  return crearClienteServiceRole()
}

export type ClienteAgente = ReturnType<typeof dbDelAgente>
