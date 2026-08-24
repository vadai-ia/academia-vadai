import Link from 'next/link'

import type { CursoDelAlumno } from '@/lib/alumno/consultas'
import { cn } from '@/lib/utils'

const ICONO_TIPO: Record<string, string> = {
  video: '▶',
  text: '¶',
  quiz: '?',
  assignment: '✎',
}

function duracionLegible(segundos: number | null): string {
  if (!segundos || segundos <= 0) return ''
  return `${Math.round(segundos / 60)} min`
}

/**
 * Índice del curso.
 *
 * Sale de `lesson_outline`, así que el alumno con acceso vencido ve los títulos
 * igual, solo que con candado y sin enlace. Es lo que pide §3.3 y lo que sostiene
 * el CTA de recompra de §6.3.
 */
export function IndiceCurso({
  curso,
  leccionActiva,
}: {
  curso: CursoDelAlumno
  leccionActiva?: string
}) {
  return (
    <nav aria-label="Contenido del curso" className="flex flex-col gap-5">
      {curso.modulos.map((modulo, i) => (
        <div key={modulo.id} className="flex flex-col gap-2">
          <h3 className="flex items-baseline gap-2 text-sm font-semibold">
            <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>
            {modulo.titulo}
          </h3>

          {modulo.lecciones.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              Este módulo todavía no tiene lecciones.
            </p>
          ) : null}

          <ul className="flex flex-col">
            {modulo.lecciones.map((leccion) => {
              const activa = leccion.id === leccionActiva

              const contenido = (
                <>
                  <span
                    aria-hidden
                    className={cn(
                      'w-4 shrink-0 text-center text-xs',
                      leccion.completada ? 'text-exito' : 'text-muted-foreground'
                    )}
                  >
                    {leccion.completada ? '✓' : (ICONO_TIPO[leccion.tipo] ?? '•')}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{leccion.titulo}</span>
                  {leccion.desbloqueada ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {duracionLegible(leccion.duracionSeg)}
                    </span>
                  ) : (
                    <span
                      className="shrink-0 text-xs text-muted-foreground"
                      title="Tu acceso venció"
                      aria-label="Bloqueada"
                    >
                      🔒
                    </span>
                  )}
                </>
              )

              const clases = cn(
                'flex items-center gap-2 rounded-md px-2 py-2 text-sm',
                activa && 'bg-muted text-foreground',
                !leccion.desbloqueada && 'cursor-not-allowed opacity-55'
              )

              return (
                <li key={leccion.id}>
                  {leccion.desbloqueada ? (
                    <Link
                      href={`/curso/${curso.slug}/${leccion.id}`}
                      className={cn(clases, 'hover:bg-muted/60')}
                      aria-current={activa ? 'page' : undefined}
                    >
                      {contenido}
                    </Link>
                  ) : (
                    <span className={clases}>{contenido}</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
