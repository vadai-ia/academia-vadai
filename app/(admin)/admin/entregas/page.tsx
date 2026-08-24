import type { Metadata } from 'next'
import Link from 'next/link'

import { RevisionEntrega } from '@/components/admin/revision-entrega'
import { Badge } from '@/components/ui/badge'
import { bandejaDeEntregas } from '@/lib/admin/tareas'
import { exigirAdmin } from '@/lib/auth/sesion'

export const metadata: Metadata = { title: 'Entregas' }
export const dynamic = 'force-dynamic'

/**
 * Bandeja de revisión (§3.5).
 *
 * Por default solo lo pendiente, que es lo que hay que atender. Las revisadas se
 * ven con ?todas=1, para consultar o corregir una calificación.
 */
export default async function PaginaEntregas({
  searchParams,
}: {
  searchParams: Promise<{ todas?: string }>
}) {
  await exigirAdmin()
  const { todas } = await searchParams
  const verTodas = todas === '1'

  const entregas = await bandejaDeEntregas(!verTodas)
  const pendientes = entregas.filter((e) => e.estado === 'submitted')

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Entregas</h1>
          <p className="text-sm text-muted-foreground">
            {verTodas
              ? `${entregas.length} entrega(s) en total`
              : pendientes.length === 0
                ? 'Nada por revisar'
                : `${pendientes.length} por revisar`}
          </p>
        </div>

        <Link
          href={verTodas ? '/admin/entregas' : '/admin/entregas?todas=1'}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          {verTodas ? 'Ver solo pendientes' : 'Ver todas'}
        </Link>
      </header>

      {entregas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
          {verTodas ? 'Todavía no hay entregas.' : 'No hay nada pendiente de revisar.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {entregas.map((entrega) =>
            entrega.estado === 'submitted' ? (
              <RevisionEntrega key={entrega.id} entrega={entrega} />
            ) : (
              <li
                key={entrega.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-3"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm">{entrega.alumnoNombre}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {entrega.cursoTitulo} · {entrega.leccionTitulo}
                  </span>
                </span>
                <Badge
                  className={
                    entrega.estado === 'approved' ? 'bg-vadai-lima text-vadai-navy' : undefined
                  }
                  variant={entrega.estado === 'approved' ? 'default' : 'outline'}
                >
                  {entrega.estado === 'approved' ? 'Aprobada' : 'Con correcciones'}
                </Badge>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  )
}
