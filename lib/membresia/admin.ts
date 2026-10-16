import 'server-only'

import { accesoMayor, vigente, type EstadoSuscripcion } from '@/lib/membresia/acceso'
import { esCuentaQa } from '@/lib/qa'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * Lo que el panel muestra de V-AI-P (M17). Con la sesión del admin: las
 * políticas de `memberships` y `membership_invoices` dejan leer todo solo a
 * `is_admin()`. El community manager no llega aquí (no ve pagos).
 *
 * Sin cuentas `qa-*`: las suites crean membresías en este mismo plan mientras
 * corren, y no deben contar como miembros ni como dinero (igual que /admin/puntos).
 */

export type MiembroDelPanel = {
  clave: string
  userId: string | null
  nombre: string
  correo: string | null
  empresa: string | null
  estado: EstadoSuscripcion
  accesoHasta: string | null
  proximoCobro: string | null
  seCancela: boolean
  desde: string
  vigente: boolean
  /** Suscripciones vivas (active, past_due, trialing) de la misma persona. */
  vivas: number
}

export type CobroDelPanel = {
  factura: string
  correo: string | null
  monto: number
  moneda: string
  estado: 'paid' | 'failed'
  fecha: string
}

export type PanelVaip = {
  miembros: MiembroDelPanel[]
  cobros: CobroDelPanel[]
  cifras: { vigentes: number; seCancelan: number; atrasados: number; cobradoEsteMes: number }
  alertas: { atrasados: MiembroDelPanel[]; duplicados: MiembroDelPanel[]; sinCuenta: MiembroDelPanel[] }
}

const VIVAS: EstadoSuscripcion[] = ['active', 'past_due', 'trialing']

export async function panelVaip(planId: string): Promise<PanelVaip> {
  const supabase = await crearClienteServidor()

  const [{ data: suscripciones }, { data: facturas }] = await Promise.all([
    supabase
      .from('memberships')
      .select(
        'stripe_subscription_id, user_id, email, status, access_until, current_period_end, cancel_at_period_end, started_at'
      )
      .eq('plan_id', planId)
      .order('started_at', { ascending: false }),
    supabase
      .from('membership_invoices')
      .select('stripe_invoice_id, email, amount, currency, status, created_at')
      .eq('plan_id', planId)
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const filas = suscripciones ?? []
  const ids = [...new Set(filas.map((f) => f.user_id).filter((v): v is string => v !== null))]
  const { data: perfiles } = ids.length
    ? await supabase.from('profiles').select('user_id, full_name, email, company_id').in('user_id', ids)
    : { data: [] }
  const empresas = [...new Set((perfiles ?? []).map((p) => p.company_id).filter((v): v is string => v !== null))]
  const { data: nombresDeEmpresa } = empresas.length
    ? await supabase.from('companies').select('id, name').in('id', empresas)
    : { data: [] }
  const empresaPorId = new Map((nombresDeEmpresa ?? []).map((e) => [e.id, e.name]))
  const perfilPorId = new Map((perfiles ?? []).map((p) => [p.user_id, p]))

  // Una fila por persona (o por suscripción, mientras no tenga cuenta enlazada).
  const grupos = new Map<string, typeof filas>()
  for (const f of filas) {
    const clave = f.user_id ?? `sub:${f.stripe_subscription_id}`
    grupos.set(clave, [...(grupos.get(clave) ?? []), f])
  }

  const todos: MiembroDelPanel[] = [...grupos.entries()].map(([clave, suyas]) => {
    const hasta = accesoMayor(suyas.map((s) => s.access_until))
    const principal =
      suyas.find((s) => s.access_until !== null && Date.parse(s.access_until) === Date.parse(hasta ?? '')) ?? suyas[0]!
    const perfil = principal.user_id ? perfilPorId.get(principal.user_id) : undefined
    return {
      clave,
      userId: principal.user_id,
      nombre: perfil?.full_name || perfil?.email || principal.email || 'Sin cuenta todavía',
      correo: perfil?.email ?? principal.email,
      empresa: perfil?.company_id ? (empresaPorId.get(perfil.company_id) ?? null) : null,
      estado: principal.status,
      accesoHasta: hasta,
      proximoCobro:
        principal.status === 'active' && !principal.cancel_at_period_end ? principal.current_period_end : null,
      seCancela: principal.cancel_at_period_end,
      desde: suyas.map((s) => s.started_at).sort()[0] ?? principal.started_at,
      vigente: vigente(hasta),
      vivas: suyas.filter((s) => VIVAS.includes(s.status)).length,
    }
  })

  const miembros = todos.filter((m) => !esCuentaQa(m.correo))

  const inicioDeMes = new Date()
  inicioDeMes.setUTCDate(1)
  inicioDeMes.setUTCHours(0, 0, 0, 0)

  const cobros: CobroDelPanel[] = (facturas ?? []).filter((f) => !esCuentaQa(f.email)).map((f) => ({
    factura: f.stripe_invoice_id,
    correo: f.email,
    monto: Number(f.amount),
    moneda: f.currency,
    estado: f.status,
    fecha: f.created_at,
  }))

  const atrasados = miembros.filter((m) => m.estado === 'past_due' || m.estado === 'unpaid')
  const hace10Min = Date.now() - 10 * 60 * 1000
  return {
    miembros,
    cobros: cobros.slice(0, 20),
    cifras: {
      vigentes: miembros.filter((m) => m.vigente).length,
      seCancelan: miembros.filter((m) => m.vigente && m.seCancela).length,
      atrasados: atrasados.length,
      cobradoEsteMes: cobros
        .filter((c) => c.estado === 'paid' && Date.parse(c.fecha) >= inicioDeMes.getTime())
        .reduce((total, c) => total + c.monto, 0),
    },
    alertas: {
      atrasados,
      duplicados: miembros.filter((m) => m.vivas > 1),
      sinCuenta: miembros.filter((m) => m.userId === null && Date.parse(m.desde) < hace10Min),
    },
  }
}
