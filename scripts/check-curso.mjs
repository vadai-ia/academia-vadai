#!/usr/bin/env node
/**
 * check-curso.mjs — Verificación del contenido del curso.
 *
 * Criterio literal (plan del 3-sep-2026):
 *   1. Toda cita `[^id]` resuelve a una fila de fuentes.md.
 *   2. Ninguna cita apunta a una fila en estado `pendiente*`.
 *   3. Cada módulo (guion.md) se apoya en al menos dos audiencias distintas.
 *   4. Ningún archivo de módulo o de charla está vacío.
 *   5. La charla no promete nada antes de la sesión que lo enseña
 *      (la escena "así se ve el lunes" no puede decir "semana 2").
 *   6. mapa-curso.md mapea los cuatro bullets del Módulo 01 de la landing.
 *
 * Solo lee archivos. No toca la base ni la red.
 *
 *   node scripts/check-curso.mjs
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const RAIZ = join(process.cwd(), 'contenido', 'claude-en-tu-empresa')
const FUENTES = join(RAIZ, 'fuentes.md')

const fallas = []
const avisos = []

function ok(msg) { console.log(`  ✓ ${msg}`) }
function falla(msg) { fallas.push(msg); console.log(`  ✗ ${msg}`) }
function aviso(msg) { avisos.push(msg); console.log(`  ! ${msg}`) }

// --- 1. Leer el dossier ------------------------------------------------------

/** @returns {Map<string, { estado: string, audiencias: Set<string> }>} */
function leerFuentes() {
  const texto = readFileSync(FUENTES, 'utf8')
  const filas = new Map()
  // Filas de tabla cuyo primer campo es un id entre backticks.
  // Las de "Correcciones" y "Pendientes" también empiezan así y se distinguen por el prefijo.
  for (const linea of texto.split('\n')) {
    const m = linea.match(/^\|\s*`([a-z0-9-]+)`\s*\|(.*)\|\s*$/i)
    if (!m) continue
    const id = m[1]
    const celdas = m[2].split('|').map((c) => c.trim())
    if (id.startsWith('fix-')) continue
    if (id.startsWith('p-')) {
      filas.set(id, { estado: 'pendiente', audiencias: new Set() })
      continue
    }
    // dato | cifra | fuente | audiencia | estado
    if (celdas.length < 5) continue
    const audiencias = new Set(
      celdas[3].split('·').map((a) => a.trim().toLowerCase()).filter(Boolean)
    )
    filas.set(id, { estado: celdas[4].toLowerCase(), audiencias })
  }
  return filas
}

// --- 2. Recorrer el contenido ----------------------------------------------------

function archivosMd(dir) {
  const salida = []
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre)
    const st = statSync(ruta)
    if (st.isDirectory()) salida.push(...archivosMd(ruta))
    else if (nombre.endsWith('.md') && ruta !== FUENTES) salida.push(ruta)
  }
  return salida
}

/** Citas reales: se ignora lo que va entre backticks, que es donde se explica la convención. */
function citasDe(texto) {
  const sinCodigo = texto.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '')
  return [...sinCodigo.matchAll(/\[\^([a-z0-9-]+)\]/gi)].map((m) => m[1])
}

/**
 * Lo que de verdad se dice en la charla: sin la tabla de "qué cambió" (que cita lo viejo a
 * propósito) y sin la sección final "Lo que NO se dice" (que lo nombra para prohibirlo).
 */
function soloLoQueSeDice(texto) {
  const sinCola = texto.split(/^## Lo que NO se dice/m)[0]
  return sinCola.split('\n').filter((l) => !l.startsWith('|')).join('\n')
}

function expandir(audiencias) {
  if (audiencias.has('todos')) return new Set(['dirección', 'mando', 'colaborador'])
  return audiencias
}

// --- main ------------------------------------------------------------------

console.log('\nCHECK DEL CURSO — contenido/claude-en-tu-empresa\n')

const fuentes = leerFuentes()
ok(`${fuentes.size} filas en fuentes.md`)

const archivos = archivosMd(RAIZ)
const porModulo = new Map()

for (const ruta of archivos) {
  const rel = relative(RAIZ, ruta).replace(/\\/g, '/')
  const texto = readFileSync(ruta, 'utf8')

  // 4. Vacíos
  const esModulo = /^(modulo-\d+|charla-invitacion)\//.test(rel)
  if (esModulo && texto.trim().length < 500) {
    falla(`${rel} tiene menos de 500 caracteres`)
  }

  // 1 y 2. Citas
  for (const id of citasDe(texto)) {
    const fila = fuentes.get(id)
    if (!fila) { falla(`${rel} cita [^${id}] y no existe en fuentes.md`); continue }
    if (fila.estado.startsWith('pendiente')) {
      falla(`${rel} cita [^${id}] que está en estado ${fila.estado}`)
    } else if (fila.estado === 'proyección') {
      aviso(`${rel} cita [^${id}] que es proyección: debe decirse como estimación`)
    }
    // 3. Acumular audiencias por módulo
    const mod = rel.match(/^(modulo-\d+|charla-invitacion)\/guion\.md$/)?.[1]
    if (mod) {
      if (!porModulo.has(mod)) porModulo.set(mod, new Set())
      for (const a of expandir(fila.audiencias)) porModulo.get(mod).add(a)
    }
  }

  // 5. Coherencia de calendario en la charla
  if (rel === 'charla-invitacion/guion.md' || rel === 'charla-invitacion/laminas.md') {
    const dicho = soloLoQueSeDice(texto)
    const escena = dicho.match(/lunes de tu equipo[^\n]*semana (\d)/i)
    if (escena && escena[1] === '2') {
      falla(`${rel}: la escena "así se ve el lunes" dice semana 2; los conectores son la sesión 3`)
    }
    if (/despidi[oó] a (todo su equipo|700)/i.test(dicho)) {
      falla(`${rel}: repite "Klarna despidió a 700"; ver fix-klarna`)
    }
    if (/\b57%\b[^\n]*jefe/i.test(dicho)) {
      falla(`${rel}: usa el "57% no le dice a su jefe" que no tiene fuente (p-57-jefe)`)
    }
  }
}

// 3. Audiencias por módulo
for (const [mod, auds] of porModulo) {
  const reales = [...auds].filter((a) => a !== 'todos')
  if (reales.length < 2) {
    falla(`${mod}/guion.md se apoya en una sola audiencia: ${reales.join(', ') || 'ninguna'}`)
  } else {
    ok(`${mod}/guion.md cubre ${reales.length} audiencias: ${reales.join(' · ')}`)
  }
}

// 6. Cobertura de promesa de la landing
const mapa = readFileSync(join(RAIZ, 'mapa-curso.md'), 'utf8')
for (const leccion of ['1.4', '1.7', '1.9', '1.10']) {
  if (!mapa.includes(leccion)) falla(`mapa-curso.md no mapea la lección ${leccion} a un bullet de la landing`)
}
ok('los cuatro bullets del Módulo 01 están mapeados')

// Citas totales
const totalCitas = archivos.reduce((n, r) => n + citasDe(readFileSync(r, 'utf8')).length, 0)
ok(`${totalCitas} citas verificadas en ${archivos.length} archivos`)

console.log('')
if (avisos.length) console.log(`  ${avisos.length} aviso(s)`)
if (fallas.length) {
  console.log(`  ${fallas.length} falla(s)\n`)
  process.exitCode = 1
} else {
  console.log('  Todo en verde.\n')
}
