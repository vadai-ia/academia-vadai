import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { EnviarCalendario } from '@/components/admin/enviar-calendario'
import { ExpandirTodo } from '@/components/admin/expandir-todo'
import { NuevaSesion } from '@/components/admin/nueva-sesion'
import { SesionesEnSerie } from '@/components/admin/sesiones-en-serie'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  actualizarSesion,
  eliminarCohorte,
  eliminarSesion,
  ligarGrabacion,
} from '@/lib/admin/acciones-cohortes'
import { leccionesLigables, obtenerCohorte } from '@/lib/admin/cohortes'
import { utcACdmx, ZONA_CDMX } from '@/lib/admin/fechas'
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

/**
 * El calendario de una cohorte.
 *
 * Cada sesión es un <details>: cerrada enseña lo que se busca al recorrer la
 * lista —número, tema, fecha y si tiene liga—, y abierta trae su formulario
 * con lo que ya tiene (fecha y hora en CDMX, liga, descripción) para
 * editarlo ahí mismo. Antes no había forma de editar: se borraba y se volvía
 * a crear con el formulario en blanco. Y se pueden agendar las ocho de una
 * vez con "Agendar varias".
 */
export default async function PaginaCohorte({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await exigirAdmin()
  const { id } = await params

  const cohorte = await obtenerCohorte(id)
  if (!cohorte) notFound()

  const ligables = await leccionesLigables(cohorte.cursoId)
  const ahora = Date.now()
  const proxima = cohorte.sesiones.find((s) => new Date(s.scheduled_at).getTime() >= ahora)

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
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Calendario</h2>
          {cohorte.sesiones.length > 1 ? <ExpandirTodo selector="details[data-sesion]" /> : null}
        </div>

        {cohorte.sesiones.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Todavía no hay sesiones agendadas. Agenda las del curso completo abajo, con
            &ldquo;Agendar varias de una vez&rdquo;.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {cohorte.sesiones.map((sesion, i) => {
              const pasada = new Date(sesion.scheduled_at).getTime() < ahora
              const esProxima = proxima?.id === sesion.id
              const { fecha, hora } = utcACdmx(sesion.scheduled_at)

              return (
                <li key={sesion.id}>
                  <details
                    data-sesion
                    open={esProxima}
                    className={
                      'group/sesion rounded-lg border ' +
                      (esProxima ? 'border-primary/50' : 'border-border')
                    }
                  >
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3 select-none [&::-webkit-details-marker]:hidden">
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <span aria-hidden className="text-muted-foreground transition-transform group-open/sesion:rotate-90">
                          ›
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>
                        <span className="font-medium">{sesion.title}</span>
                        {pasada ? <Badge variant="outline">Ya ocurrió</Badge> : null}
                        {esProxima ? <Badge>Próxima</Badge> : null}
                        {!sesion.meet_url && !pasada ? (
                          <Badge variant="outline" className="border-destructive/40 text-destructive">
                            Sin liga
                          </Badge>
                        ) : null}
                        {sesion.grabacionTitulo ? (
                          <Badge variant="secondary">Grabación ligada</Badge>
                        ) : null}
                      </span>
                      <span className="text-sm text-muted-foreground">{enCdmx(sesion.scheduled_at)} CDMX</span>
                    </summary>

                    <div className="flex flex-col gap-5 border-t border-border px-4 py-4">
                      {/* --- Editar ------------------------------------------ */}
                      <form action={actualizarSesion} className="flex flex-col gap-3">
                        <input type="hidden" name="id" value={sesion.id} />
                        <input type="hidden" name="cohort_id" value={cohorte.id} />

                        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`titulo-${sesion.id}`}>Título</Label>
                            <Input id={`titulo-${sesion.id}`} name="title" defaultValue={sesion.title} required minLength={2} />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`fecha-${sesion.id}`}>Fecha</Label>
                            <Input id={`fecha-${sesion.id}`} name="fecha" type="date" defaultValue={fecha} required />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`hora-${sesion.id}`}>Hora (CDMX)</Label>
                            <Input id={`hora-${sesion.id}`} name="hora" type="time" defaultValue={hora} required />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`liga-${sesion.id}`}>Liga de la sesión (Zoom o Meet)</Label>
                          <Input
                            id={`liga-${sesion.id}`}
                            name="meet_url"
                            type="url"
                            defaultValue={sesion.meet_url ?? ''}
                            placeholder="https://us02web.zoom.us/j/…"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`desc-${sesion.id}`}>Descripción</Label>
                          <Textarea
                            id={`desc-${sesion.id}`}
                            name="description"
                            rows={2}
                            defaultValue={sesion.description ?? ''}
                            placeholder="Qué se ve en esta sesión. Opcional."
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button type="submit" size="sm">
                            Guardar cambios
                          </Button>
                          {sesion.meet_url ? (
                            <Button asChild variant="outline" size="sm">
                              <a href={sesion.meet_url} target="_blank" rel="noopener noreferrer">
                                Abrir la liga
                              </a>
                            </Button>
                          ) : null}
                        </div>
                      </form>

                      {/* --- Grabación: post-sesión, una lección de video del
                          mismo curso (§3.10). ------------------------------- */}
                      <form action={ligarGrabacion} className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
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

                      <form action={eliminarSesion} className="flex justify-end">
                        <input type="hidden" name="id" value={sesion.id} />
                        <input type="hidden" name="cohort_id" value={cohorte.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                        >
                          Eliminar esta sesión
                        </Button>
                      </form>
                    </div>
                  </details>
                </li>
              )
            })}
          </ol>
        )}

        <SesionesEnSerie cohorteId={cohorte.id} reinicio={cohorte.sesiones.length} />
        <NuevaSesion cohorteId={cohorte.id} reinicio={cohorte.sesiones.length} />

        <EnviarCalendario
          cohorteId={cohorte.id}
          inscritos={cohorte.inscritos}
          sesionesFuturas={cohorte.sesiones.filter((s) => new Date(s.scheduled_at).getTime() >= ahora - 3 * 60 * 60 * 1000).length}
          correoAdmin={perfil.email}
        />
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
