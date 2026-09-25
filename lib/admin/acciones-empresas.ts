'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { empresaPorNombre } from '@/lib/admin/empresas'
import { exigirAdmin } from '@/lib/auth/sesion'
import { crearClienteServidor } from '@/lib/supabase/server'

import type { EstadoAccion } from './tipos'

const esquemaNombre = z
  .string()
  .trim()
  .min(2, 'El nombre necesita al menos 2 caracteres.')
  .max(120, 'El nombre es demasiado largo.')

function revalidarTodo() {
  revalidatePath('/admin/empresas')
  revalidatePath('/admin/alumnos')
  revalidatePath('/admin/cursos')
}

export async function crearEmpresa(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()

  const nombre = esquemaNombre.safeParse(datos.get('nombre'))
  if (!nombre.success) return { error: nombre.error.issues[0]?.message ?? 'Revisa el nombre.' }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('companies').insert({ name: nombre.data })

  if (error) {
    // 23505 es el índice único por minúsculas: ya existe con otras mayúsculas.
    if (error.code === '23505') return { error: `"${nombre.data}" ya existe.` }
    console.error(JSON.stringify({ operacion: 'crearEmpresa', nombre: nombre.data, error: error.message }))
    return { error: 'No se pudo crear la empresa.' }
  }

  revalidarTodo()
  return { aviso: `"${nombre.data}" creada.` }
}

export async function renombrarEmpresa(datos: FormData): Promise<void> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  const nombre = esquemaNombre.safeParse(datos.get('nombre'))
  if (!id || !nombre.success) return

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('companies').update({ name: nombre.data }).eq('id', id)
  if (error) console.error(JSON.stringify({ operacion: 'renombrarEmpresa', id, error: error.message }))

  revalidarTodo()
}

/**
 * Borra la empresa. Sus alumnos NO se borran: quedan en "General" (la clave
 * foránea es `on delete set null`). Por eso pide confirmación y lo dice.
 *
 * Lo que sí la detiene son sus tableros de dinámicas (M13): ahí la clave
 * foránea es `restrict`, porque borrar una empresa con tableros sería perder la
 * matriz de un equipo en silencio. El 23503 se traduce a qué hacer antes.
 */
export async function eliminarEmpresa(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  if (!id) return { error: 'Falta la empresa.' }

  const supabase = await crearClienteServidor()
  const { data: fila } = await supabase.from('companies').select('name').eq('id', id).maybeSingle()
  const { error } = await supabase.from('companies').delete().eq('id', id)

  if (error) {
    if (error.code === '23503') {
      return {
        error: `"${fila?.name ?? 'La empresa'}" tiene tableros en una dinámica. Descarga su Excel o borra los tableros antes de borrar la empresa.`,
      }
    }
    console.error(JSON.stringify({ operacion: 'eliminarEmpresa', id, error: error.message }))
    return { error: 'No se pudo borrar la empresa.' }
  }

  revalidarTodo()
  return { aviso: `"${fila?.name ?? 'La empresa'}" se borró. Sus alumnos quedaron en General.` }
}

/**
 * Cambia (o quita) la empresa de una persona. Vacío = General.
 *
 * `company_nueva` (21-sep-2026, pedido de Roberto): si viene un nombre, se
 * crea la empresa ahí mismo —o se reúsa si ya existe— y se asigna. Así no
 * hay que ir a Empresas, crearla y volver.
 */
async function cambiarEmpresa(datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()

  const userId = String(datos.get('user_id') ?? '')
  const nueva = String(datos.get('company_nueva') ?? '').trim()
  let empresa = String(datos.get('company_id') ?? '')
  if (!userId) return { error: 'Falta la cuenta.' }

  if (nueva) {
    const id = await empresaPorNombre(nueva)
    if (!id) return { error: `No se pudo crear la empresa "${nueva}".` }
    empresa = id
  }

  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('profiles')
    .update({ company_id: empresa || null })
    .eq('user_id', userId)
    .select('user_id')

  if (error || !data || data.length === 0) {
    console.error(
      JSON.stringify({ operacion: 'cambiarEmpresaDeAlumno', userId, empresa, error: error?.message ?? 'sin filas' })
    )
    return { error: 'No se pudo guardar la empresa.' }
  }

  const { data: fila } = empresa
    ? await supabase.from('companies').select('name').eq('id', empresa).maybeSingle()
    : { data: null }

  revalidarTodo()
  const cursoId = String(datos.get('course_id') ?? '')
  if (cursoId) revalidatePath(`/admin/cursos/${cursoId}`)

  return { aviso: fila?.name ? `Empresa guardada: ${fila.name}.` : 'Quedó en General, sin empresa.' }
}

/** Para formularios directos (<form action>): sin aviso en pantalla. */
export async function cambiarEmpresaDeAlumno(datos: FormData): Promise<void> {
  await cambiarEmpresa(datos)
}

/** Para `useActionState`: devuelve el aviso, que es lo que faltaba en la fila. */
export async function cambiarEmpresaDeAlumnoConAviso(
  _previo: EstadoAccion,
  datos: FormData
): Promise<EstadoAccion> {
  return cambiarEmpresa(datos)
}
