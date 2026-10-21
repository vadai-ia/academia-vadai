import 'server-only'

import { cache } from 'react'

import { correosQueNoSalieron } from '@/lib/admin/accesos'
import { pendientesDeComunidad } from '@/lib/admin/comunidad'
import { esModoQa } from '@/lib/agente/claude'
import { borradoresPendientes } from '@/lib/agente/panel'
import { esAdmin, exigirEquipo } from '@/lib/auth/sesion'
import { panelVaip } from '@/lib/membresia/admin'
import { planVaip } from '@/lib/membresia/consultas'
import { esCuentaQa } from '@/lib/qa'
import { crearClienteServidor } from '@/lib/supabase/server'
import { casaDelPanel } from '@/lib/vaip/admin'

/**
 * Los números de la barra lateral del panel (M26, 21-oct-2026).
 *
 * Alejandro: «desde los módulos laterales debo poder ver el número de
 * notificaciones en cada apartado con un numerito para poder entrar y atender
 * lo que haga falta». Cada número es lo que ESPERA QUE ALGUIEN ACTÚE —no lo
 * nuevo ni lo no leído—, y se apaga cuando se resuelve: contestar, publicar,
 * subir la grabación, revisar la entrega. En 0 no se pinta.
 *
 * Cada cuenta va por separado y un fallo da 0: un número que no se pudo leer
 * nunca tumba el panel. Memorizado por petición: lo piden las ocho insignias
 * y el total del menú del teléfono.
 */

export type ClaveDeContador = 'muro' | 'noticias' | 'clases' | 'grupos' | 'entregas' | 'agente' | 'alumnos' | 'planes'
export type Contadores = Record<ClaveDeContador, number>

const HORA = 60 * 60 * 1000

async function seguro(operacion: string, leer: () => Promise<number>): Promise<number> {
  try {
    return await leer()
  } catch (e) {
    console.error(JSON.stringify({ operacion: `contadores:${operacion}`, error: e instanceof Error ? e.message : String(e) }))
    return 0
  }
}

/**
 * Las clases de V-AI-P que ya pasaron —de 3 horas a 30 días— y no tienen
 * grabación: lo que pide «Subir grabación».
 */
export async function clasesPorGrabar(ahora = Date.now()): Promise<number> {
  const lugar = await casaDelPanel()
  if (!lugar?.generacionId) return 0
  const supabase = await crearClienteServidor()
  const { count, error } = await supabase
    .from('cohort_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('cohort_id', lugar.generacionId)
    .eq('kind', 'clase')
    .is('recording_lesson_id', null)
    .lte('scheduled_at', new Date(ahora - 3 * HORA).toISOString())
    .gte('scheduled_at', new Date(ahora - 30 * 24 * HORA).toISOString())
  if (error) throw new Error(error.message)
  return count ?? 0
}

export const contadoresDelPanel = cache(async (): Promise<Contadores> => {
  const perfil = await exigirEquipo()
  const supabase = await crearClienteServidor()
  // Una sola lectura de la comunidad para Muro y Grupos (la misma que la campana).
  const comunidad = pendientesDeComunidad()
  comunidad.catch(() => undefined)

  const [muro, grupos, noticias, clases, entregas, agente, alumnos, planes] = await Promise.all([
    seguro('muro', async () => (await comunidad).vaip.sinRespuesta),
    seguro('grupos', async () => (await comunidad).grupos.sinRespuesta),
    seguro('noticias', async () => {
      const { count, error } = await supabase
        .from('news_items')
        .select('id', { count: 'exact', head: true })
        .eq('es_qa', esModoQa())
        .eq('estado', 'propuesta')
      if (error) throw new Error(error.message)
      return count ?? 0
    }),
    seguro('clases', () => clasesPorGrabar()),
    seguro('entregas', async () => {
      const { count, error } = await supabase
        .from('assignment_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'submitted')
      if (error) throw new Error(error.message)
      return count ?? 0
    }),
    seguro('agente', () => borradoresPendientes()),
    seguro('alumnos', async () => (await correosQueNoSalieron({ qa: esCuentaQa(perfil.email) })).length),
    // Los pagos son solo de admin: al community manager ni se le calcula.
    esAdmin(perfil)
      ? seguro('planes', async () => {
          const plan = await planVaip()
          if (!plan) return 0
          const { alertas } = await panelVaip(plan.id)
          return alertas.atrasados.length + alertas.duplicados.length + alertas.sinCuenta.length
        })
      : Promise.resolve(0),
  ])

  return { muro, grupos, noticias, clases, entregas, agente, alumnos, planes }
})
