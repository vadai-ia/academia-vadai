import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { EncabezadoVaip, RankingVaip } from '@/components/vaip/espacio'
import { sesionesDelCurso } from '@/lib/alumno/sesiones'
import { proximaOActual } from '@/lib/calendario/estado'
import { contextoVaip, rankingYLogrosDeVaip } from '@/lib/membresia/espacio'

export const metadata: Metadata = { title: 'Ranking · V-AI-P' }
export const dynamic = 'force-dynamic'

/**
 * V-AI-P → Ranking (M22): el único ranking vivo de la academia (Alejandro,
 * 20-oct-2026: el de cada generación ya se premió). Todos los miembros, tu
 * lugar y tus logros.
 */
export default async function RankingDeVaip() {
  const ctx = await contextoVaip()
  if (!ctx) redirect('/vaip')
  const { perfil, plan, casa } = ctx
  const [{ ranking, logros }, sesiones] = await Promise.all([
    rankingYLogrosDeVaip(perfil, plan),
    casa ? sesionesDelCurso(casa.slug) : Promise.resolve([]),
  ])

  return (
    <div className="flex flex-col gap-8">
      <EncabezadoVaip nombre={perfil.full_name || perfil.email} clase={proximaOActual(sesiones, Date.now())} />
      <RankingVaip ranking={ranking} logros={logros} userId={perfil.user_id} />
    </div>
  )
}
