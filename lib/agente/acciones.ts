'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { ajustesDelAgente } from '@/lib/agente/ajustes'
import { claudeConfigurado } from '@/lib/agente/claude'
import { dolares } from '@/lib/agente/costos'
import { conversacionParaModelo, decidir, type HiloCargado } from '@/lib/agente/procesar'
import { cuentaDelBot, publicarRespuesta } from '@/lib/agente/publicar'
import { dbDelAgente } from '@/lib/agente/servidor'
import { emitirEvento } from '@/lib/api/webhooks'
import { exigirAdmin, exigirEquipo } from '@/lib/auth/sesion'
import { casaDeNoticias } from '@/lib/noticias/casa'
import { comoDocumento } from '@/lib/comunidad/documento'
import { esCuentaQa, esCursoQa } from '@/lib/qa'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * Acciones del agente en el panel (M21).
 *
 *   - Ajustes, probador y conocimiento: solo admin (Ajustes → Agente).
 *   - Borradores e ideas: el equipo (la pestaña Agente). Publicar un borrador
 *     va a nombre de la cuenta «Equipo VADAI» con `via = 'agente_revisado'`,
 *     y eso solo lo puede escribir el servidor: por eso esa parte usa el
 *     cliente del agente, DESPUÉS de `exigirEquipo()`.
 *
 * Una cuenta QA solo toca lo del agente de la suite (`es_qa`).
 */

export type EstadoAgente = { error?: string; aviso?: string }

export type EstadoProbador = EstadoAgente & {
  resultado?: {
    accion: string
    certeza: number
    complejidad: string
    modelo: string
    escalado: boolean
    texto: string
    motivo: string
    problemas: string[]
    ideas: string[]
    costo: string
  }
}

const uuid = z.uuid()
const RUTA_AJUSTES = '/admin/ajustes/agente'
const RUTA_TABLERO = '/admin/agente'

function registrar(operacion: string, detalle: Record<string, unknown>) {
  console.error(JSON.stringify({ operacion, ...detalle }))
}

const MODELOS = ['claude-haiku-5-5', 'claude-sonnet-5-5'] as const

const esquemaAjustes = z
  .object({
    modo: z.enum(['apagado', 'borradores', 'automatico']),
    umbral: z.coerce.number().min(0.5).max(1),
    espera_min: z.coerce.number().int().min(0).max(600),
    espera_max: z.coerce.number().int().min(0).max(1440),
    hora_inicio: z.coerce.number().int().min(0).max(23),
    hora_fin: z.coerce.number().int().min(1).max(24),
    tope_usd: z.coerce.number().min(0).max(500),
    modelo_rapido: z.enum(MODELOS),
    modelo_fuerte: z.enum(MODELOS),
  })
  .refine((a) => a.espera_max >= a.espera_min, { message: 'La espera máxima no puede ser menor que la mínima.' })
  .refine((a) => a.hora_fin > a.hora_inicio, { message: 'El horario tiene que terminar después de empezar.' })

export async function guardarAjustesAgente(_previo: EstadoAgente, datos: FormData): Promise<EstadoAgente> {
  const perfil = await exigirAdmin()
  const r = esquemaAjustes.safeParse(Object.fromEntries(datos))
  if (!r.success) return { error: r.error.issues[0]?.message ?? 'Revisa los ajustes.' }
  const qa = esCuentaQa(perfil.email)
  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('agent_settings')
    .update({
      ...r.data,
      busqueda_web: datos.get('busqueda_web') === 'si',
      noticias: datos.get('noticias') === 'si',
      // Si suben el tope, que vuelva a intentar; si sigue sin caber, se pausa solo otra vez.
      pausado_por_tope: false,
      updated_at: new Date().toISOString(),
      updated_by: perfil.user_id,
    })
    .eq('es_qa', qa)
  if (error) {
    registrar('guardarAjustesAgente', { error: error.message })
    return { error: 'No se pudieron guardar los ajustes.' }
  }
  revalidatePath(RUTA_AJUSTES)
  revalidatePath(RUTA_TABLERO)
  return { aviso: r.data.modo === 'automatico' ? 'Guardado. El agente ya contesta solo lo que tiene claro.' : 'Guardado.' }
}

