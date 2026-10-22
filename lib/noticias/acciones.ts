'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { z } from 'zod'

import type { EstadoAccion } from '@/lib/admin/tipos'
import { claudeConfigurado, esModoQa } from '@/lib/agente/claude'
import { dbDelAgente } from '@/lib/agente/servidor'
import type { LlamadaRpc } from '@/lib/alumno/catalogo'
import { exigirAdmin, exigirEquipo } from '@/lib/auth/sesion'
import { borrarImagenes, subirArchivos, subirImagen, type ImagenDelMuro } from '@/lib/comunidad/imagenes'
import { publicarComoEquipo } from '@/lib/comunidad/publicar-del-equipo'
import { casaDeNoticias } from '@/lib/noticias/casa'
import { cazarNoticias, noticiaDesdeLiga } from '@/lib/noticias/cazar'
import { dibujarImagen } from '@/lib/noticias/imagen'
import { formaSegura } from '@/lib/red/seguro'
import { hashDeUrl, medioDeHost, normalizarUrl } from '@/lib/noticias/url'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * Las acciones del panel de V-AI-P para publicar (M24). Todas exigen ser del
 * equipo (admin o community manager) y funcionan sin JavaScript: un `<form>`
 * con la acción directa, y lo que tarda (buscar noticias) corre después de
 * responder (`after`) mientras la página se refresca sola.
 *
 * El cliente del agente (service role) se usa DESPUÉS de `exigirEquipo()`:
 * publicar como «Equipo VADAI», abrir la búsqueda con candado y subir imágenes
 * (excepción del agente en CLAUDE.md).
 */

const RUTA_NOTICIAS = '/admin/vaip/noticias'
// M25: el compositor vive en el Muro de V-AI-P.
const RUTA_PUBLICAR = '/admin/vaip/muro'

/** Cacerías por día (contando la del cron de las 7:00) y ligas por día. */
const LIMITE_CACERIAS = 3
const LIMITE_LIGAS = 10

const uuid = z.string().uuid()

function registrar(operacion: string, detalle: Record<string, unknown>) {
  console.error(JSON.stringify({ operacion, ...detalle }))
}

function mensajeDeInicio(error: { message: string }, tipo: 'caceria' | 'liga'): string {
  if (error.message.includes('limite')) {
    return tipo === 'caceria'
      ? `Ya se hicieron las ${LIMITE_CACERIAS} búsquedas de hoy. Mañana a las 7:00 sale la siguiente sola.`
      : `Ya se crearon las ${LIMITE_LIGAS} noticias desde liga de hoy.`
  }
  if (error.message.includes('ocupado')) return 'Ya hay una búsqueda en curso. Espera a que termine.'
  return 'No se pudo empezar. Intenta de nuevo.'
}

/** Carpeta de las imágenes de V-AI-P en `academia-media` (las de la suite, aparte). */
function carpeta(tipo: 'noticias' | 'vaip'): string {
  const ahora = new Date()
  return `${tipo}/${esModoQa() ? 'qa/' : ''}${ahora.getUTCFullYear()}/${String(ahora.getUTCMonth() + 1).padStart(2, '0')}`
}

// ==========================================================================
// Cuántas noticias deja cada cacería (0050)
// ==========================================================================

/**
 * Guarda cuántas noticias deja cada cacería, del 1 al 5 (22-oct-2026). Lo usan
 * el botón y el cron de las 7:00. Con 1 la IA elige la más hablada del momento.
 * Es un ajuste del agente: lo cambia un admin (`agent_settings_admin`); el
 * community manager lo ve en la página pero no lo edita.
 */
