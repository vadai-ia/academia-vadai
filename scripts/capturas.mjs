#!/usr/bin/env node
/**
 * capturas.mjs — Cada pantalla, vista de verdad: 390 px (iPhone), 768 px
 * (iPad) y 1280 px, en tema claro y oscuro; 1024 px (iPad horizontal, el corte
 * `lg`) a pedido.
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
 * M23 (20-oct-2026) sumó la tableta y cinco revisiones más: contenido tapado
 * por una barra fija (mirando qué queda debajo de su borde), el CTA del
 * encabezado de una página de venta fuera de la vista, algo fijo que se mete
 * debajo del encabezado, la pestaña activa escondida en una fila que se
 * desplaza, y —cuando la página se desborda— los tres elementos que la
 * empujan. `--sin-js` apaga el JavaScript de la página para comprobar que lo
 * que debe funcionar sin él funciona.
 *
 * Regla de la casa, heredada del skill presentacion-vadai: SE MIRA SIEMPRE.
 * Un cambio de UI no está listo hasta leer capturas/hoja-*.png.
 *
 *   PORT=3117 pnpm start
 *   pnpm capturas                       # alumno + admin + público · 390, 768 y 1280 · claro y oscuro
 *   pnpm capturas -- --prod             # contra el dominio en vivo (solo lee)
 *   pnpm capturas -- --solo=alumno,admin --ancho=390 --tema=oscuro --auditar
 *   pnpm capturas -- --rutas=/mis-cursos,/perfil
 *   pnpm capturas -- --solo=publico --ancho=390 --sin-js
 *   pnpm capturas -- --prod --solo=alumno --como=<correo> --rutas=/vaip   # con una cuenta real, solo lee
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
const SIN_JS = process.argv.includes('--sin-js')
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
      `/curso/${CURSO_QA.slug}/${IDS.leccionTexto}`,
      `/curso/${CURSO_QA.slug}/${IDS.leccionQuiz}`,
      `/curso/${CURSO_QA.slug}/${IDS.leccionTarea}`,
      `/curso/${CURSO_QA.slug}/comunidad`,
      `/curso/${CURSO_QA.slug}/dinamicas`,
      '/dinamicas',
      `/curso/${CURSO_QA.slug}/en-vivo`,
      // M22: Mis cursos y las pestañas de Mi perfil. (No hay un /en-vivo
      // global: las sesiones viven en cada curso y en V-AI-P → Clases.)
      '/cursos',
      '/perfil',
      '/perfil/membresia',
      '/perfil/certificaciones',
      '/perfil/puntos',
      '/vaip',
      '/blog',
      // La dinámica QA solo existe con `node scripts/test-dinamicas.mjs --conservar`:
      // fotografíala con --rutas=/dinamicas/<id>.
      '/no-existe-esta-pagina',
    ],
  },
  // Acceso vencido (M23): la estructura sí, el contenido no.
  vencido: {
    email: correo.alumnoVencido,
    rutas: ['/mis-cursos', `/curso/${CURSO_QA.slug}`, `/curso/${CURSO_QA.slug}/${IDS.leccionVideo}`, '/vaip'],
  },
  admin: {
    email: correo.admin,
    rutas: [
      '/admin',
      '/admin/cursos',
      `/admin/cursos/${IDS.curso}`,
      `/admin/cursos/${IDS.curso}?gen=${IDS.cohorte2}`,
      `/admin/cursos/${IDS.curso}?gen=nueva`,
      '/admin/alumnos',
      '/admin/empresas',
      '/admin/grupos',
      `/admin/modulos/${IDS.modulo1}/acceso`,
      '/admin/encuestas',
      '/admin/dinamicas',
      '/admin/entregas',
      '/admin/publicaciones',
      // M25: el mundo de V-AI-P, una página por destino de la barra.
      '/admin/vaip',
      '/admin/vaip/muro',
      '/admin/vaip/clases',
      '/admin/vaip/miembros',
      '/admin/vaip/herramientas',
      '/admin/vaip/planes',
    ],
  },
  // El community manager (0036): lo que ve sin los botones de admin.
  cm: {
    email: correo.cm,
    rutas: [
      '/admin',
      '/admin/grupos',
      '/admin/vaip/muro',
      '/admin/vaip/clases',
      `/admin/cursos/${IDS.curso}?gen=${IDS.cohorte}&modulo=todos`,
      `/admin/lecciones/${IDS.leccionVideo}`,
      '/admin/alumnos',
    ],
  },
  // V-AI-P (M17): el miembro de test-membresia. Solo existe mientras el
  // escenario está armado: `node scripts/test-membresia.mjs --conservar`.
  vaip: {
    email: 'qa-vaip1@academia.vadai.com.mx',
    rutas: ['/mis-cursos', '/vaip', '/vaip/clases', '/vaip/herramientas', '/vaip/ranking', '/cursos', '/perfil/membresia'],
  },
  // El agente (M21): los datos de `node scripts/test-agente.mjs --conservar`.
  agente: {
    email: correo.admin,
    rutas: ['/admin/agente', '/admin/agente/ajustes', '/admin/vaip/muro?estado=agente', '/curso/qa-agente-casa/comunidad?por=100'],
  },
  agenteCm: {
    email: correo.cm,
    rutas: ['/admin/agente'],
  },
  // M24: publicar y noticias. Los datos de `node scripts/test-noticias.mjs --conservar`.
  noticias: {
    email: correo.cm,
    rutas: ['/admin/vaip/noticias', '/admin/vaip/muro', '/curso/qa-noticias-casa/comunidad'],
  },
  publico: {
    email: null,
    rutas: [
      '/login',
      '/recuperar',
      '/vaip',
      '/nueva-contrasena',
      '/acceso/token-invalido',
      '/certificado/QA-NO-EXISTE',
      '/e/QA0000',
    ],
  },
  // La página de venta de un plan QA (M23): `node scripts/test-venta-vaip.mjs --conservar`.
  venta: {
    email: null,
    rutas: ['/vaip', '/membresias/qa-venta-m23'],
  },
  // M26: grabaciones y herramientas, con los datos de
  // `node scripts/test-vaip-contenido.mjs --conservar` (imprime las rutas de
  // cada grabación y herramienta para pasarlas con --rutas). La app corre con
  // VAIP_ESPACIO_DE_PRUEBA=qa-contenido y el encabezado elige la casa QA.
  contenido: {
    email: correo.cm,
    encabezados: { 'x-vaip-espacio': 'qa-contenido' },
    rutas: ['/admin/vaip/clases', '/admin/vaip/herramientas'],
  },
  contenidoMiembro: {
    email: 'qa-alumno1@academia.vadai.com.mx',
    encabezados: { 'x-vaip-espacio': 'qa-contenido' },
    rutas: ['/vaip', '/vaip/clases', '/vaip/herramientas', '/vaip/herramientas?etiqueta=qa-rh'],
  },
}

const PERFILES = {
  390: {
    metrics: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true, screenOrientation: { type: 'portraitPrimary', angle: 0 } },
    tactil: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  },
  // iPad vertical: táctil y con la UA de iPadOS (que se anuncia como Mac).
  768: {
    metrics: { width: 768, height: 1024, deviceScaleFactor: 2, mobile: true, screenOrientation: { type: 'portraitPrimary', angle: 0 } },
    tactil: true,
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  },
  // iPad horizontal: justo el corte `lg`, donde aparecen las columnas laterales.
  1024: {
    metrics: { width: 1024, height: 768, deviceScaleFactor: 2, mobile: true, screenOrientation: { type: 'landscapePrimary', angle: 90 } },
    tactil: true,
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  },
  1280: {
    metrics: { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false, screenOrientation: { type: 'landscapePrimary', angle: 0 } },
    tactil: false,
    userAgent: '',
  },
}

const sesionesPedidas = (bandera('solo') ?? 'alumno,admin,publico').split(',').filter((s) => SESIONES[s])
const anchosPedidos = (bandera('ancho') ?? '390,768,1280').split(',').map(Number).filter((a) => PERFILES[a])
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
  // Sin JS: lo que debe funcionar sin él (los CTA, los <details>, los formularios).
  await cdp.enviar('Emulation.setScriptExecutionDisabled', { value: SIN_JS })
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
  const describir = (el) =>
    el.tagName.toLowerCase() +
    (el.id ? '#' + el.id : '') +
    (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '') +
    ' "' + (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 30) + '"'

  // El CTA del encabezado (páginas de venta): dónde termina sin hacer scroll.
  window.scrollTo(0, 0)
  const ctaHero = document.querySelector('[data-cta="hero"]')
  const ctaHeroFondo = ctaHero ? Math.round(ctaHero.getBoundingClientRect().bottom) : null

  // Qué empuja la página más allá del ancho: los tres que más se salen, sin
  // contar lo que vive dentro de algo que recorta o se desplaza.
  const culpables = []
  if (desborde) {
    // Recortado = su contenedor que recorta (o desplaza) termina dentro de la
    // pantalla. Un absoluto se escapa de un contenedor sin posición.
    const recorta = (el) => {
      const absoluto = ['absolute', 'fixed'].includes(getComputedStyle(el).position)
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const cs = getComputedStyle(p)
        if (cs.overflowX === 'visible') continue
        if (absoluto && cs.position === 'static') continue
        return p.getBoundingClientRect().right <= de.clientWidth + 1
      }
      return false
    }
    // Lo fijo (la barra de abajo) se estira con la página: es síntoma, no causa.
    const enAlgoFijo = (el) => {
      for (let p = el; p && p !== document.body; p = p.parentElement) {
        if (getComputedStyle(p).position === 'fixed') return true
      }
      return false
    }
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.right <= de.clientWidth + 1) continue
      if (recorta(el) || enAlgoFijo(el)) continue
      culpables.push({ el, sobra: Math.round(r.right - de.clientWidth) })
    }
    culpables.sort((a, b) => b.sobra - a.sobra)
  }

  // Lo fijo arriba: el encabezado y lo que se pega debajo de él.
  const encabezado = [...document.querySelectorAll('header')].find((h) => {
    const p = getComputedStyle(h).position
    return p === 'sticky' || p === 'fixed'
  })
  const altoEncabezado = encabezado ? encabezado.getBoundingClientRect().height : 0
  const seDesplazaDentro = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const oy = getComputedStyle(p).overflowY
      if (oy === 'auto' || oy === 'scroll' || oy === 'hidden') return true
    }
    return false
  }
  const bajoElEncabezado = []
  if (altoEncabezado > 0) {
    for (const el of document.body.querySelectorAll('*')) {
      if (encabezado.contains(el) || el === encabezado) continue
      const cs = getComputedStyle(el)
      if (cs.position !== 'sticky' || cs.top === 'auto' || cs.display === 'none') continue
      if (seDesplazaDentro(el)) continue
      if (parseFloat(cs.top) + 1 < altoEncabezado) bajoElEncabezado.push(describir(el) + ' top ' + cs.top)
    }
  }

  // La pestaña activa, escondida en una fila que se desplaza.
  const activasEscondidas = []
  for (const a of document.querySelectorAll('[aria-current="page"]')) {
    const ra = a.getBoundingClientRect()
    if (ra.width === 0) continue
    for (let p = a.parentElement; p && p !== document.body; p = p.parentElement) {
      if (p.scrollWidth > p.clientWidth + 1 && getComputedStyle(p).overflowX !== 'visible') {
        const rp = p.getBoundingClientRect()
        if (ra.left < rp.left - 1 || ra.right > rp.right + 1) activasEscondidas.push(describir(a))
        break
      }
    }
  }

  // Lo fijo abajo: al final del scroll, ¿hay contenido debajo del borde de la
  // barra? Lo de abajo que no es ancestro de la barra está tapado. Una barra
  // pegajosa ya asentada en su lugar no tapa nada.
  const barras = [...document.querySelectorAll('[data-barra-inferior]')].filter((b) => getComputedStyle(b).display !== 'none')
  const barraVisible = barras.length > 0
  const tapados = []
  if (barraVisible) {
    window.scrollTo(0, de.scrollHeight)
    for (const barra of barras) {
      const b = barra.getBoundingClientRect()
      if (b.height === 0) continue
      for (const fx of [0.1, 0.5, 0.9]) {
        const x = Math.round(b.left + b.width * fx)
        const y = Math.round(b.top + 2)
        for (const el of document.elementsFromPoint(x, y)) {
          if (barra.contains(el) || el.contains(barra)) continue
          if (el === de || el === document.body) continue
          tapados.push(describir(el))
          break
        }
      }
    }
    window.scrollTo(0, 0)
  }

  // 22-oct-2026: lo que se toca y no hace nada. Alejandro: «no funciona el
  // botón de leer… al hacer click en la noticia no abre nada». El enlace que
  // cubría la tarjeta vivía dentro de un título sr-only: medía 1 px. Aquí,
  // cada enlace, botón y summary visible tiene que tener área y recibir el
  // toque en su centro (nada encima). Y se juntan las ligas internas para
  // comprobar desde Node que abren (sin 404 ni rebote al login).
  const rotos = []
  const enlaces = []
  const interactivos = document.querySelectorAll('a[href], button, summary')
  const scrollX0 = window.scrollX
  const scrollY0 = window.scrollY
  const hrefsVisibles = new Set()
  const diminutos = []
  for (const el of interactivos) {
    if (el.closest('[popover]:not(:popover-open)')) continue
    if (el.closest('details:not([open])') && !el.matches('details > summary')) continue
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkVisibilityCSS: true })) continue
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue
    const texto = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 50)
    const href = el.tagName === 'A' ? el.getAttribute('href') : null
    if (href && href.startsWith('/') && !href.startsWith('//')) enlaces.push(href)
    if (/^Saltar al contenido/i.test(texto)) continue
    let r = el.getBoundingClientRect()
    if (r.width < 4 || r.height < 4) {
      diminutos.push({ href, texto, etiqueta: el.tagName.toLowerCase() })
      continue
    }
    if (href) hrefsVisibles.add(href)
    el.scrollIntoView({ block: 'center', inline: 'center' })
    r = el.getBoundingClientRect()
    // Un enlace en línea que se parte en dos renglones tiene un rectángulo por
    // renglón; el del conjunto incluye texto ajeno. Basta con que UN renglón
    // reciba el toque.
    const fragmentos = [...el.getClientRects()].filter((f) => f.width >= 2 && f.height >= 2)
    if (fragmentos.length > 1) {
      const tocaAlguno = fragmentos.some((f) => {
        const p = document.elementFromPoint(
          Math.min(innerWidth - 1, Math.max(0, f.left + f.width / 2)),
          Math.min(innerHeight - 1, Math.max(0, f.top + f.height / 2))
        )
        return p && el.contains(p)
      })
      if (tocaAlguno) continue
    }
    // Se prueban varios puntos de la parte que cae en pantalla: un enlace
    // dentro de un sr-only mide lo que su texto, pero el recorte lo deja sin
    // un solo pixel tocable (el bug de «Leer», 22-oct-2026).
    const x0 = Math.max(0, r.left)
    const x1 = Math.min(innerWidth, r.right)
    const y0 = Math.max(0, r.top)
    const y1 = Math.min(innerHeight, r.bottom)
    if (x1 - x0 < 2 || y1 - y0 < 2) {
      rotos.push({ critico: true, texto: el.tagName.toLowerCase() + ' "' + texto + '" no se puede poner en pantalla' })
      continue
    }
    let toca = false
    let arriba = null
    for (const [fx, fy] of [[0.5, 0.5], [0.12, 0.5], [0.88, 0.5], [0.5, 0.2], [0.5, 0.8]]) {
      const punto = document.elementFromPoint(x0 + (x1 - x0) * fx, y0 + (y1 - y0) * fy)
      if (punto && el.contains(punto)) {
        toca = true
        break
      }
      if (!arriba) arriba = punto
    }
    if (toca || !arriba) continue
    // Un label que envuelve el control, o el control dentro de su label: está bien.
    if (arriba.closest('label') && arriba.closest('label').contains(el)) continue
    rotos.push({ critico: true, texto: el.tagName.toLowerCase() + ' "' + texto + '" no recibe el toque (encima: ' + describir(arriba) + ')' })
  }
  for (const d of diminutos) {
    // Un enlace solo para el lector de pantalla está bien si hay otro visible
    // con la misma liga; si es la única forma de llegar, nadie lo puede tocar.
    if (d.href && hrefsVisibles.has(d.href)) continue
    rotos.push({ critico: true, texto: d.etiqueta + ' "' + d.texto + '" no tiene área para tocarlo (' + (d.href || 'sin liga') + ')' })
  }
  window.scrollTo(scrollX0, scrollY0)

  const criticos = new Set(['button', 'pastilla', 'pestana', 'destino', 'icono-boton', 'cta'])
  const blancos = []
  const selector = 'header a, header button, nav a, nav button, main button, a[data-slot], a[data-cta], main input:not([type=hidden]):not([type=checkbox]):not([type=radio]), main select, main textarea, main summary, [popover] button'
  for (const el of document.querySelectorAll(selector)) {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    const slot = el.dataset.slot || (el.dataset.cta ? 'cta' : '')
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
  return JSON.stringify({
    desborde,
    culpables: culpables.slice(0, 3).map((c) => describir(c.el) + ' +' + c.sobra + 'px'),
    barraVisible,
    tapados: [...new Set(tapados)],
    ctaHeroFondo,
    bajoElEncabezado,
    activasEscondidas,
    blancos,
    recorte,
    manifiestos,
    tema,
    rotos,
    enlaces: [...new Set(enlaces)],
  })
})()`

/** Hasta dónde puede terminar el CTA del encabezado sin hacer scroll (M23). */
const PLIEGUE_DEL_CTA = { 390: 640, 768: 900, 1024: 700, 1280: 720 }

