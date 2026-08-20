/**
 * Utilidades compartidas por los scripts de infraestructura.
 * Sin dependencias externas salvo `pg`, que solo se carga bajo demanda.
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Único schema que este repo puede tocar. Regla Cero. */
export const ESQUEMA = 'academia'

/**
 * Lee .env.local. No usa dotenv a propósito: estos scripts deben poder correr
 * antes de instalar dependencias.
 */
export function cargarEnv({ obligatorio = true } = {}) {
  const ruta = resolve(RAIZ, '.env.local')

  if (!existsSync(ruta)) {
    if (!obligatorio) return {}
    throw new Error(
      'No existe .env.local. Copia .env.local.example y llénalo (docs/M0-SETUP.md paso 6).'
    )
  }

  const vars = {}
  for (const linea of readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const limpia = linea.trim()
    if (!limpia || limpia.startsWith('#')) continue
    const i = limpia.indexOf('=')
    if (i === -1) continue
    let valor = limpia.slice(i + 1).trim()
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1)
    }
    vars[limpia.slice(0, i).trim()] = valor
  }
  return vars
}

export function exigir(vars, nombre) {
  const valor = vars[nombre]
  if (!valor) {
    throw new Error(`Falta ${nombre} en .env.local. Ver docs/M0-SETUP.md.`)
  }
  return valor
}

/** Conecta a Postgres por la URL del session pooler. */
export async function conectarPostgres(vars) {
  const { default: pg } = await import('pg')
  const cliente = new pg.Client({
    connectionString: exigir(vars, 'SUPABASE_DB_URL'),
    ssl: { rejectUnauthorized: false },
    application_name: 'vadai-academia-scripts',
  })
  await cliente.connect()
  return cliente
}

// --- salida en consola -----------------------------------------------------

export const ICONO = { ok: '\u2713', falla: '\u2717', aviso: '!' }

export function titulo(texto) {
  console.log('')
  console.log(`  ${texto}`)
  console.log('  ' + '─'.repeat(Math.max(texto.length, 60)))
}

export function linea(estado, texto, detalle = '') {
  console.log(`  ${ICONO[estado] ?? ' '}  ${texto}${detalle ? `  ${detalle}` : ''}`)
}
