import type { Metadata } from 'next'
import Link from 'next/link'

import { AutoEnviar } from '@/components/ui-vadai/auto-enviar'
import { Cifra, Tarjeta, Titulo } from '@/components/ui-vadai/superficie'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { exigirEquipo } from '@/lib/auth/sesion'
import { tablaDeDiplomas, type EstadoDiploma, type FiltrosDiplomas } from '@/lib/diplomas/admin'
import { PROGRAMAS, yaVisible } from '@/lib/diplomas/programas'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Certificaciones' }
export const dynamic = 'force-dynamic'

const fecha = (iso: string) =>
  new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Mexico_City',
  }).format(new Date(iso))

const ESTADOS: { valor: EstadoDiploma; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'sin-abrir', etiqueta: 'Sin abrir' },
  { valor: 'abiertos', etiqueta: 'Ya lo abrieron' },
  { valor: 'descargados', etiqueta: 'Ya lo descargaron' },
]

/**
 * El control de diplomas (15-oct-2026): por generación, quién ya lo abrió y
 * quién ya lo descargó, y la búsqueda de una persona o un folio cuando alguien
 * lo pide. Todo filtro es un <form method="get">: funciona sin JavaScript y el
 * resultado queda en la URL.
 */
export default async function PaginaCertificaciones({ searchParams }: { searchParams: Promise<FiltrosDiplomas> }) {
  await exigirEquipo()
  const t = await tablaDeDiplomas(await searchParams)
  if (!t) return <Titulo ceja="Cursos">Certificaciones</Titulo>
  const { programa, filas, cifras, filtros } = t

  const hrefDe = (cambios: { gen?: string; estado?: EstadoDiploma }) => {
    const p = new URLSearchParams()
    const gen = cambios.gen ?? programa.clave
    if (gen !== PROGRAMAS[0]?.clave) p.set('gen', gen)
    const estado = cambios.estado ?? filtros.estado
    if (estado !== 'todos') p.set('estado', estado)
    if (filtros.q && !cambios.gen) p.set('q', filtros.q)
    const cadena = p.toString()
    return cadena ? `/admin/certificaciones?${cadena}` : '/admin/certificaciones'
  }

  return (
    <div className="flex flex-col gap-8">
      <Titulo ceja="Cursos" apoyo="Los diplomas de generación de VADAI y Total Coach: quién ya lo abrió, quién ya lo descargó y el folio de cada uno.">
        Certificaciones
      </Titulo>

      {PROGRAMAS.length > 1 ? (
        <nav className="flex flex-wrap gap-2" aria-label="Generaciones">
          {PROGRAMAS.map((p) => (
            <Link
              key={p.clave}
              href={hrefDe({ gen: p.clave, estado: 'todos' })}
              aria-current={p.clave === programa.clave ? 'page' : undefined}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                p.clave === programa.clave ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'
              )}
            >
              {p.curso} · {p.generacion}
            </Link>
          ))}
        </nav>
      ) : null}

      <Tarjeta className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <p className="font-medium">
            {programa.curso} · {programa.generacion}
          </p>
          <p className="text-sm text-muted-foreground">
            {yaVisible(programa)
              ? `Visible para los alumnos desde el ${fecha(programa.visibleDesde)}`
              : `Los alumnos lo ven a partir del ${fecha(programa.visibleDesde)}`}
            {' · '}
            Se cuenta cada clic en «Abrir mi diploma» y en «Descargar en PDF» desde que existe este registro.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Cifra valor={cifras.total} etiqueta="tienen diploma" />
          <Cifra valor={cifras.abiertos} etiqueta="ya lo abrieron" destacada />
          <Cifra valor={cifras.descargados} etiqueta="ya lo descargaron" />
          <Cifra valor={cifras.sinAbrir} etiqueta="todavía no lo abren" />
        </div>
      </Tarjeta>

      <form method="get" className="flex flex-wrap items-end gap-2">
        {programa.clave !== PROGRAMAS[0]?.clave ? <input type="hidden" name="gen" value={programa.clave} /> : null}
        {filtros.estado !== 'todos' ? <input type="hidden" name="estado" value={filtros.estado} /> : null}
        <label className="flex min-w-56 flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium">Buscar</span>
          <Input
            type="search"
            name="q"
            defaultValue={filtros.q}
            placeholder="Nombre, correo, empresa o folio"
            autoComplete="off"
            className="h-10"
          />
        </label>
        <Button type="submit" size="lg" data-aplicar>
          Buscar
        </Button>
        <AutoEnviar />
        {filtros.q || filtros.estado !== 'todos' ? (
          <Button asChild variant="ghost" size="lg">
            <a href={hrefDe({ gen: programa.clave, estado: 'todos' })}>Limpiar</a>
          </Button>
        ) : null}
      </form>

      <div className="flex flex-wrap gap-2">
        {ESTADOS.map((e) => (
          <Link
            key={e.valor}
            href={hrefDe({ estado: e.valor })}
            aria-current={filtros.estado === e.valor ? 'true' : undefined}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors',
              filtros.estado === e.valor ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-border hover:border-primary/50'
            )}
          >
            {e.etiqueta}
          </Link>
        ))}
      </div>

      {filas.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
          Nadie coincide con esa búsqueda.
        </p>
      ) : (
        <div className="relative overflow-x-auto rounded-[10px] border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Alumno</th>
                <th className="px-4 py-2.5 font-medium">Empresa</th>
                <th className="px-4 py-2.5 font-medium">Folio</th>
                <th className="px-4 py-2.5 font-medium">Abierto</th>
                <th className="px-4 py-2.5 font-medium">Descargado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filas.map((f) => (
                <tr key={f.userId}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/alumnos/${f.userId}`} className="font-medium hover:text-primary">
                      {f.nombre}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{f.correo}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{f.empresa ?? 'General'}</td>
                  <td className="px-4 py-3">
                    <a
                      href={`/diploma/${f.folio}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs whitespace-nowrap text-primary hover:underline"
                    >
                      {f.folio}
                    </a>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {f.abiertoPrimero ? (
                      <>
                        <span className="inline-flex rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                          Sí · {f.aperturas} {f.aperturas === 1 ? 'vez' : 'veces'}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {fecha(f.abiertoPrimero)}
                          {f.abiertoUltimo && f.abiertoUltimo !== f.abiertoPrimero ? ` · última ${fecha(f.abiertoUltimo)}` : ''}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Todavía no</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {f.descargadoPrimero ? (
                      <>
                        <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          Sí · {f.descargas} {f.descargas === 1 ? 'vez' : 'veces'}
                        </span>
                        <span className="block text-xs text-muted-foreground">{fecha(f.descargadoPrimero)}</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Todavía no</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {filas.length} de {cifras.total} alumnos. El folio abre la verificación pública, la misma que ve quien recibe el diploma.
      </p>
    </div>
  )
}
