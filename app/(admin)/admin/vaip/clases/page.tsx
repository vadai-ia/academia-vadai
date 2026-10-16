import type { Metadata } from 'next'

import { CalendarioDeGeneracion } from '@/components/admin/calendario-de-generacion'
import { Seccion } from '@/components/ui-vadai/superficie'
import { generacionesDelCurso, leccionesLigables } from '@/lib/admin/generaciones'
import { exigirEquipo } from '@/lib/auth/sesion'
import { planVaip } from '@/lib/membresia/consultas'
import { generacionPorOmision } from '@/lib/generaciones'

export const metadata: Metadata = { title: 'Clases y eventos de V-AI-P' }
export const dynamic = 'force-dynamic'

/**
 * Clases y eventos de V-AI-P (M19): el mismo calendario de la generación
 * «Miembros» que vive en la página del curso, aquí a la mano del equipo. Las
 * clases nuevas salen con anuncio y correo marcados; un evento lleva su lugar.
 */
export default async function PaginaClases({ searchParams }: { searchParams: Promise<{ sesion?: string }> }) {
  const perfil = await exigirEquipo()
  const { sesion } = await searchParams
  const plan = await planVaip()
  if (!plan?.casa) return <p className="text-sm text-muted-foreground">V-AI-P todavía no tiene curso casa.</p>

  const generaciones = await generacionesDelCurso(plan.casa.id)
  const generacion = generacionPorOmision(generaciones)
  if (!generacion) return <p className="text-sm text-muted-foreground">La casa de V-AI-P no tiene generación.</p>
  const ligables = await leccionesLigables(plan.casa.id, generacion.id)

  return (
    <Seccion
      titulo="Clases y eventos"
      apoyo="Agendar una clase la anuncia en el muro y manda las fechas por correo a los miembros. Las grabaciones se ligan a una lección."
    >
      <CalendarioDeGeneracion
        generacion={generacion}
        ligables={ligables}
        correoAdmin={perfil.email}
        compacto
        sesionAbierta={sesion ?? null}
        prefijo="?"
        deVaip
      />
    </Seccion>
  )
}
