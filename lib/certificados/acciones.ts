'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { exigirPerfil } from '@/lib/auth/sesion'
import { crearClienteServidor } from '@/lib/supabase/server'

import { emitirCertificado } from './emision'

export type EstadoCertificado = {
  error?: string
  aviso?: string
  folio?: string
}

/**
 * "Obtener certificado" (§3.6).
 *
 * El botón solo aparece cuando el alumno ya cumple, pero eso es cortesía de la
 * UI: la acción vuelve a revisarlo todo desde cero, con service role, sin creerle
 * nada a lo que llegue en el FormData salvo el id del curso. Y ese id se valida
 * contra RLS antes de usarlo, así que nadie pide el certificado de un curso al
 * que no está inscrito.
 */
export async function generarCertificado(
  _previo: EstadoCertificado,
  datos: FormData
): Promise<EstadoCertificado> {
  const perfil = await exigirPerfil()

  const cursoId = z.string().uuid().safeParse(datos.get('curso_id'))
  if (!cursoId.success) return { error: 'Falta el curso.' }

  // ¿Este alumno puede ver este curso? Lo decide RLS, no nosotros.
  const supabase = await crearClienteServidor()
  const { data: visible } = await supabase
    .from('courses')
    .select('id, slug')
    .eq('id', cursoId.data)
    .maybeSingle()

  if (!visible) return { error: 'No tienes acceso a este curso.' }

  const resultado = await emitirCertificado(perfil.user_id, cursoId.data)

  if (!resultado.ok) return { error: resultado.motivo }

  revalidatePath(`/curso/${visible.slug}`)
  revalidatePath('/perfil')
  revalidatePath('/mis-cursos')

  return {
    aviso: resultado.certificado.yaExistia
      ? 'Ya tenías tu certificado.'
      : '¡Listo! Tu certificado está emitido.',
    folio: resultado.certificado.folio,
  }
}
