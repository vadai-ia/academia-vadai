import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AgregarAlumnos } from '@/components/admin/agregar-alumnos'
import { ArbolCurso } from '@/components/admin/arbol-curso'
import { CalendarioDeCohorte } from '@/components/admin/calendario-de-cohorte'
import { FormularioCurso } from '@/components/admin/formulario-curso'
import { NuevaCohorte } from '@/components/admin/nueva-cohorte'
import { Paginacion } from '@/components/admin/paginacion'
import { TablaInscritos } from '@/components/admin/tabla-inscritos'
import { Badge } from '@/components/ui/badge'
import { cohortesDelCurso, leccionesLigables, obtenerCohorte } from '@/lib/admin/cohortes'
import { obtenerCurso } from '@/lib/admin/consultas'
import { listarEmpresas } from '@/lib/admin/empresas'
import { candidatosParaCurso, inscritosDelCurso } from '@/lib/admin/inscritos'
import { ETIQUETA_ESTADO_CURSO } from '@/lib/admin/tipos'
import { exigirAdmin } from '@/lib/auth/sesion'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const curso = await obtenerCurso(id)
  return { title: curso?.title ?? 'Curso' }
}

type Parametros = {
  q?: string
  acceso?: string
  empresa?: string
  orden?: string
  buscar?: string
  /** La sesión que se pide ver abierta para editar (`?sesion=<id>`). */
  sesion?: string
  /** Página de la tabla de inscritos (`?pagina=2`). */
  pagina?: string
}

/**
 * Inscritos por página (24-sep-2026). La tabla pintaba a los 188 de una vez,
 * cada uno con sus formularios: era la mayor parte de un HTML de 11 MB. Con
 * cincuenta cabe una empresa entera en una página y la pantalla baja a
 * cientos de KB.
 */
const INSCRITOS_POR_PAGINA = 50

