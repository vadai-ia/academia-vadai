import Image from 'next/image'

import { Progreso, TarjetaEnlace } from '@/components/ui-vadai/superficie'
import type { CursoDelAlumno } from '@/lib/alumno/consultas'

/**
 * Tarjeta de curso, al estilo del "Classroom" de Skool (§3.3).
 *
 * Skool encabeza cada curso con una imagen 16:9 grande y pone el progreso como
 * una barra fina al pie. Es más que decoración: en una rejilla de cursos, la
 * imagen es lo que hace que se distingan de un vistazo, mucho antes de leer el
 * título. Una lista de renglones de texto obliga a leer todo.
 *
 * Sin portada cargada, en vez de un hueco gris se dibuja un degradado de marca
 * con la inicial del curso. Un placeholder vacío se ve roto; uno intencional
 * se ve como una decisión — y §9 pide justo eso.
 *
 * El curso vencido NO desaparece: se muestra atenuado y con aviso. El progreso
 * no se borra al expirar (§6.3) y verlo ahí es parte del argumento de recompra.
 */
export function TarjetaCurso({ curso }: { curso: CursoDelAlumno }) {
  const porVencer = curso.vigente && curso.diasRestantes !== null && curso.diasRestantes <= 15
  const terminado = curso.totalLecciones > 0 && curso.porcentaje === 100

  return (
    <TarjetaEnlace href={`/curso/${curso.slug}`} className="flex h-full flex-col overflow-hidden">
      {/* La proporción se reserva con aspect-video: sin eso, la imagen al
          cargar empujaría el texto hacia abajo y la rejilla daría un salto. */}
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {curso.portada ? (
          <Image
            src={curso.portada}
            alt=""
            fill
            sizes="(min-width: 640px) 50vw, 100vw"
            unoptimized
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-full items-center justify-center bg-gradient-to-br from-vadai-navy via-vadai-azul to-vadai-cyan text-5xl font-medium text-white/90"
          >
            {curso.titulo.trim().charAt(0).toUpperCase()}
          </span>
        )}

        {!curso.vigente ? (
          <span className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 to-transparent p-3">
            <span className="rounded-full bg-background/95 px-2.5 py-1 text-xs font-medium">
              Acceso vencido
            </span>
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-col gap-1.5">
          <h3 className="font-medium text-balance">{curso.titulo}</h3>
          {curso.descripcion ? (
            <p className="line-clamp-2 text-sm text-pretty text-muted-foreground">
              {curso.descripcion}
            </p>
          ) : null}
        </div>

        <div className="mt-auto flex flex-col gap-2 pt-1">
          <Progreso porcentaje={curso.porcentaje} />

          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {curso.totalLecciones === 0
                ? 'Sin lecciones todavía'
                : `${curso.completadas} de ${curso.totalLecciones} lecciones`}
            </span>

            {terminado ? (
              <span className="rounded-full bg-accent px-2 py-0.5 font-medium text-accent-foreground">Completado</span>
            ) : curso.totalLecciones > 0 ? (
              <span className="tabular-nums">· {curso.porcentaje}%</span>
            ) : null}

            {porVencer ? (
              <span className="font-medium text-destructive">
                ·{' '}
                {curso.diasRestantes === 0
                  ? 'Vence hoy'
                  : `Vence en ${curso.diasRestantes} día${curso.diasRestantes === 1 ? '' : 's'}`}
              </span>
            ) : null}
          </p>
        </div>
      </div>
    </TarjetaEnlace>
  )
}
