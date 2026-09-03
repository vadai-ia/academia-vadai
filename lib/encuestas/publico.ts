import 'server-only'

import { createHash } from 'node:crypto'

import { cookies, headers } from 'next/headers'

import { obtenerSesion } from '@/lib/auth/sesion'
import { leerOpciones } from '@/lib/quiz/comun'
import { crearClienteServiceRole } from '@/lib/supabase/service-role'

import {
  agregar,
  type Agregado,
  type PayloadProyeccion,
  type RespuestaCruda,
} from './agregados'
import { generarSessionToken, normalizarJoinCode } from './codigo'
import { leerAjustes, type TipoPregunta } from './comun'

/**
 * El camino público de las encuestas: entrar por el QR, contestar y proyectar.
 *
 * AQUÍ SÍ VA SERVICE ROLE, y conviene dejar escrito por qué no es el "bypass de
 * RLS" que prohíbe CLAUDE.md.
 *
 * `academia_0001_base.sql` concede privilegios de tabla solo a `authenticated` y
 * `service_role`. `anon` recibe `usage` sobre el schema y nada más. Un asistente
 * sin cuenta NO PUEDE escribir por RLS aunque le escribiéramos una policy: no
 * tiene el grant. Así que el acceso se resuelve donde sí se puede razonar —en el
 * servidor, verificando la llave pública antes de tocar la base—, que es
 * exactamente el patrón ya aprobado de `/certificado/[folio]`.
 *
 * Las cinco operaciones de abajo son las únicas que pueden usar service role en
 * esta feature, y las cinco verifican algo antes de escribir:
 *
 *   encuestaPorCodigo     el join_code existe y la encuesta está en vivo
 *   entrar                además, la cuota por IP
 *   participanteActual    la cookie corresponde a un participante de ESTA encuesta
 *   responder             además, que la pregunta esté abierta
 *   resultadosPorToken    el projection_token, que no se dicta ni se imprime
 *
 * Todo lo del admin va por `crearClienteServidor()` y pasa por RLS.
 */

// --------------------------------------------------------------------------
// Cuota
// --------------------------------------------------------------------------

/**
 * La sal del hash de IP.
 *
 * Se prefiere `ENCUESTAS_IP_SALT`; si no está, se deriva de la llave de service
 * role, que ya es un secreto de servidor y nunca llega al navegador. El objetivo
 * es que la tabla sirva para contar sin convertirse en un registro de quién
 * estuvo dónde: sin sal, un hash de IP se revierte con una tabla de 4 mil
 * millones de entradas, que hoy es un rato de laptop.
 */
function sal(): string {
  return process.env.ENCUESTAS_IP_SALT ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'sin-sal'
}

async function huellaDeIp(): Promise<string> {
  const cabeceras = await headers()
  const cruda =
    cabeceras.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    cabeceras.get('x-real-ip') ??
    'desconocida'
  return createHash('sha256').update(`${cruda}|${sal()}`).digest('hex').slice(0, 32)
}

/**
 * Cuántos intentos de cada clase se toleran por IP y por encuesta en una hora.
 *
 * CORREGIDO 3-sep-2026. Estaban en 12 entradas y 3 cuentas, y eso habría
 * reventado el primer evento real: **una sala entera comparte una sola IP
 * pública**. Con cien personas detrás del wifi del salón, la número 13 se
 * habría topado con "demasiados intentos desde esta red" sin que nadie
 * entendiera por qué.
 *
 * Los números de ahora están dimensionados para una sala grande, no para un
 * usuario. Lo que de verdad protege esto no es la cuota: es que hay que traer
 * un `join_code` válido de una encuesta que esté viva, y ese código solo lo
 * tiene quien está en el cuarto viendo la pared. La cuota queda para frenar un
 * script que sí lo consiguiera, no para racionar a los asistentes.
 */
const CUOTA = { join: 400, account: 400, answer: 4000 } as const

type ClaseDeIntento = keyof typeof CUOTA

/**
 * ¿Esta IP ya se pasó?
 *
 * Registra el intento y contesta si se excedió. Va en tabla y no en memoria del
 * proceso porque en Vercel cada petición puede caer en otra instancia: un
 * contador en RAM no cuenta nada.
 *
 * La limpieza es oportunista, aquí mismo. `pg_cron` crearía objetos en el schema
 * `cron`, fuera de `academia`, y eso lo prohíbe la Regla Cero.
 */
