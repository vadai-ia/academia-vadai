import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { AccesoVencido } from '@/components/alumno/acceso-vencido'
import { CertificadoDelCurso } from '@/components/alumno/certificado-del-curso'
import { ProximaSesionEnlace } from '@/components/alumno/en-vivo'
import { IndiceCurso } from '@/components/alumno/indice-curso'
import { Seccion, Tarjeta } from '@/components/ui-vadai/superficie'
import { Button } from '@/components/ui/button'
import { cursoDelAlumno } from '@/lib/alumno/consultas'
import { sesionesDelCurso } from '@/lib/alumno/sesiones'
import { exigirPerfil } from '@/lib/auth/sesion'
import { proximaOActual } from '@/lib/calendario/estado'
import { hoyCdmx } from '@/lib/calendario/mes'
import { certificadoDelCurso } from '@/lib/certificados/consultas'
import { revisarElegibilidad } from '@/lib/certificados/elegibilidad'
import { esCasaDeVaip } from '@/lib/membresia/consultas'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const curso = await cursoDelAlumno(slug)
  return { title: curso?.titulo ?? 'Curso' }
}

export default async function PaginaCurso({ params }: { params: Promise<{ slug: string }> }) {
  const perfil = await exigirPerfil()
  const { slug } = await params

  // El layout ya lo pidió y `cache()` lo memoriza: esto no cuesta otro viaje.
  const curso = await cursoDelAlumno(slug)
  if (!curso) notFound()
  // M22: las grabaciones y el material de V-AI-P viven en V-AI-P → Clases.
  if (await esCasaDeVaip(curso.id)) redirect('/vaip/clases')

  const [sesiones, folio, elegibilidad] = await Promise.all([
    sesionesDelCurso(slug),
    certificadoDelCurso(curso.id),
    revisarElegibilidad(perfil.user_id, curso.id),
  ])

  // Retomar donde se quedó (§3.3): la primera sin completar que esté disponible.
  const planas = curso.modulos.flatMap((m) => m.lecciones)
  const siguiente =
    planas.find((l) => l.desbloqueada && !l.completada) ?? planas.find((l) => l.desbloqueada)

  const ahora = Date.now()
  const proxima = proximaOActual(sesiones, ahora)

  const certificado = (
    <CertificadoDelCurso
      cursoId={curso.id}
      cursoSlug={curso.slug}
      folio={folio}
      cumple={elegibilidad.cumple}
      faltantes={curso.vigente ? elegibilidad.faltantes : []}
    />
  )

  return (
    <div className="flex flex-col gap-8">
      {/* "Continuar" es la única acción primaria de la pantalla y por eso va
          sola, arriba y grande: en un curso de 8 semanas, nueve de cada diez
          visitas son para retomar donde se quedó. */}
      {curso.vigente && siguiente ? (
        <Tarjeta className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs font-medium tracking-wider text-primary uppercase">
              {curso.completadas === 0 ? 'Empieza por aquí' : 'Continúa donde te quedaste'}
            </span>
            <span className="truncate font-medium">{siguiente.titulo}</span>
          </div>
          <Button asChild variant="acento" size="lg" className="h-10 px-5 text-[0.95rem]">
            <Link href={`/curso/${curso.slug}/${siguiente.id}`}>
              {curso.completadas === 0 ? 'Empezar el curso' : 'Continuar'}
            </Link>
          </Button>
        </Tarjeta>
      ) : null}

      {/* Las sesiones en vivo tienen su propia pestaña (M14 · Fase 2). Aquí
          queda UNA línea con la que sigue: el bloque de ocho tarjetas que vivía
          encima del temario era justo lo que estorbaba para llegar a él. */}
      {curso.vigente && proxima ? (
        <ProximaSesionEnlace
          sesion={proxima}
          href={`/curso/${curso.slug}/en-vivo`}
          hoy={hoyCdmx(ahora)}
        />
      ) : null}

      {!curso.vigente ? <AccesoVencido curso={curso} /> : null}

      {/* Terminado o con certificado: arriba, es la noticia. Lo que falta,
          debajo del temario (22-oct-2026). */}
      {folio || elegibilidad.cumple ? certificado : null}

      <Seccion
        titulo="Contenido del curso"
        apoyo={
          curso.totalLecciones > 0
            ? `${curso.modulos.length} módulo${curso.modulos.length === 1 ? '' : 's'} · ${curso.totalLecciones} lecciones`
            : undefined
        }
      >
        {curso.modulos.length === 0 ? (
          <Tarjeta className="border-dashed px-5 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              El contenido de este curso se está preparando.
            </p>
          </Tarjeta>
        ) : (
          <IndiceCurso curso={curso} />
        )}
      </Seccion>

      {folio || elegibilidad.cumple ? null : certificado}
    </div>
  )
}
