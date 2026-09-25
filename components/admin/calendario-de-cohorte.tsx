import Link from 'next/link'
import { ConfirmarConModal } from '@/components/admin/confirmar-con-modal'
import { EnviarCalendario } from '@/components/admin/enviar-calendario'
import { claseSelect } from '@/components/admin/estilos'
import { NuevaSesion } from '@/components/admin/nueva-sesion'
import { SesionesEnSerie } from '@/components/admin/sesiones-en-serie'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { actualizarSesion, eliminarSesion, ligarGrabacion } from '@/lib/admin/acciones-cohortes'
import type { CohorteConSesiones } from '@/lib/admin/cohortes'
import { utcACdmx, ZONA_CDMX } from '@/lib/admin/fechas'
import { cn } from '@/lib/utils'

/**
 * El calendario de una cohorte: sus sesiones, cada una editable, más agendar
 * (una o la serie) y mandar las fechas por correo.
 *
 * Es UN componente porque se ve en dos lugares (21-sep-2026): en la página de
 * la cohorte, y también dentro del curso, donde Alejandro quiere agregar,
 * cambiar y borrar sesiones sin ir a buscar la cohorte.
 *
 * M14: lo que se puede hacer va como botones ARRIBA de la lista —agendar una,
 * agendar la serie, mandar las fechas— y cada uno abre su formulario (y cierra
 * los demás). Cada sesión es un <details> cerrado con su botón "Editar":
 * abierta enseña su formulario con lo que ya tiene, en hora CDMX. Solo se
 * abre sola la que pide la URL (`?sesion=`), que es como llega "Editar" desde
 * el panel. Server component: cada acción es un <form> directo.
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
  sesionAbierta,
}: {
  cohorte: CohorteConSesiones
  ligables: Array<{ id: string; titulo: string; modulo: string }>
  correoAdmin: string
  /** Dentro del curso: sin el título "Calendario", que ya lo pone el marco. */
  compacto?: boolean
  /** La sesión que la URL pide ver abierta (`?sesion=<id>`). */
  sesionAbierta?: string | null
}) {
  const ahora = Date.now()
  const proxima = cohorte.sesiones.find((s) => new Date(s.scheduled_at).getTime() >= ahora)
  const acordeon = `sesiones-${cohorte.id}`

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        {compacto ? (
          <span className="text-sm text-muted-foreground">
            {cohorte.sesiones.length} sesión(es) · {cohorte.inscritos} inscrito(s)
          </span>
        ) : (
          <h2 className="text-lg font-medium">Calendario</h2>
        )}
        {/* Enlaces, no un toggle de JS: los formularios de las sesiones
            plegadas ya no viajan en el HTML, así que abrirlas todas es pedir
            la página con `?sesion=todos` (24-sep-2026). */}
        {cohorte.sesiones.length > 1 ? (
          <span className="inline-flex items-center gap-1 text-xs">
            <Link href="?sesion=todos" scroll={false} className="rounded-md px-2 py-1 text-primary hover:bg-primary/10">
              Expandir todo
            </Link>
            <span aria-hidden className="text-muted-foreground">·</span>
            <Link href="?" scroll={false} className="rounded-md px-2 py-1 text-primary hover:bg-primary/10">
              Contraer todo
            </Link>
          </span>
        ) : null}
      </div>

      {/* Lo que se puede hacer, como botones. Comparten `nombre`: abrir uno
          cierra los otros, sin JavaScript. */}
      <div className="flex flex-col gap-2">
        <NuevaSesion cohorteId={cohorte.id} reinicio={cohorte.sesiones.length} nombre={acordeon} />
        <SesionesEnSerie cohorteId={cohorte.id} reinicio={cohorte.sesiones.length} nombre={acordeon} />
        <EnviarCalendario
          cohorteId={cohorte.id}
          inscritos={cohorte.inscritos}
          sesionesFuturas={cohorte.sesiones.filter((s) => new Date(s.scheduled_at).getTime() >= ahora - 3 * 60 * 60 * 1000).length}
          correoAdmin={correoAdmin}
          nombre={acordeon}
        />
      </div>

      {cohorte.sesiones.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Todavía no hay sesiones agendadas. Agenda las del curso completo con
          &ldquo;Agendar varias de una vez&rdquo;.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {cohorte.sesiones.map((sesion, i) => {
            const pasada = new Date(sesion.scheduled_at).getTime() < ahora
            const esProxima = proxima?.id === sesion.id
            const { fecha, hora } = utcACdmx(sesion.scheduled_at)
            const abierta = sesionAbierta === 'todos' || sesion.id === sesionAbierta

            return (
              <li key={sesion.id}>
                <details
                  id={`sesion-${sesion.id}`}
                  data-sesion={cohorte.id}
                  open={abierta || undefined}
                  className={'group/sesion rounded-lg border ' + (esProxima ? 'border-primary/50' : 'border-border')}
                >
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 select-none [&::-webkit-details-marker]:hidden">
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
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
                    <span className="flex flex-wrap items-center gap-3">
                      <span className="text-sm text-muted-foreground">{enCdmx(sesion.scheduled_at)} CDMX</span>
                      {/* Cerrada, "Editar" es un enlace: el formulario de esa
                          sesión se pinta solo cuando se pide (24-sep-2026).
                          Antes las ocho traían el suyo, con el selector de
                          grabación de 34 lecciones cada una, aunque estuvieran
                          plegadas. Abierta, el summary es el control. */}
                      {abierta ? (
                        <span aria-hidden className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                          Cerrar
                        </span>
                      ) : (
                        <Link
                          href={`?sesion=${sesion.id}#sesion-${sesion.id}`}
                          scroll={false}
                          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                        >
                          Editar
                        </Link>
                      )}
                    </span>
                  </summary>

                  {abierta ? (
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
                          className={claseSelect}
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

                    <div className="flex justify-end border-t border-border pt-4">
                      <ConfirmarConModal
                        idModal={`eliminar-sesion-${sesion.id}`}
                        accion={eliminarSesion}
                        campos={{ id: sesion.id, cohort_id: cohorte.id }}
                        boton={{
                          texto: 'Eliminar sesión',
                          etiquetaAccesible: `Eliminar la sesión ${sesion.title}`,
                          tono: 'destructivo',
                        }}
                        titulo={`¿Eliminar la sesión «${sesion.title}»?`}
                        confirmar={{ texto: 'Sí, eliminar', enCurso: 'Eliminando…', tono: 'destructivo' }}
                      >
                        <p>Desaparece del calendario de los alumnos y del correo de fechas.</p>
                      </ConfirmarConModal>
                    </div>
                  </div>
                  ) : null}
                </details>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
