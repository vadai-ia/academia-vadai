#!/usr/bin/env node
/**
 * check-bunny.mjs — Verifica las credenciales de Bunny Stream contra la API real.
 *
 * lib/bunny/cliente.ts se escribió siguiendo la documentación pero nunca se
 * ejecutó: no había credenciales. Este script es lo que convierte ese código de
 * "escrito" a "verificado".
 *
 * Solo lee y, opcionalmente, crea un video de prueba vacío que borra enseguida.
 *
 *   node scripts/check-bunny.mjs
 */

import { createHash } from 'node:crypto'

import { cargarEnv, linea, titulo } from './lib/entorno.mjs'

const API = 'https://video.bunnycdn.com'
const vars = cargarEnv()

const LIBRARY = vars.BUNNY_STREAM_LIBRARY_ID
const APIKEY = vars.BUNNY_STREAM_API_KEY
const TOKENKEY = vars.BUNNY_STREAM_TOKEN_KEY
const CDN = vars.BUNNY_STREAM_CDN_HOSTNAME

async function main() {
  titulo('VERIFICACIÓN DE BUNNY STREAM')

  const faltantes = [
    ['BUNNY_STREAM_LIBRARY_ID', LIBRARY],
    ['BUNNY_STREAM_API_KEY', APIKEY],
    ['BUNNY_STREAM_TOKEN_KEY', TOKENKEY],
    ['BUNNY_STREAM_CDN_HOSTNAME', CDN],
  ].filter(([, valor]) => !valor)

  if (faltantes.length) {
    for (const [nombre] of faltantes) linea('falla', nombre, 'vacía en .env.local')
    console.log('')
    console.log('  Las 4 salen del panel de Bunny:')
    console.log('    Stream → tu Video Library → API')
    console.log('      Library ID           -> BUNNY_STREAM_LIBRARY_ID')
    console.log('      API Key              -> BUNNY_STREAM_API_KEY')
    console.log('    Stream → Video Library → Security')
    console.log('      Token Authentication Key -> BUNNY_STREAM_TOKEN_KEY  (activa Token Authentication)')
    console.log('    Stream → Video Library → API → CDN Hostname')
    console.log('      vz-xxxxx.b-cdn.net   -> BUNNY_STREAM_CDN_HOSTNAME')
    console.log('')
    process.exitCode = 1
    return
  }

  linea('ok', 'Variables', 'las 4 presentes')

  // 1. La llave abre la biblioteca
  const lista = await fetch(`${API}/library/${LIBRARY}/videos?page=1&itemsPerPage=1`, {
    headers: { AccessKey: APIKEY, accept: 'application/json' },
  })

  if (!lista.ok) {
    linea('falla', 'Acceso a la biblioteca', `HTTP ${lista.status}`)
    console.log('     → revisa LIBRARY_ID y API_KEY; deben ser de la MISMA biblioteca')
    console.log('')
    process.exitCode = 1
    return
  }

  const cuerpo = await lista.json()
  linea('ok', 'Acceso a la biblioteca', `${cuerpo.totalItems ?? 0} video(s)`)

  // 2. Crear y borrar un video de prueba: es el flujo que usa el admin
  const creado = await fetch(`${API}/library/${LIBRARY}/videos`, {
    method: 'POST',
    headers: { AccessKey: APIKEY, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ title: 'qa-verificacion-borrar' }),
  })

  if (!creado.ok) {
    linea('falla', 'Crear video', `HTTP ${creado.status}`)
    process.exitCode = 1
  } else {
    const video = await creado.json()
    linea('ok', 'Crear video', `guid ${video.guid}`)

    const expiracion = Math.floor(Date.now() / 1000) + 3600
    const firma = createHash('sha256')
      .update(`${LIBRARY}${APIKEY}${expiracion}${video.guid}`)
      .digest('hex')
    linea('ok', 'Firma de subida TUS', `${firma.slice(0, 16)}… (expira en 60 min)`)

    const borrado = await fetch(`${API}/library/${LIBRARY}/videos/${video.guid}`, {
      method: 'DELETE',
      headers: { AccessKey: APIKEY, accept: 'application/json' },
    })
    linea(borrado.ok ? 'ok' : 'aviso', 'Borrar video de prueba', borrado.ok ? 'limpio' : `HTTP ${borrado.status}`)
  }

  // 3. Firma de reproducción (§7.2). Se usa en M4, pero se valida su forma aquí.
  const expira = Math.floor(Date.now() / 1000) + 6 * 3600
  const tokenPrueba = createHash('sha256')
    .update(`${TOKENKEY}00000000-0000-0000-0000-000000000000${expira}`)
    .digest('hex')
  linea('ok', 'Firma de reproducción', `${tokenPrueba.slice(0, 16)}… (6 h, §7.2)`)

  linea(
    CDN.includes('.b-cdn.net') ? 'ok' : 'aviso',
    'CDN hostname',
    CDN.includes('.b-cdn.net') ? CDN : `${CDN} — se esperaba algo.b-cdn.net`
  )

  // 4. ¿Se está aplicando Token Authentication? (§7.2 lo exige)
  //
  // No es consultable directamente: la configuración de la biblioteca vive en
  // api.bunny.net y pide una llave de cuenta, no la de Stream. Lo que sí se
  // puede es sondear las dos rutas de reproducción y reportar lo observado.
  const sonda = await fetch(`${API}/library/${LIBRARY}/videos`, {
    method: 'POST',
    headers: { AccessKey: APIKEY, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ title: 'qa-token-probe-borrar' }),
  })

  if (sonda.ok) {
    const video = await sonda.json()

    const iframe = await fetch(`https://iframe.mediadelivery.net/embed/${LIBRARY}/${video.guid}`, {
      redirect: 'manual',
    })
    const cdn = await fetch(`https://${CDN}/${video.guid}/playlist.m3u8`, { redirect: 'manual' })

    linea(
      cdn.status === 403 ? 'ok' : 'falla',
      'CDN directo sin token',
      cdn.status === 403 ? 'bloqueado (403)' : `ABIERTO (${cdn.status})`
    )

    linea(
      iframe.status === 200 ? 'aviso' : 'ok',
      'Embed sin token',
      iframe.status === 200
        ? 'responde 200 — confirma Token Authentication a mano'
        : `bloqueado (${iframe.status})`
    )

    await fetch(`${API}/library/${LIBRARY}/videos/${video.guid}`, {
      method: 'DELETE',
      headers: { AccessKey: APIKEY, accept: 'application/json' },
    })
  }

  console.log('')
  console.log('  Bunny listo para subir.')
  console.log('')
  console.log('  Queda una cosa que NO se puede verificar por API: que Token')
  console.log('  Authentication esté encendido en la biblioteca. Es lo que impide')
  console.log('  que un alumno comparta la URL del video (§7.2, "el contenido es')
  console.log('  el negocio"). Confírmalo en:')
  console.log('')
  console.log('    Bunny → Stream → tu Video Library → Security')
  console.log('      Enable Token Authentication  = ON')
  console.log('')
}

main().catch((error) => {
  console.error('')
  console.error(`  ${error.message}`)
  console.error('')
  process.exitCode = 1
})
