import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { AdjuntosAlumno } from '@/components/alumno/adjuntos-alumno'
import { BotonCompletada } from '@/components/alumno/boton-completada'
import { IndiceCurso } from '@/components/alumno/indice-curso'
import { Quiz } from '@/components/alumno/quiz'
import { Tarea } from '@/components/alumno/tarea'
import { RenderRico } from '@/components/alumno/render-rico'
import { Reproductor } from '@/components/alumno/reproductor'
import { Button } from '@/components/ui/button'
import { contenidoDeLeccion, cursoDelAlumno, vecinas } from '@/lib/alumno/consultas'
import { quizParaAlumno } from '@/lib/alumno/quiz'
import { tareaParaAlumno } from '@/lib/alumno/tarea'
import { exigirPerfil } from '@/lib/auth/sesion'
import { firmarReproduccion, reproduccionConfigurada } from '@/lib/bunny/reproduccion'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; leccionId: string }>
}): Promise<Metadata> {
  const { leccionId } = await params
  const leccion = await contenidoDeLeccion(leccionId)
  return { title: leccion?.titulo ?? 'Lección' }
}

export default async function PaginaLeccion({
  params,
}: {
  params: Promise<{ slug: string; leccionId: string }>
}) {
  await exigirPerfil()
  const { slug, leccionId } = await params

  const curso = await cursoDelAlumno(slug)
  if (!curso) notFound()

  // Sin acceso vigente la lección simplemente no trae filas: la policy de
  // `lessons` exige has_active_access. Se devuelve al índice, que sí se ve y
  // lleva el CTA de recompra.
  const leccion = await contenidoDeLeccion(leccionId)
  if (!leccion) redirect(`/curso/${slug}`)

  const { anterior, siguiente, indice, total } = vecinas(curso, leccionId)

  const quiz = leccion.tipo === 'quiz' ? await quizParaAlumno(leccion.id) : null
  const tarea = leccion.tipo === 'assignment' ? await tareaParaAlumno(leccion.id) : null

  // La firma se genera aquí, en el servidor, y solo porque llegamos hasta este
  // punto: si el acceso hubiera vencido, `leccion` sería null y ya habríamos
  // salido. La llave de Bunny nunca toca el navegador (§7.2).
  const reproduccion =
    leccion.bunnyVideoId && reproduccionConfigurada()
      ? firmarReproduccion(leccion.bunnyVideoId)
      : null

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <header className="flex flex-col gap-2">
          <Link
            href={`/curso/${slug}`}
            className="text-sm text-vadai-cyan underline-offset-4 hover:underline"
          >
            ← {curso.titulo}
          </Link>
          <h1 className="text-xl font-semibold tracking-tight text-balance sm:text-2xl">
            {leccion.titulo}
          </h1>
          {indice >= 0 ? (
            <p className="text-xs text-muted-foreground">
              Lección {indice + 1} de {total}
            </p>
          ) : null}
        </header>

        {leccion.bunnyVideoId && reproduccion ? (
          <Reproductor
            urlIframe={reproduccion.urlIframe}
            leccionId={leccion.id}
            cursoSlug={slug}
            duracionSeg={leccion.duracionSeg}
            yaCompletada={leccion.completada}
            titulo={leccion.titulo}
          />
        ) : leccion.bunnyVideoId ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            El video no está disponible por un problema de configuración. Avísanos.
          </p>
        ) : null}

        {leccion.descripcion ? <RenderRico contenido={leccion.descripcion} /> : null}

        {quiz ? <Quiz quiz={quiz} leccionId={leccion.id} cursoSlug={slug} /> : null}

        {tarea ? <Tarea tarea={tarea} leccionId={leccion.id} cursoSlug={slug} /> : null}

        <AdjuntosAlumno adjuntos={leccion.adjuntos} />

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
          <BotonCompletada
            leccionId={leccion.id}
            cursoSlug={slug}
            completadaInicial={leccion.completada}
          />

          <div className="ml-auto flex gap-2">
            {anterior ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/curso/${slug}/${anterior.id}`}>← Anterior</Link>
              </Button>
            ) : null}
            {siguiente ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/curso/${slug}/${siguiente.id}`}>Siguiente →</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <aside className="w-full shrink-0 border-t border-border pt-6 lg:w-72 lg:border-t-0 lg:pt-0">
        <IndiceCurso curso={curso} leccionActiva={leccion.id} />
      </aside>
    </div>
  )
}
