import 'server-only'

import { avisarAccesos } from '@/lib/correo/avisos-de-acceso'
import type { CambioDeAcceso, ConteoDeAvisos, GeneracionDelCambio, OrigenCorreoAcceso } from '@/lib/correo/decision'
import { estadoDeGeneracion } from '@/lib/generaciones'
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
  /**
   * Qué pasó con la inscripción de ESTA llamada (M25): `nuevo` (no lo tenía,
   * o lo tenía vencido o revocado), `generacion` (lo tenía y cambió de
   * generación), `sin_cambio` (ya lo tenía tal cual) o `sin_curso`.
   */
  cambio?: 'nuevo' | 'generacion' | 'sin_cambio' | 'sin_curso'
  /** Ya había abierto sesión alguna vez. */
  yaEntro?: boolean
  /** Los hechos para el correo de acceso; con `correo: 'diferir'` los junta quien llama. */
  hechos?: CambioDeAcceso
  /** Con `correo: 'enviar'`: qué pasó con el correo. */
  correo?: ConteoDeAvisos
  motivo?: string
}

/**
 * `invitado` nace en una encuesta en vivo: tiene cuenta para volver a la
 * siguiente, pero no compró nada y no ve cursos.
 */
export type RolDeAlta = 'alumno' | 'community_manager' | 'admin' | 'superadmin' | 'invitado'

type Opciones = {
  email: string
  nombre?: string | null
  /**
   * Sin curso no se crea inscripción. Es el caso de alguien del equipo: un
   * admin no necesita estar inscrito para entrar al panel.
   */
  courseId?: string | null
  /**
   * Tres valores (M16). `undefined`: que lo resuelva el alta —la generación
   * que ya tenía, o la abierta a inscripciones—. `null`: ninguna (cursos sin
   * generaciones). Un id: esa, explícita.
   */
  cohortId?: string | null
  /** `membresia` (M17): la alta la hace el webhook de V-AI-P. */
  origen: 'stripe' | 'manual' | 'membresia'
  /**
   * Vencimiento explícito de la inscripción (M17). Gana sobre `access_days`:
   * la membresía da acceso hasta donde diga su suscripción, y un checkout
   * reenviado no puede convertirlo en acceso de por vida. `undefined` = usar
   * `access_days`, como siempre.
   */
  expiraEn?: string | null
  /**
   * Solo se manda cuando la intención es FIJAR el rol —el alta de equipo—.
   * Omitirlo conserva el rol que la persona ya tenga, que es lo que quieren el
   * webhook y el alta de alumno. Ver el comentario del upsert de perfil.
   */
  rol?: RolDeAlta
  /**
   * Los cursos que nombra el correo. Lo usa la membresía: entra por la casa,
   * pero la bienvenida nombra todo lo que trae el plan. Sin esto, el curso de
   * esta llamada.
   */
  titulosParaCorreo?: string[]
  /**
   * La empresa de la que viene (20-sep-2026). `undefined` no toca lo que ya
   * tenga; `null` la quita explícitamente; un id la fija.
   */
  companyId?: string | null
  /**
   * El correo de acceso (M25). `enviar` (default): esta llamada lo manda.
   * `diferir`: no manda nada y devuelve los `hechos`; es lo que usan el alta a
   * varios cursos y el Excel, que juntan todo lo de una persona y mandan UN
   * correo que lo nombra todo.
   */
  correo?: 'enviar' | 'diferir'
  /** De dónde sale el correo, para la bitácora. Default según `origen`. */
  origenCorreo?: OrigenCorreoAcceso
  /** Quién del equipo hizo el alta, para la liga y la bitácora. */
  creadoPor?: string | null
}

