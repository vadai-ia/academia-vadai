import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ConstructorDinamica } from '@/components/admin/constructor-dinamica'
import { exigirAdmin } from '@/lib/auth/sesion'
import { obtenerDinamica } from '@/lib/dinamicas/consultas'

export const dynamic = 'force-dynamic'

// Sin `loading.tsx`: el notFound() es control de acceso.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const dinamica = await obtenerDinamica(id)
  return { title: dinamica?.title ?? 'Dinámica' }
}

/** Sección de criterios. El marco —encabezado, cifras y pestañas— lo pone el layout. */
export default async function PaginaCriterios({ params }: { params: Promise<{ id: string }> }) {
  await exigirAdmin()

  const { id } = await params
  const dinamica = await obtenerDinamica(id)
  if (!dinamica) notFound()

  return <ConstructorDinamica dinamica={dinamica} />
}
