#!/usr/bin/env node
/**
 * qa-esconder.mjs — Archiva los cursos QA para que no salgan en el panel.
 *
 * Los datos de prueba viven en la MISMA base que producción (Regla Cero: un
 * solo proyecto), y el seed los deja publicados porque las suites necesitan
 * que el alumno QA vea su curso. Eso tiene un costo del lado del admin real:
 * "QA · Curso de prueba" aparece en /admin/cursos, y la sesión futura de la
 * cohorte QA salía como "Próxima sesión en vivo" en el panel. La víspera del
 * lanzamiento Alejandro los archivó a mano desde el panel, y con razón.
 *
 * Este script hace eso mismo al final de cada corrida de `pnpm qa`: publica
 * el seed, prueban las suites, y al cerrar los cursos QA se archivan otra
 * vez. Archivado no es borrado: el siguiente `pnpm db:seed` los vuelve a
 * publicar para la siguiente corrida.
 *
 * Solo toca los dos cursos con UUID fijo de scripts/lib/qa.mjs. Nunca por
 * patrón de slug ni por fecha.
 *
 *   node scripts/qa-esconder.mjs
 */
import { cargarEnv, conectarPostgres, linea, titulo } from './lib/entorno.mjs'
import { CURSO_AJENO_QA, CURSO_QA } from './lib/qa.mjs'

titulo('ESCONDER LOS CURSOS QA DEL PANEL')

const bd = await conectarPostgres(cargarEnv())
try {
  const { rows } = await bd.query(
    `update academia.courses set status = 'archived'
      where id = any($1::uuid[]) and status <> 'archived'
      returning slug`,
    [[CURSO_QA.id, CURSO_AJENO_QA.id]]
  )
  linea('ok', 'Cursos QA archivados'.padEnd(42), rows.map((r) => r.slug).join(', ') || 'ya lo estaban')
  console.log('      El siguiente `pnpm db:seed` los vuelve a publicar para probar.\n')
} finally {
  await bd.end().catch(() => {})
}
