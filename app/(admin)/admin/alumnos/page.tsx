import type { Metadata } from 'next'

import { DarDeAlta } from '@/components/admin/dar-de-alta'
import { FilaAlumno } from '@/components/admin/fila-alumno'
import { ReenviarPendientes } from '@/components/admin/reenviar-pendientes'
import { Pestanas } from '@/components/ui-vadai/pestanas'
import { Cifra, Tarjeta, Titulo } from '@/components/ui-vadai/superficie'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { alumnosPendientesDeEntrar } from '@/lib/admin/accesos'
import { listarAlumnos, listarPagos, opcionesDeAlta } from '@/lib/admin/alumnos'
import { listarEmpresas } from '@/lib/admin/empresas'
import { exigirAdmin } from '@/lib/auth/sesion'
import { stripeConfigurado, stripeEnVivo } from '@/lib/stripe/cliente'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Alumnos' }
export const dynamic = 'force-dynamic'
// El recordatorio en lote genera las ligas y manda el lote desde una server
// action de esta página. Cabe en segundos, pero el default de Vercel es corto
// y un corte a medias dejaría ligas creadas sin correo. 60 s vale en todos los
// planes.
export const maxDuration = 60

/**
 * Dos filtros que se combinan, los dos en la URL —funcionan sin JavaScript,
 * se comparten y se vuelve con "atrás"—:
 *
 *   `?ver=suspendidos`  la pestaña de cuentas: activas o suspendidas.
 *   `?acceso=nunca`     el corte por acceso dentro de esa pestaña: quién ya
 *                       entró y quién no. Es la pregunta de la mañana de un
 *                       lanzamiento.
 */
const ACCESOS = {
  todos: 'Todos',
  nunca: 'Nunca han entrado',
  entraron: 'Ya entraron',
} as const
type Acceso = keyof typeof ACCESOS

function fecha(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  }).format(new Date(iso))
}

