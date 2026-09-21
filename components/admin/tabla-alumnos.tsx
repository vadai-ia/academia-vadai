import Link from 'next/link'

import { Avatar, Progreso, Tarjeta } from '@/components/ui-vadai/superficie'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { reenviarAcceso } from '@/lib/admin/acciones-alumnos'
import type { AlumnoEnLista } from '@/lib/admin/alumnos'
import { fechaCorta } from '@/lib/admin/formato'

/**
 * La lista de alumnos como tabla (M14).
 *
 * Una fila dice lo que se busca al escanear —quién es, de dónde, si tiene
 * acceso, si ya entró— y "Ver ficha" abre todo lo demás en su propia página.
 * Antes cada fila era un <details> con cuatro secciones adentro; con 150
 * personas, abrir filas para encontrar algo no es navegar.
 *
 * En teléfono es la MISMA tabla apilada por CSS: cada celda pinta su etiqueta
 * desde `data-etiqueta` (`before:content-[attr(...)]`), sin duplicar el DOM.
 */

const celda =
  'px-4 py-3 align-top max-sm:flex max-sm:items-center max-sm:justify-between max-sm:gap-3 max-sm:px-4 max-sm:py-1 ' +
  'max-sm:before:text-xs max-sm:before:text-muted-foreground max-sm:before:content-[attr(data-etiqueta)]'

export function TablaAlumnos({ filas }: { filas: AlumnoEnLista[] }) {
  return (
    <Tarjeta className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm max-sm:block">
          <thead className="max-sm:sr-only">
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th scope="col" className="px-4 py-2.5 font-medium">Alumno</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Empresa</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Cursos</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Último acceso</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Estado</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className="max-sm:block">
            {filas.map((a) => {
              const equipo = a.rol === 'admin' || a.rol === 'superadmin'
              const vigentes = a.inscripciones.filter((i) => i.vigente).length
              const total = a.inscripciones.reduce((n, i) => n + i.total, 0)
              const hechas = a.inscripciones.reduce((n, i) => n + i.hechas, 0)
              const porcentaje = total === 0 ? 0 : Math.round((hechas / total) * 100)
              const ficha = `/admin/alumnos/${a.userId}`

              return (
                <tr key={a.userId} className="border-b border-border last:border-b-0 max-sm:block max-sm:py-3">
                  <td className="px-4 py-3 align-top max-sm:block max-sm:py-1">
                    <span className="flex items-center gap-3">
                      <Avatar nombre={a.nombre || a.email} tamano={34} />
                      <span className="flex min-w-0 flex-col">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <Link href={ficha} className="font-medium underline-offset-4 hover:underline">
                            {a.nombre || '(sin nombre)'}
                          </Link>
                          {equipo ? <Badge className="bg-vadai-lima text-[11px] text-vadai-navy">{a.rol}</Badge> : null}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">{a.email}</span>
                      </span>
                    </span>
                  </td>

                  <td data-etiqueta="Empresa" className={celda}>
                    <span className={a.empresa ? undefined : 'text-muted-foreground'}>
                      {a.empresa?.nombre ?? 'General'}
                    </span>
                  </td>

                  <td data-etiqueta="Cursos" className={celda}>
                    <span className="flex flex-col items-end gap-1 sm:items-start">
                      <span className="text-muted-foreground tabular-nums">
                        {a.inscripciones.length === 0
                          ? 'sin cursos'
                          : `${vigentes} de ${a.inscripciones.length} vigente${a.inscripciones.length === 1 ? '' : 's'}`}
                      </span>
                      {total > 0 ? (
                        <span className="w-24">
                          <Progreso porcentaje={porcentaje} etiqueta={`${porcentaje}% de avance`} />
                        </span>
                      ) : null}
                    </span>
                  </td>

                  <td data-etiqueta="Último acceso" className={celda}>
                    {a.ultimoAcceso ? (
                      <span className="tabular-nums">{fechaCorta(a.ultimoAcceso)}</span>
                    ) : equipo ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <Badge variant="outline" className="border-destructive/40 text-[11px] text-destructive">
                        Nunca ha entrado
                      </Badge>
                    )}
                  </td>

                  <td data-etiqueta="Estado" className={celda}>
                    {a.estado === 'active' ? (
                      <span className="text-muted-foreground">Activa</span>
                    ) : (
                      <Badge variant="outline" className="text-[11px]">
                        Suspendida
                      </Badge>
                    )}
                  </td>

                  <td className="px-4 py-3 align-top max-sm:block max-sm:pt-2">
                    <span className="flex flex-wrap items-center justify-end gap-1.5 max-sm:justify-start">
                      {!a.ultimoAcceso && !equipo && a.estado === 'active' ? (
                        <form action={reenviarAcceso}>
                          <input type="hidden" name="email" value={a.email} />
                          <Button type="submit" variant="ghost" size="sm">
                            Reenviar acceso
                          </Button>
                        </form>
                      ) : null}
                      <Button asChild variant="outline" size="sm">
                        <Link href={ficha}>Ver ficha</Link>
                      </Button>
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Tarjeta>
  )
}