export async function guardarVozAgente(_previo: EstadoAgente, datos: FormData): Promise<EstadoAgente> {
  const perfil = await exigirAdmin()
  const restablecer = datos.get('restablecer') === 'si'
  const prompt = restablecer ? '' : String(datos.get('prompt') ?? '').replace(/\r\n/g, '\n').trim()
  if (prompt.length > 20000) return { error: 'La voz es demasiado larga (máximo 20 mil letras).' }
  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('agent_settings')
    .update({ prompt, updated_at: new Date().toISOString(), updated_by: perfil.user_id })
    .eq('es_qa', esCuentaQa(perfil.email))
  if (error) {
    registrar('guardarVozAgente', { error: error.message })
    return { error: 'No se pudo guardar la voz.' }
  }
  revalidatePath(RUTA_AJUSTES)
  return { aviso: restablecer ? 'Volvió a la voz por defecto.' : 'Voz guardada. Pruébala abajo antes de encender el modo automático.' }
}

/** «Pregúntale algo y ve qué contestaría», sin publicar. Cuenta en el gasto del mes. */
export async function probarAgente(_previo: EstadoProbador, datos: FormData): Promise<EstadoProbador> {
  const perfil = await exigirAdmin()
  if (!claudeConfigurado()) return { error: 'Falta ANTHROPIC_API_KEY en el servidor (ver docs/M21.md).' }
  const cursoId = String(datos.get('curso') ?? '')
  const pregunta = String(datos.get('pregunta') ?? '').trim()
  if (!uuid.safeParse(cursoId).success) return { error: 'Elige el curso.' }
  if (pregunta.length < 5 || pregunta.length > 2000) return { error: 'Escribe la pregunta como la haría un alumno (5 a 2000 letras).' }

  const qa = esCuentaQa(perfil.email)
  const db = dbDelAgente()
  const { data: curso } = await db.from('courses').select('id, slug, title').eq('id', cursoId).maybeSingle()
  if (!curso || esCursoQa(curso.slug) !== qa) return { error: 'Ese curso no existe.' }
  const a = await ajustesDelAgente(qa)
  if (!a) return { error: 'Faltan los ajustes del agente (migración 0045).' }

  // La generación vigente: en un curso por generaciones, los módulos (y el mapa) son de ella.
  const { data: generaciones } = await db
    .from('cohorts')
    .select('id')
    .eq('course_id', curso.id)
    .order('open_for_enrollment', { ascending: false })
    .order('starts_on', { ascending: false })
    .limit(1)
  const cohortId = generaciones?.[0]?.id ?? null
  const hilo: HiloCargado = {
    tipo: 'muro',
    hiloId: 'probador',
    curso: { id: curso.id, slug: curso.slug, titulo: curso.title },
    cohortId,
    lugar: `Publicación en el muro del curso «${curso.title}»`,
    visible: true,
    mensajes: [{ id: 'p', autorId: 'alumno', quien: 'alumno', texto: pregunta, creadoEn: new Date().toISOString() }],
  }
  const d = await decidir(db, a, { curso: hilo.curso, cohortId, conversacion: conversacionParaModelo(hilo), jobId: null, tarea: 'probador' })
  revalidatePath(RUTA_AJUSTES)
  if (d.tipo === 'sin_presupuesto') return { error: 'Se llegó al tope de gasto del mes. Súbelo arriba para seguir probando.' }
  if (d.tipo === 'error') return { error: `No contestó: ${d.detalle}` }
  if (d.tipo === 'sin_respuesta') return { error: `${d.motivo} (${dolares(d.costo)})` }
  return {
    resultado: {
      accion: d.decision.accion,
      certeza: d.decision.certeza,
      complejidad: d.decision.complejidad,
      modelo: d.modelo,
      escalado: d.escalado,
      texto: d.texto,
      motivo: d.decision.motivo,
      problemas: d.problemas,
      ideas: d.decision.ideas.map((i) => `${i.tipo}: ${i.resumen}`),
      costo: dolares(d.costo),
    },
  }
}