export default async function PaginaAlumnos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ver?: string; acceso?: string; empresa?: string }>
}) {
  const perfil = await exigirAdmin()
  const { q, ver, acceso, empresa } = await searchParams
  const busqueda = (q ?? '').trim()
  const verSuspendidos = ver === 'suspendidos'
  const corte: Acceso = acceso === 'nunca' || acceso === 'entraron' ? acceso : 'todos'
  const empresaFiltro = (empresa ?? '').trim()

  const [listado, pagos, cursos, pendientes, empresas] = await Promise.all([
    listarAlumnos(busqueda),
    listarPagos(),
    opcionesDeAlta(),
    alumnosPendientesDeEntrar(),
    listarEmpresas(),
  ])

  // El filtro por empresa (20-sep-2026): `general` es quien no tiene ninguna.
  const alumnos = empresaFiltro
    ? listado.filter((a) =>
        empresaFiltro === 'general' ? a.empresa === null : a.empresa?.id === empresaFiltro
      )
    : listado

  // Un pago sin cuenta es el caso que §11 manda resolver a mano: el dinero
  // entró pero el alta no se completó.
  const huerfanos = pagos.filter((p) => !p.tieneCuenta && p.estado === 'paid')

  const conAcceso = alumnos.filter((a) => a.inscripciones.some((i) => i.vigente)).length

  // Suspender es el "eliminar" de esta pantalla: la persona sale de la lista
  // principal pero no se borra. Las cifras de arriba siguen contando a todos.
  const suspendidos = alumnos.filter((a) => a.estado === 'suspended')
  const activos = alumnos.filter((a) => a.estado !== 'suspended')
  const pestana = verSuspendidos ? suspendidos : activos

  // "¿Ya entró?" se cuenta sobre las cuentas activas: una suspendida no puede
  // entrar, y contarla como pendiente mandaría un correo a quien se cortó.
  const entraron = activos.filter((a) => a.ultimoAcceso).length
  const nunca = activos.length - entraron

  const visibles =
    corte === 'nunca'
      ? pestana.filter((a) => !a.ultimoAcceso)
      : corte === 'entraron'
        ? pestana.filter((a) => a.ultimoAcceso)
        : pestana

  // Los filtros se conservan entre sí: cambiar de pestaña no pierde la
  // búsqueda, y buscar no pierde la pestaña ni el corte.
  const hrefDe = (opciones: { suspendidos?: boolean; acceso?: Acceso; q?: string }) => {
    const parametros = new URLSearchParams()
    if (opciones.q) parametros.set('q', opciones.q)
    if (opciones.suspendidos) parametros.set('ver', 'suspendidos')
    if (opciones.acceso && opciones.acceso !== 'todos') parametros.set('acceso', opciones.acceso)
    if (empresaFiltro) parametros.set('empresa', empresaFiltro)
    const cadena = parametros.toString()
    return cadena ? `/admin/alumnos?${cadena}` : '/admin/alumnos'
  }

  const apoyo = busqueda
    ? `${visibles.length} resultado${visibles.length === 1 ? '' : 's'} para "${busqueda}"`
    : corte !== 'todos'
      ? `${visibles.length} de ${pestana.length}`
      : undefined

  const soySuperadmin = perfil.role === 'superadmin'

  return (
    <div className="flex flex-col gap-8">
      <Titulo apoyo={apoyo}>Alumnos</Titulo>

      {stripeConfigurado() && stripeEnVivo() ? (
        <p className="rounded-[10px] border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          Stripe está en modo <strong>LIVE</strong>: cualquier compra aquí mueve dinero real.
        </p>
      ) : null}

      {/* Lo que hay que resolver a mano va primero y solo si existe. */}
      {huerfanos.length > 0 ? (
        <Tarjeta className="flex flex-col gap-2 border-destructive/40 bg-destructive/5 p-5">
          <h2 className="font-medium">
            {huerfanos.length} pago{huerfanos.length === 1 ? '' : 's'} sin cuenta
          </h2>
          <p className="text-sm text-muted-foreground">
            El dinero entró pero el alta no se completó. Da de alta a esta gente a mano con el
            correo del pago:
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {huerfanos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-medium">{p.email}</span>
                <span className="text-muted-foreground">
                  {p.cursoTitulo} · {fecha(p.fecha)}
                </span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      ) : null}

      {!busqueda ? (
        <Tarjeta className="flex flex-col gap-5 p-5">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-5">
            <Cifra valor={alumnos.length} etiqueta="personas con perfil" />
            <Cifra valor={conAcceso} etiqueta="con acceso vigente" />
            <Cifra valor={entraron} etiqueta="ya entraron" destacada />
            <Cifra valor={nunca} etiqueta="nunca han entrado" />
            <Cifra valor={pagos.length} etiqueta="pagos registrados" />
          </div>

          {/*
            Lo que se hace con el número de arriba. "Nunca han entrado" sin un
            botón al lado es una cifra que da ansiedad y no resuelve nada.
          */}
          <ReenviarPendientes pendientes={pendientes.length} />
        </Tarjeta>
      ) : null}

      <DarDeAlta cursos={cursos} empresas={empresas} reinicio={listado.length} soySuperadmin={soySuperadmin} />

      {/*
        El buscador es un <form> GET, no un filtro en el cliente.

        Así funciona sin JavaScript, el resultado queda en la URL —se puede
        compartir y volver con el botón atrás— y el filtrado ocurre en el
        servidor, que es donde están los datos. Un filtro en el cliente además
        obligaría a mandar los 40 alumnos completos al navegador.
      */}
      <form method="get" className="flex flex-wrap items-end gap-2">
        {verSuspendidos ? <input type="hidden" name="ver" value="suspendidos" /> : null}
        {corte !== 'todos' ? <input type="hidden" name="acceso" value={corte} /> : null}
        <label className="flex min-w-56 flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium">Buscar</span>
          <Input
            type="search"
            name="q"
            defaultValue={busqueda}
            placeholder="Nombre o correo…"
            autoComplete="off"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Empresa</span>
          <select
            name="empresa"
            defaultValue={empresaFiltro}
            className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Todas</option>
            <option value="general">General (sin empresa)</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre} ({e.alumnos})
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline">
          Buscar
        </Button>
        {busqueda || empresaFiltro ? (
          <Button asChild variant="ghost">
            <a href={verSuspendidos ? '/admin/alumnos?ver=suspendidos' : '/admin/alumnos'}>Limpiar</a>
          </Button>
        ) : null}
      </form>

      <Pestanas
        etiqueta="Filtro de cuentas"
        pestanas={[
          {
            href: hrefDe({ suspendidos: false, acceso: corte, q: busqueda }),
            etiqueta: 'Activos',
            activa: !verSuspendidos,
            insignia: activos.length,
          },
          {
            href: hrefDe({ suspendidos: true, acceso: corte, q: busqueda }),
            etiqueta: 'Suspendidos',
            activa: verSuspendidos,
            insignia: suspendidos.length,
          },
        ]}
      />

      <nav aria-label="Filtrar por acceso" className="flex flex-wrap gap-2">
        {(Object.keys(ACCESOS) as Acceso[]).map((v) => {
          const activa = v === corte
          const cuenta =
            v === 'todos'
              ? pestana.length
              : v === 'nunca'
                ? pestana.filter((a) => !a.ultimoAcceso).length
                : pestana.filter((a) => a.ultimoAcceso).length
          return (
            <a
              key={v}
              href={hrefDe({ suspendidos: verSuspendidos, acceso: v, q: busqueda })}
              aria-current={activa ? 'page' : undefined}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                activa
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
              )}
            >
              {ACCESOS[v]}
              <span className="text-xs tabular-nums opacity-70">{cuenta}</span>
            </a>
          )
        })}
      </nav>

      {visibles.length === 0 ? (
        <Tarjeta className="border-dashed px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {busqueda
              ? `Nadie coincide con "${busqueda}"${verSuspendidos ? ' entre los suspendidos' : ''}.`
              : verSuspendidos
                ? 'Nadie está suspendido. Suspender una cuenta le corta el acceso sin borrar nada.'
                : corte === 'nunca'
                  ? 'Todos han entrado al menos una vez.'
                  : corte === 'entraron'
                    ? 'Nadie ha entrado todavía.'
                    : 'Todavía no hay nadie dado de alta.'}
          </p>
        </Tarjeta>
      ) : (
        <Tarjeta className="overflow-hidden">
          <ul>
            {visibles.map((alumno) => (
              <li key={alumno.userId}>
                <FilaAlumno
                  alumno={alumno}
                  cursos={cursos}
                  empresas={empresas}
                  // Nadie se suspende a sí mismo, y al equipo solo lo toca un
                  // superadmin. La acción vuelve a comprobar las dos cosas.
                  puedeSuspender={
                    alumno.userId !== perfil.user_id &&
                    (soySuperadmin || (alumno.rol !== 'admin' && alumno.rol !== 'superadmin'))
                  }
                />
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </div>
  )
}
