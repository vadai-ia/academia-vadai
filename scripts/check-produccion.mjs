#!/usr/bin/env node
/**
 * check-produccion.mjs — Smoke test del dominio en vivo.
 *
 * Se corre contra academia.vadai.com.mx, no contra localhost. Es de solo
 * lectura: no crea usuarios, no emite certificados, no manda correos. Se puede
 * correr después de cada deploy sin ensuciar nada.
 *
 * Lo que más importa aquí no son los 200. Es la lista blanca de redirects de
 * Supabase Auth: si el dominio no está, los enlaces de los correos apuntan a
 * `localhost` y el alumno que acaba de pagar recibe una liga muerta. Eso no se
 * nota probando en local, porque en local el dominio SÍ está permitido.
 *
 *   pnpm check:prod
 */

import { cargarEnv, exigir, titulo } from './lib/entorno.mjs'

const vars = cargarEnv()
const SUPABASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const DOMINIO = (process.env.DOMINIO ?? vars.NEXT_PUBLIC_APP_URL ?? 'https://academia.vadai.com.mx')
  .replace(/\/+$/, '')

const resultados = []

function comprobar(grupo, descripcion, ok, detalle = '') {
  resultados.push({ grupo, descripcion, ok, detalle })
}

async function pedir(url, opciones = {}) {
  try {
    return await fetch(url, { redirect: 'manual', ...opciones })
  } catch (error) {
    return { status: 0, headers: new Headers(), error: error.message, text: async () => '' }
  }
}

/**
 * El `redirect_to` que producción le manda a Supabase al arrancar el login con
 * Google. Es la única forma de ver desde fuera qué `NEXT_PUBLIC_APP_URL` tiene
 * Vercel: la variable se lee en una server action, así que no se inlinea en el
 * bundle del cliente.
 *
 * Se replica el formulario por HTTP, aprovechando que funciona sin JavaScript.
 * No completa el login: solo lee la URL de autorización y se detiene ahí.
 */
async function redirectToDeProduccion() {
  const res = await pedir(`${DOMINIO}/login`)
  if (res.status !== 200) return null

  const cookies = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
  const html = await res.text()

  let campos = null
  for (const bloque of html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)) {
    if (!/Google/i.test(bloque[1])) continue
    const encontrados = {}
    for (const etiqueta of bloque[1].matchAll(/<input\b[^>]*>/g)) {
      const nombre = etiqueta[0].match(/name="([^"]*)"/)?.[1]
      if (!nombre) continue
      encontrados[nombre] = (etiqueta[0].match(/value="([^"]*)"/)?.[1] ?? '').replace(/&amp;/g, '&')
    }
    if (Object.keys(encontrados).some((n) => n.startsWith('$ACTION'))) campos = encontrados
  }

  if (!campos) return null

  const cuerpo = new FormData()
  for (const [n, v] of Object.entries(campos)) cuerpo.append(n, v)

  const accion = await pedir(`${DOMINIO}/login`, {
    method: 'POST',
    headers: cookies ? { cookie: cookies } : {},
    body: cuerpo,
  })

  const destino = accion.headers.get('location') ?? ''
  if (!destino) return null

  try {
    return new URL(destino).searchParams.get('redirect_to')
  } catch {
    return null
  }
}

