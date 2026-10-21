'use server'

import { createHash } from 'node:crypto'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { z } from 'zod'

import { utcACdmx } from '@/lib/admin/fechas'
import { richText } from '@/lib/admin/esquemas'
import type { EstadoAccion } from '@/lib/admin/tipos'
import type { LlamadaRpc } from '@/lib/alumno/catalogo'
import { exigirAdmin, exigirEquipo } from '@/lib/auth/sesion'
import { BUCKET_DEL_MURO, subirImagen } from '@/lib/comunidad/imagenes'
import { crearClienteServidor } from '@/lib/supabase/server'
import { casaDelPanel, contenidoDelPanel, type ContenidoDelPanel } from '@/lib/vaip/admin'
import { dibujarPortada } from '@/lib/vaip/portada'
import { PANEL_CLASES, PANEL_HERRAMIENTAS, slugDeEtiqueta } from '@/lib/vaip/rutas'

/**
 * Subir y cuidar el contenido de V-AI-P (M26, 21-oct-2026): las clases
 * grabadas, por mes, y las herramientas, con sus etiquetas y su portada.
 *
 * Admin Y community manager suben, editan y publican (decisión de Alejandro);
 * borrar es solo de admin. Crear pasa por las tres RPC de 0048, que exigen
 * `is_equipo` y que el curso sea la casa de un plan: el insert directo en
 * `lessons` sigue siendo de admin. Todo con la sesión de quien actúa.
 *
 * La casa nunca viene del formulario: sale del plan del espacio
 * (`casaDelPanel`), así un formulario alterado no sube nada a otro curso.
 */

const uuid = z.uuid()
const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Elige la fecha de la clase.')
  .refine((v) => !Number.isNaN(new Date(`${v}T12:00:00Z`).getTime()), 'Esa fecha no existe.')

function registrar(operacion: string, detalle: Record<string, unknown>) {
  console.error(JSON.stringify({ operacion, ...detalle }))
}

/** Los errores que levanta la base en 0048 ya vienen en español y se pueden mostrar. */
function mensajeDe(error: { message: string; code?: string }, porOmision: string): string {
  return error.code === '22023' || error.code === '23514' || error.code === '42501' ? error.message : porOmision
}

/** Lo que cambia cuando cambia el contenido: el panel, sus números y el portal. */
function revalidarContenido() {
  revalidatePath(PANEL_CLASES)
  revalidatePath(PANEL_HERRAMIENTAS)
  revalidatePath('/vaip')
  revalidatePath('/vaip/clases', 'layout')
  revalidatePath('/vaip/herramientas', 'layout')
  // Los números de la barra lateral (Clases sin grabación).
  revalidatePath('/admin', 'layout')
}

// ==========================================================================
// Grabaciones
// ==========================================================================

const esquemaSubir = z.object({
  clase: z.union([uuid, z.literal('ninguna'), z.literal('')]),
  fecha: z.union([fecha, z.literal('')]),
  titulo: z.string().trim().max(200, 'El título es demasiado largo.'),
})

