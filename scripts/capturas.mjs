#!/usr/bin/env node
/**
 * capturas.mjs — Cada pantalla, vista de verdad: 390 px táctil y 1280 px, en
 * tema claro y oscuro.
 *
 * Las suites comprueban HTML y Postgres; ninguna ve cómo queda una pantalla en
 * un teléfono. Este script abre el Edge o Chrome del sistema —sin instalar
 * nada— por el protocolo de DevTools, entra como el alumno QA y como el admin
 * QA, y fotografía cada ruta en un viewport de iPhone con emulación táctil (lo
 * que enciende `pointer: coarse` y con él los blancos de 44 px) y en uno de
 * escritorio. Con --auditar mide además lo que una foto no dice: desbordes
 * horizontales, contenido escondido bajo la barra inferior y blancos táctiles
 * menores a 44 px.
 *
 * Regla de la casa, heredada del skill presentacion-vadai: SE MIRA SIEMPRE.
 * Un cambio de UI no está listo hasta leer capturas/hoja-*.png.
 *
 *   PORT=3117 pnpm start
 *   pnpm capturas                       # alumno + admin + público · 390 y 1280 · claro y oscuro
 *   pnpm capturas -- --prod             # contra el dominio en vivo (solo lee)
 *   pnpm capturas -- --solo=alumno,admin --ancho=390 --tema=oscuro --auditar
 *   pnpm capturas -- --rutas=/mis-cursos,/perfil
 *
 * Desde Git Bash en Windows, `--rutas=/login` llega convertido a una ruta de
 * Windows (es MSYS, no este script): antepón `MSYS_NO_PATHCONV=1`.
 *
 * Sale con 1 si --auditar encontró algo crítico; con 2 si no hay navegador.
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { RAIZ, cargarEnv, exigir, titulo } from './lib/entorno.mjs'
import { CURSO_QA, IDS, USUARIOS_QA } from './lib/qa.mjs'

const vars = cargarEnv()
const SUPABASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')

const bandera = (nombre) => process.argv.find((a) => a.startsWith(`--${nombre}=`))?.split('=').slice(1).join('=')
const PROD = process.argv.includes('--prod')
const AUDITAR = process.argv.includes('--auditar')
const BASE = (
  bandera('url') ?? (PROD ? (vars.NEXT_PUBLIC_APP_URL ?? 'https://academia.vadai.com.mx') : 'http://localhost:3117')
).replace(/\/+$/, '')

const SALIDA = path.resolve(RAIZ, 'capturas')

const correo = Object.fromEntries(USUARIOS_QA.map((u) => [u.llave, u.email]))

// --- qué se fotografía -------------------------------------------------------

const SESIONES = {
  alumno: {
    email: correo.alumnoVigente,
    rutas: [
      '/mis-cursos',
      `/curso/${CURSO_QA.slug}`,
      `/curso/${CURSO_QA.slug}/${IDS.leccionVideo}`,
      `/curso/${CURSO_QA.slug}/${IDS.leccionQuiz}`,
      `/curso/${CURSO_QA.slug}/comunidad`,
      `/curso/${CURSO_QA.slug}/dinamicas`,
      '/dinamicas',
      `/curso/${CURSO_QA.slug}/en-vivo`,
      '/en-vivo',
      '/perfil',
      '/blog',
    ],
  },
  admin: {
    email: correo.admin,
    rutas: [
      '/admin',
      '/admin/cursos',
      `/admin/cursos/${IDS.curso}`,
      `/admin/cohortes/${IDS.cohorte}`,
      '/admin/alumnos',
      '/admin/empresas',
      '/admin/encuestas',
      '/admin/dinamicas',
      '/admin/entregas',
      '/admin/publicaciones',
    ],
  },
  publico: {
    email: null,
    rutas: ['/login', '/recuperar'],
  },
}

const PERFILES = {
  390: {
    metrics: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true, screenOrientation: { type: 'portraitPrimary', angle: 0 } },
    tactil: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  },
  1280: {
    metrics: { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false, screenOrientation: { type: 'landscapePrimary', angle: 0 } },
    tactil: false,
    userAgent: '',
  },
}

const sesionesPedidas = (bandera('solo') ?? 'alumno,admin,publico').split(',').filter((s) => SESIONES[s])
const anchosPedidos = (bandera('ancho') ?? '390,1280').split(',').map(Number).filter((a) => PERFILES[a])
const temasPedidos = (bandera('tema') ?? 'claro,oscuro').split(',').filter((t) => t === 'claro' || t === 'oscuro')
const rutasPedidas = bandera('rutas')?.split(',').filter(Boolean) ?? null

// --- navegador del sistema ---------------------------------------------------

const NAVEGADORES = [
  bandera('navegador'),
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)

const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms))

function abrirNavegador() {
  const binario = NAVEGADORES.find((n) => existsSync(n))
  if (!binario) return null

  const puerto = 9333 + Math.floor(Math.random() * 400)
  const perfil = path.join(tmpdir(), `vadai-capturas-${process.pid}`)
  const hijo = spawn(
    binario,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      `--user-data-dir=${perfil}`,
      `--remote-debugging-port=${puerto}`,
      'about:blank',
    ],
    { stdio: 'ignore', windowsHide: true }
  )
  return { hijo, puerto, perfil, binario }
}

/** Un cliente mínimo del protocolo de DevTools sobre el WebSocket global de Node. */
async function conectar(puerto) {
  let version = null
  for (let intento = 0; intento < 60 && !version; intento += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:${puerto}/json/version`)
      if (r.ok) version = await r.json()
    } catch {
      /* todavía no escucha */
    }
    if (!version) await esperar(250)
  }
  if (!version) throw new Error('El navegador no abrió el puerto de DevTools.')

  const nueva = await fetch(`http://127.0.0.1:${puerto}/json/new?about:blank`, { method: 'PUT' })
  const objetivo = await nueva.json()

  const ws = new WebSocket(objetivo.webSocketDebuggerUrl)
  await new Promise((ok, mal) => {
    ws.onopen = ok
    ws.onerror = () => mal(new Error('No se pudo conectar al WebSocket de DevTools.'))
  })

  let siguiente = 0
  const pendientes = new Map()
  const oyentes = new Set()

  ws.onmessage = (evento) => {
    const mensaje = JSON.parse(typeof evento.data === 'string' ? evento.data : String(evento.data))
    if (mensaje.id && pendientes.has(mensaje.id)) {
      const { ok, mal } = pendientes.get(mensaje.id)
      pendientes.delete(mensaje.id)
      if (mensaje.error) mal(new Error(`${mensaje.error.message} (${mensaje.error.code})`))
      else ok(mensaje.result ?? {})
    } else if (mensaje.method) {
      for (const oyente of oyentes) oyente(mensaje)
    }
  }

  const enviar = (method, params = {}) =>
    new Promise((ok, mal) => {
      const id = ++siguiente
      pendientes.set(id, { ok, mal })
      ws.send(JSON.stringify({ id, method, params }))
    })

  const esperarEvento = (method, tope = 15000) =>
    new Promise((ok) => {
      const reloj = setTimeout(() => {
        oyentes.delete(oyente)
        ok(null)
      }, tope)
      const oyente = (m) => {
        if (m.method !== method) return
        clearTimeout(reloj)
        oyentes.delete(oyente)
        ok(m.params)
      }
      oyentes.add(oyente)
    })

  return { enviar, esperarEvento, cerrar: () => ws.close() }
}

// --- sesión QA por cookies ---------------------------------------------------

function parsearCookie(cruda) {
  const [par, ...atributos] = cruda.split(';').map((p) => p.trim())
  const i = par.indexOf('=')
  if (i === -1) return null
  const cookie = { name: par.slice(0, i), value: par.slice(i + 1), path: '/' }
  if (cookie.value === '') return null
  for (const atributo of atributos) {
    const [llave, valor = ''] = atributo.split('=')
    const k = llave.toLowerCase()
    if (k === 'path') cookie.path = valor
    else if (k === 'httponly') cookie.httpOnly = true
    else if (k === 'secure') cookie.secure = true
    else if (k === 'samesite') cookie.sameSite = valor.charAt(0).toUpperCase() + valor.slice(1).toLowerCase()
    else if (k === 'max-age') {
      if (Number(valor) <= 0) return null
      cookie.expires = Math.floor(Date.now() / 1000) + Number(valor)
    }
  }
  return cookie
}

async function cookiesDe(email) {
  const enlace = await fetch(`${SUPABASE}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'recovery', email }),
  })
  const cuerpo = await enlace.json()
  const hash = cuerpo.hashed_token ?? cuerpo.properties?.hashed_token
  if (!hash) throw new Error(`No se pudo generar enlace para ${email}. ¿Está sembrado el QA?`)

  const respuesta = await fetch(
    `${BASE}/auth/confirmar?token_hash=${encodeURIComponent(hash)}&type=recovery`,
    { redirect: 'manual' }
  )
  const cookies = (respuesta.headers.getSetCookie?.() ?? []).map(parsearCookie).filter(Boolean)
  if (cookies.length === 0) throw new Error(`La app no devolvió cookies de sesión para ${email}. ¿Está corriendo en ${BASE}?`)
  return cookies
}

// --- emulación ----------------------------------------------------------------

async function emular(cdp, ancho) {
  const perfil = PERFILES[ancho]
  await cdp.enviar('Emulation.setDeviceMetricsOverride', perfil.metrics)
  await cdp.enviar('Emulation.setTouchEmulationEnabled', { enabled: perfil.tactil, maxTouchPoints: perfil.tactil ? 5 : 1 })
  await cdp.enviar('Emulation.setUserAgentOverride', { userAgent: perfil.userAgent })
}

/**
 * El tema vive en localStorage y lo aplica el guion inline del <head>. Este
 * script corre en cada documento ANTES que ese guion, así que el primer pintado
 * ya sale en el tema pedido. Nada de código de producción cambia por el QA.
 */
async function fijarTema(cdp, tema, anterior) {
  if (anterior) await cdp.enviar('Page.removeScriptToEvaluateOnNewDocument', { identifier: anterior })
  const source =
    tema === 'oscuro'
      ? "try{localStorage.setItem('vadai-tema','oscuro')}catch(_){}"
      : "try{localStorage.removeItem('vadai-tema')}catch(_){}"
  const { identifier } = await cdp.enviar('Page.addScriptToEvaluateOnNewDocument', { source })
  return identifier
}

// --- auditoría (corre dentro de la página) ---------------------------------------

const AUDITORIA = `(() => {
  const de = document.documentElement
  const desborde = de.scrollWidth > de.clientWidth + 1
  const barra = document.querySelector('[data-barra-inferior]')
  const barraVisible = Boolean(barra) && getComputedStyle(barra).display !== 'none'
  let tapado = false
  if (barraVisible) {
    window.scrollTo(0, de.scrollHeight)
    const main = document.getElementById('contenido')
    if (main) {
      const r = main.getBoundingClientRect()
      const b = barra.getBoundingClientRect()
      tapado = r.bottom > b.top + 1
    }
    window.scrollTo(0, 0)
  }
  const criticos = new Set(['button', 'pastilla', 'pestana', 'destino', 'icono-boton'])
  const blancos = []
  const selector = 'header button, nav a, nav button, main button, main input:not([type=hidden]):not([type=checkbox]):not([type=radio]), main select, main textarea, main summary, [popover] button'
  for (const el of document.querySelectorAll(selector)) {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    const slot = el.dataset.slot || ''
    const anchoCorto = slot === 'icono-boton' || slot === 'destino' ? r.width < 44 : false
    if (r.height < 44 || anchoCorto) {
      blancos.push({
        critico: criticos.has(slot),
        etiqueta: el.tagName.toLowerCase() + (slot ? '[' + slot + ']' : ''),
        texto: (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 40),
        ancho: Math.round(r.width),
        alto: Math.round(r.height),
      })
    }
  }
  const recorte = [...document.querySelectorAll('h1, h2')]
    .filter((h) => h.scrollWidth > h.clientWidth + 1)
    .map((h) => h.textContent.trim().slice(0, 50))
  const manifiestos = document.querySelectorAll('link[rel="manifest"]').length
  const meta = document.querySelector('meta[name="theme-color"]')
  const esperado = de.classList.contains('dark') ? '#0a1a2f' : '#f5f8fb'
  const tema = manifiestos > 0 ? { meta: meta ? meta.content : null, esperado, ok: Boolean(meta) && meta.content.toLowerCase() === esperado } : null
  return JSON.stringify({ desborde, barraVisible, tapado, blancos, recorte, manifiestos, tema })
})()`

function hallazgosDe(auditoria, ancho) {
  const lista = []
  if (auditoria.desborde) lista.push({ critico: true, texto: 'desborde horizontal: la página es más ancha que la pantalla' })
  if (auditoria.tapado) lista.push({ critico: true, texto: 'la barra inferior tapa el final del contenido' })
  if (auditoria.manifiestos > 1) lista.push({ critico: true, texto: `${auditoria.manifiestos} <link rel="manifest">` })
  if (auditoria.tema && !auditoria.tema.ok) {
    lista.push({ critico: true, texto: `theme-color ${auditoria.tema.meta ?? 'ausente'}, se esperaba ${auditoria.tema.esperado}` })
  }
  for (const h of auditoria.recorte) lista.push({ critico: false, texto: `título recortado: "${h}"` })
  // Los blancos solo cuentan en el viewport táctil: en escritorio hay ratón.
  if (ancho === 390) {
    for (const b of auditoria.blancos) {
      lista.push({ critico: b.critico, texto: `${b.etiqueta} "${b.texto}" mide ${b.ancho}×${b.alto}` })
    }
  }
  return lista
}

// --- captura -----------------------------------------------------------------------

const nombreDeRuta = (ruta) => ruta.replace(/^\//, '').replace(/[^a-zA-Z0-9]+/g, '_') || 'inicio'

async function capturar(cdp, { sesion, ruta, ancho, tema }) {
  const carpeta = path.join(SALIDA, sesion)
  mkdirSync(carpeta, { recursive: true })
  const base = path.join(carpeta, `${nombreDeRuta(ruta)}-${ancho}-${tema}`)

  const cargado = cdp.esperarEvento('Page.loadEventFired')
  await cdp.enviar('Page.navigate', { url: `${BASE}${ruta}` })
  await cargado
  await cdp.enviar('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => 1)', awaitPromise: true })
  await esperar(350)

  const leer = async (expresion) =>
    (await cdp.enviar('Runtime.evaluate', { expression: expresion, returnByValue: true })).result?.value

  const tituloPagina = await leer('document.title')
  const rutaFinal = await leer('location.pathname + location.search')

  const viewport = await cdp.enviar('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${base}.png`, Buffer.from(viewport.data, 'base64'))

  const metricas = await cdp.enviar('Page.getLayoutMetrics')
  const altoTotal = Math.min(Math.ceil(metricas.cssContentSize?.height ?? metricas.contentSize?.height ?? 844), 8000)
  const escala = 1 / PERFILES[ancho].metrics.deviceScaleFactor
  const larga = await cdp.enviar('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: ancho, height: altoTotal, scale: escala },
  })
  writeFileSync(`${base}-larga.png`, Buffer.from(larga.data, 'base64'))

  let hallazgos = []
  if (AUDITAR) {
    const crudo = await leer(AUDITORIA)
    hallazgos = hallazgosDe(JSON.parse(crudo), ancho)
  }

  return {
    sesion,
    ruta,
    ancho,
    tema,
    titulo: tituloPagina,
    rutaFinal,
    archivo: path.relative(RAIZ, `${base}.png`).replace(/\\/g, '/'),
    hallazgos,
  }
}

