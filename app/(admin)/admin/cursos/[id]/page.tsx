import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ArbolCurso } from '@/components/admin/arbol-curso'
import { FormularioCurso } from '@/components/admin/formulario-curso'
import { Badge } from '@/components/ui/badge'
import { exigirAdmin } from '@/lib/auth/sesion'
import { obtenerCurso } from '@/lib/admin/consultas'
import { ETIQUETA_ESTADO_CURSO } from '@/lib/admin/tipos'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const curso = await obtenerCurso(id)
  return { title: curso?.title ?? 'Curso' }
}

export default async function PaginaCurso({ params }: { params: Promise<{ id: string }> }) {
  await exigirAdmin()
  const { id } = await params

  const curso = await obtenerCurso(id)
  if (!curso) notFound()

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-1">
        <Link
          href="/admin/cursos"
          className="text-sm text-vadai-cyan underline-offset-4 hover:underline"
        >
          ← Cursos
        </Link>
        <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
          {curso.title}
          <Badge variant={curso.status === 'published' ? 'default' : 'secondary'}>
            {ETIQUETA_ESTADO_CURSO[curso.status]}
          </Badge>
        </h1>
      </header>

      <ArbolCurso curso={curso} />

      <section className="flex max-w-2xl flex-col gap-4 border-t border-border pt-8">
        <h2 className="text-lg font-semibold">Datos del curso</h2>
        <FormularioCurso curso={curso} />
      </section>
    </div>
  )
}
