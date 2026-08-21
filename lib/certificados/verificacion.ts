import 'server-only'

import { crearClienteServiceRole } from '@/lib/supabase/service-role'

import { normalizarFolio, pareceFolio } from './folio'

/**
 * Verificación pública por folio (§3.6).
 *
 * Esta es la única consulta de toda la app que corre sin sesión, así que
 * conviene ser explícito sobre qué devuelve y qué no.
 *
 * Devuelve nombre, curso y fecha. Eso ES el certificado: quien lo verifica está
 * comprobando precisamente que esa persona terminó ese curso, y ocultarlo haría
 * la página inútil. No devuelve correo, ni `user_id`, ni `course_id`, ni la
 * ruta del PDF — nada que sirva para pivotar hacia otros datos.
 *
 * En particular NO cae al correo cuando falta el nombre, como sí hace el PDF.
 * El PDF lo recibe su dueño; esta página la abre cualquiera que tenga el folio.
 * Por eso la emisión exige nombre: así este caso no se da.
 *
 * La tabla no tiene policy pública (§4): se lee con service role desde el
 * servidor. El folio es la credencial, y por eso `folio.ts` lo hace de azar
 * criptográfico en vez de secuencial.
 */

export type CertificadoPublico = {
  folio: string
  nombre: string
  curso: string
  emitidoEn: string
}

export async function verificarFolio(entrada: string): Promise<CertificadoPublico | null> {
  const folio = normalizarFolio(entrada)

  // Se descarta lo que ni siquiera tiene forma de folio antes de tocar la base:
  // evita convertir esta ruta pública en un oráculo barato de fuerza bruta.
  if (!pareceFolio(folio)) return null

  const servicio = crearClienteServiceRole()

  const { data } = await servicio
    .from('certificates')
    .select('folio, issued_at, user_id, course_id')
    .eq('folio', folio)
    .maybeSingle()

  if (!data) return null

  const [{ data: perfil }, { data: curso }] = await Promise.all([
    servicio.from('profiles').select('full_name').eq('user_id', data.user_id).maybeSingle(),
    servicio.from('courses').select('title').eq('id', data.course_id).maybeSingle(),
  ])

  if (!perfil || !curso) return null

  return {
    folio: data.folio,
    nombre: perfil.full_name.trim() || 'Nombre no registrado',
    curso: curso.title,
    emitidoEn: data.issued_at,
  }
}