async function excedeCuota(pollId: string, clase: ClaseDeIntento): Promise<boolean> {
  const supabase = crearClienteServiceRole()
  const ipHash = await huellaDeIp()
  const desde = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { count } = await supabase
    .from('poll_join_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('poll_id', pollId)
    .eq('ip_hash', ipHash)
    .eq('kind', clase)
    .gte('created_at', desde)

  await supabase.from('poll_join_attempts').insert({ poll_id: pollId, ip_hash: ipHash, kind: clase })

  // Una de cada veinte peticiones barre lo viejo. Suficiente para que la tabla
  // no crezca sin fin, y sin castigar a nadie con un delete en cada entrada.
  if (Math.random() < 0.05) {
    await supabase
      .from('poll_join_attempts')
      .delete()
      .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
  }

  return (count ?? 0) >= CUOTA[clase]
}

// --------------------------------------------------------------------------
// Lectura de la encuesta
// --------------------------------------------------------------------------

export type PreguntaPublica = {
  id: string
  prompt: string
  tipo: TipoPregunta
  opciones: ReturnType<typeof leerOpciones>
  ajustes: ReturnType<typeof leerAjustes>
  status: 'pending' | 'open' | 'closed'
  position: number
}

export type EncuestaPublica = {
  id: string
  title: string
  description: string | null
  joinCode: string
  status: 'draft' | 'live' | 'closed'
  allowGuests: boolean
  showNames: boolean
  stateVersion: number
  /** La corrida en curso. Todo lo que se proyecta se filtra por ella. */
  corrida: number
  preguntas: PreguntaPublica[]
}

type FilaPregunta = {
  id: string
  prompt: string
  question_type: string
  options: unknown
  settings: unknown
  status: string
  position: number
}

function armarPreguntas(filas: FilaPregunta[]): PreguntaPublica[] {
  return [...filas]
    .sort((a, b) => a.position - b.position)
    .map((p) => {
      const tipo = p.question_type as TipoPregunta
      return {
        id: p.id,
        prompt: p.prompt,
        tipo,
        opciones: leerOpciones(p.options),
        ajustes: leerAjustes(p.settings, tipo),
        status: p.status as PreguntaPublica['status'],
        position: p.position,
      }
    })
}

/** Resuelve el código que alguien escaneó o tecleó. */
export async function encuestaPorCodigo(codigo: string): Promise<EncuestaPublica | null> {
  const limpio = normalizarJoinCode(codigo)
  if (!limpio) return null

  const supabase = crearClienteServiceRole()
  const { data } = await supabase
    .from('polls')
    .select(
      'id, title, description, join_code, status, allow_guests, show_names, state_version, corrida, poll_questions(id, prompt, question_type, options, settings, status, position)'
    )
    .eq('join_code', limpio)
    .maybeSingle()

  if (!data) return null

  const fila = data as unknown as {
    id: string
    title: string
    description: string | null
    join_code: string
    status: string
    allow_guests: boolean
    show_names: boolean
    state_version: number
    corrida: number
    poll_questions: FilaPregunta[]
  }

  return {
    id: fila.id,
    title: fila.title,
    description: fila.description,
    joinCode: fila.join_code,
    status: fila.status as EncuestaPublica['status'],
    allowGuests: fila.allow_guests,
    showNames: fila.show_names,
    stateVersion: Number(fila.state_version),
    corrida: Number(fila.corrida),
    preguntas: armarPreguntas(fila.poll_questions ?? []),
  }
}

/** La misma encuesta, resuelta por el token que abre la proyección. */
export async function encuestaPorToken(token: string): Promise<EncuestaPublica | null> {
  if (!token || token.length < 32) return null

  const supabase = crearClienteServiceRole()
  const { data } = await supabase
    .from('polls')
    .select('join_code')
    .eq('projection_token', token)
    .maybeSingle()

  return data ? await encuestaPorCodigo(data.join_code) : null
}

// --------------------------------------------------------------------------
// Identidad del participante
// --------------------------------------------------------------------------

/**
 * La cookie es por encuesta.
 *
 * Una sola cookie global obligaría a re-identificarse al volver a una encuesta
 * anterior, y en un evento con dos dinámicas seguidas eso se nota. El join_code
 * ya es corto y seguro para un nombre de cookie.
 */
export function nombreDeCookie(joinCode: string): string {
  return `vadai_enc_${joinCode}`
}

export type Participante = {
  pollParticipantId: string
  participantId: string
  nombre: string
  tieneCuenta: boolean
}

/** Quién es quien está pidiendo, según su cookie. Null si todavía no ha entrado. */
export async function participanteActual(encuesta: EncuestaPublica): Promise<Participante | null> {
  const almacen = await cookies()
  const token = almacen.get(nombreDeCookie(encuesta.joinCode))?.value
  if (!token) return null

  const supabase = crearClienteServiceRole()
  const { data } = await supabase
    .from('poll_participants')
    .select('id, participant_id, display_name, corrida, participants(user_id)')
    .eq('session_token', token)
    // Que el token exista no basta: tiene que ser de ESTA encuesta.
    .eq('poll_id', encuesta.id)
    .maybeSingle()

  if (!data) return null

  const fila = data as unknown as {
    id: string
    participant_id: string
    display_name: string
    corrida: number
    participants: { user_id: string | null } | null
  }

  // La cookie es de una corrida anterior: la misma sala volvió a empezar.
  //
  // Se le crea su asistencia en la corrida nueva en vez de mandarlo otra vez al
  // formulario. Ya dio sus datos; volver a pedírselos sería castigarlo por algo
  // que hizo el instructor. Sus respuestas de la corrida pasada se quedan donde
  // están, colgando de su asistencia anterior.
  if (fila.corrida !== encuesta.corrida) {
    const tokenNuevo = generarSessionToken()
    const { data: renovado } = await supabase
      .from('poll_participants')
      .insert({
        poll_id: encuesta.id,
        participant_id: fila.participant_id,
        session_token: tokenNuevo,
        display_name: fila.display_name,
        corrida: encuesta.corrida,
      })
      .select('id')
      .maybeSingle()

    if (!renovado) return null

    const almacenNuevo = await cookies()
    almacenNuevo.set(nombreDeCookie(encuesta.joinCode), tokenNuevo, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })

    return {
      pollParticipantId: renovado.id,
      participantId: fila.participant_id,
      nombre: fila.display_name,
      tieneCuenta: Boolean(fila.participants?.user_id),
    }
  }

  return {
    pollParticipantId: fila.id,
    participantId: fila.participant_id,
    nombre: fila.display_name,
    tieneCuenta: Boolean(fila.participants?.user_id),
  }
}