function hallazgosDe(auditoria, ancho) {
  const lista = []
  if (auditoria.desborde) {
    const quien = auditoria.culpables.length ? `; lo empujan: ${auditoria.culpables.join(' · ')}` : ''
    lista.push({ critico: true, texto: `desborde horizontal: la página es más ancha que la pantalla${quien}` })
  }
  for (const t of auditoria.tapados) lista.push({ critico: true, texto: `la barra inferior tapa ${t}` })
  if (auditoria.ctaHeroFondo !== null && auditoria.ctaHeroFondo > PLIEGUE_DEL_CTA[ancho]) {
    lista.push({ critico: true, texto: `el CTA del encabezado termina en ${auditoria.ctaHeroFondo}px (máximo ${PLIEGUE_DEL_CTA[ancho]})` })
  }
  for (const s of auditoria.bajoElEncabezado) lista.push({ critico: true, texto: `algo fijo queda debajo del encabezado: ${s}` })
  for (const a of auditoria.activasEscondidas) lista.push({ critico: true, texto: `la pestaña activa no se ve en su fila: ${a}` })
  if (auditoria.manifiestos > 1) lista.push({ critico: true, texto: `${auditoria.manifiestos} <link rel="manifest">` })
  if (auditoria.tema && !auditoria.tema.ok) {
    lista.push({ critico: true, texto: `theme-color ${auditoria.tema.meta ?? 'ausente'}, se esperaba ${auditoria.tema.esperado}` })
  }
  for (const r of auditoria.rotos ?? []) lista.push(r)
  for (const h of auditoria.recorte) lista.push({ critico: false, texto: `título recortado: "${h}"` })
  // Los blancos solo cuentan en los viewports táctiles: en escritorio hay ratón.
  if (PERFILES[ancho].tactil) {
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
  const base = path.join(carpeta, `${nombreDeRuta(ruta)}-${ancho}-${tema}${SIN_JS ? '-sinjs' : ''}`)

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
  let enlaces = []
  if (AUDITAR) {
    const crudo = await leer(AUDITORIA)
    const auditoria = JSON.parse(crudo)
    hallazgos = hallazgosDe(auditoria, ancho)
    enlaces = auditoria.enlaces ?? []
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
    enlaces,
  }
}

/**
 * ¿Abre cada liga interna que se vio? (22-oct-2026). Con la cookie de la sesión
 * y siguiendo redirecciones: una liga que termina en 404/500, o que rebota al
 * login o a sin-acceso, es una liga rota para quien la ve. Las descargas y las
 * rutas de auth quedan fuera: se prueban en sus suites.
 */
const LIGAS_QUE_NO_SE_ABREN = /^\/(api|auth|acceso)\//
async function revisarLigas(capturasDeLaSesion, cookies, encabezados) {
  const deDonde = new Map()
  for (const c of capturasDeLaSesion) {
    for (const href of c.enlaces ?? []) if (!deDonde.has(href)) deDonde.set(href, c)
  }
  const cabecera = { ...(encabezados ?? {}), Cookie: cookies.map((k) => `${k.name}=${k.value}`).join('; ') }
  const ligas = [...deDonde.keys()].filter((h) => !LIGAS_QUE_NO_SE_ABREN.test(h) && !h.startsWith('/#'))
  let rotas = 0
  for (const href of ligas) {
    const limpia = href.split('#')[0]
    if (!limpia) continue
    try {
      const r = await fetch(`${BASE}${limpia}`, { headers: cabecera, redirect: 'follow' })
      const final = new URL(r.url).pathname
      // Sin sesión (público), que te mande a entrar es lo correcto.
      const rebote = cookies.length > 0 && /^\/(login|sin-acceso)$/.test(final) && !/^\/(login|sin-acceso)/.test(limpia)
      const malo = r.status >= 400 ? `responde ${r.status}` : rebote ? `rebota a ${final}` : null
      if (malo) {
        rotas++
        deDonde.get(href).hallazgos.push({ critico: true, texto: `la liga ${href} ${malo}` })
      }
    } catch (error) {
      rotas++
      deDonde.get(href).hallazgos.push({ critico: true, texto: `la liga ${href} no abre: ${error.message}` })
    }
  }
  return { revisadas: ligas.length, rotas }
}

// --- hoja de contacto -----------------------------------------------------------

async function hojaDeContacto(cdp, sesion, capturas) {
  // Agrupadas por ancho: así se comparan las pantallas de un mismo dispositivo.
  const figuras = [...capturas]
    .sort((a, b) => a.ancho - b.ancho || a.tema.localeCompare(b.tema))
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
  const archivo = path.join(SALIDA, `hoja-${sesion}${SIN_JS ? '-sinjs' : ''}.html`)
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
  const png = path.join(SALIDA, `hoja-${sesion}${SIN_JS ? '-sinjs' : ''}.png`)
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
  console.log(`  Sesiones: ${sesionesPedidas.join(', ')} · anchos: ${anchosPedidos.join(', ')} · temas: ${temasPedidos.join(', ')}${AUDITAR ? ' · con auditoría' : ''}${SIN_JS ? ' · SIN JavaScript' : ''}`)

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
      const { email: emailQa, rutas, encabezados } = SESIONES[sesion]
      // --como=<correo>: entra con otra cuenta (solo lee). Sirve para mirar el
      // portal con contenido real en --prod; las rutas siguen siendo las de la sesión.
      const email = emailQa && bandera('como') ? bandera('como') : emailQa
      // --rutas manda: sirve para fotografiar una pantalla con un id que el seed no conoce.
      const rutasDeEsta = rutasPedidas ?? rutas
      if (rutasDeEsta.length === 0) continue

      await cdp.enviar('Network.clearBrowserCookies')
      // M26: algunas sesiones piden un espacio de pruebas por encabezado.
      await cdp.enviar('Network.setExtraHTTPHeaders', { headers: encabezados ?? {} })
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

      if (AUDITAR && deEsta.length > 0) {
        const { revisadas, rotas } = await revisarLigas(deEsta, email ? await cookiesDe(email) : [], encabezados)
        console.log(`    ligas: ${revisadas} revisadas, ${rotas} rota(s)`)
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