/** «Subir grabación»: crea la grabación en borrador, en su mes, y abre su editor para subir el video. */
export async function subirGrabacion(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirEquipo()
  const r = esquemaSubir.safeParse({
    clase: datos.get('clase') ?? '',
    fecha: datos.get('fecha') ?? '',
    titulo: datos.get('titulo') ?? '',
  })
  if (!r.success) return { error: r.error.issues[0]?.message ?? 'Revisa la grabación.' }

  const lugar = await casaDelPanel()
  if (!lugar) return { error: 'V-AI-P todavía no tiene casa.' }

  const supabase = await crearClienteServidor()
  const sesionId = r.data.clase && r.data.clase !== 'ninguna' ? r.data.clase : null
  let dia = r.data.fecha
  if (sesionId) {
    // La fecha de una clase del calendario es la suya, en hora de la Ciudad de México.
    const { data: sesion } = await supabase.from('cohort_sessions').select('scheduled_at').eq('id', sesionId).maybeSingle()
    if (!sesion) return { error: 'Esa clase ya no existe.' }
    dia = utcACdmx(sesion.scheduled_at).fecha
  }
  if (!dia) return { error: 'Elige la clase o la fecha de la grabación.' }

  const rpc = (supabase.rpc as unknown as LlamadaRpc).bind(supabase)
  const { data: id, error } = await rpc('academia_vaip_nueva_grabacion', {
    p_casa: lugar.casa.id,
    p_fecha: dia,
    p_titulo: r.data.titulo || null,
    p_sesion: sesionId,
  })
  if (error || typeof id !== 'string') {
    registrar('subirGrabacion', { casa: lugar.casa.id, dia, sesionId, error: error?.message })
    return { error: error ? mensajeDe(error, 'No se pudo crear la grabación.') : 'No se pudo crear la grabación.' }
  }

  revalidarContenido()
  redirect(`${PANEL_CLASES}/${id}`)
}

const esquemaGrabacion = z.object({
  id: uuid,
  titulo: z.string().trim().min(2, 'El título necesita al menos 2 caracteres.').max(200, 'El título es demasiado largo.'),
  fecha,
  descripcion: richText,
})

/** El editor de la grabación: título, fecha (la mueve de mes) y descripción. */
export async function guardarGrabacion(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirEquipo()
  const r = esquemaGrabacion.safeParse({
    id: datos.get('id'),
    titulo: datos.get('titulo'),
    fecha: datos.get('fecha'),
    descripcion: datos.get('descripcion') ?? '',
  })
  if (!r.success) return { error: r.error.issues[0]?.message ?? 'Revisa la grabación.' }

  const actual = await contenidoDelPanel(r.data.id)
  if (!actual || actual.tipo !== 'mes') return { error: 'Esa grabación ya no existe.' }

  const supabase = await crearClienteServidor()
  if (actual.fecha !== r.data.fecha) {
    const rpc = (supabase.rpc as unknown as LlamadaRpc).bind(supabase)
    const { error } = await rpc('academia_vaip_fechar_grabacion', { p_leccion: actual.id, p_fecha: r.data.fecha })
    if (error) {
      registrar('guardarGrabacion:fecha', { id: actual.id, fecha: r.data.fecha, error: error.message })
      return { error: mensajeDe(error, 'No se pudo cambiar la fecha.') }
    }
  }

  const { error } = await supabase
    .from('lessons')
    .update({ title: r.data.titulo, description_rich: r.data.descripcion })
    .eq('id', actual.id)
  if (error) {
    registrar('guardarGrabacion', { id: actual.id, error: error.message })
    return { error: mensajeDe(error, 'No se pudo guardar la grabación.') }
  }

  revalidarContenido()
  return { aviso: 'Guardada.' }
}

// ==========================================================================
// Publicar, despublicar y eliminar (grabaciones y herramientas)
// ==========================================================================

const esquemaPublicar = z.object({ id: uuid, publicar: z.enum(['si', 'no']) })

/** Publicar o regresar a borrador. Sin video la base se niega, y el mensaje lo dice. */
export async function cambiarPublicacion(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirEquipo()
  const r = esquemaPublicar.safeParse({ id: datos.get('id'), publicar: datos.get('publicar') })
  if (!r.success) return { error: 'No se pudo cambiar.' }

  const actual = await contenidoDelPanel(r.data.id)
  if (!actual) return { error: 'Ya no existe.' }
  const publicar = r.data.publicar === 'si'
  if (publicar && !actual.videoId) return { error: 'Sube el video antes de publicar.' }

  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('lessons')
    .update({ status: publicar ? 'published' : 'draft' })
    .eq('id', actual.id)
  if (error) {
    registrar('cambiarPublicacion', { id: actual.id, publicar, error: error.message })
    return { error: mensajeDe(error, 'No se pudo cambiar.') }
  }

  revalidarContenido()
  const que = actual.tipo === 'mes' ? 'grabación' : 'herramienta'
  return { aviso: publicar ? `Publicada. Los miembros ya ven la ${que}.` : `La ${que} regresó a borrador: los miembros ya no la ven.` }
}

