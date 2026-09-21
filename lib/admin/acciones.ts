'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { exigirAdmin } from '@/lib/auth/sesion'
import { crearClienteServidor } from '@/lib/supabase/server'

import { slugOcupado } from './consultas'
import {
  esquemaAjusteDeLeccion,
  esquemaCurso,
  esquemaIdDeCurso,
  esquemaLeccion,
  esquemaModulo,
  generarSlug,
} from './esquemas'
import type { EstadoAccion } from './tipos'

/**
 * Mutaciones del admin.
 *
 * Todas empiezan por `exigirAdmin()`. Es redundante con el middleware y con RLS
 * —tres barreras— y así debe ser: una server action es un endpoint público, y
 * nadie garantiza que la petición haya pasado por el middleware.
 */

const BUCKET_ADJUNTOS = 'academia-adjuntos'

function primerError(resultado: { success: boolean; error?: { issues: Array<{ message: string }> } }) {
  return resultado.error?.issues[0]?.message ?? 'Revisa los datos del formulario.'
}

function registrarFallo(operacion: string, detalle: Record<string, unknown>, error: string) {
  console.error(JSON.stringify({ operacion, ...detalle, error }))
}

function leerFormulario(datos: FormData, campos: readonly string[]) {
  const crudo: Record<string, string> = {}
  for (const campo of campos) {
    const valor = datos.get(campo)
    crudo[campo] = typeof valor === 'string' ? valor : ''
  }
  return crudo
}

const CAMPOS_CURSO = [
  'title', 'slug', 'description', 'cover_url', 'price_mxn', 'price_usd',
  'stripe_payment_link_mxn', 'stripe_payment_link_usd', 'access_days',
  'course_type', 'status', 'certificate_enabled', 'is_default',
] as const

const CAMPOS_LECCION = [
  'module_id', 'title', 'lesson_type', 'status', 'is_required',
  'description_rich', 'bunny_video_id', 'video_duration_sec',
] as const

/** Lo que se edita desde el árbol, sin abrir la lección (M14). */
const CAMPOS_AJUSTE = ['title', 'lesson_type', 'status', 'is_required'] as const

// ==========================================================================
// Cursos
// ==========================================================================

export async function crearCurso(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()

  const crudo = leerFormulario(datos, CAMPOS_CURSO)
  // El slug se deriva del título si el admin no lo escribió.
  if (!crudo.slug) crudo.slug = generarSlug(crudo.title ?? '')

  const resultado = esquemaCurso.safeParse(crudo)
  if (!resultado.success) return { error: primerError(resultado) }

  if (await slugOcupado(resultado.data.slug)) {
    return { error: `Ya existe un curso con el slug "${resultado.data.slug}".` }
  }

  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('courses')
    .insert(resultado.data)
    .select('id')
    .single()

  if (error || !data) {
    registrarFallo('crearCurso', { slug: resultado.data.slug }, error?.message ?? 'sin id')
    return { error: 'No se pudo crear el curso.' }
  }

  revalidatePath('/admin/cursos')
  redirect(`/admin/cursos/${data.id}`)
}

export async function actualizarCurso(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  if (!id) return { error: 'Falta el curso.' }

  const crudo = leerFormulario(datos, CAMPOS_CURSO)
  if (!crudo.slug) crudo.slug = generarSlug(crudo.title ?? '')

  const resultado = esquemaCurso.safeParse(crudo)
  if (!resultado.success) return { error: primerError(resultado) }

  if (await slugOcupado(resultado.data.slug, id)) {
    return { error: `Ya existe otro curso con el slug "${resultado.data.slug}".` }
  }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('courses').update(resultado.data).eq('id', id)

  if (error) {
    registrarFallo('actualizarCurso', { id }, error.message)
    return { error: 'No se pudo guardar el curso.' }
  }

  revalidatePath('/admin/cursos')
  revalidatePath(`/admin/cursos/${id}`)
  return { aviso: 'Curso guardado.' }
}

/**
 * Archiva en vez de borrar, y así se queda: un curso no se elimina nunca.
 *
 * `payments.course_id` es on delete restrict —un curso con pagos ni siquiera se
 * puede borrar— y la cascada se llevaría inscripciones, progreso y certificados
 * con folio público. Archivarlo conserva todo eso.
 *
 * Lo que archivar SÍ hace: el curso sale de la lista de activos del admin y deja
 * de ofrecerse al dar de alta (`opcionesDeAlta`). Lo que NO hace: quitárselo a
 * quien ya está inscrito, ni apagar su Payment Link en Stripe.
 */
