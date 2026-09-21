import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { AdjuntosAlumno } from '@/components/alumno/adjuntos-alumno'
import { BotonCompletada } from '@/components/alumno/boton-completada'
import { IndiceCurso } from '@/components/alumno/indice-curso'
import { Quiz } from '@/components/alumno/quiz'
import { Comentarios } from '@/components/alumno/comentarios'
import { Tarea } from '@/components/alumno/tarea'
import { RenderRico } from '@/components/alumno/render-rico'
import { Reproductor } from '@/components/alumno/reproductor'
import { Button } from '@/components/ui/button'
import { contenidoDeLeccion, cursoDelAlumno, vecinas } from '@/lib/alumno/consultas'
import { quizParaAlumno } from '@/lib/alumno/quiz'
import { tareaParaAlumno } from '@/lib/alumno/tarea'
import { esEquipo, exigirPerfil } from '@/lib/auth/sesion'
import { comentariosDeLeccion } from '@/lib/comunidad/comentarios'
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
  const perfil = await exigirPerfil()
  const { slug, leccionId } = await params

  // Las tres dependen solo de los params, no una de otra: encadenarlas eran
  // tres viajes de red donde cabe uno.
  //
  // Los comentarios se piden antes de saber si hay acceso, y no importa: la
  // policy de `lesson_comments` exige has_active_access, así que quien no deba
  // verlos recibe cero filas. Quien decide es RLS, no el orden de los awaits.
  //
  // Sin acceso vigente la lección simplemente no trae filas: la policy de
  // `lessons` exige has_active_access. Se devuelve al índice, que sí se ve y
  // lleva el CTA de recompra.
  const [curso, leccion, comentarios] = await Promise.all([
    cursoDelAlumno(slug),
    contenidoDeLeccion(leccionId),
    comentariosDeLeccion(leccionId, perfil.user_id),
  ])

  if (!curso) notFound()
  if (!leccion) redirect(`/curso/${slug}`)

  const { anterior, siguiente, indice, total } = vecinas(curso, leccionId)

  // En qué módulo estás. Con dieciséis módulos, "Lección 12 de 40" no ubica a
  // nadie; "Sesión 3 · lección 2 de 4" sí (21-sep-2026).
  const modulo = curso.modulos.find((m) => m.lecciones.some((l) => l.id === leccionId))
  const enModulo = modulo ? modulo.lecciones.findIndex((l) => l.id === leccionId) + 1 : 0

  // Estas sí necesitan saber de qué tipo es la lección, y son excluyentes.
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
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            ← {curso.titulo}
          </Link>
          {modulo ? (
            <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              {modulo.titulo}
            </p>
          ) : null}
          <h1 className="text-xl font-semibold tracking-tight text-balance sm:text-2xl">
            {leccion.titulo}
          </h1>
          {modulo && enModulo > 0 ? (
            <p className="text-xs text-muted-foreground">
              Lección {enModulo} de {modulo.lecciones.length} de este módulo
              {indice >= 0 ? ` · ${indice + 1} de ${total} del curso` : ''}
            </p>
          ) : indice >= 0 ? (
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
        ) : leccion.tipo === 'video' ? (
          // Una lección de video sin video todavía no es un error: es el lugar
          // reservado para la grabación de una sesión que aún no ocurre (M14).
          // Sin esto la pantalla salía en blanco y parecía rota.
          <p className="rounded-[10px] border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            El video se publica aquí en cuanto esté listo. Te avisamos en la campana.
          </p>
        ) : null}

        {leccion.descripcion ? <RenderRico contenido={leccion.descripcion} /> : null}

        {quiz ? <Quiz quiz={quiz} leccionId={leccion.id} cursoSlug={slug} /> : null}

        {tarea ? <Tarea tarea={tarea} leccionId={leccion.id} cursoSlug={slug} /> : null}

        <AdjuntosAlumno adjuntos={leccion.adjuntos} />

        <div className="flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-start sm:justify-between">
          <BotonCompletada
            leccionId={leccion.id}
            cursoSlug={slug}
            completadaInicial={leccion.completada}
          />

          {/* Ya completada, "Siguiente" es lo que toca: se pinta como la acción
              principal para que el camino a seguir no haya que buscarlo. */}
          <div className="flex shrink-0 gap-2">
            {anterior ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/curso/${slug}/${anterior.id}`}>← Anterior</Link>
              </Button>
            ) : null}
            {siguiente ? (
              <Button asChild variant={leccion.completada ? 'default' : 'outline'} size="sm">
                <Link href={`/curso/${slug}/${siguiente.id}`}>Siguiente →</Link>
              </Button>
            ) : null}
          </div>
        </div>

        <Comentarios
          comentarios={comentarios}
          leccionId={leccion.id}
          cursoSlug={slug}
          soyEquipo={esEquipo(perfil)}
        />
      </div>

      {/* El índice: en el teléfono va cerrado tras su propio botón —si no,
          empuja los comentarios cuarenta renglones hacia abajo—; en escritorio
          se queda pegado y se desplaza solo él. */}
      <aside className="w-full shrink-0 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:w-80 lg:overflow-y-auto">
        <details className="rounded-[10px] border border-border lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium select-none [&::-webkit-details-marker]:hidden">
            Índice del curso
            <span className="text-xs text-muted-foreground tabular-nums">
              {curso.completadas} de {curso.totalLecciones}
            </span>
          </summary>
          <div className="border-t border-border p-3">
            <IndiceCurso curso={curso} leccionActiva={leccion.id} compacto />
          </div>
        </details>

        <div className="hidden lg:block">
          <p className="mb-2 flex items-baseline justify-between gap-2 text-sm font-medium">
            Índice del curso
            <span className="text-xs text-muted-foreground tabular-nums">
              {curso.completadas} de {curso.totalLecciones}
            </span>
          </p>
          <IndiceCurso curso={curso} leccionActiva={leccion.id} compacto />
        </div>
      </aside>
    </div>
  )
}
