import 'server-only'

import { ErrorApi, json, type ContextoApi } from '@/lib/api/contexto'
import { emitirEvento } from '@/lib/api/webhooks'
import { comoDocumento, textoPlano } from '@/lib/comunidad/documento'
import { accesoMayor, vigente } from '@/lib/membresia/acceso'
import { ACTIVIDAD_VACIA, nivelDe, puntosDe, sumarActividad, type Actividad } from '@/lib/gamificacion/reglas'
import { esCuentaQa, esCursoQa } from '@/lib/qa'
import type { Json } from '@/lib/supabase/types'

/**
 * Lo que hace cada endpoint de /api/v1 (M20), siempre sobre el plan de la
 * petición (`?plan=`, V-AI-P por omisión) y su casa: las noticias son el tema
 * «Noticias» de su muro, los eventos son las sesiones de su generación y los
 * hilos son su muro.
 *
 * Lo que la API escribe va a nombre de la cuenta «Equipo VADAI» (`es_bot`),
 * marcado `via = 'api'` y con la llave que lo hizo (`api_key_id`).
 *
 * Fuera de un plan QA (`qa-…`) no salen cuentas ni cursos QA, como en el panel.
 */

const EQUIPO = new Set(['admin', 'superadmin', 'community_manager'])

function exigirCasa(ctx: ContextoApi): { casaId: string; casaSlug: string } {
  if (!ctx.plan.casaId || !ctx.plan.casaSlug) throw new ErrorApi(409, 'El plan no tiene curso casa.')
  return { casaId: ctx.plan.casaId, casaSlug: ctx.plan.casaSlug }
}

async function cuentaDelEquipo(ctx: ContextoApi): Promise<string> {
  const { data } = await ctx.db
    .from('profiles')
    .select('user_id')
    .eq('es_bot', true)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  if (!data) throw new ErrorApi(503, 'Falta la cuenta «Equipo VADAI» (node scripts/cuenta-equipo-vadai.mjs).')
  return data.user_id
}

async function generacionDeLaCasa(ctx: ContextoApi, casaId: string): Promise<string | null> {
  const { data } = await ctx.db
    .from('cohorts')
    .select('id')
    .eq('course_id', casaId)
    .order('open_for_enrollment', { ascending: false })
    .order('starts_on', { ascending: false })
    .limit(1)
  return data?.[0]?.id ?? null
}

// ==========================================================================
// Noticias
// ==========================================================================

async function temaDeNoticias(ctx: ContextoApi, casaId: string): Promise<string> {
  const { data } = await ctx.db
    .from('community_topics')
    .select('id')
    .eq('course_id', casaId)
    .eq('slug', 'noticias')
    .maybeSingle()
  if (!data) throw new ErrorApi(409, 'La casa del plan no tiene el tema «Noticias» (migración 0043).')
  return data.id
}

const urlDeNoticias = (ctx: ContextoApi, casaSlug: string) => `${ctx.base}/curso/${casaSlug}/comunidad?tema=noticias`

export async function listarNoticias(ctx: ContextoApi, limite: number): Promise<Response> {
  const { casaId, casaSlug } = exigirCasa(ctx)
  const tema = await temaDeNoticias(ctx, casaId)
  const { data: posts } = await ctx.db
    .from('community_posts')
    .select('id, title, content_rich, created_at, via')
    .eq('course_id', casaId)
    .eq('topic_id', tema)
    .eq('status', 'visible')
    .order('created_at', { ascending: false })
    .limit(limite)
  const ids = (posts ?? []).map((p) => p.id)
  const { data: comentarios } = ids.length
    ? await ctx.db.from('community_comments').select('post_id').in('post_id', ids).eq('status', 'visible')
    : { data: [] }
  return json({
    noticias: (posts ?? []).map((p) => ({
      id: p.id,
      titulo: p.title,
      texto: textoPlano(p.content_rich),
      creadaEn: p.created_at,
      comentarios: (comentarios ?? []).filter((c) => c.post_id === p.id).length,
      via: p.via,
      url: urlDeNoticias(ctx, casaSlug),
    })),
  })
}

