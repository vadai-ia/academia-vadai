'use server'

import { esRolDeEquipo } from '@/lib/auth/roles'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { alumnosPorActivar, correosQueNoSalieron } from '@/lib/admin/accesos'
import { empresaPorNombre } from '@/lib/admin/empresas'
import { crearEnlacesDurables } from '@/lib/auth/enlace-durable'
import { exigirAdmin, exigirEquipo } from '@/lib/auth/sesion'
import { avisarAccesos } from '@/lib/correo/avisos-de-acceso'
import { conteoVacio, juntarCambios, type CambioDeAcceso, type ConteoDeAvisos } from '@/lib/correo/decision'
import { plantillaRecordatorio } from '@/lib/correo/plantillas'
import { enviarCorreosEnLote } from '@/lib/correo/resend'
import { esPorGeneraciones } from '@/lib/generaciones'
import { esCuentaQa } from '@/lib/qa'
import { darDeAlta } from '@/lib/stripe/provisioning'
import { crearClienteServidor } from '@/lib/supabase/server'
import { crearClienteServiceRole } from '@/lib/supabase/service-role'

import { mensajeDeAltaEnLote, mensajeDeAltaIndividual } from './mensajes-de-alta'
import { PAR, enLista, generacionDeAlta, leerPares, revisarSeleccion } from './seleccion-de-cursos'
import type { EstadoAccion } from './tipos'

import type { LlamadaRpc } from '@/lib/alumno/catalogo'

/**
 * Alta manual de alumnos (§3.1-A).
 *
 * Usa el MISMO `darDeAlta` que el webhook de Stripe. Es el respaldo que promete
 * §11: si el webhook falla en una compra real, el admin da de alta a mano y el
 * resultado es idéntico, no una versión aproximada.
 */

const esquema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Escribe el correo.')
    .email('Ese correo no parece válido.')
    .transform((v) => v.toLowerCase()),
  nombre: z.string().trim().max(160),
  // Dos formas de decir a qué cursos. /admin/alumnos manda la lista de casillas
  // (`accesos`, pares curso|generación, uno o varios). La página de un curso
  // manda ese curso fijo (`course_id` + `cohort_id`).
  accesos: z.array(z.string().regex(PAR, 'Selección inválida.')),
  course_id: z.union([z.uuid('Curso inválido.'), z.literal('')]),
  cohort_id: z.union([z.uuid('Generación inválida.'), z.literal('')]),
  /** Vacío = General (sin empresa). */
  company_id: z.union([z.uuid('Empresa inválida.'), z.literal('')]),
})

export async function altaManual(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const admin = await exigirAdmin()

  const resultado = esquema.safeParse({
    email: datos.get('email'),
    nombre: datos.get('nombre') ?? '',
    accesos: datos.getAll('accesos').filter((v): v is string => typeof v === 'string'),
    course_id: datos.get('course_id') ?? '',
    cohort_id: datos.get('cohort_id') ?? '',
    company_id: datos.get('company_id') ?? '',
  })

  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? 'Revisa los datos.' }
  }

  const {
    email,
    nombre,
    accesos,
    course_id: cursoFijo,
    cohort_id: grupoFijo,
    company_id: empresaElegida,
  } = resultado.data

  // "O escribe una nueva": se crea (o se reúsa) ahí mismo (21-sep-2026).
  const empresaNueva = String(datos.get('company_nueva') ?? '').trim()
  const empresa = empresaNueva ? ((await empresaPorNombre(empresaNueva)) ?? '') : empresaElegida

  const seleccion = await revisarSeleccion(
    accesos.length > 0 ? accesos : cursoFijo ? [`${cursoFijo}|${grupoFijo}`] : []
  )
  if (!seleccion.ok) return { error: seleccion.error }

  const titulos = seleccion.cursos.map((c) => c.titulo)

  // Una llamada a `darDeAlta` por curso, con el correo DIFERIDO (M25): se
  // junta lo que pasó en cada curso —nuevo, cambio de generación, sin cambio—
  // y sale UN correo que lo nombra todo, el que le toca según `decidirCorreo`.
  let hechos: CambioDeAcceso | null = null
  let creado = false
  const listos: string[] = []

  const avisar = () =>
    hechos ? avisarAccesos([hechos], { origen: 'alta_manual', creadoPor: admin.user_id }) : Promise.resolve(conteoVacio())

  for (const [i, curso] of seleccion.cursos.entries()) {
    const alta = await darDeAlta({
      email,
      nombre: nombre || null,
      courseId: curso.id,
      cohortId: curso.cohorteId,
      origen: 'manual',
      correo: 'diferir',
      creadoPor: admin.user_id,
      // La empresa solo en la primera llamada; vacío no toca la que ya tenga.
      companyId: i === 0 && empresa ? empresa : undefined,
    })

    if (!alta.ok) {
      // Lo que sí quedó hecho se avisa igual: la persona no puede quedarse
      // con cuenta y sin correo porque falló el segundo curso.
      const conteo = await avisar()
      revalidatePath('/admin/alumnos')
      return {
        error:
          listos.length === 0
            ? (alta.motivo ?? 'No se pudo dar de alta.')
            : `${email} quedó con ${enLista(listos)}, pero falló "${titulos[i]}": ` +
              `${alta.motivo ?? 'error desconocido'}. Vuelve a intentarlo solo con ese curso.` +
              (conteo.fallidos.length > 0 ? ' Además, su correo de acceso no salió.' : ''),
      }
    }

    if (i === 0) creado = alta.creado === true
    if (alta.hechos) hechos = hechos ? juntarCambios(hechos, alta.hechos) : alta.hechos
    listos.push(titulos[i] ?? 'Curso')
  }

  const conteo = await avisar()

  revalidatePath('/admin/alumnos')
  revalidatePath('/admin/cursos')
  // También se da de alta desde la página del curso, que lista a sus inscritos.
  for (const curso of seleccion.cursos) revalidatePath(`/admin/cursos/${curso.id}`)

  return mensajeDeAltaIndividual({
    email,
    cursos: listos,
    creado,
    yaEntro: hechos?.yaEntro ?? false,
    conteo,
  })
}

