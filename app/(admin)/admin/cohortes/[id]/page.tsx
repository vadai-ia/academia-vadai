import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CalendarioDeCohorte } from '@/components/admin/calendario-de-cohorte'
import { Button } from '@/components/ui/button'
import { eliminarCohorte } from '@/lib/admin/acciones-cohortes'
import { leccionesLigables, obtenerCohorte } from '@/lib/admin/cohortes'
import { exigirAdmin } from '@/lib/auth/sesion'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const cohorte = await obtenerCohorte(id)
  return { title: cohorte?.name ?? 'Cohorte' }
}

/**
 * La página de una cohorte: su calendario (components/admin/calendario-de-
 * cohorte.tsx, que también se ve dentro del curso) y borrar la cohorte.
 */
export default async function PaginaCohorte({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await exigirAdmin()
  const { id } = await params

  const cohorte = await obtenerCohorte(id)
  if (!cohorte) notFound()

  const ligables = await leccionesLigables(cohorte.cursoId)

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-1">
        <Link
          href={`/admin/cursos/${cohorte.cursoId}`}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          ← {cohorte.cursoTitulo}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{cohorte.name}</h1>
        <p className="text-sm text-muted-foreground">
          {cohorte.sesiones.length} sesión(es) · {cohorte.inscritos} inscrito(s)
          {cohorte.starts_on ? ` · inicia ${cohorte.starts_on}` : ''}
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <CalendarioDeCohorte cohorte={cohorte} ligables={ligables} correoAdmin={perfil.email} />
      </section>

      <section className="border-t border-border pt-6">
        <form action={eliminarCohorte}>
          <input type="hidden" name="id" value={cohorte.id} />
          <input type="hidden" name="course_id" value={cohorte.cursoId} />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            title="Las inscripciones no se borran: los alumnos conservan su acceso"
          >
            Eliminar cohorte
          </Button>
        </form>
      </section>
    </div>
  )
}
