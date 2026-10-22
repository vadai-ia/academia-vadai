import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { Paginacion } from '@/components/alumno/comunidad'
import { EncabezadoVaip } from '@/components/vaip/espacio'
import { RejillaDeNoticias } from '@/components/vaip/noticias'
import { sesionesDelCurso } from '@/lib/alumno/sesiones'
import { proximaOActual } from '@/lib/calendario/estado'
import { feedDelCurso } from '@/lib/comunidad/posts'
import { contextoVaip } from '@/lib/membresia/espacio'

export const metadata: Metadata = { title: 'Noticias · V-AI-P' }
export const dynamic = 'force-dynamic'

/** Una destacada y seis en rejilla: dos renglones de tres en escritorio. */
const POR_PAGINA = 7

/**
 * V-AI-P → Noticias (22-oct-2026). Las noticias que el equipo publica en el
 * muro (M24), como revista: tarjetas con imagen, siete por página, y cada una
 * abre su página (/vaip/noticias/<id>). Antes salían enteras en el muro y leer
 * tres era recorrer tres pantallas por cada una.
 *
 * Solo para miembros y el equipo; a cualquier otra persona, /vaip. Sin
 * `loading.tsx`, por ese redirect.
 */
export default async function NoticiasVaip({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const ctx = await contextoVaip()
  if (!ctx) redirect('/vaip')
  const { perfil, casa } = ctx
  const nombre = perfil.full_name || perfil.email
  const { p } = await searchParams

  const [sesiones, feed] = await Promise.all([
    casa ? sesionesDelCurso(casa.slug) : Promise.resolve([]),
    casa
      ? feedDelCurso(casa.id, casa.generacion?.id ?? null, perfil.user_id, {
          pagina: Number(p) || 1,
          porPagina: POR_PAGINA,
          soloNoticias: true,
        })
      : Promise.resolve(null),
  ])
  const href = (n: number) => (n > 1 ? `/vaip/noticias?p=${n}` : '/vaip/noticias')

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <EncabezadoVaip nombre={nombre} clase={proximaOActual(sesiones, Date.now())} />

      {!feed || feed.posts.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-border px-5 py-12 text-center text-[0.95rem] text-muted-foreground">
          Todavía no hay noticias. Cada mañana el equipo elige lo más importante de la IA y aparece aquí.
        </p>
      ) : (
        <>
          <RejillaDeNoticias posts={feed.posts} conDestacada />
          <Paginacion
            pagina={feed.pagina}
            paginas={feed.paginas}
            anterior={href(Math.max(1, feed.pagina - 1))}
            siguiente={href(Math.min(feed.paginas, feed.pagina + 1))}
            etiqueta="Navegar las noticias"
          />
        </>
      )}
    </div>
  )
}
