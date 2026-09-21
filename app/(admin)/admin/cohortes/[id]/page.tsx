import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CalendarioDeCohorte } from '@/components/admin/calendario-de-cohorte'
import { ConfirmarConModal } from '@/components/admin/confirmar-con-modal'
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
 *
 * `?sesion=<id>` abre esa sesión para editarla: es como llega el "Editar" del
 * panel principal.
 */
export default async function PaginaCohorte({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sesion?: string }>
}) {
  const perfil = await exigirAdmin()
  const { id } = await params
  const { sesion } = await searchParams

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
        <h1 className="text-2xl font-medium tracking-tight">{cohorte.name}</h1>
        <p className="text-sm text-muted-foreground">
          {cohorte.sesiones.length} sesión(es) · {cohorte.inscritos} inscrito(s)
          {cohorte.starts_on ? ` · inicia ${cohorte.starts_on}` : ''}
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <CalendarioDeCohorte
          cohorte={cohorte}
          ligables={ligables}
          correoAdmin={perfil.email}
          sesionAbierta={sesion ?? null}
        />
      </section>

      <section className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <ConfirmarConModal
          idModal={`eliminar-cohorte-${cohorte.id}`}
          accion={eliminarCohorte}
          campos={{ id: cohorte.id, course_id: cohorte.cursoId }}
          boton={{ texto: 'Eliminar cohorte', etiquetaAccesible: `Eliminar la cohorte ${cohorte.name}`, tono: 'destructivo' }}
          titulo={`¿Eliminar la cohorte «${cohorte.name}»?`}
          confirmar={{ texto: 'Sí, eliminar', enCurso: 'Eliminando…', tono: 'destructivo' }}
        >
          <p>
            Sus {cohorte.sesiones.length} sesiones se borran del calendario. Las inscripciones no: los
            alumnos conservan su acceso y solo dejan de tener grupo.
          </p>
        </ConfirmarConModal>
        <span className="text-xs text-muted-foreground">Las inscripciones no se borran.</span>
      </section>
    </div>
  )
}
