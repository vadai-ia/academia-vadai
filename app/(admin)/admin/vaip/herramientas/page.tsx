import type { Metadata } from 'next'
import Link from 'next/link'

import { Seccion, Titulo } from '@/components/ui-vadai/superficie'
import { ETIQUETA_ESTADO_CURSO } from '@/lib/admin/tipos'
import { esAdmin, exigirEquipo } from '@/lib/auth/sesion'
import { planVaip } from '@/lib/membresia/consultas'
import { cursosDelPlanParaEquipo } from '@/lib/membresia/portal'
import { esCuentaQa, esCursoQa } from '@/lib/qa'

export const metadata: Metadata = { title: 'Herramientas · V-AI-P' }
export const dynamic = 'force-dynamic'

const AREAS = [
  { clave: 'creativas', titulo: 'Herramientas creativas' },
  { clave: 'administrativas', titulo: 'Herramientas administrativas' },
  { clave: 'comerciales', titulo: 'Herramientas comerciales' },
] as const

/**
 * Herramientas de V-AI-P (M19; página propia desde M25): los videos de cada
 * herramienta, por área. Una herramienta es un curso marcado con su área y
 * agregado al plan; no sale en Cursos (los dos mundos no se mezclan). Las
 * noticias viven en Noticias y las grabaciones de las clases en Clases.
 */
export default async function PaginaHerramientas() {
  const perfil = await exigirEquipo()
  const admin = esAdmin(perfil)
  const plan = await planVaip()
  if (!plan) {
    return (
      <div className="flex flex-col gap-6">
        <Titulo ceja="V-AI-P">Herramientas</Titulo>
        <p className="text-sm text-muted-foreground">El plan V-AI-P no está a la venta.</p>
      </div>
    )
  }

  const veQa = esCuentaQa(perfil.email)
  const cursos = await cursosDelPlanParaEquipo(plan.id)
  const visibles = cursos.filter((c) => (veQa || !esCursoQa(c.slug)) && c.id !== plan.casa?.id && c.category)

  return (
    <div className="flex flex-col gap-10">
      <Titulo
        ceja="V-AI-P"
        apoyo={
          admin
            ? 'Una herramienta es un curso con sus videos. Créalo en Cursos, márcalo con su área en «Datos del curso» y agrégalo al plan en Planes y cobros: desde ese momento vive aquí.'
            : 'Una herramienta es un curso con sus videos. Un admin la crea, la marca con su área y la agrega al plan.'
        }
      >
        Herramientas
      </Titulo>

      <div className="grid gap-6 lg:grid-cols-3">
        {AREAS.map((a) => {
          const deArea = visibles.filter((c) => c.category === a.clave)
          return (
            <Seccion key={a.clave} titulo={a.titulo}>
              {deArea.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {deArea.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/admin/cursos/${c.id}`}
                        className="flex items-center justify-between gap-3 rounded-[10px] border border-border px-4 py-3 text-sm transition-colors hover:border-primary/50"
                      >
                        <span className="font-medium">{c.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{ETIQUETA_ESTADO_CURSO[c.status]}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-[10px] border border-dashed border-border px-4 py-5 text-center text-xs text-muted-foreground">
                  Ninguna todavía.
                </p>
              )}
            </Seccion>
          )
        })}
      </div>
    </div>
  )
}
