import 'server-only'

import { accesoMayor, vigente } from '@/lib/membresia/acceso'
import { esCuentaQa, esCursoQa } from '@/lib/qa'
import { avisarCursoNuevo, generacionAbierta } from '@/lib/stripe/provisioning'
import { crearClienteServiceRole } from '@/lib/supabase/service-role'

/**
 * Pone las inscripciones de una persona al día con su membresía (M17).
 *
 * El acceso a V-AI-P son inscripciones normales con `source = 'membresia'`, y
 * esta función es la única que las escribe. Por curso del plan:
 *
 *   - sin inscripción → se crea (si la membresía da acceso hoy), en la
 *     generación abierta si el curso es por generaciones;
 *   - de la membresía → `expires_at` = el acceso de la membresía, que puede
 *     alargarse (renovó) o acortarse (canceló);
 *   - de otro origen sin vencimiento, o con uno posterior → no se toca: un
 *     curso comprado de por vida no se acorta porque la membresía venza;
 *   - de otro origen con un vencimiento menor → la membresía se la queda;
 *   - revocada → jamás se reactiva: una revocación es una decisión del equipo.
 *
 * Service role: corre desde el webhook y desde una acción del panel ya
 * autorizada, nunca con la sesión de un alumno.
 */

function registrar(operacion: string, detalle: Record<string, unknown>) {
  console.log(JSON.stringify({ operacion, ...detalle }))
}

export type ResultadoSincronizacion = {
  ok: boolean
  /** Títulos de los cursos que la persona recibió por primera vez. */
  nuevos: string[]
  actualizados: number
  hasta: string | null
  motivo?: string
}

/** El acceso de una persona a un plan: la mayor de sus suscripciones. */
export async function accesoDePersona(userId: string, planId: string): Promise<string | null> {
  const supabase = crearClienteServiceRole()
  const { data } = await supabase
    .from('memberships')
    .select('access_until')
    .eq('user_id', userId)
    .eq('plan_id', planId)
  return accesoMayor((data ?? []).map((m) => m.access_until))
}

type CursoDelPlan = { id: string; title: string; slug: string; course_type: 'cohort' | 'evergreen' }

/** Los cursos publicados del plan. Los QA solo cuentan para cuentas QA. */
export async function cursosDelPlan(planId: string, incluirQa: boolean): Promise<CursoDelPlan[]> {
  const supabase = crearClienteServiceRole()
  const { data, error } = await supabase
    .from('courses')
    .select('id, title, slug, course_type')
    .eq('plan_id', planId)
    .eq('status', 'published')
  if (error) {
    registrar('membresia:cursosDelPlan', { planId, error: error.message })
    return []
  }
  return (data ?? []).filter((c) => incluirQa || !esCursoQa(c.slug))
}

export async function sincronizarMembresia(
  userId: string,
  planId: string,
  opciones: { avisar?: boolean } = {}
): Promise<ResultadoSincronizacion> {
  const supabase = crearClienteServiceRole()

  const { data: perfil } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('user_id', userId)
    .maybeSingle()
  if (!perfil) return { ok: false, nuevos: [], actualizados: 0, hasta: null, motivo: 'Sin perfil.' }

  const hasta = await accesoDePersona(userId, planId)
  const cursos = await cursosDelPlan(planId, esCuentaQa(perfil.email))
  if (cursos.length === 0) return { ok: true, nuevos: [], actualizados: 0, hasta }

  const { data: previas, error: errorPrevias } = await supabase
    .from('enrollments')
    .select('course_id, source, status, expires_at')
    .eq('user_id', userId)
    .in(
      'course_id',
      cursos.map((c) => c.id)
    )
  if (errorPrevias) {
    registrar('membresia:sincronizar', { userId, error: errorPrevias.message })
    return { ok: false, nuevos: [], actualizados: 0, hasta, motivo: errorPrevias.message }
  }

  const porCurso = new Map((previas ?? []).map((e) => [e.course_id, e]))
  const nuevos: string[] = []
  let actualizados = 0
  let fallas = 0

  for (const curso of cursos) {
    const previa = porCurso.get(curso.id)

    if (!previa) {
      // Sin acceso hoy no se crea nada: no hay por qué dejar una inscripción vencida.
      if (!vigente(hasta)) continue
      const { error } = await supabase.from('enrollments').insert({
        user_id: userId,
        course_id: curso.id,
        cohort_id: curso.course_type === 'cohort' ? await generacionAbierta(curso.id) : null,
        source: 'membresia',
        status: 'active',
        expires_at: hasta,
      })
      if (error) {
        fallas += 1
        registrar('membresia:inscripcionFallida', { userId, curso: curso.slug, error: error.message })
      } else {
        nuevos.push(curso.title)
      }
      continue
    }

    if (previa.status === 'revoked') continue

    let expiraEn: string | null | undefined
    if (previa.source === 'membresia') {
      // Sin acceso, el vencimiento es ahora: "estructura sí, contenido no".
      expiraEn = hasta ?? new Date().toISOString()
      if (expiraEn === previa.expires_at) expiraEn = undefined
    } else if (
      previa.expires_at !== null &&
      hasta !== null &&
      Date.parse(previa.expires_at) < Date.parse(hasta)
    ) {
      expiraEn = hasta
    }
    if (expiraEn === undefined) continue

    const { error } = await supabase
      .from('enrollments')
      .update({ source: 'membresia', expires_at: expiraEn })
      .eq('user_id', userId)
      .eq('course_id', curso.id)
    if (error) {
      fallas += 1
      registrar('membresia:actualizacionFallida', { userId, curso: curso.slug, error: error.message })
    } else {
      actualizados += 1
    }
  }

  // Cada curso nuevo para alguien que ya tiene cuenta se avisa (CLAUDE.md).
  // Las renovaciones no mandan nada.
  if (nuevos.length > 0 && (opciones.avisar ?? true)) {
    await avisarCursoNuevo(perfil.email, nuevos, perfil.full_name)
  }

  registrar('membresia:sincronizada', { userId, hasta, nuevos: nuevos.length, actualizados, fallas })
  return { ok: fallas === 0, nuevos, actualizados, hasta }
}
