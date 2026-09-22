#!/usr/bin/env node
/**
 * qa-mostrar.mjs — Publica los cursos QA para que las suites puedan correr.
 *
 * Es el gemelo de `qa-esconder.mjs`, y nació el 21-sep-2026 por la noche.
 *
 * Antes esto lo hacía el seed: su upsert ponía `status = 'published'` en cada
 * corrida, así que bastaba un `pnpm db:seed` —el de esta sesión o el de otra
 * trabajando en paralelo sobre la misma base— para que "QA · Curso de prueba"
 * reapareciera en /admin/cursos del admin REAL. Pasó dos veces el día del
 * lanzamiento, la segunda con la sala enfrente.
 *
 * Ahora el seed respeta lo que ya haya: archivado se queda archivado. Publicar
 * los cursos QA es un acto deliberado, y esto es ese acto. Lo corren los dos
 * lanzadores de suites (`qa-checklist.mjs` y `test-todo.mjs`) justo antes de
 * probar, y `qa-esconder.mjs` los vuelve a archivar al terminar.
 *
 * Solo toca los dos cursos con UUID fijo de scripts/lib/qa.mjs. Nunca por
 * patrón de slug ni por fecha.
 *
 *   node scripts/qa-mostrar.mjs
 */
import { cargarEnv, conectarPostgres, linea, titulo } from './lib/entorno.mjs'
import { CURSO_AJENO_QA, CURSO_QA } from './lib/qa.mjs'

titulo('PUBLICAR LOS CURSOS QA PARA PROBAR')

const bd = await conectarPostgres(cargarEnv())
try {
  const { rows } = await bd.query(
    `update academia.courses set status = 'published'
      where id = any($1::uuid[]) and status <> 'published'
      returning slug`,
    [[CURSO_QA.id, CURSO_AJENO_QA.id]]
  )
  linea('ok', 'Cursos QA publicados'.padEnd(42), rows.map((r) => r.slug).join(', ') || 'ya lo estaban')
  console.log('      Al terminar, `pnpm qa:esconder` los saca del panel otra vez.\n')
} finally {
  await bd.end().catch(() => {})
}
