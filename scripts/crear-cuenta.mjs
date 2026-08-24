#!/usr/bin/env node
/**
 * crear-cuenta.mjs — Da de alta una cuenta real desde la terminal.
 *
 * Existe porque faltaba la primera pieza de todas: la plataforma no tenía cómo
 * crear a su propio dueño. El webhook de Stripe y el alta manual del panel solo
 * crean `alumno`, y el panel exige ya ser admin para entrar — un candado con la
 * llave adentro.
 *
 * Sin esto, la única forma de entrar era con una de las cuentas QA.
 *
 *   pnpm cuenta:crear -- --correo=alguien@dominio.com --rol=superadmin \
 *                       --nombre="Nombre Apellido"
 *
 * Es idempotente: si la cuenta ya existe, no la duplica — ajusta el perfil y
 * te vuelve a dar un enlace de acceso.
 *
 * Manda el correo de bienvenida por Resend salvo que pases `--sin-correo`. A
 * direcciones QA nunca manda: ese dominio no tiene MX y cada intento sería un
 * rebote duro contra la reputación compartida (ver lib/correo/resend.ts).
 */

import { cargarEnv, conectarPostgres, exigir, linea, titulo } from './lib/entorno.mjs'

const vars = cargarEnv()
const URL_BASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')
const APP = (vars.NEXT_PUBLIC_APP_URL ?? 'https://academia.vadai.com.mx').replace(/\/+$/, '')

const cabeceras = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  'Content-Type': 'application/json',
}

const ROLES = ['superadmin', 'admin', 'alumno']

function argumento(nombre) {
  const bandera = process.argv.find((a) => a.startsWith(`--${nombre}=`))
  return bandera ? bandera.slice(nombre.length + 3) : null
}

const correo = (argumento('correo') ?? '').trim().toLowerCase()
const rol = (argumento('rol') ?? 'alumno').trim()
const nombre = (argumento('nombre') ?? '').trim()
const sinCorreo = process.argv.includes('--sin-correo')

function ayuda(motivo) {
  titulo('CREAR CUENTA')
  if (motivo) {
    console.log(`  ${motivo}`)
    console.log('')
  }
  console.log('  Uso:')
  console.log('    pnpm cuenta:crear -- --correo=x@dominio.com --rol=admin --nombre="Nombre"')
  console.log('')
  console.log(`  --rol         ${ROLES.join(' | ')}   (por defecto: alumno)`)
  console.log('  --nombre      El que se imprime en el certificado. Opcional pero conviene.')
  console.log('  --sin-correo  No manda la bienvenida; imprime el enlace y ya.')
  console.log('')
  process.exitCode = motivo ? 1 : 0
}

/** El usuario de auth, si ya existe. */
async function buscar(email) {
  const res = await fetch(`${URL_BASE}/auth/v1/admin/users?per_page=1000`, { headers: cabeceras })
  if (!res.ok) return null
  const cuerpo = await res.json()
  const lista = Array.isArray(cuerpo?.users) ? cuerpo.users : []
  return lista.find((u) => u.email?.toLowerCase() === email) ?? null
}

async function crearUsuario(email) {
  const res = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
    method: 'POST',
    headers: cabeceras,
    body: JSON.stringify({
      email,
      // Confirmado de entrada: la cuenta la crea el equipo, no un desconocido
      // que tenga que demostrar que el buzón es suyo. Y sin esto no podría
      // entrar con Google, porque Supabase trataría el correo como sin
      // verificar y con el signup deshabilitado lo rechazaría.
      email_confirm: true,
      user_metadata: nombre ? { full_name: nombre } : {},
    }),
  })

  const cuerpo = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`No se pudo crear el usuario: ${cuerpo?.msg ?? res.status}`)
  return cuerpo
}

