'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { exigirAdmin } from '@/lib/auth/sesion'
import { darDeAlta, enviarAccesoInicial } from '@/lib/stripe/provisioning'
import { crearClienteServidor } from '@/lib/supabase/server'

import type { EstadoAccion } from './tipos'

/**
 * Alta manual de alumnos (§3.1-A).
 *
 * Usa el MISMO `darDeAlta` que el webhook de Stripe. Es el respaldo que promete
 * §11: si el webhook falla en una compra real, el admin da de alta a mano y el
 * resultado es idéntico, no una versión aproximada.
 */

/** Un par `cursoId|cohorteId`; la cohorte va vacía para "sin grupo". */
const PAR = /^[0-9a-f-]{36}\|([0-9a-f-]{36})?$/i

/**
 * De los pares del formulario a "un grupo por curso".
 *
 * Sin JavaScript la lista deja marcar dos grupos del mismo curso, y una
 * inscripción solo puede pertenecer a uno: eso se rechaza aquí.
 */
function leerPares(pares: string[]): Map<string, string | null> | { error: string } {
  const grupoPorCurso = new Map<string, string | null>()
  for (const par of pares) {
    const [cursoId = '', cohorteId = ''] = par.split('|')
    const grupo = cohorteId || null
    if (grupoPorCurso.has(cursoId) && grupoPorCurso.get(cursoId) !== grupo) {
      return { error: 'Marcaste dos grupos del mismo curso. Deja solo uno por curso.' }
    }
    grupoPorCurso.set(cursoId, grupo)
  }
  return grupoPorCurso
}

/** "A", "A y B", "A, B y C" — con las reglas del español (y/e). */
function enLista(valores: string[]): string {
  return new Intl.ListFormat('es', { style: 'long', type: 'conjunction' }).format(valores)
}

const esquema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Escribe el correo.')
    .email('Ese correo no parece válido.')
    .transform((v) => v.toLowerCase()),
  nombre: z.string().trim().max(160),
  // Dos formas de decir a qué cursos. /admin/alumnos manda la lista de casillas
  // (`accesos`, pares curso|grupo, uno o varios). La página de un curso manda ese
  // curso fijo (`course_id` + `cohort_id`).
  accesos: z.array(z.string().regex(PAR, 'Selección inválida.')),
  course_id: z.union([z.uuid('Curso inválido.'), z.literal('')]),
  cohort_id: z.union([z.uuid('Grupo inválido.'), z.literal('')]),
})

