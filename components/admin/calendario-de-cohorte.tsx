import { EnviarCalendario } from '@/components/admin/enviar-calendario'
import { ExpandirTodo } from '@/components/admin/expandir-todo'
import { NuevaSesion } from '@/components/admin/nueva-sesion'
import { SesionesEnSerie } from '@/components/admin/sesiones-en-serie'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { actualizarSesion, eliminarSesion, ligarGrabacion } from '@/lib/admin/acciones-cohortes'
import type { CohorteConSesiones } from '@/lib/admin/cohortes'
import { utcACdmx, ZONA_CDMX } from '@/lib/admin/fechas'

/**
 * El calendario de una cohorte: sus sesiones, cada una editable, más agendar
 * (una o la serie) y mandar las fechas por correo.
 *
 * Es UN componente porque se ve en dos lugares (21-sep-2026): en la página de
 * la cohorte, y ahora también dentro del curso, donde Alejandro quiere
 * agregar, cambiar y borrar sesiones sin ir a buscar la cohorte.
 *
 * Cada sesión es un <details>: cerrada enseña número, tema, fecha y si tiene
 * liga; abierta, su formulario con lo que ya tiene (fecha y hora en CDMX). La
 * próxima abre sola. Server component: cada acción es un <form> directo.
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

export function CalendarioDeCohorte({
  cohorte,
  ligables,
  correoAdmin,
  compacto = false,
}: {
  cohorte: CohorteConSesiones
  ligables: Array<{ id: string; titulo: string; modulo: string }>
  correoAdmin: string
  /** Dentro del curso: sin el título "Calendario", que ya lo pone el marco. */
  compacto?: boolean
}) {
  const ahora = Date.now()
  const proxima = cohorte.sesiones.find((s) => new Date(s.scheduled_at).getTime() >= ahora)
  const selector = `details[data-sesion="${cohorte.id}"]`

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        {compacto ? (
          <span className="text-sm text-muted-foreground">
            {cohorte.sesiones.length} sesión(es) · {cohorte.inscritos} inscrito(s)
          </span>
        ) : (
          <h2 className="text-lg font-semibold">Calendario</h2>
        )}
        {cohorte.sesiones.length > 1 ? <ExpandirTodo selector={selector} /> : null}
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
                  data-sesion={cohorte.id}
                  open={esProxima}
                  className={'group/sesion rounded-lg border ' + (esProxima ? 'border-primary/50' : 'border-border')}
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
                      {sesion.grabacionTitulo ? <Badge variant="secondary">Grabación ligada</Badge> : null}
                    </span>
                    <span className="text-sm text-muted-foreground">{enCdmx(sesion.scheduled_at)} CDMX</span>
                  </summary>

                  <div className="flex flex-col gap-5 border-t border-border px-4 py-4">
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
                      <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
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
        correoAdmin={correoAdmin}
      />
    </div>
  )
}
