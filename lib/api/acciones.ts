'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { apiConfigurada, nuevaLlave } from '@/lib/api/llaves'
import { esEventoDeWebhook, esPermiso, type Permiso } from '@/lib/api/permisos'
import { destinoSeguro, entregarPendientes, esDestinoDePrueba, secretoDeWebhook, webhooksConfigurados } from '@/lib/api/webhooks'
import { exigirAdmin } from '@/lib/auth/sesion'
import { crearClienteServidor } from '@/lib/supabase/server'
import { crearClienteServiceRole } from '@/lib/supabase/service-role'

/**
 * Ajustes → API (M20), solo admin: las llaves de la API y los webhooks
 * salientes. Con la sesión del admin (RLS `is_admin()`), salvo «Mandar
 * prueba», que entrega por la misma cola que usa la plataforma.
 *
 * La llave completa y el secreto de un webhook se devuelven UNA vez, en el
 * estado de la acción: en la base no quedan.
 */

export type EstadoApi = { error?: string; aviso?: string; secreto?: string }

const RUTA = '/admin/ajustes/api'
const uuid = z.uuid()

function registrarFallo(operacion: string, detalle: Record<string, unknown>, error: string) {
  console.error(JSON.stringify({ operacion, ...detalle, error }))
}

export async function crearLlaveApi(_previo: EstadoApi, datos: FormData): Promise<EstadoApi> {
  const perfil = await exigirAdmin()
  if (!apiConfigurada()) return { error: 'Falta API_KEYS_PEPPER en el servidor: sin él no se pueden crear llaves.' }
  const nombre = String(datos.get('nombre') ?? '').trim()
  if (nombre.length < 2 || nombre.length > 80) return { error: 'Ponle un nombre que diga para qué es (2 a 80 letras).' }
  const permisos = datos.getAll('permisos').filter(esPermiso) as Permiso[]
  if (permisos.length === 0) return { error: 'Elige al menos un permiso.' }

  // Ver cobros es delicado: la llave vence en 90 días o menos.
  let dias = Number(datos.get('vence_dias') ?? 0)
  if (!Number.isFinite(dias) || dias < 0) dias = 0
  if (permisos.includes('cobros:leer') && (dias === 0 || dias > 90)) dias = 90

  // Una hora de margen: la base mide los 90 días con SU reloj (created_at), y si
  // el de este servidor va unos milisegundos adelante, 90 días exactos se pasan.
  const vence = dias > 0 ? new Date(Date.now() + dias * 24 * 60 * 60 * 1000 - 60 * 60 * 1000).toISOString() : null
  const llave = nuevaLlave()
  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('api_keys').insert({
    nombre,
    key_id: llave.keyId,
    hash: llave.hash,
    permisos,
    creada_por: perfil.user_id,
    expires_at: vence,
  })
  if (error) {
    registrarFallo('crearLlaveApi', { nombre }, error.message)
    return { error: 'No se pudo crear la llave.' }
  }
  revalidatePath(RUTA)
  return {
    aviso: `Llave «${nombre}» creada. Cópiala ahora: es la única vez que se muestra.`,
    secreto: llave.completa,
  }
}

export async function revocarLlaveApi(datos: FormData): Promise<void> {
  await exigirAdmin()
  const id = String(datos.get('id') ?? '')
  if (!uuid.safeParse(id).success) return
  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', id).is('revoked_at', null)
  if (error) registrarFallo('revocarLlaveApi', { id }, error.message)
  revalidatePath(RUTA)
}

