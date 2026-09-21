#!/usr/bin/env node
/**
 * seed-dinamica.mjs — Siembra la "Hoja de decisión" de la sesión 1 como dinámica empresarial.
 *
 * Mismo criterio que seed-curso.mjs: idempotente, UUID fijos (derivados de una clave con sha1,
 * así que correrlo dos veces actualiza en vez de duplicar) y `on conflict do update`. Todo dentro
 * de `academia`, en una transacción.
 *
 * Es la matriz de decisión ponderada del Excel de la sesión 1
 * (contenido/claude-en-tu-empresa/sesion-1/hoja-de-decision.py): criterios en las filas con su
 * peso en %, dos filas informativas sin peso, escala del 1 al 10. Los pesos son los que decidió
 * Alejandro para la academia (20/15/15/30/20), no los del Excel de Total Coach (20/15/10/30/25).
 *
 * Qué toca y qué no:
 *
 *   dynamics       nace en DRAFT: la abre un humano desde /admin/dinamicas cuando toque. Si ya
 *                  existe, solo se actualiza la descripción; NUNCA el estado ni la escala (la
 *                  escala se congela con celdas, y el estado es una decisión del panel).
 *   dynamic_rows   las siete filas. Si ya existen, se actualizan etiqueta, peso, posición y tipo
 *                  SOLO mientras la dinámica sigue en borrador: con tableros abiertos, cambiar un
 *                  peso les movería el ponderado a todas las empresas a la mitad del ejercicio.
 *
 * El curso se busca por slug y NO se crea: si no existe, este script falla en voz alta.
 *
 *   node scripts/seed-dinamica.mjs
 */

import { createHash } from 'node:crypto'

import { cargarEnv, conectarPostgres, linea, titulo } from './lib/entorno.mjs'

const SLUG = 'claude-en-tu-empresa'

// --- uuid determinista ----------------------------------------------------------
// Copiada tal cual de seed-curso.mjs: mismo espacio de nombres, claves distintas.