export async function guardarNoticiasPorCaceria(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const perfil = await exigirAdmin()
  const r = z.coerce.number().int().min(1).max(5).safeParse(datos.get('noticias_por_caceria'))
  if (!r.success) return { error: 'Elige de 1 a 5 noticias.' }
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('agent_settings')
    .update({ noticias_por_caceria: r.data, updated_at: new Date().toISOString(), updated_by: perfil.user_id })
    .eq('es_qa', esModoQa())
    .select('noticias_por_caceria')
  if (error || !data?.length) {
    console.error(JSON.stringify({ operacion: 'guardarNoticiasPorCaceria', valor: r.data, error: error?.message ?? 'sin fila' }))
    return { error: 'No se pudo guardar. Intenta de nuevo.' }
  }
  revalidatePath(RUTA_NOTICIAS)
  return {
    aviso: r.data === 1 ? 'Guardado. Cada búsqueda deja la noticia más hablada del momento.' : `Guardado. Cada búsqueda deja las ${r.data} más relevantes.`,
  }
}

// ==========================================================================
// Cazar noticias y crear una desde una liga
// ==========================================================================

export async function iniciarCaceria(_previo: EstadoAccion, _datos: FormData): Promise<EstadoAccion> {
  const perfil = await exigirEquipo()
  if (!claudeConfigurado()) return { error: 'Falta ANTHROPIC_API_KEY en el servidor.' }
  const db = dbDelAgente()
  const rpc = (db.rpc as unknown as LlamadaRpc).bind(db)
  const { data: id, error } = await rpc('academia_noticias_iniciar', {
    p_tipo: 'caceria',
    p_origen: 'boton',
    p_pedido_por: perfil.user_id,
    p_url: null,
    p_enfoque: null,
    p_limite: LIMITE_CACERIAS,
    p_qa: esModoQa(),
  })
  if (error || typeof id !== 'string') return { error: mensajeDeInicio(error ?? { message: '' }, 'caceria') }
  after(() => cazarNoticias(id))
  redirect(`${RUTA_NOTICIAS}?busqueda=${id}`)
}

export async function crearDesdeLiga(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const perfil = await exigirEquipo()
  if (!claudeConfigurado()) return { error: 'Falta ANTHROPIC_API_KEY en el servidor.' }
  const cruda = String(datos.get('url') ?? '').trim()
  const enfoque = String(datos.get('enfoque') ?? '').trim().slice(0, 300) || null
  const url = normalizarUrl(cruda)
  if (!url) return { error: 'Pega la liga completa (empieza con https://).' }
  const problema = formaSegura(url)
  if (problema) return { error: problema }

  const db = dbDelAgente()
  const { data: existente } = await db
    .from('news_items')
    .select('estado')
    .eq('es_qa', esModoQa())
    .eq('url_hash', hashDeUrl(url))
    .maybeSingle()
  if (existente?.estado === 'publicada') return { error: 'Esa noticia ya está publicada en el muro.' }
  if (existente?.estado === 'propuesta') return { error: 'Esa noticia ya está en «Esperan tu clic».' }
  if (existente?.estado === 'descartada') return { error: 'Esa noticia ya se había descartado.' }

  const rpc = (db.rpc as unknown as LlamadaRpc).bind(db)
  const { data: id, error } = await rpc('academia_noticias_iniciar', {
    p_tipo: 'liga',
    p_origen: 'boton',
    p_pedido_por: perfil.user_id,
    p_url: url,
    p_enfoque: enfoque,
    p_limite: LIMITE_LIGAS,
    p_qa: esModoQa(),
  })
  if (error || typeof id !== 'string') return { error: mensajeDeInicio(error ?? { message: '' }, 'liga') }
  after(() => noticiaDesdeLiga(id))
  redirect(`${RUTA_NOTICIAS}?busqueda=${id}`)
}

// ==========================================================================
// Publicar o descartar una propuesta
// ==========================================================================

const esquemaPropuesta = z.object({
  id: uuid,
  titulo: z.string().trim().min(3, 'El título necesita al menos 3 letras.').max(160, 'El título es demasiado largo.'),
  resumen: z.string().trim().min(1, 'Escribe el resumen.').max(600, 'El resumen es demasiado largo.'),
  texto: z.string().trim().min(1, 'Escribe el texto.').max(5000, 'El texto es demasiado largo.'),
  fijar: z.enum(['no', '1', '3', '7']).default('no'),
})

