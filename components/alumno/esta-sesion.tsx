import Link from 'next/link'

import type { CursoDelAlumno, ModuloEnIndice } from '@/lib/alumno/consultas'
import { cn } from '@/lib/utils'

import { RenglonDeLeccion } from './indice-curso'

/**
 * La columna de la lección: SOLO la sesión en la que estás (25-sep-2026).
 *
 * Antes iba el índice completo del curso, con sus dieciséis módulos plegados,
 * pegado a la derecha del video. Alejandro: "el hecho de que se vean todas las
 * sesiones y módulos a la derecha no hace sentido". Tenía razón: dentro de una
 * lección lo que hace falta saber es qué más hay en ESTA sesión y cómo se pasa
 * a la siguiente; el mapa completo ya vive en la pestaña Contenido.
 *
 * Por eso son tres cosas y nada más: las lecciones de la sesión con su estado,
 * los enlaces a la sesión anterior y la siguiente, y la vuelta al contenido.
 */
export function EstaSesion({
  curso,
  modulo,
  leccionActiva,
  className,
}: {
  curso: CursoDelAlumno
  modulo: ModuloEnIndice
  leccionActiva: string
  className?: string
}) {
  const indice = curso.modulos.findIndex((m) => m.id === modulo.id)
  const anterior = indice > 0 ? curso.modulos[indice - 1] : null
  const siguiente =
    indice >= 0 && indice < curso.modulos.length - 1 ? curso.modulos[indice + 1] : null
  const hechas = modulo.lecciones.filter((l) => l.completada).length

  // A dónde lleva "la otra sesión": a su primera lección abierta; si no tiene
  // ninguna, al contenido del curso, que la enseña con candado o vacía.
  const destinoDe = (m: ModuloEnIndice) => {
    const primera = m.lecciones.find((l) => l.desbloqueada)
    return primera ? `/curso/${curso.slug}/${primera.id}` : `/curso/${curso.slug}`
  }

  return (
    <section aria-labelledby="esta-sesion" className={cn('flex flex-col gap-2', className)}>
      <div className="overflow-hidden rounded-[10px] border border-border bg-card">
        <div className="flex items-baseline justify-between gap-3 border-b border-border px-3 py-2.5">
          <h2 id="esta-sesion" className="min-w-0 truncate text-sm font-medium">
            {modulo.titulo}
          </h2>
          <span className="shrink-0 text-xs font-medium text-primary tabular-nums">
            {hechas} de {modulo.lecciones.length}
          </span>
        </div>

        <ul className="flex flex-col">
          {modulo.lecciones.map((leccion) => (
            <li key={leccion.id}>
              <RenglonDeLeccion
                leccion={leccion}
                cursoSlug={curso.slug}
                activa={leccion.id === leccionActiva}
                compacto
              />
            </li>
          ))}
        </ul>

        {anterior || siguiente ? (
          <nav
            aria-label="Sesión anterior y siguiente"
            className="grid grid-cols-2 gap-3 border-t border-border px-3 py-2.5 text-sm"
          >
            {/* La flecha va fuera del `truncate`: si el título no cabe, se
                recorta el título, nunca la flecha que dice hacia dónde va. */}
            {anterior ? (
              <Link
                href={destinoDe(anterior)}
                title={anterior.titulo}
                className="flex min-w-0 items-center gap-1.5 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                <span aria-hidden className="shrink-0">
                  ←
                </span>
                <span className="truncate">{anterior.titulo}</span>
              </Link>
            ) : (
              <span />
            )}
            {siguiente ? (
              <Link
                href={destinoDe(siguiente)}
                title={siguiente.titulo}
                className="flex min-w-0 items-center justify-end gap-1.5 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                <span className="truncate">{siguiente.titulo}</span>
                <span aria-hidden className="shrink-0">
                  →
                </span>
              </Link>
            ) : null}
          </nav>
        ) : null}
      </div>

      <Link
        href={`/curso/${curso.slug}`}
        className="w-fit text-sm text-primary underline-offset-4 hover:underline"
      >
        Ver todo el contenido <span aria-hidden>→</span>
      </Link>
    </section>
  )
}