/** Reintenta el correo de acceso para alguien ya dado de alta. */
export async function reenviarAcceso(datos: FormData): Promise<void> {
  const admin = await exigirEquipo()

  const email = String(datos.get('email') ?? '').trim().toLowerCase()
  if (!email) return

  // El reenvío tiene que decir lo mismo que el correo original: su nombre y los
  // cursos a los que entra. Sin esto saldría un "Hola," genérico sin curso.
  const supabase = await crearClienteServidor()
  const { data: persona } = await supabase
    .from('profiles')
    .select('user_id, full_name, last_sign_in_at')
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

  // La bienvenida con una liga nueva de 30 días, a propósito (M25: queda en
  // la bitácora como reenvío). Sin perfil no hay a quién mandársela.
  const conteo = persona
    ? await avisarAccesos(
        [
          {
            userId: persona.user_id,
            email,
            nombre: persona.full_name,
            cuentaNueva: false,
            yaEntro: Boolean(persona.last_sign_in_at),
            cursosNuevos: [],
            generacionesNuevas: [],
            sinCambio: [],
            forzar: 'bienvenida',
            titulos: cursos,
          },
        ],
        { origen: 'reenvio', creadoPor: admin.user_id }
      )
    : null
  const enviado = conteo !== null && conteo.fallidos.length === 0

  console.log(JSON.stringify({ operacion: 'reenviarAcceso', email, enviado }))
  revalidatePath('/admin/alumnos')

  // AVISA (23-sep-2026). Antes no devolvía nada: se apretaba el botón, la liga
  // se creaba, el correo salía... y la pantalla quedaba idéntica. Alejandro
  // llegó a pedir que "habilitaran" un botón que llevaba minutos funcionando,
  // porque no había forma de saberlo. Un `redirect` con el resultado en la URL
  // es lo más simple que sí se ve, y sirve igual sin JavaScript.
  const destino = String(datos.get('volver_a') ?? '/admin/alumnos')
  const base = destino.startsWith('/admin/alumnos') ? destino : '/admin/alumnos'
  const union = base.includes('?') ? '&' : '?'
  redirect(
    `${base}${union}aviso=${enviado ? 'reenviado' : 'sinCorreo'}&correo=${encodeURIComponent(email)}`
  )
}

/**
 * Una prueba del recordatorio, a la dirección que se indique.
 *
 * Es el MISMO correo que reciben los alumnos —plantilla, asunto y liga de 30
 * días—, solo que la liga es de la cuenta de quien lo pide: así el admin lo
 * abre en su propio buzón, da clic y comprueba de punta a punta que la liga
 * entra, antes de mandarlo a ochenta personas. La dirección no necesita
 * cuenta: es solo a dónde llega.
 */
export async function enviarPruebaDeRecordatorio(
  _previo: EstadoAccion,
  datos: FormData
): Promise<EstadoAccion> {
  const admin = await exigirEquipo()

  const para = String(datos.get('para') ?? '').trim().toLowerCase() || admin.email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(para)) return { error: 'Ese correo no parece válido.' }

  const enlaces = await crearEnlacesDurables({ emails: [admin.email], creadoPor: admin.user_id })
  const url = enlaces.get(admin.email)?.url
  if (!url) return { error: 'No se pudo generar la liga de prueba.' }

  const plantilla = plantillaRecordatorio({
    url,
    cursos: ['Claude en tu empresa'],
    nombre: admin.full_name,
    base: process.env.NEXT_PUBLIC_APP_URL,
  })
  const resultado = await enviarCorreosEnLote([
    { para, asunto: `[PRUEBA] ${plantilla.asunto}`, html: plantilla.html, texto: plantilla.texto },
  ])

  console.log(
    JSON.stringify({ operacion: 'enviarPruebaDeRecordatorio', porQuien: admin.email, para, enviados: resultado.enviados, motivo: resultado.motivo ?? null })
  )

  if (resultado.enviados === 0) {
    return { error: `No salió la prueba a ${para}. Motivo: ${resultado.motivo ?? 'sin detalle'}.` }
  }
  return {
    aviso: `Prueba enviada a ${para}. La liga entra a TU cuenta (${admin.email}) y vale 30 días.`,
  }
}

/**
 * Manda el recordatorio, en un clic, a quien nunca ha entrado y tiene un curso
 * o generación ACTIVA (M25): en curso, por empezar, o V-AI-P vigente. Quien
 * solo tiene el curso base o una generación terminada ya no lo recibe
 * (decisión de Alejandro, 20-oct-2026). La regla vive en
 * `academia_por_activar`; ver `alumnosPorActivar()`.
 *
 * Va la plantilla de recordatorio, no la bienvenida: esa ya está en su buzón.
 * La ventana de 24 h evita que un doble clic mande dos recordatorios a la
 * misma persona el mismo día. Todo queda en la bitácora de correos de acceso.
 */
