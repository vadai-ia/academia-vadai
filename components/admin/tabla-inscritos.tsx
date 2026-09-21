import Link from 'next/link'

import { ConfirmarConModal } from '@/components/admin/confirmar-con-modal'
import { Cifra, Progreso } from '@/components/ui-vadai/superficie'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cambiarAcceso, cambiarCorreoDeAlumno, extenderAcceso, quitarDelCurso } from '@/lib/admin/acciones-alumnos'
import { cambiarEmpresaDeAlumno } from '@/lib/admin/acciones-empresas'
import type { Empresa } from '@/lib/admin/empresas'
import { ORDENES, type FiltrosInscritos, type Inscrito, type ResumenInscritos } from '@/lib/admin/inscritos'

/**
 * La tabla de inscritos de un curso.
 *
 * Con 118 personas la lista anterior era una columna interminable; con mil
 * sería inservible. Aquí:
 *
 *   - El resumen va arriba: cuántos, cuántos entraron, avance y puntos
 *     promedio, y el corte por empresa, que es lo que Alejandro quiere ver de
 *     un vistazo.
 *   - Los filtros y el orden viven en la URL (un <form> GET): funcionan sin
 *     JavaScript, se comparten y se vuelve con "atrás".
 *   - La tabla se desplaza dentro de su propia caja, con el encabezado
 *     pegado, así que el resto de la página no se va hacia abajo.
 *   - Cada fila trae lo rápido a la mano: revocar o restaurar, +30 días,
 *     cambiar empresa y quitar del curso. "Ver" abre la ficha completa en un
 *     popover nativo, centrado: se abre y se cierra sin JavaScript.
 *
 * Las acciones son las mismas de /admin/alumnos, sin envolver: van directas
 * al <form> (CLAUDE.md).
 */

const ETIQUETA_ACCESO: Record<Inscrito['acceso'], string> = {
  vigente: 'Vigente',
  vencido: 'Vencido',
  revocado: 'Revocado',
}

function fecha(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    timeZone: 'America/Mexico_City',
  }).format(new Date(iso))
}

function fechaLarga(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Mexico_City',
  }).format(new Date(iso))
}

const claseSelect =
  'h-9 rounded-md border border-input bg-transparent px-2 text-sm ' +
  'outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