// --- hoja de contacto -----------------------------------------------------------

async function hojaDeContacto(cdp, sesion, capturas) {
  const figuras = capturas
    .map(
      (c) => `<figure><img src="${path.relative(SALIDA, path.resolve(RAIZ, c.archivo)).replace(/\\/g, '/')}" alt="">
      <figcaption>${c.ruta} · ${c.ancho} · ${c.tema}${c.hallazgos.some((h) => h.critico) ? ' · ✗' : ''}</figcaption></figure>`
    )
    .join('\n')
  const html = `<!doctype html><meta charset="utf-8"><title>Capturas · ${sesion}</title>
<style>
  body{margin:0;padding:16px;background:#0a1a2f;color:#f5f8fb;font:12px Inter,system-ui,sans-serif}
  h1{font-size:14px;font-weight:500;margin:0 0 12px}
  .g{display:grid;grid-template-columns:repeat(5,260px);gap:14px;align-items:start}
  figure{margin:0}
  img{display:block;width:260px;background:#fff;border:1px solid #334a63;border-radius:4px}
  figcaption{padding:4px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#93a3b5}
</style>
<h1>${sesion} · ${BASE} · ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}</h1>
<div class="g">${figuras}</div>`
  const archivo = path.join(SALIDA, `hoja-${sesion}.html`)
  writeFileSync(archivo, html, 'utf8')

  await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false })
  await cdp.enviar('Emulation.setTouchEmulationEnabled', { enabled: false })
  const cargado = cdp.esperarEvento('Page.loadEventFired')
  await cdp.enviar('Page.navigate', { url: pathToFileURL(archivo).href })
  await cargado
  await esperar(400)
  const metricas = await cdp.enviar('Page.getLayoutMetrics')
  const alto = Math.min(Math.ceil(metricas.cssContentSize?.height ?? 900), 12000)
  const foto = await cdp.enviar('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: 1400, height: alto, scale: 1 },
  })
  const png = path.join(SALIDA, `hoja-${sesion}.png`)
  writeFileSync(png, Buffer.from(foto.data, 'base64'))
  return path.relative(RAIZ, png).replace(/\\/g, '/')
}