export async function recordarAccesoPendientes(
  _previo: EstadoAccion,
  _datos: FormData
): Promise<EstadoAccion> {
  const admin = await exigirEquipo()

  const { porEnviar, recibieronHoy } = await alumnosPorActivar({ qa: esCuentaQa(admin.email) })
  if (porEnviar.length === 0) {
    return {
      aviso:
        recibieronHoy > 0
          ? `Nadie más está pendiente: ${recibieronHoy === 1 ? 'la persona que falta ya recibió' : `las ${recibieronHoy} que faltan ya recibieron`} su recordatorio hoy.`
          : 'Nadie con un curso activo está pendiente de entrar.',
    }
  }

  const conteo = await avisarAccesos(
    porEnviar.map((p) => ({
      userId: p.userId,
      email: p.email,
      nombre: p.nombre,
      cuentaNueva: false,
      yaEntro: false,
      cursosNuevos: [],
      generacionesNuevas: [],
      sinCambio: [],
      forzar: 'recordatorio' as const,
      titulos: p.cursos,
    })),
    { origen: 'recordatorio', creadoPor: admin.user_id }
  )

  console.log(
    JSON.stringify({
      operacion: 'recordarAccesoPendientes',
      porQuien: admin.email,
      pendientes: porEnviar.length,
      enviados: conteo.porTipo.recordatorio,
      omitidos: conteo.omitidos,
      fallidos: conteo.fallidos.length,
    })
  )
  revalidatePath('/admin/alumnos')

  return mensajeDeAltaEnLote({ partes: [], conteo, errores: [] })
}

/**
 * «Reenviar» de la tarjeta «N correos de acceso no salieron» y «Reintentar»
 * de la ficha (M25). Rearma cada correo desde la bitácora —el mismo tipo,
 * para los mismos cursos o la misma generación— y lo vuelve a mandar con una
 * liga nueva. Con `user_id`, solo el de esa persona.
 *
 * Se salta a quien recibió un correo de acceso en los últimos 2 minutos: un
 * doble clic no le manda dos.
 */
export async function reenviarCorreosFallidos(
  _previo: EstadoAccion,
  datos: FormData
): Promise<EstadoAccion> {
  const admin = await exigirEquipo()
  const soloDe = String(datos.get('user_id') ?? '')

  const todos = await correosQueNoSalieron({ qa: esCuentaQa(admin.email) })
  const pendientes = soloDe ? todos.filter((c) => c.userId === soloDe) : todos
  if (pendientes.length === 0) return { aviso: 'No hay correos de acceso por reenviar: todos salieron.' }

  const supabase = await crearClienteServidor()
  const ids = pendientes.map((c) => c.userId)
  const hace2min = new Date(Date.now() - 2 * 60 * 1000).toISOString()

  const [recientes, perfiles, inscripciones] = await Promise.all([
    supabase.from('access_emails').select('user_id').in('user_id', ids).gt('created_at', hace2min),
    supabase.from('profiles').select('user_id, full_name, last_sign_in_at').in('user_id', ids),
    supabase
      .from('enrollments')
      .select('user_id, course_id, courses(title, status)')
      .in('user_id', ids)
      .eq('status', 'active'),
  ])
  const recien = new Set((recientes.data ?? []).map((r) => r.user_id))
  const perfil = new Map((perfiles.data ?? []).map((p) => [p.user_id, p]))

  type Inscripcion = { user_id: string; course_id: string; courses: { title: string; status: string } | null }
  const cursosDe = new Map<string, string[]>()
  for (const e of (inscripciones.data ?? []) as unknown as Inscripcion[]) {
    if (!e.courses || e.courses.status === 'archived') continue
    cursosDe.set(e.user_id, [...(cursosDe.get(e.user_id) ?? []), e.courses.title])
  }

  // Lo que hace falta para rearmar «nuevo curso» y «nueva generación».
  const cursoIds = [...new Set(pendientes.flatMap((c) => c.courseIds))]
  const cohorteIds = [...new Set(pendientes.map((c) => c.cohorteId).filter((v): v is string => v !== null))]
  const [cursos, cohortes] = await Promise.all([
    cursoIds.length ? supabase.from('courses').select('id, title, slug').in('id', cursoIds) : Promise.resolve({ data: [] }),
    cohorteIds.length
      ? supabase.from('cohorts').select('id, name, starts_on, ends_on, course_id').in('id', cohorteIds)
      : Promise.resolve({ data: [] }),
  ])
  const curso = new Map((cursos.data ?? []).map((c) => [c.id, c]))
  const cohorte = new Map((cohortes.data ?? []).map((g) => [g.id, g]))

  const cambios: CambioDeAcceso[] = []
  for (const c of pendientes) {
    if (recien.has(c.userId)) continue
    const p = perfil.get(c.userId)
    const base: CambioDeAcceso = {
      userId: c.userId,
      email: c.email,
      nombre: p?.full_name?.trim() || c.nombre,
      cuentaNueva: false,
      yaEntro: Boolean(p?.last_sign_in_at),
      cursosNuevos: [],
      generacionesNuevas: [],
      sinCambio: [],
    }
    const g = c.cohorteId ? cohorte.get(c.cohorteId) : undefined
    const delCurso = g ? curso.get(g.course_id) : undefined
    if (c.tipo === 'nueva_generacion' && g && delCurso) {
      cambios.push({
        ...base,
        generacionesNuevas: [
          {
            cursoId: delCurso.id,
            cursoTitulo: delCurso.title,
            cursoSlug: delCurso.slug,
            cohorteId: g.id,
            nombre: g.name,
            startsOn: g.starts_on,
            endsOn: g.ends_on,
            anterior: null,
          },
        ],
      })
    } else if (c.tipo === 'nuevo_curso' && c.courseIds.some((id) => curso.has(id))) {
      cambios.push({
        ...base,
        cursosNuevos: c.courseIds.flatMap((id) => {
          const x = curso.get(id)
          return x ? [{ id: x.id, titulo: x.title }] : []
        }),
      })
    } else {
      cambios.push({
        ...base,
        forzar: c.tipo === 'recordatorio' ? 'recordatorio' : 'bienvenida',
        titulos: cursosDe.get(c.userId) ?? [],
      })
    }
  }

  if (cambios.length === 0) {
    return { aviso: 'Ya se reenviaron hace un momento. Si en unos minutos siguen aquí, revisa las direcciones.' }
  }

  const conteo = await avisarAccesos(cambios, { origen: 'reenvio_fallidos', creadoPor: admin.user_id })
  console.log(
    JSON.stringify({
      operacion: 'reenviarCorreosFallidos',
      porQuien: admin.email,
      personas: cambios.length,
      fallidos: conteo.fallidos.length,
    })
  )
  revalidatePath('/admin/alumnos', 'layout')
  return mensajeDeAltaEnLote({ partes: [], conteo, errores: [] })
}