const ORIGEN_DEL_CORREO: Record<Opciones['origen'], OrigenCorreoAcceso> = {
  stripe: 'stripe',
  manual: 'alta_manual',
  membresia: 'membresia',
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
  let curso: { id: string; access_days: number | null; title: string; slug: string; course_type: string } | null =
    null

  if (opciones.courseId) {
    const { data, error: errorCurso } = await supabase
      .from('courses')
      .select('id, access_days, title, slug, course_type')
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
  //
  // Y el nombre que trae el alta solo LLENA un perfil sin nombre (decidido por
  // Alejandro, 16-oct-2026). Antes un nombre no vacío pisaba el que ya había, y
  // venía de fuentes que no son la persona: el formulario de Stripe (el nombre
  // de la tarjeta, «JUAN P GARCIA»), una fila del padrón, lo que tecleó en una
  // encuesta en vivo. El nombre lo cambia la persona en Mi perfil, o el equipo
  // con «Corregir nombre» en su ficha (`corregirNombreDeAlumno`).
  const { data: previo } = await supabase
    .from('profiles')
    .select('role, full_name, last_sign_in_at')
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
      full_name: previo?.full_name?.trim() || opciones.nombre?.trim() || '',
      role: opciones.rol ?? (asciendeDeInvitado ? 'alumno' : rolPrevio),
      // Solo si el llamador dijo algo: un alta sin empresa no borra la que ya tenía.
      ...(opciones.companyId !== undefined ? { company_id: opciones.companyId } : {}),
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
    opciones.expiraEn !== undefined
      ? opciones.expiraEn
      : curso?.access_days != null
        ? new Date(Date.now() + curso.access_days * 24 * 60 * 60 * 1000).toISOString()
        : null

  // ¿Ya tenía este curso? Se mira ANTES del upsert: es lo que decide qué
  // correo le toca —curso nuevo, nueva generación o ninguno— (M25).
  const { data: inscripcionPrevia } = curso
    ? await supabase
        .from('enrollments')
        .select('user_id, cohort_id, status, expires_at')
        .eq('user_id', usuario.id)
        .eq('course_id', curso.id)
        .maybeSingle()
    : { data: null }

  // La generación (M16): la pedida; si no se pidió, la que ya tenía —reenviar
  // un evento de Stripe no puede dejar a nadie sin generación— y, si tampoco,
  // la abierta a inscripciones. En cursos sin generaciones, ninguna.
  const generacion =
    curso && curso.course_type === 'cohort'
      ? opciones.cohortId !== undefined
        ? opciones.cohortId
        : (inscripcionPrevia?.cohort_id ?? (await generacionAbierta(curso.id)))
      : null
  if (curso && curso.course_type === 'cohort' && generacion === null) {
    registrar('darDeAlta:sinGeneracion', {
      email,
      curso: curso.title,
      aviso: 'el curso no tiene generación abierta; la inscripción queda sin generación',
    })
  }

  const { error: errorInscripcion } = curso
    ? await supabase.from('enrollments').upsert(
        {
          user_id: usuario.id,
          course_id: curso.id,
          cohort_id: generacion,
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
    // Los cursos base no son de la membresía: si la membresía vence, siguen.
    await inscribirEnCursosBase(usuario.id, opciones.origen === 'membresia' ? 'stripe' : opciones.origen)
  }

  // 5. Qué cambió (M25). Primero la generación: quien estaba en la Gen 1 y se
  //    da de alta en la Gen 2 se MUEVE —es la misma inscripción, conserva su
  //    avance— y se le avisa con las fechas. Si no cambió de generación, un
  //    curso que no tenía, o que tenía vencido o revocado, es nuevo para él.
  let cambio: NonNullable<ResultadoAlta['cambio']> = 'sin_curso'
  let generacionNueva: GeneracionDelCambio | null = null
  if (curso) {
    const vigente =
      inscripcionPrevia !== null &&
      inscripcionPrevia.status === 'active' &&
      (inscripcionPrevia.expires_at === null || Date.parse(inscripcionPrevia.expires_at) > Date.now())
    const cambioDeGeneracion =
      inscripcionPrevia !== null &&
      curso.course_type === 'cohort' &&
      generacion !== null &&
      generacion !== inscripcionPrevia.cohort_id
    cambio = cambioDeGeneracion ? 'generacion' : vigente ? 'sin_cambio' : 'nuevo'

    if (cambioDeGeneracion && generacion) {
      generacionNueva = await datosDeGeneracion(curso, generacion, inscripcionPrevia?.cohort_id ?? null)
      if (!generacionNueva) cambio = 'nuevo'
    }
  }

  const delCurso = curso ? [{ id: curso.id, titulo: curso.title }] : []
  const hechos: CambioDeAcceso = {
    userId: usuario.id,
    email,
    nombre: previo?.full_name?.trim() || opciones.nombre?.trim() || null,
    cuentaNueva: creado,
    yaEntro: Boolean(previo?.last_sign_in_at),
    cursosNuevos: cambio === 'nuevo' ? delCurso : [],
    generacionesNuevas: generacionNueva ? [generacionNueva] : [],
    sinCambio: cambio === 'sin_cambio' ? delCurso : [],
    titulos: opciones.titulosParaCorreo,
  }

  // 6. El correo, como paso aparte y no bloqueante: si falla, la persona ya
  //    tiene cuenta e inscripción, y el panel enseña que hay que reenviarlo.
  const correo =
    (opciones.correo ?? 'enviar') === 'enviar'
      ? await avisarAccesos([hechos], {
          origen: opciones.origenCorreo ?? ORIGEN_DEL_CORREO[opciones.origen],
          creadoPor: opciones.creadoPor,
        })
      : undefined

  registrar('darDeAlta:ok', {
    email,
    curso: curso?.title ?? null,
    rol: opciones.rol ?? null,
    origen: opciones.origen,
    cuentaNueva: creado,
    cambio,
    correo: correo ? { fallidos: correo.fallidos.length, omitidos: correo.omitidos } : 'diferido',
  })

  return { ok: true, userId: usuario.id, creado, cambio, yaEntro: hechos.yaEntro, hechos, correo }
}

/** Lo que el correo de «Ya estás en la Generación N» necesita saber de ella. */
async function datosDeGeneracion(
  curso: { id: string; title: string; slug: string },
  cohorteId: string,
  anteriorId: string | null
): Promise<GeneracionDelCambio | null> {
  const supabase = crearClienteServiceRole()
  const ids = anteriorId ? [cohorteId, anteriorId] : [cohorteId]
  const { data, error } = await supabase.from('cohorts').select('id, name, starts_on, ends_on').in('id', ids)
  const nueva = data?.find((g) => g.id === cohorteId)
  if (error || !nueva) {
    registrar('darDeAlta:generacion', { cohorteId, error: error?.message ?? 'no existe' })
    return null
  }
  return {
    cursoId: curso.id,
    cursoTitulo: curso.title,
    cursoSlug: curso.slug,
    cohorteId,
    nombre: nueva.name,
    startsOn: nueva.starts_on,
    endsOn: nueva.ends_on,
    anterior: data?.find((g) => g.id === anteriorId)?.name ?? null,
  }
}

/** La generación abierta a inscripciones del curso, o null. Service role: aquí no hay sesión. */
export async function generacionAbierta(cursoId: string): Promise<string | null> {
  const supabase = crearClienteServiceRole()
  const { data } = await supabase
    .from('cohorts')
    .select('id, ends_on, open_for_enrollment')
    .eq('course_id', cursoId)
    .eq('open_for_enrollment', true)
  const abierta = (data ?? []).find((g) => estadoDeGeneracion(g) === 'abierta')
  return abierta?.id ?? null
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
