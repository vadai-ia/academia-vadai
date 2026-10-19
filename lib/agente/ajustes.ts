import 'server-only'

import { esModoQa } from '@/lib/agente/claude'
import { VOZ_POR_DEFECTO } from '@/lib/agente/prompt'
import { dbDelAgente } from '@/lib/agente/servidor'
import type { Database } from '@/lib/supabase/types'

export type AjustesAgente = Database['academia']['Tables']['agent_settings']['Row']

/** Los ajustes del agente que corre en este servidor (el real, o el de la suite). */
export async function ajustesDelAgente(qa = esModoQa()): Promise<AjustesAgente | null> {
  const { data, error } = await dbDelAgente().from('agent_settings').select('*').eq('es_qa', qa).maybeSingle()
  if (error) console.error(JSON.stringify({ operacion: 'agente:ajustes', error: error.message }))
  return data
}

export function vozDe(a: AjustesAgente): string {
  return a.prompt.trim() || VOZ_POR_DEFECTO
}

const ZONA = 'America/Mexico_City'

function partesEnCdmx(fecha: Date): { dia: string; hora: number } {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(fecha)
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? '00'
  return { dia: `${v('year')}-${v('month')}-${v('day')}`, hora: Number(v('hour')) }
}

/**
 * Las `hh:00` de un día de la Ciudad de México, como instante. CDMX no cambia
 * de horario desde 2022, pero se calcula con Intl y no con un -06:00 fijo por
 * si eso vuelve a cambiar.
 */
function aLasEnCdmx(dia: string, hora: number): Date {
  const aprox = new Date(`${dia}T${String(hora).padStart(2, '0')}:00:00Z`)
  const { hora: h, dia: d } = partesEnCdmx(aprox)
  let desfase = h - hora
  if (d < dia) desfase -= 24
  else if (d > dia) desfase += 24
  return new Date(aprox.getTime() - desfase * 3_600_000)
}

/**
 * Cuándo contesta el agente un mensaje: entre `espera_min` y `espera_max`
 * minutos después de escrito, al azar, para que no se sienta un bot; y solo
 * dentro del horario (8 a 21 h en CDMX por defecto). Lo de la noche, en la
 * mañana, repartido en la primera media hora.
 */
export function tocaEn(creado: Date, a: Pick<AjustesAgente, 'espera_min' | 'espera_max' | 'hora_inicio' | 'hora_fin'>, ahora = new Date(), azar = Math.random): Date {
  const minutos = a.espera_min + azar() * (a.espera_max - a.espera_min)
  const propuesto = new Date(Math.max(creado.getTime() + minutos * 60_000, ahora.getTime()))
  const { dia, hora } = partesEnCdmx(propuesto)
  if (hora >= a.hora_inicio && hora < a.hora_fin) return propuesto

  let diaDeApertura = dia
  if (hora >= a.hora_fin) {
    const manana = new Date(aLasEnCdmx(dia, 12).getTime() + 24 * 3_600_000)
    diaDeApertura = partesEnCdmx(manana).dia
  }
  return new Date(aLasEnCdmx(diaDeApertura, a.hora_inicio).getTime() + azar() * 30 * 60_000)
}