/**
 * Revoca o restaura el acceso de un alumno a un curso.
 * El progreso nunca se toca (§6.3).
 */
export async function cambiarAcceso(datos: FormData): Promise<void> {
  await exigirEquipo()

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
      /** Ya tenían el curso en otra generación y se cambiaron a la elegida (M25). */
      movidas: Par[]
      omitidas: Par[]
      /** Qué correo le llegó a quién, y a quién no le salió. */
      conteo: ConteoDeAvisos
      /** Movimientos que la base rechazó; lo demás sí quedó hecho. */
      errores: string[]
      tituloDe: Map<string, string>
      nombreDe: Map<string, string>
      nombreDeGeneracion: Map<string, string>
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
 * Cada par cae en uno de tres casos (M25, 20-oct-2026):
 *   - **crear**: no tenía el curso.
 *   - **mover**: lo tenía en OTRA generación —la Gen 1— y se eligió otra —la
 *     Gen 2—. Decisión de Alejandro: se mueve la misma inscripción, conserva su
 *     avance, se reactiva si estaba vencida o revocada y se le avisa con las
 *     fechas. La vigencia nunca se acorta.
 *   - **sin cambio**: lo tenía en esa misma generación (o el curso está
 *     archivado). Si estaba vencida o revocada, para eso están «Restaurar
 *     acceso» y «Extender días».
 *
 * El correo lo decide `avisarAccesos`: bienvenida con liga a quien nunca entró,
 * «curso nuevo» a quien ya entró, «Ya estás en la Generación N» a quien se
 * movió. Uno por persona, que nombra todo lo suyo.
 */
async function crearInscripciones(
  pares: Par[],
  opciones: { origen: 'curso' | 'ficha'; creadoPor: string }
): Promise<ResultadoInscripciones> {
  const userIds = [...new Set(pares.map((p) => p.userId))]
  const cursoIds = [...new Set(pares.map((p) => p.cursoId))]
  const cohorteIds = [
    ...new Set(pares.map((p) => p.cohorteId).filter((v): v is string => v !== null)),
  ]

  const supabase = await crearClienteServidor()

  const [personas, cursos, cohortes, previas] = await Promise.all([
    supabase.from('profiles').select('user_id, full_name, email, last_sign_in_at').in('user_id', userIds),
    supabase
      .from('courses')
      .select('id, title, slug, access_days, status, course_type, cohorts(id, name, starts_on, open_for_enrollment, ends_on)')
      .in('id', cursoIds),
    cohorteIds.length > 0
      ? supabase.from('cohorts').select('id, course_id').in('id', cohorteIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('enrollments')
      .select('user_id, course_id, cohort_id, status, expires_at')
      .in('user_id', userIds)
      .in('course_id', cursoIds),
  ])

  const fallo = personas.error ?? cursos.error ?? cohortes.error ?? previas.error
  if (fallo) {
    console.error(JSON.stringify({ operacion: 'crearInscripciones:lectura', error: fallo.message }))
    return { ok: false, error: 'No se pudo revisar la selección. Intenta de nuevo.' }
  }

  const perfilDe = new Map((personas.data ?? []).map((p) => [p.user_id, p]))
  const nombreDe = new Map(
    (personas.data ?? []).map((p) => [p.user_id, p.full_name.trim() || p.email])
  )
  if (userIds.some((id) => !nombreDe.has(id))) {
    return { ok: false, error: 'Una de las cuentas ya no existe.' }
  }

  type CursoConGeneraciones = {
    id: string
    title: string
    slug: string
    access_days: number | null
    status: string
    course_type: string
    cohorts: Array<{
      id: string
      name: string
      starts_on: string | null
      open_for_enrollment: boolean
      ends_on: string | null
    }>
  }
  const listaCursos = (cursos.data ?? []) as unknown as CursoConGeneraciones[]
  const cursoPorId = new Map(listaCursos.map((c) => [c.id, c]))
  if (cursoIds.some((id) => !cursoPorId.has(id))) {
    return { ok: false, error: 'Uno de los cursos ya no existe.' }
  }

  // La generación tiene que ser de ESE curso: el valor viaja en el formulario y
  // cualquiera puede editarlo. Sin generación en un curso por generaciones, cae
  // en la abierta; sin abierta, hay que elegir (M16).
  const cursoDeCohorte = new Map((cohortes.data ?? []).map((c) => [c.id, c.course_id]))
  for (const par of pares) {
    if (par.cohorteId !== null && cursoDeCohorte.get(par.cohorteId) !== par.cursoId) {
      return { ok: false, error: 'Una de las generaciones no es de su curso.' }
    }
    const curso = cursoPorId.get(par.cursoId)
    if (!curso) continue
    const generacion = generacionDeAlta(curso, par.cohorteId)
    if ('error' in generacion) return { ok: false, error: generacion.error }
    par.cohorteId = generacion.id
  }

  const previaDe = new Map((previas.data ?? []).map((e) => [`${e.user_id}::${e.course_id}`, e]))
  const creadas: Par[] = []
  const movidas: Par[] = []
  const omitidas: Par[] = []

  for (const par of pares) {
    const curso = cursoPorId.get(par.cursoId)
    const previa = previaDe.get(`${par.userId}::${par.cursoId}`)
    if (curso?.status === 'archived') omitidas.push(par)
    else if (!previa) creadas.push(par)
    else if (esPorGeneraciones(curso?.course_type) && par.cohorteId !== null && par.cohorteId !== previa.cohort_id) {
      movidas.push(par)
    } else omitidas.push(par)
  }

  const vigenciaNueva = (dias: number | null | undefined) =>
    dias != null ? new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString() : null

  if (creadas.length > 0) {
    const { error } = await supabase.from('enrollments').insert(
      creadas.map((par) => ({
        user_id: par.userId,
        course_id: par.cursoId,
        cohort_id: par.cohorteId,
        source: 'manual' as const,
        status: 'active' as const,
        // Misma regla que `darDeAlta`: la vigencia sale de los días del curso.
        expires_at: vigenciaNueva(cursoPorId.get(par.cursoId)?.access_days),
      }))
    )

    if (error) {
      console.error(
        JSON.stringify({ operacion: 'crearInscripciones', userIds, cursoIds, error: error.message })
      )
      return { ok: false, error: 'No se pudo dar el acceso.' }
    }
    console.log(JSON.stringify({ operacion: 'crearInscripciones:ok', creadas }))
  }

  // Los movimientos van uno por uno por `academia_mover_de_generacion`, la
  // misma validación que «Cambiar de generación». Un fallo no deshace los
  // anteriores: se reporta y se sigue con el correo de lo que sí se hizo.
  const rpc = (supabase.rpc as unknown as LlamadaRpc).bind(supabase)
  const errores: string[] = []
  const movidasHechas: Par[] = []
  for (const par of movidas) {
    const { error } = await rpc('academia_mover_de_generacion', {
      alumno: par.userId,
      curso: par.cursoId,
      generacion: par.cohorteId,
    })
    if (error) {
      console.error(JSON.stringify({ operacion: 'crearInscripciones:mover', ...par, error: error.message }))
      errores.push(`No se pudo cambiar de generación a ${nombreDe.get(par.userId) ?? 'alguien'}.`)
      continue
    }
    // Se reactiva y la vigencia nunca se acorta: sin días en el curso, sin
    // vencimiento; con días, lo que sea más tarde entre la que tenía y la nueva.
    const previa = previaDe.get(`${par.userId}::${par.cursoId}`)
    const nueva = vigenciaNueva(cursoPorId.get(par.cursoId)?.access_days)
    const expira =
      previa?.expires_at == null || nueva === null
        ? null
        : Date.parse(previa.expires_at) > Date.parse(nueva)
          ? previa.expires_at
          : nueva
    if (previa?.status !== 'active' || expira !== previa.expires_at) {
      const { error: errorVigencia } = await supabase
        .from('enrollments')
        .update({ status: 'active', expires_at: expira })
        .eq('user_id', par.userId)
        .eq('course_id', par.cursoId)
      if (errorVigencia) {
        console.error(JSON.stringify({ operacion: 'crearInscripciones:vigencia', ...par, error: errorVigencia.message }))
      }
    }
    movidasHechas.push(par)
  }

  // El correo: uno por persona con todo lo suyo.
  const generacionPorId = new Map(
    listaCursos.flatMap((c) => (c.cohorts ?? []).map((g) => [g.id, { ...g, curso: c }] as const))
  )
  const cambios = new Map<string, CambioDeAcceso>()
  const cambioDe = (userId: string): CambioDeAcceso => {
    const existente = cambios.get(userId)
    if (existente) return existente
    const p = perfilDe.get(userId)
    const nuevo: CambioDeAcceso = {
      userId,
      email: p?.email ?? '',
      nombre: p?.full_name?.trim() || null,
      cuentaNueva: false,
      yaEntro: Boolean(p?.last_sign_in_at),
      cursosNuevos: [],
      generacionesNuevas: [],
      sinCambio: [],
    }
    cambios.set(userId, nuevo)
    return nuevo
  }
  for (const par of creadas) {
    const curso = cursoPorId.get(par.cursoId)
    if (curso) cambioDe(par.userId).cursosNuevos.push({ id: curso.id, titulo: curso.title })
  }
  for (const par of movidasHechas) {
    const g = par.cohorteId ? generacionPorId.get(par.cohorteId) : undefined
    const previa = previaDe.get(`${par.userId}::${par.cursoId}`)
    if (!g) continue
    cambioDe(par.userId).generacionesNuevas.push({
      cursoId: g.curso.id,
      cursoTitulo: g.curso.title,
      cursoSlug: g.curso.slug,
      cohorteId: g.id,
      nombre: g.name,
      startsOn: g.starts_on,
      endsOn: g.ends_on,
      anterior: previa?.cohort_id ? (generacionPorId.get(previa.cohort_id)?.name ?? null) : null,
    })
  }
  for (const par of omitidas) {
    const curso = cursoPorId.get(par.cursoId)
    if (curso) cambioDe(par.userId).sinCambio.push({ id: curso.id, titulo: curso.title })
  }

  const conteo = await avisarAccesos([...cambios.values()], {
    origen: opciones.origen,
    creadoPor: opciones.creadoPor,
  })

  revalidatePath('/admin/alumnos')
  revalidatePath('/admin/cursos')
  for (const id of cursoIds) revalidatePath(`/admin/cursos/${id}`)

  return {
    ok: true,
    creadas,
    movidas: movidasHechas,
    omitidas,
    conteo,
    errores,
    tituloDe: new Map(listaCursos.map((c) => [c.id, c.title])),
    nombreDe,
    nombreDeGeneracion: new Map([...generacionPorId].map(([id, g]) => [id, g.name])),
  }
}

/**
 * Quita a una persona de un curso: borra la inscripción.
 *
 * Es distinto de revocar. Revocar deja la fila con `status = 'revoked'`, que
 * es lo que se quiere tras un reembolso: consta que compró y que se le quitó.
 * Quitar es para el que se agregó por error o cambió de grupo: la fila
 * desaparece del curso. El progreso NO se toca (§6.3): si vuelve a entrar al
 * curso, encuentra su avance donde lo dejó.
 */
export async function quitarDelCurso(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()

  const userId = String(datos.get('user_id') ?? '')
  const courseId = String(datos.get('course_id') ?? '')
  if (!userId || !courseId) return { error: 'Faltan datos.' }

  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('enrollments')
    .delete()
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .select('user_id')

  if (error || !data || data.length === 0) {
    console.error(
      JSON.stringify({ operacion: 'quitarDelCurso', userId, courseId, error: error?.message ?? 'sin filas' })
    )
    return { error: 'No se pudo quitar del curso.' }
  }

  revalidatePath('/admin/alumnos')
  revalidatePath(`/admin/cursos/${courseId}`)
  return { aviso: 'Quedó fuera del curso. Su avance se conserva por si vuelve.' }
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
  const admin = await exigirAdmin()

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
    })),
    { origen: 'ficha', creadoPor: admin.user_id }
  )
  if (!hecho.ok) return { error: hecho.error }

  if (hecho.creadas.length === 0 && hecho.movidas.length === 0 && hecho.errores.length === 0) {
    return {
      error:
        'No había nada que agregar: ya tiene esos cursos en esa generación, o están archivados. ' +
        'Para uno que ya tiene, usa "Restaurar acceso" o "Extender días".',
    }
  }

  return mensajeDeAltaEnLote({
    partes: [
      hecho.creadas.length > 0
        ? `Acceso dado a: ${enumerar(hecho.creadas.map((p) => hecho.tituloDe.get(p.cursoId)))}`
        : '',
      hecho.movidas.length > 0
        ? `Cambio de generación en: ${enumerar(hecho.movidas.map((p) => hecho.tituloDe.get(p.cursoId)))}`
        : '',
      hecho.omitidas.length > 0
        ? `Sin cambios en: ${enumerar(hecho.omitidas.map((p) => hecho.tituloDe.get(p.cursoId)))}`
        : '',
    ],
    conteo: hecho.conteo,
    errores: hecho.errores,
  })
}

