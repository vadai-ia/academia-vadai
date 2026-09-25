import Link from 'next/link'

import { Button } from '@/components/ui/button'
import type { LeccionEnIndice } from '@/lib/alumno/consultas'
import { PUNTOS } from '@/lib/gamificacion/reglas'

import { BotonCompletada } from './boton-completada'

/**
 * El cierre de la lección: marcarla y pasar a la siguiente, en un solo bloque
 * AL FINAL del contenido (25-sep-2026).
 *
 * Antes el botón vivía entre el material y los comentarios, separado por una
 * raya, y "no es tan visible ni fácil de encontrar para marcar". Ahora va
 * después de todo lo que hay que ver —video, texto, quiz o tarea— en una
 * tarjeta propia, en el lima de la marca (es el color de los CTAs, y es el
 * único botón lima de la pantalla), con Anterior y Siguiente a su lado para
 * que el paso que sigue no haya que buscarlo. Los comentarios van después:
 * son conversación, no parte de terminar.
 *
 * `key` sobre el botón: cuando el video llega al 90% el servidor marca la
 * lección y la página se refresca; con la llave el botón se vuelve a montar
 * ya en "Completada" en vez de quedarse en el estado con el que nació.
 */
export function CierreDeLeccion({
  leccionId,
  cursoSlug,
  completada,
  esVideo,
  anterior,
  siguiente,
}: {
  leccionId: string
  cursoSlug: string
  completada: boolean
  esVideo: boolean
  anterior: LeccionEnIndice | null
  siguiente: LeccionEnIndice | null
}) {
  return (
    <section
      aria-label="Terminar la lección"
      className="flex flex-col gap-4 rounded-[10px] border border-border bg-card p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <BotonCompletada
          key={String(completada)}
          leccionId={leccionId}
          cursoSlug={cursoSlug}
          completadaInicial={completada}
        />

        {anterior || siguiente ? (
          <nav aria-label="Lección anterior y siguiente" className="grid grid-cols-2 gap-2 sm:flex">
            {anterior ? (
              <Button asChild variant="outline" size="lg">
                <Link href={`/curso/${cursoSlug}/${anterior.id}`}>
                  <span aria-hidden>←</span> Anterior
                </Link>
              </Button>
            ) : (
              <span className="sm:hidden" />
            )}
            {siguiente ? (
              // Ya completada, "Siguiente" es lo que toca: se pinta como la
              // acción principal para que el camino a seguir no haya que buscarlo.
              <Button asChild variant={completada ? 'default' : 'outline'} size="lg">
                <Link href={`/curso/${cursoSlug}/${siguiente.id}`}>
                  Siguiente <span aria-hidden>→</span>
                </Link>
              </Button>
            ) : null}
          </nav>
        ) : null}
      </div>

      {completada ? null : (
        <p className="text-sm text-muted-foreground">
          {esVideo ? 'Se marca sola al llegar al 90% del video. ' : ''}
          Suma {PUNTOS.leccion} puntos y avanza tu barra del curso.
        </p>
      )}
    </section>
  )
}