export async function archivarCurso(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()

  const resultado = esquemaIdDeCurso.safeParse({ id: datos.get('id') })
  if (!resultado.success) return { error: primerError(resultado) }
  const { id } = resultado.data

  // `.select('id')` para saber si de verdad cambió: un update que RLS filtra no
  // da error, solo devuelve cero filas.
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('courses')
    .update({ status: 'archived' })
    .eq('id', id)
    .select('id')

  if (error || !data || data.length === 0) {
    registrarFallo('archivarCurso', { id }, error?.message ?? 'el update no afectó ninguna fila')
    return { error: 'No se pudo archivar el curso.' }
  }

  revalidatePath('/admin/cursos')
  revalidatePath(`/admin/cursos/${id}`)
  return { aviso: 'Curso archivado.' }
}

/**
 * Saca un curso del archivo. Vuelve como BORRADOR, no como publicado: el estado
 * anterior no se guarda, y que un curso reaparezca solo ante los alumnos sería
 * el peor default. Publicarlo es un paso consciente, desde su formulario.
 */
export async function restaurarCurso(datos: FormData): Promise<void> {
  await exigirAdmin()

  const resultado = esquemaIdDeCurso.safeParse({ id: datos.get('id') })
  if (!resultado.success) return
  const { id } = resultado.data

  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('courses')
    .update({ status: 'draft' })
    .eq('id', id)
    .eq('status', 'archived')

  if (error) registrarFallo('restaurarCurso', { id }, error.message)

  revalidatePath('/admin/cursos')
  revalidatePath(`/admin/cursos/${id}`)
}

// ==========================================================================
// Módulos
// ==========================================================================