const esquemaInscribir = z.object({
  course_id: z.uuid('Curso inválido.'),
  cohort_id: z.union([z.uuid('Generación inválida.'), z.literal('')]),
  user_ids: z.array(z.uuid('Cuenta inválida.')).min(1, 'Elige al menos a una persona.'),
})

/**
 * Desde la página de un curso: le da acceso a una o varias personas que ya
 * tienen cuenta. Es el espejo de `darAccesoACursos`. Quien todavía no tiene
 * cuenta entra por `altaManual`. Quien ya está en otra generación de este
 * curso se cambia a la de esta pestaña (M25) y se le avisa con las fechas.
 */
export async function inscribirEnCurso(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const admin = await exigirAdmin()

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
    })),
    { origen: 'curso', creadoPor: admin.user_id }
  )
  if (!hecho.ok) return { error: hecho.error }

  if (hecho.creadas.length === 0 && hecho.movidas.length === 0 && hecho.errores.length === 0) {
    return { error: 'No había nada que agregar: ya estaban en esta generación, o el curso está archivado.' }
  }

  const generacion = hecho.movidas[0]?.cohorteId ? hecho.nombreDeGeneracion.get(hecho.movidas[0].cohorteId) : null
  return mensajeDeAltaEnLote({
    partes: [
      hecho.creadas.length > 0
        ? `Acceso dado a: ${enumerar(hecho.creadas.map((p) => hecho.nombreDe.get(p.userId)))}`
        : '',
      hecho.movidas.length > 0
        ? `Cambiados a ${generacion ?? 'esta generación'}: ${enumerar(hecho.movidas.map((p) => hecho.nombreDe.get(p.userId)))}`
        : '',
      hecho.omitidas.length > 0
        ? `Ya estaban aquí: ${enumerar(hecho.omitidas.map((p) => hecho.nombreDe.get(p.userId)))}`
        : '',
    ],
    conteo: hecho.conteo,
    errores: hecho.errores,
  })
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
  const perfil = await exigirEquipo()

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

  const esDelEquipo = esRolDeEquipo(objetivo.role)
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

