import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AccesoVencido } from '@/components/alumno/acceso-vencido'
import { BarraProgreso } from '@/components/alumno/barra-progreso'
import { CertificadoDelCurso } from '@/components/alumno/certificado-del-curso'
import { IndiceCurso } from '@/components/alumno/indice-curso'
import { SesionesEnVivo } from '@/components/alumno/sesiones-en-vivo'
import { Button } from '@/components/ui/button'
import { cursoDelAlumno } from '@/lib/alumno/consultas'
import { sesionesDelAlumno } from '@/lib/alumno/sesiones'
import { exigirPerfil } from '@/lib/auth/sesion'
import { certificadoDelCurso } from '@/lib/certificados/consultas'
import { revisarElegibilidad } from '@/lib/certificados/elegibilidad'

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

  const curso = await cursoDelAlumno(slug)
  if (!curso) notFound()

  // La policy de cohort_sessions exige pertenecer a la cohorte Y tener acceso
  // vigente: el alumno vencido recibe una lista vacía sin que haya que filtrar.
  const sesiones = await sesionesDelAlumno(slug)

  // El certificado sobrevive al vencimiento: lo ganó, es suyo (§6.3 dice que
  // el progreso no se borra, y un certificado emitido menos todavía).
  const [folio, elegibilidad] = await Promise.all([
    certificadoDelCurso(curso.id),
    revisarElegibilidad(perfil.user_id, curso.id),
  ])

  // Retomar donde se quedó (§3.3): la primera sin completar que esté disponible.
  const planas = curso.modulos.flatMap((m) => m.lecciones)
  const siguiente =
    planas.find((l) => l.desbloqueada && !l.completada) ?? planas.find((l) => l.desbloqueada)

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link
          href="/mis-cursos"
          className="text-sm text-vadai-cyan underline-offset-4 hover:underline"
        >
          ← Mis cursos
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{curso.titulo}</h1>
        {curso.descripcion ? (
          <p className="max-w-2xl text-pretty text-sm text-muted-foreground">
            {curso.descripcion}
          </p>
        ) : null}
      </header>

      <div className="flex max-w-md flex-col gap-3">
        <BarraProgreso
          porcentaje={curso.porcentaje}
          etiqueta={
            curso.totalLecciones === 0
              ? 'Este curso todavía no tiene lecciones'
              : `${curso.completadas} de ${curso.totalLecciones} lecciones · ${curso.porcentaje}%`
          }
        />

        {curso.vigente && siguiente ? (
          <div>
            <Button asChild>
              <Link href={`/curso/${curso.slug}/${siguiente.id}`}>
                {curso.completadas === 0 ? 'Empezar el curso' : 'Continuar'}
              </Link>
            </Button>
          </div>
        ) : null}

        {curso.vigente && curso.diasRestantes !== null ? (
          <p className="text-xs text-muted-foreground">
            Te quedan {curso.diasRestantes} día
            {curso.diasRestantes === 1 ? '' : 's'} de acceso.
          </p>
        ) : null}
      </div>

      {!curso.vigente ? <AccesoVencido curso={curso} /> : null}

      <CertificadoDelCurso
        cursoId={curso.id}
        cursoSlug={curso.slug}
        folio={folio}
        cumple={elegibilidad.cumple}
        faltantes={curso.vigente ? elegibilidad.faltantes : []}
      />

      <SesionesEnVivo sesiones={sesiones} />

      {curso.vigente ? (
        <Link
          href={`/curso/${curso.slug}/comunidad`}
          className="flex items-center justify-between rounded-lg border border-border px-4 py-4 transition-colors hover:border-vadai-cyan/60"
        >
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">Comunidad</span>
            <span className="text-sm text-muted-foreground">
              Preguntas y avances de tu grupo
            </span>
          </span>
          <span className="text-vadai-cyan">→</span>
        </Link>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Contenido</h2>
        {curso.modulos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
            El contenido de este curso se está preparando.
          </p>
        ) : (
          <IndiceCurso curso={curso} />
        )}
      </section>
    </div>
  )
}
