#!/usr/bin/env node
/**
 * qa-checklist.mjs — El checklist de M11, corrido y firmado.
 *
 * §10 pide "checklist QA firmado". Un checklist en Markdown con casillas que
 * alguien palomea a mano no prueba nada: se palomea igual esté verde o roja la
 * cosa. Este lo CORRE todo y firma el resultado con el commit y la fecha, así
 * que la firma dice qué versión exacta del código pasó y cuándo.
 *
 *   PORT=3117 pnpm start     # en una terminal
 *   pnpm qa                  # en otra
 *
 * Escribe docs/QA.md con el resultado. Si algo falla, el documento lo dice: no
 * se firma en verde a medias.
 */

import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '..')

const SIN_PROD = process.argv.includes('--sin-prod')
const SIN_BUILD = process.argv.includes('--sin-build')
const SIN_CAPTURAS = process.argv.includes('--sin-capturas')

/**
 * Los pasos, en el orden en que tiene sentido correrlos: primero lo que no
 * necesita nada, después lo que necesita la base, al final lo que necesita la
 * app corriendo y el dominio en vivo.
 *
 * `critico: false` marca lo que informa pero no reprueba — la reconciliación de
 * Storage encuentra cosas que a veces son normales.
 */
const PASOS = [
  {
    llave: 'typecheck',
    titulo: 'TypeScript estricto, sin `any`',
    comando: ['pnpm', 'typecheck'],
    seccion: 'Código',
  },
  {
    llave: 'lint',
    titulo: 'ESLint limpio',
    comando: ['pnpm', 'lint'],
    seccion: 'Código',
  },
  {
    llave: 'build',
    titulo: 'Build de producción',
    comando: ['pnpm', 'build'],
    seccion: 'Código',
    saltar: SIN_BUILD,
  },
  {
    llave: 'm0',
    titulo: 'Infraestructura: env, schema expuesto, buckets, Auth',
    comando: ['pnpm', 'check:m0'],
    seccion: 'Infraestructura',
  },
  {
    llave: 'migraciones',
    titulo: 'Migraciones al día',
    comando: ['pnpm', 'db:status'],
    seccion: 'Infraestructura',
  },
  {
    llave: 'bunny',
    titulo: 'Credenciales de Bunny Stream',
    comando: ['pnpm', 'check:bunny'],
    seccion: 'Infraestructura',
  },
  {
    llave: 'seed',
    titulo: 'Datos QA sembrados',
    comando: ['pnpm', 'db:seed'],
    seccion: 'Funcionalidad',
  },
  {
    // El seed ya NO publica los cursos QA: respeta lo que haya, para que un
    // `db:seed` suelto no los saque del archivo y los devuelva al panel del
    // admin real. Publicarlos es deliberado y pasa aquí, justo antes de
    // probar; el paso 'esconder' los archiva al terminar.
    llave: 'mostrar',
    titulo: 'Cursos QA publicados para las suites',
    comando: ['node', 'scripts/qa-mostrar.mjs'],
    seccion: 'Funcionalidad',
  },
  {
    // Después del seed (necesita los cursos QA publicados) y antes de las
    // suites (test-todo los vuelve a archivar al terminar). No reprueba: su
    // resultado se MIRA en capturas/hoja-*.png, que es lo que ninguna
    // aserción puede hacer.
    llave: 'capturas',
    titulo: 'Capturas en teléfono y escritorio, con auditoría de blancos',
    comando: ['node', 'scripts/capturas.mjs', '--auditar'],
    seccion: 'Funcionalidad',
    critico: false,
    saltar: SIN_CAPTURAS,
  },
  {
    llave: 'suites',
    titulo: 'Las suites de milestone',
    comando: ['node', 'scripts/test-todo.mjs'],
    seccion: 'Funcionalidad',
  },
  {
    llave: 'storage',
    titulo: 'Storage reconciliado (sin huérfanos ni colgantes)',
    comando: ['node', 'scripts/storage-huerfanos.mjs'],
    seccion: 'Higiene',
    critico: false,
  },
  {
    llave: 'esconder',
    titulo: 'Cursos QA archivados, fuera del panel del admin',
    comando: ['node', 'scripts/qa-esconder.mjs'],
    seccion: 'Higiene',
  },
  {
    llave: 'prod',
    titulo: 'Smoke test del dominio en vivo',
    comando: ['node', 'scripts/check-produccion.mjs'],
    seccion: 'Producción',
    saltar: SIN_PROD,
  },
]

