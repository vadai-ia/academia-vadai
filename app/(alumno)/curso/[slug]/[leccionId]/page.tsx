import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { AdjuntosAlumno } from '@/components/alumno/adjuntos-alumno'
import { CierreDeLeccion } from '@/components/alumno/cierre-de-leccion'
import { Comentarios } from '@/components/alumno/comentarios'
import { EstaSesion } from '@/components/alumno/esta-sesion'
import { Quiz } from '@/components/alumno/quiz'
import { RenderRico } from '@/components/alumno/render-rico'
import { Reproductor } from '@/components/alumno/reproductor'
import { Tarea } from '@/components/alumno/tarea'
import { Progreso } from '@/components/ui-vadai/superficie'
import { contenidoDeLeccion, cursoDelAlumno, vecinas } from '@/lib/alumno/consultas'
import { quizParaAlumno } from '@/lib/alumno/quiz'
import { tareaParaAlumno } from '@/lib/alumno/tarea'
import { esEquipo, exigirPerfil } from '@/lib/auth/sesion'
import { firmarReproduccion, reproduccionConfigurada } from '@/lib/bunny/reproduccion'
import { comentariosDeLeccion } from '@/lib/comunidad/comentarios'

/**
 * La lección, en "modo lección" (25-sep-2026).
 *
 * Vive FUERA del marco del curso (`(marco)/layout.tsx`, con el título del
 * curso, su avance y las pestañas): en el teléfono ese marco más el
 * encabezado de la lección dejaban el video a media pantalla. Aquí el
 * encabezado es propio y corto —vuelta al curso, sesión, título, avance— y lo
 * primero que se ve es el video.
 *
 * El orden en el teléfono es el orden de leer: video, material, texto, el
 * cierre (marcar y seguir), la sesión y al final los comentarios. En
 * escritorio las mismas piezas se reparten en dos columnas: a la derecha, y
 * pegada, solo lo que orienta (material y ESTA sesión); nunca el índice
 * completo, que ya vive en Contenido. Sin duplicar nada en el DOM: la columna
 * es `display: contents` bajo `lg` y sus hijos toman su lugar por `order`.
 *
 * NO lleva `loading.tsx`: el `redirect()` de abajo es control de acceso y un
 * límite de Suspense haría que la respuesta saliera 200. Ver
 * components/marca/esqueleto.tsx.
 */
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

function duracionLegible(segundos: number | null): string | null {
  if (!segundos || segundos <= 0) return null
  const minutos = Math.round(segundos / 60)
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`
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

  const { anterior, siguiente } = vecinas(curso, leccionId)

  // En qué sesión estás. Con dieciséis módulos, "Lección 12 de 40" no ubica a
  // nadie; el título del módulo arriba y "Lección 2 de 4" sí (21-sep-2026).
  const modulo = curso.modulos.find((m) => m.lecciones.some((l) => l.id === leccionId))
  const enIndice = modulo?.lecciones.find((l) => l.id === leccionId)
  const enModulo = modulo ? modulo.lecciones.findIndex((l) => l.id === leccionId) + 1 : 0
  const meta = [
    modulo && enModulo > 0 ? `Lección ${enModulo} de ${modulo.lecciones.length}` : null,
    duracionLegible(leccion.duracionSeg),
    enIndice && !enIndice.obligatoria ? 'Opcional' : null,
  ]
    .filter(Boolean)
    .join(' · ')

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
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Link
          href={`/curso/${slug}`}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <span aria-hidden>←</span> {curso.titulo}
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 flex-col gap-1">
            {modulo ? (
              <p className="text-xs font-medium tracking-wider text-primary uppercase">
                {modulo.titulo}
              </p>
            ) : null}
            <h1 className="text-2xl leading-tight font-medium tracking-tight text-balance sm:text-[1.75rem]">
              {leccion.titulo}
            </h1>
            {meta ? <p className="text-sm text-muted-foreground">{meta}</p> : null}
          </div>

          {/* El avance del curso también aquí: es donde se gana. */}
          {curso.totalLecciones > 0 ? (
            <div className="flex w-full max-w-xs flex-col gap-1.5 sm:w-56">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-muted-foreground">Tu avance</span>
                <span className="font-medium text-primary tabular-nums">{curso.porcentaje}%</span>
              </div>
              <Progreso
                porcentaje={curso.porcentaje}
                etiqueta={`${curso.completadas} de ${curso.totalLecciones} lecciones completadas`}
              />
            </div>
          ) : null}
        </div>
      </header>

      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-x-10 lg:gap-y-8">
        {/* 1 · El video, o lo que va en su lugar. */}
        <div className="order-1 lg:col-start-1">
          {leccion.bunnyVideoId && reproduccion ? (
            <Reproductor
              urlIframe={reproduccion.urlIframe}
              leccionId={leccion.id}
              cursoSlug={slug}
              duracionSeg={leccion.duracionSeg}
              yaCompletada={leccion.completada}
              titulo={leccion.titulo}
              className="-mx-5 sm:mx-0"
            />
          ) : leccion.bunnyVideoId ? (
            <p className="rounded-[10px] border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              El video no está disponible por un problema de configuración. Avísanos.
            </p>
          ) : leccion.tipo === 'video' ? (
            // Una lección de video sin video todavía no es un error: es el lugar
            // reservado para la grabación de una sesión que aún no ocurre (M14).
            // Sin esto la pantalla salía en blanco y parecía rota.
            <p className="rounded-[10px] border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              El video se publica aquí en cuanto esté listo. Te avisamos en la campana.
            </p>
          ) : null}
        </div>

        {/* La columna derecha. Bajo `lg` no existe como caja: sus piezas se
            reparten por `order` —el material bajo el video, la sesión después
            del cierre—. En `lg` es una columna pegada que se desplaza sola. */}
        <aside
          aria-label="Material y sesión"
          className="max-lg:contents lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1 lg:row-span-3 lg:flex lg:max-h-[calc(100dvh-3rem)] lg:flex-col lg:gap-6 lg:self-start lg:overflow-y-auto"
        >
          <AdjuntosAlumno adjuntos={leccion.adjuntos} className="order-2 lg:order-none" />
          {modulo ? (
            <EstaSesion
              curso={curso}
              modulo={modulo}
              leccionActiva={leccion.id}
              className="order-4 lg:order-none"
            />
          ) : null}
        </aside>

        {/* 3 · Lo que hay que ver o hacer, y al final el cierre. */}
        <div className="order-3 flex flex-col gap-8 lg:col-start-1">
          {leccion.descripcion ? <RenderRico contenido={leccion.descripcion} /> : null}

          {quiz ? <Quiz quiz={quiz} leccionId={leccion.id} cursoSlug={slug} /> : null}

          {tarea ? <Tarea tarea={tarea} leccionId={leccion.id} cursoSlug={slug} /> : null}

          <CierreDeLeccion
            leccionId={leccion.id}
            cursoSlug={slug}
            completada={leccion.completada}
            esVideo={Boolean(leccion.bunnyVideoId && reproduccion)}
            anterior={anterior}
            siguiente={siguiente}
          />
        </div>

        {/* 5 · La conversación, al final: no es parte de terminar. */}
        <div className="order-5 lg:col-start-1">
          <Comentarios
            comentarios={comentarios}
            leccionId={leccion.id}
            cursoSlug={slug}
            soyEquipo={esEquipo(perfil)}
          />
        </div>
      </div>
    </article>
  )
}
