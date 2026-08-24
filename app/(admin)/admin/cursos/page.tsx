import type { Metadata } from 'next'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { exigirAdmin } from '@/lib/auth/sesion'
import { listarCursos } from '@/lib/admin/consultas'
import { ETIQUETA_ESTADO_CURSO, ETIQUETA_TIPO_CURSO } from '@/lib/admin/tipos'

export const metadata: Metadata = { title: 'Cursos' }
export const dynamic = 'force-dynamic'

const VARIANTE = {
  published: 'default',
  draft: 'secondary',
  archived: 'outline',
} as const

export default async function PaginaCursos() {
  await exigirAdmin()
  const cursos = await listarCursos()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Cursos</h1>
          <p className="text-sm text-muted-foreground">
            {cursos.length === 0
              ? 'Todavía no hay cursos.'
              : `${cursos.length} curso(s) en la academia.`}
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/cursos/nuevo">Nuevo curso</Link>
        </Button>
      </header>

      {cursos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-5 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Crea el primero y empieza a cargar sus módulos y lecciones.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {cursos.map((curso) => (
            <li key={curso.id}>
              <Link
                href={`/admin/cursos/${curso.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 transition-colors hover:border-primary/60"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium">{curso.title}</span>
                    <Badge variant={VARIANTE[curso.status]} className="shrink-0">
                      {ETIQUETA_ESTADO_CURSO[curso.status]}
                    </Badge>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    /{curso.slug} · {ETIQUETA_TIPO_CURSO[curso.course_type]} ·{' '}
                    {curso.access_days ? `${curso.access_days} días` : 'acceso de por vida'}
                  </span>
                </div>

                <div className="flex shrink-0 gap-4 text-xs text-muted-foreground">
                  <span>{curso.totalModulos} módulos</span>
                  <span>{curso.totalLecciones} lecciones</span>
                  <span>{curso.totalInscritos} inscritos</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
