import 'server-only'

import { createHmac, randomUUID } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

import { after } from 'next/server'

import type { EventoDeWebhook } from '@/lib/api/permisos'
import type { Json } from '@/lib/supabase/types'
import { crearClienteServiceRole } from '@/lib/supabase/service-role'

/**
 * Los webhooks salientes (M20): cuando pasa algo en la comunidad, se avisa a
 * las plataformas que lo pidieron (Zapier, Make, n8n…).
 *
 *   - Cola: cada aviso es una fila en `webhook_entregas`, con un id de evento
 *     que se repite en cada reintento (el receptor no lo procesa dos veces).
 *   - Se manda después de responder (`after`) y el cron reintenta lo que falló
 *     con espera creciente. Tras 6 intentos la entrega queda fallida; tras 10
 *     fallas seguidas, el webhook se apaga solo.
 *   - Firma: `X-VADAI-Firma: t=<unix>,v1=<HMAC-SHA256(secreto, "t.cuerpo")>`.
 *     El secreto NO se guarda: es HMAC(WEBHOOKS_MASTER, "id:versión").
 *   - Solo https y solo a direcciones públicas: se resuelve el nombre y se
 *     rechaza cualquier IP privada, local o de enlace (SSRF), sin seguir
 *     redirecciones y con 5 segundos de espera máxima.
 *   - Los datos llevan ids y títulos, nunca correos.
 */

const ESPERAS_MIN = [1, 5, 30, 120, 360]
const INTENTOS_MAX = 6
const FALLAS_PARA_APAGAR = 10

function maestro(): string | null {
  const valor = process.env.WEBHOOKS_MASTER ?? ''
  return valor.length >= 32 ? valor : null
}

export function webhooksConfigurados(): boolean {
  return maestro() !== null
}

export function secretoDeWebhook(id: string, version: number): string {
  const m = maestro()
  if (!m) throw new Error('Falta WEBHOOKS_MASTER (32 caracteres o más) en el servidor.')
  return `whsec_vadai_${createHmac('sha256', m).update(`${id}:${version}`).digest('hex').slice(0, 40)}`
}

export function firmar(secreto: string, cuerpo: string, t = Math.floor(Date.now() / 1000)): string {
  return `t=${t},v1=${createHmac('sha256', secreto).update(`${t}.${cuerpo}`).digest('hex')}`
}

function ipPrivada(ip: string): boolean {
  if (isIP(ip) === 6) {
    const x = ip.toLowerCase()
    if (x === '::1' || x === '::' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe80')) return true
    const mapeada = x.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    return mapeada ? ipPrivada(mapeada[1]!) : false
  }
  const [a = 0, b = 0] = ip.split('.').map(Number)
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  )
}

/** ¿Se puede mandar a esta URL? https y un host que resuelve a IPs públicas. */
export async function destinoSeguro(url: string): Promise<string | null> {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return 'La URL no es válida.'
  }
  if (u.protocol !== 'https:') return 'Solo se aceptan URLs https.'
  if (u.username || u.password) return 'La URL no puede llevar usuario ni contraseña.'
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return 'Ese destino no es público.'
  try {
    const direcciones = isIP(host) ? [{ address: host }] : await lookup(host, { all: true })
    if (direcciones.length === 0 || direcciones.some((d) => ipPrivada(d.address))) return 'Ese destino no es público.'
  } catch {
    return 'No se pudo resolver el destino.'
  }
  return null
}

/**
 * Solo para las suites: con `WEBHOOKS_RECEPTOR_DE_PRUEBA` (un http://127.0.0.1
 * o localhost), lo que va al host reservado `qa-webhooks.invalid` se manda ahí.
 * En producción la variable no existe y `.invalid` nunca resuelve: falla solo.
 */
export function esDestinoDePrueba(url: string): boolean {
  return destinoDePrueba(url) !== null
}

function esWebhookQa(url: string): boolean {
  try {
    return new URL(url).hostname === 'qa-webhooks.invalid'
  } catch {
    return false
  }
}

function esEventoQa(datos: Record<string, Json>): boolean {
  const plan = datos.plan
  const url = datos.url
  return (typeof plan === 'string' && plan.startsWith('qa-')) || (typeof url === 'string' && url.includes('/curso/qa-'))
}

function destinoDePrueba(url: string): string | null {
  const receptor = process.env.WEBHOOKS_RECEPTOR_DE_PRUEBA
  if (!receptor || !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(receptor)) return null
  try {
    const u = new URL(url)
    return u.hostname === 'qa-webhooks.invalid' ? `${receptor}${u.pathname}` : null
  } catch {
    return null
  }
}

/**
 * Encola el evento para cada webhook activo que lo escucha y lo manda después
 * de responder. Nunca rompe la operación que lo dispara: un fallo aquí solo se
 * registra.
 */
