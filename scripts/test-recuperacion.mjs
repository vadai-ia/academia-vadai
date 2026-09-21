#!/usr/bin/env node
/**
 * test-recuperacion.mjs — Los caminos de auth que ninguna suite tocaba.
 *
 * Tres huecos de cobertura, y los tres importan más de lo que parecen:
 *
 *   1. Recuperar contraseña. Es cómo vuelve a entrar un alumno que se le olvidó,
 *      y a 40 alumnos eso pasa. Si no funciona, la única salida es que Alejandro
 *      lo reponga a mano uno por uno.
 *   2. `/auth/callback`. Es el regreso de Google. Sus caminos de error nunca se
 *      habían ejercido, y son justo los que se ven en producción.
 *   3. Cerrar sesión. Es la mitad de la pantalla de sin-acceso: sin logout, un
 *      usuario ajeno que aterrice ahí no tiene forma de salir.
 *
 * NO manda correo de verdad. `lib/correo/resend.ts` corta los envíos a
 * direcciones QA, porque `academia.vadai.com.mx` no tiene MX y cada intento era
 * un rebote duro contra la reputación compartida de Resend.
 *
 *   PORT=3117 pnpm start
 *   node scripts/test-recuperacion.mjs
 */

import { createHash, randomBytes } from 'node:crypto'

import { cargarEnv, conectarPostgres, exigir } from './lib/entorno.mjs'
import { CLAVE_QA, USUARIOS_QA } from './lib/qa.mjs'

