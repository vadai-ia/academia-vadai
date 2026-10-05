import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AgregarAlumnos } from '@/components/admin/agregar-alumnos'
import { ArbolCurso } from '@/components/admin/arbol-curso'
import { AsignarGeneracion } from '@/components/admin/asignar-generacion'
import { CalendarioDeGeneracion } from '@/components/admin/calendario-de-generacion'
import { EncabezadoGeneracion } from '@/components/admin/encabezado-generacion'
import { FormularioCurso } from '@/components/admin/formulario-curso'
import { NuevaGeneracion } from '@/components/admin/nueva-generacion'
import { Paginacion } from '@/components/admin/paginacion'
import { TablaInscritos } from '@/components/admin/tabla-inscritos'
import { Pestanas, type Pestana } from '@/components/ui-vadai/pestanas'
import { Badge } from '@/components/ui/badge'
import { obtenerCurso } from '@/lib/admin/consultas'
import { listarEmpresas } from '@/lib/admin/empresas'
import { generacionesDelCurso, leccionesLigables } from '@/lib/admin/generaciones'
import { candidatosParaCurso, inscritosDelCurso } from '@/lib/admin/inscritos'
import { ETIQUETA_ESTADO_CURSO } from '@/lib/admin/tipos'
import { esAdmin, exigirEquipo } from '@/lib/auth/sesion'
import { esPorGeneraciones, generacionPorOmision } from '@/lib/generaciones'

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
  /** El módulo del árbol que se pide abierto (`?modulo=<id>` o `todos`). */
  modulo?: string
  /**
   * La pestaña (M16): el id de una generación, `nueva` para crear una, `sin`
   * para los inscritos sin generación. Sin parámetro: la abierta a
   * inscripciones, o la más reciente.
   */
  gen?: string
  /** Aviso que deja `crearGeneracion` al redirigir a la pestaña nueva. */
  aviso?: string
}

/**
 * Inscritos por página (24-sep-2026). La tabla pintaba a los 188 de una vez,
 * cada uno con sus formularios: era la mayor parte de un HTML de 11 MB.
 * Veinticinco, como en /admin/alumnos: es lo que cabe en una pantalla sin
 * desplazarse, y con el buscador y el filtro de empresa se llega a cualquiera.
 */
const INSCRITOS_POR_PAGINA = 25

/**
 * La página del curso gira alrededor de la generación (M16, 3-oct-2026).
 *
 * En un curso por generaciones cada pestaña es una generación, y todo lo que
 * cuelga de ella —contenido, sesiones en vivo, alumnos— es de esa generación:
 * es lo que ven sus alumnos y nada más. La última pestaña crea la siguiente.
 * Un curso sin generaciones se ve como siempre: su contenido es común.
 */