export async function crearModulo(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()

  const resultado = esquemaModulo.safeParse({
    course_id: datos.get('course_id'),
    title: datos.get('title'),
  })
  if (!resultado.success) return { error: primerError(resultado) }

  const supabase = await crearClienteServidor()

  // Se coloca al final: una posición más que el último módulo del curso.
  const { data: ultimo } = await supabase
    .from('modules')
    .select('position')
    .eq('course_id', resultado.data.course_id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase
    .from('modules')
    .insert({ ...resultado.data, position: (ultimo?.position ?? 0) + 1 })

  if (error) {
    registrarFallo('crearModulo', { curso: resultado.data.course_id }, error.message)
    return { error: 'No se pudo crear el módulo.' }
  }

  revalidatePath(`/admin/cursos/${resultado.data.course_id}`)
  return { aviso: 'Módulo creado.' }
}

/**
 * Cambiarle el título a un módulo desde el árbol (M14).
 *
 * Existía desde M3 pero ningún botón la llamaba: para corregir el nombre de un
 * módulo había que borrarlo y volver a crearlo con sus lecciones.
 */
export async function renombrarModulo(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  const cursoId = String(datos.get('course_id') ?? '')
  const title = String(datos.get('title') ?? '').trim()
  if (!id) return { error: 'Falta el módulo.' }
  if (title.length < 2) return { error: 'El título necesita al menos 2 caracteres.' }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('modules').update({ title }).eq('id', id)

  if (error) {
    registrarFallo('renombrarModulo', { id }, error.message)
    return { error: 'No se pudo guardar el título. Inténtalo otra vez.' }
  }

  revalidatePath(`/admin/cursos/${cursoId}`)
  return { aviso: `Módulo guardado: ${title}` }
}

/** Con confirmación en modal (M14). Cascada: se lleva sus lecciones y todo lo que cuelgue. */
export async function eliminarModulo(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  const cursoId = String(datos.get('course_id') ?? '')
  if (!id) return { error: 'Falta el módulo.' }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('modules').delete().eq('id', id)

  if (error) {
    registrarFallo('eliminarModulo', { id }, error.message)
    return { error: 'No se pudo eliminar el módulo. Inténtalo otra vez.' }
  }

  revalidatePath(`/admin/cursos/${cursoId}`)
  return { aviso: 'Módulo eliminado.' }
}

// ==========================================================================
// Lecciones
// ==========================================================================

export async function crearLeccion(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()

  const moduleId = String(datos.get('module_id') ?? '')
  const cursoId = String(datos.get('course_id') ?? '')
  const title = String(datos.get('title') ?? '').trim()
  const tipo = String(datos.get('lesson_type') ?? 'video')

  if (!moduleId || title.length < 2) return { error: 'La lección necesita un título.' }

  const supabase = await crearClienteServidor()

  const { data: ultima } = await supabase
    .from('lessons')
    .select('position')
    .eq('module_id', moduleId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('lessons').insert({
    module_id: moduleId,
    title,
    lesson_type: tipo as 'video' | 'text' | 'quiz' | 'assignment',
    // Nace en borrador: que aparezca sola ante los alumnos sería peor default.
    status: 'draft',
    position: (ultima?.position ?? 0) + 1,
  })

  if (error) {
    registrarFallo('crearLeccion', { modulo: moduleId }, error.message)
    return { error: 'No se pudo crear la lección.' }
  }

  revalidatePath(`/admin/cursos/${cursoId}`)
  return { aviso: 'Lección creada en borrador.' }
}

export async function actualizarLeccion(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  const cursoId = String(datos.get('course_id') ?? '')
  if (!id) return { error: 'Falta la lección.' }

  const resultado = esquemaLeccion.safeParse(leerFormulario(datos, CAMPOS_LECCION))
  if (!resultado.success) return { error: primerError(resultado) }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('lessons').update(resultado.data).eq('id', id)

  if (error) {
    registrarFallo('actualizarLeccion', { id }, error.message)
    return { error: 'No se pudo guardar la lección.' }
  }

  revalidatePath(`/admin/cursos/${cursoId}`)
  revalidatePath(`/admin/lecciones/${id}`)
  return { aviso: 'Lección guardada.' }
}

/**
 * Título, tipo, estado y obligatoriedad de una lección, desde el árbol (M14).
 *
 * Es el "editar" que faltaba: hasta hoy, cambiarle el nombre a una lección o
 * publicarla obligaba a abrir su editor, una por una. Publicar un módulo de
 * quince lecciones eran quince viajes.
 *
 * NO toca `description_rich`, `bunny_video_id` ni `video_duration_sec`: esos
 * no viajan en este formulario y escribirlos vacíos borraría el contenido.
 * Para eso está el editor completo (`actualizarLeccion`).
 */
export async function ajustarLeccion(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  const cursoId = String(datos.get('course_id') ?? '')
  if (!id) return { error: 'Falta la lección.' }

  const resultado = esquemaAjusteDeLeccion.safeParse(leerFormulario(datos, CAMPOS_AJUSTE))
  if (!resultado.success) return { error: primerError(resultado) }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('lessons').update(resultado.data).eq('id', id)

  if (error) {
    registrarFallo('ajustarLeccion', { id }, error.message)
    return { error: 'No se pudo guardar la lección. Inténtalo otra vez.' }
  }

  revalidatePath(`/admin/cursos/${cursoId}`)
  revalidatePath(`/admin/lecciones/${id}`)
  return {
    aviso:
      resultado.data.status === 'published'
        ? `Guardada y publicada: ${resultado.data.title}`
        : `Guardada en borrador: ${resultado.data.title}`,
  }
}

/** Con confirmación en modal (M14): devuelve el error si lo hay; si no, vuelve al curso. */
export async function eliminarLeccion(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  const cursoId = String(datos.get('course_id') ?? '')
  if (!id) return { error: 'Falta la lección.' }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('lessons').delete().eq('id', id)

  if (error) {
    registrarFallo('eliminarLeccion', { id }, error.message)
    return { error: 'No se pudo eliminar la lección. Inténtalo otra vez.' }
  }

  revalidatePath(`/admin/cursos/${cursoId}`)
  redirect(`/admin/cursos/${cursoId}`)
}

// ==========================================================================
// Orden
//
// §3.2 dice que botones subir/bajar bastan para el MVP. El movimiento
// intercambia la posición con el vecino, así que el orden nunca queda con
// huecos ni empates.
// ==========================================================================

/**
 * Intercambia la posición con el vecino de arriba o de abajo.
 *
 * Van dos implementaciones casi iguales en vez de una genérica: el tipado de
 * PostgREST es por tabla, y una función que reciba el nombre de la tabla pierde
 * la comprobación de columnas justo donde más importa.
 */
export async function moverModulo(datos: FormData): Promise<void> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  const cursoId = String(datos.get('course_id') ?? '')
  const direccion = String(datos.get('direccion') ?? '')
  if (!id || !cursoId || (direccion !== 'arriba' && direccion !== 'abajo')) return

  const supabase = await crearClienteServidor()
  const arriba = direccion === 'arriba'

  const { data: actual } = await supabase
    .from('modules')
    .select('id, position')
    .eq('id', id)
    .maybeSingle()
  if (!actual) return

  const consulta = supabase.from('modules').select('id, position').eq('course_id', cursoId)
  const { data: vecino } = await (arriba
    ? consulta.lt('position', actual.position).order('position', { ascending: false })
    : consulta.gt('position', actual.position).order('position', { ascending: true })
  )
    .limit(1)
    .maybeSingle()

  // Ya está en el extremo: no hay con quién intercambiar.
  if (!vecino) return

  const { error: e1 } = await supabase
    .from('modules')
    .update({ position: vecino.position })
    .eq('id', actual.id)
  const { error: e2 } = await supabase
    .from('modules')
    .update({ position: actual.position })
    .eq('id', vecino.id)

  if (e1 || e2) registrarFallo('moverModulo', { id }, e1?.message ?? e2?.message ?? '')

  revalidatePath(`/admin/cursos/${cursoId}`)
}

export async function moverLeccion(datos: FormData): Promise<void> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  const moduloId = String(datos.get('padre') ?? '')
  const cursoId = String(datos.get('course_id') ?? '')
  const direccion = String(datos.get('direccion') ?? '')
  if (!id || !moduloId || (direccion !== 'arriba' && direccion !== 'abajo')) return

  const supabase = await crearClienteServidor()
  const arriba = direccion === 'arriba'

  const { data: actual } = await supabase
    .from('lessons')
    .select('id, position')
    .eq('id', id)
    .maybeSingle()
  if (!actual) return

  const consulta = supabase.from('lessons').select('id, position').eq('module_id', moduloId)
  const { data: vecino } = await (arriba
    ? consulta.lt('position', actual.position).order('position', { ascending: false })
    : consulta.gt('position', actual.position).order('position', { ascending: true })
  )
    .limit(1)
    .maybeSingle()

  if (!vecino) return

  const { error: e1 } = await supabase
    .from('lessons')
    .update({ position: vecino.position })
    .eq('id', actual.id)
  const { error: e2 } = await supabase
    .from('lessons')
    .update({ position: actual.position })
    .eq('id', vecino.id)

  if (e1 || e2) registrarFallo('moverLeccion', { id }, e1?.message ?? e2?.message ?? '')

  revalidatePath(`/admin/cursos/${cursoId}`)
}