export default async function PaginaCurso({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Parametros>
}) {
  const perfil = await exigirAdmin()
  const { id } = await params
  const filtros = await searchParams

  const curso = await obtenerCurso(id)
  if (!curso) notFound()

  // Independientes entre sí: en serie serían cinco viajes encadenados.
  const [cohortes, { visibles, resumen }, candidatos, empresas, ligables] = await Promise.all([
    cohortesDelCurso(curso.id),
    inscritosDelCurso(curso.id, filtros),
    candidatosParaCurso(curso.id, filtros.buscar ?? ''),
    listarEmpresas(),
    leccionesLigables(curso.id),
  ])
  // Las sesiones de cada cohorte, para editarlas aquí sin ir a la cohorte
  // (pedido 21-sep-2026). Casi siempre es una cohorte; si son varias, cada
  // una va en su propio bloque plegable.
  const calendarios = (await Promise.all(cohortes.map((c) => obtenerCohorte(c.id)))).filter(
    (c): c is NonNullable<typeof c> => c !== null
  )

  const paginas = Math.max(1, Math.ceil(visibles.length / INSCRITOS_POR_PAGINA))
  const pagina = Math.min(Math.max(1, Number(filtros.pagina) || 1), paginas)
  const desde = (pagina - 1) * INSCRITOS_POR_PAGINA

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-1">
        <Link
          href="/admin/cursos"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          ← Cursos
        </Link>
        <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
          {curso.title}
          <Badge variant={curso.status === 'published' ? 'default' : 'secondary'}>
            {ETIQUETA_ESTADO_CURSO[curso.status]}
          </Badge>
          {curso.is_default ? (
            <Badge className="bg-vadai-lima text-vadai-navy" title="Todo alumno lo recibe al darse de alta">
              Base
            </Badge>
          ) : null}
        </h1>

        {/* El equipo entra al curso sin estar inscrito. Es la única puerta a la
            comunidad y a los hilos de comentarios, que se moderan desde ahí. */}
        <p className="flex flex-wrap gap-4 pt-1 text-sm">
          <Link
            href={`/curso/${curso.slug}`}
            className="text-primary underline-offset-4 hover:underline"
          >
            Verlo como alumno →
          </Link>
          <Link
            href={`/curso/${curso.slug}/comunidad`}
            className="text-primary underline-offset-4 hover:underline"
          >
            Comunidad →
          </Link>
          <a href="#inscritos" className="text-primary underline-offset-4 hover:underline">
            Alumnos ↓
          </a>
        </p>
      </header>

      <ArbolCurso curso={curso} />

      <section className="flex flex-col gap-4 border-t border-border pt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-medium">Generaciones</h2>
          <p className="text-sm text-muted-foreground">
            Grupos con calendario de sesiones en vivo
          </p>
        </div>

        {cohortes.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {cohortes.map((cohorte) => (
              <li key={cohorte.id}>
                <Link
                  href={`/admin/cohortes/${cohorte.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 transition-colors hover:border-primary/60"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-medium">{cohorte.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {cohorte.starts_on ? `Inicia ${cohorte.starts_on}` : 'Sin fecha de inicio'}
                    </span>
                  </span>
                  <span className="flex shrink-0 gap-4 text-xs text-muted-foreground">
                    <span>{cohorte.totalSesiones} sesiones</span>
                    <span>{cohorte.inscritos} inscritos</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        <NuevaCohorte cursoId={curso.id} reinicio={cohortes.length} />
      </section>

      {/* --- Sesiones en vivo ---------------------------------------------
          El calendario de cada cohorte, editable aquí mismo: agendar una o la
          serie, cambiar fecha, hora y liga, borrar, y mandar las fechas por
          correo. Agendar o mover una sesión avisa en la campana del alumno. */}
      <section className="flex flex-col gap-4 border-t border-border pt-8" id="sesiones">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Sesiones en vivo</h2>
          <p className="text-sm text-muted-foreground">
            Cambiar una sesión avisa a los inscritos en su campana
          </p>
        </div>

        {calendarios.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
            Crea una generación arriba para agendar sesiones.
          </p>
        ) : (
          calendarios.map((cohorte, i) => (
            <details
              key={cohorte.id}
              open={i === 0}
              className="group/calendario rounded-[10px] border border-border"
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3 font-medium select-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2">
                  <span aria-hidden className="text-muted-foreground transition-transform group-open/calendario:rotate-90">
                    ›
                  </span>
                  {cohorte.name}
                </span>
                <Link
                  href={`/admin/cohortes/${cohorte.id}`}
                  className="text-xs font-normal text-primary underline-offset-4 hover:underline"
                >
                  Abrir la generación →
                </Link>
              </summary>
              <div className="border-t border-border px-4 py-4">
                <CalendarioDeCohorte
                  cohorte={cohorte}
                  ligables={ligables}
                  correoAdmin={perfil.email}
                  compacto
                  sesionAbierta={filtros.sesion ?? null}
                />
              </div>
            </details>
          ))
        )}
      </section>

      {/* --- Alumnos ----------------------------------------------------------
          Tabla con resumen, filtros en la URL, desplazamiento propio y ficha
          por persona. La inscripción se puede crear desde sus dos lados: aquí
          y en la fila de cada persona en /admin/alumnos. */}
      <section className="flex flex-col gap-5 border-t border-border pt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Alumnos</h2>
          <p className="text-sm text-muted-foreground">
            {resumen.total} inscrito{resumen.total === 1 ? '' : 's'}
          </p>
        </div>

        <TablaInscritos
          cursoId={curso.id}
          inscritos={visibles.slice(desde, desde + INSCRITOS_POR_PAGINA)}
          resumen={resumen}
          empresas={empresas}
          filtros={filtros}
        />

        <Paginacion
          pagina={pagina}
          paginas={paginas}
          total={visibles.length}
          porPagina={INSCRITOS_POR_PAGINA}
          hrefDe={(p) => {
            // Conserva los filtros de la tabla; sin ellos, pasar de página
            // devolvería a la lista completa.
            const params = new URLSearchParams()
            for (const [k, val] of Object.entries(filtros)) if (val) params.set(k, String(val))
            if (p > 1) params.set('pagina', String(p))
            const cadena = params.toString()
            return `/admin/cursos/${curso.id}${cadena ? `?${cadena}` : ''}#inscritos`
          }}
        />

        {curso.status === 'archived' ? (
          <p className="text-sm text-muted-foreground">
            El curso está archivado: no se le agrega gente. Restáuralo desde Cursos → Archivados.
          </p>
        ) : (
          <AgregarAlumnos
            cursoId={curso.id}
            candidatos={candidatos}
            buscar={filtros.buscar ?? ''}
            grupos={cohortes.map((c) => ({ id: c.id, nombre: c.name }))}
            empresas={empresas}
            reinicio={resumen.total}
          />
        )}
      </section>

      <section className="flex max-w-2xl flex-col gap-4 border-t border-border pt-8">
        <h2 className="text-lg font-semibold">Datos del curso</h2>
        <FormularioCurso curso={curso} />
      </section>
    </div>
  )
}