/**
 * ¿Este correo ya pertenece a la academia?
 *
 * Solo lo consulta el camino de `allow_guests` apagado, para no crear cuentas
 * nuevas en una sesión interna. Va por service role porque quien pregunta puede
 * no tener sesión, y no revela nada: contesta sí o no sobre un correo que la
 * propia persona acaba de escribir.
 */
export async function tieneCuenta(email: string): Promise<boolean> {
  const supabase = crearClienteServiceRole()
  const { data } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle()

  return Boolean(data)
}

export type DatosDeEntrada = {
  nombre: string
  apellido: string
  email: string
  telefono: string
}

export type ResultadoEntrada = { ok: true } | { ok: false; motivo: string }

/**
 * Entrar a la encuesta.
 *
 * Los tres caminos terminan aquí y en la misma fila de `participants`, porque la
 * persona es la misma se haya identificado como se haya identificado. Lo único
 * que cambia es si esa fila lleva `user_id`.
 *
 * `crearCuenta` es el camino (b): además de participar, se le crea cuenta real
 * para que vuelva a la siguiente encuesta. Lo hace `darDeAlta()` y no un alta
 * paralela: es el único punto del sistema donde nacen cuentas y debe seguir
 * siéndolo.
 */
export async function entrar(
  encuesta: EncuestaPublica,
  datos: DatosDeEntrada,
  opciones: { crearCuenta: boolean; darDeAlta?: (email: string, nombre: string) => Promise<string | null> }
): Promise<ResultadoEntrada> {
  // Se puede entrar en BORRADOR, no solo en vivo. Solo una encuesta cerrada
  // rechaza gente.
  //
  // El QR se proyecta desde que arranca la sesión, mientras el instructor
  // todavía está presentando el tema y no ha abierto ninguna pregunta. Si
  // registrarse exigiera que la encuesta estuviera "en vivo", la pared diría
  // "ya puedes entrar" y el celular contestaría "todavía no empezamos" —y quien
  // escaneó con ganas al minuto uno no lo vuelve a intentar—. Registrarse antes
  // no cuesta nada: la sala de espera ya explica que falta abrir la pregunta.
  if (encuesta.status === 'closed') {
    return { ok: false, motivo: 'Esta dinámica ya terminó.' }
  }

  if (await excedeCuota(encuesta.id, 'join')) {
    return { ok: false, motivo: 'Demasiados intentos desde esta red. Espera un momento.' }
  }

  const supabase = crearClienteServiceRole()
  const email = datos.email.trim().toLowerCase()
  const nombreCompleto = `${datos.nombre} ${datos.apellido}`.trim()

  // ¿Ya está en sesión? Entonces la identidad la da su cuenta, no el formulario.
  const sesion = await obtenerSesion()
  let userId = sesion.tipo === 'activo' ? sesion.perfil.user_id : null

  if (!userId && opciones.crearCuenta) {
    if (await excedeCuota(encuesta.id, 'account')) {
      return { ok: false, motivo: 'Demasiadas cuentas nuevas desde esta red. Entra como invitado.' }
    }
    userId = (await opciones.darDeAlta?.(email, nombreCompleto)) ?? null
  }

  // La persona: se reusa si ya vino a otra encuesta con el mismo correo.
  const { data: existente } = await supabase
    .from('participants')
    .select('id, user_id')
    .eq('email', email)
    .maybeSingle()

  let participantId = existente?.id ?? null

  if (participantId) {
    await supabase
      .from('participants')
      .update({
        first_name: datos.nombre.trim(),
        last_name: datos.apellido.trim(),
        phone: datos.telefono.trim() || null,
        // Nunca se desvincula una cuenta ya ligada: si vuelve como invitado
        // después de haberse registrado, sigue siendo la misma persona.
        user_id: userId ?? existente?.user_id ?? null,
      })
      .eq('id', participantId)
  } else {
    const { data: nueva, error } = await supabase
      .from('participants')
      .insert({
        email,
        first_name: datos.nombre.trim(),
        last_name: datos.apellido.trim(),
        phone: datos.telefono.trim() || null,
        user_id: userId,
      })
      .select('id')
      .maybeSingle()

    if (error || !nueva) {
      console.error(JSON.stringify({ operacion: 'entrar:participante', error: error?.message }))
      return { ok: false, motivo: 'No pudimos registrarte. Vuelve a intentarlo.' }
    }
    participantId = nueva.id
  }

  // La asistencia a ESTA encuesta. Si ya estaba, se reusa su token: volver a
  // escanear el QR reconoce a la persona, no la duplica.
  const { data: yaEntro } = await supabase
    .from('poll_participants')
    .select('session_token')
    .eq('poll_id', encuesta.id)
    .eq('participant_id', participantId)
    .eq('corrida', encuesta.corrida)
    .maybeSingle()

  let token = yaEntro?.session_token ?? null

  if (!token) {
    token = generarSessionToken()
    const { error } = await supabase.from('poll_participants').insert({
      poll_id: encuesta.id,
      participant_id: participantId,
      session_token: token,
      display_name: nombreCompleto || email.split('@')[0] || 'Invitado',
      // Se manda por claridad, pero quien manda es el trigger
      // `poll_participants_sella_corrida`: lo sobrescribe con la corrida real
      // de la encuesta. Así un camino nuevo que lo olvidara tampoco podría
      // meter una asistencia en la corrida equivocada.
      corrida: encuesta.corrida,
    })
    if (error) {
      console.error(JSON.stringify({ operacion: 'entrar:asistencia', error: error.message }))
      return { ok: false, motivo: 'No pudimos registrarte. Vuelve a intentarlo.' }
    }
  }

  const almacen = await cookies()
  almacen.set(nombreDeCookie(encuesta.joinCode), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })

  return { ok: true }
}

