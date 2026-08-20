'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { exigirAdmin } from '@/lib/auth/sesion'
import { crearClienteServidor } from '@/lib/supabase/server'

import type { EstadoAccion } from './tipos'

/**
 * Cohortes y sesiones en vivo (§3.10).
 *
 * Sobre la hora: el formulario captura en horario de CDMX, porque es como piensa
 * el equipo ("la sesión es a las 7 de la noche"). Se convierte a UTC aquí y se
 * guarda en `timestamptz`. La UI del alumno la vuelve a convertir a SU hora
 * local, mostrando CDMX como referencia. Nunca se guarda texto de hora local:
 * eso se rompe solo en el cambio de horario.
 */

const ZONA_CDMX = 'America/Mexico_City'

const esquemaCohorte = z.object({
  course_id: z.uuid('Curso inválido.'),
  name: z.string().trim().min(2, 'La cohorte necesita un nombre.').max(120),
  starts_on: z.string().trim().nullable(),
  ends_on: z.string().trim().nullable(),
})

const esquemaSesion = z.object({
  title: z.string().trim().min(2, 'La sesión necesita un título.').max(200),
  fecha: z.string().trim().min(10, 'Falta la fecha.'),
  hora: z.string().trim().min(4, 'Falta la hora.'),
  meet_url: z.string().trim(),
  description: z.string().trim(),
})

function primerError(resultado: { error?: { issues: Array<{ message: string }> } }) {
  return resultado.error?.issues[0]?.message ?? 'Revisa los datos.'
}

function registrarFallo(operacion: string, detalle: Record<string, unknown>, error: string) {
  console.error(JSON.stringify({ operacion, ...detalle, error }))
}

const vacioANull = (v: FormDataEntryValue | null) => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s === '' ? null : s
}

/**
 * Convierte "2026-09-21" + "19:00" en CDMX al instante UTC correspondiente.
 *
 * Se calcula el desfase real de esa zona EN ESA FECHA, en vez de restar 6 horas
 * fijas: México dejó el horario de verano en 2022, pero la biblioteca de zonas
 * conoce la historia y una fecha pasada podría caer en -5. Restar a mano
 * introduce un error de una hora que nadie nota hasta que alguien llega tarde.
 */
function cdmxAUtc(fecha: string, hora: string): string | null {
  const tentativa = new Date(`${fecha}T${hora}:00Z`)
  if (Number.isNaN(tentativa.getTime())) return null

  const formateador = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_CDMX,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const partes = Object.fromEntries(
    formateador.formatToParts(tentativa).map((p) => [p.type, p.value])
  )

  const comoSiFueraUtc = Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    Number(partes.hour === '24' ? '00' : partes.hour),
    Number(partes.minute),
    Number(partes.second)
  )

  const desfase = comoSiFueraUtc - tentativa.getTime()
  return new Date(tentativa.getTime() - desfase).toISOString()
}

// ==========================================================================
// Cohortes
// ==========================================================================

export async function crearCohorte(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()

  const resultado = esquemaCohorte.safeParse({
    course_id: datos.get('course_id'),
    name: datos.get('name'),
    starts_on: vacioANull(datos.get('starts_on')),
    ends_on: vacioANull(datos.get('ends_on')),
  })
  if (!resultado.success) return { error: primerError(resultado) }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('cohorts').insert(resultado.data)

  if (error) {
    registrarFallo('crearCohorte', { curso: resultado.data.course_id }, error.message)
    return {
      error: /cohorts_fechas_coherentes/.test(error.message)
        ? 'La fecha de fin no puede ser anterior a la de inicio.'
        : 'No se pudo crear la cohorte.',
    }
  }

  revalidatePath(`/admin/cursos/${resultado.data.course_id}`)
  return { aviso: 'Cohorte creada.' }
}

export async function eliminarCohorte(datos: FormData): Promise<void> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  const cursoId = String(datos.get('course_id') ?? '')
  if (!id) return

  // Las inscripciones NO se borran: cohort_id es `on delete set null`, así que
  // el alumno conserva su acceso y solo deja de pertenecer a un grupo.
  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('cohorts').delete().eq('id', id)

  if (error) registrarFallo('eliminarCohorte', { id }, error.message)

  revalidatePath(`/admin/cursos/${cursoId}`)
  redirect(`/admin/cursos/${cursoId}`)
}

// ==========================================================================
// Sesiones
// ==========================================================================

export async function crearSesion(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()

  const cohorteId = String(datos.get('cohort_id') ?? '')
  if (!cohorteId) return { error: 'Falta la cohorte.' }

  const resultado = esquemaSesion.safeParse({
    title: datos.get('title'),
    fecha: datos.get('fecha'),
    hora: datos.get('hora'),
    meet_url: datos.get('meet_url') ?? '',
    description: datos.get('description') ?? '',
  })
  if (!resultado.success) return { error: primerError(resultado) }

  const enUtc = cdmxAUtc(resultado.data.fecha, resultado.data.hora)
  if (!enUtc) return { error: 'La fecha o la hora no son válidas.' }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('cohort_sessions').insert({
    cohort_id: cohorteId,
    title: resultado.data.title,
    scheduled_at: enUtc,
    meet_url: resultado.data.meet_url || null,
    description: resultado.data.description || null,
  })

  if (error) {
    registrarFallo('crearSesion', { cohorteId }, error.message)
    return { error: 'No se pudo crear la sesión.' }
  }

  revalidatePath(`/admin/cohortes/${cohorteId}`)
  return { aviso: 'Sesión agendada.' }
}

export async function eliminarSesion(datos: FormData): Promise<void> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  const cohorteId = String(datos.get('cohort_id') ?? '')
  if (!id) return

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('cohort_sessions').delete().eq('id', id)

  if (error) registrarFallo('eliminarSesion', { id }, error.message)
  revalidatePath(`/admin/cohortes/${cohorteId}`)
}

/**
 * Liga (o desliga) la grabación de una sesión ya ocurrida (§3.10).
 * La grabación es una lección de tipo video del mismo curso.
 */
export async function ligarGrabacion(datos: FormData): Promise<void> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  const cohorteId = String(datos.get('cohort_id') ?? '')
  const leccionId = String(datos.get('recording_lesson_id') ?? '')
  if (!id) return

  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('cohort_sessions')
    .update({ recording_lesson_id: leccionId || null })
    .eq('id', id)

  if (error) registrarFallo('ligarGrabacion', { id, leccionId }, error.message)

  revalidatePath(`/admin/cohortes/${cohorteId}`)
}