export async function altaManual(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()

  const resultado = esquema.safeParse({
    email: datos.get('email'),
    nombre: datos.get('nombre') ?? '',
    accesos: datos.getAll('accesos').filter((v): v is string => typeof v === 'string'),
    course_id: datos.get('course_id') ?? '',
    cohort_id: datos.get('cohort_id') ?? '',
  })

  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? 'Revisa los datos.' }
  }

  const { email, nombre, accesos, course_id: cursoFijo, cohort_id: grupoFijo } = resultado.data

  const grupoPorCurso = leerPares(
    accesos.length > 0 ? accesos : cursoFijo ? [`${cursoFijo}|${grupoFijo}`] : []
  )
  if ('error' in grupoPorCurso) return { error: grupoPorCurso.error }
  if (grupoPorCurso.size === 0) return { error: 'Elige al menos un curso.' }

  // Se revisa TODO antes de crear nada: con tres cursos marcados, descubrir en
  // el tercero que el grupo no existe dejaría un alta a medias.
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
    console.error(JSON.stringify({ operacion: 'altaManual:lectura', email, error: fallo.message }))
    return { error: 'No se pudo revisar la selección. Intenta de nuevo.' }
  }

  const cursoPorId = new Map((cursos.data ?? []).map((c) => [c.id, c]))
  const cursoDeCohorte = new Map((cohortes.data ?? []).map((c) => [c.id, c.course_id]))

  for (const [cursoId, grupo] of grupoPorCurso) {
    const curso = cursoPorId.get(cursoId)
    if (!curso) return { error: 'Uno de los cursos ya no existe.' }
    if (curso.status === 'archived') {
      return { error: `"${curso.title}" está archivado. Restáuralo antes de dar de alta a alguien.` }
    }
    if (grupo !== null && cursoDeCohorte.get(grupo) !== cursoId) {
      return { error: 'Uno de los grupos no pertenece a su curso.' }
    }
  }

  const titulos = cursoIds.map((id) => cursoPorId.get(id)?.title ?? 'Curso')

  // Una llamada a `darDeAlta` por curso. La primera crea la cuenta y manda el
  // ÚNICO correo —que por eso nombra todos los cursos—; las demás encuentran la
  // cuenta ya hecha y solo agregan su inscripción.
  let creado = false
  let invitado = false
  const listos: string[] = []

  for (const [i, cursoId] of cursoIds.entries()) {
    const alta = await darDeAlta({
      email,
      nombre: nombre || null,
      courseId: cursoId,
      cohortId: grupoPorCurso.get(cursoId) ?? null,
      origen: 'manual',
      urlRedireccion: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/nueva-contrasena`,
      titulosParaCorreo: titulos,
    })

    if (!alta.ok) {
      revalidatePath('/admin/alumnos')
      return {
        error:
          listos.length === 0
            ? (alta.motivo ?? 'No se pudo dar de alta.')
            : `${email} quedó con ${enLista(listos)}, pero falló "${titulos[i]}": ` +
              `${alta.motivo ?? 'error desconocido'}. Vuelve a intentarlo solo con ese curso.`,
      }
    }

    if (i === 0) {
      creado = alta.creado === true
      invitado = alta.invitado === true
    }
    listos.push(titulos[i] ?? 'Curso')
  }

  revalidatePath('/admin/alumnos')
  revalidatePath('/admin/cursos')
  // También se da de alta desde la página del curso, que lista a sus inscritos.
  for (const id of cursoIds) revalidatePath(`/admin/cursos/${id}`)

  if (!creado) {
    return { aviso: `${email} ya tenía cuenta; se le agregó ${enLista(listos)}.` }
  }

  // La cuenta y la inscripción existen aunque el correo no haya salido. Se dice
  // sin rodeos, porque significa que hay que hacer algo: sin ese correo la
  // persona no puede entrar.
  return invitado
    ? { aviso: `${email} dado de alta en ${enLista(listos)}. Le llegó el correo para definir su contraseña.` }
    : {
        error:
          `${email} quedó dado de alta CON ${enLista(listos)}, pero el correo no salió. ` +
          'Revisa RESEND_API_KEY y usa "Reenviar correo de acceso" cuando funcione.',
      }
}

/** Reintenta el correo de acceso para alguien ya dado de alta. */
export async function reenviarAcceso(datos: FormData): Promise<void> {
  await exigirAdmin()

  const email = String(datos.get('email') ?? '').trim().toLowerCase()
  if (!email) return

  // El reenvío tiene que decir lo mismo que el correo original: su nombre y los
  // cursos a los que entra. Sin esto saldría un "Hola," genérico sin curso.
  const supabase = await crearClienteServidor()
  const { data: persona } = await supabase
    .from('profiles')
    .select('user_id, full_name')
    .eq('email', email)
    .maybeSingle()

  let cursos: string[] = []
  if (persona) {
    const { data: inscripciones } = await supabase
      .from('enrollments')
      .select('course_id')
      .eq('user_id', persona.user_id)
      .eq('status', 'active')

    const ids = (inscripciones ?? []).map((e) => e.course_id)
    if (ids.length > 0) {
      const { data: titulos } = await supabase
        .from('courses')
        .select('title')
        .in('id', ids)
        .neq('status', 'archived')
        .order('title')
      cursos = (titulos ?? []).map((c) => c.title)
    }
  }

  const enviado = await enviarAccesoInicial(
    email,
    `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/nueva-contrasena`,
    cursos,
    persona?.full_name
  )

  console.log(JSON.stringify({ operacion: 'reenviarAcceso', email, enviado }))
  revalidatePath('/admin/alumnos')
}

/**
 * Revoca o restaura el acceso de un alumno a un curso.
 * El progreso nunca se toca (§6.3).
 */
export async function cambiarAcceso(datos: FormData): Promise<void> {
  await exigirAdmin()

  const userId = String(datos.get('user_id') ?? '')
  const courseId = String(datos.get('course_id') ?? '')
  const revocar = String(datos.get('revocar') ?? '') === 'si'
  if (!userId || !courseId) return

  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('enrollments')
    .update({ status: revocar ? 'revoked' : 'active' })
    .eq('user_id', userId)
    .eq('course_id', courseId)

  if (error) {
    console.error(JSON.stringify({ operacion: 'cambiarAcceso', userId, error: error.message }))
  }

  revalidatePath('/admin/alumnos')
}

// ==========================================================================
// Dar acceso a quien YA tiene cuenta — desde el alumno o desde el curso
// ==========================================================================

type Par = { userId: string; cursoId: string; cohorteId: string | null }

type ResultadoInscripciones =
  | { ok: false; error: string }
  | {
      ok: true
      creadas: Par[]
      omitidas: Par[]
      tituloDe: Map<string, string>
      nombreDe: Map<string, string>
    }

/**
 * Crea inscripciones para pares (persona, curso). Es la mitad compartida de
 * `darAccesoACursos` (una persona, varios cursos) y de `inscribirEnCurso` (un
 * curso, varias personas): la misma relación vista desde sus dos lados, así que
 * las reglas viven una sola vez.
 *
 * Va por el cliente de servidor y no por service role: `enrollments_insert_admin`
 * ya deja insertar al admin, y así respeta RLS como el resto de la pantalla.
 *
 * Solo CREA. Si la persona ya tiene inscripción en ese curso —vigente, vencida
 * o revocada— no se toca: un upsert le reiniciaría la vigencia y le borraría el
 * grupo, y para eso ya están "Restaurar acceso" y "Extender días".
 *
 * No manda correo: la persona ya sabe entrar, y encuentra el curso nuevo en
 * /mis-cursos.
 */
async function crearInscripciones(pares: Par[]): Promise<ResultadoInscripciones> {
  const userIds = [...new Set(pares.map((p) => p.userId))]
  const cursoIds = [...new Set(pares.map((p) => p.cursoId))]
  const cohorteIds = [
    ...new Set(pares.map((p) => p.cohorteId).filter((v): v is string => v !== null)),
  ]

  const supabase = await crearClienteServidor()

  const [personas, cursos, cohortes, previas] = await Promise.all([
    supabase.from('profiles').select('user_id, full_name, email').in('user_id', userIds),
    supabase.from('courses').select('id, title, access_days, status').in('id', cursoIds),
    cohorteIds.length > 0
      ? supabase.from('cohorts').select('id, course_id').in('id', cohorteIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('enrollments')
      .select('user_id, course_id')
      .in('user_id', userIds)
      .in('course_id', cursoIds),
  ])

  const fallo = personas.error ?? cursos.error ?? cohortes.error ?? previas.error
  if (fallo) {
    console.error(JSON.stringify({ operacion: 'crearInscripciones:lectura', error: fallo.message }))
    return { ok: false, error: 'No se pudo revisar la selección. Intenta de nuevo.' }
  }

  const nombreDe = new Map(
    (personas.data ?? []).map((p) => [p.user_id, p.full_name.trim() || p.email])
  )
  if (userIds.some((id) => !nombreDe.has(id))) {
    return { ok: false, error: 'Una de las cuentas ya no existe.' }
  }

  const cursoPorId = new Map((cursos.data ?? []).map((c) => [c.id, c]))
  if (cursoIds.some((id) => !cursoPorId.has(id))) {
    return { ok: false, error: 'Uno de los cursos ya no existe.' }
  }

  // El grupo tiene que ser de ESE curso: el valor viaja en el formulario y
  // cualquiera puede editarlo.
  const cursoDeCohorte = new Map((cohortes.data ?? []).map((c) => [c.id, c.course_id]))
  for (const par of pares) {
    if (par.cohorteId !== null && cursoDeCohorte.get(par.cohorteId) !== par.cursoId) {
      return { ok: false, error: 'Uno de los grupos no pertenece a su curso.' }
    }
  }

  const yaInscrito = new Set((previas.data ?? []).map((e) => `${e.user_id}::${e.course_id}`))
  const creadas: Par[] = []
  const omitidas: Par[] = []

  for (const par of pares) {
    const archivado = cursoPorId.get(par.cursoId)?.status === 'archived'
    if (archivado || yaInscrito.has(`${par.userId}::${par.cursoId}`)) omitidas.push(par)
    else creadas.push(par)
  }

  if (creadas.length > 0) {
    const { error } = await supabase.from('enrollments').insert(
      creadas.map((par) => {
        const dias = cursoPorId.get(par.cursoId)?.access_days
        return {
          user_id: par.userId,
          course_id: par.cursoId,
          cohort_id: par.cohorteId,
          source: 'manual' as const,
          status: 'active' as const,
          // Misma regla que `darDeAlta`: la vigencia sale de los días del curso.
          expires_at:
            dias != null ? new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString() : null,
        }
      })
    )

    if (error) {
      console.error(
        JSON.stringify({ operacion: 'crearInscripciones', userIds, cursoIds, error: error.message })
      )
      return { ok: false, error: 'No se pudo dar el acceso.' }
    }

    console.log(JSON.stringify({ operacion: 'crearInscripciones:ok', creadas }))
  }

  revalidatePath('/admin/alumnos')
  revalidatePath('/admin/cursos')
  for (const id of cursoIds) revalidatePath(`/admin/cursos/${id}`)

  return {
    ok: true,
    creadas,
    omitidas,
    tituloDe: new Map((cursos.data ?? []).map((c) => [c.id, c.title])),
    nombreDe,
  }
}

/** Títulos o nombres sin repetir, para armar el aviso. */
function enumerar(valores: Array<string | undefined>): string {
  return [...new Set(valores.filter((v): v is string => Boolean(v)))].join(', ')
}

/**
 * Cada opción es un par `cursoId|cohorteId`, con la cohorte vacía para "sin
 * grupo". Un solo control resuelve así curso Y grupo sin JavaScript: un segundo
 * selector que dependa del primero no se puede actualizar sin él.
 */
const esquemaAccesos = z.object({
  user_id: z.uuid('Cuenta inválida.'),
  accesos: z
    .array(z.string().regex(PAR, 'Selección inválida.'))
    .min(1, 'Elige al menos un curso.'),
})

/**
 * Desde la fila de un alumno: le da acceso a uno o varios cursos.
 *
 * Antes la única forma era volver a "Dar de alta" con su correo, que funciona
 * pero nadie lo adivina.
 */
export async function darAccesoACursos(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()

  const resultado = esquemaAccesos.safeParse({
    user_id: datos.get('user_id'),
    accesos: datos.getAll('accesos').filter((v): v is string => typeof v === 'string'),
  })
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? 'Revisa los datos.' }
  }

  const grupoPorCurso = leerPares(resultado.data.accesos)
  if ('error' in grupoPorCurso) return { error: grupoPorCurso.error }

  const hecho = await crearInscripciones(
    [...grupoPorCurso].map(([cursoId, cohorteId]) => ({
      userId: resultado.data.user_id,
      cursoId,
      cohorteId,
    }))
  )
  if (!hecho.ok) return { error: hecho.error }

  if (hecho.creadas.length === 0) {
    return {
      error:
        'No había nada que agregar: ya tiene esos cursos, o están archivados. ' +
        'Para uno que ya tiene, usa "Restaurar acceso" o "Extender días".',
    }
  }

  const sinCambios = enumerar(hecho.omitidas.map((p) => hecho.tituloDe.get(p.cursoId)))
  return {
    aviso:
      `Acceso dado a: ${enumerar(hecho.creadas.map((p) => hecho.tituloDe.get(p.cursoId)))}.` +
      (sinCambios ? ` Sin cambios en: ${sinCambios}.` : ''),
  }
}

const esquemaInscribir = z.object({
  course_id: z.uuid('Curso inválido.'),
  cohort_id: z.union([z.uuid('Grupo inválido.'), z.literal('')]),
  user_ids: z.array(z.uuid('Cuenta inválida.')).min(1, 'Elige al menos a una persona.'),
})

/**
 * Desde la página de un curso: le da acceso a una o varias personas que ya
 * tienen cuenta. Es el espejo de `darAccesoACursos`. Quien todavía no tiene
 * cuenta entra por `altaManual`, que sí manda el correo de bienvenida.
 */
export async function inscribirEnCurso(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()

  const resultado = esquemaInscribir.safeParse({
    course_id: datos.get('course_id'),
    cohort_id: datos.get('cohort_id') ?? '',
    user_ids: datos.getAll('user_ids').filter((v): v is string => typeof v === 'string'),
  })
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? 'Revisa los datos.' }
  }

  const { course_id: cursoId, cohort_id: cohorte } = resultado.data
  const hecho = await crearInscripciones(
    [...new Set(resultado.data.user_ids)].map((userId) => ({
      userId,
      cursoId,
      cohorteId: cohorte || null,
    }))
  )
  if (!hecho.ok) return { error: hecho.error }

  if (hecho.creadas.length === 0) {
    return { error: 'No había nada que agregar: ya tenían este curso, o está archivado.' }
  }

  const yaLoTenian = enumerar(hecho.omitidas.map((p) => hecho.nombreDe.get(p.userId)))
  return {
    aviso:
      `Acceso dado a: ${enumerar(hecho.creadas.map((p) => hecho.nombreDe.get(p.userId)))}.` +
      (yaLoTenian ? ` Ya lo tenían: ${yaLoTenian}.` : ''),
  }
}

const esquemaCuenta = z.object({ user_id: z.uuid('Cuenta inválida.') })

/**
 * Suspende la cuenta de una persona. Es el "eliminar" de los alumnos, y a
 * propósito NO borra nada.
 *
 * `profiles.status = 'suspended'` existe desde M1 y todo lo demás ya lo respeta:
 * `obtenerSesion` y el middleware mandan a la pantalla de cuenta suspendida, y
 * `academia.current_role()` devuelve null, así que RLS tampoco le da nada. Lo
 * único que faltaba era el botón.
 *
 * Borrar el perfil de verdad se llevaría en cascada inscripciones, progreso,
 * entregas, comentarios y certificados con folio público, y dejaría una cuenta
 * huérfana en `auth.users`. Suspender corta el acceso igual y se puede deshacer.
 *
 * Dos candados:
 *   - Nadie se suspende a sí mismo: se quedaría fuera sin poder reactivarse.
 *   - A alguien del equipo solo lo suspende un superadmin, igual que solo un
 *     superadmin lo da de alta (acciones-equipo.ts). Un admin que pudiera
 *     suspender a los demás admins se quedaría solo con el panel.
 */
export async function suspenderCuenta(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const perfil = await exigirAdmin()

  const resultado = esquemaCuenta.safeParse({ user_id: datos.get('user_id') })
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? 'Revisa los datos.' }
  }
  const userId = resultado.data.user_id

  if (userId === perfil.user_id) {
    return { error: 'No puedes suspender tu propia cuenta.' }
  }

  const supabase = await crearClienteServidor()

  const { data: objetivo } = await supabase
    .from('profiles')
    .select('role, email')
    .eq('user_id', userId)
    .maybeSingle()

  if (!objetivo) return { error: 'Esa cuenta ya no existe.' }

  const esDelEquipo = objetivo.role === 'admin' || objetivo.role === 'superadmin'
  if (esDelEquipo && perfil.role !== 'superadmin') {
    return { error: 'Solo un superadmin puede suspender a alguien del equipo.' }
  }

  // `.select()` para saber si de verdad cambió: un update que RLS filtra no da
  // error, solo devuelve cero filas.
  const { data, error } = await supabase
    .from('profiles')
    .update({ status: 'suspended' })
    .eq('user_id', userId)
    .select('user_id')

  if (error || !data || data.length === 0) {
    console.error(
      JSON.stringify({
        operacion: 'suspenderCuenta',
        userId,
        error: error?.message ?? 'el update no afectó ninguna fila',
      })
    )
    return { error: 'No se pudo suspender la cuenta.' }
  }

  console.log(JSON.stringify({ operacion: 'suspenderCuenta', userId, por: perfil.user_id }))
  revalidatePath('/admin/alumnos')
  return { aviso: `${objetivo.email} quedó suspendido.` }
}

/** Deshace la suspensión. La persona vuelve a entrar con lo que ya tenía. */
export async function reactivarCuenta(datos: FormData): Promise<void> {
  const perfil = await exigirAdmin()

  const resultado = esquemaCuenta.safeParse({ user_id: datos.get('user_id') })
  if (!resultado.success) return
  const userId = resultado.data.user_id

  const supabase = await crearClienteServidor()

  // Mismo candado que al suspender: al equipo solo lo toca un superadmin.
  const { data: objetivo } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()

  const esDelEquipo = objetivo?.role === 'admin' || objetivo?.role === 'superadmin'
  if (!objetivo || (esDelEquipo && perfil.role !== 'superadmin')) return

  const { error } = await supabase
    .from('profiles')
    .update({ status: 'active' })
    .eq('user_id', userId)

  if (error) {
    console.error(JSON.stringify({ operacion: 'reactivarCuenta', userId, error: error.message }))
  } else {
    console.log(JSON.stringify({ operacion: 'reactivarCuenta', userId, por: perfil.user_id }))
  }

  revalidatePath('/admin/alumnos')
}

/** Extiende la vigencia de una inscripción por N días desde hoy. */
export async function extenderAcceso(datos: FormData): Promise<void> {
  await exigirAdmin()

  const userId = String(datos.get('user_id') ?? '')
  const courseId = String(datos.get('course_id') ?? '')
  const dias = Number(datos.get('dias') ?? 0)
  if (!userId || !courseId || !Number.isFinite(dias) || dias <= 0) return

  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('enrollments')
    .update({
      expires_at: new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
    })
    .eq('user_id', userId)
    .eq('course_id', courseId)

  if (error) {
    console.error(JSON.stringify({ operacion: 'extenderAcceso', userId, error: error.message }))
  }

  revalidatePath('/admin/alumnos')
}
