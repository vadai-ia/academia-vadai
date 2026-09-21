'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { cdmxAUtc } from '@/lib/admin/fechas'
import type { EstadoAccion } from '@/lib/admin/tipos'
import { exigirAdmin } from '@/lib/auth/sesion'
import { crearClienteServidor } from '@/lib/supabase/server'

import {
  estadoEfectivo,
  pesosSuman100,
  sumaPesos,
  TIPOS_FILA,
  TOPE_DESCRIPCION,
  TOPE_ETIQUETA_FILA,
  TOPE_TITULO,
  type TipoFila,
} from './comun'

/**
 * Administración de dinámicas empresariales (M13): la dinámica, su ciclo y
 * sus filas. Lo que hace el alumno sobre su tablero vive en
 * `acciones-tablero.ts`.
 *
 * Todo pasa por RLS con el cliente del usuario: `exigirAdmin()` ya cortó
 * antes y las policies de 0028 son admin-only para estas tablas.
 *
 * LAS REGLAS DE VERDAD ESTÁN EN LA BASE (triggers 7b–7d de 0028): pesos que
 * suman 100 al abrir, escala congelada con celdas, tipo de fila congelado
 * con celdas. Aquí se repiten solo para dar el mensaje amable ANTES del
 * viaje, y cuando la base dice que no con errcode 22023 su mensaje se
 * devuelve tal cual: es el mismo español y nombra la causa exacta.
 *
 * REGLA DE FILAS SEGÚN EL ESTADO (efectivo, no el guardado: una `open` con
 * la fecha vencida ya no tiene a nadie calificando):
 *
 *   draft   todo
 *   open    solo el nombre de una fila y altas/bajas de INFORMATIVAS. Tocar
 *           un peso o un criterio cambiaría el ponderado bajo los pies de
 *           una empresa que está calificando: "Ciérrala para ajustar
 *           criterios."
 *   closed  todo; el trigger vuelve a exigir 100 al reabrir.
 */

function registrarFallo(operacion: string, detalle: Record<string, unknown>, error: string) {
  console.error(JSON.stringify({ operacion, ...detalle, error }))
}

function primerError(resultado: { error?: { issues: Array<{ message: string }> } }) {
  return resultado.error?.issues[0]?.message ?? 'Revisa los datos.'
}

/** 22023 lo lanzan los triggers de 0028 con un mensaje pensado para leerse. */
function mensajeDe(error: { code?: string; message: string }, generico: string): string {
  return error.code === '22023' ? error.message : generico
}

const CIERRALA = 'Ciérrala para ajustar criterios.'

/**
 * Todo lo que pinta una dinámica. El alumno también las lee —su lista, su
 * tablero y la pestaña del curso—, así que se revalidan las dos caras.
 */
function refrescar(id: string) {
  revalidatePath('/admin/dinamicas')
  revalidatePath(`/admin/dinamicas/${id}`)
  revalidatePath(`/admin/dinamicas/${id}/tableros`)
  revalidatePath(`/admin/dinamicas/${id}/configuracion`)
  revalidatePath('/admin')
  revalidatePath('/dinamicas')
  revalidatePath(`/dinamicas/${id}`)
  revalidatePath('/curso/[slug]/dinamicas', 'page')
}

// --------------------------------------------------------------------------
// La dinámica
// --------------------------------------------------------------------------

const esquemaDinamica = z.object({
  course_id: z.uuid('Elige el curso al que pertenece.'),
  cohort_id: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  title: z
    .string()
    .trim()
    .min(3, 'La dinámica necesita un título.')
    .max(TOPE_TITULO, `El título no puede pasar de ${TOPE_TITULO} caracteres.`),
  description: z
    .string()
    .trim()
    .max(TOPE_DESCRIPCION, 'La descripción es muy larga.')
    .transform((v) => (v === '' ? null : v))
    .nullable(),
})

const esquemaEscala = z
  .object({
    scale_min: z.coerce
      .number({ message: 'La escala necesita un mínimo.' })
      .int('La escala va en enteros.')
      .min(0, 'El mínimo de la escala no puede ser negativo.'),
    scale_max: z.coerce
      .number({ message: 'La escala necesita un máximo.' })
      .int('La escala va en enteros.')
      .max(100, 'El máximo de la escala no puede pasar de 100.'),
  })
  .refine((e) => e.scale_max > e.scale_min, {
    message: 'El máximo de la escala tiene que ser mayor que el mínimo.',
  })