/** Enlace de acceso armado contra NUESTRO dominio, no el de Supabase. */
async function enlaceDeAcceso(email) {
  const res = await fetch(`${URL_BASE}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: cabeceras,
    body: JSON.stringify({ type: 'recovery', email }),
  })

  const cuerpo = await res.json().catch(() => null)
  const token = cuerpo?.hashed_token ?? cuerpo?.properties?.hashed_token
  if (!token) return null

  return (
    `${APP}/auth/confirmar?token_hash=${encodeURIComponent(token)}` +
    `&type=recovery&proximo=${encodeURIComponent('/nueva-contrasena')}`
  )
}

const esQA = (email) => email.startsWith('qa-') && email.endsWith('@academia.vadai.com.mx')

async function mandarBienvenida(email, enlace) {
  if (esQA(email)) {
    linea('aviso', 'correo', 'omitido: dirección QA, ese dominio rebota')
    return
  }
  if (!vars.RESEND_API_KEY) {
    linea('aviso', 'correo', 'no se mandó: falta RESEND_API_KEY')
    return
  }

  const remitente = `${vars.CORREO_REMITENTE_NOMBRE ?? 'VADAI Academia'} <${
    vars.CORREO_REMITENTE ?? 'noreply@automail.vadai.com.mx'
  }>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${vars.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: remitente,
      to: [email],
      subject: 'Tu acceso a VADAI Academia',
      text:
        `Ya tienes acceso a VADAI Academia.\n\n` +
        `Define tu contraseña aquí:\n${enlace}\n\n` +
        `El enlace sirve una sola vez. Si vence, pide otro desde ` +
        `"¿La olvidaste?" en ${APP}/login\n`,
    }),
  })

  const cuerpo = await res.json().catch(() => null)
  linea(res.ok ? 'ok' : 'falla', 'correo', res.ok ? `enviado (${cuerpo?.id})` : cuerpo?.message ?? res.status)
}

async function main() {
  if (process.argv.includes('--ayuda') || process.argv.includes('-h')) return ayuda(null)
  if (!correo || !correo.includes('@')) return ayuda('Falta --correo, o no parece un correo.')
  if (!ROLES.includes(rol)) return ayuda(`Rol inválido: "${rol}". Usa ${ROLES.join(', ')}.`)

  titulo('CREAR CUENTA')
  console.log(`  Correo:  ${correo}`)
  console.log(`  Rol:     ${rol}`)
  console.log(`  Nombre:  ${nombre || '(sin nombre — el certificado saldría sin él)'}`)
  console.log('')

  const existente = await buscar(correo)
  const usuario = existente ?? (await crearUsuario(correo))
  linea('ok', 'auth.users', existente ? `ya existía (${usuario.id})` : `creado (${usuario.id})`)

  const bd = await conectarPostgres(vars)

  try {
    // El perfil manda: sin fila aquí, estar autenticado no sirve de nada
    // (Regla Cero — el middleware manda a sin-acceso).
    const { rows } = await bd.query(
      `insert into academia.profiles (user_id, email, full_name, role, status)
       values ($1, $2, $3, $4, 'active')
       on conflict (user_id) do update
         set role = excluded.role,
             status = 'active',
             full_name = case
               when excluded.full_name <> '' then excluded.full_name
               else academia.profiles.full_name
             end
       returning role, status, full_name`,
      [usuario.id, correo, nombre, rol]
    )

    const perfil = rows[0]
    linea('ok', 'academia.profiles', `${perfil.role} · ${perfil.status}`)
  } finally {
    await bd.end().catch(() => {})
  }

  const enlace = await enlaceDeAcceso(correo)

  if (!enlace) {
    linea('falla', 'enlace', 'no se pudo generar')
    process.exitCode = 1
    return
  }

  if (!sinCorreo) await mandarBienvenida(correo, enlace)

  console.log('')
  console.log('  Enlace para definir contraseña (un solo uso):')
  console.log('')
  console.log(`    ${enlace}`)
  console.log('')
  console.log('  También puede entrar con Google usando este mismo correo: ahora que')
  console.log('  la cuenta existe, el signup deshabilitado ya no lo bloquea.')
  console.log('')
}

main().catch((error) => {
  console.error('')
  console.error(`  ${error.message}`)
  console.error('')
  process.exitCode = 1
})
