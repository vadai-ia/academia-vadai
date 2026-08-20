#!/usr/bin/env node
/**
 * migrate.mjs — Aplica las migraciones del schema `academia`.
 *
 * Deliberadamente NO usa `supabase db push`. El CLI de Supabase crea el schema
 * `supabase_migrations` con un historial GLOBAL del proyecto: si otro repo de
 * VADAI usara el CLI contra la misma base, los historiales se pisarían. Este
 * runner guarda su ledger en `academia.schema_migrations`, dentro de nuestro
 * propio schema.
 *
 * Cada archivo se aplica en una transacción. Si falla, se revierte completo.
 *
 * Además compara el estado de la base antes y después de cada corrida y aborta
 * si aparecieron objetos fuera de `academia` (Regla Cero). La única excepción
 * permitida son policies sobre `storage.objects` con prefijo `academia_`.
 *
 *   node scripts/migrate.mjs            aplica las pendientes
 *   node scripts/migrate.mjs --status   solo muestra el estado
 *   node scripts/migrate.mjs --dry-run  muestra qué aplicaría, sin tocar nada
 */

import { readdirSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

import { RAIZ, ESQUEMA, cargarEnv, conectarPostgres, linea, titulo } from './lib/entorno.mjs'

const DIRECTORIO = resolve(RAIZ, 'supabase', 'migrations')
const banderas = new Set(process.argv.slice(2))
const SOLO_ESTADO = banderas.has('--status')
const SIMULACRO = banderas.has('--dry-run')

// --- descubrimiento de archivos --------------------------------------------

function migracionesEnDisco() {
  return readdirSync(DIRECTORIO)
    .filter((n) => n.endsWith('.sql'))
    .sort()
    .map((archivo) => {
      const sql = readFileSync(resolve(DIRECTORIO, archivo), 'utf8')
      return {
        archivo,
        sql,
        checksum: createHash('sha256').update(sql).digest('hex').slice(0, 16),
      }
    })
}

// --- ledger ----------------------------------------------------------------

async function asegurarLedger(cliente) {
  await cliente.query(`create schema if not exists ${ESQUEMA}`)
  await cliente.query(`
    create table if not exists ${ESQUEMA}.schema_migrations (
      archivo     text primary key,
      checksum    text not null,
      aplicada_en timestamptz not null default now(),
      duracion_ms integer
    )
  `)
}

async function yaAplicadas(cliente) {
  const { rows } = await cliente.query(
    `select archivo, checksum, aplicada_en from ${ESQUEMA}.schema_migrations order by archivo`
  )
  return new Map(rows.map((r) => [r.archivo, r]))
}

// --- guardia de Regla Cero -------------------------------------------------

/**
 * Fotografía de todo lo que existe FUERA de `academia`, para detectar si una
 * migración se sale de su carril.
 */
async function fotografiar(cliente) {
  const objetos = await cliente.query(`
    select table_schema as esquema, table_name as nombre, 'tabla' as tipo
      from information_schema.tables
     where table_schema not in ('pg_catalog', 'information_schema', $1)
    union all
    select routine_schema, routine_name, 'rutina'
      from information_schema.routines
     where routine_schema not in ('pg_catalog', 'information_schema', $1)
  `, [ESQUEMA])

  const policies = await cliente.query(`
    select schemaname as esquema, tablename as tabla, policyname as nombre
      from pg_policies
     where schemaname <> $1
  `, [ESQUEMA])

  return {
    objetos: new Set(objetos.rows.map((r) => `${r.tipo}:${r.esquema}.${r.nombre}`)),
    policies: new Set(policies.rows.map((r) => `${r.esquema}.${r.tabla}:${r.nombre}`)),
  }
}

function diferencia(antes, despues) {
  const nuevos = [...despues].filter((x) => !antes.has(x))
  return nuevos
}

/**
 * Decide si un objeto nuevo fuera de `academia` es aceptable.
 * Solo lo son las policies sobre storage.objects/buckets con prefijo academia_,
 * que §1.B autoriza explícitamente.
 */
function policyPermitida(clave) {
  const [ubicacion, nombre] = clave.split(':')
  const esStorage = ubicacion === 'storage.objects' || ubicacion === 'storage.buckets'
  return esStorage && nombre.startsWith('academia_')
}

// --- aplicación ------------------------------------------------------------

async function aplicar(cliente, migracion) {
  const inicio = Date.now()
  await cliente.query('begin')
  try {
    await cliente.query(migracion.sql)
    const duracion = Date.now() - inicio
    await cliente.query(
      `insert into ${ESQUEMA}.schema_migrations (archivo, checksum, duracion_ms)
       values ($1, $2, $3)`,
      [migracion.archivo, migracion.checksum, duracion]
    )
    await cliente.query('commit')
    return duracion
  } catch (error) {
    await cliente.query('rollback')
    throw error
  }
}

// --- main ------------------------------------------------------------------

async function main() {
  const vars = cargarEnv()
  const enDisco = migracionesEnDisco()

  if (enDisco.length === 0) {
    titulo('MIGRACIONES — schema academia')
    linea('aviso', 'No hay archivos .sql en supabase/migrations.')
    console.log('')
    return
  }

  const cliente = await conectarPostgres(vars)

  try {
    await asegurarLedger(cliente)
    const aplicadas = await yaAplicadas(cliente)

    // Deriva: un archivo ya aplicado cuyo contenido cambió.
    const conDeriva = enDisco.filter(
      (m) => aplicadas.has(m.archivo) && aplicadas.get(m.archivo).checksum !== m.checksum
    )

    const pendientes = enDisco.filter((m) => !aplicadas.has(m.archivo))

    titulo('MIGRACIONES — schema academia')

    for (const m of enDisco) {
      if (conDeriva.some((d) => d.archivo === m.archivo)) {
        linea('falla', m.archivo, 'CAMBIÓ después de aplicarse')
      } else if (aplicadas.has(m.archivo)) {
        const cuando = aplicadas.get(m.archivo).aplicada_en.toISOString().slice(0, 16).replace('T', ' ')
        linea('ok', m.archivo, `aplicada ${cuando}`)
      } else {
        linea('aviso', m.archivo, 'pendiente')
      }
    }

    if (conDeriva.length > 0) {
      console.log('')
      console.log('  Hay migraciones ya aplicadas cuyo contenido cambió:')
      for (const d of conDeriva) console.log(`    - ${d.archivo}`)
      console.log('')
      console.log('  Una migración aplicada es historia: no se edita. Crea un archivo nuevo')
      console.log('  con el cambio (por ejemplo un alter table) en vez de tocar el anterior.')
      console.log('')
      process.exitCode = 1
      return
    }

    if (pendientes.length === 0) {
      console.log('')
      console.log('  Todo al día. Nada que aplicar.')
      console.log('')
      return
    }

    if (SOLO_ESTADO || SIMULACRO) {
      console.log('')
      console.log(`  ${pendientes.length} pendiente(s). ${SIMULACRO ? 'Simulacro: no se aplicó nada.' : ''}`)
      console.log('')
      return
    }

    const antes = await fotografiar(cliente)

    console.log('')
    for (const m of pendientes) {
      try {
        const ms = await aplicar(cliente, m)
        linea('ok', `aplicada ${m.archivo}`, `${ms} ms`)
      } catch (error) {
        linea('falla', `falló ${m.archivo}`)
        console.log('')
        console.log(`  ${error.message}`)
        if (error.position && typeof error.position === 'string') {
          const hasta = m.sql.slice(0, Number(error.position))
          console.log(`  cerca de la línea ${hasta.split('\n').length} del archivo`)
        }
        console.log('')
        console.log('  Se revirtió esa migración completa. Las anteriores siguen aplicadas.')
        console.log('')
        process.exitCode = 1
        return
      }
    }

    // Regla Cero: nada nuevo fuera de `academia`.
    const despues = await fotografiar(cliente)
    const objetosNuevos = diferencia(antes.objetos, despues.objetos)
    const policiesNuevas = diferencia(antes.policies, despues.policies)
    const policiesIndebidas = policiesNuevas.filter((p) => !policyPermitida(p))

    console.log('')
    if (objetosNuevos.length === 0 && policiesIndebidas.length === 0) {
      const permitidas = policiesNuevas.length
      linea(
        'ok',
        'Regla Cero respetada',
        permitidas
          ? `(${permitidas} policy(s) de storage con prefijo academia_, permitidas por §1.B)`
          : '(nada creado fuera de academia)'
      )
    } else {
      linea('falla', 'REGLA CERO VIOLADA — se crearon objetos fuera de academia:')
      for (const o of objetosNuevos) console.log(`      ${o}`)
      for (const p of policiesIndebidas) console.log(`      policy ${p}`)
      console.log('')
      console.log('  Revisa las migraciones recién aplicadas y revierte a mano lo que sobre.')
      process.exitCode = 1
    }

    const total = await cliente.query(
      `select count(*)::int n from information_schema.tables where table_schema = $1`,
      [ESQUEMA]
    )
    console.log('')
    console.log(`  ${ESQUEMA}: ${total.rows[0].n} tabla(s).`)
    console.log('')
  } finally {
    await cliente.end().catch(() => {})
  }
}

main().catch((error) => {
  console.error('')
  console.error(`  ${error.message}`)
  console.error('')
  process.exitCode = 1
})