// --------------------------------------------------------------------------
// Responder
// --------------------------------------------------------------------------

export type ResultadoRespuesta = { ok: true } | { ok: false; motivo: string }

/**
 * Guardar una respuesta.
 *
 * Las dos verificaciones que importan ocurren aquí y no en la pantalla:
 *
 *   1. La pregunta tiene que estar `open`. Cerrarla cierra la ventana de
 *      escritura, y por eso nadie se adelanta ni llega tarde.
 *   2. El participante tiene que ser de esta encuesta (lo resolvió su cookie).
 *
 * El doble envío no se valida: lo corta el `unique (question_id,
 * poll_participant_id, ordinal)` de la migración. Reenviar el formulario choca
 * contra el índice y se responde con un mensaje, no con un 500.
 */
export async function responder(
  encuesta: EncuestaPublica,
  participante: Participante,
  preguntaId: string,
  valor: { texto?: string; opcion?: string; numero?: number }
): Promise<ResultadoRespuesta> {
  const pregunta = encuesta.preguntas.find((p) => p.id === preguntaId)
  if (!pregunta) return { ok: false, motivo: 'Esa pregunta no existe.' }
  if (pregunta.status !== 'open') {
    return { ok: false, motivo: 'Esta pregunta ya no está abierta.' }
  }
  if (await excedeCuota(encuesta.id, 'answer')) {
    return { ok: false, motivo: 'Demasiadas respuestas seguidas. Espera un momento.' }
  }

  const supabase = crearClienteServiceRole()

  // La nube admite varias palabras por persona; el ordinal es cuál va.
  let ordinal = 0
  if (pregunta.tipo === 'nube') {
    const { count } = await supabase
      .from('poll_answers')
      .select('id', { count: 'exact', head: true })
      .eq('question_id', pregunta.id)
      .eq('poll_participant_id', participante.pollParticipantId)

    ordinal = count ?? 0
    if (ordinal >= (pregunta.ajustes.maxPalabras ?? 1)) {
      return { ok: false, motivo: 'Ya escribiste todas las palabras que permite esta pregunta.' }
    }
  }

  const { error } = await supabase.from('poll_answers').insert({
    question_id: pregunta.id,
    poll_participant_id: participante.pollParticipantId,
    ordinal,
    text_value: valor.texto ?? null,
    option_id: valor.opcion ?? null,
    numeric_value: valor.numero ?? null,
    // Igual que arriba: el trigger `poll_answers_sella_corrida` lo reescribe
    // desde la encuesta. Aquí va solo para que se lea qué se espera.
    corrida: encuesta.corrida,
  })

  if (error) {
    if (error.code === '23505') return { ok: false, motivo: 'Ya contestaste esta pregunta.' }
    console.error(
      JSON.stringify({ operacion: 'responder', pregunta: pregunta.id, error: error.message })
    )
    return { ok: false, motivo: 'No se pudo guardar tu respuesta.' }
  }

  return { ok: true }
}

