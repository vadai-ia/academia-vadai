import 'server-only'

import { crearEnlaceDurable } from '@/lib/auth/enlace-durable'
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

/**
 * `invitado` nace en una encuesta en vivo: tiene cuenta para volver a la
 * siguiente, pero no compró nada y no ve cursos.
 */
export type RolDeAlta = 'alumno' | 'admin' | 'superadmin' | 'invitado'

type Opciones = {
  email: string
  nombre?: string | null
  /**
   * Sin curso no se crea inscripción. Es el caso de alguien del equipo: un
   * admin no necesita estar inscrito para entrar al panel.
   */
  courseId?: string | null
  cohortId?: string | null
  origen: 'stripe' | 'manual'
  /**
   * Solo se manda cuando la intención es FIJAR el rol —el alta de equipo—.
   * Omitirlo conserva el rol que la persona ya tenga, que es lo que quieren el
   * webhook y el alta de alumno. Ver el comentario del upsert de perfil.
   */
  rol?: RolDeAlta
  /** URL a la que apunta el correo de invitación. */
  urlRedireccion?: string
  /**
   * Los cursos que nombra el correo de bienvenida. Solo lo usa el alta manual
   * con varios cursos: la cuenta se crea en la primera llamada —que es la única
   * que manda correo— y ese correo debe nombrarlos todos, no solo el primero.
   * Sin esto se usa el título del curso de esta llamada, como siempre.
   */
  titulosParaCorreo?: string[]
}

function registrar(operacion: string, detalle: Record<string, unknown>) {
  console.log(JSON.stringify({ operacion, ...detalle }))
}

/** Tope de páginas del barrido de auth.users. 50 × 200 = 10 000 cuentas. */
const PAGINAS_MAXIMAS = 50
const POR_PAGINA = 200

/**
 * Busca el usuario por correo en auth.users.
 *
 * `listUsers` no filtra por email de forma exacta en todas las versiones, así
 * que se compara a mano y sin distinguir mayúsculas: "Alejandro@" y
 * "alejandro@" son la misma persona, y crear dos cuentas por eso sería un
 * ticket de soporte garantizado el día del lanzamiento.
 *
 * CORREGIDO 2-sep-2026. Esto pedía UNA página de 200 y se rendía. Mientras la
 * academia tuvo menos de 200 cuentas funcionó por casualidad; con las encuestas
 * en vivo entran decenas de participantes por evento, y en cuanto se pasara de
 * 200 un correo que SÍ existe habría dejado de encontrarse. El síntoma no sería
 * un error: sería `createUser` fallando por correo duplicado, o peor, una
 * segunda cuenta para la misma persona.
 *
 * Dos caminos, y el primero resuelve casi siempre:
 *
 *   1. `academia.profiles` tiene el correo con `unique`. Quien ya pertenece a la
 *      academia se encuentra en un solo viaje, sin importar cuántas cuentas
 *      haya. Los correos se guardan siempre en minúsculas (ver el upsert de
 *      abajo), así que la igualdad exacta basta y usa el índice.
 *
 *   2. Si no está ahí, puede existir en `auth.users` sin perfil —alguien que
 *      entró con Google y fue rechazado, por ejemplo—. Ese caso sí obliga a
 *      barrer, pero es el raro y ahora sí recorre todas las páginas.
 */
