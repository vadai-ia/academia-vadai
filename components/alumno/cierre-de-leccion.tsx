import Link from 'next/link'

import { Button } from '@/components/ui/button'

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
  base,
  puntos,
  textos,
}: {
  leccionId: string
  cursoSlug: string
  completada: boolean
  esVideo: boolean
  anterior: { id: string } | null
  siguiente: { id: string } | null
  /**
   * M26: dónde viven la anterior y la siguiente. Una lección de curso, en
   * `/curso/<slug>`; una grabación de V-AI-P, en `/vaip/clases`.
   */
  base?: string
  puntos?: number
  /** M26: en V-AI-P se dice «Marcar como vista», «Clase anterior»… */
  textos?: {
    marcar: string
    hecha: string
    anterior: string
    siguiente: string
    pie: string
  }
}) {
  const raiz = base ?? `/curso/${cursoSlug}`
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
          puntos={puntos}
          textos={textos ? { marcar: textos.marcar, hecha: textos.hecha } : undefined}
        />

        {anterior || siguiente ? (
          <nav aria-label="Lección anterior y siguiente" className="grid grid-cols-2 gap-2 sm:flex">
            {anterior ? (
              <Button asChild variant="outline" size="lg">
                <Link href={`${raiz}/${anterior.id}`}>
                  <span aria-hidden>←</span> {textos?.anterior ?? 'Anterior'}
                </Link>
              </Button>
            ) : (
              <span className="sm:hidden" />
            )}
            {siguiente ? (
              // Ya completada, "Siguiente" es lo que toca: se pinta como la
              // acción principal para que el camino a seguir no haya que buscarlo.
              <Button asChild variant={completada ? 'default' : 'outline'} size="lg">
                <Link href={`${raiz}/${siguiente.id}`}>
                  {textos?.siguiente ?? 'Siguiente'} <span aria-hidden>→</span>
                </Link>
              </Button>
            ) : null}
          </nav>
        ) : null}
      </div>

      {completada ? null : (
        <p className="text-sm text-muted-foreground">
          {esVideo ? 'Se marca sola al llegar al 90% del video. ' : ''}
          {textos?.pie ?? 'Avanza tu barra del curso.'}
        </p>
      )}
    </section>
  )
}