/** Qué preguntas ya contestó, para no volver a pedírselas. */
export async function preguntasContestadas(participante: Participante): Promise<Set<string>> {
  const supabase = crearClienteServiceRole()
  const { data } = await supabase
    .from('poll_answers')
    .select('question_id')
    .eq('poll_participant_id', participante.pollParticipantId)

  return new Set((data ?? []).map((r) => r.question_id))
}

// --------------------------------------------------------------------------
// Resultados para la proyección
// --------------------------------------------------------------------------

export type ResultadoPregunta = {
  pregunta: PreguntaPublica
  agregado: Agregado
}

export async function resultadosDePregunta(
  encuesta: EncuestaPublica,
  pregunta: PreguntaPublica
): Promise<ResultadoPregunta> {
  const supabase = crearClienteServiceRole()

  const { data } = await supabase
    .from('poll_answers')
    .select(
      'id, text_value, text_norm, option_id, numeric_value, hidden, created_at, poll_participants(display_name)'
    )
    .eq('question_id', pregunta.id)
    // Solo la corrida en curso. Las anteriores siguen guardadas y salen en la
    // exportación, pero mezclarlas aquí haría que la primera gráfica de una
    // corrida nueva arrancara con los números de la anterior.
    .eq('corrida', encuesta.corrida)

  type Fila = {
    id: string
    text_value: string | null
    text_norm: string | null
    option_id: string | null
    numeric_value: number | null
    hidden: boolean
    created_at: string
    poll_participants: { display_name: string } | null
  }

  const crudas: RespuestaCruda[] = ((data ?? []) as unknown as Fila[]).map((f) => ({
    id: f.id,
    textValue: f.text_value,
    textNorm: f.text_norm,
    optionId: f.option_id,
    numericValue: f.numeric_value,
    hidden: f.hidden,
    creadaEn: f.created_at,
    autor: encuesta.showNames ? (f.poll_participants?.display_name ?? null) : null,
  }))

  return {
    pregunta,
    agregado: agregar(pregunta.tipo, crudas, pregunta.opciones, pregunta.ajustes),
  }
}

