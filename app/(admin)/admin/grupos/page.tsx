import type { Metadata } from 'next'

import { Bandeja, type ParametrosDeBandeja } from '@/components/admin/bandeja'
import { Titulo } from '@/components/ui-vadai/superficie'
import { exigirEquipo } from '@/lib/auth/sesion'

export const metadata: Metadata = { title: 'Grupos · Cursos' }
export const dynamic = 'force-dynamic'

/**
 * Grupos (M25, 20-oct-2026): lo que escriben los alumnos en el grupo de su
 * curso —el canal interno de cada generación, con puntos, vivo durante el
 * curso— y sus preguntas en las lecciones. Antes era la «Bandeja» y mezclaba
 * el muro de V-AI-P; ese vive ahora en V-AI-P → Muro.
 */
export default async function PaginaGrupos({ searchParams }: { searchParams: Promise<ParametrosDeBandeja> }) {
  await exigirEquipo()
  const parametros = await searchParams
  return (
    <div className="flex flex-col gap-6">
      <Titulo
        ceja="Cursos"
        apoyo="Lo que escriben los alumnos en el grupo de su curso y en las lecciones, con su curso y su generación. Lo que espera respuesta va primero."
      >
        Grupos
      </Titulo>
      <Bandeja ruta="/admin/grupos" mundo="cursos" parametros={parametros} />
    </div>
  )
}