export async function crearWebhook(_previo: EstadoApi, datos: FormData): Promise<EstadoApi> {
  const perfil = await exigirAdmin()
  if (!webhooksConfigurados()) return { error: 'Falta WEBHOOKS_MASTER en el servidor: sin él no se pueden firmar los avisos.' }
  const nombre = String(datos.get('nombre') ?? '').trim()
  const url = String(datos.get('url') ?? '').trim()
  const eventos = datos.getAll('eventos').filter(esEventoDeWebhook)
  if (nombre.length < 2 || nombre.length > 80) return { error: 'Ponle un nombre (2 a 80 letras).' }
  if (eventos.length === 0) return { error: 'Elige al menos un evento.' }
  // El host reservado de las suites solo pasa con el receptor de pruebas configurado.
  const problema = esDestinoDePrueba(url) ? null : await destinoSeguro(url)
  if (problema) return { error: problema }

  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('webhooks_salientes')
    .insert({ nombre, url, eventos, creado_por: perfil.user_id })
    .select('id, secreto_version')
    .single()
  if (error || !data) {
    registrarFallo('crearWebhook', { nombre }, error?.message ?? 'sin fila')
    return { error: 'No se pudo registrar el webhook.' }
  }
  revalidatePath(RUTA)
  return {
    aviso: `Webhook «${nombre}» registrado. Este es su secreto para verificar la firma; guárdalo.`,
    secreto: secretoDeWebhook(data.id, data.secreto_version),
  }
}

export async function alternarWebhook(datos: FormData): Promise<void> {
  await exigirAdmin()
  const id = String(datos.get('id') ?? '')
  if (!uuid.safeParse(id).success) return
  const encender = datos.get('encender') === 'si'
  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('webhooks_salientes')
    .update(encender ? { activo: true, fallas_seguidas: 0, desactivado_en: null } : { activo: false, desactivado_en: new Date().toISOString() })
    .eq('id', id)
  if (error) registrarFallo('alternarWebhook', { id }, error.message)
  revalidatePath(RUTA)
}

export async function rotarSecretoWebhook(_previo: EstadoApi, datos: FormData): Promise<EstadoApi> {
  await exigirAdmin()
  const id = String(datos.get('id') ?? '')
  if (!uuid.safeParse(id).success) return { error: 'Webhook inválido.' }
  if (!webhooksConfigurados()) return { error: 'Falta WEBHOOKS_MASTER en el servidor.' }
  const supabase = await crearClienteServidor()
  const { data: actual } = await supabase.from('webhooks_salientes').select('secreto_version').eq('id', id).maybeSingle()
  if (!actual) return { error: 'Ese webhook ya no existe.' }
  const version = actual.secreto_version + 1
  const { error } = await supabase.from('webhooks_salientes').update({ secreto_version: version }).eq('id', id)
  if (error) {
    registrarFallo('rotarSecretoWebhook', { id }, error.message)
    return { error: 'No se pudo rotar el secreto.' }
  }
  revalidatePath(RUTA)
  return { aviso: 'Secreto nuevo. El anterior deja de valer desde ya.', secreto: secretoDeWebhook(id, version) }
}

/** Manda un evento `prueba` a ese webhook, por la misma cola, y dice qué respondió. */
export async function probarWebhook(_previo: EstadoApi, datos: FormData): Promise<EstadoApi> {
  await exigirAdmin()
  const id = String(datos.get('id') ?? '')
  if (!uuid.safeParse(id).success) return { error: 'Webhook inválido.' }
  // Service role: la cola solo la escribe el servidor (la tabla es de lectura para el admin).
  const db = crearClienteServiceRole()
  const { data, error } = await db
    .from('webhook_entregas')
    .insert({ webhook_id: id, evento_id: `evt_prueba_${crypto.randomUUID()}`, tipo: 'prueba', datos: { mensaje: 'Prueba desde Ajustes → API' } })
    .select('id')
    .single()
  if (error || !data) return { error: 'No se pudo encolar la prueba.' }
  await entregarPendientes([data.id])
  const { data: entrega } = await db.from('webhook_entregas').select('estado, ultimo_error').eq('id', data.id).maybeSingle()
  revalidatePath(RUTA)
  return entrega?.estado === 'entregada'
    ? { aviso: 'Llegó: el destino respondió con un 2xx.' }
    : { error: `No llegó: ${entrega?.ultimo_error ?? 'sin respuesta'}. Se reintenta solo.` }
}
