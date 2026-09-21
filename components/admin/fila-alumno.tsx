'use client'

import { useActionState } from 'react'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { ConfirmarConModal } from '@/components/admin/confirmar-con-modal'
import type { CursoOpcion, EmpresaOpcion } from '@/components/admin/dar-de-alta'
import { cambiarEmpresaDeAlumno } from '@/lib/admin/acciones-empresas'
import { ListaSeleccionable, gruposDesdeCursos } from '@/components/admin/lista-seleccionable'
import { Avatar, Progreso } from '@/components/ui-vadai/superficie'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  cambiarAcceso,
  cambiarCorreoDeAlumno,
  darAccesoACursos,
  extenderAcceso,
  reactivarCuenta,
  reenviarAcceso,
  suspenderCuenta,
} from '@/lib/admin/acciones-alumnos'
import { enlaceDeAcceso } from '@/lib/admin/acciones-equipo'
import { SIN_ESTADO } from '@/lib/admin/tipos'
import type { AlumnoEnLista } from '@/lib/admin/alumnos'

/**
 * Una persona, como fila desplegable.
 *
 * La tabla anterior mostraba todo de todos a la vez y con 40 alumnos era una
 * pared de texto. Aquí la fila cerrada dice lo que se busca al escanear —quién
 * es, si tiene acceso, cuánto lleva— y lo demás se abre solo si interesa.
 *
 * Es `<details>` y no estado de React, por lo de siempre: sin JavaScript un
 * botón con `onClick` no abre nada y la información quedaría inalcanzable.
 */

function fecha(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  }).format(new Date(iso))
}

/**
 * `amount` ya viene en pesos o dólares, no en centavos: el webhook divide
 * entre 100 al guardar (app/api/stripe/webhook/route.ts) y el seed siembra
 * 14999.00. Esto dividía otra vez y el pago de $14,999 se mostraba como $150.
 */
function dinero(monto: number, moneda: string): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: moneda.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(monto)
}

/**
 * El enlace de acceso de 30 días.
 *
 * Es el respaldo de §11: cuando el correo no llega, en vez de decirle al alumno
 * "revisa tu spam" se le pasa el enlace por WhatsApp. Aparece en pantalla; en
 * la base queda solo su hash (lib/auth/enlace-durable.ts).
 */
function EnlaceDeAcceso({ email }: { email: string }) {
  const [estado, accion] = useActionState(enlaceDeAcceso, SIN_ESTADO)

  return (
    <div className="flex flex-col gap-2">
      <form action={accion}>
        <input type="hidden" name="email" value={email} />
        <Button type="submit" variant="outline" size="sm">
          Generar enlace de acceso
        </Button>
      </form>

      {estado.aviso ? (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            Vale 30 días. Cópialo y mándaselo por WhatsApp:
          </span>
          <input
            readOnly
            value={estado.aviso}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-md border border-border bg-muted/50 px-2.5 py-2 font-mono text-xs"
          />
        </label>
      ) : estado.error ? (
        <AvisoAccion estado={estado} />
      ) : null}
    </div>
  )
}

/**
 * Da acceso a más cursos a alguien que ya tiene cuenta.
 *
 * Los cursos se eligen en una lista de casillas: un toque marca, otro desmarca,
 * igual con ratón que con dedo. Un curso sin grupos es un renglón suelto; uno
 * con grupos es un bloque donde cada grupo es un renglón, así un solo control
 * resuelve curso Y grupo sin depender de JavaScript.
 *
 * Solo lista lo que la persona NO tiene. Lo que ya tiene se maneja arriba, con
 * "Restaurar acceso" y "Extender días".
 *
 * El estado de la acción NO vive aquí sino en la fila. Cuando a alguien se le
 * da el último curso que le faltaba, este formulario deja de pintarse; si el
 * aviso viviera aquí dentro, desaparecería justo al confirmar.
 */