async function buscarUsuario(email: string): Promise<{ id: string; email: string } | null> {
  const supabase = crearClienteServiceRole()
  const objetivo = email.trim().toLowerCase()

  const { data: perfil } = await supabase
    .from('profiles')
    .select('user_id, email')
    .eq('email', objetivo)
    .maybeSingle()

  if (perfil) return { id: perfil.user_id, email: perfil.email }

  for (let pagina = 1; pagina <= PAGINAS_MAXIMAS; pagina += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page: pagina,
      perPage: POR_PAGINA,
    })

    if (error) {
      registrar('buscarUsuario:error', { email: objetivo, pagina, error: error.message })
      return null
    }

    const encontrado = data.users.find((u) => u.email?.toLowerCase() === objetivo)
    if (encontrado?.email) return { id: encontrado.id, email: encontrado.email }

    // Página incompleta: era la última y no estaba.
    if (data.users.length < POR_PAGINA) return null
  }

  // Se agotó el tope sin encontrarlo. Devolver null haría que se intentara crear
  // la cuenta y el correo duplicado fallaría con un mensaje incomprensible; es
  // mejor decir aquí que el barrido se quedó corto.
  registrar('buscarUsuario:barridoIncompleto', {
    email: objetivo,
    aviso: `se revisaron ${PAGINAS_MAXIMAS * POR_PAGINA} cuentas sin encontrarlo`,
  })
  return null
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

  // 1. El curso, para calcular la vigencia. Puede no haber: un alta de equipo
  //    crea la cuenta y el rol, sin inscribir a nadie en nada.
  let curso: { id: string; access_days: number | null; title: string } | null = null

  if (opciones.courseId) {
    const { data, error: errorCurso } = await supabase
      .from('courses')
      .select('id, access_days, title')
      .eq('id', opciones.courseId)
      .maybeSingle()

    if (errorCurso || !data) {
      registrar('darDeAlta:cursoInexistente', { courseId: opciones.courseId })
      return { ok: false, motivo: 'El curso no existe.' }
    }
    curso = data
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
  //
  // Antes esto ponía `role: 'alumno'` y `full_name: nombre || ''` siempre, y
  // eso PISABA lo que ya había. Consecuencia concreta: si un superadmin compraba
  // un curso por Stripe, el webhook lo DEGRADABA a alumno y lo dejaba fuera de
  // su propio panel. Con el nombre pasaba lo mismo — un alta sin nombre borraba
  // el que ya estaba, y ese nombre es el que se imprime en el certificado.
  //
  // Ahora un alta nunca rebaja a nadie: el rol solo cambia si el llamador lo
  // pide explícitamente, que es únicamente el alta de equipo.
  const { data: previo } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('user_id', usuario.id)
    .maybeSingle()

  // Un `invitado` que ahora SÍ entra a un curso deja de ser un lead.
  //
  // Sin esto, quien conoció VADAI contestando una encuesta en un evento y
  // después compra se queda con rol `invitado`: tendría su inscripción, pero
  // `rutaDeInicio()` seguiría mandándolo a /mis-encuestas en vez de a su curso.
  // El ascenso es de una sola dirección y solo cuando hay curso de por medio:
  // jamás toca a un admin ni degrada a nadie.
  const rolPrevio = previo?.role ?? 'alumno'
  const asciendeDeInvitado = curso !== null && rolPrevio === 'invitado'

  const { error: errorPerfil } = await supabase.from('profiles').upsert(
    {
      user_id: usuario.id,
      email,
      full_name: opciones.nombre?.trim() || previo?.full_name || '',
      role: opciones.rol ?? (asciendeDeInvitado ? 'alumno' : rolPrevio),
    },
    { onConflict: 'user_id', ignoreDuplicates: false }
  )

  if (errorPerfil) {
    registrar('darDeAlta:perfilFallido', { email, error: errorPerfil.message })
    return { ok: false, motivo: 'No se pudo crear el perfil.' }
  }

  // 4. La inscripción, solo si el alta trae curso. Alguien del equipo entra por
  //    su rol, no por estar inscrito en nada.
  const expiraEn =
    curso?.access_days != null
      ? new Date(Date.now() + curso.access_days * 24 * 60 * 60 * 1000).toISOString()
      : null

  const { error: errorInscripcion } = curso
    ? await supabase.from('enrollments').upsert(
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
    : { error: null }

  if (errorInscripcion) {
    registrar('darDeAlta:inscripcionFallida', { email, error: errorInscripcion.message })
    return { ok: false, motivo: 'No se pudo crear la inscripción.' }
  }

  // 4b. Los cursos base (decidido 20-sep-2026). "Academia VADAI" es donde se
  //     aprende a usar la plataforma y lo tiene que tener TODO alumno, sin
  //     que el admin lo marque cada vez ni lo pueda olvidar. Solo alumnos: el
  //     equipo entra por su rol y un invitado de encuesta no compró nada.
  const rolFinal = opciones.rol ?? (asciendeDeInvitado ? 'alumno' : rolPrevio)
  if (rolFinal === 'alumno') {
    await inscribirEnCursosBase(usuario.id, opciones.origen)
  }

  // 5. El correo para definir contraseña, como paso aparte y no bloqueante.
  //    Si el SMTP está caído, el alumno ya tiene cuenta e inscripción; lo único
  //    que falta es que pueda entrar, y eso se reintenta desde el admin.
  if (creado) {
    invitado = await enviarAccesoInicial(
      email,
      opciones.urlRedireccion,
      // Sin curso la lista va vacía y el correo habla de la plataforma.
      opciones.titulosParaCorreo ?? (curso ? [curso.title] : []),
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
    curso: curso?.title ?? null,
    rol: opciones.rol ?? null,
    origen: opciones.origen,
    cuentaNueva: creado,
    correoEnviado: invitado,
  })

  return { ok: true, userId: usuario.id, creado, invitado }
}

/**
 * Inscribe a un alumno en todos los cursos base publicados.
 *
 * `ignoreDuplicates`: si ya tiene el curso —vigente, vencido o revocado— no
 * se toca. Un alta que reiniciara vigencias o restaurara accesos revocados
 * haría más de lo que promete. Un fallo aquí se reporta y no aborta el alta:
 * la persona ya tiene su cuenta y el curso que compró.
 */
async function inscribirEnCursosBase(userId: string, origen: 'stripe' | 'manual'): Promise<void> {
  const supabase = crearClienteServiceRole()

  const { data: base, error } = await supabase
    .from('courses')
    .select('id, access_days')
    .eq('is_default', true)
    .eq('status', 'published')

  if (error || !base || base.length === 0) {
    if (error) registrar('cursosBase:lectura', { userId, error: error.message })
    return
  }

  const filas = base.map((c) => ({
    user_id: userId,
    course_id: c.id,
    cohort_id: null,
    source: origen,
    status: 'active' as const,
    expires_at:
      c.access_days != null
        ? new Date(Date.now() + c.access_days * 24 * 60 * 60 * 1000).toISOString()
        : null,
  }))

  const { error: errorAlta } = await supabase
    .from('enrollments')
    .upsert(filas, { onConflict: 'user_id,course_id', ignoreDuplicates: true })

  if (errorAlta) {
    registrar('cursosBase:inscripcionFallida', { userId, error: errorAlta.message })
    return
  }
  registrar('cursosBase:ok', { userId, cursos: base.length })
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
  cursos: string[] = [],
  nombre?: string | null,
  creadoPor?: string | null
): Promise<boolean> {
  // La liga del correo vale 30 días y no se gasta con un GET (ver
  // lib/auth/enlace-durable.ts). Antes iba un recovery de Supabase de una
  // hora y un solo uso: la víspera del lanzamiento 75 alumnos tenían en el
  // buzón una liga muerta.
  const enlace = await crearEnlaceDurable({ email, creadoPor })
  if (!enlace) return false

  const plantilla = plantillaBienvenida({
    url: enlace,
    cursos,
    nombre,
    base: process.env.NEXT_PUBLIC_APP_URL,
  })
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
