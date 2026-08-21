import 'server-only'

import { plantillaBienvenida } from '@/lib/correo/plantillas'
import { enviarCorreo } from '@/lib/correo/resend'
import { crearClienteServiceRole } from '@/lib/supabase/service-role'

/**
 * Alta de alumnos.
 *
 * Es el único punto del sistema donde nacen cuentas, y lo usan los dos caminos
 * de §3.1: el webhook de Stripe (flujo B) y el alta manual del admin (flujo A).
 * Que compartan código es deliberado: si el webhook falla, el admin da de alta a
 * mano y el resultado es idéntico, que es justo el respaldo que promete §11.
 *
 * Aquí SÍ va service role. Es uno de los usos que CLAUDE.md autoriza: crear
 * usuarios y perfiles ocurre antes de que exista alguien a quien aplicarle RLS.
 */

export type ResultadoAlta = {
  ok: boolean
  userId?: string
  creado?: boolean
  invitado?: boolean
  motivo?: string
}

type Opciones = {
  email: string
  nombre?: string | null
  courseId: string
  cohortId?: string | null
  origen: 'stripe' | 'manual'
  /** URL a la que apunta el correo de invitación. */
  urlRedireccion?: string
}

function registrar(operacion: string, detalle: Record<string, unknown>) {
  console.log(JSON.stringify({ operacion, ...detalle }))
}

/**
 * Busca el usuario por correo en auth.users.
 *
 * `listUsers` no filtra por email de forma exacta en todas las versiones, así
 * que se compara a mano y sin distinguir mayúsculas: "Alejandro@" y
 * "alejandro@" son la misma persona, y crear dos cuentas por eso sería un
 * ticket de soporte garantizado el día del lanzamiento.
 */
async function buscarUsuario(email: string): Promise<{ id: string; email: string } | null> {
  const supabase = crearClienteServiceRole()
  const objetivo = email.trim().toLowerCase()

  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (error) {
    registrar('buscarUsuario:error', { email: objetivo, error: error.message })
    return null
  }

  const encontrado = data.users.find((u) => u.email?.toLowerCase() === objetivo)
  return encontrado?.email ? { id: encontrado.id, email: encontrado.email } : null
}

/**
 * Crea (si hace falta) la cuenta, el perfil y la inscripción.
 *
 * Idempotente en las tres capas:
 *   - el usuario se reutiliza si el correo ya existe
 *   - el perfil se hace upsert
 *   - el enrollment tiene unique (user_id, course_id) y se hace upsert
 *
 * Así, reintentar tras un fallo a medio camino no duplica nada.
 */
export async function darDeAlta(opciones: Opciones): Promise<ResultadoAlta> {
  const email = opciones.email.trim().toLowerCase()
  if (!email) return { ok: false, motivo: 'Correo vacío.' }

  const supabase = crearClienteServiceRole()

  // 1. El curso, para calcular la vigencia
  const { data: curso, error: errorCurso } = await supabase
    .from('courses')
    .select('id, access_days, title')
    .eq('id', opciones.courseId)
    .maybeSingle()

  if (errorCurso || !curso) {
    registrar('darDeAlta:cursoInexistente', { courseId: opciones.courseId })
    return { ok: false, motivo: 'El curso no existe.' }
  }

  // 2. El usuario de auth
  let usuario = await buscarUsuario(email)
  let creado = false
  let invitado = false

  if (!usuario) {
    // Se crea la cuenta SIN mandar correo, y el correo se intenta después.
    //
    // La primera versión usaba inviteUserByEmail, que hace las dos cosas de un
    // golpe. Se cayó en la primera prueba: con el SMTP fallando, la invitación
    // reventaba y el alumno quedaba PAGADO Y SIN CUENTA. Un problema de correo
    // no puede costar una inscripción: son dos fallos independientes y deben
    // fallar por separado.
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: opciones.nombre ?? '' },
    })

    if (error || !data.user) {
      registrar('darDeAlta:cuentaFallida', { email, error: error?.message })
      return { ok: false, motivo: 'No se pudo crear la cuenta.' }
    }

    usuario = { id: data.user.id, email }
    creado = true
  }

  // 3. El perfil: es lo que da pertenencia a la academia (Regla Cero)
  const { error: errorPerfil } = await supabase.from('profiles').upsert(
    {
      user_id: usuario.id,
      email,
      full_name: opciones.nombre?.trim() || '',
      role: 'alumno',
    },
    { onConflict: 'user_id', ignoreDuplicates: false }
  )

  if (errorPerfil) {
    registrar('darDeAlta:perfilFallido', { email, error: errorPerfil.message })
    return { ok: false, motivo: 'No se pudo crear el perfil.' }
  }

  // 4. La inscripción
  const expiraEn = curso.access_days
    ? new Date(Date.now() + curso.access_days * 24 * 60 * 60 * 1000).toISOString()
    : null

  const { error: errorInscripcion } = await supabase.from('enrollments').upsert(
    {
      user_id: usuario.id,
      course_id: curso.id,
      cohort_id: opciones.cohortId ?? null,
      source: opciones.origen,
      expires_at: expiraEn,
      status: 'active',
    },
    { onConflict: 'user_id,course_id' }
  )

  if (errorInscripcion) {
    registrar('darDeAlta:inscripcionFallida', { email, error: errorInscripcion.message })
    return { ok: false, motivo: 'No se pudo crear la inscripción.' }
  }

  // 5. El correo para definir contraseña, como paso aparte y no bloqueante.
  //    Si el SMTP está caído, el alumno ya tiene cuenta e inscripción; lo único
  //    que falta es que pueda entrar, y eso se reintenta desde el admin.
  if (creado) {
    invitado = await enviarAccesoInicial(
      email,
      opciones.urlRedireccion,
      curso.title,
      opciones.nombre
    )
    if (!invitado) {
      registrar('darDeAlta:sinCorreo', {
        email,
        aviso: 'cuenta e inscripcion creadas; falta enviarle el acceso',
      })
    }
  }

  registrar('darDeAlta:ok', {
    email,
    curso: curso.title,
    origen: opciones.origen,
    cuentaNueva: creado,
    correoEnviado: invitado,
  })

  return { ok: true, userId: usuario.id, creado, invitado }
}

