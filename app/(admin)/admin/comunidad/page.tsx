import { redirect } from 'next/navigation'

import { exigirEquipo } from '@/lib/auth/sesion'
import { mundoVaip } from '@/lib/membresia/mundo'

/**
 * La vieja «Bandeja» (3-oct-2026). Desde M25 se partió en dos: los grupos de
 * los cursos (/admin/grupos) y el muro de V-AI-P (/admin/vaip/muro). Las ligas
 * viejas —correos del agente, favoritos— llegan a su lugar con sus filtros.
 */
export default async function PaginaComunidadVieja({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await exigirEquipo()
  const parametros = await searchParams
  const consulta = new URLSearchParams()
  for (const [k, v] of Object.entries(parametros)) {
    if (typeof v === 'string') consulta.set(k, v)
  }
  const curso = typeof parametros.curso === 'string' ? parametros.curso : ''
  const mundo = await mundoVaip()
  if (curso && mundo.ids.has(curso)) {
    consulta.delete('curso')
    consulta.delete('gen')
    const cadena = consulta.toString()
    redirect(`/admin/vaip/muro${cadena ? `?${cadena}` : ''}`)
  }
  const cadena = consulta.toString()
  redirect(`/admin/grupos${cadena ? `?${cadena}` : ''}`)
}