function leerDinamica(datos: FormData) {
  return esquemaDinamica.safeParse({
    course_id: datos.get('course_id'),
    cohort_id: datos.get('cohort_id') ?? '',
    title: datos.get('title'),
    description: datos.get('description') ?? '',
  })
}

/**
 * Fecha límite en CDMX, en dos campos: "los dos o ninguno" lo decide el
 * servidor porque sin JavaScript no hay quien lo valide antes.
 */
function leerFechaLimite(
  datos: FormData
): { ok: true; closes_at: string | null } | { ok: false; error: string } {
  const fecha = String(datos.get('cierra_fecha') ?? '').trim()
  const hora = String(datos.get('cierra_hora') ?? '').trim()

  if (!fecha && !hora) return { ok: true, closes_at: null }
  if (!fecha || !hora) {
    return { ok: false, error: 'Pon la fecha y la hora del cierre, o deja los dos campos vacíos.' }
  }

  const iso = cdmxAUtc(fecha, hora)
  if (!iso) return { ok: false, error: 'La fecha o la hora del cierre no son válidas.' }
  return { ok: true, closes_at: iso }
}

function yaPaso(iso: string | null): boolean {
  return iso !== null && new Date(iso).getTime() <= Date.now()
}

/** Crea la dinámica en borrador, con la escala por defecto, y se va a sus criterios. */
export async function crearDinamica(
  _previo: EstadoAccion,
  datos: FormData
): Promise<EstadoAccion> {
  const perfil = await exigirAdmin()

  const resultado = leerDinamica(datos)
  if (!resultado.success) return { error: primerError(resultado) }

  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('dynamics')
    .insert({ ...resultado.data, created_by: perfil.user_id })
    .select('id')
    .maybeSingle()

  if (error || !data) {
    registrarFallo(
      'crearDinamica',
      { curso: resultado.data.course_id },
      error?.message ?? 'sin fila'
    )
    return { error: 'No se pudo crear la dinámica.' }
  }

  revalidatePath('/admin/dinamicas')
  revalidatePath('/admin')
  redirect(`/admin/dinamicas/${data.id}`)
}

/**
 * Título, curso, cohorte, descripción, escala y fecha límite.
 *
 * La escala llega aunque esté bloqueada (el formulario la manda oculta con
 * su valor actual): el trigger 7c solo protesta si CAMBIA y hay celdas, y
 * ese mensaje se devuelve tal cual.
 */
export async function actualizarConfiguracion(
  _previo: EstadoAccion,
  datos: FormData
): Promise<EstadoAccion> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  if (!id) return { error: 'Falta la dinámica.' }

  const resultado = leerDinamica(datos)
  if (!resultado.success) return { error: primerError(resultado) }

  const escala = esquemaEscala.safeParse({
    scale_min: datos.get('scale_min'),
    scale_max: datos.get('scale_max'),
  })
  if (!escala.success) return { error: primerError(escala) }

  const limite = leerFechaLimite(datos)
  if (!limite.ok) return { error: limite.error }

  const supabase = await crearClienteServidor()

  const { data: actual } = await supabase
    .from('dynamics')
    .select('status, closes_at')
    .eq('id', id)
    .maybeSingle()
  if (!actual) return { error: 'Esa dinámica ya no existe.' }

  // Una fecha NUEVA en el pasado no es una fecha límite: es cerrarla por la
  // puerta de atrás. La que ya estaba guardada sí puede quedarse, porque
  // guardar el título de una dinámica cerrada no debería fallar por ella.
  const cambioDeFecha =
    (limite.closes_at === null) !== (actual.closes_at === null) ||
    (limite.closes_at !== null &&
      actual.closes_at !== null &&
      new Date(limite.closes_at).getTime() !== new Date(actual.closes_at).getTime())

  if (cambioDeFecha && yaPaso(limite.closes_at)) {
    return {
      error:
        actual.status === 'open'
          ? 'Esa fecha ya pasó. Si quieres cerrarla ahora, usa «Cerrar la dinámica» aquí abajo.'
          : 'Esa fecha ya pasó. Ponla en el futuro o deja los dos campos vacíos.',
    }
  }

  const { error } = await supabase
    .from('dynamics')
    .update({
      ...resultado.data,
      scale_min: escala.data.scale_min,
      scale_max: escala.data.scale_max,
      closes_at: limite.closes_at,
    })
    .eq('id', id)

  if (error) {
    registrarFallo('actualizarConfiguracion', { id }, error.message)
    return { error: mensajeDe(error, 'No se pudo guardar la dinámica.') }
  }

  refrescar(id)
  return { aviso: 'Cambios guardados.' }
}