function fijarPor(dias: string): Date | null {
  return dias === 'no' ? null : new Date(Date.now() + Number(dias) * 86_400_000)
}

export async function publicarNoticia(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const perfil = await exigirEquipo()
  const r = esquemaPropuesta.safeParse({
    id: datos.get('id'),
    titulo: datos.get('titulo'),
    resumen: datos.get('resumen'),
    texto: String(datos.get('texto') ?? '').replace(/\r\n/g, '\n'),
    fijar: datos.get('fijar') ?? 'no',
  })
  if (!r.success) return { error: r.error.issues[0]?.message ?? 'Revisa la noticia.' }

  // Leída con la sesión: la RLS solo deja al equipo verla.
  const supabase = await crearClienteServidor()
  const { data: item } = await supabase.from('news_items').select('id, estado, url, medio, course_id').eq('id', r.data.id).maybeSingle()
  if (!item) return { error: 'Esa propuesta ya no existe.' }
  if (item.estado !== 'propuesta') return { error: 'Esa noticia ya se publicó o se descartó.' }

  const db = dbDelAgente()
  const casa = await casaDeNoticias(db)
  if (!casa || casa.id !== item.course_id) return { error: 'No encontré el muro de V-AI-P donde va la noticia.' }

  // Lo que el equipo corrigió se queda también en la propuesta.
  await supabase.from('news_items').update({ titulo: r.data.titulo, resumen: r.data.resumen, texto: r.data.texto }).eq('id', item.id)

  const medio = item.medio ?? medioDeHost(new URL(item.url).hostname)
  let imagen: ImagenDelMuro | null = null
  try {
    const png = await dibujarImagen({ tipo: 'noticia', titulo: r.data.titulo, medio, fecha: new Date() })
    const subida = await subirImagen(db, png, carpeta('noticias'), item.id)
    if ('error' in subida) registrar('publicarNoticia:imagen', { id: item.id, error: subida.error })
    else imagen = subida
  } catch (e) {
    registrar('publicarNoticia:dibujar', { id: item.id, error: e instanceof Error ? e.message : String(e) })
  }

  const publicado = await publicarComoEquipo(db, {
    casa,
    tema: 'noticias',
    titulo: r.data.titulo,
    texto: r.data.texto,
    resumen: r.data.resumen,
    enlace: { url: item.url, medio },
    imagenes: imagen ? [imagen] : [],
    autor: 'equipo',
    via: 'agente_revisado',
    publicadoPor: perfil.user_id,
    fijar: fijarPor(r.data.fijar),
    noticiaId: item.id,
  })
  if ('error' in publicado) {
    if (imagen) await borrarImagenes(db, [imagen])
    return { error: publicado.error }
  }
  revalidatePath(RUTA_NOTICIAS)
  return { aviso: `Publicada en el muro de V-AI-P. ${publicado.url}` }
}

export async function descartarNoticia(datos: FormData): Promise<void> {
  const perfil = await exigirEquipo()
  const id = uuid.safeParse(datos.get('id'))
  if (!id.success) return
  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('news_items')
    .update({ estado: 'descartada', revisado_por: perfil.user_id, revisado_en: new Date().toISOString() })
    .eq('id', id.data)
    .eq('estado', 'propuesta')
  if (error) registrar('descartarNoticia', { id: id.data, error: error.message })
  revalidatePath(RUTA_NOTICIAS)
}

// ==========================================================================
// El compositor: publicación, aviso o noticia escrita por el equipo
// ==========================================================================

