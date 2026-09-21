import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { NuevaSesion } from '@/components/admin/nueva-sesion'
import {
  Cifra,
  Progreso,
  Seccion,
  Tarjeta,
  TarjetaEnlace,
  Titulo,
} from '@/components/ui-vadai/superficie'
import { Button } from '@/components/ui/button'
import { tableroAdmin } from '@/lib/admin/tablero'
import { exigirAdmin, nombreVisible } from '@/lib/auth/sesion'

export const metadata: Metadata = { title: 'Administración' }
export const dynamic = 'force-dynamic'

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
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    timeZone: 'America/Mexico_City',
  }).format(new Date(iso))
}

function dinero(monto: number, moneda: string): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: moneda,
    maximumFractionDigits: 0,
  }).format(monto)
}

const SECCIONES = [
  {
    href: '/admin/cursos',
    titulo: 'Cursos',
    apoyo: 'Módulos, lecciones, videos, adjuntos y cohortes',
    icono: <IconoCursos />,
  },
  {
    href: '/admin/alumnos',
    titulo: 'Alumnos y pagos',
    apoyo: 'Alta manual, vigencias, accesos y pagos recibidos',
    icono: <IconoAlumnos />,
  },
  {
    href: '/admin/encuestas',
    titulo: 'Encuestas en vivo',
    apoyo: 'QR, proyección, resultados y exportación',
    icono: <IconoEncuestas />,
  },
  {
    href: '/admin/entregas',
    titulo: 'Entregas',
    apoyo: 'Revisar y calificar las tareas',
    icono: <IconoEntregas />,
  },
  {
    href: '/admin/publicaciones',
    titulo: 'Publicaciones',
    apoyo: 'Anuncios del panel y entradas de blog',
    icono: <IconoPublicaciones />,
  },
] as const

/**
 * El panel principal.
 *
 * Antes eran cuatro cifras y una línea. Ahora responde, en este orden, lo
 * que el admin quiere saber al abrirlo: qué hay que atender, quién ha entrado,
 * qué sesión toca y con qué liga, cómo van avanzando por curso, y qué se ha
 * cobrado. Cada bloque lleva a la pantalla donde se actúa: las cifras de
 * acceso abren el listado ya filtrado, y la sesión se agenda aquí mismo.
 */
