import 'server-only'

import { crearClienteServidor } from '@/lib/supabase/server'

export type CertificadoDelAlumno = {
  folio: string
  curso: string
  cursoSlug: string | null
  emitidoEn: string
  tienePdf: boolean
}

/**
 * Los certificados del alumno, para el perfil (§3.6: "re-descargable desde el
 * perfil").
 *
 * Va por el cliente del usuario, no por service role: la policy
 * `certificates_select_propio_o_admin` ya limita a las filas propias, y usar la
 * llave del alumno significa que un error de esta consulta no puede filtrar
 * certificados ajenos ni por descuido.
 */
export async function misCertificados(): Promise<CertificadoDelAlumno[]> {
  const supabase = await crearClienteServidor()

  const { data } = await supabase
    .from('certificates')
    .select('folio, issued_at, pdf_path, course_id')
    .order('issued_at', { ascending: false })

  const filas = data ?? []
  if (filas.length === 0) return []

  const { data: cursos } = await supabase
    .from('courses')
    .select('id, title, slug')
    .in('id', filas.map((f) => f.course_id))

  const porCurso = new Map((cursos ?? []).map((c) => [c.id, c]))

  return filas.map((fila) => {
    const curso = porCurso.get(fila.course_id)
    return {
      folio: fila.folio,
      curso: curso?.title ?? 'Curso',
      cursoSlug: curso?.slug ?? null,
      emitidoEn: fila.issued_at,
      tienePdf: Boolean(fila.pdf_path),
    }
  })
}

/** El certificado de un curso concreto, si ya lo tiene. */
export async function certificadoDelCurso(cursoId: string): Promise<string | null> {
  const supabase = await crearClienteServidor()

  const { data } = await supabase
    .from('certificates')
    .select('folio')
    .eq('course_id', cursoId)
    .maybeSingle()

  return data?.folio ?? null
}
