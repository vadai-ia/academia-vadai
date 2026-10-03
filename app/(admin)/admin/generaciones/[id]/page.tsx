import { notFound, redirect } from 'next/navigation'

import { cursoDeGeneracion } from '@/lib/admin/generaciones'
import { exigirAdmin } from '@/lib/auth/sesion'

export const dynamic = 'force-dynamic'

/**
 * Una generación ya no tiene página propia (M16): vive como pestaña de su
 * curso. Esta ruta solo manda ahí, conservando `?sesion=` para que los
 * enlaces viejos del panel y de los correos sigan abriendo la sesión.
 */
export default async function PaginaGeneracion({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sesion?: string }>
}) {
  await exigirAdmin()
  const { id } = await params
  const { sesion } = await searchParams

  const cursoId = await cursoDeGeneracion(id)
  if (!cursoId) notFound()

  const extra = sesion ? `&sesion=${encodeURIComponent(sesion)}#sesion-${encodeURIComponent(sesion)}` : ''
  redirect(`/admin/cursos/${cursoId}?gen=${id}${extra}`)
}
