#!/usr/bin/env node
/**
 * gen-types.mjs — Genera lib/supabase/types.ts desde la base.
 *
 * No usa el CLI de Supabase: `supabase gen types` levanta un contenedor Docker,
 * y este repo ya decidió no depender del CLI (ver CLAUDE.md). Aquí se
 * introspecciona information_schema por la misma conexión que usan las
 * migraciones.
 *
 * Extra sobre lo que da el CLI: convierte los CHECK del tipo
 * `col in ('a','b')` en uniones de TypeScript, así que `role` no es `string`
 * sino 'superadmin' | 'admin' | 'alumno'.
 *
 *   node scripts/gen-types.mjs
 */

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { RAIZ, ESQUEMA, cargarEnv, conectarPostgres, linea, titulo } from './lib/entorno.mjs'

const DESTINO = resolve(RAIZ, 'lib', 'supabase', 'types.ts')

const TIPOS = {
  uuid: 'string',
  text: 'string',
  'character varying': 'string',
  character: 'string',
  citext: 'string',
  integer: 'number',
  bigint: 'number',
  smallint: 'number',
  numeric: 'number',
  'double precision': 'number',
  real: 'number',
  boolean: 'boolean',
  'timestamp with time zone': 'string',
  'timestamp without time zone': 'string',
  date: 'string',
  time: 'string',
  json: 'Json',
  jsonb: 'Json',
  ARRAY: 'string[]',
}

const aTs = (tipoSql) => TIPOS[tipoSql] ?? 'unknown'

/** Convierte un CHECK `col = ANY (ARRAY['a'::text, 'b'::text])` en union de TS. */
function unionDesdeCheck(definicion, columna) {
  const patron = new RegExp(`${columna}\\s*=\\s*ANY\\s*\\(\\s*\\(?ARRAY\\[(.*?)\\]`, 'is')
  const encontrado = definicion.match(patron)
  if (!encontrado) return null

  const literales = [...encontrado[1].matchAll(/'([^']*)'/g)].map((m) => m[1])
  if (literales.length === 0) return null

  return literales.map((v) => `'${v}'`).join(' | ')
}

const nombreValido = (n) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(n)
const clave = (n) => (nombreValido(n) ? n : `'${n}'`)

async function main() {
  titulo(`GENERAR TIPOS — schema ${ESQUEMA}`)

  const vars = cargarEnv()
  const cliente = await conectarPostgres(vars)

  try {
    const { rows: relaciones } = await cliente.query(
      `select table_name, table_type
         from information_schema.tables
        where table_schema = $1
        order by table_name`,
      [ESQUEMA]
    )

    const { rows: columnas } = await cliente.query(
      `select table_name, column_name, data_type, is_nullable,
              (column_default is not null) as tiene_default,
              is_identity, is_generated
         from information_schema.columns
        where table_schema = $1
        order by table_name, ordinal_position`,
      [ESQUEMA]
    )

    const { rows: checks } = await cliente.query(
      `select rel.relname as tabla, pg_get_constraintdef(c.oid) as definicion
         from pg_constraint c
         join pg_class rel on rel.oid = c.conrelid
         join pg_namespace n on n.oid = rel.relnamespace
        where n.nspname = $1 and c.contype = 'c'`,
      [ESQUEMA]
    )

    const checksPorTabla = new Map()
    for (const c of checks) {
      if (!checksPorTabla.has(c.tabla)) checksPorTabla.set(c.tabla, [])
      checksPorTabla.get(c.tabla).push(c.definicion)
    }

    const columnasPorTabla = new Map()
    for (const c of columnas) {
      if (!columnasPorTabla.has(c.table_name)) columnasPorTabla.set(c.table_name, [])
      columnasPorTabla.get(c.table_name).push(c)
    }

    const tablas = relaciones.filter((r) => r.table_type === 'BASE TABLE')
    const vistas = relaciones.filter((r) => r.table_type === 'VIEW')

    const tipoDeColumna = (tabla, col) => {
      const base = aTs(col.data_type)
      if (base === 'string') {
        for (const def of checksPorTabla.get(tabla) ?? []) {
          const union = unionDesdeCheck(def, col.column_name)
          if (union) return union
        }
      }
      return base
    }

    const bloqueTabla = (tabla) => {
      const cols = columnasPorTabla.get(tabla) ?? []

      const row = cols
        .map((c) => {
          const tipo = tipoDeColumna(tabla, c)
          const nulo = c.is_nullable === 'YES' ? ' | null' : ''
          return `          ${clave(c.column_name)}: ${tipo}${nulo}`
        })
        .join('\n')

      const insert = cols
        .map((c) => {
          const tipo = tipoDeColumna(tabla, c)
          const nulo = c.is_nullable === 'YES' ? ' | null' : ''
          // Opcional si tiene default o admite null: la base la puede llenar.
          const opcional = c.tiene_default || c.is_nullable === 'YES' ? '?' : ''
          return `          ${clave(c.column_name)}${opcional}: ${tipo}${nulo}`
        })
        .join('\n')

      const update = cols
        .map((c) => {
          const tipo = tipoDeColumna(tabla, c)
          const nulo = c.is_nullable === 'YES' ? ' | null' : ''
          return `          ${clave(c.column_name)}?: ${tipo}${nulo}`
        })
        .join('\n')

      return `      ${clave(tabla)}: {
        Row: {
${row}
        }
        Insert: {
${insert}
        }
        Update: {
${update}
        }
        Relationships: []
      }`
    }

    const bloqueVista = (vista) => {
      const cols = columnasPorTabla.get(vista) ?? []
      const row = cols
        .map((c) => {
          const tipo = tipoDeColumna(vista, c)
          // Las columnas de una vista siempre se reportan nullable; se respeta.
          return `          ${clave(c.column_name)}: ${tipo} | null`
        })
        .join('\n')

      return `      ${clave(vista)}: {
        Row: {
${row}
        }
        Relationships: []
      }`
    }

    const contenido = `/**
 * Tipos del schema \`${ESQUEMA}\`.
 *
 * ARCHIVO GENERADO. No lo edites a mano: se regenera con
 *
 *   pnpm db:types
 *
 * tras aplicar migraciones nuevas. El generador vive en scripts/gen-types.mjs
 * e introspecciona la base directamente (sin el CLI de Supabase, que exige
 * Docker). Los CHECK del tipo \`col in ('a','b')\` se convierten en uniones de
 * TypeScript, así que los estados y roles quedan tipados de verdad.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [clave: string]: Json | undefined }
  | Json[]

export type Database = {
  ${ESQUEMA}: {
    Tables: {
${tablas.map((t) => bloqueTabla(t.table_name)).join('\n')}
    }
    Views: {
${vistas.map((v) => bloqueVista(v.table_name)).join('\n')}
    }
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

type EsquemaAcademia = Database['${ESQUEMA}']

export type Tabla<T extends keyof EsquemaAcademia['Tables']> =
  EsquemaAcademia['Tables'][T]['Row']

export type NuevaFila<T extends keyof EsquemaAcademia['Tables']> =
  EsquemaAcademia['Tables'][T]['Insert']

export type CambioEnFila<T extends keyof EsquemaAcademia['Tables']> =
  EsquemaAcademia['Tables'][T]['Update']

export type Vista<V extends keyof EsquemaAcademia['Views']> =
  EsquemaAcademia['Views'][V]['Row']
`

    writeFileSync(DESTINO, contenido, 'utf8')

    linea('ok', 'lib/supabase/types.ts', `${tablas.length} tablas, ${vistas.length} vistas`)
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