export default async function PaginaCurso({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Parametros>
}) {
  const perfil = await exigirEquipo()
  // El community manager (0036) opera sesiones, grabaciones y alumnos de los
  // cursos que existen; la estructura —generaciones, módulos, lecciones, datos
  // del curso— y las inscripciones nuevas son de admin.
  const soyAdmin = esAdmin(perfil)
  const { id } = await params
  const { gen: genCruda, aviso, ...filtros } = await searchParams
  const genPedida = genCruda === 'nueva' && !soyAdmin ? undefined : genCruda

  // Todo en una sola ronda (24-sep-2026): el id de la URL es el id del curso,
  // así que nada tiene que esperar al curso para arrancar. Si el curso no
  // existe, las demás vuelven vacías y se descartan con el notFound().
  const [curso, generaciones, candidatos, empresas] = await Promise.all([
    obtenerCurso(id),
    generacionesDelCurso(id),
    candidatosParaCurso(id, filtros.buscar ?? ''),
    listarEmpresas(),
  ])
  if (!curso) notFound()
  // La fila del curso sin su árbol, para lo que viaja al navegador.
  const { modulos: _modulos, ...datosDelCurso } = curso

  const porGeneraciones = esPorGeneraciones(curso.course_type)
  const porOmision = porGeneraciones ? generacionPorOmision(generaciones) : null
  const generacion =
    genPedida === 'nueva' || genPedida === 'sin'
      ? null
      : (generaciones.find((g) => g.id === genPedida) ?? porOmision)
  const vista: 'nueva' | 'sin' | 'generacion' | 'curso' =
    genPedida === 'nueva' ? 'nueva' : genPedida === 'sin' ? 'sin' : generacion ? 'generacion' : 'curso'
  const cohortId = generacion?.id ?? null

  // La pestaña acota los inscritos y las lecciones ligables; con eso resuelto
  // van en paralelo.
  const filtrosInscritos = { ...filtros, gen: vista === 'sin' ? 'sin' : (cohortId ?? undefined) }
  const [{ visibles, resumen }, ligables] = await Promise.all([
    inscritosDelCurso(id, filtrosInscritos),
    leccionesLigables(id, cohortId),
  ])

  // El árbol solo con los módulos de la pestaña.
  const arbol = {
    ...curso,
    modulos: curso.modulos.filter((m) => (porGeneraciones ? m.cohort_id === cohortId : m.cohort_id === null)),
  }

  const base = `/admin/cursos/${curso.id}`

  const paginas = Math.max(1, Math.ceil(visibles.length / INSCRITOS_POR_PAGINA))
  const pagina = Math.min(Math.max(1, Number(filtros.pagina) || 1), paginas)
  const desde = (pagina - 1) * INSCRITOS_POR_PAGINA

  const pestanas: Pestana[] = [
    ...generaciones.map((g) => ({
      href: `${base}?gen=${g.id}`,
      etiqueta: g.name,
      activa: vista === 'generacion' && g.id === cohortId,
      insignia: g.inscritos || undefined,
      motivo: g.estado === 'abierta' ? 'Abierta a inscripciones' : g.estado === 'terminada' ? 'Terminada' : undefined,
    })),
    ...(resumen.sinGeneracion > 0 || vista === 'sin'
      ? [{ href: `${base}?gen=sin`, etiqueta: 'Sin generación', activa: vista === 'sin', insignia: resumen.sinGeneracion }]
      : []),
    ...(soyAdmin ? [{ href: `${base}?gen=nueva`, etiqueta: '+ Nueva generación', activa: vista === 'nueva' }] : []),
  ]

  const propuesta = `Generación ${generaciones.length + 1}`
  const grabaciones = generacion ? generacion.sesiones.filter((s) => s.recording_lesson_id).length : 0

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <Link href="/admin/cursos" className="text-sm text-primary underline-offset-4 hover:underline">
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
          <Link href={`/curso/${curso.slug}`} className="text-primary underline-offset-4 hover:underline">
            Verlo en el portal de alumnos →
          </Link>
          <Link
            href={`/curso/${curso.slug}/comunidad${cohortId ? `?gen=${cohortId}` : ''}`}
            className="text-primary underline-offset-4 hover:underline"
          >
            Comunidad →
          </Link>
          <a href="#inscritos" className="text-primary underline-offset-4 hover:underline">
            Alumnos ↓
          </a>
        </p>
      </header>

      {porGeneraciones ? (
        <Pestanas pestanas={pestanas} etiqueta="Generaciones del curso" />
      ) : (
        <p className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-border bg-muted/40 px-4 py-3 text-sm">
          <span>Curso sin generaciones: todo el contenido es común a quien lo tenga.</span>
          {vista !== 'nueva' && soyAdmin ? (
            <Link href={`${base}?gen=nueva`} className="text-primary underline-offset-4 hover:underline">
              Crear la primera generación →
            </Link>
          ) : null}
        </p>
      )}

      {vista === 'nueva' ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">Nueva generación</h2>
          <NuevaGeneracion
            cursoId={curso.id}
            porGeneraciones={porGeneraciones}
            modulosDelCurso={curso.modulos.filter((m) => m.cohort_id === null).length}
            generaciones={generaciones.map((g) => ({ id: g.id, nombre: g.name, modulos: g.modulos }))}
            propuesta={propuesta}
          />
        </section>
      ) : null}

      {vista === 'generacion' && generacion ? (
        <EncabezadoGeneracion
          generacion={generacion}
          grabaciones={grabaciones}
          aviso={aviso ?? null}
          soloLectura={!soyAdmin}
        />
      ) : null}

      {vista === 'generacion' || vista === 'curso' ? (
        <ArbolCurso curso={arbol} moduloAbierto={filtros.modulo ?? null} cohortId={cohortId} soloLectura={!soyAdmin} />
      ) : null}

      {/* --- Sesiones en vivo ---------------------------------------------
          El calendario de la generación, editable aquí mismo: agendar una o la
          serie, cambiar fecha, hora y liga, borrar, y mandar las fechas por
          correo. Agendar o mover una sesión avisa en la campana del alumno. */}
      {vista === 'generacion' && generacion ? (
        <section className="flex flex-col gap-4 border-t border-border pt-8" id="sesiones">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Sesiones en vivo</h2>
            <p className="text-sm text-muted-foreground">
              Cambiar una sesión avisa a los inscritos de esta generación en su campana
            </p>
          </div>
          <CalendarioDeGeneracion
            generacion={generacion}
            ligables={ligables}
            correoAdmin={perfil.email}
            compacto
            sesionAbierta={filtros.sesion ?? null}
            prefijo={`?gen=${generacion.id}&`}
          />
        </section>
      ) : null}

      {/* --- Alumnos ----------------------------------------------------------
          Tabla con resumen, filtros en la URL, desplazamiento propio y ficha
          por persona. La inscripción se puede crear desde sus dos lados: aquí
          y en la fila de cada persona en /admin/alumnos. */}
      {vista !== 'nueva' ? (
        <section className="flex flex-col gap-5 border-t border-border pt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">
              {vista === 'sin' ? 'Alumnos sin generación' : 'Alumnos'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {vista === 'sin'
                ? `${resumen.sinGeneracion} sin generación · ${resumen.enCurso} en el curso`
                : generacion
                  ? `${generacion.inscritos} en esta generación · ${resumen.enCurso} en el curso`
                  : `${resumen.enCurso} inscrito${resumen.enCurso === 1 ? '' : 's'}`}
            </p>
          </div>

          {/* Solo si hay alguien: con cero, el aviso rojo era una alarma falsa. */}
          {vista === 'sin' && resumen.sinGeneracion > 0 ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
              Estas personas tienen el curso pero ninguna generación: no ven contenido, sesiones ni
              comunidad hasta que les asignes una. Márcalas y elige la generación abajo.
            </p>
          ) : null}

          <TablaInscritos
            cursoId={curso.id}
            inscritos={visibles.slice(desde, desde + INSCRITOS_POR_PAGINA)}
            resumen={resumen}
            empresas={empresas}
            filtros={filtrosInscritos}
            generaciones={
              porGeneraciones ? generaciones.map((g) => ({ id: g.id, nombre: g.name, estado: g.estado })) : []
            }
          />

          {porGeneraciones && generaciones.length > 0 && visibles.length > 0 ? (
            <AsignarGeneracion
              cursoId={curso.id}
              generaciones={generaciones.map((g) => ({ id: g.id, nombre: g.name, estado: g.estado }))}
              actual={cohortId}
            />
          ) : null}

          <Paginacion
            pagina={pagina}
            paginas={paginas}
            total={visibles.length}
            porPagina={INSCRITOS_POR_PAGINA}
            hrefDe={(p) => {
              // Conserva los filtros y la pestaña; sin ellos, pasar de página
              // devolvería a la lista completa.
              const params = new URLSearchParams()
              for (const [k, val] of Object.entries(filtrosInscritos)) if (val) params.set(k, String(val))
              if (p > 1) params.set('pagina', String(p))
              const cadena = params.toString()
              return `${base}${cadena ? `?${cadena}` : ''}#inscritos`
            }}
          />

          {!soyAdmin ? null : curso.status === 'archived' ? (
            <p className="text-sm text-muted-foreground">
              El curso está archivado: no se le agrega gente. Restáuralo desde Cursos → Archivados.
            </p>
          ) : (
            <AgregarAlumnos
              cursoId={curso.id}
              candidatos={candidatos}
              buscar={filtros.buscar ?? ''}
              generaciones={
                porGeneraciones ? generaciones.map((g) => ({ id: g.id, nombre: g.name, estado: g.estado })) : []
              }
              propuesta={cohortId ?? porOmision?.id ?? ''}
              empresas={empresas}
              reinicio={resumen.enCurso}
            />
          )}
        </section>
      ) : null}

      {soyAdmin ? (
      <section className="flex max-w-2xl flex-col gap-4 border-t border-border pt-8">
        <h2 className="text-lg font-semibold">Datos del curso</h2>
        {/* Solo la fila del curso, sin `modulos`: FormularioCurso es de
            cliente y lo que recibe viaja al navegador. Con el curso entero
            se llevaba el árbol de TODAS las generaciones a la pestaña de una
            (M16), aunque el formulario solo edita título, slug y descripción. */}
        <FormularioCurso curso={datosDelCurso} />
        {!porGeneraciones && generaciones.length === 0 ? null : (
          <p className="text-xs text-muted-foreground">
            El tipo «Por generaciones» no se cambia aquí: se activa creando la primera generación, y
            un curso con generaciones ya no vuelve atrás.
          </p>
        )}
      </section>
      ) : null}

    </div>
  )
}