/** Eliminar: solo admin (la RLS de `lessons` también lo exige). */
export async function eliminarContenido(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()
  const id = uuid.safeParse(datos.get('id'))
  if (!id.success) return { error: 'No se pudo eliminar.' }
  const actual = await contenidoDelPanel(id.data)
  if (!actual) return { error: 'Ya no existe.' }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('lessons').delete().eq('id', actual.id)
  if (error) {
    registrar('eliminarContenido', { id: actual.id, error: error.message })
    return { error: 'No se pudo eliminar. Intenta de nuevo.' }
  }
  if (actual.portadaRuta) await supabase.storage.from(BUCKET_DEL_MURO).remove([actual.portadaRuta])

  revalidarContenido()
  redirect(actual.tipo === 'mes' ? PANEL_CLASES : PANEL_HERRAMIENTAS)
}

// ==========================================================================
// Herramientas
// ==========================================================================

/** Las etiquetas activas de la casa, en su orden: la primera de una herramienta va en su portada. */
async function etiquetasActivas(casaId: string): Promise<Array<{ id: string; nombre: string }>> {
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('tool_tags')
    .select('id, name')
    .eq('course_id', casaId)
    .eq('archived', false)
    .order('position')
    .order('name')
  return (data ?? []).map((t) => ({ id: t.id, nombre: t.name }))
}

/**
 * Dibuja la portada y la guarda. NUNCA impide guardar la herramienta: si algo
 * falla se registra, la tarjeta cae a un fondo de color y el editor ofrece
 * «Volver a dibujar». Cada dibujo va a una ruta nueva (con el hash del PNG) y
 * el archivo anterior se borra: así nadie ve una portada vieja en caché.
 */
async function dibujarYGuardarPortada(
  h: Pick<ContenidoDelPanel, 'id' | 'titulo' | 'orientacion' | 'portadaRuta' | 'cursoId'>,
  etiquetaIds: string[]
): Promise<boolean> {
  try {
    const activas = await etiquetasActivas(h.cursoId)
    const primera = activas.find((e) => etiquetaIds.includes(e.id))?.nombre ?? null
    const png = await dibujarPortada({ titulo: h.titulo, etiqueta: primera, orientacion: h.orientacion })
    const huella = createHash('sha256').update(png).digest('hex').slice(0, 10)

    const supabase = await crearClienteServidor()
    const subida = await subirImagen(supabase, png, `vaip/herramientas/${h.cursoId}`, `${h.id}-${huella}`)
    if ('error' in subida) {
      registrar('portada:subir', { id: h.id, error: subida.error })
      return false
    }
    if (subida.storage_path === h.portadaRuta) return true
    const { error } = await supabase.from('lessons').update({ cover_path: subida.storage_path }).eq('id', h.id)
    if (error) {
      registrar('portada:guardar', { id: h.id, error: error.message })
      await supabase.storage.from(BUCKET_DEL_MURO).remove([subida.storage_path])
      return false
    }
    if (h.portadaRuta) await supabase.storage.from(BUCKET_DEL_MURO).remove([h.portadaRuta])
    return true
  } catch (e) {
    registrar('portada:dibujar', { id: h.id, error: e instanceof Error ? e.message : String(e) })
    return false
  }
}

