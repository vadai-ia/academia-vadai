import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Pestanas, type Pestana } from '@/components/ui-vadai/pestanas'
import { Titulo } from '@/components/ui-vadai/superficie'
import { fechaHoraCdmx } from '@/lib/admin/fechas'
import { exigirAdmin } from '@/lib/auth/sesion'
import { ETIQUETA_ESTADO_DINAMICA, sumaPesos, TOLERANCIA_PESOS } from '@/lib/dinamicas/comun'
import { obtenerDinamica } from '@/lib/dinamicas/consultas'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

// Sin `loading.tsx` en esta ruta: el notFound() de abajo es control de acceso, y
// un límite de Suspense lo convertiría en un 200 con esqueleto. Ver
// components/marca/esqueleto.tsx.

/** Sobre el estado EFECTIVO: una abierta con la fecha vencida ya dice "Cerrada". */
const VARIANTE = {
  draft: 'secondary',
  open: 'default',
  closed: 'outline',
} as const

/**
 * Marco de una dinámica: lo que se ve igual en todas sus secciones. Calco de
 * `encuestas/[id]/layout.tsx`, sin QR: aquí nadie escanea nada.
 *
 * La caja de arriba es el tablero de instrumentos del admin: escala, si los
 * pesos ya suman 100 (la condición para abrir) y cuántas empresas van. Lo que
 * hay que saber antes de decidir cualquier cosa, sin entrar a ninguna pestaña.
 *
 * `obtenerDinamica` está memorizada por petición con `cache()`, así que
 * pedirla aquí y otra vez en la página hija cuesta un solo viaje.
 */
export default async function LayoutDinamica({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ id: string }>
}) {
  await exigirAdmin()

  const { id } = await params
  const dinamica = await obtenerDinamica(id)
  if (!dinamica) notFound()

  const base = `/admin/dinamicas/${dinamica.id}`
  const criterios = dinamica.filas.filter((f) => f.tipo === 'criterio').length
  const suma = sumaPesos(dinamica.filas)
  const diferencia = Math.round((100 - suma) * 100) / 100
  const suman100 = Math.abs(diferencia) <= TOLERANCIA_PESOS

  const pestanas: Pestana[] = [
    { href: base, etiqueta: 'Criterios', exacto: true, insignia: dinamica.filas.length },
    {
      href: `${base}/tableros`,
      etiqueta: 'Tableros',
      insignia: dinamica.totalTableros,
      // En borrador no hay tableros que ver ni puede haberlos: el alumno ni
      // siquiera ve la dinámica. La pestaña se queda, apagada y con su motivo,
      // para que no parezca que la plataforma perdió una sección.
      deshabilitada: dinamica.status === 'draft',
      motivo: 'Los tableros aparecen cuando la abras: en borrador nadie puede entrar todavía.',
    },
    { href: `${base}/configuracion`, etiqueta: 'Configuración' },
  ]

  const fecha =
    dinamica.estadoEfectivo === 'closed' && (dinamica.closed_at ?? dinamica.closes_at)
      ? `Cerró el ${fechaHoraCdmx((dinamica.closed_at ?? dinamica.closes_at) as string)} (CDMX)`
      : dinamica.closes_at
        ? `Cierra el ${fechaHoraCdmx(dinamica.closes_at)} (CDMX)`
        : 'Sin fecha límite'

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/dinamicas"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <span aria-hidden>←</span> Dinámicas
      </Link>

      <Titulo
        apoyo={`${dinamica.curso}${dinamica.cohorte ? ` · ${dinamica.cohorte}` : ''}`}
        acciones={
          <Badge variant={VARIANTE[dinamica.estadoEfectivo]}>
            {ETIQUETA_ESTADO_DINAMICA[dinamica.estadoEfectivo]}
          </Badge>
        }
      >
        {dinamica.title}
      </Titulo>

      <div className="flex flex-wrap items-center gap-x-8 gap-y-5 rounded-[10px] border border-border p-5">
        <div className="flex flex-col gap-1">
          <span className="text-xs tracking-wider text-muted-foreground">ESCALA</span>
          <span className="text-[1.75rem] leading-none font-medium tabular-nums">
            {dinamica.scale_min}–{dinamica.scale_max}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs tracking-wider text-muted-foreground">PESOS</span>
          <span
            className={cn(
              'text-[1.75rem] leading-none font-medium tabular-nums',
              !suman100 && 'text-destructive'
            )}
          >
            {suma} de 100
          </span>
          {!suman100 ? (
            <span className="text-xs text-destructive tabular-nums">
              {criterios === 0
                ? 'Agrega al menos un criterio para poder abrirla'
                : diferencia > 0
                  ? `Faltan ${diferencia} para poder abrirla`
                  : `Sobran ${-diferencia}; quítalos para poder abrirla`}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs tracking-wider text-muted-foreground">TABLEROS</span>
          <span className="text-[1.75rem] leading-none font-medium tabular-nums">
            {dinamica.totalTableros}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {dinamica.totalCompletos} completos
          </span>
        </div>

        <span className="text-sm text-muted-foreground sm:ml-auto">{fecha}</span>
      </div>

      <Pestanas pestanas={pestanas} etiqueta="Secciones de la dinámica" />

      {children}
    </div>
  )
}