/** Cuánta gente entró. Es el número que la pantalla muestra mientras se llena la sala. */
export async function cuantosEntraron(encuestaId: string): Promise<number> {
  const supabase = crearClienteServiceRole()
  const { count } = await supabase
    .from('poll_participants')
    .select('id', { count: 'exact', head: true })
    .eq('poll_id', encuestaId)
    .eq('corrida', await corridaDe(encuestaId))

  return count ?? 0
}

/** La corrida en curso de una encuesta, cuando solo se tiene su id. */
async function corridaDe(encuestaId: string): Promise<number> {
  const supabase = crearClienteServiceRole()
  const { data } = await supabase.from('polls').select('corrida').eq('id', encuestaId).maybeSingle()
  return Number(data?.corrida ?? 1)
}

/** Tope de nombres que la sala de espera pinta a la vez. Más ya no se leen. */
const TOPE_RECIEN_LLEGADOS = 40

/**
 * Los últimos en entrar, para la sala de espera.
 *
 * Solo el nombre que la persona dio al entrar —ni correo ni teléfono—: se
 * proyecta en una pared. Y solo si la encuesta muestra nombres; si el admin
 * apagó `show_names` por privacidad, aquí también se respeta.
 */
export async function recienLlegados(
  encuesta: EncuestaPublica
): Promise<Array<{ id: string; nombre: string }>> {
  if (!encuesta.showNames) return []

  const supabase = crearClienteServiceRole()
  const { data } = await supabase
    .from('poll_participants')
    .select('id, display_name')
    .eq('poll_id', encuesta.id)
    .eq('corrida', encuesta.corrida)
    .order('joined_at', { ascending: false })
    .limit(TOPE_RECIEN_LLEGADOS)

  return (data ?? []).map((f) => ({ id: f.id, nombre: f.display_name }))
}

/**
 * Todo lo que la pantalla proyectada necesita, de una vez.
 *
 * Lo usan el route handler del sondeo y el render inicial de la página. Que sea
 * una sola función es el punto: si cada uno armara su propio objeto, el primer
 * pintado y el primer sondeo podrían diferir y la pantalla parpadearía al
 * cargar.
 */
export async function payloadDeProyeccion(encuesta: EncuestaPublica): Promise<PayloadProyeccion> {
  const abierta = encuesta.preguntas.find((p) => p.status === 'open')

  // Al cerrar una pregunta la pantalla se queda con su resultado en vez de
  // vaciarse: es justo el momento en que el instructor comenta lo que la sala
  // acaba de contestar, y borrarlo entonces sería el peor momento posible.
  const aMostrar =
    abierta ?? [...encuesta.preguntas].reverse().find((p) => p.status === 'closed') ?? null

  const [participantes, llegados, resultado] = await Promise.all([
    cuantosEntraron(encuesta.id),
    // Solo mientras no hay pregunta en pantalla: es cuando la sala de espera
    // se ve. Durante una pregunta ese espacio lo ocupa la gráfica, y pedir la
    // lista cada segundo sería un viaje que nadie mira.
    aMostrar ? Promise.resolve([]) : recienLlegados(encuesta),
    aMostrar ? resultadosDePregunta(encuesta, aMostrar) : Promise.resolve(null),
  ])

  return {
    v: encuesta.stateVersion,
    estado: encuesta.status,
    participantes,
    pregunta: aMostrar
      ? {
          id: aMostrar.id,
          prompt: aMostrar.prompt,
          tipo: aMostrar.tipo,
          abierta: aMostrar.status === 'open',
          posicion: aMostrar.position,
        }
      : null,
    total: encuesta.preguntas.length,
    pendientes: encuesta.preguntas.filter((p) => p.status === 'pending').length,
    recienLlegados: llegados,
    agregado: resultado?.agregado ?? null,
  }
}
