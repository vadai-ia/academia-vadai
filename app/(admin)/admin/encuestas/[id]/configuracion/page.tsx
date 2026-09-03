import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AjustesEncuesta } from '@/components/admin/ajustes-encuesta'
import { Seccion } from '@/components/ui-vadai/superficie'
import { opcionesDeAlta } from '@/lib/admin/alumnos'
import { exigirAdmin } from '@/lib/auth/sesion'
import { obtenerEncuesta } from '@/lib/encuestas/consultas'

export const dynamic = 'force-dynamic'

// Sin `loading.tsx`: el notFound() es control de acceso.

export const metadata: Metadata = { title: 'Configuración de la encuesta' }

export default async function PaginaConfiguracion({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await exigirAdmin()

  const { id } = await params
  const [encuesta, cursos] = await Promise.all([obtenerEncuesta(id), opcionesDeAlta()])
  if (!encuesta) notFound()

  return (
    <Seccion titulo="Ajustes" apoyo="Dónde vive la encuesta y cómo se comporta en vivo.">
      <AjustesEncuesta encuesta={encuesta} cursos={cursos} />
    </Seccion>
  )
}