// --- informe -------------------------------------------------------------------------

function escribirInforme(capturas, hojas) {
  const criticos = capturas.flatMap((c) => c.hallazgos.filter((h) => h.critico).map((h) => ({ ...c, h })))
  const avisos = capturas.flatMap((c) => c.hallazgos.filter((h) => !h.critico).map((h) => ({ ...c, h })))

  const lineas = [
    '# Capturas',
    '',
    `${BASE} · ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })} (CDMX)`,
    '',
    ...hojas.map((h) => `- Hoja de contacto: \`${h}\``),
    '',
    `${capturas.length} pantallas, ${criticos.length} hallazgos críticos, ${avisos.length} avisos.`,
    '',
  ]
  if (criticos.length > 0) {
    lineas.push('## Críticos', '')
    for (const c of criticos) lineas.push(`- **${c.sesion} ${c.ruta}** (${c.ancho}, ${c.tema}): ${c.h.texto} → \`${c.archivo}\``)
    lineas.push('')
  }
  if (avisos.length > 0) {
    lineas.push('## Avisos', '')
    for (const a of avisos) lineas.push(`- ${a.sesion} ${a.ruta} (${a.ancho}, ${a.tema}): ${a.h.texto}`)
    lineas.push('')
  }
  lineas.push('## Pantallas', '', '| Sesión | Ruta | Ancho | Tema | Título | Quedó en | Archivo |', '|---|---|---|---|---|---|---|')
  for (const c of capturas) {
    lineas.push(`| ${c.sesion} | ${c.ruta} | ${c.ancho} | ${c.tema} | ${c.titulo ?? ''} | ${c.rutaFinal ?? ''} | \`${c.archivo}\` |`)
  }
  writeFileSync(path.join(SALIDA, 'informe.md'), lineas.join('\n'), 'utf8')
  writeFileSync(path.join(SALIDA, 'informe.json'), JSON.stringify({ base: BASE, capturas, hojas }, null, 2), 'utf8')
  return { criticos, avisos }
}

