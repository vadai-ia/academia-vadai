#!/usr/bin/env node
/**
 * medir-latencia.mjs — Cuánto tarda cada vista, de verdad.
 *
 * Abre sesión como el alumno QA vigente y pide cada vista varias veces,
 * reportando la mediana. Solo lee: son vistas de página, no escribe nada, así
 * que se puede correr contra producción sin ensuciar.
 *
 *   pnpm medir                                  # contra localhost:3117
 *   pnpm medir -- --prod                        # contra el dominio en vivo
 *   pnpm medir -- --url=http://localhost:3000   # contra otro
 *
 * Por qué medir y no razonar: a esta escala —40 alumnos, un curso— ninguna
 * consulta es lenta por sí sola. Lo que cuesta es la CANTIDAD de viajes de red
 * encadenados, y eso no se ve leyendo el código. La primera medición encontró
 * que una sola vista del curso resolvía la sesión tres veces.
 *
 * También mide un viaje suelto a Supabase, que es la unidad en la que hay que
 * pensar: si un viaje son 100 ms, doce consultas en serie son 1.2 s hagas lo
 * que hagas con los índices.
 */

import { cargarEnv, exigir, titulo } from './lib/entorno.mjs'
import { CURSO_QA, IDS } from './lib/qa.mjs'

const vars = cargarEnv()
const SUPABASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')

const arg = process.argv.find((a) => a.startsWith('--url='))
const BASE = (
  arg
    ? arg.split('=')[1]
    : process.argv.includes('--prod')
      ? (vars.NEXT_PUBLIC_APP_URL ?? 'https://academia.vadai.com.mx')
      : 'http://localhost:3117'
).replace(/\/+$/, '')

const CORRIDAS = 6

/** Umbral a partir del cual una vista se siente lenta al abrirla. */
const LENTO_MS = 900

const VISTAS = [
  ['/mis-cursos', 'mis cursos'],
  [`/curso/${CURSO_QA.slug}`, 'curso (índice + certificado)'],
  [`/curso/${CURSO_QA.slug}/${IDS.leccionVideo}`, 'lección de video'],
  [`/curso/${CURSO_QA.slug}/${IDS.leccionQuiz}`, 'lección de quiz'],
  [`/curso/${CURSO_QA.slug}/comunidad`, 'comunidad'],
  ['/perfil', 'perfil'],
  ['/blog', 'blog'],
]

async function abrirSesion() {
  const enlace = await fetch(`${SUPABASE}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'recovery', email: `qa-alumno1@academia.vadai.com.mx` }),
  })

  const cuerpo = await enlace.json()
  const hash = cuerpo.hashed_token ?? cuerpo.properties?.hashed_token
  if (!hash) return null

  const res = await fetch(
    `${BASE}/auth/confirmar?token_hash=${encodeURIComponent(hash)}&type=recovery`,
    { redirect: 'manual' }
  )

  const cookies = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0])
  return cookies.length > 0 ? cookies.join('; ') : null
}

function mediana(valores) {
  const orden = [...valores].sort((a, b) => a - b)
  return orden[Math.floor(orden.length / 2)]
}

async function medir(ruta, cookie) {
  const tiempos = []
  let estado = 0

  for (let i = 0; i < CORRIDAS; i += 1) {
    const inicio = performance.now()
    const res = await fetch(`${BASE}${ruta}`, { headers: { cookie }, redirect: 'manual' })
    await res.text() // el tiempo hasta el último byte, no hasta el primero
    tiempos.push(performance.now() - inicio)
    estado = res.status
  }

  return { med: Math.round(mediana(tiempos)), min: Math.round(Math.min(...tiempos)), estado }
}

/** Un viaje suelto a PostgREST: la unidad de la que se compone todo lo demás. */
async function viajeSuelto() {
  const tiempos = []
  for (let i = 0; i < 8; i += 1) {
    const inicio = performance.now()
    await fetch(`${SUPABASE}/rest/v1/courses?select=id&limit=1`, {
      headers: {
        apikey: SERVICE,
        Authorization: `Bearer ${SERVICE}`,
        'Accept-Profile': 'academia',
      },
    })
    tiempos.push(performance.now() - inicio)
  }
  return Math.round(mediana(tiempos))
}

async function main() {
  titulo('LATENCIA POR VISTA')
  console.log(`  App:       ${BASE}`)

  const unViaje = await viajeSuelto()
  console.log(`  Un viaje a Supabase desde aquí: ${unViaje} ms`)

  const cookie = await abrirSesion()
  if (!cookie) {
    console.error('')
    console.error('  No se pudo abrir sesión. ¿Está la app corriendo y sembrado el QA?')
    console.error('')
    process.exitCode = 1
    return
  }

  const ancho = Math.max(...VISTAS.map(([, n]) => n.length))
  const lentas = []

  console.log('')
  console.log(`  ${'vista'.padEnd(ancho)}   mediana    mínimo`)
  console.log('  ' + '─'.repeat(ancho + 24))

  for (const [ruta, nombre] of VISTAS) {
    const { med, min, estado } = await medir(ruta, cookie)

    if (estado >= 300) {
      console.log(`  ${nombre.padEnd(ancho)}   —          —        (HTTP ${estado})`)
      continue
    }

    const marca = med > LENTO_MS ? '  ← lenta' : ''
    console.log(
      `  ${nombre.padEnd(ancho)}   ${String(med).padStart(5)} ms   ${String(min).padStart(5)} ms${marca}`
    )
    if (med > LENTO_MS) lentas.push({ nombre, med })
  }

  console.log('  ' + '─'.repeat(ancho + 24))

  if (lentas.length === 0) {
    console.log(`  Todas por debajo de ${LENTO_MS} ms.`)
  } else {
    console.log(`  ${lentas.length} vista(s) por encima de ${LENTO_MS} ms:`)
    for (const l of lentas) {
      const viajes = Math.round(l.med / unViaje)
      console.log(`    ${l.nombre} — ${l.med} ms ≈ ${viajes} viajes encadenados`)
    }
    console.log('')
    console.log('  A esta escala ninguna consulta es lenta por sí sola: lo que')
    console.log('  cuesta es cuántas van en serie. Busca awaits que podrían ir')
    console.log('  en un Promise.all, y datos que se piden dos veces.')
  }

  console.log('')
}

main().catch((error) => {
  console.error('')
  console.error(`  ${error.message}`)
  console.error('')
  process.exitCode = 1
})
