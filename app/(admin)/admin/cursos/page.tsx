import type { Metadata } from 'next'
import Link from 'next/link'

import { ConfirmarConModal } from '@/components/admin/confirmar-con-modal'
import { Pestanas } from '@/components/ui-vadai/pestanas'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { archivarCurso, restaurarCurso } from '@/lib/admin/acciones'
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

export default async function PaginaCursos({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>
}) {
  await exigirAdmin()
  const { ver } = await searchParams

  // El filtro vive en la URL, igual que el buscador de alumnos: funciona sin
  // JavaScript, se puede compartir y el botón atrás hace lo que uno espera.
  const verArchivados = ver === 'archivados'

  const cursos = await listarCursos()
  const activos = cursos.filter((c) => c.status !== 'archived')
  const archivados = cursos.filter((c) => c.status === 'archived')
  const visibles = verArchivados ? archivados : activos

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Cursos</h1>
          <p className="text-sm text-muted-foreground">
            {cursos.length === 0
              ? 'Todavía no hay cursos.'
              : `${activos.length} activo(s) · ${archivados.length} archivado(s)`}
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/cursos/nuevo">Nuevo curso</Link>
        </Button>
      </header>

      <Pestanas
        etiqueta="Filtro de cursos"
        pestanas={[
          {
            href: '/admin/cursos',
            etiqueta: 'Activos',
            activa: !verArchivados,
            insignia: activos.length,
          },
          {
            href: '/admin/cursos?ver=archivados',
            etiqueta: 'Archivados',
            activa: verArchivados,
            insignia: archivados.length,
          },
        ]}
      />

      {visibles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-5 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {verArchivados
              ? 'No hay cursos archivados. Archivar uno lo saca de la lista de activos sin borrar nada.'
              : cursos.length === 0
                ? 'Crea el primero y empieza a cargar sus módulos y lecciones.'
                : 'Todos los cursos están archivados.'}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {visibles.map((curso) => (
            // El borde va en el <li> y no en el enlace: el botón de la derecha es
            // su hermano, porque un <button> dentro de un <a> es HTML inválido.
            <li
              key={curso.id}
              className="flex items-center rounded-lg border border-border transition-colors has-[a:hover]:border-primary/60"
            >
              <Link
                href={`/admin/cursos/${curso.id}`}
                className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3"
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

              <div className="shrink-0 pr-2">
                {curso.status === 'archived' ? (
                  // Restaurar no pide confirmación: no le quita nada a nadie y
                  // el curso vuelve como borrador, invisible para los alumnos.
                  <form action={restaurarCurso}>
                    <input type="hidden" name="id" value={curso.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      aria-label={`Restaurar el curso ${curso.title} como borrador`}
                      title="Vuelve a Activos como borrador"
                    >
                      Restaurar
                    </Button>
                  </form>
                ) : (
                  <ConfirmarConModal
                    idModal={`archivar-curso-${curso.id}`}
                    accion={archivarCurso}
                    campos={{ id: curso.id }}
                    boton={{
                      texto: 'Archivar',
                      etiquetaAccesible: `Archivar el curso ${curso.title}`,
                    }}
                    titulo={`¿Archivar «${curso.title}»?`}
                    confirmar={{ texto: 'Sí, archivar', enCurso: 'Archivando…' }}
                  >
                    <p>
                      Sale de esta lista y deja de ofrecerse al dar de alta a alguien.{' '}
                      <span className="font-medium text-foreground">No se borra nada</span>: lo
                      encuentras en Archivados y lo puedes restaurar cuando quieras.
                    </p>
                    {curso.totalInscritos > 0 ? (
                      <p>
                        Sus {curso.totalInscritos} inscrito(s) lo siguen viendo, con su progreso
                        intacto. Para quitárselos, revoca el acceso desde Alumnos.
                      </p>
                    ) : null}
                    {curso.stripe_payment_link_mxn || curso.stripe_payment_link_usd ? (
                      <p>
                        Tiene un Payment Link de Stripe. Archivar aquí no lo apaga: si no quieres
                        que se siga vendiendo, desactívalo también en Stripe.
                      </p>
                    ) : null}
                  </ConfirmarConModal>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