function correr(comando) {
  return new Promise((resolve) => {
    // Como UNA cadena y no como (cmd, args[]): pasarle un arreglo junto con
    // `shell: true` dispara el DeprecationWarning DEP0190 de Node, que se cuela
    // en la salida y ensucia el reporte.
    const hijo = spawn(comando.join(' '), {
      cwd: RAIZ,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    })

    let salida = ''
    hijo.stdout.on('data', (d) => (salida += d))
    hijo.stderr.on('data', (d) => (salida += d))
    hijo.on('close', (codigo) => resolve({ codigo: codigo ?? 1, salida }))
    hijo.on('error', (e) => resolve({ codigo: 1, salida: e.message }))
  })
}

/** Una línea corta que resuma qué pasó, para el reporte. */
function resumir(llave, salida) {
  const verde = salida.match(/(\d+)\/(\d+)\s+aserciones/)
  if (verde) return `${verde[1]}/${verde[2]} aserciones`

  const rojo = salida.match(/(\d+)\s+de\s+(\d+)\s+aserciones\s+FALLARON/i)
  if (rojo) return `${rojo[1]} de ${rojo[2]} aserciones fallaron`

  if (llave === 'suites') {
    const todo = salida.match(/(\d+)\s+suites,\s+(\d+)\s+aserciones/)
    if (todo) return `${todo[1]} suites, ${todo[2]} aserciones`
    const fallo = salida.match(/(\d+)\s+de\s+(\d+)\s+suites\s+FALLARON/i)
    if (fallo) return `${fallo[1]} de ${fallo[2]} suites fallaron`
  }

  const prodOk = salida.match(/PRODUCCIÓN EN VERDE — (\d+) comprobaciones/)
  if (prodOk) return `${prodOk[1]} comprobaciones`

  const prodMal = salida.match(/(\d+)\s+de\s+(\d+)\s+comprobaciones\s+FALLARON/i)
  if (prodMal) return `${prodMal[1]} de ${prodMal[2]} comprobaciones fallaron`

  const capturas = salida.match(/(\d+)\s+pantallas,\s+(\d+)\s+hallazgos críticos,\s+(\d+)\s+avisos/)
  if (capturas) return `${capturas[1]} pantallas · ${capturas[2]} críticos · ${capturas[3]} avisos`

  const huerfanos = salida.match(/(\d+)\s+huérfano\(s\)/)
  if (huerfanos) return `${huerfanos[1]} huérfano(s) por limpiar`

  const colgantes = salida.match(/Referencias colgantes \((\d+)\)/)
  if (colgantes) return `${colgantes[1]} referencia(s) colgante(s)`

  if (/Sin huérfanos que borrar/.test(salida)) return 'sin huérfanos'
  if (/Compiled successfully/.test(salida)) return 'compila'
  if (/al día|sin pendientes/i.test(salida)) return 'al día'

  return 'ok'
}

async function firma() {
  const commit = await correr(['git', 'rev-parse', '--short', 'HEAD'])
  const rama = await correr(['git', 'rev-parse', '--abbrev-ref', 'HEAD'])
  const sucio = await correr(['git', 'status', '--porcelain'])
  return {
    commit: commit.codigo === 0 ? commit.salida.trim() : 'sin git',
    rama: rama.codigo === 0 ? rama.salida.trim() : '?',
    limpio: sucio.codigo === 0 && sucio.salida.trim() === '',
  }
}

async function main() {
  console.log('')
  console.log('  CHECKLIST QA — VADAI ACADEMIA')
  console.log('  ' + '─'.repeat(66))

  const resultados = []
  const ancho = Math.max(...PASOS.map((p) => p.titulo.length))

  for (const paso of PASOS) {
    if (paso.saltar) {
      resultados.push({ ...paso, estado: 'saltado', detalle: 'omitido por bandera' })
      console.log(`  ~  ${paso.titulo.padEnd(ancho)}  saltado`)
      continue
    }

    const { codigo, salida } = await correr(paso.comando)
    const detalle = resumir(paso.llave, salida)
    const estado = codigo === 0 ? 'ok' : paso.critico === false ? 'aviso' : 'falla'
    const icono = estado === 'ok' ? '✓' : estado === 'aviso' ? '·' : '✗'

    resultados.push({ ...paso, estado, detalle, salida })
    console.log(`  ${icono}  ${paso.titulo.padEnd(ancho)}  ${detalle}`)
  }

  const fallas = resultados.filter((r) => r.estado === 'falla')
  const avisos = resultados.filter((r) => r.estado === 'aviso')
  const sello = await firma()
  const cuando = new Date()

  console.log('  ' + '─'.repeat(66))
  console.log(
    fallas.length === 0
      ? `  CHECKLIST FIRMADO — ${resultados.filter((r) => r.estado === 'ok').length} pasos en verde.`
      : `  NO SE FIRMA — ${fallas.length} paso(s) fallaron.`
  )
  for (const f of fallas) console.log(`    ✗ ${f.titulo}: ${f.detalle}`)
  for (const a of avisos) console.log(`    · ${a.titulo}: ${a.detalle}`)

  console.log('')
  console.log(`  commit ${sello.commit} (${sello.rama})${sello.limpio ? '' : ' · CON CAMBIOS SIN COMMITEAR'}`)

  escribirReporte(resultados, { fallas, avisos, sello, cuando })
  console.log(`  Reporte en docs/QA.md`)
  console.log('')

  process.exitCode = fallas.length === 0 ? 0 : 1
}

