import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { EncabezadoVaip, HerramientasVaip } from '@/components/vaip/espacio'
import { sesionesDelCurso } from '@/lib/alumno/sesiones'
import { proximaOActual } from '@/lib/calendario/estado'
import { contextoVaip, herramientasDeVaip } from '@/lib/membresia/espacio'

export const metadata: Metadata = { title: 'Herramientas · V-AI-P' }
export const dynamic = 'force-dynamic'

/**
 * V-AI-P → Herramientas (M22): los cursos del plan por área y la Biblioteca.
 * Ya no se repiten en Inicio ni en Mis cursos: son de V-AI-P.
 */
export default async function HerramientasDeVaip() {
  const ctx = await contextoVaip()
  if (!ctx) redirect('/vaip')
  const { perfil, plan, casa } = ctx
  const [datos, sesiones] = await Promise.all([
    herramientasDeVaip(plan),
    casa ? sesionesDelCurso(casa.slug) : Promise.resolve([]),
  ])

  return (
    <div className="flex flex-col gap-8">
      <EncabezadoVaip nombre={perfil.full_name || perfil.email} clase={proximaOActual(sesiones, Date.now())} />
      <HerramientasVaip herramientas={datos.herramientas} biblioteca={datos.biblioteca} />
    </div>
  )
}
