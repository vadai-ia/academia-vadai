import { Button } from '@/components/ui/button'
import type { CursoDelAlumno } from '@/lib/alumno/consultas'

/**
 * Bloqueo por vencimiento (§6.3): mensaje claro y CTA de recompra.
 *
 * Se insiste en que el progreso sigue ahí, porque es cierto y porque es el mejor
 * argumento para volver: nadie quiere empezar de cero.
 */
export function AccesoVencido({ curso }: { curso: CursoDelAlumno }) {
  const hayLinks = Boolean(curso.linkRecompraMxn ?? curso.linkRecompraUsd)

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-primary/40 bg-primary/5 p-5">
      <div className="flex flex-col gap-1.5">
        <h2 className="font-medium">Tu acceso a este curso venció</h2>
        <p className="text-sm text-pretty text-muted-foreground">
          Puedes seguir viendo el temario, y tu avance sigue guardado:{' '}
          <span className="text-foreground">
            {curso.completadas} de {curso.totalLecciones} lecciones
          </span>
          . Al renovar retomas justo donde te quedaste.
        </p>
      </div>

      {hayLinks ? (
        <div className="flex flex-wrap gap-3">
          {curso.linkRecompraMxn ? (
            <Button asChild>
              <a href={curso.linkRecompraMxn} target="_blank" rel="noopener noreferrer">
                Renovar acceso
              </a>
            </Button>
          ) : null}
          {curso.linkRecompraUsd ? (
            <Button asChild variant="outline">
              <a href={curso.linkRecompraUsd} target="_blank" rel="noopener noreferrer">
                Pagar en USD
              </a>
            </Button>
          ) : null}
        </div>
      ) : (
        <a
          href="mailto:hola@vadai.com.mx?subject=Quiero%20renovar%20mi%20acceso"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Escríbenos para renovar
        </a>
      )}
    </section>
  )
}
