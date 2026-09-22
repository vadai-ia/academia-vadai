import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { Comunidad } from '@/components/alumno/comunidad'
import { Ranking } from '@/components/alumno/ranking'
import { cursoDelAlumno } from '@/lib/alumno/consultas'
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
}: {
  params: Promise<{ slug: string }>
}) {
  const perfil = await exigirPerfil()
  const { slug } = await params

  const curso = await cursoDelAlumno(slug)
  if (!curso) notFound()

  // La comunidad es contenido, no estructura: con el acceso vencido no se entra.
  // El índice del curso sí se ve, y de ahí sale el CTA de recompra (§6.3).
  if (!curso.vigente) redirect(`/curso/${slug}`)

  const posts = await feedDelCurso(curso.id, perfil.user_id)

  return (
    <div className="flex flex-col gap-6">
      {/* Sin encabezado propio ni migaja de regreso: el layout del curso ya pone
          el título, el progreso y las pestañas, y la pestaña activa dice dónde
          estás. Repetirlo aquí era ruido y empujaba el contenido hacia abajo. */}
      <p className="text-sm text-muted-foreground">
        Preguntas, avances y lo que quieras compartir con tu grupo. Cada publicación y cada
        comentario suman puntos.
      </p>

      {/* El ranking va arriba del feed: es lo que hace que participar tenga
          consecuencia visible. Los puntos salen de lib/gamificacion. */}
      <Ranking cursoId={curso.id} userId={perfil.user_id} />

      <Comunidad
        posts={posts}
        cursoId={curso.id}
        cursoSlug={slug}
        soyEquipo={esEquipo(perfil)}
        ruta={`/curso/${slug}/comunidad`}
      />
    </div>
  )
}
