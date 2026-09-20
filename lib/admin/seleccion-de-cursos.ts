import 'server-only'

import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * La selección de cursos de un alta, leída y revisada.
 *
 * La comparten el alta de una persona (`altaManual`) y la de un archivo
 * (`altaMasiva`): las dos reciben la misma lista de casillas y tienen que
 * aplicarle exactamente las mismas reglas. Vive aparte porque un archivo con
 * 'use server' solo puede exportar acciones.
 *
 * Cada casilla manda un par `cursoId|cohorteId`, con la cohorte vacía para "sin
 * grupo". Así un solo control resuelve curso Y grupo sin JavaScript: un segundo
 * selector que dependiera del primero no se podría actualizar sin él.
 */

/** Un par `cursoId|cohorteId`. */
export const PAR = /^[0-9a-f-]{36}\|([0-9a-f-]{36})?$/i

/** "A", "A y B", "A, B y C" — con las reglas del español (y/e). */
export function enLista(valores: string[]): string {
  return new Intl.ListFormat('es', { style: 'long', type: 'conjunction' }).format(valores)
}

/**
 * De los pares del formulario a "un grupo por curso".
 *
 * Sin JavaScript la lista deja marcar dos grupos del mismo curso, y una
 * inscripción solo puede pertenecer a uno: eso se rechaza aquí.
 */
export function leerPares(pares: string[]): Map<string, string | null> | { error: string } {
  const grupoPorCurso = new Map<string, string | null>()
  for (const par of pares) {
    if (!PAR.test(par)) return { error: 'Selección inválida.' }
    const [cursoId = '', cohorteId = ''] = par.split('|')
    const grupo = cohorteId || null
    if (grupoPorCurso.has(cursoId) && grupoPorCurso.get(cursoId) !== grupo) {
      return { error: 'Marcaste dos grupos del mismo curso. Deja solo uno por curso.' }
    }
    grupoPorCurso.set(cursoId, grupo)
  }
  return grupoPorCurso
}

export type SeleccionRevisada =
  | { ok: false; error: string }
  | {
      ok: true
      /** En el orden en que se marcaron. */
      cursos: Array<{ id: string; titulo: string; cohorteId: string | null }>
    }

/**
 * Revisa TODO antes de que se cree nada: que haya al menos un curso, que exista,
 * que no esté archivado y que cada grupo sea de su curso. Con tres cursos
 * marcados —o con un archivo de cuarenta personas— descubrirlo a medio camino
 * dejaría un alta a medias.
 *
 * Lee con el cliente de servidor: pasa por RLS, como el resto del admin.
 */
export async function revisarSeleccion(pares: string[]): Promise<SeleccionRevisada> {
  const grupoPorCurso = leerPares(pares)
  if ('error' in grupoPorCurso) return { ok: false, error: grupoPorCurso.error }
  if (grupoPorCurso.size === 0) return { ok: false, error: 'Elige al menos un curso.' }

  const cursoIds = [...grupoPorCurso.keys()]
  const cohorteIds = [...grupoPorCurso.values()].filter((v): v is string => v !== null)
  const supabase = await crearClienteServidor()

  const [cursos, cohortes] = await Promise.all([
    supabase.from('courses').select('id, title, status').in('id', cursoIds),
    cohorteIds.length > 0
      ? supabase.from('cohorts').select('id, course_id').in('id', cohorteIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const fallo = cursos.error ?? cohortes.error
  if (fallo) {
    console.error(JSON.stringify({ operacion: 'revisarSeleccion', error: fallo.message }))
    return { ok: false, error: 'No se pudo revisar la selección. Intenta de nuevo.' }
  }

  const cursoPorId = new Map((cursos.data ?? []).map((c) => [c.id, c]))
  const cursoDeCohorte = new Map((cohortes.data ?? []).map((c) => [c.id, c.course_id]))
  const revisados: Array<{ id: string; titulo: string; cohorteId: string | null }> = []

  for (const [cursoId, grupo] of grupoPorCurso) {
    const curso = cursoPorId.get(cursoId)
    if (!curso) return { ok: false, error: 'Uno de los cursos ya no existe.' }
    if (curso.status === 'archived') {
      return {
        ok: false,
        error: `"${curso.title}" está archivado. Restáuralo antes de dar de alta a alguien.`,
      }
    }
    // El grupo viaja en el formulario y cualquiera puede editarlo.
    if (grupo !== null && cursoDeCohorte.get(grupo) !== cursoId) {
      return { ok: false, error: 'Uno de los grupos no pertenece a su curso.' }
    }
    revisados.push({ id: cursoId, titulo: curso.title, cohorteId: grupo })
  }

  return { ok: true, cursos: revisados }
}