/** Crea la etiqueta que se escribió en «Nueva etiqueta» (o reusa la que ya se llama así). */
async function etiquetaNueva(casaId: string, nombre: string): Promise<{ id: string } | { error: string }> {
  const limpio = nombre.trim().replace(/\s+/g, ' ')
  if (limpio.length < 2 || limpio.length > 40) return { error: 'La etiqueta lleva de 2 a 40 caracteres.' }
  const slug = slugDeEtiqueta(limpio)
  if (slug.length < 2) return { error: 'Ese nombre no sirve para una etiqueta.' }

  const supabase = await crearClienteServidor()
  const { data: existente } = await supabase
    .from('tool_tags')
    .select('id, archived')
    .eq('course_id', casaId)
    .eq('slug', slug)
    .maybeSingle()
  if (existente) {
    if (existente.archived) await supabase.from('tool_tags').update({ archived: false }).eq('id', existente.id)
    return { id: existente.id }
  }
  const { count } = await supabase.from('tool_tags').select('id', { count: 'exact', head: true }).eq('course_id', casaId)
  const { data, error } = await supabase
    .from('tool_tags')
    .insert({ course_id: casaId, name: limpio, slug, position: (count ?? 0) + 1 })
    .select('id')
    .single()
  if (error || !data) {
    registrar('etiquetaNueva', { casaId, slug, error: error?.message })
    return { error: 'No se pudo crear la etiqueta.' }
  }
  return { id: data.id }
}

/** Deja exactamente esas etiquetas en la herramienta. */
async function ponerEtiquetas(leccionId: string, ids: string[], antes: string[]): Promise<string | null> {
  const supabase = await crearClienteServidor()
  const quitar = antes.filter((x) => !ids.includes(x))
  const poner = ids.filter((x) => !antes.includes(x))
  if (quitar.length) {
    const { error } = await supabase.from('lesson_tool_tags').delete().eq('lesson_id', leccionId).in('tag_id', quitar)
    if (error) return error.message
  }
  if (poner.length) {
    const { error } = await supabase.from('lesson_tool_tags').insert(poner.map((tag_id) => ({ lesson_id: leccionId, tag_id })))
    if (error) return error.message
  }
  return null
}

const esquemaHerramienta = z.object({
  titulo: z.string().trim().min(3, 'El título necesita al menos 3 caracteres.').max(200, 'El título es demasiado largo.'),
  descripcion: richText,
  orientacion: z.enum(['vertical', 'horizontal'], { message: 'Elige si el video es vertical u horizontal.' }),
  etiquetas: z.array(uuid).max(12, 'Hasta 12 etiquetas.'),
  nueva: z.string().trim().max(40, 'La etiqueta lleva hasta 40 caracteres.'),
})

function leerHerramienta(datos: FormData) {
  return esquemaHerramienta.safeParse({
    titulo: datos.get('titulo'),
    descripcion: datos.get('descripcion') ?? '',
    orientacion: datos.get('orientacion'),
    etiquetas: datos.getAll('etiqueta').map(String),
    nueva: datos.get('nueva_etiqueta') ?? '',
  })
}

/** «Nueva herramienta»: la crea en borrador con sus etiquetas y su portada, y abre su editor para subir el video. */
export async function nuevaHerramienta(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirEquipo()
  const r = leerHerramienta(datos)
  if (!r.success) return { error: r.error.issues[0]?.message ?? 'Revisa la herramienta.' }
  const lugar = await casaDelPanel()
  if (!lugar) return { error: 'V-AI-P todavía no tiene casa.' }

  const etiquetas = [...r.data.etiquetas]
  if (r.data.nueva) {
    const nueva = await etiquetaNueva(lugar.casa.id, r.data.nueva)
    if ('error' in nueva) return { error: nueva.error }
    if (!etiquetas.includes(nueva.id)) etiquetas.push(nueva.id)
  }

  const supabase = await crearClienteServidor()
  const rpc = (supabase.rpc as unknown as LlamadaRpc).bind(supabase)
  const { data: id, error } = await rpc('academia_vaip_nueva_herramienta', {
    p_casa: lugar.casa.id,
    p_titulo: r.data.titulo,
    p_orientacion: r.data.orientacion,
  })
  if (error || typeof id !== 'string') {
    registrar('nuevaHerramienta', { casa: lugar.casa.id, error: error?.message })
    return { error: error ? mensajeDe(error, 'No se pudo crear la herramienta.') : 'No se pudo crear la herramienta.' }
  }

  if (r.data.descripcion) {
    const { error: e } = await supabase.from('lessons').update({ description_rich: r.data.descripcion }).eq('id', id)
    if (e) registrar('nuevaHerramienta:descripcion', { id, error: e.message })
  }
  const fallo = await ponerEtiquetas(id, etiquetas, [])
  if (fallo) registrar('nuevaHerramienta:etiquetas', { id, error: fallo })
  await dibujarYGuardarPortada(
    { id, titulo: r.data.titulo, orientacion: r.data.orientacion, portadaRuta: null, cursoId: lugar.casa.id },
    etiquetas
  )

  revalidarContenido()
  redirect(`${PANEL_HERRAMIENTAS}/${id}`)
}

