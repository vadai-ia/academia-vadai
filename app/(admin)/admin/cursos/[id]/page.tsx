import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ArbolCurso } from '@/components/admin/arbol-curso'
import { FormularioCurso } from '@/components/admin/formulario-curso'
import { NuevaCohorte } from '@/components/admin/nueva-cohorte'
import { Badge } from '@/components/ui/badge'
import { cohortesDelCurso } from '@/lib/admin/cohortes'
import { obtenerCurso } from '@/lib/admin/consultas'
import { ETIQUETA_ESTADO_CURSO } from '@/lib/admin/tipos'
import { exigirAdmin } from '@/lib/auth/sesion'

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

  const cohortes = await cohortesDelCurso(curso.id)

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

      <section className="flex flex-col gap-4 border-t border-border pt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Cohortes</h2>
          <p className="text-sm text-muted-foreground">
            Grupos con calendario de sesiones en vivo
          </p>
        </div>

        {cohortes.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {cohortes.map((cohorte) => (
              <li key={cohorte.id}>
                <Link
                  href={`/admin/cohortes/${cohorte.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 transition-colors hover:border-vadai-cyan/60"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-medium">{cohorte.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {cohorte.starts_on ? `Inicia ${cohorte.starts_on}` : 'Sin fecha de inicio'}
                    </span>
                  </span>
                  <span className="flex shrink-0 gap-4 text-xs text-muted-foreground">
                    <span>{cohorte.totalSesiones} sesiones</span>
                    <span>{cohorte.inscritos} inscritos</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        <NuevaCohorte cursoId={curso.id} reinicio={cohortes.length} />
      </section>

      <section className="flex max-w-2xl flex-col gap-4 border-t border-border pt-8">
        <h2 className="text-lg font-semibold">Datos del curso</h2>
        <FormularioCurso curso={curso} />
      </section>
    </div>
  )
}
