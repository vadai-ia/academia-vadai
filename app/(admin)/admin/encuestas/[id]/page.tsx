import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ConstructorEncuesta } from '@/components/admin/constructor-encuesta'
import { exigirAdmin } from '@/lib/auth/sesion'
import { obtenerEncuesta } from '@/lib/encuestas/consultas'

export const dynamic = 'force-dynamic'

// Sin `loading.tsx`: el notFound() es control de acceso.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const encuesta = await obtenerEncuesta(id)
  return { title: encuesta?.title ?? 'Encuesta' }
}

/** Sección de preguntas. El marco —QR, código y pestañas— lo pone el layout. */
export default async function PaginaPreguntas({ params }: { params: Promise<{ id: string }> }) {
  await exigirAdmin()

  const { id } = await params
  const encuesta = await obtenerEncuesta(id)
  if (!encuesta) notFound()

  return <ConstructorEncuesta encuesta={encuesta} />
}
