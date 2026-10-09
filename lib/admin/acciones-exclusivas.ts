'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { exigirEquipo } from '@/lib/auth/sesion'
import { plantillaSesionExclusiva } from '@/lib/correo/plantillas'
import { enviarCorreosEnLote } from '@/lib/correo/resend'
import { esPorGeneraciones } from '@/lib/generaciones'
import { crearClienteServidor } from '@/lib/supabase/server'

import type { EstadoAccion } from './tipos'

/**
 * Guardar la lista de acceso de una sesión exclusiva (0038, 9-oct-2026).
 *
 * El formulario manda TODA la lista como debe quedar —las casillas marcadas—,
 * no los cambios. Aquí se compara con la guardada: se agrega a quien no
 * estaba, se quita a quien ya no está marcado y se cambia el interruptor de
 * «exclusiva». Así se puede regresar cuantas veces se quiera a agregar o quitar
 * a cualquiera, que es lo que pidió Alejandro.
 *
 * Correo: solo a los que se AGREGAN en este guardado y solo si se marcó
 * «avisar». Quien ya estaba no recibe nada otra vez. Un fallo de correo nunca
 * deshace la lista: se guarda primero y el aviso se intenta después.
 *
 * Quién puede lo exige también la base (`module_members_*_equipo`,
 * `modules_solo_exclusiva`, `module_members_inscrito`).
 */

const esquema = z.object({
  modulo_id: z.string().uuid(),
  exclusiva: z.boolean(),
  avisar: z.boolean(),
  miembros: z.array(z.string().uuid()).max(2000),
})

function registrar(operacion: string, detalle: Record<string, unknown>) {
  console.error(JSON.stringify({ operacion, ...detalle }))
}

