import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { NuevaSesion } from '@/components/admin/nueva-sesion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { eliminarCohorte, eliminarSesion, ligarGrabacion } from '@/lib/admin/acciones-cohortes'
import { leccionesLigables, obtenerCohorte } from '@/lib/admin/cohortes'
import { exigirAdmin } from '@/lib/auth/sesion'

export const dynamic = 'force-dynamic'

const ZONA_CDMX = 'America/Mexico_City'

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
 * El admin ve las horas en CDMX, que es como las capturó y como las piensa el
 * equipo. El alumno las ve en su hora local (§3.10).
 */
function enCdmx(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: ZONA_CDMX,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso))
}

export default async function PaginaCohorte({ params }: { params: Promise<{ id: string }> }) {
  await exigirAdmin()
  const { id } = await params

  const cohorte = await obtenerCohorte(id)
  if (!cohorte) notFound()

  const ligables = await leccionesLigables(cohorte.cursoId)
  const ahora = Date.now()

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
        <h2 className="text-lg font-semibold">Calendario</h2>

        {cohorte.sesiones.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Todavía no hay sesiones agendadas.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {cohorte.sesiones.map((sesion, i) => {
              const pasada = new Date(sesion.scheduled_at).getTime() < ahora

              return (
                <li key={sesion.id} className="flex flex-col gap-3 rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>
                        <span className="font-medium">{sesion.title}</span>
                        {pasada ? <Badge variant="outline">Ya ocurrió</Badge> : null}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {enCdmx(sesion.scheduled_at)} CDMX
                      </span>
                      {sesion.meet_url ? (
                        <a
                          href={sesion.meet_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-xs text-primary underline-offset-4 hover:underline"
                        >
                          {sesion.meet_url}
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin link de Meet</span>
                      )}
                    </div>

                    <form action={eliminarSesion}>
                      <input type="hidden" name="id" value={sesion.id} />
                      <input type="hidden" name="cohort_id" value={cohorte.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                      >
                        Eliminar
                      </Button>
                    </form>
                  </div>

                  {/* Post-sesión: se liga la grabación, que es una lección de
                      tipo video del mismo curso (§3.10). */}
                  <form action={ligarGrabacion} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={sesion.id} />
                    <input type="hidden" name="cohort_id" value={cohorte.id} />

                    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="text-xs text-muted-foreground">Grabación</span>
                      <select
                        name="recording_lesson_id"
                        defaultValue={sesion.recording_lesson_id ?? ''}
                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                      >
                        <option value="">Sin grabación ligada</option>
                        {ligables.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.modulo} · {l.titulo}
                          </option>
                        ))}
                      </select>
                    </label>

                    <Button type="submit" variant="outline" size="sm">
                      Guardar
                    </Button>
                  </form>
                </li>
              )
            })}
          </ul>
        )}

        <NuevaSesion cohorteId={cohorte.id} reinicio={cohorte.sesiones.length} />
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