/**
 * Cambia el correo de una cuenta (pedido 21-sep-2026, día del lanzamiento:
 * "el ingeniero Javier dice que su correo se deshabilitó").
 *
 * Es la identidad de la cuenta, así que:
 *   - Pide confirmación (ConfirmarConModal) y solo un superadmin la cambia a
 *     alguien del equipo.
 *   - Se cambia en Auth (service role; es el único que puede) y en el perfil,
 *     en ese orden: si Auth falla, nada cambió.
 *   - Al correo NUEVO le llega el de crear contraseña con liga de 30 días.
 *     Es la prueba de que el cambio fue para la persona correcta: solo quien
 *     tiene ese buzón puede entrar. Al viejo no se le escribe: casi siempre
 *     se cambia porque el viejo ya no existe, y escribirle rebota.
 *   - Inscripciones, progreso, puntos y certificados no se tocan: cuelgan del
 *     id, no del correo.
 */
/**
 * «Corregir nombre» en la ficha (16-oct-2026). Desde que un alta ya no pisa el
 * nombre de quien tiene cuenta, esta es la forma en que el equipo lo cambia a
 * propósito. Es el nombre que se imprime en los certificados. Como el correo:
 * el de alguien del equipo solo lo cambia un superadmin.
 */
export async function corregirNombreDeAlumno(
  _previo: EstadoAccion,
  datos: FormData
): Promise<EstadoAccion> {
  const quien = await exigirEquipo()

  const userId = String(datos.get('user_id') ?? '')
  const nuevo = String(datos.get('nuevo_nombre') ?? '').trim().replace(/\s+/g, ' ')
  if (!userId) return { error: 'Falta la cuenta.' }
  if (nuevo.length < 2) return { error: 'Escribe el nombre completo.' }
  if (nuevo.length > 120) return { error: 'Hasta 120 caracteres.' }

  const servicio = crearClienteServiceRole()
  const { data: actual } = await servicio
    .from('profiles')
    .select('full_name, role')
    .eq('user_id', userId)
    .maybeSingle()
  if (!actual) return { error: 'Esa cuenta no existe.' }
  if (actual.full_name === nuevo) return { error: 'Ya se llama así.' }
  if (esRolDeEquipo(actual.role) && quien.role !== 'superadmin') {
    return { error: 'Solo un superadmin cambia el nombre de alguien del equipo.' }
  }

  const { error } = await servicio.from('profiles').update({ full_name: nuevo }).eq('user_id', userId)
  if (error) {
    console.error(JSON.stringify({ operacion: 'corregirNombre', userId, error: error.message }))
    return { error: 'No se pudo guardar el nombre.' }
  }
  console.log(JSON.stringify({ operacion: 'corregirNombre:ok', porQuien: quien.email, userId, de: actual.full_name, a: nuevo }))
  revalidatePath('/admin/alumnos')
  revalidatePath(`/admin/alumnos/${userId}`)
  return { aviso: `Listo: ahora se llama ${nuevo}. Así sale en sus certificados nuevos.` }
}

