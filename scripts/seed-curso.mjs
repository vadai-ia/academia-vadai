#!/usr/bin/env node
/**
 * seed-curso.mjs — Siembra el curso "Claude en tu Empresa" desde el contenido.
 *
 * Mismo criterio que seed.mjs: idempotente, UUID fijos (derivados del slug con sha1, así que
 * correrlo dos veces actualiza en vez de duplicar) y `on conflict do update`. Todo dentro de
 * `academia`, en una transacción.
 *
 * Lee cada `contenido/claude-en-tu-empresa/modulo-N/guion.md`, parte por `## N.N · Título`,
 * convierte el Markdown a JSON de Tiptap (StarterKit) y siembra:
 *
 *   courses  (slug 'claude-en-tu-empresa')
 *   modules  (uno por guion.md, por el H1)
 *   lessons  (una por lección, lesson_type 'text', status 'draft')
 *
 * Las lecciones nacen en DRAFT a propósito: la regla de la junta es liberar cada módulo
 * después de su sesión en vivo, y eso lo hace un humano desde el panel.
 *
 * Las citas `[^id]` se quitan del texto: la fuente vive en fuentes.md y en la lámina, no en la
 * lección que lee el alumno.
 *
 *   node scripts/seed-curso.mjs            # siembra
 *   node scripts/seed-curso.mjs --solo-json  # solo imprime el JSON de la primera lección
 */

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cargarEnv, conectarPostgres, linea, titulo } from './lib/entorno.mjs'

const RAIZ = join(process.cwd(), 'contenido', 'claude-en-tu-empresa')
const SLUG = 'claude-en-tu-empresa'
const SOLO_JSON = process.argv.includes('--solo-json')

// --- uuid determinista ----------------------------------------------------------

function uuidDe(clave) {
  const h = createHash('sha1').update(`academia:${SLUG}:${clave}`).digest('hex')
  // Formato v5-ish: fija versión y variante para que sea un uuid válido.
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`
}

// --- markdown → tiptap ---------------------------------------------------------

function limpiar(t) {
  return t.replace(/\[\^[a-z0-9-]+\]/gi, '').replace(/[ \t]+$/g, '')
}

/** Texto con **negritas**, *cursivas* y `código` → runs de Tiptap. */
function inline(texto) {
  const nodos = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  let ultimo = 0
  for (const m of texto.matchAll(re)) {
    if (m.index > ultimo) nodos.push({ type: 'text', text: texto.slice(ultimo, m.index) })
    const t = m[0]
    if (t.startsWith('**')) nodos.push({ type: 'text', text: t.slice(2, -2), marks: [{ type: 'bold' }] })
    else if (t.startsWith('`')) nodos.push({ type: 'text', text: t.slice(1, -1), marks: [{ type: 'code' }] })
    else nodos.push({ type: 'text', text: t.slice(1, -1), marks: [{ type: 'italic' }] })
    ultimo = m.index + t.length
  }
  if (ultimo < texto.length) nodos.push({ type: 'text', text: texto.slice(ultimo) })
  return nodos.filter((n) => n.text.length > 0)
}

function parrafo(texto) {
  const content = inline(texto)
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' }
}

