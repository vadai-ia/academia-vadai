import type { Metadata } from 'next'

import { DarDeAlta } from '@/components/admin/dar-de-alta'
import { FilaAlumno } from '@/components/admin/fila-alumno'
import { Cifra, Tarjeta, Titulo } from '@/components/ui-vadai/superficie'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

export default async function PaginaAlumnos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const perfil = await exigirAdmin()
  const { q } = await searchParams
  const busqueda = (q ?? '').trim()

  const [alumnos, pagos, cursos] = await Promise.all([
    listarAlumnos(busqueda),
    listarPagos(),
    opcionesDeAlta(),
  ])

  // Un pago sin cuenta es el caso que §11 manda resolver a mano: el dinero
  // entró pero el alta no se completó.
  const huerfanos = pagos.filter((p) => !p.tieneCuenta && p.estado === 'paid')

  const conAcceso = alumnos.filter((a) => a.inscripciones.some((i) => i.vigente)).length
  const equipo = alumnos.filter((a) => a.rol !== 'alumno').length

  return (
    <div className="flex flex-col gap-8">
      <Titulo
        apoyo={
          busqueda
            ? `${alumnos.length} resultado${alumnos.length === 1 ? '' : 's'} para "${busqueda}"`
            : undefined
        }
      >
        Alumnos
      </Titulo>

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
        <Tarjeta className="p-5">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Cifra valor={alumnos.length} etiqueta="personas con perfil" />
            <Cifra valor={conAcceso} etiqueta="con acceso vigente" destacada />
            <Cifra valor={equipo} etiqueta="del equipo" />
            <Cifra valor={pagos.length} etiqueta="pagos registrados" />
          </div>
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
            <a href="/admin/alumnos">Limpiar</a>
          </Button>
        ) : null}
      </form>

      {alumnos.length === 0 ? (
        <Tarjeta className="border-dashed px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {busqueda
              ? `Nadie coincide con "${busqueda}".`
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
