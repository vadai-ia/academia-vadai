#!/usr/bin/env node
/**
 * test-auth.mjs — Criterio de cierre de M2.
 *
 * Prueba el flujo de acceso contra la app corriendo de verdad: pide enlaces a la
 * Admin API (los mismos que Supabase mandaría por correo), los canjea contra
 * /auth/confirmar, guarda las cookies que devuelve el servidor y con esa sesión
 * real recorre el middleware.
 *
 * No manda un solo correo: `generate_link` devuelve el token sin enviarlo.
 *
 * Requiere la app corriendo:
 *   PORT=3117 pnpm start   (en otra terminal)
 *   node scripts/test-auth.mjs
 *
 * Sale con código 1 si cualquier aserción falla.
 */

import { cargarEnv, exigir } from './lib/entorno.mjs'
import { USUARIOS_QA } from './lib/qa.mjs'

const vars = cargarEnv()
const SUPABASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')
const APP = (process.env.APP_URL ?? 'http://localhost:3117').replace(/\/+$/, '')

// --- frasco de cookies -----------------------------------------------------

/** Guarda cookies entre peticiones, como haría un navegador. */
function crearFrasco() {
  const cookies = new Map()

  return {
    guardar(respuesta) {
      const crudas = respuesta.headers.getSetCookie?.() ?? []
      for (const cruda of crudas) {
        const [par] = cruda.split(';')
        const i = par.indexOf('=')
        if (i === -1) continue
        const nombre = par.slice(0, i).trim()
        const valor = par.slice(i + 1).trim()
        if (valor === '' || /Max-Age=0/i.test(cruda)) cookies.delete(nombre)
        else cookies.set(nombre, valor)
      }
    },
    encabezado() {
      return [...cookies.entries()].map(([n, v]) => `${n}=${v}`).join('; ')
    },
    get tamano() {
      return cookies.size
    },
  }
}

async function pedir(ruta, frasco) {
  const respuesta = await fetch(`${APP}${ruta}`, {
    redirect: 'manual',
    headers: frasco?.tamano ? { cookie: frasco.encabezado() } : {},
  })
  frasco?.guardar(respuesta)
  return respuesta
}

/** Ruta a la que redirige una respuesta, o null si no redirige. */
function destino(respuesta) {
  const ubicacion = respuesta.headers.get('location')
  if (!ubicacion) return null
  try {
    return new URL(ubicacion, APP).pathname
  } catch {
    return ubicacion
  }
}

// --- enlaces de Supabase ---------------------------------------------------

/**
 * Genera el enlace que Supabase mandaría por correo, sin mandarlo.
 * `recovery` sirve para simular tanto la invitación como el "olvidé mi
 * contraseña": ambos aterrizan en /auth/confirmar con un token de un solo uso.
 */