// --- main ------------------------------------------------------------------------------

async function main() {
  titulo('CAPTURAS — cada pantalla, vista de verdad')
  console.log(`  App:      ${BASE}`)
  console.log(`  Sesiones: ${sesionesPedidas.join(', ')} · anchos: ${anchosPedidos.join(', ')} · temas: ${temasPedidos.join(', ')}${AUDITAR ? ' · con auditoría' : ''}`)

  const navegador = abrirNavegador()
  if (!navegador) {
    console.error('')
    console.error('  No encontré Edge ni Chrome. Pasa --navegador=<ruta al ejecutable>.')
    console.error('')
    process.exitCode = 2
    return
  }
  console.log(`  Navegador: ${navegador.binario}`)
  mkdirSync(SALIDA, { recursive: true })

  const capturas = []
  const hojas = []
  let cdp = null

  try {
    cdp = await conectar(navegador.puerto)
    await cdp.enviar('Page.enable')
    await cdp.enviar('Network.enable')
    await cdp.enviar('Runtime.enable')

    let guionDeTema = null

    for (const sesion of sesionesPedidas) {
      const { email, rutas } = SESIONES[sesion]
      // --rutas manda: sirve para fotografiar una pantalla con un id que el seed no conoce.
      const rutasDeEsta = rutasPedidas ?? rutas
      if (rutasDeEsta.length === 0) continue

      await cdp.enviar('Network.clearBrowserCookies')
      if (email) {
        for (const cookie of await cookiesDe(email)) await cdp.enviar('Network.setCookie', { ...cookie, url: BASE })
      }

      console.log('')
      console.log(`  ${sesion}${email ? ` (${email})` : ''}`)
      const deEsta = []

      for (const ancho of anchosPedidos) {
        await emular(cdp, ancho)
        for (const tema of temasPedidos) {
          guionDeTema = await fijarTema(cdp, tema, guionDeTema)
          for (const ruta of rutasDeEsta) {
            try {
              const c = await capturar(cdp, { sesion, ruta, ancho, tema })
              deEsta.push(c)
              const criticos = c.hallazgos.filter((h) => h.critico).length
              const desvio = c.rutaFinal && !c.rutaFinal.startsWith(ruta) ? ` → ${c.rutaFinal}` : ''
              console.log(`    ${criticos ? '✗' : '✓'}  ${ruta.padEnd(46)} ${String(ancho).padStart(4)} ${tema.padEnd(6)}${desvio}${criticos ? `  ${criticos} crítico(s)` : ''}`)
            } catch (error) {
              console.log(`    !  ${ruta.padEnd(46)} ${String(ancho).padStart(4)} ${tema.padEnd(6)}  ${error.message}`)
            }
          }
        }
      }

      capturas.push(...deEsta)
      if (deEsta.length > 0) hojas.push(await hojaDeContacto(cdp, sesion, deEsta))
    }
  } finally {
    try {
      if (cdp) await cdp.enviar('Browser.close')
    } catch {
      /* ya cerrado */
    }
    cdp?.cerrar()
    navegador.hijo.kill()
    await esperar(500)
    rmSync(navegador.perfil, { recursive: true, force: true })
  }

  const { criticos, avisos } = escribirInforme(capturas, hojas)

  console.log('')
  for (const h of hojas) console.log(`  Hoja: ${h}   ← léela con Read antes de dar por bueno un cambio de UI`)
  console.log(`  Informe: capturas/informe.md`)
  console.log('')
  console.log(`  ${capturas.length} pantallas, ${criticos.length} hallazgos críticos, ${avisos.length} avisos`)
  console.log('')
  process.exitCode = criticos.length > 0 ? 1 : 0
}

main().catch((error) => {
  console.error('')
  console.error(`  ${error.message}`)
  console.error('')
  process.exitCode = 1
})
