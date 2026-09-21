import type { ReactNode } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Pestanas, type Pestana } from '@/components/ui-vadai/pestanas'
import { Progreso } from '@/components/ui-vadai/superficie'
import { cursoDelAlumno } from '@/lib/alumno/consultas'
import { sesionesDelAlumno } from '@/lib/alumno/sesiones'
import { exigirPerfil } from '@/lib/auth/sesion'
import { estadoDe, proximaOActual } from '@/lib/calendario/estado'
import { hoyCdmx, partesCdmx } from '@/lib/calendario/mes'

/**
 * Marco de un curso: encabezado con progreso y fila de pestañas.
 *
 * Es la estructura que Skool usa para un grupo, y el cambio más grande de la
 * plataforma. Antes cada parte del curso era una página suelta: al contenido se
 * llegaba por el índice, a la comunidad por una tarjeta a media página, a las
 * sesiones por otra. No había manera de saber qué más había ahí dentro sin
 * bajar a buscarlo, y al entrar a una lección se perdía por completo la noción
 * de estar dentro de un curso.
 *
 * Con el marco en el layout, el encabezado y las pestañas sobreviven a la
 * navegación entre secciones: no se redibujan, no parpadean, y el subrayado
 * siempre dice dónde estás.
 *
 * NO lleva `loading.tsx`. El `notFound()` de aquí abajo es control de acceso —
 * un curso al que no estás inscrito no debe existir para ti— y un límite de
 * Suspense haría que la respuesta saliera 200. Ver components/marca/esqueleto.tsx.
 */
export default async function LayoutCurso({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ slug: string }>
}) {
  await exigirPerfil()
  const { slug } = await params

  // Memorizados con cache(): las páginas vuelven a pedirlos y no cuestan otro viaje.
  const [curso, sesiones] = await Promise.all([cursoDelAlumno(slug), sesionesDelAlumno(slug)])
  if (!curso) notFound()

  const base = `/curso/${curso.slug}`

  // La insignia dice lo único que urge saber desde cualquier pestaña: si la
  // sesión está pasando o si es hoy. Sin contador: un "8" no significa nada.
  const ahora = Date.now()
  const actual = proximaOActual(sesiones, ahora)
  const insignia = !actual
    ? undefined
    : estadoDe(actual.programadaEn, ahora) !== 'proxima'
      ? 'Ahora'
      : partesCdmx(actual.programadaEn).fecha === hoyCdmx(ahora)
        ? 'Hoy'
        : undefined

  const pestanas: Pestana[] = [
    { href: base, etiqueta: 'Contenido', exacto: true },
    // Con el acceso vencido las sesiones ya no se leen (la policy las esconde),
    // así que la pestaña se pinta apagada con su motivo en vez de desaparecer.
    ...(sesiones.length > 0 || !curso.vigente
      ? [
          {
            href: `${base}/en-vivo`,
            etiqueta: 'En vivo',
            insignia,
            tono: insignia === 'Ahora' ? ('vivo' as const) : undefined,
            deshabilitada: !curso.vigente,
            motivo: 'Tu acceso venció. Renuévalo para volver a las sesiones en vivo.',
          } satisfies Pestana,
        ]
      : []),
    {
      href: `${base}/comunidad`,
      etiqueta: 'Comunidad',
      deshabilitada: !curso.vigente,
      motivo: 'Tu acceso venció. Renuévalo para volver a la comunidad.',
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <Link
          href="/mis-cursos"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <span aria-hidden>←</span> Mis cursos
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-[1.75rem] leading-tight font-medium tracking-tight text-balance">
              {curso.titulo}
            </h1>
            {curso.vigente && curso.diasRestantes !== null ? (
              <p className="text-sm text-muted-foreground">
                Te quedan {curso.diasRestantes} día{curso.diasRestantes === 1 ? '' : 's'} de acceso.
              </p>
            ) : !curso.vigente ? (
              <p className="text-sm text-destructive">
                Tu acceso venció. Sigues viendo tu avance, pero el contenido está bloqueado.
              </p>
            ) : null}
          </div>

          {/* El progreso vive en el encabezado y no dentro de una sección: es la
              respuesta a "¿cómo voy?", que es lo primero que se pregunta al
              entrar, y así se ve desde cualquier pestaña. */}
          {curso.totalLecciones > 0 ? (
            <div className="flex w-full max-w-xs flex-col gap-1.5 sm:w-56">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-muted-foreground">Tu avance</span>
                <span className="font-medium tabular-nums">{curso.porcentaje}%</span>
              </div>
              <Progreso
                porcentaje={curso.porcentaje}
                etiqueta={`${curso.completadas} de ${curso.totalLecciones} lecciones completadas`}
              />
            </div>
          ) : null}
        </div>
      </header>

      <Pestanas pestanas={pestanas} />

      {children}
    </div>
  )
}
