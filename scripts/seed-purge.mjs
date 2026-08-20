#!/usr/bin/env node
/**
 * seed-purge.mjs — Borra los datos de prueba de M1.
 *
 * Es lo que cierra el criterio de M11: "datos de prueba purgados".
 *
 * Solo toca lo que lleva la marca QA: usuarios cuyo correo empieza con `qa-` y
 * las filas de academia.* con los UUID fijos de scripts/lib/qa.mjs. Nunca borra
 * por rango ni por fecha, para que no pueda llevarse por delante datos reales.
 *
 *   node scripts/seed-purge.mjs --confirmar
 */

import {
  cargarEnv,
  conectarPostgres,
  exigir,
  linea,
  titulo,
} from './lib/entorno.mjs'
import { IDS, PREFIJO_QA, USUARIOS_QA } from './lib/qa.mjs'

const CONFIRMADO = process.argv.includes('--confirmar')

const vars = cargarEnv()
const URL_BASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')

const cabeceras = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  'Content-Type': 'application/json',
}

async function usuarioPorCorreo(email) {
  const res = await fetch(
    `${URL_BASE}/auth/v1/admin/users?filter=${encodeURIComponent(email)}&per_page=200`,
    { headers: cabeceras }
  )
  if (!res.ok) return null
  const cuerpo = await res.json()
  const lista = Array.isArray(cuerpo?.users) ? cuerpo.users : []
  return lista.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null
}

async function main() {
  titulo('PURGA DE DATOS QA')

  if (!CONFIRMADO) {
    console.log('  Esto borra:')
    for (const u of USUARIOS_QA) console.log(`    - usuario ${u.email}`)
    console.log(`    - los 2 cursos QA y todo lo que cuelga de ellos (cascada)`)
    console.log('')
    console.log('  Nada más. No toca usuarios ni cursos reales.')
    console.log('')
    console.log('  Para ejecutarlo:  node scripts/seed-purge.mjs --confirmar')
    console.log('')
    return
  }

  const cliente = await conectarPostgres(vars)

  try {
    // Los cursos en cascada se llevan módulos, lecciones, inscripciones,
    // cohortes, quizzes, tareas, comunidad y anuncios asociados.
    const cursos = await cliente.query(
      'delete from academia.courses where id = any($1::uuid[]) returning slug',
      [[IDS.curso, IDS.cursoAjeno]]
    )
    for (const c of cursos.rows) linea('ok', `curso ${c.slug}`, 'borrado en cascada')

    // Por si quedó algo sembrado con el prefijo fuera de esos dos cursos.
    const perfiles = await cliente.query(
      `delete from academia.profiles where email like $1 returning email`,
      [`${PREFIJO_QA}%`]
    )
    for (const p of perfiles.rows) linea('ok', `perfil ${p.email}`, 'borrado')

    const restantes = await cliente.query(
      `select count(*)::int n from academia.profiles where email like $1`,
      [`${PREFIJO_QA}%`]
    )
    if (restantes.rows[0].n > 0) {
      linea('falla', 'quedaron perfiles QA', String(restantes.rows[0].n))
      process.exitCode = 1
    }
  } finally {
    await cliente.end().catch(() => {})
  }

  // Los usuarios de auth se borran con la Admin API, no con SQL.
  for (const u of USUARIOS_QA) {
    const existente = await usuarioPorCorreo(u.email)
    if (!existente) {
      linea('aviso', u.email.padEnd(42), 'no existía')
      continue
    }
    const res = await fetch(`${URL_BASE}/auth/v1/admin/users/${existente.id}`, {
      method: 'DELETE',
      headers: cabeceras,
    })
    linea(res.ok ? 'ok' : 'falla', u.email.padEnd(42), res.ok ? 'borrado' : `error ${res.status}`)
    if (!res.ok) process.exitCode = 1
  }

  console.log('')
  console.log('  Purga terminada. Para volver a sembrar: pnpm db:seed')
  console.log('')
}

main().catch((error) => {
  console.error('')
  console.error(`  ${error.message}`)
  console.error('')
  process.exitCode = 1
})
