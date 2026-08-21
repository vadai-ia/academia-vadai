import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { Comunidad } from '@/components/alumno/comunidad'
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
      <header className="flex flex-col gap-2">
        <Link
          href={`/curso/${slug}`}
          className="text-sm text-vadai-cyan underline-offset-4 hover:underline"
        >
          ← {curso.titulo}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Comunidad</h1>
        <p className="text-sm text-muted-foreground">
          Preguntas, avances y lo que quieras compartir con tu grupo.
        </p>
      </header>

      <Comunidad
        posts={posts}
        cursoId={curso.id}
        cursoSlug={slug}
        soyEquipo={esEquipo(perfil)}
      />
    </div>
  )
}
