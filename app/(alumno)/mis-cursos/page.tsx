import type { Metadata } from 'next'
import Link from 'next/link'

import { RenderRico } from '@/components/alumno/render-rico'
import { TarjetaCurso } from '@/components/alumno/tarjeta-curso'
import { Progreso, Seccion, Tarjeta, TarjetaEnlace } from '@/components/ui-vadai/superficie'
import { Button } from '@/components/ui/button'
import { resumenDelAlumno } from '@/lib/alumno/resumen'
import { exigirPerfil, nombreVisible } from '@/lib/auth/sesion'

export const metadata: Metadata = { title: 'Inicio' }
export const dynamic = 'force-dynamic'

function saludo(): string {
  const hora = Number(
    new Intl.DateTimeFormat('es-MX', { hour: 'numeric', hour12: false, timeZone: 'America/Mexico_City' }).format(
      new Date()
    )
  )
  if (hora < 12) return 'Buenos días'
  if (hora < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function fechaSesion(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Mexico_City',
  }).format(new Date(iso))
}

function fechaCorta(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long' }).format(new Date(iso))
}

/**
 * Tablero del alumno: la pantalla de inicio de la plataforma.
 *
 * Antes esto era una lista de tarjetas de cursos y nada más. El problema no era
 * que se viera pobre, era que todo lo demás resultaba invisible: había que
 * entrar a un curso para enterarse de que había sesión en vivo mañana, y el
 * blog solo existía si alguien recordaba que estaba en el menú.
 *
 * El orden de la pantalla es una decisión, no una lista:
 *
 *   1. Retomar el curso. En un curso de ocho semanas, casi toda visita es para
 *      seguir donde se quedó. Va arriba, solo, y con la única acción grande de
 *      la pantalla — una vista con seis botones del mismo peso no tiene ninguno.
 *   2. Lo que caduca: la sesión en vivo y el anuncio. Sirven hoy o no sirven.
 *   3. Los cursos, para navegar.
 *   4. Blog y certificados, que se consultan cuando se buscan.
 */