const esquemaCompositor = z
  .object({
    tipo: z.enum(['publicacion', 'aviso', 'noticia']),
    titulo: z.string().trim().min(3, 'El título necesita al menos 3 letras.').max(160, 'El título es demasiado largo.'),
    texto: z.string().trim().max(5000, 'El texto es demasiado largo.'),
    resumen: z.string().trim().max(600, 'El resumen es demasiado largo.'),
    enlace: z.string().trim().max(2000),
    medio: z.string().trim().max(80),
    tema: z.string().trim().max(40),
    fijar: z.enum(['tipo', 'no', '1', '3', '7', 'sin_fin']),
    firma: z.enum(['equipo', 'yo']),
    imagenGenerada: z.boolean(),
  })
  .superRefine((d, ctx) => {
    if (d.tipo !== 'noticia' && d.texto.length === 0) ctx.addIssue({ code: 'custom', message: 'Escribe el texto.' })
    if (d.tipo === 'noticia' && d.resumen.length === 0 && d.texto.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'Una noticia necesita al menos el resumen o el texto.' })
    }
  })

export async function publicarEnVaip(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const perfil = await exigirEquipo()
  const r = esquemaCompositor.safeParse({
    tipo: datos.get('tipo') ?? 'publicacion',
    titulo: datos.get('titulo') ?? '',
    texto: String(datos.get('texto') ?? '').replace(/\r\n/g, '\n'),
    resumen: datos.get('resumen') ?? '',
    enlace: datos.get('enlace') ?? '',
    medio: datos.get('medio') ?? '',
    tema: datos.get('tema') ?? '',
    fijar: datos.get('fijar') ?? 'tipo',
    firma: datos.get('firma') ?? 'equipo',
    imagenGenerada: datos.get('imagen_generada') === 'si',
  })
  if (!r.success) return { error: r.error.issues[0]?.message ?? 'Revisa la publicación.' }
  const d = r.data

  let enlace: { url: string; medio: string | null } | null = null
  if (d.enlace) {
    const url = normalizarUrl(d.enlace)
    if (!url || formaSegura(url)) return { error: 'La liga tiene que ser una dirección https pública.' }
    enlace = { url, medio: d.medio || medioDeHost(new URL(url).hostname) }
  }

  const db = dbDelAgente()
  const casa = await casaDeNoticias(db)
  if (!casa) return { error: 'No encontré el muro de V-AI-P.' }

  const tema = d.tipo === 'noticia' ? 'noticias' : d.tipo === 'aviso' ? 'avisos' : d.tema || null
  if (tema && d.tipo === 'publicacion') {
    const { data } = await db.from('community_topics').select('id').eq('course_id', casa.id).eq('slug', tema).eq('archived', false).maybeSingle()
    if (!data) return { error: 'Ese tema ya no existe.' }
  }

  // Imágenes: la dibujada primero (si se pidió) y luego las que suba.
  const imagenes: ImagenDelMuro[] = []
  if (d.imagenGenerada && d.tipo !== 'publicacion') {
    try {
      const png = await dibujarImagen({
        tipo: d.tipo === 'aviso' ? 'aviso' : 'noticia',
        titulo: d.titulo,
        medio: d.tipo === 'aviso' ? 'Equipo VADAI' : (enlace?.medio ?? null),
        fecha: new Date(),
      })
      const subida = await subirImagen(db, png, carpeta(d.tipo === 'aviso' ? 'vaip' : 'noticias'), `${Date.now()}-portada`)
      if ('error' in subida) return { error: subida.error }
      imagenes.push(subida)
    } catch (e) {
      registrar('publicarEnVaip:dibujar', { error: e instanceof Error ? e.message : String(e) })
      return { error: 'No se pudo dibujar la imagen. Desmarca «Imagen con el diseño de VADAI» o intenta de nuevo.' }
    }
  }
  const archivos = datos.getAll('imagenes').filter((a): a is File => a instanceof File && a.size > 0)
  const subidas = await subirArchivos(db, archivos, carpeta('vaip'), { maximo: 4 - imagenes.length, maxBytes: 5_000_000 })
  if ('error' in subidas) {
    await borrarImagenes(db, imagenes)
    return { error: subidas.error }
  }
  imagenes.push(...subidas)

  const dias = d.fijar === 'tipo' ? (d.tipo === 'aviso' ? '7' : 'no') : d.fijar
  const publicado = await publicarComoEquipo(db, {
    casa,
    tema,
    titulo: d.titulo,
    texto: d.texto || d.resumen,
    resumen: d.tipo === 'noticia' ? d.resumen || null : null,
    enlace,
    imagenes,
    autor: d.firma === 'equipo' ? 'equipo' : perfil.user_id,
    via: 'humano',
    publicadoPor: d.firma === 'equipo' ? perfil.user_id : null,
    fijar: dias === 'sin_fin' ? 'sin_fin' : dias === 'no' ? null : new Date(Date.now() + Number(dias) * 86_400_000),
  })
  if ('error' in publicado) {
    await borrarImagenes(db, imagenes)
    return { error: publicado.error }
  }

  // Una noticia con liga queda anotada: la cacería no la vuelve a proponer.
  if (enlace && d.tipo === 'noticia') {
    await db.from('news_items').upsert(
      {
        es_qa: esModoQa(),
        course_id: casa.id,
        url: enlace.url,
        url_hash: hashDeUrl(enlace.url),
        medio: enlace.medio,
        titulo: d.titulo,
        resumen: (d.resumen || d.texto).slice(0, 600),
        texto: (d.texto || d.resumen).slice(0, 5000),
        estado: 'publicada',
        post_id: publicado.id,
        revisado_por: perfil.user_id,
        revisado_en: new Date().toISOString(),
      },
      { onConflict: 'es_qa,url_hash', ignoreDuplicates: true }
    )
  }

  revalidatePath(RUTA_PUBLICAR)
  const que = d.tipo === 'aviso' ? 'Aviso publicado' : d.tipo === 'noticia' ? 'Noticia publicada' : 'Publicado'
  return { aviso: `${que} en el muro de V-AI-P.` }
}

