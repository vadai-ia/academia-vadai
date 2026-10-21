import 'server-only'

import { cache } from 'react'

import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * Los «dos mundos» del panel (M25, 20-oct-2026).
 *
 * Alejandro: «hay tantas pestañas… muchas cosas significan lo mismo». Una de
 * las razones: la casa de V-AI-P aparecía como un curso más en Cursos, Panel,
 * Bandeja, Puntos y Publicaciones. La decisión fue partir el panel en dos
 * mundos —V-AI-P y Cursos— y que lo de cursos nunca enseñe V-AI-P ni al revés.
 *
 * Aquí vive, una sola vez, qué es de V-AI-P: el curso casa de CADA plan de
 * membresía (no solo de V-AI-P), así que las casas de los planes QA se
 * comportan igual que la real y las suites prueban la separación sin escribir
 * nunca en la de producción. Desde M26 (21-oct-2026) las herramientas ya no
 * son cursos con área: son videos de la casa, así que la casa es todo V-AI-P.
 *
 * Con el cliente de quien pregunta: un community manager solo lee los planes
 * activos (0042), así que la casa de un plan en borrador le saldría como curso.
 * Hoy hay un solo plan y está activo.
 */

export type MundoVaip = {
  casas: Set<string>
  /** Todo lo de V-AI-P. Desde M26 son solo las casas; se queda el nombre para no tocar a quien lo lee. */
  ids: Set<string>
}

export const mundoVaip = cache(async (): Promise<MundoVaip> => {
  const supabase = await crearClienteServidor()
  const planes = await supabase.from('membership_plans').select('hub_course_id').not('hub_course_id', 'is', null)
  if (planes.error) console.error(JSON.stringify({ operacion: 'mundoVaip:planes', error: planes.error.message }))
  const casas = new Set((planes.data ?? []).map((p) => p.hub_course_id).filter((v): v is string => Boolean(v)))
  return { casas, ids: casas }
})

/** ¿Es de V-AI-P (una casa)? */
export function esDeVaip(mundo: MundoVaip, cursoId: string | null | undefined): boolean {
  return Boolean(cursoId && mundo.ids.has(cursoId))
}

/** La lista sin lo de V-AI-P: lo que enseñan las pantallas de Cursos. */
export function sinVaip<T extends { id: string }>(mundo: MundoVaip, lista: T[]): T[] {
  return lista.filter((c) => !mundo.ids.has(c.id))
}