export default async function PaginaInicio() {
  const [perfil, resumen] = await Promise.all([exigirPerfil(), resumenDelAlumno()])

  const { retomar, proximaSesion, anuncio, entradas, cursos, certificados } = resumen
  const avanceGlobal =
    resumen.leccionesTotales === 0
      ? 0
      : Math.round((resumen.leccionesHechas / resumen.leccionesTotales) * 100)

  return (
    <div className="flex flex-col gap-10">
      {/* --- Retomar --------------------------------------------------- */}
      {retomar ? (
        <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-vadai-navy via-vadai-azul to-vadai-cyan p-6 text-white sm:p-8">
          {/* Halo de marca. `aria-hidden`: es atmósfera, no contenido. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-vadai-lima/20 blur-3xl"
          />

          <div className="relative flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <p className="text-sm text-white/70">
                {saludo()}, {nombreVisible(perfil)}
              </p>
              <p className="text-xs font-medium tracking-[0.18em] text-vadai-lima uppercase">
                {retomar.empezando ? 'Empieza por aquí' : 'Continúa donde te quedaste'}
              </p>
              <h1 className="text-2xl leading-tight font-medium text-balance sm:text-3xl">
                {retomar.leccion.titulo}
              </h1>
              <p className="text-sm text-white/70">{retomar.curso.titulo}</p>
            </div>

            <div className="flex max-w-md flex-col gap-1.5">
              <div className="flex items-baseline justify-between text-xs text-white/70">
                <span>
                  {retomar.curso.completadas} de {retomar.curso.totalLecciones} lecciones
                </span>
                <span className="tabular-nums">{retomar.curso.porcentaje}%</span>
              </div>
              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-white/20"
                role="progressbar"
                aria-valuenow={retomar.curso.porcentaje}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Avance del curso"
              >
                <span
                  className="block h-full rounded-full bg-vadai-lima"
                  style={{ width: `${retomar.curso.porcentaje}%` }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className="bg-vadai-lima text-vadai-navy hover:brightness-105"
              >
                <Link href={`/curso/${retomar.curso.slug}/${retomar.leccion.id}`}>
                  {retomar.empezando ? 'Empezar el curso' : 'Continuar'}
                </Link>
              </Button>
              <Link
                href={`/curso/${retomar.curso.slug}`}
                className="rounded-lg px-2 py-1 text-sm text-white/80 underline-offset-4 hover:text-white hover:underline focus-visible:ring-3 focus-visible:ring-white/40 focus-visible:outline-none"
              >
                Ver el temario
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="flex flex-col gap-1.5">
          <h1 className="text-[1.75rem] leading-tight font-medium tracking-tight">
            {saludo()}, {nombreVisible(perfil)}
          </h1>
          <p className="text-[0.95rem] text-muted-foreground">
            {/* Sin lección que retomar hay tres motivos distintos, y felicitar
                por "completarlo todo" a quien no ha visto nada —porque su curso
                todavía no tiene lecciones— es el peor de los tres mensajes. */}
            {cursos.length === 0
              ? 'Aquí aparecerán tus cursos.'
              : resumen.leccionesTotales === 0
                ? 'Tu curso todavía no tiene lecciones publicadas. En cuanto se abran, aparecen aquí.'
                : 'Ya completaste todo lo disponible. Bien hecho.'}
          </p>
        </section>
      )}

      {/* --- Lo que caduca --------------------------------------------- */}
      {proximaSesion || anuncio ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {proximaSesion ? (
            <Tarjeta className="flex flex-col gap-3 p-5">
              <span className="flex items-center gap-2 text-xs font-medium tracking-[0.15em] text-primary uppercase">
                <PuntoVivo /> Próxima sesión en vivo
              </span>
              <div className="flex flex-col gap-1">
                <h2 className="font-medium text-balance">{proximaSesion.titulo}</h2>
                <p className="text-sm text-muted-foreground">
                  {fechaSesion(proximaSesion.programadaEn)} <span className="text-xs">(CDMX)</span>
                </p>
              </div>
              {proximaSesion.meetUrl ? (
                <div>
                  <Button asChild variant="outline" size="sm">
                    <a href={proximaSesion.meetUrl} target="_blank" rel="noreferrer noopener">
                      Entrar a la sesión
                    </a>
                  </Button>
                </div>
              ) : null}
            </Tarjeta>
          ) : null}

          {anuncio ? (
            <Tarjeta className="flex flex-col gap-2 border-accent/50 bg-accent/10 p-5">
              <span className="text-xs font-medium tracking-[0.15em] text-foreground/70 uppercase">
                Anuncio
              </span>
              <h2 className="font-medium text-balance">{anuncio.titulo}</h2>
              {anuncio.contenido ? <RenderRico contenido={anuncio.contenido} /> : null}
            </Tarjeta>
          ) : null}
        </div>
      ) : null}

      {/* --- Cursos ----------------------------------------------------- */}
      {cursos.length === 0 ? (
        <Tarjeta className="border-dashed px-5 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Todavía no tienes ningún curso asignado.
          </p>
          <a
            href="mailto:hola@vadai.com.mx?subject=No%20veo%20mi%20curso"
            className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline"
          >
            Si compraste uno, escríbenos
          </a>
        </Tarjeta>
      ) : (
        <Seccion
          titulo={cursos.length === 1 ? 'Tu curso' : 'Tus cursos'}
          apoyo={
            resumen.leccionesTotales > 0
              ? `${resumen.leccionesHechas} de ${resumen.leccionesTotales} lecciones · ${avanceGlobal}% en total`
              : undefined
          }
        >
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cursos.map((curso) => (
              <li key={curso.id} className="flex">
                <TarjetaCurso curso={curso} />
              </li>
            ))}
          </ul>
        </Seccion>
      )}

      {/* --- Blog y certificados ---------------------------------------- */}
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <Seccion
          titulo="Del blog"
          accion={
            <Link href="/blog" className="text-sm text-primary underline-offset-4 hover:underline">
              Ver todo →
            </Link>
          }
        >
          {entradas.length === 0 ? (
            <Tarjeta className="border-dashed px-5 py-8 text-center text-sm text-muted-foreground">
              Todavía no hay entradas publicadas.
            </Tarjeta>
          ) : (
            <ul className="flex flex-col gap-2">
              {entradas.map((entrada) => (
                <li key={entrada.id}>
                  <TarjetaEnlace href="/blog" className="flex items-baseline justify-between gap-4 p-4">
                    <span className="min-w-0 font-medium text-pretty">{entrada.titulo}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {fechaCorta(entrada.publicadoEn)}
                    </span>
                  </TarjetaEnlace>
                </li>
              ))}
            </ul>
          )}
        </Seccion>

        <Seccion titulo="Tus certificados">
          {certificados.length === 0 ? (
            <Tarjeta className="flex flex-col gap-3 p-5">
              <p className="text-sm text-muted-foreground">
                Al completar un curso aparecerá aquí, con folio verificable.
              </p>
              {resumen.leccionesTotales > 0 ? (
                <Progreso porcentaje={avanceGlobal} etiqueta={`${avanceGlobal}% del total`} />
              ) : null}
            </Tarjeta>
          ) : (
            <ul className="flex flex-col gap-2">
              {certificados.map((c) => (
                <li key={c.folio}>
                  <TarjetaEnlace href="/perfil" className="flex flex-col gap-1 p-4">
                    <span className="font-medium text-pretty">{c.curso}</span>
                    <span className="font-mono text-xs text-muted-foreground">{c.folio}</span>
                  </TarjetaEnlace>
                </li>
              ))}
            </ul>
          )}
        </Seccion>
      </div>
    </div>
  )
}

/** Punto que late, para lo que es en vivo. Se detiene con reduced-motion. */
function PuntoVivo() {
  return (
    <span aria-hidden className="relative flex size-2">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:hidden" />
      <span className="relative inline-flex size-2 rounded-full bg-primary" />
    </span>
  )
}
