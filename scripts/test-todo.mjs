#!/usr/bin/env node
/**
 * test-todo.mjs — Corre todas las suites en orden y resume.
 *
 * Se corren en secuencia, nunca en paralelo: varias escriben en los mismos
 * datos sembrados (progreso, intentos, entregas) y en paralelo se pisarían
 * entre ellas, dando fallos que no son fallos.
 *
 * El orden importa. `rls` va primero porque afirma sobre el estado limpio del
 * seed; las demás van después, de la más básica a la más compuesta.
 *
 *   PORT=3117 pnpm start
 *   pnpm db:seed && pnpm test:todo
 */

import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const AQUI = path.dirname(fileURLToPath(import.meta.url))

const SUITES = [
  // Va primera: es lógica pura, no necesita la app ni la base, y si el lector
  // de padrones está roto conviene saberlo antes de gastar cinco minutos.
  { llave: 'importar', archivo: 'test-importar.mjs', titulo: 'Lector de padrones', milestone: 'M3' },
  { llave: 'rls', archivo: 'test-rls.mjs', titulo: 'Policies de RLS', milestone: 'M1' },
  { llave: 'auth', archivo: 'test-auth.mjs', titulo: 'Sesión y roles', milestone: 'M2' },
  { llave: 'recuperacion', archivo: 'test-recuperacion.mjs', titulo: 'Recuperación y logout', milestone: 'M2' },
  { llave: 'admin', archivo: 'test-admin.mjs', titulo: 'Panel de admin', milestone: 'M3' },
  { llave: 'alumno', archivo: 'test-alumno.mjs', titulo: 'Curso y progreso', milestone: 'M4' },
  { llave: 'quizzes', archivo: 'test-quizzes.mjs', titulo: 'Quizzes', milestone: 'M5' },
  { llave: 'tareas', archivo: 'test-tareas.mjs', titulo: 'Tareas y entregas', milestone: 'M6' },
  { llave: 'comunidad', archivo: 'test-comunidad.mjs', titulo: 'Comunidad y blog', milestone: 'M7' },
  { llave: 'cohortes', archivo: 'test-cohortes.mjs', titulo: 'Cohortes y sesiones', milestone: 'M8' },
  { llave: 'stripe', archivo: 'test-stripe.mjs', titulo: 'Pagos y provisioning', milestone: 'M9' },
  { llave: 'certificados', archivo: 'test-certificados.mjs', titulo: 'Certificados', milestone: 'M10' },
  { llave: 'encuestas', archivo: 'test-encuestas.mjs', titulo: 'Encuestas en vivo', milestone: 'M12' },
  { llave: 'dinamicas', archivo: 'test-dinamicas.mjs', titulo: 'Dinámicas empresariales', milestone: 'M13' },
]

/** Corre una suite heredando stdio y devuelve su código de salida. */
function correr(archivo) {
  return new Promise((resolve) => {
    const hijo = spawn(process.execPath, [path.join(AQUI, archivo)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    })

    let salida = ''
    hijo.stdout.on('data', (d) => (salida += d))
    hijo.stderr.on('data', (d) => (salida += d))
    hijo.on('close', (codigo) => resolve({ codigo: codigo ?? 1, salida }))
  })
}

/** Saca el "N/N aserciones" del reporte de cada suite, si lo trae. */
function resumirSalida(salida) {
  const verde = salida.match(/(\d+)\/(\d+)\s+aserciones/)
  if (verde) return `${verde[1]}/${verde[2]}`
  const rojo = salida.match(/(\d+)\s+de\s+(\d+)\s+aserciones\s+FALLARON/i)
  if (rojo) return `${Number(rojo[2]) - Number(rojo[1])}/${rojo[2]}`
  return '—'
}

const solo = process.argv.slice(2).filter((a) => !a.startsWith('-'))
const detallado = process.argv.includes('--verbose')
const aCorrer = solo.length > 0 ? SUITES.filter((s) => solo.includes(s.llave)) : SUITES

console.log('')
console.log('  SUITE COMPLETA — VADAI ACADEMIA')
console.log(`  ${aCorrer.length} suite(s), en secuencia`)
console.log('')

// Las suites necesitan los cursos QA publicados, y el seed ya no los publica:
// respeta lo que haya, para que un `db:seed` suelto no los devuelva al panel
// del admin real. Publicarlos es deliberado y pasa aquí; abajo se archivan.
const mostrado = spawnSync(process.execPath, [path.join(AQUI, 'qa-mostrar.mjs')], { stdio: 'inherit' })
if (mostrado.status !== 0) console.log('  ✗  No se pudieron publicar los cursos QA: corre `pnpm qa:mostrar`.')

const resultados = []

for (const suite of aCorrer) {
  process.stdout.write(`  ${suite.milestone.padEnd(4)} ${suite.titulo.padEnd(24)} … `)
  const { codigo, salida } = await correr(suite.archivo)
  const conteo = resumirSalida(salida)
  console.log(`${codigo === 0 ? '✓' : '✗'}  ${conteo}`)
  resultados.push({ ...suite, codigo, salida, conteo })
  if (detallado || codigo !== 0) {
    console.log(salida.split('\n').map((l) => `      ${l}`).join('\n'))
  }
}

const fallidas = resultados.filter((r) => r.codigo !== 0)

console.log('')
console.log('  ' + '─'.repeat(52))
if (fallidas.length === 0) {
  const total = resultados.reduce((n, r) => {
    const m = r.conteo.match(/^(\d+)\/(\d+)$/)
    return n + (m ? Number(m[2]) : 0)
  }, 0)
  console.log(`  TODO EN VERDE — ${resultados.length} suites, ${total} aserciones.`)
} else {
  console.log(`  ${fallidas.length} de ${resultados.length} suites FALLARON:`)
  for (const f of fallidas) console.log(`    ${f.milestone} · ${f.titulo} (${f.llave})`)
}
console.log('')

// Pase lo que pase, los cursos QA vuelven a quedar archivados: el seed los
// publica para que las suites tengan qué probar, y publicados aparecen en el
// panel del admin real ("QA · Curso de prueba" entre los cursos vivos). El
// 20-sep-2026 Alejandro los archivó a mano tres veces y "se desarchivaban
// solos": era cada corrida de pruebas.
const escondido = spawnSync(process.execPath, [path.join(AQUI, 'qa-esconder.mjs')], { stdio: 'inherit' })
if (escondido.status !== 0) console.log('  ✗  No se pudieron archivar los cursos QA: corre `pnpm qa:esconder`.')

process.exitCode = fallidas.length === 0 ? 0 : 1