export async function emitirEvento(tipo: EventoDeWebhook, datos: Record<string, Json>): Promise<void> {
  try {
    const db = crearClienteServiceRole()
    const { data: suscritos } = await db.from('webhooks_salientes').select('id, url').eq('activo', true).contains('eventos', [tipo])
    // Lo de las suites (un plan o un curso `qa-…`) solo va al webhook de pruebas
    // (`qa-webhooks.invalid`), y lo real nunca va ahí (M21, 19-oct-2026): sin esto,
    // una noticia de prueba le llegaba al Zapier real de la academia.
    const qa = esEventoQa(datos)
    const webhooks = (suscritos ?? []).filter((w) => esWebhookQa(w.url) === qa)
    if (webhooks.length === 0) return
    const eventoId = `evt_${randomUUID()}`
    const { data: filas, error } = await db
      .from('webhook_entregas')
      .insert(webhooks.map((w) => ({ webhook_id: w.id, evento_id: eventoId, tipo, datos: { ...datos } })))
      .select('id')
    if (error) throw new Error(error.message)
    const ids = (filas ?? []).map((f) => f.id)
    after(() => entregarPendientes(ids))
  } catch (e) {
    console.error(JSON.stringify({ operacion: 'webhooks:emitir', tipo, error: e instanceof Error ? e.message : String(e) }))
  }
}

/** Manda las entregas pendientes que ya tocan (o las indicadas). La usa el cron. */
export async function entregarPendientes(ids?: string[]): Promise<{ entregadas: number; fallidas: number }> {
  const db = crearClienteServiceRole()
  let consulta = db
    .from('webhook_entregas')
    .select('id, webhook_id, evento_id, tipo, datos, intentos, created_at')
    .eq('estado', 'pendiente')
    .lte('proximo_intento', new Date().toISOString())
    .order('proximo_intento')
    .limit(50)
  if (ids) consulta = consulta.in('id', ids)
  const { data: entregas } = await consulta
  let entregadas = 0
  let fallidas = 0

  for (const e of entregas ?? []) {
    const { data: w } = await db
      .from('webhooks_salientes')
      .select('id, url, activo, secreto_version, fallas_seguidas')
      .eq('id', e.webhook_id)
      .maybeSingle()
    if (!w || !w.activo) {
      await db.from('webhook_entregas').update({ estado: 'fallida', ultimo_error: 'El webhook está apagado.' }).eq('id', e.id)
      continue
    }

    const cuerpo = JSON.stringify({ id: e.evento_id, tipo: e.tipo, creado: e.created_at, datos: e.datos })
    const prueba = destinoDePrueba(w.url)
    let problema = prueba ? null : await destinoSeguro(w.url)
    if (!problema) {
      try {
        const r = await fetch(prueba ?? w.url, {
          method: 'POST',
          redirect: 'manual',
          signal: AbortSignal.timeout(5000),
          headers: {
            'content-type': 'application/json',
            'user-agent': 'VADAI-Academia-Webhooks/1',
            'x-vadai-evento': e.tipo,
            'x-vadai-id': e.evento_id,
            'x-vadai-firma': firmar(secretoDeWebhook(w.id, w.secreto_version), cuerpo),
          },
          body: cuerpo,
        })
        if (r.status < 200 || r.status >= 300) problema = `Respondió ${r.status}.`
      } catch (x) {
        problema = x instanceof Error ? x.message.slice(0, 200) : 'Falló la conexión.'
      }
    }

    if (!problema) {
      entregadas += 1
      await db.from('webhook_entregas').update({ estado: 'entregada', entregada_at: new Date().toISOString(), intentos: e.intentos + 1, ultimo_error: null }).eq('id', e.id)
      if (w.fallas_seguidas > 0) await db.from('webhooks_salientes').update({ fallas_seguidas: 0 }).eq('id', w.id)
      continue
    }

    fallidas += 1
    const intentos = e.intentos + 1
    const espera = ESPERAS_MIN[Math.min(intentos - 1, ESPERAS_MIN.length - 1)] ?? 360
    await db
      .from('webhook_entregas')
      .update({
        intentos,
        ultimo_error: problema,
        estado: intentos >= INTENTOS_MAX ? 'fallida' : 'pendiente',
        proximo_intento: new Date(Date.now() + espera * 60 * 1000).toISOString(),
      })
      .eq('id', e.id)
    const fallas = w.fallas_seguidas + 1
    await db
      .from('webhooks_salientes')
      .update(
        fallas >= FALLAS_PARA_APAGAR
          ? { fallas_seguidas: fallas, activo: false, desactivado_en: new Date().toISOString() }
          : { fallas_seguidas: fallas }
      )
      .eq('id', w.id)
  }
  return { entregadas, fallidas }
}