const vars = cargarEnv()
const SUPABASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const ANON = exigir(vars, 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')
const APP = (process.env.APP_URL ?? 'http://localhost:3117').replace(/\/+$/, '')

const correo = Object.fromEntries(USUARIOS_QA.map((u) => [u.llave, u.email]))
const CLAVE_NUEVA = 'VadaiQA-2026!nueva'

// --- sesión ----------------------------------------------------------------

function crearFrasco() {
  const cookies = new Map()
  return {
    guardar(respuesta) {
      for (const cruda of respuesta.headers.getSetCookie?.() ?? []) {
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

const pedir = (ruta, frasco, opciones = {}) =>
  fetch(`${APP}${ruta}`, {
    redirect: 'manual',
    ...opciones,
    headers: {
      ...(frasco?.tamano ? { cookie: frasco.encabezado() } : {}),
      ...(opciones.headers ?? {}),
    },
  })

const texto = async (ruta, frasco) => await (await pedir(ruta, frasco)).text()

/** Genera un token de recuperación con service role, sin mandar correo. */
async function tokenDeRecuperacion(email) {
  const res = await fetch(`${SUPABASE}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'recovery', email }),
  })
  const cuerpo = await res.json()
  return cuerpo.hashed_token ?? cuerpo.properties?.hashed_token ?? null
}

/** ¿Esta contraseña abre la cuenta? Se pregunta a Auth, no a la app. */
async function claveFunciona(email, password) {
  const res = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return res.ok
}

// --- formularios -----------------------------------------------------------

function leerFormulario(html, contiene) {
  for (const bloque of html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)) {
    if (!bloque[1].includes(contiene)) continue
    const campos = {}
    let accion = null
    for (const etiqueta of bloque[1].matchAll(/<input\b[^>]*>/g)) {
      const nombre = etiqueta[0].match(/name="([^"]*)"/)?.[1]
      if (!nombre) continue
      if (nombre.startsWith('$ACTION')) accion = accion ?? nombre
      const valor = etiqueta[0].match(/value="([^"]*)"/)?.[1] ?? ''
      campos[nombre] = valor.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&')
    }
    if (accion) return { campos }
  }
  return null
}

async function enviar(ruta, formulario, frasco, extra = {}) {
  const cuerpo = new FormData()
  for (const [n, v] of Object.entries(formulario.campos)) cuerpo.append(n, v)
  for (const [n, v] of Object.entries(extra)) cuerpo.set(n, v)
  const respuesta = await pedir(ruta, frasco, { method: 'POST', body: cuerpo })
  frasco?.guardar(respuesta)
  return respuesta
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
  console.log('  PRUEBA DE RECUPERACIÓN, CALLBACK Y LOGOUT')
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
      ? `  EN VERDE — ${resultados.length}/${resultados.length} aserciones pasaron.`
      : `  ${fallidas.length} de ${resultados.length} aserciones FALLARON.`
  )
  for (const f of fallidas) {
    console.log(`    ${f.grupo} · ${f.descripcion}: esperado ${f.esperado}, obtuvo ${f.real}`)
  }
  console.log('')
  return fallidas.length === 0
}

// --- main ------------------------------------------------------------------

async function main() {
  const bd = await conectarPostgres(vars)

  try {
    // ================================================================
    const G1 = 'PEDIR RECUPERACIÓN'

    const pagina = await texto('/recuperar', null)
    afirmar(G1, 'la página abre sin sesión', true, pagina.includes('name="correo"'))

    const formulario = leerFormulario(pagina, 'name="correo"')
    afirmar(G1, 'el formulario funciona sin JS', true, Boolean(formulario))

    let avisoExistente = ''
    let avisoInventado = ''

    if (formulario) {
      const conCuenta = await enviar('/recuperar', formulario, null, {
        correo: correo.alumnoVigente,
      })
      avisoExistente = await conCuenta.text()

      const sinCuenta = await enviar('/recuperar', formulario, null, {
        correo: 'no-existe-jamas@academia.vadai.com.mx',
      })
      avisoInventado = await sinCuenta.text()

      const esperado = 'Si ese correo tiene una cuenta'
      afirmar(G1, 'responde con el aviso genérico', true, avisoExistente.includes(esperado))

      // Lo importante: la respuesta NO puede delatar si el correo existe. Si
      // dijera "ese correo no está registrado", cualquiera podría averiguar
      // quién compró el curso probando direcciones.
      afirmar(G1, 'un correo inventado responde IGUAL', true, avisoInventado.includes(esperado))
      afirmar(G1, 'y nunca dice "no existe"', false, /no est[áa] registrad/i.test(avisoInventado))
    }

    // ================================================================
    const G2 = 'EL ENLACE FUNCIONA'

    const token = await tokenDeRecuperacion(correo.alumnoVigente)
    afirmar(G2, 'se generó un token', true, Boolean(token))

    const frasco = crearFrasco()

    if (token) {
      const confirma = await pedir(
        `/auth/confirmar?token_hash=${encodeURIComponent(token)}&type=recovery&proximo=%2Fnueva-contrasena`,
        null
      )
      frasco.guardar(confirma)

      afirmar(G2, 'el enlace abre sesión', true, frasco.tamano > 0)
      afirmar(G2, 'y lleva a poner contraseña nueva', true,
        (confirma.headers.get('location') ?? '').includes('/nueva-contrasena'))

      // Un token es de un solo uso: reusarlo no puede dar otra sesión.
      const segundo = crearFrasco()
      segundo.guardar(
        await pedir(`/auth/confirmar?token_hash=${encodeURIComponent(token)}&type=recovery`, null)
      )
      afirmar(G2, 'el mismo token NO sirve dos veces', 0, segundo.tamano)
    }

    // ================================================================
    const G3 = 'TOKEN INVÁLIDO'

    const basura = crearFrasco()
    const conBasura = await pedir('/auth/confirmar?token_hash=inventado&type=recovery', null)
    basura.guardar(conBasura)
    afirmar(G3, 'no abre sesión', 0, basura.tamano)
    afirmar(G3, 'y manda al login', true,
      (conBasura.headers.get('location') ?? '').includes('/login'))

    const sinToken = crearFrasco()
    sinToken.guardar(await pedir('/auth/confirmar', null))
    afirmar(G3, 'sin token tampoco', 0, sinToken.tamano)

    // ================================================================
    const G4 = 'CAMBIAR LA CONTRASEÑA'

    if (frasco.tamano > 0) {
      const pantalla = await texto('/nueva-contrasena', frasco)
      const formClave = leerFormulario(pantalla, 'name="contrasena"')
      afirmar(G4, 'hay formulario de contraseña', true, Boolean(formClave))

      if (formClave) {
        // No coinciden: la app tiene que rechazarlo, no Postgres.
        const noCoinciden = await enviar('/nueva-contrasena', formClave, frasco, {
          contrasena: CLAVE_NUEVA,
          confirmacion: 'otra-cosa-distinta',
        })
        afirmar(G4, 'rechaza si no coinciden', true,
          /no coinciden/i.test(await noCoinciden.text()))

        await enviar('/nueva-contrasena', formClave, frasco, {
          contrasena: CLAVE_NUEVA,
          confirmacion: CLAVE_NUEVA,
        })

        // La prueba de verdad: la clave nueva abre la cuenta contra Auth.
        afirmar(G4, 'la contraseña NUEVA funciona', true,
          await claveFunciona(correo.alumnoVigente, CLAVE_NUEVA))
        afirmar(G4, 'y la vieja ya no', false,
          await claveFunciona(correo.alumnoVigente, CLAVE_QA))
      }
    }

    // ================================================================
    const G5 = 'CERRAR SESIÓN'

    if (frasco.tamano > 0) {
      afirmar(G5, 'con sesión entra a /mis-cursos', 200,
        (await pedir('/mis-cursos', frasco)).status)

      const panel = await texto('/mis-cursos', frasco)
      // Por su botón, no "el primer formulario con $ACTION": cuando el alumno
      // tiene novedades, la campana pinta antes su "Marcar como vistas" y la
      // prueba salía marcándolas en vez de cerrar sesión (21-sep-2026).
      const formSalir = leerFormulario(panel, 'Cerrar sesi')
      afirmar(G5, 'hay botón de salir sin JS', true, Boolean(formSalir))

      if (formSalir) {
        await enviar('/mis-cursos', formSalir, frasco)
        // Tras salir, la cookie deja de valer: la prueba es que la ruta
        // protegida vuelva a rebotar, no que la cookie desaparezca del frasco.
        const despues = await pedir('/mis-cursos', frasco)
        afirmar(G5, 'después ya no entra', true, [302, 307].includes(despues.status))
        afirmar(G5, 'y lo manda al login', true,
          (despues.headers.get('location') ?? '').includes('/login'))
      }
    }

    // ================================================================
    const G6 = 'REGRESO DE GOOGLE'

    // Sus caminos de error nunca se habían ejercido, y son los que aparecen en
    // producción cuando alguien cancela el consentimiento o el code caduca.
    const sinCodigo = await pedir('/auth/callback', null)
    afirmar(G6, 'sin code manda al login con error', true,
      (sinCodigo.headers.get('location') ?? '').includes('error=google'))

    const conError = await pedir('/auth/callback?error_description=acceso+denegado', null)
    afirmar(G6, 'si Google manda error, igual', true,
      (conError.headers.get('location') ?? '').includes('error=google'))

    const codigoFalso = crearFrasco()
    const conFalso = await pedir('/auth/callback?code=codigo-inventado', null)
    codigoFalso.guardar(conFalso)
    afirmar(G6, 'un code inventado NO abre sesión', 0, codigoFalso.tamano)
    afirmar(G6, 'y también manda al login', true,
      (conFalso.headers.get('location') ?? '').includes('error=google'))

    // Que el login traduzca el `?error=google` a algo que una persona entienda,
    // en español y con una salida. No basta con que rebote: quien llega aquí
    // acaba de fallar al entrar y necesita saber qué hacer.
    const login = await texto('/login?error=google', null)
    afirmar(G6, 'el login explica el error en español', true,
      login.includes('No se pudo completar el acceso con Google'))
    afirmar(G6, 'y le ofrece la alternativa', true,
      /entra con tu correo/i.test(login))

    // ================================================================
    const G7 = 'CORREO A DIRECCIONES QA'

    // El dominio QA no tiene MX: cada envío era un rebote duro contra la
    // reputación compartida de Resend. La capa de envío ahora los corta.
    const { rows } = await bd.query(
      `select count(*)::int n from academia.profiles where email like 'qa-%'`
    )
    afirmar(G7, 'hay cuentas QA en el dominio sin MX', true, rows[0].n > 0)
    afirmar(G7, 'y la guarda las reconoce', true,
      correo.alumnoVigente.startsWith('qa-') &&
        correo.alumnoVigente.endsWith('@academia.vadai.com.mx'))

    // ================================================================
    const G8 = 'ENLACE DE ACCESO DE 30 DÍAS'

    // Es la liga que va en el correo de bienvenida desde el 20-sep-2026. Lo
    // que se prueba es la promesa que la hizo necesaria: un GET no gasta nada
    // (los escáneres de Outlook y Gmail lo hacen antes que la persona), el
    // POST del botón sí abre sesión, y abrirla dos veces funciona dos veces.
    const { rows: [perfilVigente] } = await bd.query(
      `select user_id from academia.profiles where email = $1`, [correo.alumnoVigente]
    )
    const tokenBueno = randomBytes(32).toString('base64url')
    const tokenViejo = randomBytes(32).toString('base64url')
    const hashDe = (t) => createHash('sha256').update(t).digest('hex')

    await bd.query(
      `insert into academia.access_links (user_id, token_hash, expires_at) values
         ($1, $2, now() + interval '30 days'),
         ($1, $3, now() - interval '1 day')`,
      [perfilVigente.user_id, hashDe(tokenBueno), hashDe(tokenViejo)]
    )

    try {
      const frascoGet = crearFrasco()
      const pagina = await pedir(`/acceso/${tokenBueno}`, null)
      frascoGet.guardar(pagina)
      const html = await pagina.text()
      afirmar(G8, 'la página abre sin sesión', 200, pagina.status)
      afirmar(G8, 'saluda por su nombre', true, html.includes('Hola, '))
      afirmar(G8, 'trae el botón como formulario (sin JS)', true, html.includes('name="token"'))
      afirmar(G8, 'el GET NO abre sesión ni gasta nada', 0, frascoGet.tamano)

      const formulario = leerFormulario(html, 'name="token"')
      const frascoPost = crearFrasco()
      const post = await enviar(`/acceso/${tokenBueno}`, formulario, frascoPost)
      const destino = post.headers.get('location') ?? ''
      // La acción canjea el token AHÍ MISMO y deja las cookies en la respuesta
      // del POST (21-sep-2026): antes redirigía a /auth/confirmar, que con
      // JavaScript reventaba con "unexpected response". Se afirma el efecto,
      // no el camino: sesión abierta y aterrizaje en poner contraseña.
      afirmar(G8, 'el POST abre sesión', true, frascoPost.tamano > 0)
      afirmar(G8, 'y manda a poner contraseña, a una PÁGINA', true,
        destino.includes('/nueva-contrasena') && !destino.includes('/auth/confirmar'))
      afirmar(G8, 'por ruta relativa, no a producción', true, destino.startsWith('/'))
      afirmar(G8, 'y la sesión sirve para abrir esa página', 200,
        (await pedir('/nueva-contrasena', frascoPost)).status)

      // Segunda vez: la misma liga vuelve a servir. Esto es lo que NO daba el
      // recovery de Supabase.
      const frascoSegundo = crearFrasco()
      const segundo = await enviar(`/acceso/${tokenBueno}`, formulario, frascoSegundo)
      afirmar(G8, 'la misma liga sirve una segunda vez', true,
        frascoSegundo.tamano > 0 && (segundo.headers.get('location') ?? '').includes('/nueva-contrasena'))

      const { rows: [usos] } = await bd.query(
        `select used_count from academia.access_links where token_hash = $1`, [hashDe(tokenBueno)]
      )
      afirmar(G8, 'y se contaron los dos usos', 2, usos.used_count)

      // Vencida: dice cuánto duran y ofrece pedir otra, sin formulario.
      const vencida = await texto(`/acceso/${tokenViejo}`, null)
      afirmar(G8, 'una liga vencida lo dice', true, vencida.includes('ya venció'))
      afirmar(G8, 'ofrece pedir una nueva', true, vencida.includes('/recuperar'))
      afirmar(G8, 'y no trae botón', false, vencida.includes('name="token"'))

      const formVencida = leerFormulario(html, 'name="token"')
      const postVencida = await enviar(`/acceso/${tokenViejo}`, { campos: { ...formVencida.campos, token: tokenViejo } }, crearFrasco())
      afirmar(G8, 'ni el POST con ella abre sesión', true,
        (postVencida.headers.get('location') ?? '').includes('error=enlace'))

      const inventada = await texto(`/acceso/${'x'.repeat(43)}`, null)
      afirmar(G8, 'una liga inventada se trata como vencida', true, inventada.includes('ya venció'))
    } finally {
      await bd.query(`delete from academia.access_links where token_hash = any($1::text[])`,
        [[hashDe(tokenBueno), hashDe(tokenViejo)]])
    }
  } finally {
    // Se deja la contraseña QA como estaba, o las demás suites no entran.
    //
    // CORREGIDO 20-sep-2026. Esto pedía `/admin/users` sin paginar —50 por
    // página— y buscaba al alumno en esa primera página. Funcionó mientras la
    // academia tuvo menos de 50 cuentas; con los 106 alumnos reales del 18-sep
    // el QA dejó de aparecer, el `find` daba undefined, el `return` se lo
    // tragaba y la contraseña se quedaba en la nueva. M4, que entra por
    // contraseña, encontraba "Invalid login credentials" y su avance daba 0%
    // sin que nada dijera por qué. Misma familia del barrido de
    // `buscarUsuario()` en provisioning. El id sale del perfil, que es exacto.
    await bd
      .query(`select user_id from academia.profiles where email = $1`, [correo.alumnoVigente])
      .then(async ({ rows }) => {
        const usuario = rows[0]
        if (!usuario) throw new Error(`no hay perfil para ${correo.alumnoVigente}`)
        const r = await fetch(`${SUPABASE}/auth/v1/admin/users/${usuario.user_id}`, {
          method: 'PUT',
          headers: {
            apikey: SERVICE,
            Authorization: `Bearer ${SERVICE}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ password: CLAVE_QA }),
        })
        if (!r.ok) throw new Error(`Auth respondió ${r.status}`)
      })
      .catch((e) => {
        // Se DICE: un reset que falla en silencio es lo que dejó a M4 en rojo.
        console.error(`\n  ✗  No se pudo restablecer la contraseña QA: ${e.message}\n`)
        process.exitCode = 1
      })

    await bd.end().catch(() => {})
  }

  process.exitCode = imprimir() ? 0 : 1
}

main().catch((error) => {
  console.error('')
  console.error(`  ${error.message}`)
  console.error('')
  process.exitCode = 1
})
