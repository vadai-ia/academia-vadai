import type { Metadata } from 'next'
import Link from 'next/link'

import { Seccion, Tarjeta } from '@/components/ui-vadai/superficie'
import { fechaLarga } from '@/components/vaip/tu-membresia'
import { Button } from '@/components/ui/button'
import { ETIQUETA_ESTADO_CURSO } from '@/lib/admin/tipos'
import { esAdmin, exigirEquipo } from '@/lib/auth/sesion'
import { planVaip } from '@/lib/membresia/consultas'
import { noticiasDeVaip } from '@/lib/membresia/noticias'
import { cursosDelPlanParaEquipo } from '@/lib/membresia/portal'
import { esCuentaQa, esCursoQa } from '@/lib/qa'

export const metadata: Metadata = { title: 'Contenido de V-AI-P' }
export const dynamic = 'force-dynamic'

const AREAS = [
  { clave: 'creativas', titulo: 'Herramientas creativas' },
  { clave: 'administrativas', titulo: 'Herramientas administrativas' },
  { clave: 'comerciales', titulo: 'Herramientas comerciales' },
] as const

/**
 * Contenido de V-AI-P (M19): las noticias, las herramientas por área y los
 * cursos del plan. Una herramienta es un curso marcado con su área (lo marca
 * un admin en «Datos del curso»); qué cursos da el plan se decide en Planes.
 */
export default async function PaginaContenido() {
  const perfil = await exigirEquipo()
  const admin = esAdmin(perfil)
  const plan = await planVaip()
  if (!plan) return <p className="text-sm text-muted-foreground">El plan V-AI-P no está a la venta.</p>

  const veQa = esCuentaQa(perfil.email)
  const [cursos, noticias] = await Promise.all([
    cursosDelPlanParaEquipo(plan.id),
    plan.casa ? noticiasDeVaip(plan.casa.id, perfil.user_id, { cuantas: 5 }) : Promise.resolve(null),
  ])
  const visibles = cursos.filter((c) => (veQa || !esCursoQa(c.slug)) && c.id !== plan.casa?.id)
  const otros = visibles.filter((c) => !c.category)

  const fila = (c: (typeof visibles)[number]) => (
    <li key={c.id}>
      <Link
        href={`/admin/cursos/${c.id}`}
        className="flex items-center justify-between gap-3 rounded-[10px] border border-border px-4 py-3 text-sm transition-colors hover:border-primary/50"
      >
        <span className="font-medium">{c.title}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{ETIQUETA_ESTADO_CURSO[c.status]}</span>
      </Link>
    </li>
  )

  return (
    <div className="flex flex-col gap-10">
      <Seccion
        titulo="Noticias"
        apoyo="Se publican en el tema «Noticias» del muro, donde solo escribe el equipo. Los miembros las comentan."
        accion={
          plan.casa ? (
            <Button asChild size="sm">
              <Link href="/admin/vaip/noticias">Publicar una noticia</Link>
            </Button>
          ) : null
        }
      >
        {noticias?.temaId === null ? (
          <p className="text-sm text-muted-foreground">Falta aplicar la migración academia_0043 para tener el tema Noticias.</p>
        ) : (noticias?.noticias.length ?? 0) === 0 ? (
          <p className="rounded-[10px] border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
            Todavía no hay noticias.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {noticias?.noticias.map((n) => (
              <li key={n.id}>
                <Tarjeta className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm">
                  <span className="font-medium">{n.titulo}</span>
                  <span className="text-xs text-muted-foreground">
                    {fechaLarga(n.creadoEn)} · {n.comentarios.length}{' '}
                    {n.comentarios.length === 1 ? 'comentario' : 'comentarios'}
                  </span>
                </Tarjeta>
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      <Seccion
        titulo="Herramientas"
        apoyo={
          admin
            ? 'Una herramienta es un curso con sus videos. Márcalo con su área en «Datos del curso» y agrégalo al plan en Planes.'
            : 'Una herramienta es un curso con sus videos. Un admin la marca con su área y la agrega al plan.'
        }
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {AREAS.map((a) => {
            const deArea = visibles.filter((c) => c.category === a.clave)
            return (
              <div key={a.clave} className="flex flex-col gap-2">
                <p className="text-sm font-medium">{a.titulo}</p>
                {deArea.length > 0 ? (
                  <ul className="flex flex-col gap-2">{deArea.map(fila)}</ul>
                ) : (
                  <p className="rounded-[10px] border border-dashed border-border px-4 py-5 text-center text-xs text-muted-foreground">
                    Ninguna todavía.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </Seccion>

      <Seccion titulo="Cursos y clases" apoyo="Lo demás que da el plan. Las grabaciones de las clases viven en la casa.">
        {otros.length > 0 ? (
          <ul className="flex flex-col gap-2">{otros.map(fila)}</ul>
        ) : (
          <p className="text-sm text-muted-foreground">Solo la casa, por ahora.</p>
        )}
        {plan.casa ? (
          <Link href={`/admin/cursos/${plan.casa.id}`} className="w-fit text-sm font-medium text-primary hover:underline">
            La casa: VADAI V-AI-P ({plan.casa.publicada ? 'publicada' : 'en borrador'})
          </Link>
        ) : null}
      </Seccion>
    </div>
  )
}
