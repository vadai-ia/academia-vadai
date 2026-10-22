import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { PublicacionCompleta } from '@/components/alumno/comunidad'
import { Regreso } from '@/components/ui-vadai/regreso'
import { cursoDelAlumno } from '@/lib/alumno/consultas'
import { esEquipo, exigirPerfil } from '@/lib/auth/sesion'
import { ligaEnVaip } from '@/lib/comunidad/ligas'
import { publicacionPorId } from '@/lib/comunidad/posts'
import { temasDelCurso } from '@/lib/comunidad/temas'
import { esCasaDeVaip } from '@/lib/membresia/consultas'

export const metadata: Metadata = { title: 'Grupo' }
export const dynamic = 'force-dynamic'

/**
 * Una publicación del grupo de un curso, entera y con su conversación
 * (22-oct-2026). Va fuera del marco del curso, como la lección: con el título,
 * el avance y las pestañas encima, la publicación empezaba a media pantalla.
 *
 * Las mismas guardas que el grupo: la casa de V-AI-P vive en /vaip, y con el
 * acceso vencido no se entra (el grupo es contenido). Lo que RLS no deja ver
 * —otra generación, lo oculto— no existe.
 */
export default async function PublicacionDelGrupo({
  params,
}: {
  params: Promise<{ slug: string; postId: string }>
}) {
  const perfil = await exigirPerfil()
  const { slug, postId } = await params

  const curso = await cursoDelAlumno(slug)
  if (!curso) notFound()
  if (await esCasaDeVaip(curso.id)) redirect(ligaEnVaip(postId, false))
  if (!curso.vigente) redirect(`/curso/${slug}`)

  const [encontrada, temas] = await Promise.all([publicacionPorId(postId, perfil.user_id), temasDelCurso(curso.id)])
  if (!encontrada || encontrada.cursoId !== curso.id) notFound()
  const { post } = encontrada

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Regreso href={`/curso/${slug}/comunidad`}>Grupo · {curso.titulo}</Regreso>
      <PublicacionCompleta
        post={post}
        cursoSlug={slug}
        ruta={`/curso/${slug}/comunidad/${post.id}`}
        soyEquipo={esEquipo(perfil)}
        temaNombre={temas.find((t) => t.id === post.temaId)?.nombre ?? null}
        despues={`/curso/${slug}/comunidad`}
      />
    </div>
  )
}
