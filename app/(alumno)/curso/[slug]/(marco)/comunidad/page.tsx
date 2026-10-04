import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { Comunidad } from '@/components/alumno/comunidad'
import { Ranking } from '@/components/alumno/ranking'
import { SelectorDeGeneracion } from '@/components/alumno/selector-de-generacion'
import { cursoDelAlumno } from '@/lib/alumno/consultas'
import { generacionesParaEquipo } from '@/lib/alumno/generaciones-equipo'
import { esEquipo, exigirPerfil } from '@/lib/auth/sesion'
import { feedDelCurso } from '@/lib/comunidad/posts'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const curso = await cursoDelAlumno(slug)
  return { title: curso ? `Comunidad · ${curso.titulo}` : 'Comunidad' }
}

export default async function PaginaComunidad({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ p?: string; por?: string; gen?: string }>
}) {
  const perfil = await exigirPerfil()
  const { slug } = await params
  const { p, por, gen } = await searchParams

  const curso = await cursoDelAlumno(slug)
  if (!curso) notFound()

  // La comunidad es contenido, no estructura: con el acceso vencido no se entra.
  // El índice del curso sí se ve, y de ahí sale el CTA de recompra (§6.3).
  if (!curso.vigente) redirect(`/curso/${slug}`)

  // Cada generación tiene su muro (M16). El alumno ve el suyo y nada más (RLS);
  // el equipo elige cuál con `?gen=`, y por omisión ve el de la generación
  // abierta.
  const soyEquipo = esEquipo(perfil)
  const generaciones = soyEquipo && curso.porGeneraciones ? await generacionesParaEquipo(curso.id) : []
  const generacion = generaciones.find((g) => g.id === gen) ?? curso.generacion
  const cohortId = generacion?.id ?? null

  const feed = await feedDelCurso(curso.id, cohortId, perfil.user_id, {
    pagina: Number(p) || 1,
    porPagina: por === undefined ? 10 : Number(por),
  })
  const extra: Record<string, string> = gen && generacion?.id === gen ? { gen } : {}

  return (
    <div className="flex flex-col gap-6">
      {/* Sin encabezado propio ni migaja de regreso: el layout del curso ya pone
          el título, el progreso y las pestañas, y la pestaña activa dice dónde
          estás. Repetirlo aquí era ruido y empujaba el contenido hacia abajo. */}
      <p className="text-sm text-muted-foreground">
        Preguntas, avances y lo que quieras compartir con tu generación. Cada publicación y cada
        comentario suman puntos.
      </p>

      {/* Para el equipo, aunque haya una sola generación: «¿de qué generación
          están escribiendo?» tiene que contestarse sin adivinar (3-oct-2026). */}
      {generaciones.length > 0 ? (
        <SelectorDeGeneracion
          base={`/curso/${slug}/comunidad`}
          generaciones={generaciones}
          activa={cohortId}
        />
      ) : null}

      {curso.sinGeneracion ? (
        <p className="rounded-lg border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
          La comunidad es por generación, y todavía no estás en una. Escríbenos y te asignamos la
          tuya.
        </p>
      ) : (
        <>
          {/* El ranking va arriba del feed: es lo que hace que participar tenga
              consecuencia visible. Los puntos salen de lib/gamificacion. */}
          <Ranking cursoId={curso.id} cohortId={cohortId} userId={perfil.user_id} porGeneraciones={curso.porGeneraciones} />

          <Comunidad
            posts={feed.posts}
            cursoId={curso.id}
            cohortId={cohortId}
            porGeneraciones={curso.porGeneraciones}
            cursoSlug={slug}
            soyEquipo={soyEquipo}
            ruta={`/curso/${slug}/comunidad`}
            pagina={feed.pagina}
            paginas={feed.paginas}
            porPagina={feed.porPagina}
            total={feed.total}
            extra={extra}
          />
        </>
      )}
    </div>
  )
}
