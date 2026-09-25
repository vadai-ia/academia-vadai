import type { Metadata } from 'next'
import Link from 'next/link'

import { NuevaDinamica } from '@/components/admin/nueva-dinamica'
import { Badge } from '@/components/ui/badge'
import { Titulo } from '@/components/ui-vadai/superficie'
import { opcionesDeAlta } from '@/lib/admin/alumnos'
import { fechaHoraCdmx } from '@/lib/admin/fechas'
import { exigirAdmin } from '@/lib/auth/sesion'
import { ETIQUETA_ESTADO_DINAMICA } from '@/lib/dinamicas/comun'
import { listarDinamicas, type DinamicaEnLista } from '@/lib/dinamicas/consultas'

export const metadata: Metadata = { title: 'Dinámicas empresariales' }
export const dynamic = 'force-dynamic'

/** Sobre el estado EFECTIVO: una abierta con la fecha vencida ya dice "Cerrada". */
const VARIANTE = {
  draft: 'secondary',
  open: 'default',
  closed: 'outline',
} as const

function lineaDeFecha(d: DinamicaEnLista): string {
  if (d.estadoEfectivo === 'closed' && (d.closed_at ?? d.closes_at)) {
    return `Cerró el ${fechaHoraCdmx((d.closed_at ?? d.closes_at) as string)} (CDMX)`
  }
  return d.closes_at ? `Cierra el ${fechaHoraCdmx(d.closes_at)} (CDMX)` : 'Sin fecha límite'
}

export default async function PaginaDinamicas() {
  await exigirAdmin()

  const [dinamicas, cursos] = await Promise.all([listarDinamicas(), opcionesDeAlta()])

  return (
    <div className="flex flex-col gap-6">
      <Titulo apoyo="Fijas los criterios y su peso; cada empresa agrega sus proyectos, los califica y ve el ponderado al momento.">
        Dinámicas empresariales
      </Titulo>

      <NuevaDinamica cursos={cursos} reinicio={dinamicas.length} />

      {dinamicas.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-border px-5 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Todavía no hay dinámicas. Crea la primera y agrégale sus criterios.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {dinamicas.map((dinamica) => (
            <li key={dinamica.id}>
              <Link
                href={`/admin/dinamicas/${dinamica.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-border px-4 py-3 transition-colors hover:border-primary/60"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{dinamica.title}</span>
                    <Badge variant={VARIANTE[dinamica.estadoEfectivo]} className="shrink-0">
                      {ETIQUETA_ESTADO_DINAMICA[dinamica.estadoEfectivo]}
                    </Badge>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {dinamica.curso}
                    {dinamica.cohorte ? ` · ${dinamica.cohorte}` : ''} · {lineaDeFecha(dinamica)}
                  </span>
                </div>

                <div className="flex shrink-0 gap-4 text-xs text-muted-foreground tabular-nums">
                  <span>{dinamica.totalCriterios} criterios</span>
                  <span>{dinamica.totalTableros} tableros</span>
                  <span>{dinamica.totalCompletos} completos</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