// --------------------------------------------------------------------------
// Ciclo: borrador -> abierta -> cerrada -> abierta
// --------------------------------------------------------------------------

/**
 * Abre la dinámica: desde aquí cada inscrito la ve en su campana y su
 * empresa puede empezar su tablero. Las tres condiciones se revisan antes
 * para decir CUÁL falla; el trigger las vuelve a exigir por si acaso.
 */
export async function abrirDinamica(
  _previo: EstadoAccion,
  datos: FormData
): Promise<EstadoAccion> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  if (!id) return { error: 'Falta la dinámica.' }

  const supabase = await crearClienteServidor()
  const [dinamica, filas] = await Promise.all([
    supabase.from('dynamics').select('status, closes_at').eq('id', id).maybeSingle(),
    supabase.from('dynamic_rows').select('row_kind, weight').eq('dynamic_id', id),
  ])
  if (!dinamica.data) return { error: 'Esa dinámica ya no existe.' }
  if (dinamica.data.status !== 'draft') {
    return {
      error:
        dinamica.data.status === 'open'
          ? 'La dinámica ya está abierta.'
          : 'La dinámica está cerrada: usa «Reabrir la dinámica».',
    }
  }

  const criterios = (filas.data ?? [])
    .filter((f) => f.row_kind === 'criterio')
    .map((f) => ({ tipo: f.row_kind, peso: f.weight === null ? null : Number(f.weight) }))

  if (criterios.length === 0) {
    return { error: 'Agrega al menos un criterio con peso antes de abrirla.' }
  }
  if (!pesosSuman100(criterios)) {
    return {
      error: `Los pesos suman ${sumaPesos(criterios)}, no 100. Ajusta los criterios antes de abrirla.`,
    }
  }
  if (yaPaso(dinamica.data.closes_at)) {
    return { error: 'La fecha límite ya pasó. Cámbiala en Ajustes antes de abrirla.' }
  }

  const { error } = await supabase.from('dynamics').update({ status: 'open' }).eq('id', id)

  if (error) {
    registrarFallo('abrirDinamica', { id }, error.message)
    return { error: mensajeDe(error, 'No se pudo abrir la dinámica.') }
  }

  refrescar(id)
  return {
    aviso:
      'Dinámica abierta. Cada inscrito la ve en su campana y su empresa ya puede empezar su tablero.',
  }
}

/** Cierra a mano. Los tableros quedan en solo lectura para los alumnos y los puntos cuentan. */
export async function cerrarDinamica(
  _previo: EstadoAccion,
  datos: FormData
): Promise<EstadoAccion> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  if (!id) return { error: 'Falta la dinámica.' }

  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('dynamics')
    .update({ status: 'closed' })
    .eq('id', id)
    .eq('status', 'open')
    .select('id')

  if (error) {
    registrarFallo('cerrarDinamica', { id }, error.message)
    return { error: mensajeDe(error, 'No se pudo cerrar la dinámica.') }
  }
  if (!data || data.length === 0) return { error: 'La dinámica no está abierta.' }

  refrescar(id)
  return {
    aviso:
      'Dinámica cerrada. Los tableros quedan en solo lectura para los alumnos y los puntos ya cuentan.',
  }
}

/**
 * Reabre. Si la fecha límite ya pasó exige una nueva en el mismo formulario:
 * reabrir con la fecha vencida sería abrir una dinámica que ya está cerrada.
 * Vuelve a poner `opened_at`, así que la campana avisa otra vez.
 */
export async function reabrirDinamica(
  _previo: EstadoAccion,
  datos: FormData
): Promise<EstadoAccion> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  if (!id) return { error: 'Falta la dinámica.' }

  const supabase = await crearClienteServidor()
  const { data: actual } = await supabase
    .from('dynamics')
    .select('status, closes_at')
    .eq('id', id)
    .maybeSingle()
  if (!actual) return { error: 'Esa dinámica ya no existe.' }
  if (estadoEfectivo(actual) !== 'closed') {
    return {
      error:
        actual.status === 'draft'
          ? 'La dinámica está en borrador: ábrela con «Abrir la dinámica».'
          : 'La dinámica ya está abierta.',
    }
  }

  const limite = leerFechaLimite(datos)
  if (!limite.ok) return { error: limite.error }

  const vencida = yaPaso(actual.closes_at)
  const closes_at = limite.closes_at ?? (vencida ? null : actual.closes_at)

  if (vencida && closes_at === null) {
    return { error: 'La fecha límite ya pasó. Pon una nueva para reabrirla.' }
  }
  if (yaPaso(closes_at)) {
    return { error: 'Esa fecha ya pasó. Pon una en el futuro para reabrirla.' }
  }

  // Una `open` con la fecha vencida ya es cerrada para todos; reabrirla es
  // solo moverle la fecha. El trigger no interviene porque el status no cambia.
  const { error } = await supabase
    .from('dynamics')
    .update({ status: 'open', closes_at })
    .eq('id', id)

  if (error) {
    registrarFallo('reabrirDinamica', { id }, error.message)
    return { error: mensajeDe(error, 'No se pudo reabrir la dinámica.') }
  }

  refrescar(id)
  return {
    aviso:
      'Dinámica reabierta. Vuelve a avisar en la campana y las empresas pueden seguir calificando.',
  }
}

