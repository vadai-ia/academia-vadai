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

const esquema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Escribe el correo.')
    .email('Ese correo no parece válido.')
    .transform((v) => v.toLowerCase()),
  nombre: z.string().trim().max(160),
  course_id: z.uuid('Elige un curso.'),
  cohort_id: z.string().trim(),
})

export async function altaManual(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()

  const resultado = esquema.safeParse({
    email: datos.get('email'),
    nombre: datos.get('nombre') ?? '',
    course_id: datos.get('course_id'),
    cohort_id: datos.get('cohort_id') ?? '',
  })

  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? 'Revisa los datos.' }
  }

  const alta = await darDeAlta({
    email: resultado.data.email,
    nombre: resultado.data.nombre || null,
    courseId: resultado.data.course_id,
    cohortId: resultado.data.cohort_id || null,
    origen: 'manual',
    urlRedireccion: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/nueva-contrasena`,
  })

  if (!alta.ok) {
    return { error: alta.motivo ?? 'No se pudo dar de alta.' }
  }

  revalidatePath('/admin/alumnos')

  if (!alta.creado) {
    return { aviso: `${resultado.data.email} ya tenía cuenta; se le agregó la inscripción.` }
  }

  // La cuenta y la inscripción existen aunque el correo no haya salido. Se dice
  // sin rodeos, porque significa que hay que hacer algo: sin ese correo la
  // persona no puede entrar.
  return alta.invitado
    ? { aviso: `${resultado.data.email} dado de alta. Le llegó el correo para definir su contraseña.` }
    : {
        error:
          `${resultado.data.email} quedó dado de alta CON su inscripción, pero el correo no salió. ` +
          'Revisa el SMTP en Supabase y usa "Reenviar acceso" cuando funcione.',
      }
}

/** Reintenta el correo de acceso para alguien ya dado de alta. */
export async function reenviarAcceso(datos: FormData): Promise<void> {
  await exigirAdmin()

  const email = String(datos.get('email') ?? '').trim().toLowerCase()
  if (!email) return

  const enviado = await enviarAccesoInicial(
    email,
    `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/nueva-contrasena`
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
