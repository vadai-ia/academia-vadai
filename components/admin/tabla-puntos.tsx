import Link from 'next/link'

import { Avatar, Progreso, Tarjeta } from '@/components/ui-vadai/superficie'
import { fechaCorta } from '@/lib/admin/formato'
import type { AlumnoEnPuntos } from '@/lib/admin/puntos'
import { cn } from '@/lib/utils'

/**
 * La tabla del ranking: cada alumno con su lugar, nivel, puntos y de dónde
 * salen (26-sep-2026). Sirve al panel (el top 25, dentro de un <details>) y a
 * /admin/puntos (la completa, con filtros y páginas).
 *
 * Sin correos: el panel se proyecta en sala. El nombre lleva a la ficha, que
 * sí los tiene.
 *
 * En teléfono es la MISMA tabla apilada por CSS, como la de Alumnos: cada
 * celda pinta su etiqueta desde `data-etiqueta`, sin duplicar el DOM.
 */

const celda =
  'px-2.5 py-3 align-middle tabular-nums max-sm:flex max-sm:items-center max-sm:justify-between max-sm:gap-3 max-sm:px-4 max-sm:py-1 ' +
  'max-sm:before:text-xs max-sm:before:text-muted-foreground max-sm:before:content-[attr(data-etiqueta)]'

const encabezado = 'px-2.5 py-2.5 font-medium whitespace-nowrap'

/** El lugar: 1 en lima, 2 y 3 con tono; el resto, número llano. */
export function DiscoDeLugar({ posicion, grande = false }: { posicion: number; grande?: boolean }) {
  return (
    <span
      aria-label={`Lugar ${posicion}`}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-medium tabular-nums',
        grande ? 'size-9 text-base' : 'size-7 text-sm',
        posicion === 1
          ? 'bg-accent text-accent-foreground'
          : posicion <= 3
            ? 'bg-primary/15 text-primary'
            : 'text-muted-foreground'
      )}
    >
      {posicion}
    </span>
  )
}

/**
 * La actividad en una línea, para el teléfono: "7 com. · 2 pub. · 1 certif.".
 * Solo lo que no es cero; sin nada, "Sin actividad todavía".
 */
function ActividadEnLinea({ a }: { a: AlumnoEnPuntos['actividad'] }) {
  const partes = [
    [a.quizzes, 'quiz', 'quizzes'],
    [a.tareas, 'tarea', 'tareas'],
    [a.comentarios, 'com.', 'com.'],
    [a.publicaciones, 'pub.', 'pub.'],
    [a.dinamicas, 'dinámica', 'dinámicas'],
    [a.certificados, 'certif.', 'certif.'],
  ] as const
  const texto = partes
    .filter(([n]) => n > 0)
    .map(([n, uno, varios]) => `${n} ${n === 1 ? uno : varios}`)
    .join(' · ')
  return <span className={cn('text-right', !texto && 'text-muted-foreground')}>{texto || 'Sin actividad todavía'}</span>
}

/** Dos números en una celda: "3 · 1 aprob." sin que el cero grite. */
function Par({ uno, dos, etiquetaDos }: { uno: number; dos: number; etiquetaDos: string }) {
  return (
    <span className={cn(uno === 0 && dos === 0 && 'text-muted-foreground')}>
      {uno}
      {dos > 0 ? <span className="text-xs text-muted-foreground"> · {dos} {etiquetaDos}</span> : null}
    </span>
  )
}