export async function crearNoticia(
  ctx: ContextoApi,
  datos: { titulo: string; cuerpo: string; fuente?: string | null }
): Promise<Response> {
  const { casaId, casaSlug } = exigirCasa(ctx)
  const [tema, autor, generacion] = await Promise.all([
    temaDeNoticias(ctx, casaId),
    cuentaDelEquipo(ctx),
    generacionDeLaCasa(ctx, casaId),
  ])
  const { data, error } = await ctx.db
    .from('community_posts')
    .insert({
      course_id: casaId,
      cohort_id: generacion,
      user_id: autor,
      title: datos.titulo,
      content_rich: comoDocumento(datos.cuerpo, datos.fuente),
      topic_id: tema,
      via: 'api',
      api_key_id: ctx.llave.id,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`No se pudo publicar la noticia: ${error?.message}`)
  const url = urlDeNoticias(ctx, casaSlug)
  await emitirEvento('noticia.publicada', { noticiaId: data.id, titulo: datos.titulo, url, plan: ctx.plan.slug })
  return json({ id: data.id, url }, 201)
}

async function noticiaDelPlan(ctx: ContextoApi, id: string) {
  const { casaId } = exigirCasa(ctx)
  const tema = await temaDeNoticias(ctx, casaId)
  const { data } = await ctx.db
    .from('community_posts')
    .select('id, content_rich')
    .eq('id', id)
    .eq('course_id', casaId)
    .eq('topic_id', tema)
    .neq('status', 'deleted')
    .maybeSingle()
  if (!data) throw new ErrorApi(404, 'No existe esa noticia en este plan.')
  return data
}

export async function editarNoticia(
  ctx: ContextoApi,
  id: string,
  datos: { titulo?: string; cuerpo?: string; fuente?: string | null }
): Promise<Response> {
  await noticiaDelPlan(ctx, id)
  const cambios: { title?: string; content_rich?: Json | null } = {}
  if (datos.titulo !== undefined) cambios.title = datos.titulo
  if (datos.cuerpo !== undefined) cambios.content_rich = comoDocumento(datos.cuerpo, datos.fuente)
  if (Object.keys(cambios).length === 0) throw new ErrorApi(400, 'No mandaste nada que cambiar.')
  const { error } = await ctx.db.from('community_posts').update(cambios).eq('id', id)
  if (error) throw new Error(`No se pudo editar la noticia: ${error.message}`)
  return json({ id })
}

export async function retirarNoticia(ctx: ContextoApi, id: string): Promise<Response> {
  await noticiaDelPlan(ctx, id)
  const { error } = await ctx.db.from('community_posts').update({ status: 'deleted' }).eq('id', id)
  if (error) throw new Error(`No se pudo retirar la noticia: ${error.message}`)
  return json({ id, retirada: true })
}

// ==========================================================================
// Clases y eventos
// ==========================================================================

async function generacionesDeLaCasa(ctx: ContextoApi, casaId: string): Promise<string[]> {
  const { data } = await ctx.db.from('cohorts').select('id').eq('course_id', casaId)
  return (data ?? []).map((g) => g.id)
}

export async function listarEventos(ctx: ContextoApi, desde: Date): Promise<Response> {
  const { casaId } = exigirCasa(ctx)
  const generaciones = await generacionesDeLaCasa(ctx, casaId)
  const { data } = generaciones.length
    ? await ctx.db
        .from('cohort_sessions')
        .select('id, title, description, scheduled_at, meet_url, kind, location')
        .in('cohort_id', generaciones)
        .gte('scheduled_at', desde.toISOString())
        .order('scheduled_at')
        .limit(100)
    : { data: [] }
  return json({
    eventos: (data ?? []).map((s) => ({
      id: s.id,
      titulo: s.title,
      descripcion: s.description,
      inicio: s.scheduled_at,
      tipo: s.kind,
      lugar: s.location,
      liga: s.meet_url,
    })),
  })
}

export async function crearEvento(
  ctx: ContextoApi,
  datos: { titulo: string; inicio: string; tipo: 'clase' | 'evento'; lugar?: string | null; liga?: string | null; descripcion?: string | null; anunciar?: boolean }
): Promise<Response> {
  const { casaId } = exigirCasa(ctx)
  if (Date.parse(datos.inicio) < Date.now()) throw new ErrorApi(400, 'inicio: tiene que ser en el futuro.')
  if (datos.tipo === 'evento' && !datos.lugar && !datos.liga) throw new ErrorApi(400, 'Un evento necesita su lugar o su liga.')
  const generacion = await generacionDeLaCasa(ctx, casaId)
  if (!generacion) throw new ErrorApi(409, 'La casa del plan no tiene generación.')

  const { data, error } = await ctx.db
    .from('cohort_sessions')
    .insert({
      cohort_id: generacion,
      title: datos.titulo,
      scheduled_at: new Date(datos.inicio).toISOString(),
      meet_url: datos.liga || null,
      description: datos.descripcion || null,
      kind: datos.tipo,
      location: datos.lugar || null,
    })
    .select('id, title, scheduled_at, meet_url')
    .single()
  if (error || !data) throw new Error(`No se pudo agendar: ${error?.message}`)

  // `anunciar` se acepta y se ignora (M25, 20-oct-2026): las clases de V-AI-P
  // no publican anuncio —los anuncios son de los cursos y los avisos de V-AI-P
  // van fijados en su Muro—. Un 400 rompería a quien ya lo manda.

  await emitirEvento('sesion.creada', {
    sesionId: data.id,
    titulo: data.title,
    inicio: data.scheduled_at,
    tipo: datos.tipo,
    plan: ctx.plan.slug,
  })
  return json({ id: data.id }, 201)
}

export async function cancelarEvento(ctx: ContextoApi, id: string): Promise<Response> {
  const { casaId } = exigirCasa(ctx)
  const generaciones = await generacionesDeLaCasa(ctx, casaId)
  const { data } = await ctx.db.from('cohort_sessions').select('id').eq('id', id).in('cohort_id', generaciones).maybeSingle()
  if (!data) throw new ErrorApi(404, 'No existe esa sesión en este plan.')
  const { error } = await ctx.db.from('cohort_sessions').delete().eq('id', id)
  if (error) throw new Error(`No se pudo cancelar: ${error.message}`)
  return json({ id, cancelada: true })
}

// ==========================================================================
// El muro: hilos y respuestas
// ==========================================================================

export async function listarHilos(ctx: ContextoApi, soloSinRespuesta: boolean): Promise<Response> {
  const { casaId, casaSlug } = exigirCasa(ctx)
  const { data: posts } = await ctx.db
    .from('community_posts')
    .select('id, user_id, title, content_rich, created_at, attended_at, topic_id')
    .eq('course_id', casaId)
    .eq('status', 'visible')
    .order('created_at', { ascending: false })
    .limit(200)
  const ids = (posts ?? []).map((p) => p.id)
  const { data: comentarios } = ids.length
    ? await ctx.db
        .from('community_comments')
        .select('post_id, user_id, created_at')
        .in('post_id', ids)
        .eq('status', 'visible')
        .order('created_at')
    : { data: [] }
  const personas = [...new Set([...(posts ?? []).map((p) => p.user_id), ...(comentarios ?? []).map((c) => c.user_id)])]
  const { data: perfiles } = personas.length
    ? await ctx.db.from('profiles').select('user_id, full_name, email, role').in('user_id', personas)
    : { data: [] }
  const perfil = new Map((perfiles ?? []).map((p) => [p.user_id, p]))
  const esEquipo = (id: string) => EQUIPO.has(perfil.get(id)?.role ?? '')

  const hilos = (posts ?? [])
    .filter((p) => ctx.plan.esQa || !esCuentaQa(perfil.get(p.user_id)?.email))
    .map((p) => {
      const suyos = (comentarios ?? []).filter((c) => c.post_id === p.id)
      const ultimo = suyos.at(-1) ?? { user_id: p.user_id, created_at: p.created_at }
      const espera = !esEquipo(ultimo.user_id) && !(p.attended_at && Date.parse(p.attended_at) >= Date.parse(ultimo.created_at))
      return {
        id: p.id,
        titulo: p.title,
        texto: textoPlano(p.content_rich),
        autor: { nombre: perfil.get(p.user_id)?.full_name || 'Miembro', esEquipo: esEquipo(p.user_id) },
        creadoEn: p.created_at,
        respuestas: suyos.length,
        sinRespuesta: espera,
        esperaDesde: espera ? ultimo.created_at : null,
        url: `${ctx.base}/curso/${casaSlug}/comunidad`,
      }
    })
    .filter((h) => !soloSinRespuesta || h.sinRespuesta)
    .sort((a, b) =>
      soloSinRespuesta ? Date.parse(a.esperaDesde ?? a.creadoEn) - Date.parse(b.esperaDesde ?? b.creadoEn) : 0
    )
    .slice(0, 100)
  return json({ hilos })
}

export async function responderHilo(ctx: ContextoApi, id: string, texto: string): Promise<Response> {
  const { casaId } = exigirCasa(ctx)
  const { data: post } = await ctx.db
    .from('community_posts')
    .select('id')
    .eq('id', id)
    .eq('course_id', casaId)
    .eq('status', 'visible')
    .maybeSingle()
  if (!post) throw new ErrorApi(404, 'No existe ese hilo en el muro de este plan.')
  const autor = await cuentaDelEquipo(ctx)
  const { data, error } = await ctx.db
    .from('community_comments')
    .insert({ post_id: id, user_id: autor, content: texto, via: 'api', api_key_id: ctx.llave.id })
    .select('id')
    .single()
  if (error || !data) throw new Error(`No se pudo responder: ${error?.message}`)
  return json({ id: data.id }, 201)
}

// ==========================================================================
// Miembros y métricas
// ==========================================================================

type MiembroApi = {
  id: string
  nombre: string
  correo?: string
  empresa: string | null
  vigente: boolean
  accesoHasta: string | null
  miembroDesde: string | null
  ultimoAcceso: string | null
  puntos: number
  nivel: number
  suscripcion?: { estado: string; proximoCobro: string | null; seCancela: boolean } | null
}

async function miembros(ctx: ContextoApi): Promise<MiembroApi[]> {
  const { data: enlaces } = await ctx.db.from('membership_plan_courses').select('course_id').eq('plan_id', ctx.plan.id)
  const { data: cursos } = (enlaces ?? []).length
    ? await ctx.db.from('courses').select('id, slug').in('id', (enlaces ?? []).map((e) => e.course_id))
    : { data: [] }
  const ids = (cursos ?? []).filter((c) => ctx.plan.esQa || !esCursoQa(c.slug)).map((c) => c.id)
  if (ids.length === 0) return []

  const { data: inscripciones } = await ctx.db
    .from('enrollments')
    .select('user_id, expires_at, created_at')
    .in('course_id', ids)
    .eq('source', 'membresia')
    .eq('status', 'active')
  const porPersona = new Map<string, { hasta: (string | null)[]; desde: string }>()
  for (const e of inscripciones ?? []) {
    const previo = porPersona.get(e.user_id)
    porPersona.set(e.user_id, {
      hasta: [...(previo?.hasta ?? []), e.expires_at],
      desde: previo && previo.desde < e.created_at ? previo.desde : e.created_at,
    })
  }
  const personas = [...porPersona.keys()]
  if (personas.length === 0) return []

  const [{ data: perfiles }, { data: actividad }, { data: suscripciones }] = await Promise.all([
    ctx.db.from('profiles').select('user_id, full_name, email, company_id, last_sign_in_at, es_bot').in('user_id', personas),
    ctx.db.from('actividad_por_curso').select('*').in('course_id', ids).in('user_id', personas),
    ctx.tiene('cobros:leer')
      ? ctx.db
          .from('memberships')
          .select('user_id, status, current_period_end, cancel_at_period_end, access_until')
          .eq('plan_id', ctx.plan.id)
          .in('user_id', personas)
      : Promise.resolve({ data: [] }),
  ])
  const empresasIds = [...new Set((perfiles ?? []).map((p) => p.company_id).filter((v): v is string => v !== null))]
  const { data: empresas } = empresasIds.length
    ? await ctx.db.from('companies').select('id, name').in('id', empresasIds)
    : { data: [] }
  const empresa = new Map((empresas ?? []).map((e) => [e.id, e.name]))

  return (perfiles ?? [])
    .filter((p) => !p.es_bot && (ctx.plan.esQa || !esCuentaQa(p.email)))
    .map((p) => {
      const suma = (actividad ?? [])
        .filter((a) => a.user_id === p.user_id)
        .reduce<Actividad>(
          (acc, a) =>
            sumarActividad(acc, {
              lecciones: a.lecciones ?? 0,
              quizzes: a.quizzes ?? 0,
              tareas: a.tareas ?? 0,
              tareasAprobadas: a.tareas_aprobadas ?? 0,
              publicaciones: a.publicaciones ?? 0,
              comentarios: a.comentarios ?? 0,
              certificados: a.certificados ?? 0,
              dinamicas: a.dinamicas ?? 0,
            }),
          ACTIVIDAD_VACIA
        )
      const m = porPersona.get(p.user_id)!
      const hasta = m.hasta.includes(null) ? null : accesoMayor(m.hasta)
      const puntos = puntosDe(suma)
      const suya = (suscripciones ?? [])
        .filter((s) => s.user_id === p.user_id)
        .sort((a, b) => Date.parse(b.access_until ?? '') - Date.parse(a.access_until ?? ''))[0]
      return {
        id: p.user_id,
        nombre: p.full_name,
        ...(ctx.tiene('miembros:pii') ? { correo: p.email } : {}),
        empresa: p.company_id ? (empresa.get(p.company_id) ?? null) : null,
        vigente: hasta === null || vigente(hasta),
        accesoHasta: hasta,
        miembroDesde: m.desde,
        ultimoAcceso: p.last_sign_in_at,
        puntos,
        nivel: nivelDe(puntos).numero,
        ...(ctx.tiene('cobros:leer')
          ? {
              suscripcion: suya
                ? {
                    estado: suya.status,
                    proximoCobro: suya.status === 'active' && !suya.cancel_at_period_end ? suya.current_period_end : null,
                    seCancela: suya.cancel_at_period_end,
                  }
                : null,
            }
          : {}),
      }
    })
}

export async function listarMiembros(
  ctx: ContextoApi,
  filtros: { estado: 'todos' | 'vigentes' | 'vencidos'; inactivosDias: number | null }
): Promise<Response> {
  const limite = filtros.inactivosDias === null ? null : Date.now() - filtros.inactivosDias * 24 * 60 * 60 * 1000
  const lista = (await miembros(ctx)).filter((m) => {
    if (filtros.estado === 'vigentes' && !m.vigente) return false
    if (filtros.estado === 'vencidos' && m.vigente) return false
    if (limite !== null && m.ultimoAcceso && Date.parse(m.ultimoAcceso) >= limite) return false
    return true
  })
  return json({ miembros: lista, total: lista.length })
}

export async function metricas(ctx: ContextoApi): Promise<Response> {
  const inicioDeMes = new Date()
  inicioDeMes.setUTCDate(1)
  inicioDeMes.setUTCHours(0, 0, 0, 0)
  const desdeMes = inicioDeMes.getTime()
  const todos = await miembros(ctx)

  let proxima: { titulo: string; inicio: string; tipo: string } | null = null
  if (ctx.plan.casaId) {
    const generaciones = await generacionesDeLaCasa(ctx, ctx.plan.casaId)
    const { data } = generaciones.length
      ? await ctx.db
          .from('cohort_sessions')
          .select('title, scheduled_at, kind')
          .in('cohort_id', generaciones)
          .gte('scheduled_at', new Date().toISOString())
          .order('scheduled_at')
          .limit(1)
      : { data: [] }
    const s = data?.[0]
    proxima = s ? { titulo: s.title, inicio: s.scheduled_at, tipo: s.kind } : null
  }

  let cobradoEsteMes: number | undefined
  if (ctx.tiene('cobros:leer')) {
    const { data: facturas } = await ctx.db
      .from('membership_invoices')
      .select('amount, email')
      .eq('plan_id', ctx.plan.id)
      .eq('status', 'paid')
      .gte('created_at', inicioDeMes.toISOString())
    cobradoEsteMes = (facturas ?? [])
      .filter((f) => ctx.plan.esQa || !esCuentaQa(f.email))
      .reduce((total, f) => total + Number(f.amount), 0)
  }

  return json({
    plan: ctx.plan.slug,
    miembrosConAcceso: todos.filter((m) => m.vigente).length,
    nuevosEsteMes: todos.filter((m) => m.miembroDesde && Date.parse(m.miembroDesde) >= desdeMes).length,
    salieronEsteMes: todos.filter((m) => !m.vigente && m.accesoHasta && Date.parse(m.accesoHasta) >= desdeMes).length,
    inactivos7Dias: todos.filter(
      (m) => m.vigente && (!m.ultimoAcceso || Date.parse(m.ultimoAcceso) < Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length,
    proximaSesion: proxima,
    ...(cobradoEsteMes !== undefined ? { cobradoEsteMesMxn: cobradoEsteMes } : {}),
  })
}
