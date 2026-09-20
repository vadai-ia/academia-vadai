import type { Metadata } from 'next'

import { DarDeAlta } from '@/components/admin/dar-de-alta'
import { FilaAlumno } from '@/components/admin/fila-alumno'
import { ReenviarPendientes } from '@/components/admin/reenviar-pendientes'
import { Cifra, Tarjeta, Titulo } from '@/components/ui-vadai/superficie'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { alumnosPendientesDeEntrar } from '@/lib/admin/accesos'
import { listarAlumnos, listarPagos, opcionesDeAlta } from '@/lib/admin/alumnos'
import { exigirAdmin } from '@/lib/auth/sesion'
import { stripeConfigurado, stripeEnVivo } from '@/lib/stripe/cliente'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Alumnos' }
export const dynamic = 'force-dynamic'

/**
 * Los tres cortes del listado. Van en la URL (`?ver=nunca`) y no en estado de
 * React: funcionan sin JavaScript, se comparten y se vuelve con "atrás".
 */
const VISTAS = {
  todos: 'Todos',
  nunca: 'Nunca han entrado',
  entraron: 'Ya entraron',
} as const
type Vista = keyof typeof VISTAS

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
  searchParams: Promise<{ q?: string; ver?: string }>
}) {
  const perfil = await exigirAdmin()
  const { q, ver } = await searchParams
  const busqueda = (q ?? '').trim()
  const vista: Vista = ver === 'nunca' || ver === 'entraron' ? ver : 'todos'

  const [todos, pagos, cursos, pendientes] = await Promise.all([
    listarAlumnos(busqueda),
    listarPagos(),
    opcionesDeAlta(),
    alumnosPendientesDeEntrar(),
  ])

  // Un pago sin cuenta es el caso que §11 manda resolver a mano: el dinero
  // entró pero el alta no se completó.
  const huerfanos = pagos.filter((p) => !p.tieneCuenta && p.estado === 'paid')

  const conAcceso = todos.filter((a) => a.inscripciones.some((i) => i.vigente)).length
  const entraron = todos.filter((a) => a.ultimoAcceso).length
  const nunca = todos.length - entraron

  const alumnos =
    vista === 'nunca'
      ? todos.filter((a) => !a.ultimoAcceso)
      : vista === 'entraron'
        ? todos.filter((a) => a.ultimoAcceso)
        : todos

  const apoyo = busqueda
    ? `${alumnos.length} resultado${alumnos.length === 1 ? '' : 's'} para "${busqueda}"`
    : vista !== 'todos'
      ? `${alumnos.length} de ${todos.length}`
      : undefined

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
            <Cifra valor={todos.length} etiqueta="personas con perfil" />
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

      <DarDeAlta
        cursos={cursos}
        reinicio={alumnos.length}
        soySuperadmin={perfil.role === 'superadmin'}
      />

      {/*
        El buscador es un <form> GET, no un filtro en el cliente.

        Así funciona sin JavaScript, el resultado queda en la URL —se puede
        compartir y volver con el botón atrás— y el filtrado ocurre en el
        servidor, que es donde están los datos. Un filtro en el cliente además
        obligaría a mandar los 40 alumnos completos al navegador.
      */}
      <form method="get" className="flex flex-wrap items-end gap-2">
        {vista !== 'todos' ? <input type="hidden" name="ver" value={vista} /> : null}
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
        <Button type="submit" variant="outline">
          Buscar
        </Button>
        {busqueda ? (
          <Button asChild variant="ghost">
            <a href={vista === 'todos' ? '/admin/alumnos' : `/admin/alumnos?ver=${vista}`}>
              Limpiar
            </a>
          </Button>
        ) : null}
      </form>

      <nav aria-label="Filtrar por acceso" className="flex flex-wrap gap-2">
        {(Object.keys(VISTAS) as Vista[]).map((v) => {
          const activa = v === vista
          const href =
            (v === 'todos' ? '/admin/alumnos' : `/admin/alumnos?ver=${v}`) +
            (busqueda ? `${v === 'todos' ? '?' : '&'}q=${encodeURIComponent(busqueda)}` : '')
          const cuenta = v === 'todos' ? todos.length : v === 'nunca' ? nunca : entraron
          return (
            <a
              key={v}
              href={href}
              aria-current={activa ? 'page' : undefined}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                activa
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
              )}
            >
              {VISTAS[v]}
              <span className="text-xs tabular-nums opacity-70">{cuenta}</span>
            </a>
          )
        })}
      </nav>

      {alumnos.length === 0 ? (
        <Tarjeta className="border-dashed px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {busqueda
              ? `Nadie coincide con "${busqueda}".`
              : vista === 'nunca'
                ? 'Todos han entrado al menos una vez.'
                : vista === 'entraron'
                  ? 'Nadie ha entrado todavía.'
                  : 'Todavía no hay nadie dado de alta.'}
          </p>
        </Tarjeta>
      ) : (
        <Tarjeta className="overflow-hidden">
          <ul>
            {alumnos.map((alumno) => (
              <li key={alumno.userId}>
                <FilaAlumno alumno={alumno} />
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </div>
  )
}