function DarAcceso({
  userId,
  disponibles,
  reinicio,
  accion,
}: {
  userId: string
  disponibles: CursoOpcion[]
  reinicio: number
  accion: (datos: FormData) => void
}) {
  return (
    <details className="rounded-[10px] border border-dashed border-border">
      <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-[10px] px-3 py-2 text-sm font-medium text-primary select-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        + Dar acceso a otro curso
      </summary>

      {/* `key` con un valor del servidor: al agregarse inscripciones el
          formulario se remonta limpio, sin envolver la acción en un closure. */}
      <form key={reinicio} action={accion} className="flex flex-col gap-3 px-3 pt-1 pb-3">
        <input type="hidden" name="user_id" value={userId} />

        <ListaSeleccionable
          nombre="accesos"
          leyenda="Cursos"
          grupos={gruposDesdeCursos(disponibles)}
        />

        <p className="text-xs text-muted-foreground">
          Toca los que quieras; toca otra vez para quitar. No se manda correo: al entrar,
          encuentra el curso nuevo en su lista.
        </p>

        <div>
          <Button type="submit" size="sm">
            Dar acceso
          </Button>
        </div>
      </form>
    </details>
  )
}

export function FilaAlumno({
  alumno,
  cursos,
  empresas,
  puedeSuspender,
}: {
  alumno: AlumnoEnLista
  /** Todos los cursos no archivados; la fila descarta los que ya tiene. */
  cursos: CursoOpcion[]
  /** Para cambiarle la empresa desde aquí. */
  empresas: EmpresaOpcion[]
  /** Lo decide la página: nadie a sí mismo, y al equipo solo un superadmin. */
  puedeSuspender: boolean
}) {
  const [estadoAcceso, darAcceso] = useActionState(darAccesoACursos, SIN_ESTADO)
  const suspendida = alumno.estado === 'suspended'
  const disponibles = cursos.filter((c) => !alumno.inscripciones.some((i) => i.cursoId === c.id))
  const vigentes = alumno.inscripciones.filter((i) => i.vigente)
  const equipo = alumno.rol === 'admin' || alumno.rol === 'superadmin'

  const total = alumno.inscripciones.reduce((n, i) => n + i.total, 0)
  const hechas = alumno.inscripciones.reduce((n, i) => n + i.hechas, 0)
  const porcentaje = total === 0 ? 0 : Math.round((hechas / total) * 100)

  return (
    <details className="group/fila border-b border-border last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
        <Avatar nombre={alumno.nombre || alumno.email} tamano={34} />

        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-medium">{alumno.nombre || '(sin nombre)'}</span>
            {equipo ? (
              <Badge className="bg-vadai-lima text-vadai-navy text-[11px]">{alumno.rol}</Badge>
            ) : null}
            {alumno.estado !== 'active' ? (
              <Badge variant="outline" className="text-[11px]">
                {suspendida ? 'Suspendida' : alumno.estado}
              </Badge>
            ) : null}
            {/*
              Lo que se busca la mañana del lanzamiento: ¿ya entró? Se dice en
              la fila cerrada, porque abrir cien filas para averiguarlo no es
              una opción. El equipo no lo lleva: entra por su rol.
            */}
            {!equipo && !alumno.ultimoAcceso ? (
              <Badge variant="outline" className="border-destructive/40 text-[11px] text-destructive">
                Nunca ha entrado
              </Badge>
            ) : null}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {alumno.email}
            {alumno.empresa ? ` · ${alumno.empresa.nombre}` : ''}
            {alumno.ultimoAcceso ? ` · entró el ${fecha(alumno.ultimoAcceso)}` : ''}
          </span>
        </span>

        {/* En pantalla angosta esto estorba más de lo que informa. */}
        <span className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
          <span className="text-xs text-muted-foreground">
            {alumno.inscripciones.length === 0
              ? 'sin cursos'
              : `${vigentes.length} de ${alumno.inscripciones.length} vigente${alumno.inscripciones.length === 1 ? '' : 's'}`}
          </span>
          {total > 0 ? (
            <span className="w-24">
              <Progreso porcentaje={porcentaje} etiqueta={`${porcentaje}% de avance`} />
            </span>
          ) : null}
        </span>

        <Chevron />
      </summary>

      <div className="flex flex-col gap-5 border-t border-border bg-muted/25 px-4 py-4">
        {/* --- Inscripciones y avance --- */}
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
            Cursos y avance
          </h3>

          {alumno.inscripciones.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin inscripciones.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {alumno.inscripciones.map((i) => (
                <li
                  key={i.cursoId}
                  className="flex flex-col gap-2 rounded-[10px] border border-border bg-card p-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{i.cursoTitulo}</span>
                      {i.cohorte ? (
                        <Badge variant="secondary" className="text-[11px]">
                          {i.cohorte}
                        </Badge>
                      ) : null}
                      {i.revocada ? (
                        <Badge variant="outline" className="text-[11px]">
                          Revocado
                        </Badge>
                      ) : !i.vigente ? (
                        <Badge variant="outline" className="text-[11px]">
                          Vencido
                        </Badge>
                      ) : null}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {i.expiraEn ? `Vence ${fecha(i.expiraEn)}` : 'Sin vencimiento'}
                    </span>
                  </div>

                  {i.total > 0 ? (
                    <div className="flex flex-col gap-1">
                      <Progreso porcentaje={i.porcentaje} />
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {i.hechas} de {i.total} lecciones · {i.porcentaje}%
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Este curso todavía no tiene lecciones.
                    </span>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <form action={cambiarAcceso}>
                      <input type="hidden" name="user_id" value={alumno.userId} />
                      <input type="hidden" name="course_id" value={i.cursoId} />
                      <input type="hidden" name="revocar" value={i.revocada ? 'no' : 'si'} />
                      <Button type="submit" variant="ghost" size="sm">
                        {i.revocada ? 'Restaurar acceso' : 'Revocar acceso'}
                      </Button>
                    </form>

                    <form action={extenderAcceso} className="flex items-center gap-1.5">
                      <input type="hidden" name="user_id" value={alumno.userId} />
                      <input type="hidden" name="course_id" value={i.cursoId} />
                      <input
                        type="number"
                        name="dias"
                        min={1}
                        max={3650}
                        defaultValue={30}
                        aria-label="Días para extender"
                        className="h-8 w-20 rounded-md border border-input bg-transparent px-2 text-sm"
                      />
                      <Button type="submit" variant="ghost" size="sm">
                        Extender días
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {disponibles.length > 0 ? (
            <DarAcceso
              userId={alumno.userId}
              disponibles={disponibles}
              reinicio={alumno.inscripciones.length}
              accion={darAcceso}
            />
          ) : cursos.length > 0 ? (
            <p className="text-xs text-muted-foreground">Ya tiene todos los cursos activos.</p>
          ) : null}

          <AvisoAccion estado={estadoAcceso} />
        </section>

        {/* --- Pagos --- */}
        {alumno.pagos.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
              Pagos
            </h3>
            <ul className="flex flex-col gap-1">
              {alumno.pagos.map((p, i) => (
                <li
                  key={`${p.fecha}-${i}`}
                  className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
                >
                  <span>{p.cursoTitulo}</span>
                  <span className="flex items-baseline gap-3 text-muted-foreground">
                    <span className="tabular-nums">{dinero(p.monto, p.moneda)}</span>
                    <span className="text-xs">{fecha(p.fecha)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* --- Acceso --- */}
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
            Acceso
          </h3>
          <div className="flex flex-wrap items-start gap-3">
            <form action={reenviarAcceso}>
              <input type="hidden" name="email" value={alumno.email} />
              <Button type="submit" variant="ghost" size="sm">
                Reenviar correo de acceso
              </Button>
            </form>

            <EnlaceDeAcceso email={alumno.email} />

            {/* Cambiar el correo: con confirmación, y al nuevo le llega el de
                crear contraseña. Es lo que prueba que el cambio fue para la
                persona correcta. */}
            <ConfirmarConModal
              idModal={`cambiar-correo-${alumno.userId}`}
              accion={cambiarCorreoDeAlumno}
              campos={{ user_id: alumno.userId }}
              boton={{ texto: 'Cambiar correo', etiquetaAccesible: `Cambiar el correo de ${alumno.nombre || alumno.email}` }}
              titulo={`Cambiar el correo de ${alumno.nombre || alumno.email}`}
              confirmar={{ texto: 'Cambiar y avisarle', enCurso: 'Cambiando…' }}
            >
              <p>
                Ahora entra con <span className="font-medium text-foreground">{alumno.email}</span>.
                Escribe el correo nuevo:
              </p>
              <input
                type="email"
                name="nuevo_email"
                required
                autoComplete="off"
                placeholder="nuevo@correo.com"
                className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground"
              />
              <p>
                Al correo nuevo le llega el mensaje para crear su contraseña, con liga de 30 días.
                Sus cursos, avance y puntos siguen igual. El correo viejo deja de servir para entrar.
              </p>
            </ConfirmarConModal>
          </div>
          {!equipo ? (
            <form action={cambiarEmpresaDeAlumno} className="flex flex-wrap items-center gap-2 pt-1">
              <input type="hidden" name="user_id" value={alumno.userId} />
              <label htmlFor={`empresa-${alumno.userId}`} className="text-xs text-muted-foreground">
                Empresa
              </label>
              <select
                id={`empresa-${alumno.userId}`}
                name="company_id"
                defaultValue={alumno.empresa?.id ?? ''}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
              >
                <option value="">General</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="ghost" size="sm">
                Guardar
              </Button>
            </form>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Dado de alta el {fecha(alumno.creadoEn)}.{' '}
            {alumno.ultimoAcceso
              ? `Última vez que entró: ${fecha(alumno.ultimoAcceso)}.`
              : 'No ha entrado ni una vez.'}{' '}
            {alumno.enlace
              ? `Último enlace enviado el ${fecha(alumno.enlace.enviadoEn)}, ` +
                (alumno.enlace.vigente
                  ? `vale hasta el ${fecha(alumno.enlace.venceEn)}`
                  : 'ya vencido') +
                (alumno.enlace.usos > 0
                  ? `, abierto ${alumno.enlace.usos} ${alumno.enlace.usos === 1 ? 'vez' : 'veces'}.`
                  : ', sin abrir.')
              : 'Sin enlace de 30 días todavía: los correos anteriores al 20-sep llevaban una liga de una hora.'}
          </p>
        </section>

        {/* --- Cuenta ---
            Suspender es el "eliminar" de un alumno: le corta la entrada y no
            borra nada. Ver `suspenderCuenta`. */}
        {suspendida || puedeSuspender ? (
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
              Cuenta
            </h3>

            {suspendida ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-muted-foreground">
                  Suspendida: no puede entrar. Sus cursos, progreso y pagos siguen guardados.
                </p>
                {puedeSuspender ? (
                  <form action={reactivarCuenta}>
                    <input type="hidden" name="user_id" value={alumno.userId} />
                    <Button type="submit" variant="outline" size="sm">
                      Reactivar cuenta
                    </Button>
                  </form>
                ) : null}
              </div>
            ) : (
              <div>
                <ConfirmarConModal
                  idModal={`suspender-cuenta-${alumno.userId}`}
                  accion={suspenderCuenta}
                  campos={{ user_id: alumno.userId }}
                  boton={{
                    texto: 'Suspender cuenta',
                    etiquetaAccesible: `Suspender la cuenta de ${alumno.nombre || alumno.email}`,
                    tono: 'destructivo',
                  }}
                  titulo={`¿Suspender a ${alumno.nombre || alumno.email}?`}
                  confirmar={{
                    texto: 'Sí, suspender',
                    enCurso: 'Suspendiendo…',
                    tono: 'destructivo',
                  }}
                >
                  <p>
                    Deja de poder entrar desde este momento, aunque tenga la sesión abierta. Al
                    intentarlo verá que su cuenta está suspendida.
                  </p>
                  <p>
                    <span className="font-medium text-foreground">No se borra nada</span>: sus
                    inscripciones, progreso, entregas, certificados y pagos se quedan como están.
                    La encuentras en Suspendidos y la reactivas cuando quieras.
                  </p>
                </ConfirmarConModal>
              </div>
            )}
          </section>
        ) : null}
      </div>
    </details>
  )
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0 text-muted-foreground transition-transform group-open/fila:rotate-90"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}
