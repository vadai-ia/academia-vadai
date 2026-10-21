/**
 * Qué correo de acceso le toca a cada quien (M25, 20-oct-2026).
 *
 * Pedido de Alejandro: «aseguremos que siempre mande el correo cuando yo cree
 * nuevos alumnos ya sea individuales o de forma masiva». Antes cada camino de
 * alta decidía por su cuenta y había tres huecos: a una cuenta que existía pero
 * nunca entró le llegaba «tienes un curso nuevo» SIN liga para entrar; quien
 * pasaba de la Generación 1 a la 2 no recibía nada; y lo que fallaba solo
 * quedaba en el log del servidor.
 *
 * Aquí vive la regla, una sola vez, y la usan todos los caminos a través de
 * `avisarAccesos` (lib/correo/avisos-de-acceso.ts).
 *
 * Es lógica PURA y sin imports de valor a propósito: `scripts/test-accesos.mjs`
 * la importa directo con Node (que le quita los tipos) y prueba toda la tabla
 * sin levantar la app ni mandarle correo a nadie.
 */

export type TipoCorreoAcceso = 'bienvenida' | 'recordatorio' | 'nuevo_curso' | 'nueva_generacion'

export type OrigenCorreoAcceso =
  | 'alta_manual'
  | 'alta_masiva'
  | 'curso'
  | 'ficha'
  | 'stripe'
  | 'membresia'
  | 'encuesta'
  | 'equipo'
  | 'recordatorio'
  | 'reenvio'
  | 'reenvio_fallidos'
  | 'cambio_correo'
  | 'cambio_generacion'

export type EstadoCorreo = 'pendiente' | 'enviado' | 'fallido' | 'omitido'

/** Cómo se dice en el panel. */
export const ETIQUETA_TIPO_CORREO: Record<TipoCorreoAcceso, string> = {
  bienvenida: 'Bienvenida',
  recordatorio: 'Recordatorio',
  nuevo_curso: 'Curso nuevo',
  nueva_generacion: 'Nueva generación',
}

export const ETIQUETA_ORIGEN_CORREO: Record<OrigenCorreoAcceso, string> = {
  alta_manual: 'alta manual',
  alta_masiva: 'Excel',
  curso: 'desde el curso',
  ficha: 'desde la ficha',
  stripe: 'compra en Stripe',
  membresia: 'membresía',
  encuesta: 'encuesta en vivo',
  equipo: 'alta de equipo',
  recordatorio: 'recordatorio',
  reenvio: 'reenvío',
  reenvio_fallidos: 'reenvío de los que fallaron',
  cambio_correo: 'cambio de correo',
  cambio_generacion: 'cambio de generación',
}

export type CursoDelCambio = { id: string; titulo: string }

export type GeneracionDelCambio = {
  cursoId: string
  cursoTitulo: string
  cursoSlug: string
  cohorteId: string
  nombre: string
  startsOn: string | null
  endsOn: string | null
  /** El nombre de la generación de la que viene; null si estaba «sin generación». */
  anterior: string | null
}

/** Lo que pasó con una persona en un alta, un movimiento o un reenvío. */
export type CambioDeAcceso = {
  userId: string
  email: string
  nombre: string | null
  /** La cuenta se creó en esta operación. */
  cuentaNueva: boolean
  /** Ya abrió sesión alguna vez (`profiles.last_sign_in_at`). */
  yaEntro: boolean
  /** Cursos que no tenía (o tenía vencidos o revocados) y ahora sí. */
  cursosNuevos: CursoDelCambio[]
  /** Cursos donde cambió de generación (Gen 1 → Gen 2). */
  generacionesNuevas: GeneracionDelCambio[]
  /** Cursos que ya tenía tal cual: no cambia nada. */
  sinCambio: CursoDelCambio[]
  /** Reenviar a propósito, aunque no haya cambiado nada. */
  forzar?: 'bienvenida' | 'recordatorio'
  /**
   * Los títulos que nombra el correo, cuando no son los cursos nuevos: la
   * membresía nombra todo el plan; un reenvío, todos sus cursos vigentes.
   */
  titulos?: string[]
}

export type Decision =
  | { tipo: null }
  | { tipo: 'bienvenida'; conEnlace: true }
  | { tipo: 'recordatorio'; conEnlace: true }
  | { tipo: 'nuevo_curso'; conEnlace: false }
  | { tipo: 'nueva_generacion'; conEnlace: boolean; generacion: GeneracionDelCambio }

