'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { alumnosPendientesDeEntrar } from '@/lib/admin/accesos'
import { empresaPorNombre } from '@/lib/admin/empresas'
import { crearEnlacesDurables } from '@/lib/auth/enlace-durable'
import { exigirAdmin } from '@/lib/auth/sesion'
import { plantillaNuevoCurso, plantillaRecordatorio } from '@/lib/correo/plantillas'
import { enviarCorreosEnLote } from '@/lib/correo/resend'
import { darDeAlta, enviarAccesoInicial } from '@/lib/stripe/provisioning'
import { crearClienteServidor } from '@/lib/supabase/server'
import { crearClienteServiceRole } from '@/lib/supabase/service-role'

import { PAR, enLista, leerPares, revisarSeleccion } from './seleccion-de-cursos'
import type { EstadoAccion } from './tipos'

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
  // (`accesos`, pares curso|grupo, uno o varios). La página de un curso manda ese
  // curso fijo (`course_id` + `cohort_id`).
  accesos: z.array(z.string().regex(PAR, 'Selección inválida.')),
  course_id: z.union([z.uuid('Curso inválido.'), z.literal('')]),
  cohort_id: z.union([z.uuid('Grupo inválido.'), z.literal('')]),
  /** Vacío = General (sin empresa). */
  company_id: z.union([z.uuid('Empresa inválida.'), z.literal('')]),
})

