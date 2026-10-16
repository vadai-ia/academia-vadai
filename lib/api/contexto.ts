import 'server-only'

import { after, NextResponse, type NextRequest } from 'next/server'
import type { ZodType } from 'zod'

import type { LlamadaRpc } from '@/lib/alumno/catalogo'
import { apiConfigurada, hashDeSecreto, huellaDeIp, leerLlave, mismoHash } from '@/lib/api/llaves'
import type { Permiso } from '@/lib/api/permisos'
import { crearClienteServiceRole } from '@/lib/supabase/service-role'

/**
 * La puerta de la API (M20). Cada endpoint de /api/v1 pasa por `conApi`:
 *
 *   1. la llave (`Authorization: Bearer vadai_…`): bien formada, existente,
 *      sin revocar, sin vencer, con el hash correcto. Una llave mala responde
 *      401 SIN escribir nada;
 *   2. el permiso del endpoint (403 si no lo tiene);
 *   3. la cuota por hora (429), contada con un upsert atómico;
 *   4. el plan (`?plan=<slug>`, V-AI-P si no se dice);
 *   5. la bitácora —método, ruta, status, duración, huella de IP; sin cuerpos—
 *      después de responder.
 *
 * SERVICE ROLE (cuarta excepción de CLAUDE.md, «API pública con llave»): este
 * archivo es el único de la API que crea el cliente; los recursos lo reciben
 * en `ctx.db` ya con la llave verificada y el permiso comprobado. /api/v1 no
 * lee cookies ni manda CORS: es para servidores, no para navegadores.
 */

export const LIMITE_POR_HORA = 600

export type ClienteApi = ReturnType<typeof crearClienteServiceRole>

export type PlanApi = { id: string; slug: string; nombre: string; casaId: string | null; casaSlug: string | null; esQa: boolean }

export type ContextoApi = {
  llave: { id: string; nombre: string; permisos: Permiso[] }
  db: ClienteApi
  plan: PlanApi
  tiene: (permiso: Permiso) => boolean
  /** La URL pública de la academia, sin diagonal al final. */
  base: string
  rpc: LlamadaRpc
}

/** Un error con su status, para que los recursos digan qué pasó. */
export class ErrorApi extends Error {
  constructor(
    public status: number,
    mensaje: string
  ) {
    super(mensaje)
  }
}

const CABECERAS = { 'Cache-Control': 'no-store' }

export function json(datos: unknown, status = 200): Response {
  return NextResponse.json(datos, { status, headers: CABECERAS })
}

function error(status: number, mensaje: string): Response {
  return json({ error: mensaje }, status)
}

/** El cuerpo JSON validado; 400 con el primer problema si no cumple. */
export async function leerCuerpo<T>(req: NextRequest, esquema: ZodType<T>): Promise<T> {
  let crudo: unknown
  try {
    crudo = await req.json()
  } catch {
    throw new ErrorApi(400, 'El cuerpo tiene que ser JSON.')
  }
  const r = esquema.safeParse(crudo)
  if (!r.success) {
    const problema = r.error.issues[0]
    throw new ErrorApi(400, problema ? `${problema.path.join('.') || 'cuerpo'}: ${problema.message}` : 'Cuerpo inválido.')
  }
  return r.data
}

export async function conApi(
  req: NextRequest,
  permiso: Permiso,
  manejador: (ctx: ContextoApi) => Promise<Response>
): Promise<Response> {
  const inicio = Date.now()
  if (!apiConfigurada()) return error(503, 'La API no está configurada en este servidor.')

  const crudo = leerLlave(req.headers.get('authorization'))
  if (!crudo) return error(401, 'Falta la llave: Authorization: Bearer vadai_…')

  const db = crearClienteServiceRole()
  const { data: llave } = await db
    .from('api_keys')
    .select('id, nombre, hash, permisos, expires_at, revoked_at, last_used_at')
    .eq('key_id', crudo.keyId)
    .maybeSingle()
  const valida =
    llave !== null &&
    mismoHash(llave.hash, hashDeSecreto(crudo.secreto)) &&
    llave.revoked_at === null &&
    (llave.expires_at === null || Date.parse(llave.expires_at) > inicio)
  if (!llave || !valida) return error(401, 'Llave inválida, revocada o vencida.')

  let status = 500
  const registrar = () =>
    after(async () => {
      await db.from('api_bitacora').insert({
        key_id: llave.id,
        metodo: req.method,
        ruta: req.nextUrl.pathname.slice(0, 200),
        status,
        duracion_ms: Date.now() - inicio,
        ip_huella: huellaDeIp(req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null),
      })
      // El último uso, a lo más cada 5 minutos: no una escritura por llamada.
      if (!llave.last_used_at || inicio - Date.parse(llave.last_used_at) > 5 * 60 * 1000) {
        await db.from('api_keys').update({ last_used_at: new Date(inicio).toISOString() }).eq('id', llave.id)
      }
    })

  const permisos = llave.permisos as Permiso[]
  if (!permisos.includes(permiso)) {
    status = 403
    registrar()
    return error(403, `Esta llave no tiene el permiso ${permiso}.`)
  }

  const rpc = (db.rpc as unknown as LlamadaRpc).bind(db)
  const { data: cuenta, error: errorCuota } = await rpc('academia_api_contar', { p_key: llave.id })
  if (errorCuota || typeof cuenta !== 'number') {
    console.error(JSON.stringify({ operacion: 'api:cuota', llave: llave.id, error: errorCuota?.message }))
  } else if (cuenta > LIMITE_POR_HORA) {
    status = 429
    registrar()
    return NextResponse.json(
      { error: `Pasaste el límite de ${LIMITE_POR_HORA} llamadas por hora.` },
      { status: 429, headers: { ...CABECERAS, 'Retry-After': '3600' } }
    )
  }

  const slug = req.nextUrl.searchParams.get('plan') || 'v-ai-p'
  const { data: plan } = await db
    .from('membership_plans')
    .select('id, slug, name, hub_course_id')
    .eq('slug', slug)
    .maybeSingle()
  if (!plan) {
    status = 404
    registrar()
    return error(404, `No existe el plan ${slug}.`)
  }
  const { data: casa } = plan.hub_course_id
    ? await db.from('courses').select('slug').eq('id', plan.hub_course_id).maybeSingle()
    : { data: null }

  try {
    const respuesta = await manejador({
      llave: { id: llave.id, nombre: llave.nombre, permisos },
      db,
      plan: {
        id: plan.id,
        slug: plan.slug,
        nombre: plan.name,
        casaId: plan.hub_course_id,
        casaSlug: casa?.slug ?? null,
        esQa: plan.slug.startsWith('qa-'),
      },
      tiene: (p) => permisos.includes(p),
      base: (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, ''),
      rpc,
    })
    status = respuesta.status
    return respuesta
  } catch (e) {
    if (e instanceof ErrorApi) {
      status = e.status
      return error(e.status, e.message)
    }
    const id = crypto.randomUUID().slice(0, 8)
    console.error(JSON.stringify({ operacion: 'api:error', id, ruta: req.nextUrl.pathname, error: e instanceof Error ? e.message : String(e) }))
    return error(500, `Algo falló de nuestro lado (error ${id}).`)
  } finally {
    registrar()
  }
}
