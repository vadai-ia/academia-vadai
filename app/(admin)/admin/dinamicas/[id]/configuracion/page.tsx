import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AjustesDinamica } from '@/components/admin/ajustes-dinamica'
import { opcionesDeAlta } from '@/lib/admin/alumnos'
import { exigirAdmin } from '@/lib/auth/sesion'
import { obtenerDinamica } from '@/lib/dinamicas/consultas'

export const dynamic = 'force-dynamic'

// Sin `loading.tsx`: el notFound() es control de acceso.

export const metadata: Metadata = { title: 'Configuración de la dinámica' }

export default async function PaginaConfiguracion({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await exigirAdmin()

  const { id } = await params
  const [dinamica, cursos] = await Promise.all([obtenerDinamica(id), opcionesDeAlta()])
  if (!dinamica) notFound()

  // Las cuatro secciones las pinta el componente; `ahora` viaja desde aquí
  // para que "la fecha ya pasó" se decida con el reloj del servidor.
  return <AjustesDinamica dinamica={dinamica} cursos={cursos} ahora={Date.now()} />
}