/**
 * Genera el enlace de acceso apuntando a NUESTRO `/auth/confirmar`.
 *
 * `generateLink` devuelve también un `action_link` que pasa por el dominio de
 * Supabase, pero ese depende del Site URL configurado en su dashboard. Armar la
 * URL con el `hashed_token` deja el enlace enteramente bajo nuestro control y
 * aterriza directo en el route handler que ya existe desde M2.
 */
export async function generarEnlaceDeAcceso(
  email: string,
  destino = '/nueva-contrasena'
): Promise<string | null> {
  const supabase = crearClienteServiceRole()

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email: email.trim().toLowerCase(),
  })

  const token =
    (data?.properties as { hashed_token?: string } | undefined)?.hashed_token ??
    (data as { hashed_token?: string } | null)?.hashed_token

  if (error || !token) {
    registrar('generarEnlaceDeAcceso:fallo', { email, error: error?.message ?? 'sin token' })
    return null
  }

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '')
  return `${base}/auth/confirmar?token_hash=${encodeURIComponent(token)}&type=recovery&proximo=${encodeURIComponent(destino)}`
}

/**
 * Manda el correo de bienvenida con el enlace para definir contraseña.
 *
 * Va por la API de Resend, no por el SMTP de Supabase: ver lib/correo/resend.ts
 * para el porqué. Devuelve false en vez de lanzar, porque quien llama debe poder
 * seguir adelante sin el correo — un fallo de correo no puede costar una
 * inscripción.
 */
export async function enviarAccesoInicial(
  email: string,
  _urlRedireccion?: string,
  curso = 'tu curso',
  nombre?: string | null
): Promise<boolean> {
  const enlace = await generarEnlaceDeAcceso(email)
  if (!enlace) return false

  const plantilla = plantillaBienvenida(enlace, curso, nombre)
  const resultado = await enviarCorreo({
    para: email.trim().toLowerCase(),
    asunto: plantilla.asunto,
    html: plantilla.html,
    texto: plantilla.texto,
  })

  if (!resultado.ok) {
    registrar('enviarAccesoInicial:fallo', { email, motivo: resultado.motivo })
    return false
  }
  return true
}

/**
 * Revoca el acceso tras un reembolso (§7.1).
 *
 * El progreso NO se toca: §6.3 dice que nunca se borra, y si el alumno vuelve a
 * comprar debe encontrar su avance donde lo dejó.
 */
export async function revocarPorReembolso(
  email: string,
  courseId: string | null
): Promise<boolean> {
  const supabase = crearClienteServiceRole()
  const usuario = await buscarUsuario(email)
  if (!usuario) {
    registrar('revocar:usuarioNoEncontrado', { email })
    return false
  }

  let consulta = supabase
    .from('enrollments')
    .update({ status: 'revoked' })
    .eq('user_id', usuario.id)

  if (courseId) consulta = consulta.eq('course_id', courseId)

  const { error } = await consulta
  if (error) {
    registrar('revocar:error', { email, error: error.message })
    return false
  }

  registrar('revocar:ok', { email, courseId })
  return true
}