export async function altaManual(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()

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

  // Una llamada a `darDeAlta` por curso. La primera crea la cuenta y manda el
  // ÚNICO correo —que por eso nombra todos los cursos—; las demás encuentran la
  // cuenta ya hecha y solo agregan su inscripción.
  let creado = false
  let invitado = false
  let avisado = false
  const listos: string[] = []

  for (const [i, curso] of seleccion.cursos.entries()) {
    const alta = await darDeAlta({
      email,
      nombre: nombre || null,
      courseId: curso.id,
      cohortId: curso.cohorteId,
      origen: 'manual',
      urlRedireccion: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/nueva-contrasena`,
      titulosParaCorreo: titulos,
      // La empresa solo en la primera llamada; vacío no toca la que ya tenga.
      companyId: i === 0 && empresa ? empresa : undefined,
      avisarNuevoCurso: i === 0,
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
      avisado = alta.avisado === true
    }
    listos.push(titulos[i] ?? 'Curso')
  }

  revalidatePath('/admin/alumnos')
  revalidatePath('/admin/cursos')
  // También se da de alta desde la página del curso, que lista a sus inscritos.
  for (const curso of seleccion.cursos) revalidatePath(`/admin/cursos/${curso.id}`)

  if (!creado) {
    return {
      aviso:
        `${email} ya tenía cuenta; se le agregó ${enLista(listos)}` +
        (avisado ? ' y se le avisó por correo.' : '. Ya tenía ese acceso, no se mandó correo.'),
    }
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
  const admin = await exigirAdmin()

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
    persona?.full_name,
    admin.user_id
  )

  console.log(JSON.stringify({ operacion: 'reenviarAcceso', email, enviado }))
  revalidatePath('/admin/alumnos')
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
  const admin = await exigirAdmin()

  const para = String(datos.get('para') ?? '').trim().toLowerCase() || admin.email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(para)) return { error: 'Ese correo no parece válido.' }

  const enlaces = await crearEnlacesDurables({ emails: [admin.email], creadoPor: admin.user_id })
  const url = enlaces.get(admin.email)
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
 * Manda el recordatorio a TODOS los alumnos que nunca han entrado, en un clic.
 *
 * La primera versión iba de diez en diez: Resend admite dos peticiones por
 * segundo y una server action en Vercel tiene segundos, así que ochenta
 * correos de uno en uno no cabían. Con el endpoint de lote de Resend ochenta
 * correos son una petición, y las ochenta ligas de 30 días un solo insert.
 *
 * Va la plantilla de recordatorio, no la bienvenida: esa ya está en su buzón.
 * La ventana de 24 h de `alumnosPendientesDeEntrar()` evita que un doble clic
 * mande dos recordatorios a la misma persona el mismo día.
 */
export async function recordarAccesoPendientes(
  _previo: EstadoAccion,
  _datos: FormData
): Promise<EstadoAccion> {
  const admin = await exigirAdmin()

  const pendientes = await alumnosPendientesDeEntrar()
  if (pendientes.length === 0) {
    return { aviso: 'Nadie está pendiente: todos ya entraron o recibieron su recordatorio hoy.' }
  }

  const enlaces = await crearEnlacesDurables({
    emails: pendientes.map((p) => p.email),
    creadoPor: admin.user_id,
  })

  const base = process.env.NEXT_PUBLIC_APP_URL
  const correos = pendientes.flatMap((p) => {
    const url = enlaces.get(p.email)
    if (!url) return []
    const plantilla = plantillaRecordatorio({ url, cursos: p.cursos, nombre: p.nombre, base })
    return [{ para: p.email, asunto: plantilla.asunto, html: plantilla.html, texto: plantilla.texto }]
  })

  const resultado = await enviarCorreosEnLote(correos)

  console.log(
    JSON.stringify({
      operacion: 'recordarAccesoPendientes',
      porQuien: admin.email,
      pendientes: pendientes.length,
      conEnlace: correos.length,
      enviados: resultado.enviados,
      omitidos: resultado.omitidos,
      fallidos: resultado.fallidos.length,
      motivo: resultado.motivo ?? null,
    })
  )
  revalidatePath('/admin/alumnos')

  const sinEnlace = pendientes.length - correos.length
  if (resultado.fallidos.length > 0) {
    const muestra = resultado.fallidos.slice(0, 5).join(', ')
    const resto = resultado.fallidos.length > 5 ? ` y ${resultado.fallidos.length - 5} más` : ''
    return {
      error:
        `Salieron ${resultado.enviados} recordatorios y fallaron ${resultado.fallidos.length}` +
        ` (${muestra}${resto}). Motivo: ${resultado.motivo ?? 'sin detalle'}.`,
    }
  }

  return {
    aviso:
      `Se mandó el recordatorio a ${resultado.enviados} persona${resultado.enviados === 1 ? '' : 's'}.` +
      (sinEnlace > 0 ? ` ${sinEnlace} sin perfil, no se les pudo generar liga.` : ''),
  }
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
      /** Cuántos correos de "tienes un curso nuevo" salieron. */
      avisados: number
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
  let avisados = 0

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

    // Se les avisa por correo (pedido 20-sep-2026). Antes no salía nada:
    // "la persona ya sabe entrar". Pero si nadie te avisa, el curso nuevo no
    // existe hasta que entres por otra razón. Un correo por persona que nombra
    // todos sus cursos nuevos, en lote: veinte personas son una petición.
    const tituloDeCurso = new Map((cursos.data ?? []).map((c) => [c.id, c.title]))
    const cursosDe = new Map<string, string[]>()
    for (const par of creadas) {
      const titulo = tituloDeCurso.get(par.cursoId)
      if (titulo) cursosDe.set(par.userId, [...(cursosDe.get(par.userId) ?? []), titulo])
    }
    const correos = [...cursosDe].flatMap(([userId, titulos]) => {
      const persona = (personas.data ?? []).find((p) => p.user_id === userId)
      if (!persona?.email) return []
      const plantilla = plantillaNuevoCurso({
        cursos: titulos,
        nombre: persona.full_name,
        base: process.env.NEXT_PUBLIC_APP_URL,
      })
      return [{ para: persona.email, asunto: plantilla.asunto, html: plantilla.html, texto: plantilla.texto }]
    })
    const envio = await enviarCorreosEnLote(correos)
    avisados = envio.enviados
  }

  revalidatePath('/admin/alumnos')
  revalidatePath('/admin/cursos')
  for (const id of cursoIds) revalidatePath(`/admin/cursos/${id}`)

  return {
    ok: true,
    creadas,
    omitidas,
    avisados,
    tituloDe: new Map((cursos.data ?? []).map((c) => [c.id, c.title])),
    nombreDe,
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
      (hecho.avisados > 0 ? ' Se le avisó por correo.' : '') +
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
      (hecho.avisados > 0
        ? ` Se avisó por correo a ${hecho.avisados}.`
        : '') +
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
export async function cambiarCorreoDeAlumno(
  _previo: EstadoAccion,
  datos: FormData
): Promise<EstadoAccion> {
  const admin = await exigirAdmin()

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

  const esDelEquipo = actual.role === 'admin' || actual.role === 'superadmin'
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

  const enviado = await enviarAccesoInicial(
    nuevo,
    undefined,
    (cursos ?? []).map((c) => c.title),
    actual.full_name,
    admin.user_id
  )

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