export async function cambiarCorreoDeAlumno(
  _previo: EstadoAccion,
  datos: FormData
): Promise<EstadoAccion> {
  const admin = await exigirEquipo()

  const userId = String(datos.get('user_id') ?? '')
  const nuevo = String(datos.get('nuevo_email') ?? '').trim().toLowerCase()
  if (!userId) return { error: 'Falta la cuenta.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(nuevo)) return { error: 'Ese correo no parece válido.' }

  const servicio = crearClienteServiceRole()
  const { data: actual } = await servicio
    .from('profiles')
    .select('email, full_name, role')
    .eq('user_id', userId)
    .maybeSingle()
  if (!actual) return { error: 'Esa cuenta no existe.' }
  if (actual.email === nuevo) return { error: 'Es el mismo correo que ya tiene.' }

  const esDelEquipo = esRolDeEquipo(actual.role)
  if (esDelEquipo && admin.role !== 'superadmin') {
    return { error: 'Solo un superadmin cambia el correo de alguien del equipo.' }
  }

  const { data: ocupado } = await servicio.from('profiles').select('user_id').eq('email', nuevo).maybeSingle()
  if (ocupado) return { error: `${nuevo} ya es de otra cuenta. Si es la misma persona, dale acceso a esa cuenta.` }

  const { error: errorAuth } = await servicio.auth.admin.updateUserById(userId, {
    email: nuevo,
    email_confirm: true,
  })
  if (errorAuth) {
    console.error(JSON.stringify({ operacion: 'cambiarCorreo:auth', userId, nuevo, error: errorAuth.message }))
    return { error: `No se pudo cambiar el correo: ${errorAuth.message}` }
  }

  const { error: errorPerfil } = await servicio.from('profiles').update({ email: nuevo }).eq('user_id', userId)
  if (errorPerfil) {
    // Auth ya cambió y el perfil no: se dice tal cual, con el remedio.
    console.error(JSON.stringify({ operacion: 'cambiarCorreo:perfil', userId, nuevo, error: errorPerfil.message }))
    return { error: `Auth ya tiene ${nuevo} pero el perfil no se pudo actualizar. Vuelve a intentar.` }
  }

  // Los cursos que nombra el correo: los que tiene activos.
  const { data: inscripciones } = await servicio
    .from('enrollments')
    .select('course_id')
    .eq('user_id', userId)
    .eq('status', 'active')
  const ids = (inscripciones ?? []).map((e) => e.course_id)
  const { data: cursos } = ids.length
    ? await servicio.from('courses').select('title').in('id', ids).neq('status', 'archived').order('title')
    : { data: [] }

  const conteo = await avisarAccesos(
    [
      {
        userId,
        email: nuevo,
        nombre: actual.full_name,
        cuentaNueva: false,
        yaEntro: false,
        cursosNuevos: [],
        generacionesNuevas: [],
        sinCambio: [],
        forzar: 'bienvenida',
        titulos: (cursos ?? []).map((c) => c.title),
      },
    ],
    { origen: 'cambio_correo', creadoPor: admin.user_id }
  )
  const enviado = conteo.fallidos.length === 0

  console.log(
    JSON.stringify({ operacion: 'cambiarCorreo:ok', porQuien: admin.email, userId, de: actual.email, a: nuevo, correoEnviado: enviado })
  )
  revalidatePath('/admin/alumnos')
  revalidatePath('/admin/cursos')

  return {
    aviso:
      `Correo cambiado de ${actual.email} a ${nuevo}.` +
      (enviado
        ? ' Le llegó el correo para crear su contraseña, con liga de 30 días.'
        : ' El correo de contraseña NO salió: usa "Reenviar correo de acceso".'),
  }
}

/** Deshace la suspensión. La persona vuelve a entrar con lo que ya tenía. */
export async function reactivarCuenta(datos: FormData): Promise<void> {
  const perfil = await exigirEquipo()

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

  const esDelEquipo = esRolDeEquipo(objetivo?.role)
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
  await exigirEquipo()

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

// ==========================================================================
// Cambiar de generación (M16)
// ==========================================================================

const esquemaCambio = z.object({
  course_id: z.uuid('Curso inválido.'),
  cohort_id: z.uuid('Elige la generación.'),
  user_ids: z.array(z.uuid('Cuenta inválida.')).min(1, 'Elige al menos a una persona.'),
})

/**
 * Pasa a una o varias personas a otra generación del mismo curso, o les asigna
 * una si estaban «sin generación». Lo hace `academia_mover_de_generacion`, que
 * valida que el curso sea por generaciones y que la generación sea del curso.
 *
 * Ven la nueva, dejan de ver la anterior; su progreso y sus puntos no se
 * tocan (decisión 4, 3-oct-2026).
 */
export async function cambiarDeGeneracion(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const quien = await exigirEquipo()

  const resultado = esquemaCambio.safeParse({
    course_id: datos.get('course_id'),
    cohort_id: datos.get('cohort_id'),
    user_ids: datos.getAll('user_ids').filter((v): v is string => typeof v === 'string'),
  })
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? 'Revisa los datos.' }
  }
  const { course_id: cursoId, cohort_id: generacion } = resultado.data

  const supabase = await crearClienteServidor()
  const rpc = (supabase.rpc as unknown as LlamadaRpc).bind(supabase)
  let movidos = 0
  for (const userId of new Set(resultado.data.user_ids)) {
    const { error } = await rpc('academia_mover_de_generacion', {
      alumno: userId,
      curso: cursoId,
      generacion,
    })
    if (error) {
      console.error(JSON.stringify({ operacion: 'cambiarDeGeneracion', userId, cursoId, generacion, error: error.message }))
      return {
        error:
          (movidos > 0 ? `Se cambió a ${movidos}, pero falló uno: ` : '') +
          (error.code === '22023' ? error.message : 'No se pudo cambiar de generación.'),
      }
    }
    movidos += 1
  }

  revalidatePath(`/admin/cursos/${cursoId}`)
  revalidatePath('/admin/alumnos')

  const hecho =
    movidos === 1
      ? 'Cambio hecho: ve la nueva generación y deja de ver la anterior.'
      : `${movidos} personas cambiadas de generación.`

  // «Avisarles por correo» (M25), marcada por defecto: «Ya estás en la
  // Generación N» con las fechas, y la liga a quien nunca ha entrado.
  if (datos.get('avisar') !== 'si') return { aviso: `${hecho} No se mandó correo.` }

  const ids = [...new Set(resultado.data.user_ids)]
  const [curso, cohorte, perfiles] = await Promise.all([
    supabase.from('courses').select('id, title, slug').eq('id', cursoId).maybeSingle(),
    supabase.from('cohorts').select('id, name, starts_on, ends_on').eq('id', generacion).maybeSingle(),
    supabase.from('profiles').select('user_id, email, full_name, last_sign_in_at').in('user_id', ids),
  ])
  if (!curso.data || !cohorte.data) return { aviso: `${hecho} No se pudo armar el correo de aviso.` }

  const conteo = await avisarAccesos(
    (perfiles.data ?? []).map((p) => ({
      userId: p.user_id,
      email: p.email,
      nombre: p.full_name?.trim() || null,
      cuentaNueva: false,
      yaEntro: Boolean(p.last_sign_in_at),
      cursosNuevos: [],
      generacionesNuevas: [
        {
          cursoId,
          cursoTitulo: curso.data!.title,
          cursoSlug: curso.data!.slug,
          cohorteId: generacion,
          nombre: cohorte.data!.name,
          startsOn: cohorte.data!.starts_on,
          endsOn: cohorte.data!.ends_on,
          anterior: null,
        },
      ],
      sinCambio: [],
    })),
    { origen: 'cambio_generacion', creadoPor: quien.user_id }
  )
  return mensajeDeAltaEnLote({ partes: [hecho.replace(/\.$/, '')], conteo, errores: [] })
}
