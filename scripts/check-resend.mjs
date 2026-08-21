#!/usr/bin/env node
/**
 * check-resend.mjs — Diagnóstico de correo transaccional.
 *
 * Habla directo con la API de Resend, sin Supabase en medio. Supabase solo
 * devuelve "Error sending recovery email" y eso no dice nada; aquí se ve el
 * error exacto: si es la llave, el dominio, el remitente o el destinatario.
 *
 *   node scripts/check-resend.mjs                 # envía a una dirección QA
 *   node scripts/check-resend.mjs tu@correo.com   # envía a un buzón real
 *
 * Manda un correo de verdad. Es el único modo de saber que el correo sale.
 */

import { cargarEnv, linea, titulo } from './lib/entorno.mjs'

const API = 'https://api.resend.com'
const REMITENTE = 'noreply@automail.vadai.com.mx'
const DESTINO_POR_DEFECTO = 'qa-alumno1@academia.vadai.com.mx'

const vars = cargarEnv()
const LLAVE = vars.RESEND_API_KEY
const destino = process.argv[2] ?? DESTINO_POR_DEFECTO

async function api(ruta, opciones = {}) {
  const respuesta = await fetch(`${API}${ruta}`, {
    ...opciones,
    headers: {
      Authorization: `Bearer ${LLAVE}`,
      'Content-Type': 'application/json',
      ...(opciones.headers ?? {}),
    },
  })
  const cuerpo = await respuesta.json().catch(() => null)
  return { status: respuesta.status, cuerpo }
}

async function main() {
  titulo('DIAGNÓSTICO DE RESEND')

  if (!LLAVE) {
    linea('falla', 'RESEND_API_KEY', 'vacía en .env.local')
    console.log('\n  Sácala de Resend → API keys → Create.\n')
    process.exitCode = 1
    return
  }

  linea(
    LLAVE.startsWith('re_') && !/\s/.test(LLAVE) ? 'ok' : 'falla',
    'Formato de la llave',
    `${LLAVE.length} caracteres, empieza con "${LLAVE.slice(0, 3)}"`
  )

  // 1. ¿La llave sirve, y para qué dominios?
  const dominios = await api('/domains')

  if (dominios.status === 401) {
    linea('falla', 'Autenticación', 'la llave fue rechazada (401)')
    console.log('\n  La API key no es válida. Genera una nueva en Resend → API keys.')
    console.log('  Ojo: si la regeneras, hay que actualizarla también en Supabase.\n')
    process.exitCode = 1
    return
  }

  if (dominios.status !== 200) {
    linea('falla', 'GET /domains', `${dominios.status} ${JSON.stringify(dominios.cuerpo).slice(0, 160)}`)
    process.exitCode = 1
    return
  }

  const lista = dominios.cuerpo?.data ?? []
  linea('ok', 'Autenticación', `la llave funciona · ${lista.length} dominio(s)`)

  for (const d of lista) {
    const verificado = d.status === 'verified'
    linea(verificado ? 'ok' : 'falla', `Dominio ${d.name}`, `${d.status} · ${d.region ?? ''}`.trim())
  }

  const nuestro = lista.find((d) => REMITENTE.endsWith(`@${d.name}`))
  if (!nuestro) {
    linea('falla', 'Remitente', `${REMITENTE} no corresponde a ningún dominio de la cuenta`)
    console.log('\n  El remitente configurado en Supabase debe pertenecer a un dominio')
    console.log('  verificado en ESTA cuenta de Resend.\n')
    process.exitCode = 1
    return
  }

  // 2. El envío de verdad, que es lo que Supabase no logra
  const envio = await api('/emails', {
    method: 'POST',
    body: JSON.stringify({
      from: `VADAI Academia <${REMITENTE}>`,
      to: [destino],
      subject: 'Prueba de envío · VADAI Academia',
      text:
        'Si estás leyendo esto, el correo transaccional de la academia funciona.\n\n' +
        'Enviado por scripts/check-resend.mjs.',
    }),
  })

  if (envio.status === 200 || envio.status === 202) {
    linea('ok', 'Envío', `aceptado · id ${envio.cuerpo?.id ?? 'sin id'}`)
    console.log('')
    console.log(`  Resend aceptó el correo para ${destino}.`)
    console.log('  Revísalo en Resend → Logs para ver si se entregó o rebotó.')
    console.log('')
    console.log('  Si esto sale bien pero Supabase sigue dando 500, el problema')
    console.log('  está en las credenciales guardadas en Supabase, no en Resend:')
    console.log('    Host     smtp.resend.com')
    console.log('    Port     587')
    console.log('    Username resend        (literal, esa palabra)')
    console.log('    Password la API key completa, empezando con re_')
    console.log('  Y hay que darle Save.')
    console.log('')
    return
  }

  linea('falla', 'Envío', `${envio.status}`)
  console.log('')
  console.log('  Respuesta de Resend:')
  console.log('   ', JSON.stringify(envio.cuerpo))
  console.log('')

  const mensaje = String(envio.cuerpo?.message ?? '')
  if (/testing emails|own email address|verify a domain/i.test(mensaje)) {
    console.log('  Resend restringe a qué direcciones puedes escribir hasta tener un')
    console.log('  dominio verificado. Prueba mandándotelo a ti:')
    console.log('    node scripts/check-resend.mjs tucorreo@gmail.com')
    console.log('')
  }

  process.exitCode = 1
}

main().catch((error) => {
  console.error('')
  console.error(`  ${error.message}`)
  console.error('')
  process.exitCode = 1
})
