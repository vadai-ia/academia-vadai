import type { Metadata } from 'next'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { DarDeAlta } from '@/components/admin/dar-de-alta'
import { claseSelect } from '@/components/admin/estilos'
import { Paginacion } from '@/components/admin/paginacion'
import { ReenviarPendientes } from '@/components/admin/reenviar-pendientes'
import { TablaAlumnos } from '@/components/admin/tabla-alumnos'
import { Pestanas } from '@/components/ui-vadai/pestanas'
import { Cifra, Tarjeta, Titulo } from '@/components/ui-vadai/superficie'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { alumnosPendientesDeEntrar } from '@/lib/admin/accesos'
import {
  conteosDeAlumnos,
  listarAlumnos,
  listarPagos,
  opcionesDeAlta,
  resumenDeAlumnos,
  type CorteDeAcceso,
} from '@/lib/admin/alumnos'
import { listarEmpresas } from '@/lib/admin/empresas'
import { fechaCorta } from '@/lib/admin/formato'
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
 * Todo lo que acota la lista va en la URL —funciona sin JavaScript, se
 * comparte y se vuelve con "atrás"—:
 *
 *   `?q=`               nombre, correo o empresa.
 *   `?empresa=`         una empresa, o `general` (sin empresa).
 *   `?ver=suspendidos`  la pestaña de cuentas: activas o suspendidas.
 *   `?acceso=nunca`     el corte por acceso dentro de esa pestaña: quién ya
 *                       entró y quién no. Es la pregunta de la mañana de un
 *                       lanzamiento.
 *   `?pagina=`          de 25 en 25 (M14).
 */
const ACCESOS = {
  todos: 'Todos',
  nunca: 'Nunca han entrado',
  entraron: 'Ya entraron',
} as const

type Parametros = {
  q?: string
  ver?: string
  acceso?: string
  empresa?: string
  pagina?: string
  aviso?: string
  correo?: string
}

