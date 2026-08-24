import Link from 'next/link'
import type { ReactNode } from 'react'

import type { CursoDelAlumno, LeccionEnIndice } from '@/lib/alumno/consultas'
import { cn } from '@/lib/utils'

/**
 * Índice del curso, con el tratamiento de módulos de Skool.
 *
 * Cada módulo es una tarjeta con su propio contador de avance, y las lecciones
 * son renglones altos con estado a la izquierda. La diferencia con la lista
 * plana anterior es de orientación: en un curso de cinco módulos, saber que vas
 * 3 de 4 en el segundo es la información que hace decidir si seguir hoy o no.
 *
 * Los iconos son SVG. Antes eran glifos de texto —▶ ¶ ? ✎ 🔒— y eso tiene el
 * mismo problema que un emoji: cada sistema los dibuja con otro grosor y otra
 * altura, no heredan bien el color y no se pueden alinear con el texto.
 *
 * Sale de `lesson_outline`, así que el alumno con acceso vencido ve los títulos
 * igual, solo que con candado y sin enlace. Es lo que pide §3.3 y lo que
 * sostiene el CTA de recompra de §6.3.
 */

function duracionLegible(segundos: number | null): string {
  if (!segundos || segundos <= 0) return ''
  return `${Math.round(segundos / 60)} min`
}

export function IndiceCurso({
  curso,
  leccionActiva,
  compacto = false,
}: {
  curso: CursoDelAlumno
  leccionActiva?: string
  /** Para la barra lateral de la lección: sin tarjeta ni contadores. */
  compacto?: boolean
}) {
  return (
    <nav aria-label="Contenido del curso" className={cn('flex flex-col', compacto ? 'gap-5' : 'gap-3')}>
      {curso.modulos.map((modulo, i) => {
        const hechas = modulo.lecciones.filter((l) => l.completada).length
        const total = modulo.lecciones.length

        return (
          <div
            key={modulo.id}
            className={cn(
              'flex flex-col',
              compacto ? 'gap-1.5' : 'overflow-hidden rounded-[10px] border border-border bg-card'
            )}
          >
            <div
              className={cn(
                'flex items-baseline justify-between gap-3',
                compacto ? 'px-2' : 'border-b border-border px-4 py-3'
              )}
            >
              <h3 className="flex min-w-0 items-baseline gap-2.5">
                <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className={cn('truncate font-medium', compacto && 'text-sm')}>
                  {modulo.titulo}
                </span>
              </h3>

              {total > 0 && !compacto ? (
                <span
                  className={cn(
                    'shrink-0 text-xs tabular-nums',
                    hechas === total ? 'font-medium text-exito' : 'text-muted-foreground'
                  )}
                >
                  {hechas}/{total}
                </span>
              ) : null}
            </div>

            {total === 0 ? (
              <p className={cn('text-xs text-muted-foreground', compacto ? 'px-2' : 'px-4 py-4')}>
                Este módulo todavía no tiene lecciones.
              </p>
            ) : (
              <ul className={cn('flex flex-col', !compacto && 'divide-y divide-border')}>
                {modulo.lecciones.map((leccion) => (
                  <li key={leccion.id}>
                    <Renglon
                      leccion={leccion}
                      cursoSlug={curso.slug}
                      activa={leccion.id === leccionActiva}
                      compacto={compacto}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </nav>
  )
}

function Renglon({
  leccion,
  cursoSlug,
  activa,
  compacto,
}: {
  leccion: LeccionEnIndice
  cursoSlug: string
  activa: boolean
  compacto: boolean
}) {
  const clases = cn(
    'flex w-full items-center gap-3 text-left transition-colors',
    compacto ? 'rounded-md px-2 py-2 text-sm' : 'px-4 py-3',
    activa && 'bg-primary/10 text-foreground',
    !leccion.desbloqueada && 'cursor-not-allowed opacity-60'
  )

  const contenido = (
    <>
      <Estado leccion={leccion} />

      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn('truncate', activa && 'font-medium')}>{leccion.titulo}</span>
        {!compacto && !leccion.obligatoria ? (
          <span className="text-xs text-muted-foreground">Opcional</span>
        ) : null}
      </span>

      {leccion.desbloqueada ? (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {duracionLegible(leccion.duracionSeg)}
        </span>
      ) : (
        <Candado />
      )}
    </>
  )

  if (!leccion.desbloqueada) {
    return (
      <span className={clases} title="Tu acceso venció" aria-label={`${leccion.titulo}, bloqueada`}>
        {contenido}
      </span>
    )
  }

  return (
    <Link
      href={`/curso/${cursoSlug}/${leccion.id}`}
      className={cn(clases, !activa && 'hover:bg-muted/60')}
      aria-current={activa ? 'page' : undefined}
    >
      {contenido}
    </Link>
  )
}

/**
 * Estado de la lección: completada, o el tipo de contenido que es.
 *
 * La palomita no viaja sola: el color verde no puede ser lo único que distinga
 * una lección hecha de una pendiente, porque hay gente que no ve esa diferencia.
 * La FORMA cambia también — círculo relleno con palomita contra círculo vacío
 * con el icono del tipo.
 */
function Estado({ leccion }: { leccion: LeccionEnIndice }) {
  if (leccion.completada) {
    return (
      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-exito/15 text-exito"
        aria-label="Completada"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden>
          <path d="m5 13 4 4L19 7" />
        </svg>
      </span>
    )
  }

  return (
    <span
      className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground"
      aria-hidden
    >
      <IconoTipo tipo={leccion.tipo} />
    </span>
  )
}

function marco(hijos: ReactNode, relleno = false) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={relleno ? 'currentColor' : 'none'}
      stroke={relleno ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3"
      aria-hidden
    >
      {hijos}
    </svg>
  )
}

function IconoTipo({ tipo }: { tipo: string }) {
  if (tipo === 'video') return marco(<path d="M8 5v14l11-7z" />, true)
  if (tipo === 'quiz') {
    return marco(
      <>
        <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
      </>
    )
  }
  if (tipo === 'assignment') {
    return marco(
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </>
    )
  }
  return marco(
    <>
      <path d="M4 6h16M4 12h16M4 18h10" />
    </>
  )
}

function Candado() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5 shrink-0 text-muted-foreground"
      aria-label="Bloqueada"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}
