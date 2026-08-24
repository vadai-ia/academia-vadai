import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'

import {
  Cifra,
  Seccion,
  Tarjeta,
  TarjetaEnlace,
  Titulo,
} from '@/components/ui-vadai/superficie'
import { exigirAdmin, nombreVisible } from '@/lib/auth/sesion'
import { resumenAdmin } from '@/lib/admin/resumen'

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
    apoyo: 'Alta manual, vigencias y pagos recibidos',
    icono: <IconoAlumnos />,
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

export default async function PaginaAdmin() {
  const [perfil, resumen] = await Promise.all([exigirAdmin(), resumenAdmin()])

  return (
    <div className="flex flex-col gap-8">
      <Titulo apoyo={`${nombreVisible(perfil)} · ${perfil.role}`}>Administración</Titulo>

      {/* Lo que hay que atender va primero y solo aparece si hay algo que
          atender. Un aviso que sale siempre deja de leerse en una semana. */}
      {resumen.entregasPendientes > 0 ? (
        <TarjetaEnlace href="/admin/entregas" className="border-primary/40 bg-primary/5 p-5">
          <span className="flex flex-wrap items-center justify-between gap-4">
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">
                {resumen.entregasPendientes}{' '}
                {resumen.entregasPendientes === 1 ? 'entrega espera' : 'entregas esperan'} revisión
              </span>
              <span className="text-sm text-muted-foreground">
                Hay alumnos esperando su calificación.
              </span>
            </span>
            <span className="text-primary transition-transform group-hover:translate-x-0.5">→</span>
          </span>
        </TarjetaEnlace>
      ) : null}

      <Tarjeta className="p-5 sm:p-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
          <Cifra
            valor={resumen.alumnosActivos}
            etiqueta="alumnos con acceso"
            detalle={
              resumen.alumnosVencidos > 0 ? `${resumen.alumnosVencidos} vencidos` : undefined
            }
          />
          <Cifra
            valor={resumen.cursosPublicados}
            etiqueta="cursos publicados"
            detalle={resumen.cursosBorrador > 0 ? `${resumen.cursosBorrador} en borrador` : undefined}
          />
          <Cifra
            valor={resumen.entregasPendientes}
            etiqueta="entregas por revisar"
            destacada={resumen.entregasPendientes > 0}
          />
          <Cifra valor={resumen.certificadosEmitidos} etiqueta="certificados emitidos" />
        </div>

        {resumen.proximaSesion ? (
          <p className="mt-6 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-border pt-4 text-sm">
            <span className="text-muted-foreground">Próxima sesión en vivo:</span>
            <span className="font-medium">{resumen.proximaSesion.titulo}</span>
            <span className="text-muted-foreground">
              {fechaSesion(resumen.proximaSesion.empiezaEn)}
            </span>
          </p>
        ) : null}
      </Tarjeta>

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
