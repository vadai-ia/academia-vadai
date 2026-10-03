import 'server-only'

import { obtenerSesion } from '@/lib/auth/sesion'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * El catálogo de cursos (M15, 3-oct-2026): los cursos que el equipo marcó con
 * «Mostrar en el catálogo», con lo justo para su tarjeta —nunca lecciones ni
 * videos— y si quien mira ya está inscrito.
 *
 * Sale de `academia_catalogo()` (academia_0033) porque la RLS de `courses` no
 * deja leer un curso ajeno; la función devuelve solo columnas de vitrina.
 */
export type CursoDelCatalogo = {
  id: string
  slug: string
  titulo: string
  descripcion: string | null
  portada: string | null
  precioMxn: number | null
  precioUsd: number | null
  linkMxn: string | null
  linkUsd: string | null
  diasDeAcceso: number | null
  tipo: 'cohort' | 'evergreen'
  gratis: boolean
  lecciones: number
  modulos: number
  inscrito: boolean
}

export type Catalogo = {
  /** `false` mientras la base no tenga academia_0033: la sección no se pinta. */
  disponible: boolean
  cursos: CursoDelCatalogo[]
}

type Fila = {
  id: string
  slug: string
  title: string
  description: string | null
  cover_url: string | null
  price_mxn: number | string | null
  price_usd: number | string | null
  stripe_payment_link_mxn: string | null
  stripe_payment_link_usd: string | null
  access_days: number | null
  course_type: 'cohort' | 'evergreen'
  is_free: boolean
  lecciones: number
  modulos: number
  inscrito: boolean
}

/**
 * Las funciones de la base no están en `types.ts`: el generador solo
 * introspecciona tablas y vistas. Una sola conversión, aquí, con la forma que
 * devuelve PostgREST.
 */
export type LlamadaRpc = (
  funcion: string,
  argumentos?: Record<string, unknown>
) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>

/** La función todavía no existe en la base (migración sin aplicar). */
export function faltaFuncion(error: { message: string; code?: string } | null): boolean {
  if (!error) return false
  return error.code === 'PGRST202' || error.code === '42883' || /Could not find the function/i.test(error.message)
}

const numero = (v: number | string | null) => (v === null ? null : Number(v))

export async function catalogo(): Promise<Catalogo> {
  const sesion = await obtenerSesion()
  if (sesion.tipo !== 'activo') return { disponible: true, cursos: [] }

  const supabase = await crearClienteServidor()
  const rpc = (supabase.rpc as unknown as LlamadaRpc).bind(supabase)
  const { data, error } = await rpc('academia_catalogo')

  if (error) {
    if (faltaFuncion(error)) return { disponible: false, cursos: [] }
    console.error(JSON.stringify({ operacion: 'catalogo', error: error.message }))
    return { disponible: true, cursos: [] }
  }

  return {
    disponible: true,
    cursos: ((data ?? []) as Fila[]).map((f) => ({
      id: f.id,
      slug: f.slug,
      titulo: f.title,
      descripcion: f.description,
      portada: f.cover_url,
      precioMxn: numero(f.price_mxn),
      precioUsd: numero(f.price_usd),
      linkMxn: f.stripe_payment_link_mxn,
      linkUsd: f.stripe_payment_link_usd,
      diasDeAcceso: f.access_days,
      tipo: f.course_type,
      gratis: f.is_free,
      lecciones: f.lecciones,
      modulos: f.modulos,
      inscrito: f.inscrito,
    })),
  }
}

/**
 * El enlace de pago con el correo de la cuenta ya puesto: así la compra cae en
 * la misma cuenta y el webhook no crea otra (`prefilled_email` de Stripe).
 */
export function enlaceDeCompra(link: string, correo: string | null): string {
  if (!correo) return link
  try {
    const url = new URL(link)
    url.searchParams.set('prefilled_email', correo)
    return url.toString()
  } catch {
    return link
  }
}