/**
 * La regla, en orden; gana la primera que aplica:
 *
 *   1. Reenvío a propósito → ese correo (bienvenida o recordatorio), con liga.
 *   2. Cambió de generación → «Ya estás en la Generación N», con liga si nunca
 *      entró: sin ella no podría abrir lo que el correo le anuncia.
 *   3. Cuenta nueva → bienvenida con liga.
 *   4. Cursos nuevos → si nunca entró, la bienvenida con liga (el «curso nuevo»
 *      no le sirve a quien no tiene contraseña); si ya entró, «tienes un curso
 *      nuevo», sin liga.
 *   5. Nada cambió → no se manda nada. Para quien nunca entró está el
 *      recordatorio, que es un clic aparte y deliberado.
 */
export function decidirCorreo(c: CambioDeAcceso): Decision {
  if (c.forzar === 'recordatorio') return { tipo: 'recordatorio', conEnlace: true }
  if (c.forzar === 'bienvenida') return { tipo: 'bienvenida', conEnlace: true }

  const [movimiento] = c.generacionesNuevas
  if (movimiento) return { tipo: 'nueva_generacion', conEnlace: !c.yaEntro, generacion: movimiento }

  if (c.cuentaNueva) return { tipo: 'bienvenida', conEnlace: true }

  if (c.cursosNuevos.length > 0) {
    return c.yaEntro ? { tipo: 'nuevo_curso', conEnlace: false } : { tipo: 'bienvenida', conEnlace: true }
  }

  return { tipo: null }
}

/**
 * Junta lo que pasó con la MISMA persona en varias llamadas: el alta a varios
 * cursos es una llamada por curso, y tiene que salir un solo correo que los
 * nombre todos. La primera llamada es la que sabe si la cuenta era nueva y si
 * ya había entrado.
 */
export function juntarCambios(a: CambioDeAcceso, b: CambioDeAcceso): CambioDeAcceso {
  const unir = <T extends { id: string }>(x: T[], y: T[]) => {
    const vistos = new Set(x.map((e) => e.id))
    return [...x, ...y.filter((e) => !vistos.has(e.id))]
  }
  return {
    ...a,
    nombre: a.nombre ?? b.nombre,
    cuentaNueva: a.cuentaNueva || b.cuentaNueva,
    cursosNuevos: unir(a.cursosNuevos, b.cursosNuevos),
    generacionesNuevas: [
      ...a.generacionesNuevas,
      ...b.generacionesNuevas.filter((g) => !a.generacionesNuevas.some((h) => h.cursoId === g.cursoId)),
    ],
    sinCambio: unir(a.sinCambio, b.sinCambio),
    titulos: a.titulos ?? b.titulos,
  }
}

/** Los ids de curso que se anotan en la bitácora. */
export function cursosDelCambio(c: CambioDeAcceso): string[] {
  return [
    ...new Set([
      ...c.generacionesNuevas.map((g) => g.cursoId),
      ...c.cursosNuevos.map((e) => e.id),
    ]),
  ]
}

/** Los títulos que nombra el correo. */
export function titulosDelCambio(c: CambioDeAcceso): string[] {
  if (c.titulos && c.titulos.length > 0) return c.titulos
  return [
    ...new Set([
      ...c.generacionesNuevas.map((g) => g.cursoTitulo),
      ...c.cursosNuevos.map((e) => e.titulo),
    ]),
  ]
}

// ==========================================================================
// El resultado de un lote, persona por persona
// ==========================================================================

/**
 * Una dirección que Resend aceptaría. Es la misma revisión que el formulario:
 * algo@algo.algo, sin espacios. Una mala dentro de un lote hacía que Resend
 * rechazara las cien; ahora se separa antes y solo falla ella.
 */
export function direccionValida(email: string): boolean {
  const limpia = email.trim()
  return limpia.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(limpia)
}

export type ResultadoPorDestinatario = {
  para: string
  estado: Exclude<EstadoCorreo, 'pendiente'>
  id?: string
  motivo?: string
}

/**
 * Lo que respondió Resend a UN lote, repartido entre sus destinatarios.
 *
 * El endpoint de lote acepta o rechaza el lote completo: si lo acepta,
 * devuelve un id por correo en el mismo orden en que se mandaron; si lo
 * rechaza, no dice cuál fue, así que todos quedan como fallidos con el mismo
 * motivo.
 */