function aTiptap(markdown) {
  const lineas = limpiar(markdown).split('\n')
  const doc = []
  let i = 0
  while (i < lineas.length) {
    const l = lineas[i]

    if (!l.trim()) { i++; continue }

    // Encabezados (### → h3, #### → h4). El ## es la lección misma y no llega aquí.
    const h = l.match(/^(#{3,4})\s+(.+)$/)
    if (h) { doc.push({ type: 'heading', attrs: { level: h[1].length }, content: inline(h[2]) }); i++; continue }

    // Bloque de código
    if (l.startsWith('```')) {
      const buf = []; i++
      while (i < lineas.length && !lineas[i].startsWith('```')) buf.push(lineas[i++])
      i++
      doc.push({ type: 'codeBlock', content: [{ type: 'text', text: buf.join('\n') }] })
      continue
    }

    // Cita
    if (l.startsWith('>')) {
      const buf = []
      while (i < lineas.length && lineas[i].startsWith('>')) buf.push(lineas[i++].replace(/^>\s?/, ''))
      doc.push({ type: 'blockquote', content: [parrafo(buf.join(' '))] })
      continue
    }

    // Tabla → lista con viñetas, una por fila (Tiptap StarterKit no trae tablas).
    if (l.startsWith('|')) {
      const filas = []
      while (i < lineas.length && lineas[i].startsWith('|')) {
        const f = lineas[i++]
        if (/^\|\s*-{2,}/.test(f)) continue
        const celdas = f.split('|').slice(1, -1).map((c) => c.trim()).filter(Boolean)
        if (celdas.length) filas.push(celdas.join(' — '))
      }
      doc.push({ type: 'bulletList', content: filas.map((t) => ({ type: 'listItem', content: [parrafo(t)] })) })
      continue
    }

    // Listas
    const esViñeta = (s) => /^\s*[-•]\s+/.test(s)
    const esNumero = (s) => /^\s*\d+\.\s+/.test(s)
    if (esViñeta(l) || esNumero(l)) {
      const numerada = esNumero(l)
      const items = []
      while (i < lineas.length && (esViñeta(lineas[i]) || esNumero(lineas[i]) || /^\s{2,}\S/.test(lineas[i]))) {
        const s = lineas[i++]
        if (esViñeta(s) || esNumero(s)) items.push(s.replace(/^\s*([-•]|\d+\.)\s+/, ''))
        else if (items.length) items[items.length - 1] += ' ' + s.trim()
      }
      doc.push({
        type: numerada ? 'orderedList' : 'bulletList',
        content: items.map((t) => ({ type: 'listItem', content: [parrafo(t)] })),
      })
      continue
    }

    // Regla
    if (/^---+$/.test(l.trim())) { doc.push({ type: 'horizontalRule' }); i++; continue }

    // Párrafo: junta líneas hasta la siguiente en blanco o bloque.
    const buf = [l]
    i++
    while (i < lineas.length && lineas[i].trim() && !/^(#{3,4}\s|```|>|\||\s*[-•]\s|\s*\d+\.\s|---)/.test(lineas[i])) {
      buf.push(lineas[i++])
    }
    doc.push(parrafo(buf.join(' ')))
  }
  return { type: 'doc', content: doc }
}

// --- leer el contenido ---------------------------------------------------------------

function leerModulos() {
  const modulos = []
  for (const dir of readdirSync(RAIZ).filter((d) => /^modulo-\d+$/.test(d)).sort()) {
    // Un módulo sin guion todavía no se siembra: la víspera del lanzamiento
    // solo existían los guiones de modulo-0 y modulo-1, y los demás carpetas
    // traían láminas y nada más. Reventar aquí impedía sembrar los dos que sí
    // estaban listos. Se avisa y se sigue; el módulo entra cuando su guion.
    const rutaGuion = join(RAIZ, dir, 'guion.md')
    if (!existsSync(rutaGuion)) {
      linea('aviso', dir, 'sin guion.md, se salta')
      continue
    }
    // Los guiones se escriben en Windows y traen CRLF. Sin normalizar, cada
    // `\r` se colaba al JSON de Tiptap dentro del texto de la lección ("…con
    // total honestidad:\r no estás atrasado"), y el alumno lo veía como un
    // espacio raro o un carácter suelto. Misma familia del bug de párrafos de
    // la comunidad en M7: los <textarea> también mandan CRLF.
    const texto = readFileSync(rutaGuion, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const numero = Number(dir.split('-')[1])
    const h1 = texto.match(/^# (.+)$/m)?.[1] ?? dir
    // Quita el bloque de notas del encabezado (todo antes de la primera lección).
    const partes = texto.split(/^## (\d+\.\d+) · (.+)$/m)
    const lecciones = []
    for (let k = 1; k < partes.length; k += 3) {
      const codigo = partes[k]
      const tituloLeccion = partes[k + 1].trim()
      let cuerpo = partes[k + 2]
      // Corta encabezados de bloque ("# Bloque B") y el checklist final del presentador.
      cuerpo = cuerpo.split(/^# /m)[0].split(/^## Lista de verificación/m)[0]
      lecciones.push({ codigo, titulo: `${codigo} · ${tituloLeccion}`, cuerpo })
    }
    modulos.push({ dir, numero, titulo: h1.replace(/^Módulo \d+ · /, `Módulo ${numero} · `), lecciones })
  }
  return modulos
}

// --- sembrar ---------------------------------------------------------------------------

async function sembrar(cliente, modulos) {
  await cliente.query('begin')
  try {
    // El curso real ya existe en producción desde el 24-ago: lo creó el panel,
    // con su propio id, su portada y sus 106 inscripciones. `slug` es único,
    // así que insertar con un id derivado reventaba con unique_violation, y un
    // `on conflict (slug) do update` le habría pisado título y descripción a un
    // curso vivo. Se resuelve por slug: si existe se usa tal cual y NO se toca;
    // solo entran módulos y lecciones. Si no existe, se crea en draft.
    const existente = await cliente.query(`select id, status from academia.courses where slug = $1`, [SLUG])
    let cursoId = existente.rows[0]?.id
    let statusCurso = existente.rows[0]?.status
    if (cursoId) {
      linea('ok', 'Curso existente'.padEnd(42), `${SLUG} · ${statusCurso} · no se modifica`)
    } else {
      cursoId = uuidDe('curso')
      statusCurso = 'draft'
      await cliente.query(
        `insert into academia.courses (id, slug, title, description, status, course_type, access_days)
         values ($1, $2, $3, $4, 'draft', 'cohort', null)`,
        [cursoId, SLUG, 'Claude en tu Empresa',
         'Cinco módulos, ocho sesiones en vivo, con el trabajo real de cada persona en su Excel, Word y correo.']
      )
      linea('ok', 'Curso creado'.padEnd(42), `${SLUG} · draft`)
    }

    let totalLecciones = 0
    for (const mod of modulos) {
      const moduloId = uuidDe(`modulo:${mod.numero}`)
      await cliente.query(
        `insert into academia.modules (id, course_id, title, position) values ($1, $2, $3, $4)
         on conflict (id) do update set title = excluded.title, position = excluded.position`,
        [moduloId, cursoId, mod.titulo, mod.numero]
      )
      for (const [idx, lec] of mod.lecciones.entries()) {
        const leccionId = uuidDe(`leccion:${lec.codigo}`)
        await cliente.query(
          `insert into academia.lessons (id, module_id, title, position, lesson_type, status, description_rich)
           values ($1, $2, $3, $4, 'text', 'draft', $5::jsonb)
           on conflict (id) do update
             set title = excluded.title, position = excluded.position, description_rich = excluded.description_rich`,
          [leccionId, moduloId, lec.titulo, idx + 1, JSON.stringify(aTiptap(lec.cuerpo))]
        )
        totalLecciones++
      }
      linea('ok', mod.titulo.padEnd(42), `${mod.lecciones.length} lecciones`)
    }
    await cliente.query('commit')
    return { cursoId, statusCurso, totalLecciones }
  } catch (e) {
    await cliente.query('rollback')
    throw e
  }
}

// --- main ----------------------------------------------------------------------------

async function main() {
  titulo('SEED DEL CURSO — Claude en tu Empresa')
  const modulos = leerModulos()
  if (!modulos.length) throw new Error('No encontré ningún modulo-N/guion.md')

  if (SOLO_JSON) {
    const primera = modulos[0].lecciones[0]
    console.log(JSON.stringify({ titulo: primera.titulo, description_rich: aTiptap(primera.cuerpo) }, null, 2))
    return
  }

  const vars = cargarEnv()
  const cliente = await conectarPostgres(vars)
  try {
    const { cursoId, statusCurso, totalLecciones } = await sembrar(cliente, modulos)
    const { rows } = await cliente.query(
      `select count(*)::int as n from academia.lessons l
         join academia.modules m on m.id = l.module_id
        where m.course_id = $1`, [cursoId]
    )
    console.log('')
    linea('ok', 'Curso sembrado', `${modulos.length} módulos · ${totalLecciones} lecciones escritas · ${rows[0].n} en la base`)
    console.log(`      curso: ${cursoId}  (${statusCurso}) · las lecciones nacen en draft y se publican una por una desde /admin/cursos`)
    console.log('')
  } finally {
    await cliente.end().catch(() => {})
  }
}

main().catch((e) => { console.error(`\n  ${e.message}\n`); process.exitCode = 1 })
