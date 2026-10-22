import type { Metadata } from 'next'
import Link from 'next/link'

import { AvisoInstalar } from '@/components/alumno/instalar-app'
import { AgregarAlCalendario } from '@/components/alumno/agregar-al-calendario'
import { RenderRico } from '@/components/alumno/render-rico'
import { TarjetaCurso } from '@/components/alumno/tarjeta-curso'
import { LogoVaip } from '@/components/marca/logo-vaip'
import { Avatar, Seccion, Tarjeta, TarjetaEnlace } from '@/components/ui-vadai/superficie'
import { Button } from '@/components/ui/button'
import { resumenDelAlumno, type PublicacionBreve } from '@/lib/alumno/resumen'
import { exigirPerfil, nombreVisible } from '@/lib/auth/sesion'
import { describirHorario } from '@/lib/calendario/enlaces'
import { estadoDe } from '@/lib/calendario/estado'

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

function fechaCorta(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', timeZone: 'America/Mexico_City' }).format(
    new Date(iso)
  )
}

/** ¿Se puede entrar ya? La misma regla en toda la plataforma (lib/calendario/estado). */
function abierta(programadaEn: string): boolean {
  const estado = estadoDe(programadaEn, Date.now())
  return estado === 'porEmpezar' || estado === 'enCurso'
}

/**
 * Inicio: lo que está pasando (M22, 20-oct-2026).
 *
 * Alejandro: «que la gente siga teniendo interacción a través de la comunidad
 * V-AI-P y en la comunidad del curso… que realmente vean sus cursos y su
 * membresía». El orden es una decisión:
 *
 *   1. V-AI-P, para el miembro: lo último del muro y escribir, la clase con
 *      «Entrar» cuando toca, la noticia. Antes Inicio ni la mencionaba.
 *   2. Retomar el curso, con su avance (el avance del curso se queda; lo que ya
 *      no se empuja es el puntaje por generación).
 *   3. Lo que caduca: la sesión en vivo y el anuncio; una dinámica abierta.
 *   4. Lo último de los muros de sus cursos.
 *   5. Sus cursos.
 *   6. El blog, solo si tiene entradas; y a quien no es miembro, una sola
 *      invitación a V-AI-P.
 *
 * Salieron: la tarjeta de nivel con un ranking por curso, «Tus certificados»
 * (Mi perfil → Certificaciones) y el blog vacío.
 */