function escribirReporte(resultados, { fallas, avisos, sello, cuando }) {
  const fecha = new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City',
  }).format(cuando)

  const icono = { ok: '✅', falla: '❌', aviso: '⚠️', saltado: '⏭️' }
  const secciones = [...new Set(resultados.map((r) => r.seccion))]

  const lineas = [
    '# Checklist QA',
    '',
    fallas.length === 0
      ? '> **Firmado.** Todos los pasos críticos en verde.'
      : `> **Sin firmar.** ${fallas.length} paso(s) fallaron. Ver el detalle abajo.`,
    '',
    '| | |',
    '|---|---|',
    `| Fecha | ${fecha} (CDMX) |`,
    `| Commit | \`${sello.commit}\` en \`${sello.rama}\` |`,
    `| Árbol | ${sello.limpio ? 'limpio' : '**con cambios sin commitear**'} |`,
    '',
    'Se regenera con `pnpm qa`, que corre cada paso de verdad. Un checklist que',
    'se palomea a mano se palomea igual esté verde o roja la cosa; este firma con',
    'el commit, así que dice qué versión exacta pasó.',
    '',
    '---',
    '',
  ]

  for (const seccion of secciones) {
    lineas.push(`## ${seccion}`, '', '| | Paso | Resultado |', '|---|---|---|')
    for (const r of resultados.filter((x) => x.seccion === seccion)) {
      lineas.push(`| ${icono[r.estado]} | ${r.titulo} | ${r.detalle} |`)
    }
    lineas.push('')
  }

  if (fallas.length > 0) {
    lineas.push('---', '', '## Lo que falló', '')
    for (const f of fallas) {
      lineas.push(`### ${f.titulo}`, '', '```', (f.salida ?? '').trim().split('\n').slice(-25).join('\n'), '```', '')
    }
  }

  if (avisos.length > 0) {
    lineas.push('---', '', '## Avisos (no reprueban)', '')
    for (const a of avisos) {
      lineas.push(`### ${a.titulo}`, '', '```', (a.salida ?? '').trim().split('\n').slice(-20).join('\n'), '```', '')
    }
  }

  lineas.push(
    '---',
    '',
    '## Lo que este checklist NO puede firmar',
    '',
    'Queda fuera lo que ningún script puede comprobar solo, y conviene tenerlo a',
    'la vista para no confundir "en verde" con "listo":',
    '',
    '- **Login con Google de punta a punta.** Se comprueba que el `redirect_to`',
    '  esté permitido, pero completar el consentimiento de Google necesita un',
    '  humano con una cuenta real.',
    '- **Que un correo llegue a la bandeja.** Se comprueba que Resend lo acepte,',
    '  no que no caiga en spam.',
    '- **Un pago real de Stripe.** La suite firma eventos sintéticos con el',
    '  `whsec_` verdadero, que cubre más casos que un pago feliz, pero no es un',
    '  cargo real.',
    '- **Que un video de Bunny se reproduzca.** Se comprueba la firma del token,',
    '  no la reproducción.',
    '- **Cómo se ve en un teléfono de verdad.** `pnpm capturas` fotografía cada',
    '  pantalla a 390×844 con emulación táctil y a 1280×800, en los dos temas, y',
    '  audita desbordes y blancos menores a 44 px; pero las fotos las tiene que',
    '  MIRAR alguien (`capturas/hoja-*.png`), y lo que sigue sin firma es cómo se',
    '  instala y cómo pinta la barra de estado un iPhone o un Android reales.',
    ''
  )

  writeFileSync(path.join(RAIZ, 'docs', 'QA.md'), lineas.join('\n'), 'utf8')
}

main().catch((error) => {
  console.error('')
  console.error(`  ${error.message}`)
  console.error('')
  process.exitCode = 1
})