// ==========================================================================
// Borradores e ideas (equipo)
// ==========================================================================

async function borradorDelEquipo(id: string) {
  const perfil = await exigirEquipo()
  if (!uuid.safeParse(id).success) return null
  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('agent_drafts')
    .select('id, tipo, es_qa, job_id, course_id, tipo_origen, hilo_id, titulo, texto, fuente, estado')
    .eq('id', id)
    .maybeSingle()
  if (!data || data.es_qa !== esCuentaQa(perfil.email)) return null
  return { perfil, supabase, borrador: data }
}

export async function publicarBorrador(_previo: EstadoAgente, datos: FormData): Promise<EstadoAgente> {
  const encontrado = await borradorDelEquipo(String(datos.get('id') ?? ''))
  if (!encontrado) return { error: 'Ese borrador ya no existe.' }
  const { perfil, supabase, borrador } = encontrado
  if (borrador.estado !== 'pendiente') return { error: 'Ese borrador ya se atendió.' }
  const texto = String(datos.get('texto') ?? '').replace(/\r\n/g, '\n').trim()
  if (texto.length < 2) return { error: 'Escribe la respuesta antes de publicar.' }
  if (texto.length > 2000) return { error: 'La respuesta es demasiado larga (máximo 2000 letras).' }

  const db = dbDelAgente()
  const botId = await cuentaDelBot(db)
  if (!botId) return { error: 'Falta la cuenta «Equipo VADAI» (node scripts/cuenta-equipo-vadai.mjs).' }

  let publicadoId: string
  if (borrador.tipo === 'respuesta') {
    if (!borrador.hilo_id || !borrador.tipo_origen) return { error: 'Al borrador le falta su hilo.' }
    const r = await publicarRespuesta(db, {
      tipoOrigen: borrador.tipo_origen,
      hiloId: borrador.hilo_id,
      texto,
      via: 'agente_revisado',
      jobId: borrador.job_id,
      botId,
    })
    if ('error' in r) return { error: r.error }
    publicadoId = r.id
    if (borrador.job_id) {
      await db.from('agent_jobs').update({ estado: 'hecho', resultado: 'Lo publicó el equipo desde el borrador.', updated_at: new Date().toISOString() }).eq('id', borrador.job_id)
    }
  } else {
    const titulo = String(datos.get('titulo') ?? borrador.titulo ?? '').trim()
    if (titulo.length < 3 || titulo.length > 160) return { error: 'La noticia necesita título (3 a 160 letras).' }
    const casa = await casaDeNoticias(db)
    if (!casa || casa.id !== borrador.course_id) return { error: 'No encontré el muro de V-AI-P donde va la noticia.' }
    const [{ data: tema }, { data: generaciones }] = await Promise.all([
      db.from('community_topics').select('id').eq('course_id', casa.id).eq('slug', 'noticias').maybeSingle(),
      db.from('cohorts').select('id').eq('course_id', casa.id).order('open_for_enrollment', { ascending: false }).order('starts_on', { ascending: false }).limit(1),
    ])
    if (!tema) return { error: 'El muro de V-AI-P no tiene el tema «Noticias».' }
    const { data, error } = await db
      .from('community_posts')
      .insert({
        course_id: casa.id,
        cohort_id: generaciones?.[0]?.id ?? null,
        user_id: botId,
        title: titulo,
        content_rich: comoDocumento(texto, borrador.fuente),
        topic_id: tema.id,
        via: 'agente_revisado',
      })
      .select('id')
      .single()
    if (error || !data) {
      registrar('publicarBorrador:noticia', { id: borrador.id, error: error?.message })
      return { error: 'No se pudo publicar la noticia.' }
    }
    publicadoId = data.id
    const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '')
    const url = `${base}/curso/${casa.slug}/comunidad?tema=noticias`
    await emitirEvento('noticia.publicada', { noticiaId: data.id, titulo, url, plan: esCuentaQa(perfil.email) ? 'qa-agente' : 'v-ai-p' })
    revalidatePath(`/curso/${casa.slug}/comunidad`)
  }

  const { error } = await supabase
    .from('agent_drafts')
    .update({ estado: 'publicado', texto, revisado_por: perfil.user_id, revisado_en: new Date().toISOString(), publicado_id: publicadoId })
    .eq('id', borrador.id)
  if (error) registrar('publicarBorrador:marcar', { id: borrador.id, error: error.message })
  revalidatePath(RUTA_TABLERO)
  return { aviso: borrador.tipo === 'noticia' ? 'Noticia publicada en V-AI-P.' : 'Publicado como «revisado por el equipo».' }
}

