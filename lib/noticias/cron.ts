import 'server-only'

import { ajustesDelAgente } from '@/lib/agente/ajustes'
import { claudeConfigurado, esModoQa } from '@/lib/agente/claude'
import { dbDelAgente } from '@/lib/agente/servidor'
import type { LlamadaRpc } from '@/lib/alumno/catalogo'
import { cazarNoticias } from '@/lib/noticias/cazar'

/**
 * La cacería de las 7:00 (M24, cron `agente-diario`): la misma que el botón
 * del panel, con el mismo candado y el mismo límite del día (cuenta como una
 * de las 3). Corre si en Ajustes → Agente están encendidas las noticias.
 * Deja propuestas; nada se publica solo.
 */
export async function cazarPorCron(): Promise<{ busqueda: string } | { omitida: string }> {
  if (!claudeConfigurado()) return { omitida: 'sin llave' }
  const a = await ajustesDelAgente()
  if (!a?.noticias) return { omitida: 'noticias apagadas' }
  const db = dbDelAgente()
  const rpc = (db.rpc as unknown as LlamadaRpc).bind(db)
  const { data: id, error } = await rpc('academia_noticias_iniciar', {
    p_tipo: 'caceria',
    p_origen: 'cron',
    p_pedido_por: null,
    p_url: null,
    p_enfoque: null,
    p_limite: 3,
    p_qa: esModoQa(),
  })
  if (error || typeof id !== 'string') return { omitida: error?.message ?? 'sin id' }
  await cazarNoticias(id)
  return { busqueda: id }
}