export default async function PaginaInicio() {
  const [perfil, resumen] = await Promise.all([exigirPerfil(), resumenDelAlumno()])
  const { vaip, retomar, proximaSesion, anuncio, dinamica, muros, cursos, entradas } = resumen

  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-[1.75rem] leading-tight font-medium tracking-tight">
        {saludo()}, {nombreVisible(perfil)}
      </h1>

      {/* Solo en el teléfono y hasta que la instale o diga «Ahora no». */}
      <AvisoInstalar />

      {/* --- V-AI-P ------------------------------------------------------ */}
      {vaip ? (
        <Tarjeta className="flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <LogoVaip className="h-8" />
            <Link href="/vaip" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              Abrir V-AI-P →
            </Link>
          </div>

          {vaip.clase ? (
            <div
              className={
                abierta(vaip.clase.programadaEn)
                  ? 'flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-accent bg-accent/10 px-4 py-3'
                  : 'flex flex-wrap items-center justify-between gap-3 rounded-[10px] bg-muted/50 px-4 py-3'
              }
            >
              <span className="flex min-w-0 flex-col">
                <span className="text-xs font-medium tracking-[0.15em] text-primary uppercase">
                  {abierta(vaip.clase.programadaEn) ? 'Clase en vivo ahora' : 'Próxima clase'}
                </span>
                <span className="font-medium text-balance">{vaip.clase.titulo}</span>
                <span className="text-sm text-muted-foreground">{describirHorario(vaip.clase.programadaEn)}</span>
              </span>
              {abierta(vaip.clase.programadaEn) && vaip.clase.meetUrl ? (
                <Button asChild variant="acento">
                  <a href={vaip.clase.meetUrl} target="_blank" rel="noopener noreferrer">
                    Entrar a la clase
                  </a>
                </Button>
              ) : (
                <Link href="/vaip/clases" className="text-sm text-primary underline-offset-4 hover:underline">
                  Ver las clases
                </Link>
              )}
            </div>
          ) : null}

          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">Lo último en el muro</p>
            {vaip.muro.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay publicaciones. Estrena el muro.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {vaip.muro.map((p) => (
                  <PublicacionEnLinea key={p.id} publicacion={p} />
                ))}
              </ul>
            )}
            {vaip.noticia ? (
              <Link
                href="/vaip?tema=noticias"
                className="flex items-baseline gap-2 text-sm underline-offset-4 hover:underline"
              >
                <span className="shrink-0 text-xs font-medium tracking-[0.15em] text-primary uppercase">Noticia</span>
                <span className="min-w-0 truncate">{vaip.noticia.titulo}</span>
              </Link>
            ) : null}
          </div>

          <div>
            <Button asChild variant={vaip.clase && abierta(vaip.clase.programadaEn) ? 'outline' : 'acento'}>
              <Link href="/vaip">Escribir en el muro</Link>
            </Button>
          </div>
        </Tarjeta>
      ) : null}

      {/* --- Retomar el curso ------------------------------------------- */}
      {retomar ? (
        <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-vadai-navy via-vadai-azul to-vadai-cyan p-6 text-white sm:p-8">
          {/* Halo de marca. `aria-hidden`: es atmósfera, no contenido. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-vadai-lima/20 blur-3xl"
          />
          <div className="relative flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium tracking-[0.18em] text-vadai-lima uppercase">
                {retomar.empezando ? 'Empieza por aquí' : 'Continúa donde te quedaste'}
              </p>
              <h2 className="text-2xl leading-tight font-medium text-balance sm:text-3xl">{retomar.leccion.titulo}</h2>
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
                <span className="block h-full rounded-full bg-vadai-lima" style={{ width: `${retomar.curso.porcentaje}%` }} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="bg-vadai-lima text-vadai-navy hover:brightness-105">
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
      ) : null}

      {/* --- Lo que caduca ----------------------------------------------- */}
      {proximaSesion || anuncio || dinamica ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {proximaSesion ? (
            <Tarjeta className="flex flex-col gap-3 p-5">
              <span className="flex items-center gap-2 text-xs font-medium tracking-[0.15em] text-primary uppercase">
                <PuntoVivo /> {abierta(proximaSesion.programadaEn) ? 'Sesión en vivo ahora' : 'Próxima sesión en vivo'}
              </span>
              <div className="flex flex-col gap-1">
                <h2 className="font-medium text-balance">{proximaSesion.titulo}</h2>
                <p className="text-sm text-muted-foreground">
                  {describirHorario(proximaSesion.programadaEn)} · {proximaSesion.cursoTitulo}
                </p>
              </div>
              {abierta(proximaSesion.programadaEn) && proximaSesion.meetUrl ? (
                <div>
                  <Button asChild variant="acento" size="sm">
                    <a href={proximaSesion.meetUrl} target="_blank" rel="noreferrer noopener">
                      Entrar a la sesión
                    </a>
                  </Button>
                </div>
              ) : (
                <AgregarAlCalendario
                  sesion={{
                    id: proximaSesion.id,
                    titulo: proximaSesion.titulo,
                    descripcion: proximaSesion.descripcion,
                    inicio: proximaSesion.programadaEn,
                    ligaUrl: proximaSesion.meetUrl,
                    curso: proximaSesion.cursoTitulo,
                  }}
                />
              )}
              <Link
                href={`/curso/${proximaSesion.cursoSlug}/en-vivo`}
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                Ver todas las sesiones →
              </Link>
            </Tarjeta>
          ) : null}

          {anuncio ? (
            <Tarjeta className="flex flex-col gap-2 border-accent/50 bg-accent/10 p-5">
              <span className="text-xs font-medium tracking-[0.15em] text-foreground/70 uppercase">Anuncio</span>
              <h2 className="font-medium text-balance">{anuncio.titulo}</h2>
              {anuncio.contenido ? <RenderRico contenido={anuncio.contenido} /> : null}
            </Tarjeta>
          ) : null}

          {dinamica ? (
            <TarjetaEnlace href={`/dinamicas/${dinamica.id}`} className="flex flex-col gap-1 p-5">
              <span className="text-xs font-medium tracking-[0.15em] text-primary uppercase">Dinámica abierta</span>
              <span className="font-medium text-balance">{dinamica.titulo}</span>
              <span className="text-sm text-muted-foreground">{dinamica.cursoTitulo} · Entrar →</span>
            </TarjetaEnlace>
          ) : null}
        </div>
      ) : null}

      {/* --- Lo último del grupo de tus cursos (M25: «Grupo», no «Comunidad») */}
      {muros.length > 0 ? (
        <Seccion titulo={muros.length === 1 ? 'En el grupo de tu curso' : 'En los grupos de tus cursos'}>
          <div className="grid gap-4 lg:grid-cols-2">
            {muros.map((m) => (
              <Tarjeta key={m.curso.id} className="flex min-w-0 flex-col gap-3 p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-balance">{m.curso.titulo}</p>
                  <Link href={m.href} className="text-sm text-primary underline-offset-4 hover:underline">
                    Ir al grupo →
                  </Link>
                </div>
                <ul className="flex flex-col gap-1">
                  {m.publicaciones.map((p) => (
                    <PublicacionEnLinea key={p.id} publicacion={p} />
                  ))}
                </ul>
              </Tarjeta>
            ))}
          </div>
        </Seccion>
      ) : null}

      {/* --- Tus cursos -------------------------------------------------- */}
      {cursos.length === 0 ? (
        vaip ? null : (
          <Tarjeta className="border-dashed px-5 py-12 text-center">
            <p className="text-sm text-muted-foreground">Todavía no tienes ningún curso asignado.</p>
            <a
              href="mailto:ayuda@vadai.com.mx?subject=No%20veo%20mi%20curso"
              className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline"
            >
              Si compraste uno, escríbenos
            </a>
          </Tarjeta>
        )
      ) : (
        <Seccion
          titulo={cursos.length === 1 ? 'Tu curso' : 'Tus cursos'}
          accion={
            <Link href="/cursos" className="text-sm text-primary underline-offset-4 hover:underline">
              Mis cursos →
            </Link>
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

      {/* --- Blog, solo si tiene entradas -------------------------------- */}
      {entradas.length > 0 ? (
        <Seccion
          titulo="Del blog"
          accion={
            <Link href="/blog" className="text-sm text-primary underline-offset-4 hover:underline">
              Ver todo →
            </Link>
          }
        >
          <ul className="flex flex-col gap-2">
            {entradas.map((entrada) => (
              <li key={entrada.id}>
                <TarjetaEnlace href="/blog" className="flex items-baseline justify-between gap-4 p-4">
                  <span className="min-w-0 font-medium text-pretty">{entrada.titulo}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{fechaCorta(entrada.publicadoEn)}</span>
                </TarjetaEnlace>
              </li>
            ))}
          </ul>
        </Seccion>
      ) : null}

      {/* --- A quien no es miembro, una sola invitación ------------------- */}
      {resumen.invitarAVaip ? (
        <Link
          href="/vaip"
          className="flex flex-wrap items-center gap-4 rounded-[10px] border border-border p-5 transition-colors hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <LogoVaip className="h-8" />
          <span className="min-w-0 flex-1 text-sm text-pretty text-muted-foreground">
            La comunidad de la academia: clases en vivo personalizadas, lo nuevo de todas las plataformas de IA y el
            equipo de VADAI acompañándote. <span className="font-medium text-primary">Conoce V-AI-P →</span>
          </span>
        </Link>
      ) : null}
    </div>
  )
}

/** Una publicación en un renglón: autor, título y cuántas respuestas. */
function PublicacionEnLinea({ publicacion: p }: { publicacion: PublicacionBreve }) {
  return (
    <li>
      <Link
        href={p.href}
        className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Avatar nombre={p.autor} foto={p.avatar} tamano={28} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{p.titulo}</span>
          <span className="truncate text-xs text-muted-foreground">
            {p.autor} · {fechaCorta(p.creadoEn)}
          </span>
        </span>
        {p.respuestas > 0 ? (
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {p.respuestas} {p.respuestas === 1 ? 'respuesta' : 'respuestas'}
          </span>
        ) : null}
      </Link>
    </li>
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