/** Borra la dinámica con sus filas, tableros y calificaciones (cascada). */
export async function eliminarDinamica(
  _previo: EstadoAccion,
  datos: FormData
): Promise<EstadoAccion> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  if (!id) return { error: 'Falta la dinámica.' }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('dynamics').delete().eq('id', id)

  if (error) {
    registrarFallo('eliminarDinamica', { id }, error.message)
    return { error: 'No se pudo eliminar la dinámica. Inténtalo otra vez.' }
  }

  refrescar(id)
  redirect('/admin/dinamicas')
}

// --------------------------------------------------------------------------
// Filas: criterios con peso y filas informativas
// --------------------------------------------------------------------------

const esquemaFila = z.object({
  label: z
    .string()
    .trim()
    .min(1, 'La fila necesita un nombre.')
    .max(TOPE_ETIQUETA_FILA, `El nombre no puede pasar de ${TOPE_ETIQUETA_FILA} caracteres.`),
  row_kind: z.enum(TIPOS_FILA, { message: 'Elige el tipo de fila.' }),
})

/**
 * El peso según el tipo. El campo NO lleva `required` en el formulario porque
 * está oculto cuando la fila es informativa, y un `required` oculto bloquea el
 * envío sin decir por qué: aquí es donde se exige.
 */
function leerPeso(tipo: TipoFila, crudo: string): { ok: true; peso: number | null } | { ok: false; error: string } {
  if (tipo === 'informativa') return { ok: true, peso: null }

  const texto = crudo.trim()
  if (texto === '') return { ok: false, error: 'Un criterio necesita peso.' }

  const numero = Number(texto)
  if (!Number.isFinite(numero) || numero <= 0 || numero > 100) {
    return { ok: false, error: 'El peso va en por ciento: más de 0 y hasta 100.' }
  }
  return { ok: true, peso: Math.round(numero * 100) / 100 }
}

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>

async function estadoDe(supabase: Cliente, dynamicId: string) {
  const { data } = await supabase
    .from('dynamics')
    .select('status, closes_at')
    .eq('id', dynamicId)
    .maybeSingle()
  return data ? estadoEfectivo(data) : null
}