// ==========================================================================
// Adjuntos
// ==========================================================================

export async function subirAdjunto(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()

  const leccionId = String(datos.get('lesson_id') ?? '')
  const cursoId = String(datos.get('course_id') ?? '')
  const archivo = datos.get('archivo')

  if (!leccionId) return { error: 'Falta la lección.' }
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: 'Elige un archivo.' }
  }

  const supabase = await crearClienteServidor()

  // Prefijo por lección, según la convención de academia_0015_storage.sql.
  // Se antepone la marca de tiempo para que dos archivos con el mismo nombre
  // no se pisen entre sí.
  const limpio = archivo.name.replace(/[^\w.\-]+/g, '_').slice(-120)
  const ruta = `lecciones/${leccionId}/${Date.now()}-${limpio}`

  const { error: errorSubida } = await supabase.storage
    .from(BUCKET_ADJUNTOS)
    .upload(ruta, archivo, { contentType: archivo.type || undefined, upsert: false })

  if (errorSubida) {
    registrarFallo('subirAdjunto', { leccionId, ruta }, errorSubida.message)
    return {
      error: /exceeded|maximum/i.test(errorSubida.message)
        ? 'El archivo excede el tamaño máximo permitido por el proyecto.'
        : 'No se pudo subir el archivo.',
    }
  }

  const { error } = await supabase.from('lesson_attachments').insert({
    lesson_id: leccionId,
    storage_path: ruta,
    file_name: archivo.name,
    mime_type: archivo.type || null,
    size_bytes: archivo.size,
  })

  if (error) {
    // La fila no se creó: el archivo quedaría huérfano en el bucket.
    await supabase.storage.from(BUCKET_ADJUNTOS).remove([ruta])
    registrarFallo('subirAdjunto:registro', { leccionId, ruta }, error.message)
    return { error: 'Se subió el archivo pero no se pudo registrar. Intenta de nuevo.' }
  }

  revalidatePath(`/admin/lecciones/${leccionId}`)
  revalidatePath(`/admin/cursos/${cursoId}`)
  return { aviso: `"${archivo.name}" agregado.` }
}

export async function eliminarAdjunto(datos: FormData): Promise<void> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  const leccionId = String(datos.get('lesson_id') ?? '')
  if (!id) return

  const supabase = await crearClienteServidor()

  const { data: adjunto } = await supabase
    .from('lesson_attachments')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle()

  const { error } = await supabase.from('lesson_attachments').delete().eq('id', id)
  if (error) {
    registrarFallo('eliminarAdjunto', { id }, error.message)
    return
  }

  // El archivo se borra después de la fila: si esto falla queda basura en el
  // bucket, que es menos grave que una fila apuntando a un archivo inexistente.
  if (adjunto?.storage_path) {
    await supabase.storage.from(BUCKET_ADJUNTOS).remove([adjunto.storage_path])
  }

  revalidatePath(`/admin/lecciones/${leccionId}`)
}

/**
 * URL firmada para que el admin descargue un adjunto.
 * Los buckets son privados: nunca se expone una URL directa (§4).
 */
export async function urlDeDescarga(rutaStorage: string): Promise<string | null> {
  await exigirAdmin()

  const supabase = await crearClienteServidor()
  const { data, error } = await supabase.storage
    .from(BUCKET_ADJUNTOS)
    .createSignedUrl(rutaStorage, 60 * 5)

  if (error) {
    registrarFallo('urlDeDescarga', { rutaStorage }, error.message)
    return null
  }
  return data.signedUrl
}
