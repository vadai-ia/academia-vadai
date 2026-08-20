import 'server-only'

import { ESQUEMA, llaveAnonima, urlSupabase } from './env'

export type EstadoConexion = {
  ok: boolean
  titulo: string
  detalle: string
  comoArreglar?: string
}

/**
 * Verifica que Supabase responda y que el schema `academia` esté expuesto en la
 * API. Es el mismo chequeo que hace `scripts/check-m0.mjs`, pero desde la app:
 * sirve como smoke test de que un deploy quedó bien configurado.
 *
 * Consulta una tabla que no existe a propósito. Lo que importa es CÓMO falla:
 *   - PGRST106  → el schema no está en Exposed schemas (falla de configuración)
 *   - 404       → el schema responde y la tabla no existe (correcto)
 */
export async function verificarConexion(): Promise<EstadoConexion> {
  let url: string
  let llave: string

  try {
    url = urlSupabase()
    llave = llaveAnonima()
  } catch (error) {
    return {
      ok: false,
      titulo: 'Falta configuración',
      detalle: error instanceof Error ? error.message : 'Variables de entorno incompletas.',
      comoArreglar: 'Revisa .env.local contra .env.local.example.',
    }
  }

  try {
    const respuesta = await fetch(`${url}/rest/v1/__sonda__?select=*&limit=1`, {
      headers: {
        apikey: llave,
        Authorization: `Bearer ${llave}`,
        'Accept-Profile': ESQUEMA,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })

    const cuerpo: unknown = await respuesta.json().catch(() => null)
    const codigo =
      typeof cuerpo === 'object' && cuerpo !== null && 'code' in cuerpo
        ? String((cuerpo as { code: unknown }).code)
        : undefined

    if (codigo === 'PGRST106') {
      return {
        ok: false,
        titulo: 'Schema no expuesto',
        detalle: `Supabase responde, pero no expone el schema "${ESQUEMA}" en su API.`,
        comoArreglar: 'Settings → API → Exposed schemas: agrega "academia".',
      }
    }

    if (respuesta.status === 404 || codigo === 'PGRST205' || respuesta.ok) {
      return {
        ok: true,
        titulo: 'Conexión correcta',
        detalle: `Supabase responde y el schema "${ESQUEMA}" está expuesto.`,
      }
    }

    return {
      ok: false,
      titulo: 'Respuesta inesperada',
      detalle: `Supabase devolvió ${respuesta.status}${codigo ? ` (${codigo})` : ''}.`,
      comoArreglar: 'Corre `node scripts/check-m0.mjs` para el diagnóstico completo.',
    }
  } catch (error) {
    return {
      ok: false,
      titulo: 'Sin conexión',
      detalle: error instanceof Error ? error.message : 'No se pudo alcanzar Supabase.',
      comoArreglar: 'Verifica NEXT_PUBLIC_SUPABASE_URL y la red.',
    }
  }
}
