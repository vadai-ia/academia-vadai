'use server'

import { revalidatePath } from 'next/cache'

import { exigirPerfil } from '@/lib/auth/sesion'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * Mutaciones del alumno.
 *
 * Ninguna verifica el enrollment a mano: las policies de `lesson_progress`
 * exigen `has_active_access` en INSERT y UPDATE, así que un alumno vencido
 * simplemente no escribe. La regla vive en la base, no aquí.
 */

const BUCKET_ADJUNTOS = 'academia-adjuntos'

export type ResultadoProgreso = {
  ok: boolean
  completada?: boolean
}

/**
 * Guarda avance de reproducción y marca completada al llegar al 90% (§3.3).
 *
 * El umbral se decide en el servidor, no en el navegador: si el cliente pudiera
 * decir "ya la completé", marcar el curso entero sería una petición.
 * `segundos` sí viene del player, pero solo puede acercar el avance, nunca
 * declarar por sí mismo que terminó.
 */
export async function guardarAvance(
  leccionId: string,
  segundos: number,
  duracionSeg: number | null,
  cursoSlug: string
): Promise<ResultadoProgreso> {
  const perfil = await exigirPerfil()

  const vistos = Math.max(0, Math.floor(segundos))
  const alcanzaUmbral =
    duracionSeg !== null && duracionSeg > 0 && vistos >= Math.floor(duracionSeg * 0.9)

  const supabase = await crearClienteServidor()

  const { data, error } = await supabase
    .from('lesson_progress')
    .upsert(
      {
        user_id: perfil.user_id,
        lesson_id: leccionId,
        seconds_watched: vistos,
        ...(alcanzaUmbral ? { completed: true, completed_at: new Date().toISOString() } : {}),
      },
      { onConflict: 'user_id,lesson_id' }
    )
    .select('completed')
    .maybeSingle()

  if (error) {
    console.error(
      JSON.stringify({ operacion: 'guardarAvance', leccionId, error: error.message })
    )
    return { ok: false }
  }

  // Solo se revalida cuando cambió algo visible: el player manda avance cada
  // pocos segundos y revalidar en cada uno tiraría el caché sin motivo.
  if (alcanzaUmbral) revalidatePath(`/curso/${cursoSlug}`)

  return { ok: true, completada: data?.completed ?? false }
}

/** Botón "Marcar como completada" (§3.3). */
export async function alternarCompletada(
  leccionId: string,
  completada: boolean,
  cursoSlug: string
): Promise<ResultadoProgreso> {
  const perfil = await exigirPerfil()

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('lesson_progress').upsert(
    {
      user_id: perfil.user_id,
      lesson_id: leccionId,
      completed: completada,
      completed_at: completada ? new Date().toISOString() : null,
    },
    { onConflict: 'user_id,lesson_id' }
  )

  if (error) {
    console.error(
      JSON.stringify({ operacion: 'alternarCompletada', leccionId, error: error.message })
    )
    return { ok: false }
  }

  revalidatePath(`/curso/${cursoSlug}`)
  return { ok: true, completada }
}

/**
 * URL firmada para descargar un adjunto.
 *
 * Usa la llave del alumno, no service role: la policy
 * `academia_adjuntos_leccion_select` (migración 0018) es la que decide, y exige
 * acceso vigente al curso de esa lección. Si el acceso venció, Supabase se
 * niega a firmar y aquí no hay nada que validar a mano.
 */
export async function urlDeAdjunto(rutaStorage: string): Promise<string | null> {
  await exigirPerfil()

  const supabase = await crearClienteServidor()
  const { data, error } = await supabase.storage
    .from(BUCKET_ADJUNTOS)
    .createSignedUrl(rutaStorage, 60 * 5)

  if (error) {
    console.error(JSON.stringify({ operacion: 'urlDeAdjunto', rutaStorage, error: error.message }))
    return null
  }
  return data.signedUrl
}