export function repartirLote(
  paras: string[],
  respuesta: { ok: true; ids: Array<string | undefined> } | { ok: false; motivo: string }
): ResultadoPorDestinatario[] {
  if (!respuesta.ok) return paras.map((para) => ({ para, estado: 'fallido', motivo: respuesta.motivo }))
  return paras.map((para, i) => ({ para, estado: 'enviado', id: respuesta.ids[i] }))
}

// ==========================================================================
// Lo que se le dice al equipo
// ==========================================================================

export type ConteoDeAvisos = {
  porTipo: Record<TipoCorreoAcceso, number>
  /** Direcciones QA y sin buzón: no se mandan a propósito. */
  omitidos: number
  fallidos: Array<{ email: string; motivo: string }>
  /** Ya lo tenían tal cual; cuántos de ellos nunca han entrado. */
  sinCambio: number
  sinCambioSinEntrar: number
  /** Los nombres de las generaciones a las que se movió a alguien. */
  generaciones: string[]
}

const MAX_EN_LISTA = 20

/**
 * El resumen de una operación: qué correo le tocó a cuántos y a quién no le
 * salió. `lista` son las direcciones que fallaron, con su motivo, para que el
 * equipo sepa exactamente a quién buscar.
 */
export function resumenDeAvisos(c: ConteoDeAvisos): { resumen: string; lista: string[] } {
  const n = (k: number, uno: string, varios: string) => `${k} ${k === 1 ? uno : varios}`
  const generacion = c.generaciones.length === 1 ? ` a ${c.generaciones[0]}` : ' de generación'
  const partes = [
    c.porTipo.bienvenida > 0 ? `bienvenida con su liga: ${c.porTipo.bienvenida}` : null,
    c.porTipo.nuevo_curso > 0 ? `aviso de curso nuevo: ${c.porTipo.nuevo_curso}` : null,
    c.porTipo.nueva_generacion > 0 ? `movidos${generacion}: ${c.porTipo.nueva_generacion}` : null,
    c.porTipo.recordatorio > 0 ? `recordatorio: ${c.porTipo.recordatorio}` : null,
    c.sinCambio > 0
      ? `ya lo tenían, sin correo: ${c.sinCambio}` +
        (c.sinCambioSinEntrar > 0 ? ` (${n(c.sinCambioSinEntrar, 'nunca ha entrado', 'nunca han entrado')})` : '')
      : null,
    c.omitidos > 0 ? `cuentas de prueba, sin correo: ${c.omitidos}` : null,
  ].filter((p): p is string => p !== null)

  const resumen = partes.length > 0 ? partes.join(' · ') : 'No hubo correos que mandar.'
  const lista = c.fallidos.slice(0, MAX_EN_LISTA).map((f) => `${f.email} (${f.motivo})`)
  if (c.fallidos.length > MAX_EN_LISTA) {
    lista.push(`y ${c.fallidos.length - MAX_EN_LISTA} más: están en «Correos que no salieron», arriba de Alumnos.`)
  }
  return { resumen, lista }
}

export function conteoVacio(): ConteoDeAvisos {
  return {
    porTipo: { bienvenida: 0, recordatorio: 0, nuevo_curso: 0, nueva_generacion: 0 },
    omitidos: 0,
    fallidos: [],
    sinCambio: 0,
    sinCambioSinEntrar: 0,
    generaciones: [],
  }
}

/** Suma dos conteos (el alta masiva manda en tandas de 50). */
export function sumarConteos(a: ConteoDeAvisos, b: ConteoDeAvisos): ConteoDeAvisos {
  return {
    porTipo: {
      bienvenida: a.porTipo.bienvenida + b.porTipo.bienvenida,
      recordatorio: a.porTipo.recordatorio + b.porTipo.recordatorio,
      nuevo_curso: a.porTipo.nuevo_curso + b.porTipo.nuevo_curso,
      nueva_generacion: a.porTipo.nueva_generacion + b.porTipo.nueva_generacion,
    },
    omitidos: a.omitidos + b.omitidos,
    fallidos: [...a.fallidos, ...b.fallidos],
    sinCambio: a.sinCambio + b.sinCambio,
    sinCambioSinEntrar: a.sinCambioSinEntrar + b.sinCambioSinEntrar,
    generaciones: [...new Set([...a.generaciones, ...b.generaciones])],
  }
}
