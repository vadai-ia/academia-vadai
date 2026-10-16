import type { Metadata } from 'next'
import Link from 'next/link'

import { claseSelect } from '@/components/admin/estilos'
import { Avatar, Seccion } from '@/components/ui-vadai/superficie'
import { fechaLarga } from '@/components/vaip/tu-membresia'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { esAdmin, exigirEquipo } from '@/lib/auth/sesion'
import { planVaip } from '@/lib/membresia/consultas'
import { filtrarMiembros, miembrosDelPortal } from '@/lib/membresia/portal'
import { esCuentaQa } from '@/lib/qa'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Miembros de V-AI-P' }
export const dynamic = 'force-dynamic'

const ESTADO_STRIPE: Record<string, string> = {
  active: 'Al corriente',
  trialing: 'Al corriente',
  past_due: 'Pago pendiente',
  unpaid: 'Sin pago',
  canceled: 'Cancelada',
  incomplete: 'Pago sin terminar',
  incomplete_expired: 'Pago sin terminar',
  paused: 'En pausa',
}

/**
 * Los miembros de V-AI-P (M19): quién está, cómo va y cuánto participa. Para
 * todo el equipo; la columna de suscripción (Stripe), solo para admin.
 */
export default async function PaginaMiembros({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>
}) {
  const perfil = await exigirEquipo()
  const admin = esAdmin(perfil)
  const filtros = await searchParams
  const plan = await planVaip()
  if (!plan) return <p className="text-sm text-muted-foreground">El plan V-AI-P no está a la venta.</p>

  const todos = await miembrosDelPortal(plan.id, admin, esCuentaQa(perfil.email))
  const estado = filtros.estado === 'vencidos' || filtros.estado === 'todos' ? filtros.estado : 'vigentes'
  const visibles = filtrarMiembros(todos, { q: filtros.q, estado })

  return (
    <Seccion
      titulo="Miembros"
      apoyo={`${todos.filter((m) => m.vigente).length} con acceso · ${todos.length} en total, contando a quien ya salió.`}
    >
      <form method="get" className="flex flex-wrap items-end gap-2">
        <Input name="q" defaultValue={filtros.q ?? ''} placeholder="Nombre, correo o empresa" className="h-9 max-w-xs" />
        <select name="estado" defaultValue={estado} className={cn(claseSelect, 'w-auto')} aria-label="Estado">
          <option value="vigentes">Con acceso</option>
          <option value="vencidos">Ya salieron</option>
          <option value="todos">Todos</option>
        </select>
        <Button type="submit" size="sm" variant="outline">
          Filtrar
        </Button>
      </form>

      {visibles.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
          {todos.length === 0 ? 'Todavía no hay miembros. Llegan en cuanto se suscribe el primero.' : 'Nadie coincide con el filtro.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Miembro</th>
                <th className="px-4 py-2.5 font-medium">Acceso</th>
                <th className="px-4 py-2.5 font-medium">Avance</th>
                <th className="px-4 py-2.5 font-medium">Puntos</th>
                <th className="px-4 py-2.5 font-medium">Último acceso</th>
                {admin ? <th className="px-4 py-2.5 font-medium">Suscripción</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibles.map((m) => (
                <tr key={m.userId} className="align-top">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar nombre={m.nombre || m.correo} tamano={32} />
                      <div className="flex min-w-0 flex-col">
                        <Link href={`/admin/alumnos/${m.userId}`} className="truncate font-medium hover:text-primary">
                          {m.nombre || m.correo}
                        </Link>
                        <span className="truncate text-xs text-muted-foreground">
                          {m.empresa ?? 'General'} ·{' '}
                          <Link href={`/vaip/miembros/${m.userId}`} className="hover:text-primary">
                            perfil de miembro
                          </Link>
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        m.vigente ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {m.vigente ? 'Con acceso' : 'Salió'}
                    </span>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {m.accesoHasta ? `${m.vigente ? 'hasta' : 'el'} ${fechaLarga(m.accesoHasta)}` : ''}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium tabular-nums">{m.porcentaje}%</span>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {m.hechas} de {m.total} lecciones
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium tabular-nums">{m.puntos}</span>
                    <span className="text-muted-foreground"> · #{m.lugar}</span>
                    <p className="text-xs text-muted-foreground">
                      Nivel {m.nivel.numero} · {m.logrosGanados} {m.logrosGanados === 1 ? 'logro' : 'logros'}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {m.ultimoAcceso ? fechaLarga(m.ultimoAcceso) : 'No ha entrado'}
                  </td>
                  {admin ? (
                    <td className="px-4 py-3 text-xs">
                      {m.cobro ? (
                        <>
                          <span className="font-medium">{ESTADO_STRIPE[m.cobro.estado] ?? m.cobro.estado}</span>
                          <p className="text-muted-foreground">
                            {m.cobro.seCancela
                              ? 'Canceló la renovación'
                              : m.cobro.proximoCobro
                                ? `Próximo cobro: ${fechaLarga(m.cobro.proximoCobro)}`
                                : ''}
                          </p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Seccion>
  )
}