async function main() {
  titulo('SMOKE TEST DE PRODUCCIÓN')
  console.log(`  Dominio:  ${DOMINIO}`)
  console.log(`  Supabase: ${SUPABASE}`)

  // ------------------------------------------------------------------
  const G1 = 'CONFIGURACIÓN'

  comprobar(G1, 'NEXT_PUBLIC_APP_URL usa https', DOMINIO.startsWith('https://'), DOMINIO)
  comprobar(G1, 'sin barra final', !DOMINIO.endsWith('/'), DOMINIO)

  if (DOMINIO.startsWith('https://')) {
    const enClaro = await pedir(DOMINIO.replace('https://', 'http://'))
    comprobar(
      G1,
      'http redirige a https',
      [301, 307, 308].includes(enClaro.status),
      `${enClaro.status} → ${enClaro.headers.get('location') ?? '—'}`
    )
  }

  // ------------------------------------------------------------------
  const G2 = 'RUTAS PÚBLICAS'

  for (const ruta of ['/', '/login', '/recuperar']) {
    const r = await pedir(`${DOMINIO}${ruta}`)
    comprobar(G2, `${ruta} responde 200`, r.status === 200, String(r.status))
  }

  // Un folio inexistente contesta 200 con explicación, no 404 (§3.6).
  const folioFalso = await pedir(`${DOMINIO}/certificado/VADAI-2026-ZZZZZZZZZZ`)
  comprobar(G2, '/certificado/[folio] abre sin sesión', folioFalso.status === 200,
    String(folioFalso.status))

  if (folioFalso.status === 200) {
    const html = await folioFalso.text()
    comprobar(G2, 'y explica que no lo encontró', html.includes('Sin resultados'))
    comprobar(G2, 'con noindex', /noindex/i.test(html))
  }

  // ------------------------------------------------------------------
  const G3 = 'RUTAS PROTEGIDAS'

  for (const ruta of ['/mis-cursos', '/blog', '/perfil', '/admin']) {
    const r = await pedir(`${DOMINIO}${ruta}`)
    const destino = r.headers.get('location') ?? ''
    comprobar(
      G3,
      `${ruta} manda al login sin sesión`,
      [302, 307].includes(r.status) && destino.includes('/login'),
      `${r.status} → ${destino || '—'}`
    )
  }

  // Una ruta de API contesta con status, no con un redirect al login.
  const api = await pedir(`${DOMINIO}/api/certificados/VADAI-2026-ZZZZZZZZZZ`)
  comprobar(G3, '/api/ sin sesión responde 401, no redirige', api.status === 401, String(api.status))

  // ------------------------------------------------------------------
  const G4 = 'WEBHOOK DE STRIPE'

  const get = await pedir(`${DOMINIO}/api/stripe/webhook`)
  comprobar(G4, 'no acepta GET', get.status === 405, String(get.status))

  const sinFirma = await pedir(`${DOMINIO}/api/stripe/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'checkout.session.completed' }),
  })
  comprobar(G4, 'rechaza un evento sin firma', sinFirma.status === 400, String(sinFirma.status))

  // ------------------------------------------------------------------
  // Lo importante. Supabase valida `redirect_to` contra su lista blanca y, si
  // no está, REBOTA A LA SITE URL sin decir nada. Ese silencio es la trampa:
  // los correos salen igual, con la liga equivocada.
  const G5 = 'REDIRECTS DE SUPABASE AUTH'

  async function permitido(destino) {
    const r = await pedir(
      `${SUPABASE}/auth/v1/verify?token=invalido&type=recovery` +
        `&redirect_to=${encodeURIComponent(destino)}`
    )
    const aDonde = (r.headers.get('location') ?? '').split('#')[0].replace(/\/+$/, '')
    return { permitido: aDonde === destino.replace(/\/+$/, ''), aDonde }
  }

  // Control negativo: si esto diera "permitido", la lista blanca sería un
  // comodín y el resto de la comprobación no valdría nada.
  const ajeno = await permitido('https://no-autorizado.example.com/x')
  comprobar(G5, 'un dominio ajeno NO se permite', !ajeno.permitido, ajeno.aDonde || '—')

  for (const ruta of ['/auth/callback', '/auth/confirmar', '/nueva-contrasena', '/mis-cursos']) {
    const r = await permitido(`${DOMINIO}${ruta}`)
    comprobar(G5, `${ruta} está en la lista blanca`, r.permitido,
      r.permitido ? 'ok' : `rebota a ${r.aDonde}`)
  }

  // ------------------------------------------------------------------
  // Todo lo de arriba usa el DOMINIO de este .env.local. Pero el que importa
  // es el NEXT_PUBLIC_APP_URL de Vercel, que puede ser otro y no se ve desde
  // aquí: se lee server-side, así que tampoco aparece en el bundle.
  //
  // Se saca arrancando el login con Google y mirando el `redirect_to` que
  // producción le manda a Supabase. Es una lectura: no crea sesión ni usuario.
  const G6 = 'LO QUE VERCEL TIENE DE VERDAD'

  const real = await redirectToDeProduccion()

  if (real === null) {
    comprobar(G6, 'se pudo leer el redirect_to de producción', false, 'no se encontró')
  } else {
    comprobar(G6, 'coincide con el dominio esperado',
      real === `${DOMINIO}/auth/callback`, real)
    comprobar(G6, 'usa https', real.startsWith('https://'), real)

    const permitidoReal = await permitido(real)
    comprobar(G6, 'y ese valor SÍ está en la lista blanca', permitidoReal.permitido,
      permitidoReal.permitido ? 'ok' : `rebota a ${permitidoReal.aDonde}`)
  }

  // ------------------------------------------------------------------
  imprimir()
}

function imprimir() {
  const porGrupo = new Map()
  for (const r of resultados) {
    if (!porGrupo.has(r.grupo)) porGrupo.set(r.grupo, [])
    porGrupo.get(r.grupo).push(r)
  }
  const ancho = Math.max(...resultados.map((r) => r.descripcion.length))

  for (const [grupo, casos] of porGrupo) {
    console.log('')
    console.log(`  ${grupo}`)
    console.log('  ' + '─'.repeat(ancho + 26))
    for (const c of casos) {
      console.log(`  ${c.ok ? '✓' : '✗'}  ${c.descripcion.padEnd(ancho)}  ${c.detalle}`)
    }
  }

  const fallidas = resultados.filter((r) => !r.ok)

  console.log('')
  console.log('  ' + '─'.repeat(ancho + 26))
  if (fallidas.length === 0) {
    console.log(`  PRODUCCIÓN EN VERDE — ${resultados.length} comprobaciones.`)
    console.log('')
    process.exitCode = 0
    return
  }

  console.log(`  ${fallidas.length} de ${resultados.length} comprobaciones FALLARON:`)
  for (const f of fallidas) console.log(`    ${f.grupo} · ${f.descripcion}  ${f.detalle}`)

  if (fallidas.some((f) => f.grupo === 'LO QUE VERCEL TIENE DE VERDAD')) {
    console.log('')
    console.log('  ── Cómo arreglar NEXT_PUBLIC_APP_URL ──────────────────────')
    console.log('  Vercel → Settings → Environment Variables:')
    console.log('')
    console.log(`    NEXT_PUBLIC_APP_URL = ${DOMINIO}`)
    console.log('')
    console.log('  Con https y sin barra final. Después hay que REDEPLOYAR:')
    console.log('  las NEXT_PUBLIC_* se hornean en el build, así que cambiar')
    console.log('  la variable sin volver a construir no cambia nada.')
  }

  if (fallidas.some((f) => f.grupo === 'REDIRECTS DE SUPABASE AUTH' && f.descripcion.includes('lista blanca'))) {
    console.log('')
    console.log('  ── Cómo arreglar la lista blanca ──────────────────────────')
    console.log('  Supabase → Authentication → URL Configuration:')
    console.log('')
    console.log(`    Site URL:       ${DOMINIO}`)
    console.log('    Redirect URLs:  (una por línea)')
    console.log(`                    ${DOMINIO}/**`)
    console.log('                    http://localhost:3000/**')
    console.log('')
    console.log('  Sin esto los correos de invitación y de recuperación llevan')
    console.log('  a la Site URL actual, no al dominio. El alumno que paga')
    console.log('  recibe una liga muerta y no hay forma de que entre.')
  }

  console.log('')
  process.exitCode = 1
}

main().catch((error) => {
  console.error('')
  console.error(`  ${error.message}`)
  console.error('')
  process.exitCode = 1
})
