#!/usr/bin/env node
/**
 * cuenta-equipo-vadai.mjs — Crea la cuenta «Equipo VADAI» (M20). Una vez.
 *
 *   node scripts/cuenta-equipo-vadai.mjs
 *
 * Es la autora de lo que la academia publica sola: lo que llega por la API
 * (noticias, respuestas en el muro) y, desde M21, lo que contesta el agente.
 * Es un BOT, no una persona:
 *
 *   - rol `community_manager`: lo que escribe sale como «Equipo VADAI» y la
 *     bandeja lo cuenta como respuesta del equipo;
 *   - `es_bot = true`: no sale en Alumnos ni en las listas del equipo;
 *   - NO puede iniciar sesión: el usuario de Auth nace bloqueado y sin
 *     contraseña; su dirección no tiene buzón y el corte de correos
 *     (lib/correo/resend.ts) nunca le escribe.
 *
 * Idempotente: si ya existe, solo lo dice.
 */

import { cargarEnv, conectarPostgres, exigir, linea, titulo } from './lib/entorno.mjs'

const CORREO = 'equipo@academia.vadai.com.mx'
const NOMBRE = 'Equipo VADAI'

const vars = cargarEnv()
const URL_BASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')
const cabeceras = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' }

titulo('CUENTA «EQUIPO VADAI»')
const bd = await conectarPostgres(vars)
try {
  const { rows: [existente] } = await bd.query(`select user_id, es_bot from academia.profiles where lower(email) = $1`, [CORREO])
  if (existente) {
    if (!existente.es_bot) await bd.query(`update academia.profiles set es_bot = true where user_id = $1`, [existente.user_id])
    linea('ok', 'ya existía', existente.user_id)
    process.exit(0)
  }

  const res = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
    method: 'POST',
    headers: cabeceras,
    body: JSON.stringify({
      email: CORREO,
      email_confirm: true,
      // Bloqueada: no entra ni con liga mágica ni con recuperación.
      ban_duration: '876000h',
      user_metadata: { full_name: NOMBRE, bot: true },
    }),
  })
  const usuario = await res.json()
  if (!res.ok || !usuario.id) {
    linea('falla', 'auth', usuario.msg ?? usuario.message ?? JSON.stringify(usuario))
    process.exit(1)
  }

  await bd.query(
    `insert into academia.profiles (user_id, email, full_name, role, status, es_bot)
     values ($1, $2, $3, 'community_manager', 'active', true)
     on conflict (user_id) do update set full_name = excluded.full_name, role = excluded.role, es_bot = true`,
    [usuario.id, CORREO, NOMBRE]
  )
  linea('ok', 'creada', `${usuario.id} · bloqueada para iniciar sesión`)
} finally {
  await bd.end()
}
