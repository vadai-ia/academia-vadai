import 'server-only'

import { revalidatePath } from 'next/cache'

import { cuentaDelBot } from '@/lib/agente/publicar'
import type { ClienteAgente } from '@/lib/agente/servidor'
import { emitirEvento } from '@/lib/api/webhooks'
import type { Via } from '@/lib/agente/firma'
import { comoDocumento } from '@/lib/comunidad/documento'
import type { ImagenDelMuro } from '@/lib/comunidad/imagenes'
import { generacionDeLaCasa, planDeNoticias, urlDelMuro, type Casa } from '@/lib/noticias/casa'

/**
 * Publicar en el muro de V-AI-P a nombre del equipo (M24): UNA sola forma,
 * para el compositor del panel, las noticias del agente y la API. Antes cada
 * uno resolvía por su cuenta el tema, la generación y la cuenta del equipo.
 *
 * Recibe el cliente del agente (service role), así que quien llama ya pasó
 * por `exigirEquipo()` (panel), por la llave de la API o por el cron.
 *
 * Si trae `noticiaId`, primero marca esa propuesta como publicada SOLO si
 * seguía en propuesta (`update … where estado='propuesta' returning`): un
 * doble clic, o dos personas a la vez, publican una vez.
 */

export type EntradaDelEquipo = {
  casa: Casa
  /** Slug del tema de la casa (`noticias`, `avisos`, …) o null. */
  tema: string | null
  titulo: string
  texto: string
  resumen?: string | null
  enlace?: { url: string; medio: string | null } | null
  imagenes?: ImagenDelMuro[]
  /** `equipo`: la cuenta «Equipo VADAI». Un user_id: firma esa persona. */
  autor: 'equipo' | string
  via: Via
  apiKeyId?: string | null
  /** Quién del equipo lo publicó (cuando firma «Equipo VADAI»). */
  publicadoPor?: string | null
  /** Fijar arriba del muro: hasta esa fecha, o `sin_fin`. */
  fijar?: Date | 'sin_fin' | null
  /** La propuesta de noticia que se publica. */
  noticiaId?: string | null
}

export type Publicado = { id: string; url: string }

function registrar(operacion: string, detalle: Record<string, unknown>) {
  console.error(JSON.stringify({ operacion, ...detalle }))
}

export async function publicarComoEquipo(db: ClienteAgente, e: EntradaDelEquipo): Promise<Publicado | { error: string }> {
  const autor = e.autor === 'equipo' ? await cuentaDelBot(db) : e.autor
  if (!autor) return { error: 'Falta la cuenta «Equipo VADAI» (node scripts/cuenta-equipo-vadai.mjs).' }

  let temaId: string | null = null
  if (e.tema) {
    const { data } = await db.from('community_topics').select('id').eq('course_id', e.casa.id).eq('slug', e.tema).maybeSingle()
    if (!data) return { error: `El muro no tiene el tema «${e.tema}».` }
    temaId = data.id
  }

  if (e.noticiaId) {
    const { data: tomada } = await db
      .from('news_items')
      .update({ estado: 'publicada', revisado_por: e.publicadoPor ?? null, revisado_en: new Date().toISOString() })
      .eq('id', e.noticiaId)
      .eq('estado', 'propuesta')
      .select('id')
    if (!tomada?.length) return { error: 'Esa noticia ya se publicó o se descartó.' }
  }

  const fijada = e.fijar ? { pinned: true, pinned_until: e.fijar === 'sin_fin' ? null : e.fijar.toISOString() } : {}
  const { data, error } = await db
    .from('community_posts')
    .insert({
      course_id: e.casa.id,
      cohort_id: await generacionDeLaCasa(db, e.casa.id),
      user_id: autor,
      title: e.titulo.trim().slice(0, 160),
      content_rich: comoDocumento(e.texto),
      images: e.imagenes ?? [],
      topic_id: temaId,
      via: e.via,
      api_key_id: e.apiKeyId ?? null,
      resumen: e.resumen?.trim() || null,
      enlace_url: e.enlace?.url ?? null,
      enlace_medio: e.enlace?.medio?.slice(0, 80) ?? null,
      publicado_por: e.publicadoPor ?? null,
      status: 'visible',
      ...fijada,
    })
    .select('id')
    .single()

  if (error || !data) {
    registrar('publicarComoEquipo', { casa: e.casa.id, tema: e.tema, error: error?.message })
    if (e.noticiaId) await db.from('news_items').update({ estado: 'propuesta', revisado_por: null, revisado_en: null }).eq('id', e.noticiaId)
    return { error: 'No se pudo publicar.' }
  }

  if (e.noticiaId) {
    const { error: errorLiga } = await db.from('news_items').update({ post_id: data.id }).eq('id', e.noticiaId)
    if (errorLiga) registrar('publicarComoEquipo:ligar', { noticia: e.noticiaId, error: errorLiga.message })
  }

  const url = urlDelMuro(e.casa, e.tema, data.id)
  if (e.tema === 'noticias') {
    await emitirEvento('noticia.publicada', { noticiaId: data.id, titulo: e.titulo, url, plan: planDeNoticias() })
  }

  revalidatePath('/vaip')
  revalidatePath(`/curso/${e.casa.slug}/comunidad`)
  revalidatePath('/mis-cursos')
  revalidatePath('/admin/vaip', 'layout')
  return { id: data.id, url }
}
