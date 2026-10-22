import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { PublicacionCompleta } from '@/components/alumno/comunidad'
import { Regreso } from '@/components/ui-vadai/regreso'
import { RejillaDeNoticias } from '@/components/vaip/noticias'
import { ligaEnVaip } from '@/lib/comunidad/ligas'
import { otrasNoticias, publicacionPorId } from '@/lib/comunidad/posts'
import { contextoVaip } from '@/lib/membresia/espacio'

export const metadata: Metadata = { title: 'Noticia · V-AI-P' }
export const dynamic = 'force-dynamic'

/**
 * Una noticia de V-AI-P (22-oct-2026): la imagen, nuestro resumen y análisis,
 * «Leer la nota original» y la conversación. Al pie, tres más para seguir
 * leyendo sin volver a la lista.
 *
 * Solo miembros y equipo; otra persona va a /vaip. Lo que no es noticia vive
 * en /vaip/muro/<id>; lo que no es de la casa, no existe aquí.
 */
export default async function NoticiaVaip({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await contextoVaip()
  if (!ctx) redirect('/vaip')
  const { perfil, casa, equipo } = ctx
  const { id } = await params
  if (!casa) notFound()

  const encontrada = await publicacionPorId(id, perfil.user_id)
  if (!encontrada || encontrada.cursoId !== casa.id) notFound()
  const { post, cohortId } = encontrada
  if (!post.noticia) redirect(ligaEnVaip(post.id, false))

  const mas = await otrasNoticias(casa.id, cohortId, post.id, perfil.user_id)

  return (
    <div className="flex flex-col gap-10">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <Regreso href="/vaip/noticias">Noticias</Regreso>
        <PublicacionCompleta
          post={post}
          cursoSlug={casa.slug}
          ruta={`/vaip/noticias/${post.id}`}
          soyEquipo={equipo}
          temaNombre="Noticias"
          despues="/vaip/noticias"
        />
      </div>

      {mas.length > 0 ? (
        <section aria-labelledby="sigue-leyendo" className="flex flex-col gap-4 border-t border-border pt-8">
          <h2 id="sigue-leyendo" className="text-lg font-medium tracking-tight">
            Sigue leyendo
          </h2>
          <RejillaDeNoticias posts={mas} />
        </section>
      ) : null}
    </div>
  )
}