export async function descartarBorrador(datos: FormData): Promise<void> {
  const encontrado = await borradorDelEquipo(String(datos.get('id') ?? ''))
  if (!encontrado || encontrado.borrador.estado !== 'pendiente') return
  const { error } = await encontrado.supabase
    .from('agent_drafts')
    .update({ estado: 'descartado', revisado_por: encontrado.perfil.user_id, revisado_en: new Date().toISOString() })
    .eq('id', encontrado.borrador.id)
  if (error) registrar('descartarBorrador', { id: encontrado.borrador.id, error: error.message })
  revalidatePath(RUTA_TABLERO)
}

/** Marca atendida una idea y sus repeticiones (el panel manda todos sus ids). */
export async function atenderIdea(datos: FormData): Promise<void> {
  const perfil = await exigirEquipo()
  const ids = datos
    .getAll('id')
    .map(String)
    .filter((id) => uuid.safeParse(id).success)
    .slice(0, 200)
  if (ids.length === 0) return
  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('community_insights').update({ atendida: true }).in('id', ids).eq('es_qa', esCuentaQa(perfil.email))
  if (error) registrar('atenderIdea', { ids: ids.length, error: error.message })
  revalidatePath(RUTA_TABLERO)
}

// ==========================================================================
// Conocimiento (admin)
// ==========================================================================

export async function agregarConocimiento(_previo: EstadoAgente, datos: FormData): Promise<EstadoAgente> {
  await exigirAdmin()
  const titulo = String(datos.get('titulo') ?? '').trim()
  const contenido = String(datos.get('contenido') ?? '').replace(/\r\n/g, '\n').trim()
  const curso = String(datos.get('curso') ?? '')
  if (titulo.length < 2 || titulo.length > 200) return { error: 'Ponle un título (2 a 200 letras).' }
  if (contenido.length < 20) return { error: 'Escribe lo que el agente tiene que saber (al menos una oración).' }
  if (contenido.length > 400000) return { error: 'Es demasiado largo: pártelo en varias notas.' }
  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('agent_knowledge').insert({
    fuente: 'equipo',
    clave: `equipo-${crypto.randomUUID()}`,
    titulo,
    contenido,
    course_id: uuid.safeParse(curso).success ? curso : null,
  })
  if (error) {
    registrar('agregarConocimiento', { error: error.message })
    return { error: 'No se pudo guardar.' }
  }
  revalidatePath(RUTA_AJUSTES)
  return { aviso: 'Guardado. El agente lo usa desde la próxima pregunta.' }
}

export async function alternarConocimiento(datos: FormData): Promise<void> {
  await exigirAdmin()
  const id = String(datos.get('id') ?? '')
  if (!uuid.safeParse(id).success) return
  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('agent_knowledge')
    .update({ activo: datos.get('activo') === 'si', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) registrar('alternarConocimiento', { id, error: error.message })
  revalidatePath(RUTA_AJUSTES)
}

export async function borrarConocimiento(_previo: EstadoAgente, datos: FormData): Promise<EstadoAgente> {
  await exigirAdmin()
  const id = String(datos.get('id') ?? '')
  if (!uuid.safeParse(id).success) return { error: 'No se encontró qué borrar.' }
  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('agent_knowledge').delete().eq('id', id)
  if (error) {
    registrar('borrarConocimiento', { id, error: error.message })
    return { error: 'No se pudo borrar.' }
  }
  revalidatePath(RUTA_AJUSTES)
  return { aviso: 'Borrado.' }
}
