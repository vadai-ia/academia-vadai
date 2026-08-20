import type { Metadata } from 'next'

import Link from 'next/link'

import { exigirAdmin, nombreVisible } from '@/lib/auth/sesion'

export const metadata: Metadata = { title: 'Administración' }
export const dynamic = 'force-dynamic'

const PENDIENTES = [
  { clave: 'M6', nombre: 'Bandeja de entregas' },
  { clave: 'M8', nombre: 'Cohortes y sesiones' },
  { clave: 'M9', nombre: 'Alumnos y pagos' },
] as const

export default async function PaginaAdmin() {
  const perfil = await exigirAdmin()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          Administración
        </h1>
        <p className="text-sm text-muted-foreground">
          {nombreVisible(perfil)} · {perfil.role}
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <Link
          href="/admin/cursos"
          className="flex items-center justify-between rounded-lg border border-border px-4 py-4 transition-colors hover:border-vadai-cyan/60"
        >
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">Cursos</span>
            <span className="text-sm text-muted-foreground">
              Módulos, lecciones, adjuntos y publicación
            </span>
          </span>
          <span className="text-vadai-cyan">→</span>
        </Link>
      </section>

      <h2 className="text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase">
        Pendiente
      </h2>

      <ul className="flex flex-col gap-2">
        {PENDIENTES.map((p) => (
          <li
            key={p.clave}
            className="flex items-center justify-between rounded-md border border-border px-4 py-3"
          >
            <span className="flex items-center gap-3">
              <span className="font-mono text-sm text-vadai-cyan">{p.clave}</span>
              <span className="text-sm">{p.nombre}</span>
            </span>
            <span className="text-xs text-muted-foreground">pendiente</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