/** El editor de la herramienta. Si cambian el título, las etiquetas o la orientación, se vuelve a dibujar la portada. */
export async function guardarHerramienta(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirEquipo()
  const id = uuid.safeParse(datos.get('id'))
  if (!id.success) return { error: 'Esa herramienta ya no existe.' }
  const r = leerHerramienta(datos)
  if (!r.success) return { error: r.error.issues[0]?.message ?? 'Revisa la herramienta.' }
  const actual = await contenidoDelPanel(id.data)
  if (!actual || actual.tipo !== 'herramientas') return { error: 'Esa herramienta ya no existe.' }

  const etiquetas = [...r.data.etiquetas]
  if (r.data.nueva) {
    const nueva = await etiquetaNueva(actual.cursoId, r.data.nueva)
    if ('error' in nueva) return { error: nueva.error }
    if (!etiquetas.includes(nueva.id)) etiquetas.push(nueva.id)
  }

  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('lessons')
    .update({ title: r.data.titulo, description_rich: r.data.descripcion, orientation: r.data.orientacion })
    .eq('id', actual.id)
  if (error) {
    registrar('guardarHerramienta', { id: actual.id, error: error.message })
    return { error: mensajeDe(error, 'No se pudo guardar la herramienta.') }
  }
  const fallo = await ponerEtiquetas(actual.id, etiquetas, actual.etiquetas)
  if (fallo) {
    registrar('guardarHerramienta:etiquetas', { id: actual.id, error: fallo })
    return { error: 'Se guardó, pero no se pudieron cambiar las etiquetas. Intenta de nuevo.' }
  }

  const mismasEtiquetas = etiquetas.length === actual.etiquetas.length && etiquetas.every((x) => actual.etiquetas.includes(x))
  const cambioLaPortada =
    !actual.portadaRuta || actual.titulo !== r.data.titulo || actual.orientacion !== r.data.orientacion || !mismasEtiquetas
  const dibujada = cambioLaPortada
    ? await dibujarYGuardarPortada({ ...actual, titulo: r.data.titulo, orientacion: r.data.orientacion }, etiquetas)
    : true

  revalidarContenido()
  return dibujada ? { aviso: 'Guardada.' } : { aviso: 'Guardada. La portada no se pudo dibujar: usa «Volver a dibujar la portada».' }
}

/** «Volver a dibujar la portada». */
export async function redibujarPortada(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirEquipo()
  const id = uuid.safeParse(datos.get('id'))
  if (!id.success) return { error: 'Esa herramienta ya no existe.' }
  const actual = await contenidoDelPanel(id.data)
  if (!actual || actual.tipo !== 'herramientas') return { error: 'Esa herramienta ya no existe.' }
  const ok = await dibujarYGuardarPortada(actual, actual.etiquetas)
  revalidarContenido()
  return ok ? { aviso: 'Portada nueva.' } : { error: 'No se pudo dibujar la portada. Intenta en un momento.' }
}

// ==========================================================================
// Etiquetas
// ==========================================================================

/**
 * Las herramientas que llevan una etiqueta, con su portada vuelta a dibujar:
 * la portada pinta el nombre de la primera etiqueta activa. Va en `after()`
 * para no hacer esperar el formulario.
 */