// ==========================================================================
// Lo que publicó el equipo: fijar, ocultar, borrar
// ==========================================================================

const esquemaFijar = z.object({ id: uuid, dias: z.enum(['no', '1', '3', '7', '30', 'sin_fin']) })

export async function fijarPublicacion(datos: FormData): Promise<void> {
  await exigirEquipo()
  const r = esquemaFijar.safeParse({ id: datos.get('id'), dias: datos.get('dias') })
  if (!r.success) return
  const supabase = await crearClienteServidor()
  const cambio =
    r.data.dias === 'no'
      ? { pinned: false, pinned_until: null }
      : { pinned: true, pinned_until: r.data.dias === 'sin_fin' ? null : new Date(Date.now() + Number(r.data.dias) * 86_400_000).toISOString() }
  const { error } = await supabase.from('community_posts').update(cambio).eq('id', r.data.id)
  if (error) registrar('fijarPublicacion', { id: r.data.id, error: error.message })
  revalidatePath(RUTA_PUBLICAR)
  revalidatePath('/vaip')
}

export async function cambiarVisibilidad(datos: FormData): Promise<void> {
  await exigirEquipo()
  const id = uuid.safeParse(datos.get('id'))
  const status = datos.get('status') === 'hidden' ? 'hidden' : 'visible'
  if (!id.success) return
  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('community_posts').update({ status }).eq('id', id.data)
  if (error) registrar('cambiarVisibilidad', { id: id.data, error: error.message })
  revalidatePath(RUTA_PUBLICAR)
  revalidatePath('/vaip')
}

export async function borrarPublicacion(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirEquipo()
  const id = uuid.safeParse(datos.get('id'))
  if (!id.success) return { error: 'No se encontró qué borrar.' }
  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('community_posts').delete().eq('id', id.data)
  if (error) {
    registrar('borrarPublicacion', { id: id.data, error: error.message })
    return { error: 'No se pudo borrar.' }
  }
  revalidatePath(RUTA_PUBLICAR)
  revalidatePath('/vaip')
  return { aviso: 'Borrada.' }
}
