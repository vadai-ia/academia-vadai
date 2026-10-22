import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { PublicacionCompleta } from '@/components/alumno/comunidad'
import { Regreso } from '@/components/ui-vadai/regreso'
import { ligaEnVaip } from '@/lib/comunidad/ligas'
import { publicacionPorId } from '@/lib/comunidad/posts'
import { temasDelCurso } from '@/lib/comunidad/temas'
import { contextoVaip } from '@/lib/membresia/espacio'

export const metadata: Metadata = { title: 'Muro · V-AI-P' }
export const dynamic = 'force-dynamic'

/**
 * Una publicación del muro de V-AI-P, entera y con su conversación
 * (22-oct-2026). El muro enseña tarjetas; aquí se lee y se responde.
 *
 * Solo miembros y equipo; otra persona va a /vaip. Una noticia se ve en su
 * sección, /vaip/noticias/<id>.
 */
export default async function PublicacionVaip({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await contextoVaip()
  if (!ctx) redirect('/vaip')
  const { perfil, casa, equipo } = ctx
  const { id } = await params
  if (!casa) notFound()

  const [encontrada, temas] = await Promise.all([publicacionPorId(id, perfil.user_id), temasDelCurso(casa.id)])
  if (!encontrada || encontrada.cursoId !== casa.id) notFound()
  const { post } = encontrada
  if (post.noticia) redirect(ligaEnVaip(post.id, true))

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Regreso href="/vaip">Muro</Regreso>
      <PublicacionCompleta
        post={post}
        cursoSlug={casa.slug}
        ruta={`/vaip/muro/${post.id}`}
        soyEquipo={equipo}
        temaNombre={temas.find((t) => t.id === post.temaId)?.nombre ?? null}
        despues="/vaip"
      />
    </div>
  )
}