function redibujarLasDe(etiquetaId: string) {
  after(async () => {
    const supabase = await crearClienteServidor()
    const { data } = await supabase.from('lesson_tool_tags').select('lesson_id').eq('tag_id', etiquetaId).limit(60)
    for (const fila of data ?? []) {
      const h = await contenidoDelPanel(fila.lesson_id)
      if (h?.tipo === 'herramientas') await dibujarYGuardarPortada(h, h.etiquetas)
    }
  })
}

export async function crearEtiqueta(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirEquipo()
  const lugar = await casaDelPanel()
  if (!lugar) return { error: 'V-AI-P todavía no tiene casa.' }
  const nombre = String(datos.get('nombre') ?? '')
  const supabase = await crearClienteServidor()
  const { data: ya } = await supabase
    .from('tool_tags')
    .select('id, archived')
    .eq('course_id', lugar.casa.id)
    .eq('slug', slugDeEtiqueta(nombre))
    .maybeSingle()
  if (ya && !ya.archived) return { error: 'Ya hay una etiqueta con ese nombre.' }
  const r = await etiquetaNueva(lugar.casa.id, nombre)
  if ('error' in r) return { error: r.error }
  if (ya) redibujarLasDe(r.id)
  revalidatePath(PANEL_HERRAMIENTAS)
  revalidatePath('/vaip/herramientas', 'layout')
  return { aviso: ya ? 'La etiqueta estaba archivada y se reactivó.' : 'Etiqueta creada.' }
}

const esquemaRenombrar = z.object({
  id: uuid,
  nombre: z.string().trim().min(2, 'La etiqueta lleva de 2 a 40 caracteres.').max(40, 'La etiqueta lleva de 2 a 40 caracteres.'),
})

/** Renombrar no cambia el slug: las ligas con `?etiqueta=` siguen sirviendo. */
export async function renombrarEtiqueta(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirEquipo()
  const r = esquemaRenombrar.safeParse({ id: datos.get('id'), nombre: datos.get('nombre') })
  if (!r.success) return { error: r.error.issues[0]?.message ?? 'Revisa la etiqueta.' }
  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('tool_tags').update({ name: r.data.nombre.replace(/\s+/g, ' ') }).eq('id', r.data.id)
  if (error) {
    registrar('renombrarEtiqueta', { id: r.data.id, error: error.message })
    return { error: 'No se pudo renombrar.' }
  }
  redibujarLasDe(r.data.id)
  revalidatePath(PANEL_HERRAMIENTAS)
  revalidatePath('/vaip/herramientas', 'layout')
  return { aviso: 'Renombrada. Las portadas se vuelven a dibujar en un momento.' }
}

/** Archiva o reactiva. Archivar la esconde de los filtros sin quitársela a ninguna herramienta. Sin JS funciona. */
export async function alternarEtiqueta(datos: FormData): Promise<void> {
  await exigirEquipo()
  const id = uuid.safeParse(datos.get('id'))
  if (!id.success) return
  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('tool_tags').update({ archived: datos.get('archivar') === 'si' }).eq('id', id.data)
  if (error) registrar('alternarEtiqueta', { id: id.data, error: error.message })
  else redibujarLasDe(id.data)
  revalidatePath(PANEL_HERRAMIENTAS)
  revalidatePath('/vaip/herramientas', 'layout')
}

// ==========================================================================
// Abrir la comunidad (Planes y cobros)
// ==========================================================================

/**
 * Publica la casa de V-AI-P. Reemplaza al formulario «Datos de la casa» que
 * nunca se definió con Alejandro: lo único que hacía falta de él era esto.
 */
export async function abrirCasa(): Promise<void> {
  await exigirAdmin()
  const lugar = await casaDelPanel()
  if (!lugar || lugar.casa.publicada) return
  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('courses').update({ status: 'published' }).eq('id', lugar.casa.id)
  if (error) registrar('abrirCasa', { casa: lugar.casa.id, error: error.message })
  revalidatePath('/admin/vaip/planes')
  revalidatePath('/vaip')
}
