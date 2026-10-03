import 'server-only'

import { esPorGeneraciones, estadoDeGeneracion } from '@/lib/generaciones'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * La selección de cursos de un alta, leída y revisada.
 *
 * La comparten el alta de una persona (`altaManual`) y la de un archivo
 * (`altaMasiva`): las dos reciben la misma lista de casillas y tienen que
 * aplicarle exactamente las mismas reglas. Vive aparte porque un archivo con
 * 'use server' solo puede exportar acciones.
 *
 * Cada casilla manda un par `cursoId|cohorteId`, con la generación vacía para
 * «la abierta» (o «sin generación» en cursos que no tienen). Así un solo control
 * resuelve curso Y generación sin JavaScript: un segundo selector que
 * dependiera del primero no se podría actualizar sin él.
 */

/** Un par `cursoId|cohorteId`. */
export const PAR = /^[0-9a-f-]{36}\|([0-9a-f-]{36})?$/i

/** "A", "A y B", "A, B y C" — con las reglas del español (y/e). */
export function enLista(valores: string[]): string {
  return new Intl.ListFormat('es', { style: 'long', type: 'conjunction' }).format(valores)
}

/**
 * De los pares del formulario a "una generación por curso".
 *
 * Sin JavaScript la lista deja marcar dos generaciones del mismo curso, y una
 * inscripción solo puede pertenecer a una: eso se rechaza aquí.
 */
export function leerPares(pares: string[]): Map<string, string | null> | { error: string } {
  const grupoPorCurso = new Map<string, string | null>()
  for (const par of pares) {
    if (!PAR.test(par)) return { error: 'Selección inválida.' }
    const [cursoId = '', cohorteId = ''] = par.split('|')
    const grupo = cohorteId || null
    if (grupoPorCurso.has(cursoId) && grupoPorCurso.get(cursoId) !== grupo) {
      return { error: 'Marcaste dos generaciones del mismo curso. Deja solo una por curso.' }
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
 * que no esté archivado y que cada generación sea de su curso. Con tres cursos
 * marcados —o con un archivo de cuarenta personas— descubrirlo a medio camino
 * dejaría un alta a medias.
 *
 * M16: en un curso por generaciones, un par sin generación cae en la ABIERTA a
 * inscripciones; si no hay ninguna abierta, se pide elegir (decisión 5).
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
    supabase
      .from('courses')
      .select('id, title, status, course_type, cohorts(id, open_for_enrollment, ends_on)')
      .in('id', cursoIds),
    cohorteIds.length > 0
      ? supabase.from('cohorts').select('id, course_id').in('id', cohorteIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const fallo = cursos.error ?? cohortes.error
  if (fallo) {
    console.error(JSON.stringify({ operacion: 'revisarSeleccion', error: fallo.message }))
    return { ok: false, error: 'No se pudo revisar la selección. Intenta de nuevo.' }
  }

  type CursoConGeneraciones = {
    id: string
    title: string
    status: string
    course_type: string
    cohorts: Array<{ id: string; open_for_enrollment: boolean; ends_on: string | null }>
  }
  const cursoPorId = new Map(((cursos.data ?? []) as unknown as CursoConGeneraciones[]).map((c) => [c.id, c]))
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
    // La generación viaja en el formulario y cualquiera puede editarla.
    if (grupo !== null && cursoDeCohorte.get(grupo) !== cursoId) {
      return { ok: false, error: 'Una de las generaciones no es de su curso.' }
    }
    const generacion = generacionDeAlta(curso, grupo)
    if ('error' in generacion) return { ok: false, error: generacion.error }
    revisados.push({ id: cursoId, titulo: curso.title, cohorteId: generacion.id })
  }

  return { ok: true, cursos: revisados }
}

/**
 * La generación en la que cae un alta (M16). Curso sin generaciones: ninguna.
 * Curso por generaciones: la elegida; si no se eligió, la abierta a
 * inscripciones; sin abierta, hay que elegir.
 */
export function generacionDeAlta(
  curso: {
    title: string
    course_type: string
    cohorts: Array<{ id: string; open_for_enrollment: boolean; ends_on: string | null }>
  },
  elegida: string | null
): { id: string | null } | { error: string } {
  if (!esPorGeneraciones(curso.course_type)) return { id: null }
  if (elegida) return { id: elegida }
  const abierta = (curso.cohorts ?? []).find((g) => estadoDeGeneracion(g) === 'abierta')
  if (abierta) return { id: abierta.id }
  return {
    error: `"${curso.title}" no tiene una generación abierta a inscripciones: elige en cuál entra.`,
  }
}