function uuidDe(clave) {
  const h = createHash('sha1').update(`academia:${SLUG}:${clave}`).digest('hex')
  // Formato v5-ish: fija versión y variante para que sea un uuid válido.
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`
}

// --- contenido -------------------------------------------------------------------

const DINAMICA = {
  id: uuidDe('dinamica:hoja-de-decision'),
  kind: 'matriz_ponderada',
  title: 'Hoja de decisión',
  // La frase de B2 del Excel original.
  description:
    'Un proyecto por columna. Califica del 1 al 10 cada criterio. La hoja calcula la suma ponderada.',
  scaleMin: 1,
  scaleMax: 10,
}

/** En el orden en que se ven en el tablero. Los pesos suman 100. */
const FILAS = [
  { label: 'Conocimiento técnico y reto de implementación', kind: 'criterio', weight: 20 },
  { label: 'Facilidad y tiempo / complejidad', kind: 'criterio', weight: 15 },
  { label: 'Probabilidades de éxito / mind set', kind: 'criterio', weight: 15 },
  { label: 'Impacto en la empresa: tiempo, costo, etc.', kind: 'criterio', weight: 30 },
  { label: 'ROI / presupuesto', kind: 'criterio', weight: 20 },
  { label: 'Monto de inversión estimado (MXN)', kind: 'informativa', weight: null },
  { label: 'Horas de programación o configuración', kind: 'informativa', weight: null },
].map((f, i) => ({ ...f, id: uuidDe(`fila:${f.label}`), position: i + 1 }))

// --- sembrar ---------------------------------------------------------------------------

async function sembrar(cliente) {
  await cliente.query('begin')
  try {
    const curso = await cliente.query(`select id, title from academia.courses where slug = $1`, [SLUG])
    const cursoId = curso.rows[0]?.id
    if (!cursoId) {
      throw new Error(
        `No existe el curso con slug "${SLUG}". Siémbralo primero (pnpm curso:sembrar) o créalo desde /admin/cursos.`
      )
    }
    linea('ok', 'Curso'.padEnd(42), `${curso.rows[0].title} · ${cursoId}`)

    // `xmax = 0` distingue insert de update en el mismo viaje, solo para el reporte.
    const dinamica = await cliente.query(
      `insert into academia.dynamics
         (id, course_id, kind, title, description, scale_min, scale_max, status)
       values ($1, $2, $3, $4, $5, $6, $7, 'draft')
       on conflict (id) do update set description = excluded.description
       returning status, scale_min, scale_max, (xmax = 0) as creada`,
      [DINAMICA.id, cursoId, DINAMICA.kind, DINAMICA.title, DINAMICA.description, DINAMICA.scaleMin, DINAMICA.scaleMax]
    )
    const { status, scale_min, scale_max, creada } = dinamica.rows[0]
    linea(
      'ok',
      (creada ? 'Dinámica creada' : 'Dinámica existente').padEnd(42),
      `${DINAMICA.title} · ${status} · escala ${scale_min}–${scale_max}${creada ? '' : ' · solo se actualizó la descripción'}`
    )

    if (status !== 'draft') {
      // Con la dinámica abierta o cerrada ya hay (o hubo) tableros calificando con estos pesos.
      // Ni se insertan filas nuevas ni se tocan las existentes.
      linea('aviso', 'Filas'.padEnd(42), `la dinámica está en "${status}", no en borrador: las filas no se tocan`)
      await cliente.query('commit')
      return { status, filasEscritas: 0 }
    }

    let filasEscritas = 0
    for (const fila of FILAS) {
      // El `where` del do update repite la condición de borrador dentro de la misma sentencia:
      // si alguien la abre entre la lectura de arriba y esta escritura, la fila no se pisa.
      const r = await cliente.query(
        `insert into academia.dynamic_rows (id, dynamic_id, row_kind, label, weight, position)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (id) do update
           set label = excluded.label,
               weight = excluded.weight,
               position = excluded.position,
               row_kind = excluded.row_kind
         where exists (
           select 1 from academia.dynamics d
            where d.id = excluded.dynamic_id and d.status = 'draft'
         )`,
        [fila.id, DINAMICA.id, fila.kind, fila.label, fila.weight, fila.position]
      )
      filasEscritas += r.rowCount ?? 0
      linea(
        'ok',
        `${fila.position}. ${fila.label}`.padEnd(42),
        fila.kind === 'criterio' ? `${fila.weight} %` : 'informativa'
      )
    }

    await cliente.query('commit')
    return { status, filasEscritas }
  } catch (e) {
    await cliente.query('rollback')
    throw e
  }
}

// --- main ----------------------------------------------------------------------------

async function main() {
  titulo('SEED DE LA DINÁMICA — Hoja de decisión')

  const suma = FILAS.filter((f) => f.kind === 'criterio').reduce((n, f) => n + f.weight, 0)
  if (suma !== 100) throw new Error(`Los pesos del seed suman ${suma}, no 100. Corrige FILAS antes de sembrar.`)

  const vars = cargarEnv()
  const cliente = await conectarPostgres(vars)
  try {
    const { status, filasEscritas } = await sembrar(cliente)
    const { rows } = await cliente.query(
      `select count(*)::int as n,
              coalesce(sum(weight) filter (where row_kind = 'criterio'), 0)::numeric as pesos
         from academia.dynamic_rows
        where dynamic_id = $1`,
      [DINAMICA.id]
    )
    console.log('')
    linea('ok', 'Dinámica sembrada', `${filasEscritas} filas escritas · ${rows[0].n} en la base · pesos ${Number(rows[0].pesos)} de 100`)
    console.log(`      dinámica: ${DINAMICA.id}  (${status}) · se abre desde /admin/dinamicas/${DINAMICA.id}/configuracion`)
    console.log('')
  } finally {
    await cliente.end().catch(() => {})
  }
}

main().catch((e) => { console.error(`\n  ${e.message}\n`); process.exitCode = 1 })