async function generarEnlace(email, tipo = 'recovery') {
  const respuesta = await fetch(`${SUPABASE}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: tipo, email }),
  })

  const cuerpo = await respuesta.json()
  if (!respuesta.ok) {
    throw new Error(`generate_link falló para ${email}: ${cuerpo.msg ?? respuesta.status}`)
  }

  // El token viene al nivel raíz. Algunas versiones lo anidan en `properties`,
  // así que se aceptan las dos formas.
  const hash = cuerpo.hashed_token ?? cuerpo.properties?.hashed_token
  if (!hash) throw new Error(`generate_link no devolvió token para ${email}`)
  return hash
}

/** Canjea el token y devuelve un frasco con la sesión ya iniciada. */
async function iniciarSesion(email, tipo = 'recovery') {
  const hash = await generarEnlace(email, tipo)
  const frasco = crearFrasco()
  const respuesta = await pedir(
    `/auth/confirmar?token_hash=${encodeURIComponent(hash)}&type=${tipo}`,
    frasco
  )
  return { frasco, respuesta }
}

// --- reporte ---------------------------------------------------------------

const resultados = []
const afirmar = (grupo, descripcion, esperado, real) =>
  resultados.push({ grupo, descripcion, esperado, real, ok: esperado === real })

function imprimir() {
  const porGrupo = new Map()
  for (const r of resultados) {
    if (!porGrupo.has(r.grupo)) porGrupo.set(r.grupo, [])
    porGrupo.get(r.grupo).push(r)
  }

  const ancho = Math.max(...resultados.map((r) => r.descripcion.length))

  console.log('')
  console.log('  PRUEBA DE ACCESO — M2')
  console.log(`  App: ${APP}`)

  for (const [grupo, casos] of porGrupo) {
    console.log('')
    console.log(`  ${grupo}`)
    console.log('  ' + '─'.repeat(ancho + 30))
    for (const c of casos) {
      console.log(
        `  ${c.ok ? '✓' : '✗'}  ${c.descripcion.padEnd(ancho)}  ` +
          (c.ok ? String(c.real) : `esperado ${c.esperado}, obtuvo ${c.real}`)
      )
    }
  }

  const fallidas = resultados.filter((r) => !r.ok)
  console.log('')
  console.log('  ' + '─'.repeat(ancho + 30))
  console.log(
    fallidas.length === 0
      ? `  M2 EN VERDE — ${resultados.length}/${resultados.length} aserciones pasaron.`
      : `  ${fallidas.length} de ${resultados.length} aserciones FALLARON.`
  )
  for (const f of fallidas) {
    console.log(`    ${f.grupo} · ${f.descripcion}: esperado ${f.esperado}, obtuvo ${f.real}`)
  }
  console.log('')
  return fallidas.length === 0
}

// --- main ------------------------------------------------------------------

const correo = Object.fromEntries(USUARIOS_QA.map((u) => [u.llave, u.email]))

async function main() {
  // Verifica que la app esté arriba antes de afirmar nada.
  try {
    await pedir('/')
  } catch {
    throw new Error(
      `No responde ${APP}. Levanta la app con \`PORT=3117 pnpm start\` o define APP_URL.`
    )
  }

  // ======================================================================
  const G1 = 'SIN SESIÓN'

  // La raíz no es una página, es una puerta: sin sesión lleva al login.
  // Antes había ahí una portada con el avance del proyecto y una sonda de
  // conexión a Supabase, que le contaba a cualquier visitante qué base usamos.
  afirmar(G1, 'la raíz lleva al login', '/login', destino(await pedir('/')))
  afirmar(G1, '/login es público', 200, (await pedir('/login')).status)
  afirmar(G1, '/recuperar es público', 200, (await pedir('/recuperar')).status)
  afirmar(G1, '/mis-cursos redirige a login', '/login', destino(await pedir('/mis-cursos')))
  afirmar(G1, '/admin redirige a login', '/login', destino(await pedir('/admin')))
  afirmar(G1, '/sin-acceso redirige a login', '/login', destino(await pedir('/sin-acceso')))

  // ======================================================================
  // El tema y la marca son la primera impresión de la plataforma, y las dos
  // piezas que los sostienen son invisibles: si alguien quita el script del
  // <head> o el respaldo de `@supports`, nada falla en pantalla hasta que un
  // usuario con el equipo en oscuro, o con un navegador viejo, abre la página.
  const GT = 'MARCA Y TEMA'

  const portada = await (await pedir('/login')).text()

  afirmar(GT, 'el logo real está en la portada', true, portada.includes('vadai-wordmark'))
  afirmar(GT, 'con texto alternativo', true, /alt="VADAI[^"]*"/.test(portada))
  afirmar(GT, 'y el texto de venta', true, portada.includes('Ponla a trabajar'))

  const logo = await fetch(`${APP}/vadai-wordmark.png`)
  afirmar(GT, 'el archivo del logo se sirve', 200, logo.status)
  const bytes = new Uint8Array((await logo.arrayBuffer()).slice(0, 8))
  afirmar(GT, 'y ES un PNG', 'PNG', String.fromCharCode(...bytes.slice(1, 4)))

  // El script tiene que ir ANTES de que se pinte, o se ve el destello.
  const cabeza = portada.slice(0, portada.indexOf('</head>'))
  afirmar(GT, 'el guion de tema va en el <head>', true, cabeza.includes('vadai-tema'))
  afirmar(GT, 'y antes del <body>', true, portada.indexOf('vadai-tema') < portada.indexOf('<body'))

  const hojaRuta = portada.match(/\/_next\/static\/css\/[a-z0-9]+\.css/)?.[0]
  afirmar(GT, 'hay hoja de estilos', true, Boolean(hojaRuta))

  if (hojaRuta) {
    const css = await (await fetch(`${APP}${hojaRuta}`)).text()

    // Sin esto el tema no seguiría al sistema cuando no hay JavaScript.
    afirmar(GT, 'los tokens usan light-dark()', true, css.includes('light-dark('))
    afirmar(GT, 'la raíz sigue al sistema', true, /:root\{[^}]*color-scheme:light dark/.test(css))

    // Sin esto un Safari viejo se queda sin ningún color.
    afirmar(GT, 'hay respaldo para navegadores viejos', true, css.includes('@supports not'))
    afirmar(GT, 'y el respaldo trae el navy', true, css.includes('--background:#0a1a2f'))

    // Los dark: de shadcn tienen que valer también sin clase puesta.
    afirmar(GT, 'el variant dark cubre el sistema', true,
      css.includes(':root:not(.light)'))
  }

  // ======================================================================
  const G2 = 'ALUMNO (qa-alumno1, por enlace de correo)'

  const alumno = await iniciarSesion(correo.alumnoVigente)
  afirmar(G2, 'el enlace lleva a definir contraseña', '/nueva-contrasena', destino(alumno.respuesta))
  afirmar(G2, 'el enlace dejó sesión iniciada', true, alumno.frasco.tamano > 0)
  afirmar(G2, 'entra a /mis-cursos', 200, (await pedir('/mis-cursos', alumno.frasco)).status)
  afirmar(G2, '/admin lo devuelve a lo suyo', '/mis-cursos', destino(await pedir('/admin', alumno.frasco)))
  afirmar(G2, '/login ya no lo detiene', '/mis-cursos', destino(await pedir('/login', alumno.frasco)))
  afirmar(G2, 'la raíz lo lleva a sus cursos', '/mis-cursos', destino(await pedir('/', alumno.frasco)))
  afirmar(
    G2,
    '/sin-acceso no aplica para él',
    '/mis-cursos',
    destino(await pedir('/sin-acceso', alumno.frasco))
  )

  // ======================================================================
  const G3 = 'ALUMNO VENCIDO (qa-alumno2)'

  const vencido = await iniciarSesion(correo.alumnoVencido)
  afirmar(G3, 'sigue pudiendo entrar', 200, (await pedir('/mis-cursos', vencido.frasco)).status)

  // ======================================================================
  const G4 = 'ADMIN (qa-admin)'

  const admin = await iniciarSesion(correo.admin)
  afirmar(G4, 'aterriza en administración', 200, (await pedir('/admin', admin.frasco)).status)
  // La misma raíz manda a cada quien a su lugar, sin pantalla intermedia.
  afirmar(G4, 'la raíz lo lleva al panel', '/admin', destino(await pedir('/', admin.frasco)))
  afirmar(G4, '/login lo manda a /admin', '/admin', destino(await pedir('/login', admin.frasco)))
  afirmar(G4, 'también puede ver /mis-cursos', 200, (await pedir('/mis-cursos', admin.frasco)).status)

  // ======================================================================
  const G5 = 'SUPERADMIN (qa-superadmin)'

  const superadmin = await iniciarSesion(correo.superadmin)
  afirmar(G5, 'aterriza en administración', '/admin', destino(await pedir('/login', superadmin.frasco)))

  // ======================================================================
  // El caso que define la Regla Cero: autenticado de verdad, sin pertenecer.
  const G6 = 'SIN PERFIL (qa-sinperfil)'

  const intruso = await iniciarSesion(correo.sinPerfil)
  afirmar(G6, 'la sesión sí se creó', true, intruso.frasco.tamano > 0)
  afirmar(G6, '/mis-cursos lo rechaza', '/sin-acceso', destino(await pedir('/mis-cursos', intruso.frasco)))
  afirmar(G6, '/admin lo rechaza', '/sin-acceso', destino(await pedir('/admin', intruso.frasco)))
  afirmar(G6, 've la pantalla de sin-acceso', 200, (await pedir('/sin-acceso', intruso.frasco)).status)

  process.exitCode = imprimir() ? 0 : 1
}

main().catch((error) => {
  console.error('')
  console.error(`  ${error.message}`)
  console.error('')
  process.exitCode = 1
})
