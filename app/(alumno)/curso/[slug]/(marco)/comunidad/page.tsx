import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { Comunidad } from '@/components/alumno/comunidad'
import { SelectorDeGeneracion } from '@/components/alumno/selector-de-generacion'
import { cursoDelAlumno } from '@/lib/alumno/consultas'
import { generacionesParaEquipo } from '@/lib/alumno/generaciones-equipo'
import { esEquipo, exigirPerfil } from '@/lib/auth/sesion'
import { feedDelCurso } from '@/lib/comunidad/posts'
import { temasDelCurso } from '@/lib/comunidad/temas'
import { esCasaDeVaip } from '@/lib/membresia/consultas'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const curso = await cursoDelAlumno(slug)
  return { title: curso ? `Grupo · ${curso.titulo}` : 'Grupo' }
}

export default async function PaginaComunidad({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ p?: string; por?: string; gen?: string; tema?: string }>
}) {
  const perfil = await exigirPerfil()
  const { slug } = await params
  const { p, por, gen, tema } = await searchParams

  const curso = await cursoDelAlumno(slug)
  if (!curso) notFound()
  // M22: el muro de V-AI-P vive en /vaip, con el tema que se pidió (las
  // noticias que salen por webhook traen ?tema=noticias).
  if (await esCasaDeVaip(curso.id)) redirect(tema && /^[a-z0-9-]+$/.test(tema) ? `/vaip?tema=${tema}` : '/vaip')

  // El grupo es contenido, no estructura: con el acceso vencido no se entra.
  // El índice del curso sí se ve, y de ahí sale el CTA de recompra (§6.3).
  if (!curso.vigente) redirect(`/curso/${slug}`)

  // Cada generación tiene su muro (M16). El alumno ve el suyo y nada más (RLS);
  // el equipo elige cuál con `?gen=`, y por omisión ve el de la generación
  // abierta.
  const soyEquipo = esEquipo(perfil)
  const generaciones = soyEquipo && curso.porGeneraciones ? await generacionesParaEquipo(curso.id) : []
  const generacion = generaciones.find((g) => g.id === gen) ?? curso.generacion
  const cohortId = generacion?.id ?? null

  // M17: los temas filtran; el muro principal (sin `tema`) muestra todo.
  const temas = await temasDelCurso(curso.id)
  const temaElegido = temas.find((t) => t.slug === tema) ?? null
  const feed = await feedDelCurso(curso.id, cohortId, perfil.user_id, {
    pagina: Number(p) || 1,
    porPagina: por === undefined ? 10 : Number(por),
    temaId: temaElegido?.id ?? null,
  })
  const extra: Record<string, string> = gen && generacion?.id === gen ? { gen } : {}

  return (
    <div className="flex flex-col gap-6">
      {/* Sin encabezado propio ni migaja de regreso: el layout del curso ya pone
          el título, el progreso y las pestañas, y la pestaña activa dice dónde
          estás. Repetirlo aquí era ruido y empujaba el contenido hacia abajo. */}
      {/* M22: sin ranking ni «suman puntos». El puntaje era por generación y ya
          se premió al top 3 (Alejandro, 20-oct-2026); el muro queda para
          conversar. El ranking vivo es el de V-AI-P. */}
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
          El grupo es por generación, y todavía no estás en una. Escríbenos y te asignamos la tuya.
        </p>
      ) : (
        <Comunidad
          posts={feed.posts}
          cursoId={curso.id}
          cohortId={cohortId}
          porGeneraciones={curso.porGeneraciones}
          cursoSlug={slug}
          soyEquipo={soyEquipo}
          ruta={`/curso/${slug}/comunidad`}
          rutaDetalle={`/curso/${slug}/comunidad`}
          yo={{ nombre: perfil.full_name || perfil.email, avatar: perfil.avatar_url }}
          invitacion="Pregunta o comparte con tu generación…"
          pagina={feed.pagina}
          paginas={feed.paginas}
          porPagina={feed.porPagina}
          total={feed.total}
          extra={extra}
          temas={temas}
          temaActual={temaElegido?.slug ?? null}
        />
      )}
    </div>
  )
}