export default async function PaginaAdmin() {
  const [perfil, t] = await Promise.all([exigirAdmin(), tableroAdmin()])

  const porcentajeEntraron = t.personas === 0 ? 0 : Math.round((t.entraron / t.personas) * 100)
  const [siguiente, ...despues] = t.sesiones

  return (
    <div className="flex flex-col gap-8">
      <Titulo apoyo={`${nombreVisible(perfil)} · ${perfil.role}`}>Administración</Titulo>

      {/* Lo que hay que atender va primero y solo aparece si hay algo que
          atender. Un aviso que sale siempre deja de leerse en una semana. */}
      {t.entregasPendientes > 0 ? (
        <TarjetaEnlace href="/admin/entregas" className="border-primary/40 bg-primary/5 p-5">
          <span className="flex flex-wrap items-center justify-between gap-4">
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">
                {t.entregasPendientes}{' '}
                {t.entregasPendientes === 1 ? 'entrega espera' : 'entregas esperan'} revisión
              </span>
              <span className="text-sm text-muted-foreground">
                Hay alumnos esperando su calificación.
              </span>
            </span>
            <span className="text-primary transition-transform group-hover:translate-x-0.5">→</span>
          </span>
        </TarjetaEnlace>
      ) : null}

      {/* --- Alumnos y accesos ------------------------------------------- */}
      <Seccion
        titulo="Alumnos y accesos"
        apoyo="Quién ya entró y a quién le falta"
        accion={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/alumnos?acceso=nunca">Ver quién falta</Link>
          </Button>
        }
      >
        <Tarjeta className="flex flex-col gap-5 p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-5">
            <Cifra valor={t.personas} etiqueta="personas con cuenta" />
            <Cifra valor={t.conAccesoVigente} etiqueta="con acceso vigente" />
            <Cifra valor={t.entraron} etiqueta="ya entraron" destacada />
            <Cifra
              valor={t.nuncaEntraron}
              etiqueta="nunca han entrado"
              detalle={t.nuncaEntraron > 0 ? 'se les manda recordatorio desde Alumnos' : undefined}
            />
            <Cifra valor={t.activosSemana} etiqueta="entraron esta semana" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Progreso
              porcentaje={porcentajeEntraron}
              etiqueta={`${porcentajeEntraron}% de las cuentas ya entró`}
              className="h-2"
            />
            <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
              <span>{porcentajeEntraron}% de las cuentas ya entró al menos una vez</span>
              <span className="flex gap-3">
                <Link href="/admin/alumnos?acceso=entraron" className="text-primary underline-offset-4 hover:underline">
                  Ver quiénes ya entraron
                </Link>
                <Link href="/admin/alumnos?acceso=nunca" className="text-primary underline-offset-4 hover:underline">
                  Ver quiénes faltan
                </Link>
              </span>
            </div>
          </div>
        </Tarjeta>
      </Seccion>

      {/* --- Sesiones en vivo ------------------------------------------------ */}
      <Seccion titulo="Sesiones en vivo" apoyo="Lo que toca, con su liga, y agendar la siguiente">
        <Tarjeta className="flex flex-col gap-5 p-5 sm:p-6">
          {siguiente ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-2 text-xs font-medium tracking-[0.12em] text-primary uppercase">
                    <PuntoVivo /> Próxima sesión
                  </span>
                  <span className="text-xl font-medium">{siguiente.titulo}</span>
                  <span className="text-sm text-muted-foreground">
                    {fechaSesion(siguiente.empiezaEn)} (CDMX) · {siguiente.cursoTitulo} ·{' '}
                    {siguiente.cohorte}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {siguiente.ligaUrl ? (
                    <Button asChild size="sm">
                      <a href={siguiente.ligaUrl} target="_blank" rel="noreferrer noopener">
                        Abrir la liga
                      </a>
                    </Button>
                  ) : (
                    <span className="rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-xs text-destructive">
                      Sin liga todavía
                    </span>
                  )}
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/cohortes/${siguiente.cohorteId}`}>Editar</Link>
                  </Button>
                </div>
              </div>

              {despues.length > 0 ? (
                <ul className="flex flex-col divide-y divide-border border-t border-border">
                  {despues.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
                      <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                        <span className="font-medium">{s.titulo}</span>
                        <span className="text-muted-foreground">
                          {s.cursoTitulo} · {s.cohorte}
                        </span>
                      </span>
                      <span className="flex items-baseline gap-3 text-muted-foreground">
                        <span>{fechaSesion(s.empiezaEn)}</span>
                        {s.ligaUrl ? null : <span className="text-xs text-destructive">sin liga</span>}
                        <Link href={`/admin/cohortes/${s.cohorteId}`} className="text-xs text-primary underline-offset-4 hover:underline">
                          Editar
                        </Link>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No hay sesiones agendadas. Los alumnos ven la siguiente en Mis cursos con el botón
              para entrar, así que conviene agendarlas con la liga desde ahora.
            </p>
          )}

          {t.cohortes.length > 0 ? (
            <details className="group/agendar rounded-[10px] border border-dashed border-border">
              <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-[10px] px-3 py-2 text-sm font-medium text-primary select-none hover:bg-muted [&::-webkit-details-marker]:hidden">
                + Agendar una sesión
              </summary>
              <div className="px-3 pt-1 pb-3">
                <NuevaSesion cohortes={t.cohortes} reinicio={t.sesiones.length} />
              </div>
            </details>
          ) : (
            <p className="text-sm text-muted-foreground">
              Para agendar sesiones primero crea una cohorte en el curso.
            </p>
          )}
        </Tarjeta>
      </Seccion>

      {/* --- Avance por curso -------------------------------------------------- */}
      <Seccion
        titulo="Avance por curso"
        apoyo={
          t.cursosBorrador > 0
            ? `${t.cursos.length} publicado${t.cursos.length === 1 ? '' : 's'} · ${t.cursosBorrador} en borrador`
            : undefined
        }
        accion={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/cursos">Ver cursos</Link>
          </Button>
        }
      >
        {t.cursos.length === 0 ? (
          <Tarjeta className="border-dashed px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">Todavía no hay cursos publicados.</p>
          </Tarjeta>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {t.cursos.map((c) => (
              <TarjetaEnlace key={c.id} href={`/admin/cursos/${c.id}`} className="flex flex-col gap-3 p-5">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{c.titulo}</span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {c.inscritos} inscrito{c.inscritos === 1 ? '' : 's'}
                  </span>
                </span>
                {c.lecciones > 0 ? (
                  <>
                    <Progreso porcentaje={c.avancePromedio} etiqueta={`${c.avancePromedio}% de avance promedio`} />
                    <span className="flex flex-wrap gap-x-4 text-xs text-muted-foreground tabular-nums">
                      <span>
                        <strong className="font-medium text-foreground">{c.avancePromedio}%</strong> de
                        avance promedio
                      </span>
                      <span>{c.empezaron} empezaron</span>
                      <span>{c.terminaron} terminaron</span>
                      <span>
                        {c.lecciones} lección{c.lecciones === 1 ? '' : 'es'} publicada
                        {c.lecciones === 1 ? '' : 's'}
                      </span>
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Sin lecciones publicadas todavía: el avance empieza a contar cuando publiques la
                    primera.
                  </span>
                )}
              </TarjetaEnlace>
            ))}
          </div>
        )}
      </Seccion>

      {/* --- Ingresos y encuestas ---------------------------------------------- */}
      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <Seccion
          titulo="Ingresos"
          apoyo="Pagos que entraron por Stripe"
          accion={
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/alumnos">Ver pagos</Link>
            </Button>
          }
        >
          <Tarjeta className="flex flex-col gap-5 p-5 sm:p-6">
            <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3">
              {t.ingresos.totalPorMoneda.length === 0 ? (
                <Cifra valor="$0" etiqueta="cobrado" />
              ) : (
                t.ingresos.totalPorMoneda.map((m) => (
                  <Cifra
                    key={m.moneda}
                    valor={dinero(m.total, m.moneda)}
                    etiqueta={`cobrado en ${m.moneda}`}
                    detalle={`${dinero(m.esteMes, m.moneda)} este mes`}
                    destacada
                  />
                ))
              )}
              <Cifra valor={t.ingresos.pagos} etiqueta="pagos registrados" />
              <Cifra valor={t.certificadosEmitidos} etiqueta="certificados emitidos" />
            </div>

            {t.ingresos.ultimos.length > 0 ? (
              <ul className="flex flex-col divide-y divide-border border-t border-border">
                {t.ingresos.ultimos.map((p, i) => (
                  <li key={`${p.fecha}-${i}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
                    <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                      <span className="truncate font-medium">{p.email}</span>
                      <span className="text-muted-foreground">{p.cursoTitulo}</span>
                    </span>
                    <span className="flex items-baseline gap-3 text-muted-foreground tabular-nums">
                      <span className="font-medium text-foreground">{dinero(p.monto, p.moneda)}</span>
                      <span className="text-xs">{fechaCorta(p.fecha)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Todavía no entra ningún pago por Stripe. Las altas manuales no generan pago.
              </p>
            )}
          </Tarjeta>
        </Seccion>

        <Seccion
          titulo="Encuestas en vivo"
          accion={
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/encuestas">Abrir</Link>
            </Button>
          }
        >
          <Tarjeta className="flex h-full flex-col gap-5 p-5 sm:p-6">
            <div className="grid grid-cols-3 gap-x-6 gap-y-6">
              <Cifra valor={t.encuestas.enVivo} etiqueta="en vivo ahora" destacada={t.encuestas.enVivo > 0} />
              <Cifra valor={t.encuestas.total} etiqueta="encuestas" />
              <Cifra valor={t.encuestas.padron} etiqueta="en el padrón" />
            </div>
            <p className="text-sm text-muted-foreground">
              El padrón son las personas que han contestado alguna encuesta con su nombre y correo.
              Se exporta a Excel desde cada encuesta.
            </p>
          </Tarjeta>
        </Seccion>
      </div>

      <Seccion titulo="Gestionar">
        <div className="grid gap-3 sm:grid-cols-2">
          {SECCIONES.map((s) => (
            <TarjetaEnlace key={s.href} href={s.href} className="p-5">
              <span className="flex items-start gap-4">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                  {s.icono}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-medium">{s.titulo}</span>
                  <span className="text-sm text-pretty text-muted-foreground">{s.apoyo}</span>
                </span>
              </span>
            </TarjetaEnlace>
          ))}
        </div>
      </Seccion>

      <p className="text-sm text-muted-foreground">
        ¿Buscas cómo se ve del lado del alumno?{' '}
        <Link href="/mis-cursos" className="text-primary underline-offset-4 hover:underline">
          Entra como alumno
        </Link>
        .
      </p>
    </div>
  )
}

function PuntoVivo() {
  return (
    <span className="relative flex size-2" aria-hidden>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
      <span className="relative inline-flex size-2 rounded-full bg-primary" />
    </span>
  )
}

/* Iconos de línea, un solo grosor (2) y un solo tamaño. Mezclar grosores o
   meter emoji es de lo que más barata hace ver una interfaz. */

function marco(hijos: ReactNode) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[18px]"
      aria-hidden
    >
      {hijos}
    </svg>
  )
}

function IconoCursos() {
  return marco(
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </>
  )
}

function IconoAlumnos() {
  return marco(
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    </>
  )
}

function IconoEncuestas() {
  return marco(
    <>
      <path d="M3 3v18h18" />
      <path d="M7 15v-4M12 15V7M17 15v-6" />
    </>
  )
}

function IconoEntregas() {
  return marco(
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="m9 15 2 2 4-4" />
    </>
  )
}

function IconoPublicaciones() {
  return marco(
    <>
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9h4" />
      <path d="M10 6h8M10 10h8M10 14h4" />
    </>
  )
}