export function TablaPuntos({ filas }: { filas: AlumnoEnPuntos[] }) {
  return (
    <Tarjeta className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[62rem] text-sm max-sm:block max-sm:min-w-0">
          <thead className="max-sm:sr-only">
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th scope="col" className={cn(encabezado, 'w-12 text-center')}>#</th>
              <th scope="col" className={encabezado}>Alumno</th>
              <th scope="col" className={encabezado}>Nivel</th>
              <th scope="col" className={cn(encabezado, 'text-right')}>Puntos</th>
              <th scope="col" className={encabezado}>Avance</th>
              <th scope="col" className={cn(encabezado, 'text-right')}>Quizzes</th>
              <th scope="col" className={cn(encabezado, 'text-right')}>Tareas</th>
              <th scope="col" className={cn(encabezado, 'text-right')} title="Comentarios · publicaciones">
                Comunidad
              </th>
              <th scope="col" className={cn(encabezado, 'text-right')} title="Dinámicas terminadas con su empresa">
                Dinám.
              </th>
              <th scope="col" className={cn(encabezado, 'text-right')}>Certif.</th>
              <th scope="col" className={encabezado}>Últ. acceso</th>
            </tr>
          </thead>
          <tbody className="max-sm:block">
            {filas.map((a) => (
              <tr key={a.userId} className="border-b border-border last:border-b-0 max-sm:block max-sm:py-3">
                <td className="px-2.5 py-3 text-center align-middle max-sm:hidden">
                  <span className="flex justify-center">
                    <DiscoDeLugar posicion={a.posicion} />
                  </span>
                </td>

                <td className="max-w-60 px-2.5 py-3 align-middle max-sm:block max-sm:max-w-none max-sm:px-4 max-sm:py-1">
                  <span className="flex items-center gap-3">
                    <span className="sm:hidden">
                      <DiscoDeLugar posicion={a.posicion} />
                    </span>
                    <Avatar nombre={a.nombre} tamano={32} />
                    <span className="flex min-w-0 flex-col">
                      <Link
                        href={`/admin/alumnos/${a.userId}`}
                        className="truncate font-medium underline-offset-4 hover:underline"
                      >
                        {a.nombre}
                      </Link>
                      <span className="truncate text-xs text-muted-foreground">
                        {a.empresa?.nombre ?? 'General'}
                      </span>
                    </span>
                  </span>
                </td>

                <td data-etiqueta="Nivel" className={celda}>
                  <span className="flex flex-col items-end gap-0.5 sm:items-start">
                    <span className="inline-flex w-fit items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-primary">
                      {a.nivel.numero} · {a.nivel.nombre}
                    </span>
                    {a.nivel.siguiente ? (
                      <span className="text-xs whitespace-nowrap text-muted-foreground">
                        faltan {a.nivel.faltan} para {a.nivel.siguiente.nombre}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">nivel máximo</span>
                    )}
                  </span>
                </td>

                <td data-etiqueta="Puntos" className={cn(celda, 'text-right')}>
                  <span className={cn('text-base font-medium', a.puntos > 0 ? 'text-primary' : 'text-muted-foreground')}>
                    {a.puntos}
                  </span>
                </td>

                <td data-etiqueta="Avance" className={celda}>
                  <span className="flex min-w-28 flex-col items-end gap-1 sm:items-stretch">
                    <span className="text-xs whitespace-nowrap text-muted-foreground">
                      <span className="font-medium text-foreground">{a.porcentaje}%</span> · {a.hechas} de {a.total}
                    </span>
                    <span className="w-24 sm:w-full">
                      <Progreso porcentaje={a.porcentaje} etiqueta={`${a.porcentaje}% de avance`} />
                    </span>
                  </span>
                </td>

                <td data-etiqueta="Actividad" className={cn(celda, 'sm:hidden')}>
                  <ActividadEnLinea a={a.actividad} />
                </td>

                <td data-etiqueta="Quizzes" className={cn(celda, 'text-right max-sm:hidden')}>
                  <span className={cn(a.actividad.quizzes === 0 && 'text-muted-foreground')}>{a.actividad.quizzes}</span>
                </td>

                <td data-etiqueta="Tareas" className={cn(celda, 'text-right max-sm:hidden')}>
                  <Par uno={a.actividad.tareas} dos={a.actividad.tareasAprobadas} etiquetaDos="aprob." />
                </td>

                <td data-etiqueta="Comunidad" className={cn(celda, 'text-right max-sm:hidden')}>
                  <Par uno={a.actividad.comentarios} dos={a.actividad.publicaciones} etiquetaDos="pub." />
                </td>

                <td data-etiqueta="Dinámicas" className={cn(celda, 'text-right max-sm:hidden')}>
                  <span className={cn(a.actividad.dinamicas === 0 && 'text-muted-foreground')}>{a.actividad.dinamicas}</span>
                </td>

                <td data-etiqueta="Certificados" className={cn(celda, 'text-right max-sm:hidden')}>
                  {a.actividad.certificados > 0 ? (
                    <span className="inline-flex rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                      {a.actividad.certificados}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </td>

                <td data-etiqueta="Último acceso" className={cn(celda, 'whitespace-nowrap')}>
                  {a.ultimoAcceso ? (
                    fechaCorta(a.ultimoAcceso)
                  ) : (
                    <span className="text-muted-foreground">Nunca</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Tarjeta>
  )
}
