import type { Metadata } from 'next'
import Link from 'next/link'

import { Comunidad } from '@/components/alumno/comunidad'
import { Pestanas, type Pestana } from '@/components/ui-vadai/pestanas'
import { Tarjeta, Titulo } from '@/components/ui-vadai/superficie'
import { misCursos } from '@/lib/alumno/consultas'
import { esEquipo, exigirPerfil } from '@/lib/auth/sesion'
import { cursosPorActividad, feedDelCurso } from '@/lib/comunidad/posts'
import { sellarCanal } from '@/lib/notificaciones/canales'

/**
 * La comunidad, como destino propio de la navegación (21-sep-2026).
 *
 * Antes solo existía dentro del curso: había que entrar a Mis cursos, elegir el
 * curso, y ahí sí, la pestaña Comunidad. Tres clics para ver si alguien
 * contestó. Alejandro lo pidió así: "que puedan llegar a la comunidad desde los
 * botones principales sin necesidad de que entren al curso y luego a
 * comunidad".
 *
 * Con varios cursos se elige con pestañas y un `?curso=`, no con un menú de
 * JavaScript: son enlaces, funcionan sin JS y se pueden compartir.
 *
 * NO lleva `loading.tsx` ni lo necesita: aquí no hay `redirect()` ni
 * `notFound()`, un alumno sin cursos ve su vacío.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Comunidad' }

export default async function PaginaComunidadGeneral({
  searchParams,
}: {
  searchParams: Promise<{ curso?: string; p?: string; por?: string }>
}) {
  const perfil = await exigirPerfil()
  const { curso: pedido, p, por } = await searchParams

  // Ordenados por conversación más reciente, no por como vengan: quien abre
  // "Comunidad" quiere ver donde está pasando algo. Con el orden de `misCursos`
  // caías en el curso base, que suele estar vacío, y parecía que no había nada.
  const cursos = await cursosPorActividad((await misCursos()).filter((c) => c.vigente))

  // Abrir la comunidad apaga su contador. Se sella aquí y no en el layout: el
  // layout corre en cada pantalla del alumno y apagaría el contador sin que
  // nadie hubiera leído nada.
  await sellarCanal(perfil, 'comunidad')

  if (cursos.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <Titulo apoyo="Lo que tu grupo pregunta, comparte y responde.">Comunidad</Titulo>
        <Tarjeta className="border-dashed px-5 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            La comunidad vive dentro de cada curso. Cuando tengas uno con acceso vigente, aquí
            aparecerán sus publicaciones.
          </p>
          <Link
            href="/mis-cursos"
            className="mt-3 inline-block text-sm text-primary underline-offset-4 hover:underline"
          >
            Ir a mis cursos →
          </Link>
        </Tarjeta>
      </div>
    )
  }

  const activo = cursos.find((c) => c.slug === pedido) ?? cursos[0]
  if (!activo) return null

  const feed = await feedDelCurso(activo.id, perfil.user_id, {
    pagina: Number(p) || 1,
    porPagina: por === undefined ? 10 : Number(por),
  })

  const pestanas: Pestana[] = cursos.map((c) => ({
    href: c.slug === cursos[0]?.slug ? '/comunidad' : `/comunidad?curso=${c.slug}`,
    etiqueta: c.titulo,
    activa: c.slug === activo.slug,
  }))

  return (
    <div className="flex flex-col gap-6">
      <Titulo apoyo="Lo que tu grupo pregunta, comparte y responde. Cada publicación y cada comentario suman puntos.">
        Comunidad
      </Titulo>

      {/* Con un solo curso, una fila de pestañas de un elemento es ruido. */}
      {cursos.length > 1 ? <Pestanas pestanas={pestanas} etiqueta="Comunidades de tus cursos" /> : null}

      <Comunidad
        posts={feed.posts}
        cursoId={activo.id}
        cursoSlug={activo.slug}
        soyEquipo={esEquipo(perfil)}
        ruta="/comunidad"
        pagina={feed.pagina}
        paginas={feed.paginas}
        porPagina={feed.porPagina}
        total={feed.total}
        // Al pasar de página no se pierde de qué curso es la comunidad.
        extra={cursos.length > 1 && activo.slug !== cursos[0]?.slug ? { curso: activo.slug } : {}}
      />
    </div>
  )
}