export async function crearFila(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()

  const dynamicId = String(datos.get('dynamic_id') ?? '')
  if (!dynamicId) return { error: 'Falta la dinámica.' }

  const resultado = esquemaFila.safeParse({
    label: datos.get('label'),
    row_kind: datos.get('row_kind'),
  })
  if (!resultado.success) return { error: primerError(resultado) }

  const peso = leerPeso(resultado.data.row_kind, String(datos.get('weight') ?? ''))
  if (!peso.ok) return { error: peso.error }

  const supabase = await crearClienteServidor()

  const estado = await estadoDe(supabase, dynamicId)
  if (estado === null) return { error: 'Esa dinámica ya no existe.' }
  if (estado === 'open' && resultado.data.row_kind === 'criterio') {
    return { error: `${CIERRALA} Mientras está abierta solo puedes agregar filas informativas.` }
  }

  const { data: ultima } = await supabase
    .from('dynamic_rows')
    .select('position')
    .eq('dynamic_id', dynamicId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('dynamic_rows').insert({
    dynamic_id: dynamicId,
    label: resultado.data.label,
    row_kind: resultado.data.row_kind,
    weight: peso.peso,
    position: (ultima?.position ?? 0) + 1,
  })

  if (error) {
    registrarFallo('crearFila', { dynamicId, tipo: resultado.data.row_kind }, error.message)
    return { error: mensajeDe(error, 'No se pudo agregar la fila.') }
  }

  refrescar(dynamicId)
  return { aviso: 'Fila agregada.' }
}

/**
 * Edita una fila. El nombre siempre; el tipo y el peso solo si la dinámica no
 * está abierta (y el tipo, además, solo sin celdas: eso lo dice el trigger 7d
 * con su propio mensaje).
 */
export async function actualizarFila(
  _previo: EstadoAccion,
  datos: FormData
): Promise<EstadoAccion> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  const dynamicId = String(datos.get('dynamic_id') ?? '')
  if (!id || !dynamicId) return { error: 'Falta la fila.' }

  const resultado = esquemaFila.safeParse({
    label: datos.get('label'),
    row_kind: datos.get('row_kind'),
  })
  if (!resultado.success) return { error: primerError(resultado) }

  const peso = leerPeso(resultado.data.row_kind, String(datos.get('weight') ?? ''))
  if (!peso.ok) return { error: peso.error }

  const supabase = await crearClienteServidor()

  const [estado, actual] = await Promise.all([
    estadoDe(supabase, dynamicId),
    supabase.from('dynamic_rows').select('row_kind, weight').eq('id', id).maybeSingle(),
  ])
  if (estado === null) return { error: 'Esa dinámica ya no existe.' }
  if (!actual.data) return { error: 'Esa fila ya no existe.' }

  const pesoActual = actual.data.weight === null ? null : Number(actual.data.weight)
  const cambiaCriterio =
    resultado.data.row_kind !== actual.data.row_kind || peso.peso !== pesoActual

  if (estado === 'open' && cambiaCriterio) {
    return { error: `${CIERRALA} Mientras está abierta solo se cambia el nombre de la fila.` }
  }

  const { error } = await supabase
    .from('dynamic_rows')
    .update({
      label: resultado.data.label,
      row_kind: resultado.data.row_kind,
      weight: peso.peso,
    })
    .eq('id', id)

  if (error) {
    registrarFallo('actualizarFila', { id }, error.message)
    return { error: mensajeDe(error, 'No se pudo guardar la fila.') }
  }

  refrescar(dynamicId)
  return { aviso: 'Fila guardada.' }
}

/**
 * Intercambio con la vecina, como módulos, lecciones y preguntas. En abierta
 * no se mueve nada: el orden es parte de lo que la empresa está mirando.
 */
export async function moverFila(datos: FormData): Promise<void> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  const dynamicId = String(datos.get('dynamic_id') ?? '')
  const direccion = String(datos.get('direccion') ?? '')
  if (!id || !dynamicId || (direccion !== 'arriba' && direccion !== 'abajo')) return

  const supabase = await crearClienteServidor()

  const estado = await estadoDe(supabase, dynamicId)
  if (estado === null || estado === 'open') return

  const { data: actual } = await supabase
    .from('dynamic_rows')
    .select('id, position')
    .eq('id', id)
    .maybeSingle()
  if (!actual) return

  const arriba = direccion === 'arriba'
  const consulta = supabase.from('dynamic_rows').select('id, position').eq('dynamic_id', dynamicId)
  const { data: vecina } = await (arriba
    ? consulta.lt('position', actual.position).order('position', { ascending: false })
    : consulta.gt('position', actual.position).order('position', { ascending: true })
  )
    .limit(1)
    .maybeSingle()

  if (!vecina) return

  await supabase.from('dynamic_rows').update({ position: vecina.position }).eq('id', actual.id)
  await supabase.from('dynamic_rows').update({ position: actual.position }).eq('id', vecina.id)

  refrescar(dynamicId)
}

/** Con confirmación en modal: sus celdas se van con ella (cascada). */
export async function eliminarFila(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  const dynamicId = String(datos.get('dynamic_id') ?? '')
  if (!id || !dynamicId) return { error: 'Falta la fila.' }

  const supabase = await crearClienteServidor()

  const [estado, actual] = await Promise.all([
    estadoDe(supabase, dynamicId),
    supabase.from('dynamic_rows').select('row_kind').eq('id', id).maybeSingle(),
  ])
  if (estado === null) return { error: 'Esa dinámica ya no existe.' }
  if (!actual.data) return { error: 'Esa fila ya no existe.' }
  if (estado === 'open' && actual.data.row_kind === 'criterio') {
    return { error: `${CIERRALA} Un criterio no se borra mientras está abierta.` }
  }

  const { data, error } = await supabase.from('dynamic_rows').delete().eq('id', id).select('id')

  if (error) {
    registrarFallo('eliminarFila', { id }, error.message)
    return { error: mensajeDe(error, 'No se pudo eliminar la fila. Inténtalo otra vez.') }
  }
  if (!data || data.length === 0) return { error: 'Esa fila ya no existe.' }

  refrescar(dynamicId)
  return { aviso: 'Fila eliminada.' }
}
