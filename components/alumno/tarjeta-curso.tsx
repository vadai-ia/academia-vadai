import Link from 'next/link'

import { BarraProgreso } from '@/components/alumno/barra-progreso'
import { Badge } from '@/components/ui/badge'
import type { CursoDelAlumno } from '@/lib/alumno/consultas'

/**
 * Card de /mis-cursos (§3.3): progreso y días restantes si aplica.
 *
 * El curso vencido no desaparece: se muestra con aviso. El progreso NO se borra
 * al expirar (§6.3), y verlo ahí es parte del argumento de recompra.
 */
export function TarjetaCurso({ curso }: { curso: CursoDelAlumno }) {
  const porVencer = curso.vigente && curso.diasRestantes !== null && curso.diasRestantes <= 15

  return (
    <Link
      href={`/curso/${curso.slug}`}
      className="flex flex-col gap-4 rounded-lg border border-border p-5 transition-colors hover:border-primary/60"
    >
      <div className="flex flex-col gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{curso.titulo}</span>
          {!curso.vigente ? <Badge variant="outline">Acceso vencido</Badge> : null}
          {porVencer ? (
            <Badge variant="secondary">
              {curso.diasRestantes === 0
                ? 'Vence hoy'
                : `${curso.diasRestantes} día${curso.diasRestantes === 1 ? '' : 's'}`}
            </Badge>
          ) : null}
        </span>

        {curso.descripcion ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{curso.descripcion}</p>
        ) : null}
      </div>

      <BarraProgreso
        porcentaje={curso.porcentaje}
        etiqueta={
          curso.totalLecciones === 0
            ? 'Sin lecciones todavía'
            : `${curso.completadas} de ${curso.totalLecciones} lecciones · ${curso.porcentaje}%`
        }
      />
    </Link>
  )
}
