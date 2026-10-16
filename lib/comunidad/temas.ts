import 'server-only'

import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * Los temas del muro de un curso (M17, academia_0041). Los crea el equipo; el
 * muro principal muestra todo y el tema solo filtra.
 */
export type Tema = {
  id: string
  nombre: string
  slug: string
  /** M19: en este tema solo publica el equipo («Noticias»). Todos lo pueden filtrar. */
  soloEquipo: boolean
}

export async function temasDelCurso(cursoId: string): Promise<Tema[]> {
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('community_topics')
    .select('id, name, slug, solo_equipo')
    .eq('course_id', cursoId)
    .eq('archived', false)
    .order('position')
    .order('name')
  // Sin la migración aplicada la tabla no existe: el muro sigue sin temas.
  if (error) return []
  return (data ?? []).map((t) => ({ id: t.id, nombre: t.name, slug: t.slug, soloEquipo: t.solo_equipo }))
}