export async function guardarAccesoExclusivo(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const perfil = await exigirEquipo()

  const r = esquema.safeParse({
    modulo_id: datos.get('modulo_id'),
    exclusiva: datos.get('exclusiva') === 'si',
    avisar: datos.get('avisar') === 'si',
    miembros: [...new Set(datos.getAll('miembros').map(String))],
  })
  if (!r.success) return { error: 'Revisa la lista: algo no llegó bien.' }
  const { modulo_id: moduloId, exclusiva, avisar, miembros } = r.data

  const supabase = await crearClienteServidor()
  const { data: modulo } = await supabase
    .from('modules')
    .select('id, title, is_restricted, course_id, cohort_id, courses(title, slug, course_type)')
    .eq('id', moduloId)
    .maybeSingle()
  if (!modulo) return { error: 'Esa sesión ya no existe.' }
  type Modulo = {
    id: string
    title: string
    is_restricted: boolean
    course_id: string
    cohort_id: string | null
    courses: { title: string; slug: string; course_type: string } | null
  }
  const m = modulo as unknown as Modulo

  // Solo se puede elegir entre los inscritos de la generación (o del curso).
  const inscritosQ = supabase
    .from('enrollments')
    .select('user_id, profiles(full_name, email, role)')
    .eq('course_id', m.course_id)
  const [{ data: inscritos }, { data: actuales }] = await Promise.all([
    esPorGeneraciones(m.courses?.course_type) && m.cohort_id ? inscritosQ.eq('cohort_id', m.cohort_id) : inscritosQ,
    supabase.from('module_members').select('user_id').eq('module_id', moduloId),
  ])
  type Inscrito = { user_id: string; profiles: { full_name: string; email: string; role: string } | null }
  const elegibles = new Map(
    ((inscritos ?? []) as unknown as Inscrito[])
      .filter((i) => i.profiles?.role === 'alumno')
      .map((i) => [i.user_id, i.profiles!])
  )
  const fuera = miembros.filter((id) => !elegibles.has(id))
  if (fuera.length > 0) {
    return { error: 'Alguien de la lista ya no está inscrito en esta generación. Recarga la página y vuelve a elegir.' }
  }

  const antes = new Set((actuales ?? []).map((a) => a.user_id))
  const despues = new Set(miembros)
  const agregar = miembros.filter((id) => !antes.has(id))
  const quitar = [...antes].filter((id) => !despues.has(id))

  // 1. La lista. Primero quitar, luego agregar: si algo falla a medias, nadie
  //    ganó un acceso que no debía.
  if (quitar.length > 0) {
    const { error } = await supabase.from('module_members').delete().eq('module_id', moduloId).in('user_id', quitar)
    if (error) {
      registrar('guardarAccesoExclusivo:quitar', { moduloId, quitar: quitar.length, error: error.message })
      return { error: 'No se pudo quitar a las personas de la lista. Inténtalo otra vez.' }
    }
  }
  if (agregar.length > 0) {
    const { error } = await supabase
      .from('module_members')
      .insert(agregar.map((user_id) => ({ module_id: moduloId, user_id, added_by: perfil.user_id })))
    if (error) {
      registrar('guardarAccesoExclusivo:agregar', { moduloId, agregar: agregar.length, error: error.message })
      return { error: 'No se pudo agregar a las personas a la lista. Inténtalo otra vez.' }
    }
  }

  // 2. El interruptor.
  if (exclusiva !== m.is_restricted) {
    const { error } = await supabase.from('modules').update({ is_restricted: exclusiva }).eq('id', moduloId)
    if (error) {
      registrar('guardarAccesoExclusivo:exclusiva', { moduloId, exclusiva, error: error.message })
      return { error: 'La lista se guardó, pero no se pudo cambiar si la sesión es exclusiva. Inténtalo otra vez.' }
    }
  }

  // 3. El aviso, solo a los nuevos y solo si la sesión es exclusiva: avisar
  //    «tienes acceso a una sesión exclusiva» de una sesión abierta a todos no
  //    dice nada.
  let avisados = 0
  let avisoFallido = false
  if (avisar && exclusiva && agregar.length > 0 && m.courses) {
    const curso = m.courses
    const correos = agregar.flatMap((id) => {
      const p = elegibles.get(id)
      if (!p) return []
      const plantilla = plantillaSesionExclusiva({
        sesion: m.title,
        curso: curso.title,
        cursoSlug: curso.slug,
        nombre: p.full_name,
        base: process.env.NEXT_PUBLIC_APP_URL,
      })
      return [{ para: p.email, asunto: plantilla.asunto, html: plantilla.html, texto: plantilla.texto }]
    })
    const envio = await enviarCorreosEnLote(correos)
    avisados = envio.enviados
    avisoFallido = envio.fallidos.length > 0
    const fallidos = new Set(envio.fallidos)
    const avisadosIds = agregar.filter((id) => {
      const correo = elegibles.get(id)?.email
      return correo && !fallidos.has(correo)
    })
    if (avisadosIds.length > 0) {
      await supabase
        .from('module_members')
        .update({ notified_at: new Date().toISOString() })
        .eq('module_id', moduloId)
        .in('user_id', avisadosIds)
    }
  }

  console.log(
    JSON.stringify({
      operacion: 'guardarAccesoExclusivo',
      porQuien: perfil.email,
      moduloId,
      exclusiva,
      agregados: agregar.length,
      quitados: quitar.length,
      enLista: despues.size,
      avisados,
    })
  )

  revalidatePath(`/admin/modulos/${moduloId}/acceso`)
  revalidatePath(`/admin/cursos/${m.course_id}`)
  revalidatePath('/curso/[slug]', 'layout')

  const partes = [
    `${despues.size} ${despues.size === 1 ? 'persona' : 'personas'} con acceso`,
    agregar.length > 0 ? `${agregar.length} ${agregar.length === 1 ? 'agregada' : 'agregadas'}` : null,
    quitar.length > 0 ? `${quitar.length} ${quitar.length === 1 ? 'quitada' : 'quitadas'}` : null,
    avisados > 0 ? `correo a ${avisados}` : null,
  ].filter(Boolean)
  const estado = exclusiva ? 'La sesión es exclusiva' : 'La sesión está abierta a toda la generación'
  return {
    aviso: `Guardado. ${estado}: ${partes.join(' · ')}.${avisoFallido ? ' Algunos correos no salieron; revisa las direcciones.' : ''}`,
  }
}