export function TablaInscritos({
  cursoId,
  inscritos,
  resumen,
  empresas,
  filtros,
}: {
  cursoId: string
  inscritos: Inscrito[]
  resumen: ResumenInscritos
  empresas: Empresa[]
  filtros: FiltrosInscritos
}) {
  const hayFiltro = Boolean(filtros.q || filtros.acceso || filtros.empresa)
  const porcentajeEntraron = resumen.total === 0 ? 0 : Math.round((resumen.entraron / resumen.total) * 100)

  return (
    <div className="flex flex-col gap-5" id="inscritos">
      {/* --- Resumen ------------------------------------------------------- */}
      <div className="flex flex-col gap-4 rounded-[10px] border border-border bg-card p-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
          <Cifra valor={resumen.total} etiqueta="inscritos" />
          <Cifra valor={resumen.vigentes} etiqueta="con acceso vigente" />
          <Cifra
            valor={resumen.entraron}
            etiqueta="ya entraron"
            detalle={`${porcentajeEntraron}% de los inscritos`}
            destacada
          />
          <Cifra
            valor={`${resumen.avancePromedio}%`}
            etiqueta="avance promedio"
            detalle={resumen.lecciones > 0 ? `${resumen.lecciones} lecciones publicadas` : 'sin lecciones publicadas'}
          />
          <Cifra valor={resumen.terminaron} etiqueta="terminaron" />
          <Cifra valor={resumen.puntosPromedio} etiqueta="puntos promedio" />
        </div>

        {resumen.porEmpresa.length > 0 ? (
          <details className="group/empresas border-t border-border pt-3">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-primary select-none underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
              Por empresa
              <span aria-hidden className="transition-transform group-open/empresas:rotate-90">›</span>
            </summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="text-left">
                    <th className="py-1.5 pr-4 font-medium">Empresa</th>
                    <th className="py-1.5 pr-4 font-medium tabular-nums">Inscritos</th>
                    <th className="py-1.5 pr-4 font-medium tabular-nums">Entraron</th>
                    <th className="py-1.5 pr-4 font-medium tabular-nums">Avance</th>
                    <th className="py-1.5 font-medium tabular-nums">Puntos prom.</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.porEmpresa.map((e) => (
                    <tr key={e.id ?? 'general'} className="border-t border-border">
                      <td className="py-1.5 pr-4">
                        <Link
                          href={`/admin/cursos/${cursoId}?empresa=${e.id ?? 'general'}#inscritos`}
                          className="font-medium underline-offset-4 hover:text-primary hover:underline"
                        >
                          {e.nombre}
                        </Link>
                      </td>
                      <td className="py-1.5 pr-4 tabular-nums">{e.n}</td>
                      <td className="py-1.5 pr-4 tabular-nums">{e.entraron}</td>
                      <td className="py-1.5 pr-4 tabular-nums">{e.avance}%</td>
                      <td className="py-1.5 tabular-nums">{e.puntos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ) : null}
      </div>

      {/* --- Filtros ------------------------------------------------------- */}
      <form method="get" action={`/admin/cursos/${cursoId}#inscritos`} className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-48 flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Buscar</span>
          <Input name="q" type="search" defaultValue={filtros.q ?? ''} placeholder="Nombre o correo…" className="h-9" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Acceso</span>
          <select name="acceso" defaultValue={filtros.acceso ?? ''} className={claseSelect}>
            <option value="">Todos</option>
            <option value="vigente">Vigente</option>
            <option value="vencido">Vencido</option>
            <option value="revocado">Revocado</option>
            <option value="nunca">Nunca han entrado</option>
            <option value="entraron">Ya entraron</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Empresa</span>
          <select name="empresa" defaultValue={filtros.empresa ?? ''} className={claseSelect}>
            <option value="">Todas</option>
            <option value="general">General (sin empresa)</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Orden</span>
          <select name="orden" defaultValue={filtros.orden ?? 'nombre'} className={claseSelect}>
            {Object.entries(ORDENES).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline" size="sm" className="h-9">
          Aplicar
        </Button>
        {hayFiltro ? (
          <Button asChild variant="ghost" size="sm" className="h-9">
            <a href={`/admin/cursos/${cursoId}#inscritos`}>Limpiar</a>
          </Button>
        ) : null}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {inscritos.length} de {resumen.total}
        </span>
      </form>

      {/* --- Tabla ------------------------------------------------------------ */}
      {inscritos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
          {hayFiltro ? 'Nadie coincide con ese filtro.' : 'Nadie tiene este curso todavía.'}
        </p>
      ) : (
        <div className="max-h-[70vh] overflow-auto rounded-[10px] border border-border">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="sticky top-0 z-10 bg-card text-xs text-muted-foreground shadow-[0_1px_0_var(--border)]">
              <tr className="text-left">
                <th className="px-3 py-2.5 font-medium">Alumno</th>
                <th className="px-3 py-2.5 font-medium">Empresa</th>
                <th className="px-3 py-2.5 font-medium">Acceso</th>
                <th className="px-3 py-2.5 font-medium">Último acceso</th>
                <th className="px-3 py-2.5 font-medium">Avance</th>
                <th className="px-3 py-2.5 font-medium">Puntos</th>
                <th className="px-3 py-2.5 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {inscritos.map((i) => (
                <Fila key={i.userId} inscrito={i} cursoId={cursoId} empresas={empresas} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Fila({ inscrito: i, cursoId, empresas }: { inscrito: Inscrito; cursoId: string; empresas: Empresa[] }) {
  const idFicha = `ficha-${i.userId}`

  return (
    <tr className="border-t border-border align-middle hover:bg-muted/40">
      <td className="px-3 py-2">
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{i.nombre || '(sin nombre)'}</span>
          <span className="truncate text-xs text-muted-foreground">
            {i.email}
            {i.grupo ? ` · ${i.grupo}` : ''}
          </span>
        </div>
      </td>
      <td className="px-3 py-2">
        <form action={cambiarEmpresaDeAlumno} className="flex items-center gap-1">
          <input type="hidden" name="user_id" value={i.userId} />
          <input type="hidden" name="course_id" value={cursoId} />
          <select
            name="company_id"
            defaultValue={i.empresa?.id ?? ''}
            aria-label={`Empresa de ${i.nombre || i.email}`}
            className={`${claseSelect} h-8 max-w-40`}
          >
            <option value="">General</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
          <Button type="submit" variant="ghost" size="sm" className="h-8 px-2" aria-label="Guardar empresa">
            ✓
          </Button>
        </form>
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-col gap-0.5">
          <Badge
            variant={i.acceso === 'vigente' ? 'default' : 'outline'}
            className={i.acceso === 'vigente' ? 'w-fit bg-exito/15 text-exito hover:bg-exito/15' : 'w-fit'}
          >
            {ETIQUETA_ACCESO[i.acceso]}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {i.expiraEn ? `vence ${fecha(i.expiraEn)}` : 'sin vencimiento'}
          </span>
        </div>
      </td>
      <td className="px-3 py-2">
        {i.ultimoAcceso ? (
          <span className="text-sm">{fecha(i.ultimoAcceso)}</span>
        ) : (
          <span className="text-xs text-destructive">Nunca</span>
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex w-32 flex-col gap-1">
          <Progreso porcentaje={i.porcentaje} etiqueta={`${i.porcentaje}% de avance`} />
          <span className="text-xs text-muted-foreground tabular-nums">
            {i.hechas} de {i.total} · {i.porcentaje}%
          </span>
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-col">
          <span className="font-semibold text-primary tabular-nums">{i.puntos}</span>
          <span className="text-xs text-muted-foreground">
            N{i.nivel.numero} · {i.nivel.nombre}
          </span>
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            popoverTarget={idFicha}
            className="rounded-md px-2 py-1 text-sm font-medium text-primary hover:bg-primary/10"
          >
            Ver
          </button>
          <form action={cambiarAcceso}>
            <input type="hidden" name="user_id" value={i.userId} />
            <input type="hidden" name="course_id" value={cursoId} />
            <input type="hidden" name="revocar" value={i.acceso === 'revocado' ? 'no' : 'si'} />
            <Button type="submit" variant="ghost" size="sm" className="h-8">
              {i.acceso === 'revocado' ? 'Restaurar' : 'Revocar'}
            </Button>
          </form>
          <form action={extenderAcceso}>
            <input type="hidden" name="user_id" value={i.userId} />
            <input type="hidden" name="course_id" value={cursoId} />
            <input type="hidden" name="dias" value="30" />
            <Button type="submit" variant="ghost" size="sm" className="h-8" title="Extiende la vigencia 30 días desde hoy">
              +30 días
            </Button>
          </form>
        </div>

        {/* La ficha: el popover se centra solo (posición fija, inset auto). */}
        <div
          id={idFicha}
          popover="auto"
          className="m-auto w-[min(40rem,calc(100vw-2rem))] max-h-[85vh] overflow-y-auto rounded-[12px] border border-border bg-card p-0 text-left text-foreground shadow-[0_8px_32px_rgba(0,0,0,0.14)]"
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="flex min-w-0 flex-col">
              <span className="text-lg font-medium">{i.nombre || '(sin nombre)'}</span>
              <span className="truncate text-sm text-muted-foreground">{i.email}</span>
            </div>
            <button
              type="button"
              popoverTarget={idFicha}
              popoverTargetAction="hide"
              className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          <div className="grid gap-5 px-5 py-4 sm:grid-cols-2">
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Empresa</dt>
                <dd className="font-medium">{i.empresa?.nombre ?? 'General'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Grupo</dt>
                <dd className="font-medium">{i.grupo ?? 'Sin grupo'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Acceso</dt>
                <dd className="font-medium">
                  {ETIQUETA_ACCESO[i.acceso]}
                  {i.expiraEn ? ` · vence ${fechaLarga(i.expiraEn)}` : ''}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Inscrito</dt>
                <dd className="font-medium">{fechaLarga(i.inscritoEn)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Última vez que entró</dt>
                <dd className="font-medium">{i.ultimoAcceso ? fechaLarga(i.ultimoAcceso) : 'Nunca'}</dd>
              </div>
            </dl>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">Avance</span>
                  <span className="font-medium tabular-nums">
                    {i.hechas} de {i.total} · {i.porcentaje}%
                  </span>
                </div>
                <Progreso porcentaje={i.porcentaje} />
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <div className="flex items-baseline justify-between">
                  <span className="text-muted-foreground">Puntos</span>
                  <span className="font-semibold text-primary tabular-nums">{i.puntos}</span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Nivel {i.nivel.numero} · {i.nivel.nombre}
                  {i.nivel.siguiente ? ` · faltan ${i.nivel.faltan} para ${i.nivel.siguiente.nombre}` : ''}
                </div>
                <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
                  <li>{i.actividad.lecciones} lecciones</li>
                  <li>{i.actividad.quizzes} quizzes</li>
                  <li>{i.actividad.tareas} tareas</li>
                  <li>{i.actividad.publicaciones} publicaciones</li>
                  <li>{i.actividad.comentarios} comentarios</li>
                  <li>{i.actividad.certificados} certificados</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border px-5 py-4">
            <form action={cambiarEmpresaDeAlumno} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="user_id" value={i.userId} />
              <input type="hidden" name="course_id" value={cursoId} />
              <label className="text-sm text-muted-foreground" htmlFor={`${idFicha}-empresa`}>
                Empresa
              </label>
              <select id={`${idFicha}-empresa`} name="company_id" defaultValue={i.empresa?.id ?? ''} className={claseSelect}>
                <option value="">General</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="outline" size="sm">
                Guardar
              </Button>
            </form>

            <form action={extenderAcceso} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="user_id" value={i.userId} />
              <input type="hidden" name="course_id" value={cursoId} />
              <label className="text-sm text-muted-foreground" htmlFor={`${idFicha}-dias`}>
                Extender
              </label>
              <input
                id={`${idFicha}-dias`}
                type="number"
                name="dias"
                min={1}
                max={3650}
                defaultValue={30}
                className="h-9 w-20 rounded-md border border-input bg-transparent px-2 text-sm"
              />
              <span className="text-sm text-muted-foreground">días desde hoy</span>
              <Button type="submit" variant="outline" size="sm">
                Extender
              </Button>
            </form>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button asChild variant="ghost" size="sm">
                <Link href={`/admin/alumnos?q=${encodeURIComponent(i.email)}`}>Ver en Alumnos →</Link>
              </Button>
              <ConfirmarConModal
                idModal={`correo-${i.userId}`}
                accion={cambiarCorreoDeAlumno}
                campos={{ user_id: i.userId }}
                boton={{ texto: 'Cambiar correo', etiquetaAccesible: `Cambiar el correo de ${i.nombre || i.email}` }}
                titulo={`Cambiar el correo de ${i.nombre || i.email}`}
                confirmar={{ texto: 'Cambiar y avisarle', enCurso: 'Cambiando…' }}
              >
                <p>
                  Ahora entra con <span className="font-medium text-foreground">{i.email}</span>. Escribe el
                  correo nuevo:
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
                  Al correo nuevo le llega el mensaje para crear su contraseña, con liga de 30 días. Sus
                  cursos, avance y puntos siguen igual.
                </p>
              </ConfirmarConModal>
              <ConfirmarConModal
                idModal={`quitar-${i.userId}`}
                accion={quitarDelCurso}
                campos={{ user_id: i.userId, course_id: cursoId }}
                boton={{ texto: 'Quitar del curso', etiquetaAccesible: `Quitar a ${i.nombre || i.email} del curso`, tono: 'destructivo' }}
                titulo={`¿Quitar a ${i.nombre || i.email} de este curso?`}
                confirmar={{ texto: 'Sí, quitar', enCurso: 'Quitando…', tono: 'destructivo' }}
              >
                <p>Deja de ver el curso desde este momento. Su cuenta y sus otros cursos siguen igual.</p>
                <p>
                  <span className="font-medium text-foreground">Su avance no se borra</span>: si lo vuelves
                  a agregar, lo encuentra donde lo dejó. Para un reembolso usa &ldquo;Revocar&rdquo;, que
                  deja constancia.
                </p>
              </ConfirmarConModal>
            </div>
          </div>
        </div>
      </td>
    </tr>
  )
}
