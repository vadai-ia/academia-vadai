import type { Metadata } from 'next'

import { AltaManual } from '@/components/admin/alta-manual'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cambiarAcceso, reenviarAcceso } from '@/lib/admin/acciones-alumnos'
import { listarAlumnos, listarPagos, opcionesDeAlta } from '@/lib/admin/alumnos'
import { exigirAdmin } from '@/lib/auth/sesion'
import { stripeConfigurado, stripeEnVivo } from '@/lib/stripe/cliente'

export const metadata: Metadata = { title: 'Alumnos' }
export const dynamic = 'force-dynamic'

function fecha(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  }).format(new Date(iso))
}

export default async function PaginaAlumnos() {
  await exigirAdmin()

  const [alumnos, pagos, cursos] = await Promise.all([
    listarAlumnos(),
    listarPagos(),
    opcionesDeAlta(),
  ])

  // Un pago sin cuenta es el caso que §11 manda resolver a mano: el dinero
  // entró pero el alta no se completó.
  const huerfanos = pagos.filter((p) => !p.tieneCuenta && p.estado === 'paid')

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Alumnos</h1>
        <p className="text-sm text-muted-foreground">
          {alumnos.length} persona(s) con perfil · {pagos.length} pago(s) registrado(s)
        </p>
      </header>

      {stripeConfigurado() && stripeEnVivo() ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          Stripe está en modo <strong>LIVE</strong>: cualquier compra aquí mueve dinero real.
        </p>
      ) : null}

      {huerfanos.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-lg border border-vadai-lima/40 bg-vadai-lima/5 p-4">
          <h2 className="font-medium">
            {huerfanos.length} pago(s) sin cuenta asociada
          </h2>
          <p className="text-sm text-muted-foreground">
            Entró el dinero pero el alta no se completó. Da de alta a estas personas a
            mano con el formulario de abajo, usando su mismo correo.
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {huerfanos.map((p) => (
              <li key={p.id} className="font-mono text-xs">
                {p.email} · {p.cursoTitulo} · {p.monto} {p.moneda} · {fecha(p.fecha)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Alta manual</h2>
        <AltaManual cursos={cursos} reinicio={alumnos.length} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Personas</h2>

        {alumnos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Todavía no hay nadie dado de alta.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {alumnos.map((alumno) => (
              <li
                key={alumno.userId}
                className="flex flex-col gap-3 rounded-lg border border-border px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">
                        {alumno.nombre || alumno.email}
                      </span>
                      {alumno.rol !== 'alumno' ? (
                        <Badge variant="secondary">{alumno.rol}</Badge>
                      ) : null}
                      {alumno.estado === 'suspended' ? (
                        <Badge variant="outline">Suspendida</Badge>
                      ) : null}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {alumno.email}
                    </span>
                  </span>

                  {/* Sirve cuando el SMTP falló al dar de alta: la cuenta existe
                      pero la persona nunca recibió cómo entrar. */}
                  <form action={reenviarAcceso}>
                    <input type="hidden" name="email" value={alumno.email} />
                    <Button type="submit" variant="ghost" size="sm">
                      Reenviar acceso
                    </Button>
                  </form>
                </div>

                {alumno.inscripciones.length > 0 ? (
                  <ul className="flex flex-col gap-1.5">
                    {alumno.inscripciones.map((inscripcion) => (
                      <li
                        key={inscripcion.cursoId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2"
                      >
                        <span className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                          <span className="truncate">{inscripcion.cursoTitulo}</span>
                          {inscripcion.cohorte ? (
                            <span className="text-xs text-muted-foreground">
                              {inscripcion.cohorte}
                            </span>
                          ) : null}
                          {inscripcion.revocada ? (
                            <Badge variant="outline">Revocada</Badge>
                          ) : inscripcion.vigente ? (
                            <Badge className="bg-vadai-lima text-vadai-navy">Vigente</Badge>
                          ) : (
                            <Badge variant="secondary">Vencida</Badge>
                          )}
                          {inscripcion.expiraEn ? (
                            <span className="text-xs text-muted-foreground">
                              hasta {fecha(inscripcion.expiraEn)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">de por vida</span>
                          )}
                        </span>

                        <form action={cambiarAcceso}>
                          <input type="hidden" name="user_id" value={alumno.userId} />
                          <input type="hidden" name="course_id" value={inscripcion.cursoId} />
                          <input
                            type="hidden"
                            name="revocar"
                            value={inscripcion.revocada ? 'no' : 'si'}
                          />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            className={
                              inscripcion.revocada ? undefined : 'text-destructive hover:text-destructive'
                            }
                          >
                            {inscripcion.revocada ? 'Restaurar' : 'Revocar'}
                          </Button>
                        </form>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">Sin inscripciones.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Pagos</h2>

        {pagos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Todavía no hay pagos registrados.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pagos.map((pago) => (
              <li
                key={pago.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-4 py-2.5"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm">{pago.email}</span>
                  <span className="text-xs text-muted-foreground">
                    {pago.cursoTitulo} · {fecha(pago.fecha)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  {!pago.tieneCuenta ? <Badge variant="outline">Sin cuenta</Badge> : null}
                  {pago.estado === 'refunded' ? (
                    <Badge variant="secondary">Reembolsado</Badge>
                  ) : null}
                  <span className="text-sm">
                    {pago.monto} {pago.moneda}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