export default async function PaginaAlumnos({ searchParams }: { searchParams: Promise<Parametros> }) {
  const perfil = await exigirAdmin()
  const { q, ver, acceso, empresa, pagina, aviso, correo } = await searchParams
  const busqueda = (q ?? '').trim()
  const verSuspendidos = ver === 'suspendidos'
  const corte: CorteDeAcceso = acceso === 'nunca' || acceso === 'entraron' ? acceso : 'todos'
  const empresaFiltro = (empresa ?? '').trim()
  const paginaPedida = Math.max(1, Number.parseInt(pagina ?? '1', 10) || 1)

  // Las cifras y el recordatorio solo se pintan —y solo se consultan— en la
  // primera página sin filtros: es la vista de "cómo vamos", no la de buscar.
  const sinFiltros = paginaPedida === 1 && !busqueda && !empresaFiltro && corte === 'todos' && !verSuspendidos

  const [lista, conteos, cursos, empresas, resumen, pendientes, pagos] = await Promise.all([
    listarAlumnos({
      q: busqueda,
      empresa: empresaFiltro,
      ver: verSuspendidos ? 'suspendidos' : 'activos',
      acceso: corte,
      pagina: paginaPedida,
    }),
    conteosDeAlumnos({ q: busqueda, empresa: empresaFiltro }),
    opcionesDeAlta(),
    listarEmpresas(),
    sinFiltros ? resumenDeAlumnos() : null,
    sinFiltros ? alumnosPendientesDeEntrar() : null,
    sinFiltros ? listarPagos() : null,
  ])

  // Un pago sin cuenta es el caso que §11 manda resolver a mano: el dinero
  // entró pero el alta no se completó. Una cuenta eliminada a propósito no lo es.
  const huerfanos = (pagos ?? []).filter((p) => !p.tieneCuenta && !p.cuentaEliminada && p.estado === 'paid')

  // Los filtros se conservan entre sí: cambiar de pestaña no pierde la
  // búsqueda, y buscar no pierde la pestaña ni el corte. Cambiar cualquiera
  // vuelve a la página 1.
  const hrefDe = (cambios: { suspendidos?: boolean; acceso?: CorteDeAcceso; pagina?: number }) => {
    const parametros = new URLSearchParams()
    if (busqueda) parametros.set('q', busqueda)
    if (empresaFiltro) parametros.set('empresa', empresaFiltro)
    if (cambios.suspendidos ?? verSuspendidos) parametros.set('ver', 'suspendidos')
    const corteFinal = cambios.acceso ?? corte
    if (corteFinal !== 'todos') parametros.set('acceso', corteFinal)
    if ((cambios.pagina ?? 1) > 1) parametros.set('pagina', String(cambios.pagina))
    const cadena = parametros.toString()
    return cadena ? `/admin/alumnos?${cadena}` : '/admin/alumnos'
  }

  const enPestana = verSuspendidos ? conteos.suspendidos : conteos.activos
  const cuentaDelCorte: Record<CorteDeAcceso, number | null> = {
    todos: enPestana,
    // El corte por acceso se cuenta sobre las cuentas activas: una suspendida
    // no puede entrar, y contarla como pendiente mandaría un correo a quien se cortó.
    nunca: verSuspendidos ? null : conteos.nunca,
    entraron: verSuspendidos ? null : conteos.entraron,
  }

  const apoyo =
    busqueda || empresaFiltro || corte !== 'todos'
      ? `${lista.total} ${lista.total === 1 ? 'persona' : 'personas'} en esta vista`
      : `${conteos.activos} con cuenta`

  const soySuperadmin = perfil.role === 'superadmin'

  return (
    <div className="flex flex-col gap-8">
      <Titulo apoyo={apoyo}>Alumnos</Titulo>

      {aviso === 'eliminado' && correo ? (
        <AvisoAccion estado={{ aviso: `La cuenta de ${correo} se eliminó. Sus pagos, si los había, siguen en Ingresos.` }} />
      ) : null}

      {/*
        El buscador va ARRIBA DE TODO (M14) y es un <form> GET, no un filtro en
        el cliente: funciona sin JavaScript, el resultado queda en la URL y el
        filtrado ocurre en Postgres, que es donde están los datos.
      */}
      <form method="get" className="flex flex-wrap items-end gap-2">
        {verSuspendidos ? <input type="hidden" name="ver" value="suspendidos" /> : null}
        {corte !== 'todos' ? <input type="hidden" name="acceso" value={corte} /> : null}
        <label className="flex min-w-64 flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium">Buscar</span>
          <Input
            type="search"
            name="q"
            defaultValue={busqueda}
            placeholder="Buscar por nombre, correo o empresa"
            autoComplete="off"
            className="h-10"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Empresa</span>
          <select name="empresa" defaultValue={empresaFiltro} className={cn(claseSelect, 'h-10 w-auto')}>
            <option value="">Todas</option>
            <option value="general">General (sin empresa)</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre} ({e.alumnos})
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" size="lg">
          Buscar
        </Button>
        {busqueda || empresaFiltro ? (
          <Button asChild variant="ghost" size="lg">
            <a href={verSuspendidos ? '/admin/alumnos?ver=suspendidos' : '/admin/alumnos'}>Limpiar</a>
          </Button>
        ) : null}
      </form>

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
                  {p.cursoTitulo} · {fechaCorta(p.fecha)}
                </span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      ) : null}

      {resumen && pendientes ? (
        <Tarjeta className="flex flex-col gap-5 p-5">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-5">
            <Cifra valor={resumen.personas} etiqueta="personas con cuenta" />
            <Cifra valor={resumen.conAccesoVigente} etiqueta="con acceso vigente" />
            <Cifra valor={resumen.entraron} etiqueta="ya entraron" destacada />
            <Cifra valor={resumen.nunca} etiqueta="nunca han entrado" />
            <Cifra valor={resumen.pagos} etiqueta="pagos registrados" />
          </div>

          {/*
            Lo que se hace con el número de arriba. "Nunca han entrado" sin un
            botón al lado es una cifra que da ansiedad y no resuelve nada.
          */}
          <ReenviarPendientes pendientes={pendientes.length} correoAdmin={perfil.email} />
        </Tarjeta>
      ) : null}

      <DarDeAlta cursos={cursos} empresas={empresas} reinicio={lista.total} soySuperadmin={soySuperadmin} />

      <div className="flex flex-col gap-4">
        <Pestanas
          etiqueta="Filtro de cuentas"
          pestanas={[
            {
              href: hrefDe({ suspendidos: false }),
              etiqueta: 'Activos',
              activa: !verSuspendidos,
              insignia: conteos.activos,
            },
            {
              href: hrefDe({ suspendidos: true }),
              etiqueta: 'Suspendidos',
              activa: verSuspendidos,
              insignia: conteos.suspendidos,
            },
          ]}
        />

        {!verSuspendidos ? (
          <nav aria-label="Filtrar por acceso" className="flex flex-wrap gap-2">
            {(Object.keys(ACCESOS) as CorteDeAcceso[]).map((v) => {
              const activa = v === corte
              return (
                <a
                  key={v}
                  href={hrefDe({ acceso: v })}
                  aria-current={activa ? 'page' : undefined}
                  data-slot="pastilla"
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                    activa
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                  )}
                >
                  {ACCESOS[v]}
                  {cuentaDelCorte[v] !== null ? (
                    <span className="text-xs tabular-nums opacity-70">{cuentaDelCorte[v]}</span>
                  ) : null}
                </a>
              )
            })}
          </nav>
        ) : null}

        {lista.filas.length === 0 ? (
          <Tarjeta className="border-dashed px-5 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {busqueda
                ? `Nadie coincide con "${busqueda}"${verSuspendidos ? ' entre los suspendidos' : ''}.`
                : empresaFiltro
                  ? 'Nadie con esa empresa en esta vista.'
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
          <TablaAlumnos filas={lista.filas} />
        )}

        <Paginacion
          pagina={lista.pagina}
          paginas={lista.paginas}
          total={lista.total}
          porPagina={lista.porPagina}
          hrefDe={(p) => hrefDe({ pagina: p })}
        />
      </div>
    </div>
  )
}
