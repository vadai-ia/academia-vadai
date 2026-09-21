import Link from 'next/link'
import type { ReactNode } from 'react'

import type { CursoDelAlumno, LeccionEnIndice, ModuloEnIndice } from '@/lib/alumno/consultas'
import { cn } from '@/lib/utils'

/**
 * Índice del curso, con el tratamiento de módulos de Skool.
 *
 * **Los módulos se abren y se cierran** (21-sep-2026). Antes todos estaban
 * abiertos: con los ocho módulos de sesión más los ocho de contenido, la barra
 * de la derecha era una lista plana de cuarenta renglones donde no se
 * distinguía dónde empezaba uno y terminaba otro. Alejandro lo dijo así: "hace
 * que la gente se maree y no pueda navegar fácilmente entre cada sesión y
 * dentro de cada sesión sus respectivos submódulos".
 *
 * Cerrados, el curso entero cabe de un vistazo y cada módulo dice cuánto llevas
 * de él. Abierto viene SOLO el que estás viendo, y `<details>` lo resuelve sin
 * una línea de JavaScript: funciona igual con el JS apagado y el navegador se
 * encarga del teclado.
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

/** Cuál módulo se abre solo: el de la lección que estás viendo, o donde te quedaste. */
function moduloParaAbrir(curso: CursoDelAlumno, leccionActiva?: string): string | null {
  if (leccionActiva) {
    const conActiva = curso.modulos.find((m) => m.lecciones.some((l) => l.id === leccionActiva))
    if (conActiva) return conActiva.id
  }
  const pendiente = curso.modulos.find((m) =>
    m.lecciones.some((l) => l.desbloqueada && !l.completada)
  )
  return pendiente?.id ?? curso.modulos[0]?.id ?? null
}

export function IndiceCurso({
  curso,
  leccionActiva,
  compacto = false,
}: {
  curso: CursoDelAlumno
  leccionActiva?: string
  /** Para la barra lateral de la lección: más apretado y sin tarjetas. */
  compacto?: boolean
}) {
  const abierto = moduloParaAbrir(curso, leccionActiva)

  return (
    <nav aria-label="Contenido del curso" className="flex flex-col gap-2">
      {curso.modulos.map((modulo, i) => (
        <Modulo
          key={modulo.id}
          modulo={modulo}
          numero={i + 1}
          cursoSlug={curso.slug}
          leccionActiva={leccionActiva}
          abierto={modulo.id === abierto}
          compacto={compacto}
        />
      ))}
    </nav>
  )
}

function Modulo({
  modulo,
  numero,
  cursoSlug,
  leccionActiva,
  abierto,
  compacto,
}: {
  modulo: ModuloEnIndice
  numero: number
  cursoSlug: string
  leccionActiva?: string
  abierto: boolean
  compacto: boolean
}) {
  const total = modulo.lecciones.length
  const hechas = modulo.lecciones.filter((l) => l.completada).length
  const completo = total > 0 && hechas === total
  const tieneActiva = modulo.lecciones.some((l) => l.id === leccionActiva)

  return (
    <details
      open={abierto || undefined}
      className={cn(
        'group/modulo overflow-hidden rounded-[10px] border border-border bg-card',
        tieneActiva && 'border-primary/50'
      )}
    >
      {/* El summary ES el botón: alto de 44 px para el dedo, y toda la fila
          es el blanco, no solo el triangulito. */}
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center gap-2.5 select-none',
          'transition-colors hover:bg-muted/60',
          'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
          '[&::-webkit-details-marker]:hidden',
          compacto ? 'px-3 py-2.5' : 'px-4 py-3'
        )}
      >
        <EstadoModulo numero={numero} completo={completo} />

        <span className="flex min-w-0 flex-1 flex-col">
          <span className={cn('truncate font-medium', compacto && 'text-sm')}>{modulo.titulo}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {total === 0
              ? 'Sin lecciones todavía'
              : `${hechas} de ${total} ${total === 1 ? 'lección' : 'lecciones'}`}
          </span>
        </span>

        <Chevron />
      </summary>

      {total === 0 ? (
        <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
          Este módulo todavía no tiene lecciones.
        </p>
      ) : (
        <ul className="flex flex-col border-t border-border">
          {modulo.lecciones.map((leccion) => (
            <li key={leccion.id}>
              <Renglon
                leccion={leccion}
                cursoSlug={cursoSlug}
                activa={leccion.id === leccionActiva}
                compacto={compacto}
              />
            </li>
          ))}
        </ul>
      )}
    </details>
  )
}

/** El número del módulo, o una palomita cuando ya está completo. */
function EstadoModulo({ numero, completo }: { numero: number; completo: boolean }) {
  if (completo) {
    return (
      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-exito/15 text-exito"
        aria-label="Módulo completo"
      >
        <Palomita />
      </span>
    )
  }
  return (
    <span
      className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-medium tabular-nums text-muted-foreground"
      aria-hidden
    >
      {numero}
    </span>
  )
}

/** Gira al abrir: es lo que dice que la fila se puede abrir. */
function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0 text-muted-foreground transition-transform group-open/modulo:rotate-180"
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
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
    'flex w-full items-center gap-3 border-l-2 text-left transition-colors',
    compacto ? 'py-2.5 pr-3 pl-3 text-sm' : 'px-4 py-3',
    activa ? 'border-l-primary bg-primary/10 text-foreground' : 'border-l-transparent',
    !leccion.desbloqueada && 'cursor-not-allowed opacity-60'
  )

  const contenido = (
    <>
      <Estado leccion={leccion} />

      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn('truncate', activa && 'font-medium')}>{leccion.titulo}</span>
        {!leccion.obligatoria ? <span className="text-xs text-muted-foreground">Opcional</span> : null}
      </span>

      {leccion.desbloqueada ? (
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
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
        <Palomita />
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

function Palomita() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5"
      aria-hidden
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
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
