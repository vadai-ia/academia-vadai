#!/usr/bin/env node
/**
 * test-admin.mjs — Criterio de cierre de M3.
 *
 * Prueba el admin ejecutando sus server actions DE VERDAD.
 *
 * El truco: cuando Next renderiza un `<form action={serverAction}>` incluye un
 * campo oculto `$ACTION_ID_<hash>`. Ese campo es la ruta de mejora progresiva:
 * es lo que permite que el formulario funcione sin JavaScript. Aquí se lee el
 * formulario del HTML y se reenvía tal cual, así que se ejecuta exactamente el
 * mismo código que correría un navegador con JS apagado.
 *
 * Requiere la app corriendo:
 *   PORT=3117 pnpm start
 *   node scripts/test-admin.mjs
 */

import { cargarEnv, exigir } from './lib/entorno.mjs'
import { CLAVE_QA, IDS, USUARIOS_QA } from './lib/qa.mjs'

const vars = cargarEnv()
const SUPABASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const ANON = exigir(vars, 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')
const APP = (process.env.APP_URL ?? 'http://localhost:3117').replace(/\/+$/, '')

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

async function iniciarSesion(email) {
  const enlace = await fetch(`${SUPABASE}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'recovery', email }),
  })
  const cuerpo = await enlace.json()
  const hash = cuerpo.hashed_token ?? cuerpo.properties?.hashed_token
  if (!hash) throw new Error(`No se pudo generar enlace para ${email}`)

  const frasco = crearFrasco()
  const respuesta = await fetch(
    `${APP}/auth/confirmar?token_hash=${encodeURIComponent(hash)}&type=recovery`,
    { redirect: 'manual' }
  )
  frasco.guardar(respuesta)
  return frasco
}

const pedir = (ruta, frasco, opciones = {}) =>
  fetch(`${APP}${ruta}`, {
    redirect: 'manual',
    ...opciones,
    headers: { ...(frasco?.tamano ? { cookie: frasco.encabezado() } : {}), ...(opciones.headers ?? {}) },
  })

const rutaDestino = (respuesta) => {
  const ubicacion = respuesta.headers.get('location')
  return ubicacion ? new URL(ubicacion, APP).pathname : null
}

// --- lectura de formularios del HTML ---------------------------------------

/** Extrae todos los `<form>` con sus inputs ocultos. */
function leerFormularios(html) {
  const formularios = []
  for (const bloque of html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)) {
    const campos = {}
    let accion = null

    for (const input of bloque[1].matchAll(/<input\b[^>]*>/g)) {
      const etiqueta = input[0]
      const nombre = etiqueta.match(/name="([^"]*)"/)?.[1]
      if (!nombre) continue
      if (nombre.startsWith('$ACTION_ID_')) {
        accion = nombre
        campos[nombre] = ''
        continue
      }
      const valor = etiqueta.match(/value="([^"]*)"/)?.[1] ?? ''
      campos[nombre] = valor.replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    }

    // Los botones también viajan; aquí no hacen falta porque las acciones leen
    // solo los ocultos.
    if (accion) formularios.push({ accion, campos, html: bloque[0] })
  }
  return formularios
}

/**
 * El formulario que CONTIENE un texto (el de su botón, o un input), con todos
 * sus inputs, incluidos los `$ACTION_REF_`/`$ACTION_KEY` de `useActionState`.
 * `leerFormularios` solo recoge acciones directas (`$ACTION_ID_`); este sirve
 * para las que van por `useActionState`, que también funcionan sin JavaScript.
 */
function leerConRef(html, contiene) {
  for (const bloque of html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)) {
    if (!bloque[1].includes(contiene)) continue
    const campos = {}
    for (const et of bloque[1].matchAll(/<input\b[^>]*>/g)) {
      const nombre = et[0].match(/name="([^"]*)"/)?.[1]
      if (!nombre) continue
      campos[nombre] = (et[0].match(/value="([^"]*)"/)?.[1] ?? '')
        .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&')
    }
    return { campos, html: bloque[0] }
  }
  return null
}

/**
 * Un formulario completo: inputs, selects y casillas, como los mandaría un
 * navegador sin JavaScript.
 *
 * `leerFormularios` y `leerConRef` solo miran `<input>`, y eso basta para los
 * formularios de campos ocultos. El de editar una lección tiene `<select>` y
 * una casilla, y mandarlo sin ellos falla la validación o —peor— manda una
 * casilla apagada como encendida.
 *
 * Pide TODOS los marcadores porque el id de una lección aparece también en sus
 * botones de mover, que salen antes en el HTML: con un solo marcador esta
 * prueba tomaba el de mover y movía la lección en vez de editarla.
 */
function leerFormularioCompleto(html, ...marcadores) {
  for (const bloque of html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)) {
    if (!marcadores.every((m) => bloque[1].includes(m))) continue
    const campos = {}
    const limpiar = (v) =>
      (v ?? '').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&')

    for (const et of bloque[1].matchAll(/<input\b[^>]*>/g)) {
      const etiqueta = et[0]
      const nombre = etiqueta.match(/name="([^"]*)"/)?.[1]
      if (!nombre) continue
      const tipo = etiqueta.match(/type="([^"]*)"/)?.[1] ?? 'text'
      // Una casilla apagada NO se manda: es lo que distingue "obligatoria" de
      // "no obligatoria" en el formulario de la lección.
      if ((tipo === 'checkbox' || tipo === 'radio') && !/\schecked/.test(etiqueta)) continue
      campos[nombre] = limpiar(etiqueta.match(/value="([^"]*)"/)?.[1])
    }

    for (const sel of bloque[1].matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)) {
      const nombre = sel[1].match(/name="([^"]*)"/)?.[1]
      if (!nombre) continue
      const opciones = [...sel[2].matchAll(/<option\b([^>]*)>/g)]
      const elegida = opciones.find((o) => /\sselected/.test(o[1])) ?? opciones[0]
      campos[nombre] = limpiar(elegida?.[1].match(/value="([^"]*)"/)?.[1])
    }

    return { campos, html: bloque[0] }
  }
  return null
}

/**
 * La etiqueta `<details …>` más cercana ANTES de un marcador: para afirmar que
 * un formulario vive detrás de su botón (M14) y si está abierto o cerrado.
 */
function detailsQueEnvuelve(html, marcador) {
  const i = html.indexOf(marcador)
  if (i === -1) return null
  const inicio = html.lastIndexOf('<details', i)
  if (inicio === -1) return null
  return html.slice(inicio, html.indexOf('>', inicio) + 1)
}

const estadoDe = (etiqueta) =>
  etiqueta === null ? 'no encontrado' : /\sopen(=|\s|>)/.test(etiqueta) ? 'abierto' : 'cerrado'

/** Reenvía un formulario como lo haría un navegador sin JavaScript. */
async function enviarFormulario(ruta, formulario, frasco) {
  const cuerpo = new FormData()
  for (const [nombre, valor] of Object.entries(formulario.campos)) {
    cuerpo.append(nombre, valor)
  }
  const respuesta = await pedir(ruta, frasco, { method: 'POST', body: cuerpo })
  frasco.guardar(respuesta)
  return respuesta
}

// --- lectura directa de la base (para comprobar efectos) -------------------

async function posicionesDeModulos() {
  const token = await tokenDeAdmin()
  const respuesta = await fetch(
    `${SUPABASE}/rest/v1/modules?course_id=eq.${IDS.curso}&select=id,title,position&order=position`,
    { headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Accept-Profile': 'academia' } }
  )
  return await respuesta.json()
}

const cabecerasServicio = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  'Accept-Profile': 'academia',
  'Content-Profile': 'academia',
}

/** El user_id de un correo, con service role (solo lectura de una fila). */
async function idPorCorreo(email) {
  const r = await fetch(
    `${SUPABASE}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=user_id`,
    { headers: cabecerasServicio }
  )
  const filas = await r.json()
  return Array.isArray(filas) && filas[0] ? filas[0].user_id : null
}

async function existePerfil(id) {
  const r = await fetch(`${SUPABASE}/rest/v1/profiles?user_id=eq.${id}&select=user_id`, { headers: cabecerasServicio })
  const filas = await r.json()
  return Array.isArray(filas) && filas.length > 0
}

let tokenCache = null
async function tokenDeAdmin() {
  if (tokenCache) return tokenCache
  const respuesta = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: correo.admin, password: CLAVE_QA }),
  })
  const cuerpo = await respuesta.json()
  tokenCache = cuerpo.access_token
  return tokenCache
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
  console.log('  PRUEBA DEL ADMIN — M3')
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
      ? `  M3 EN VERDE — ${resultados.length}/${resultados.length} aserciones pasaron.`
      : `  ${fallidas.length} de ${resultados.length} aserciones FALLARON.`
  )
  for (const f of fallidas) {
    console.log(`    ${f.grupo} · ${f.descripcion}: esperado ${f.esperado}, obtuvo ${f.real}`)
  }
  console.log('')
  return fallidas.length === 0
}

const correo = Object.fromEntries(USUARIOS_QA.map((u) => [u.llave, u.email]))

// --- main ------------------------------------------------------------------

async function main() {
  const admin = await iniciarSesion(correo.admin)
  const alumno = await iniciarSesion(correo.alumnoVigente)

  // ======================================================================
  const G1 = 'ACCESO AL ADMIN'

  // El panel principal (20-sep-2026): accesos, sesiones con formulario para
  // agendar desde ahí, avance por curso e ingresos. Se afirma que las piezas
  // están, no los números: esos cambian con cada alta.
  const panel = await pedir('/admin', admin)
  const panelHtml = await panel.text()
  afirmar(G1, 'el panel principal abre', 200, panel.status)
  afirmar(G1, 'dice quién ha entrado', true, panelHtml.includes('nunca han entrado'))
  afirmar(G1, 'muestra el avance del curso sembrado', true, panelHtml.includes('Curso de prueba'))
  afirmar(G1, 'permite agendar una sesión desde ahí', true,
    panelHtml.includes('name="cohort_id"') && panelHtml.includes('name="fecha"'))

  afirmar(G1, 'el admin ve el listado', 200, (await pedir('/admin/cursos', admin)).status)
  afirmar(G1, 'el admin ve el formulario de alta', 200, (await pedir('/admin/cursos/nuevo', admin)).status)
  afirmar(
    G1,
    'el alumno no entra al admin',
    '/mis-cursos',
    rutaDestino(await pedir('/admin/cursos', alumno))
  )
  afirmar(
    G1,
    'el alumno no entra a una lección',
    '/mis-cursos',
    rutaDestino(await pedir(`/admin/lecciones/${IDS.leccionVideo}`, alumno))
  )

  // ======================================================================
  const G2 = 'LISTADO Y DETALLE'

  const listado = await (await pedir('/admin/cursos', admin)).text()
  afirmar(G2, 'aparece el curso sembrado', true, listado.includes('Curso de prueba'))
  afirmar(G2, 'aparece el curso ajeno', true, listado.includes('Curso ajeno'))

  const detalle = await (await pedir(`/admin/cursos/${IDS.curso}`, admin)).text()
  afirmar(G2, 'aparecen los dos módulos', true,
    detalle.includes('Fundamentos') && detalle.includes('Implementaci'))
  afirmar(G2, 'aparecen las lecciones', true, detalle.includes('Video de bienvenida'))
  afirmar(G2, 'la lección en borrador se marca', true, detalle.includes('Borrador'))

  const leccion = await (await pedir(`/admin/lecciones/${IDS.leccionVideo}`, admin)).text()
  afirmar(G2, 'la lección abre su editor', true, leccion.includes('GUID de Bunny'))
  afirmar(G2, 'muestra su adjunto', true, leccion.includes('guia-qa.pdf'))

  // La tabla de inscritos (20-sep-2026): resumen, filtros y ficha por persona.
  const cursoConAlumnos = await (await pedir(`/admin/cursos/${IDS.curso}`, admin)).text()
  afirmar(G2, 'el curso trae la tabla de inscritos', true,
    cursoConAlumnos.includes('id="inscritos"') && cursoConAlumnos.includes(correo.alumnoVigente))
  afirmar(G2, 'con avance y puntos por persona', true,
    cursoConAlumnos.includes('>Avance<') && cursoConAlumnos.includes('>Puntos<'))
  afirmar(G2, 'y la ficha de cada uno', true, cursoConAlumnos.includes('id="ficha-'))
  // Las sesiones se editan desde el curso (21-sep-2026).
  afirmar(G2, 'el curso trae el calendario de su cohorte editable', true,
    cursoConAlumnos.includes('id="sesiones"') &&
      cursoConAlumnos.includes(`value="${IDS.sesionFutura}"`) &&
      cursoConAlumnos.includes('name="titulo_base"'))
  const filtrado = await (await pedir(`/admin/cursos/${IDS.curso}?acceso=vencido`, admin)).text()
  afirmar(G2, 'el filtro por acceso deja solo al vencido', true,
    filtrado.includes(correo.alumnoVencido) && !filtrado.includes(`value="${correo.alumnoVigente}"`))

  // Empresas (20-sep-2026): se crean aquí y se eligen en el alta.
  const empresasRes = await pedir('/admin/empresas', admin)
  afirmar(G2, 'la página de empresas abre', 200, empresasRes.status)
  const empresasHtml = await empresasRes.text()
  // El de CREAR, por su botón. `leerFormularios` solo recoge formularios con
  // `$ACTION_ID_` (acción directa) y el de crear va por `useActionState`
  // (`$ACTION_REF_`); tomar "el primero con nombre" daba el de RENOMBRAR de la
  // primera empresa real, que quedó renombrada y luego borrada por la limpieza.
  const formEmpresa = leerConRef(empresasHtml, 'Crear empresa')
  afirmar(G2, 'trae el formulario para crear una', true, Boolean(formEmpresa))
  if (formEmpresa) {
    formEmpresa.campos.nombre = 'QA Empresa de prueba'
    await enviarFormulario('/admin/empresas', formEmpresa, admin)
    const trasCrear = await (await pedir('/admin/empresas', admin)).text()
    afirmar(G2, 'y la empresa creada aparece', true, trasCrear.includes('QA Empresa de prueba'))
    // Limpieza por marca EXACTA, con el token del admin (policy de borrado).
    await fetch(`${SUPABASE}/rest/v1/companies?name=eq.${encodeURIComponent('QA Empresa de prueba')}`, {
      method: 'DELETE',
      headers: { apikey: ANON, Authorization: `Bearer ${await tokenDeAdmin()}`, 'Content-Profile': 'academia' },
    })
  }

  // Agregar al calendario (20-sep-2026): el .ics de una sesión se descarga.
  const ics = await pedir(`/api/calendario/${IDS.sesionFutura}`, admin)
  const icsTexto = await ics.text()
  afirmar(G2, 'el .ics de la sesión se descarga', 200, ics.status)
  afirmar(G2, 'y es un evento de calendario con la sesión', true,
    (ics.headers.get('content-type') ?? '').includes('text/calendar') &&
      icsTexto.includes('BEGIN:VEVENT') && icsTexto.includes('SUMMARY:'))
  afirmar(G2, 'una sesión inventada da 404', 404,
    (await pedir('/api/calendario/00000000-0000-4000-8000-00000000dead', admin)).status)

  // Sesiones editables (20-sep-2026): el formulario trae lo que ya tiene.
  const cohortePagina = await (await pedir(`/admin/cohortes/${IDS.cohorte}`, admin)).text()
  const formSesion = leerFormularios(cohortePagina).find(
    (f) => f.campos.id === IDS.sesionFutura && 'title' in f.campos && 'fecha' in f.campos
  )
  afirmar(G2, 'cada sesión trae su formulario de edición', true, Boolean(formSesion))
  afirmar(G2, 'prellenado con su fecha y su hora', true,
    /^\d{4}-\d{2}-\d{2}$/.test(formSesion?.campos.fecha ?? '') && /^\d{2}:\d{2}$/.test(formSesion?.campos.hora ?? ''))
  if (formSesion) {
    const original = formSesion.campos.title
    formSesion.campos.title = 'QA Sesión editada'
    await enviarFormulario(`/admin/cohortes/${IDS.cohorte}`, formSesion, admin)
    const trasEditar = await (await pedir(`/admin/cohortes/${IDS.cohorte}`, admin)).text()
    afirmar(G2, 'y editarla guarda el cambio', true, trasEditar.includes('QA Sesión editada'))
    formSesion.campos.title = original
    await enviarFormulario(`/admin/cohortes/${IDS.cohorte}`, formSesion, admin)
  }

  // Quién ya entró (20-sep-2026). El admin acaba de entrar con su liga, así que
  // su perfil ya tiene `last_sign_in_at` (M14: lo sella /auth/confirmar): sale
  // en "ya entraron" y no en "nunca". Es una propiedad de la sesión que esta
  // misma suite abrió, no un número.
  const alumnos = await (await pedir('/admin/alumnos', admin)).text()
  afirmar(G2, 'el listado de alumnos cuenta quién ya entró', true,
    alumnos.includes('ya entraron') && alumnos.includes('nunca han entrado'))
  // Se busca la FILA por su enlace a la ficha, no el correo suelto: el
  // encabezado también imprime el correo de quien está dentro. Y se acota con
  // `q`: la lista va de 25 en 25 y las cuentas QA son las más viejas.
  const idAdmin = await idPorCorreo(correo.admin)
  const filaAdmin = `href="/admin/alumnos/${idAdmin}"`
  const busca = encodeURIComponent(correo.admin)
  const nunca = await (await pedir(`/admin/alumnos?acceso=nunca&q=${busca}`, admin)).text()
  afirmar(G2, 'el filtro "nunca han entrado" no trae al admin', false, nunca.includes(filaAdmin))
  const entraron = await (await pedir(`/admin/alumnos?acceso=entraron&q=${busca}`, admin)).text()
  afirmar(G2, 'el filtro "ya entraron" sí lo trae', true, entraron.includes(filaAdmin))
  // Todos los de esa vista entraron: la insignia roja no puede aparecer ahí.
  const entraronTodos = await (await pedir('/admin/alumnos?acceso=entraron', admin)).text()
  afirmar(G2, 'y en esa vista nadie lleva "Nunca ha entrado"', false,
    entraronTodos.includes('Nunca ha entrado'))

  // ======================================================================
  // M14 · Fase 1: búsqueda en Postgres, paginación y ficha por persona.
  const G4 = 'ALUMNOS: BÚSQUEDA, PAGINACIÓN Y FICHA'

  const idVigente = await idPorCorreo(correo.alumnoVigente)
  const idVencido = await idPorCorreo(correo.alumnoVencido)
  const fichaDe = (id) => `href="/admin/alumnos/${id}"`

  const lista = await pedir('/admin/alumnos', admin)
  const listaHtml = await lista.text()
  afirmar(G4, 'la lista abre', 200, lista.status)
  afirmar(G4, 'el buscador dice por qué busca', true,
    listaHtml.includes('placeholder="Buscar por nombre, correo o empresa"'))
  afirmar(G4, 'la lista dice cuántos muestra', true, listaHtml.includes('Mostrando'))
  // Cada fila enlaza a su ficha (dos veces: nombre y "Ver ficha"); se cuentan personas.
  const personasEnPagina = new Set(
    [...listaHtml.matchAll(/href="\/admin\/alumnos\/([0-9a-f-]{36})"/g)].map((m) => m[1])
  )
  afirmar(G4, 'una página trae 25 personas o menos', true,
    personasEnPagina.size > 0 && personasEnPagina.size <= 25)
  const fuera = await pedir('/admin/alumnos?pagina=999', admin)
  afirmar(G4, 'una página fuera de rango cae en la última', true,
    fuera.status === 200 && (await fuera.text()).includes('Mostrando'))

  const porCorreo = await (await pedir(`/admin/alumnos?q=${encodeURIComponent(correo.alumnoVigente)}`, admin)).text()
  afirmar(G4, 'buscar por correo encuentra al vigente', true, porCorreo.includes(fichaDe(idVigente)))
  afirmar(G4, 'y no trae al vencido', false, porCorreo.includes(fichaDe(idVencido)))
  const porNombre = await (await pedir('/admin/alumnos?q=Alumno%20Vencido', admin)).text()
  afirmar(G4, 'buscar por nombre encuentra al vencido', true,
    porNombre.includes(fichaDe(idVencido)) && !porNombre.includes(fichaDe(idVigente)))

  // Por empresa: se crea una de prueba, se le asigna al vencido y se busca por
  // ella. Todo por marca exacta, y se deja como estaba.
  const formEmpresaBusqueda = leerConRef(await (await pedir('/admin/empresas', admin)).text(), 'Crear empresa')
  if (formEmpresaBusqueda) {
    formEmpresaBusqueda.campos.nombre = 'QA Empresa de prueba'
    await enviarFormulario('/admin/empresas', formEmpresaBusqueda, admin)
    const empresaQA = await (
      await fetch(`${SUPABASE}/rest/v1/companies?name=eq.${encodeURIComponent('QA Empresa de prueba')}&select=id`, {
        headers: cabecerasServicio,
      })
    ).json()
    const idEmpresa = empresaQA[0]?.id
    afirmar(G4, 'la empresa de prueba existe', true, Boolean(idEmpresa))
    if (idEmpresa) {
      const asignar = (companyId) =>
        fetch(`${SUPABASE}/rest/v1/profiles?user_id=eq.${idVencido}`, {
          method: 'PATCH',
          headers: { ...cabecerasServicio, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ company_id: companyId }),
        })
      await asignar(idEmpresa)
      const porEmpresa = await (await pedir('/admin/alumnos?q=Empresa%20de%20prueba', admin)).text()
      afirmar(G4, 'buscar por empresa encuentra a su gente', true,
        porEmpresa.includes(fichaDe(idVencido)) && !porEmpresa.includes(fichaDe(idVigente)))
      const filtroEmpresa = await (await pedir(`/admin/alumnos?empresa=${idEmpresa}`, admin)).text()
      afirmar(G4, 'y el filtro por empresa también', true, filtroEmpresa.includes(fichaDe(idVencido)))
      await asignar(null)
    }
    await fetch(`${SUPABASE}/rest/v1/companies?name=eq.${encodeURIComponent('QA Empresa de prueba')}`, {
      method: 'DELETE',
      headers: cabecerasServicio,
    })
  }

  const ficha = await pedir(`/admin/alumnos/${idVigente}`, admin)
  const fichaHtml = await ficha.text()
  afirmar(G4, 'la ficha de una persona abre', 200, ficha.status)
  afirmar(G4, 'con sus cursos y avance', true,
    fichaHtml.includes('Cursos y avance') && fichaHtml.includes('Curso de prueba'))
  afirmar(G4, 'con acceso y cuenta', true,
    fichaHtml.includes('Reenviar correo de acceso') && fichaHtml.includes('Suspender cuenta'))
  afirmar(G4, 'y con eliminar, confirmando el correo', true,
    fichaHtml.includes('Eliminar cuenta') && fichaHtml.includes('name="confirmacion"'))
  afirmar(G4, 'una persona inventada da 404', 404,
    (await pedir('/admin/alumnos/00000000-0000-4000-8000-00000000dead', admin)).status)

  // ======================================================================
  // M14 · Fase 1: cada formulario vive detrás de su botón y se abre solo
  // cuando la acción contestó algo — también sin JavaScript.
  const G5 = 'FORMULARIOS DETRÁS DE SU BOTÓN (sin JavaScript)'

  afirmar(G5, '"Agendar sesión" está cerrado', 'cerrado', estadoDe(detailsQueEnvuelve(cohortePagina, 'name="title"')))
  afirmar(G5, '"Agendar varias" está cerrado', 'cerrado', estadoDe(detailsQueEnvuelve(cohortePagina, 'name="titulo_base"')))
  afirmar(G5, 'la sesión futura está cerrada, con su botón Editar', true,
    estadoDe(detailsQueEnvuelve(cohortePagina, `id="sesion-${IDS.sesionFutura}"`)) === 'cerrado' &&
      cohortePagina.includes('>Editar<'))
  const conSesion = await (await pedir(`/admin/cohortes/${IDS.cohorte}?sesion=${IDS.sesionFutura}`, admin)).text()
  afirmar(G5, 'y ?sesion= la abre para editar', 'abierto',
    estadoDe(detailsQueEnvuelve(conSesion, `id="sesion-${IDS.sesionFutura}"`)))
  afirmar(G5, '"Editar datos del curso" está cerrado', 'cerrado', estadoDe(detailsQueEnvuelve(detalle, 'name="slug"')))
  afirmar(G5, '"Nuevo módulo" está cerrado', 'cerrado',
    estadoDe(detailsQueEnvuelve(detalle, 'placeholder="Nombre del módulo"')))
  afirmar(G5, '"Agendar sesión" del panel está cerrado', 'cerrado',
    estadoDe(detailsQueEnvuelve(panelHtml, 'name="cohort_id"')))

  const formAgendar = leerConRef(cohortePagina, 'Agendar sesión')
  afirmar(G5, 'el formulario de agendar viaja sin JavaScript', true, Boolean(formAgendar))
  if (formAgendar) {
    formAgendar.campos.title = ''
    formAgendar.campos.fecha = '2026-09-21'
    formAgendar.campos.hora = '18:00'
    const respuesta = await enviarFormulario(`/admin/cohortes/${IDS.cohorte}`, formAgendar, admin)
    const html = await respuesta.text()
    afirmar(G5, 'un envío inválido contesta el error', true, html.includes('La sesión necesita un título.'))
    afirmar(G5, 'y el panel se abre solo para enseñarlo', 'abierto',
      estadoDe(detailsQueEnvuelve(html, 'La sesión necesita un título.')))
  }

  afirmar(G5, 'eliminar cohorte pide confirmación', true,
    cohortePagina.includes(`id="eliminar-cohorte-${IDS.cohorte}"`) && cohortePagina.includes('popover="auto"'))
  afirmar(G5, 'eliminar sesión pide confirmación', true,
    cohortePagina.includes(`id="eliminar-sesion-${IDS.sesionFutura}"`))
  afirmar(G5, 'eliminar módulo pide confirmación', true, detalle.includes('id="eliminar-modulo-'))
  afirmar(G5, 'eliminar lección pide confirmación', true,
    leccion.includes(`id="eliminar-leccion-${IDS.leccionVideo}"`))

  // ======================================================================
  // M14 · Fase 1: eliminar una cuenta de verdad. Con una cuenta de prueba
  // propia, por marca exacta, que se limpia al inicio y al final.
  const G6 = 'ELIMINAR CUENTA (borrado real)'

  const superadmin = await iniciarSesion(correo.superadmin)
  const CORREO_BORRAR = 'qa-borrar@academia.vadai.com.mx'
  const borrarRastro = async () => {
    await fetch(`${SUPABASE}/rest/v1/payments?stripe_session_id=eq.cs_qa_borrar`, {
      method: 'DELETE',
      headers: cabecerasServicio,
    })
    const id = await idPorCorreo(CORREO_BORRAR)
    if (id) {
      await fetch(`${SUPABASE}/auth/v1/admin/users/${id}`, {
        method: 'DELETE',
        headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
      })
    }
  }
  await borrarRastro()

  // El alta individual, por su botón. Sin correo: el dominio QA se corta en
  // lib/correo/resend.ts.
  const altaForm = leerConRef(await (await pedir('/admin/alumnos', superadmin)).text(), 'Dar de alta')
  afirmar(G6, 'el alta individual viaja sin JavaScript', true, Boolean(altaForm))
  let idBorrar = null
  if (altaForm) {
    altaForm.campos.email = CORREO_BORRAR
    altaForm.campos.nombre = 'QA Borrar'
    altaForm.campos.accesos = `${IDS.curso}|`
    altaForm.campos.company_nueva = ''
    await enviarFormulario('/admin/alumnos', altaForm, superadmin)
    idBorrar = await idPorCorreo(CORREO_BORRAR)
    afirmar(G6, 'la cuenta de prueba existe', true, Boolean(idBorrar))
  }

  if (idBorrar) {
    await fetch(`${SUPABASE}/rest/v1/payments`, {
      method: 'POST',
      headers: { ...cabecerasServicio, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        user_id: idBorrar,
        email: CORREO_BORRAR,
        course_id: IDS.curso,
        stripe_session_id: 'cs_qa_borrar',
        amount: 100,
        currency: 'mxn',
        status: 'paid',
      }),
    })

    const fichaBorrar = await (await pedir(`/admin/alumnos/${idBorrar}`, superadmin)).text()
    const formEliminar = leerConRef(fichaBorrar, 'name="confirmacion"')
    afirmar(G6, 'la ficha trae el formulario de eliminar', true, Boolean(formEliminar))

    if (formEliminar) {
      formEliminar.campos.confirmacion = 'otro@correo.com'
      const mal = await (await enviarFormulario(`/admin/alumnos/${idBorrar}`, formEliminar, superadmin)).text()
      afirmar(G6, 'con el correo equivocado no borra y lo dice', true,
        mal.includes('El correo no coincide') && (await existePerfil(idBorrar)))

      // Guarda de equipo: un admin no borra a un superadmin, ni ve el botón.
      const idSuperadmin = await idPorCorreo(correo.superadmin)
      const fichaSuperComoAdmin = await (await pedir(`/admin/alumnos/${idSuperadmin}`, admin)).text()
      afirmar(G6, 'un admin no ve "Eliminar cuenta" en la ficha de un superadmin', false,
        fichaSuperComoAdmin.includes('name="confirmacion"'))
      const intento = { ...formEliminar, campos: { ...formEliminar.campos, user_id: idSuperadmin, confirmacion: correo.superadmin } }
      await enviarFormulario(`/admin/alumnos/${idSuperadmin}`, intento, admin)
      afirmar(G6, 'y aunque mande el formulario, el superadmin sigue', true, await existePerfil(idSuperadmin))

      // Nadie se borra a sí mismo.
      await enviarFormulario(`/admin/alumnos/${idSuperadmin}`, intento, superadmin)
      afirmar(G6, 'nadie se borra a sí mismo', true, await existePerfil(idSuperadmin))

      // El borrado real. En MAYÚSCULAS: el servidor compara en minúsculas.
      formEliminar.campos.confirmacion = CORREO_BORRAR.toUpperCase()
      const borrado = await enviarFormulario(`/admin/alumnos/${idBorrar}`, formEliminar, superadmin)
      afirmar(G6, 'con el correo correcto borra y vuelve a la lista', '/admin/alumnos', rutaDestino(borrado))
      afirmar(G6, 'el perfil desapareció', false, await existePerfil(idBorrar))
      const enAuth = await fetch(`${SUPABASE}/auth/v1/admin/users/${idBorrar}`, {
        headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
      })
      afirmar(G6, 'y la cuenta de Auth también', 404, enAuth.status)
      const pagosTras = await (
        await fetch(`${SUPABASE}/rest/v1/payments?stripe_session_id=eq.cs_qa_borrar&select=user_id,account_deleted_at`, {
          headers: cabecerasServicio,
        })
      ).json()
      afirmar(G6, 'el pago se queda, sin cuenta y marcado', true,
        pagosTras.length === 1 && pagosTras[0].user_id === null && Boolean(pagosTras[0].account_deleted_at))
      const listaTras = await (await pedir('/admin/alumnos', superadmin)).text()
      afirmar(G6, 'y no aparece como "pago sin cuenta"', false, listaTras.includes(CORREO_BORRAR))
    }
  }
  await borrarRastro()

  // ======================================================================
  // M14: renombrar un módulo y editar una lección DESDE EL ÁRBOL, sin abrirla.
  const G7 = 'EDITAR MÓDULOS Y LECCIONES DESDE EL ÁRBOL'

  const leerLeccion = async (id) => {
    const r = await fetch(
      `${SUPABASE}/rest/v1/lessons?id=eq.${id}&select=title,lesson_type,status,is_required,bunny_video_id,description_rich`,
      { headers: cabecerasServicio }
    )
    return (await r.json())[0]
  }
  const leerModulo = async (id) => {
    const r = await fetch(`${SUPABASE}/rest/v1/modules?id=eq.${id}&select=title,position`, {
      headers: cabecerasServicio,
    })
    return (await r.json())[0]
  }

  // --- el módulo ---
  const moduloAntes = await leerModulo(IDS.modulo1)
  const formModulo = leerFormularioCompleto(detalle, `value="${IDS.modulo1}"`, 'Título del módulo')
  afirmar(G7, 'el árbol trae el formulario de renombrar módulo', true, Boolean(formModulo))

  if (formModulo) {
    await enviarFormulario(`/admin/cursos/${IDS.curso}`, { ...formModulo, campos: { ...formModulo.campos, title: 'QA · Módulo renombrado' } }, admin)
    const renombrado = await leerModulo(IDS.modulo1)
    afirmar(G7, 'renombrar un módulo lo guarda', 'QA · Módulo renombrado', renombrado?.title)
    afirmar(G7, 'y no lo mueve de lugar', moduloAntes?.position, renombrado?.position)
    await enviarFormulario(`/admin/cursos/${IDS.curso}`, { ...formModulo, campos: { ...formModulo.campos, title: moduloAntes.title } }, admin)
    afirmar(G7, 'y se puede devolver a su nombre', moduloAntes?.title, (await leerModulo(IDS.modulo1))?.title)
  }

  // --- la lección ---
  const leccionAntes = await leerLeccion(IDS.leccionVideo)
  const arbol = await (await pedir(`/admin/cursos/${IDS.curso}`, admin)).text()
  const formLeccion = leerFormularioCompleto(arbol, `value="${IDS.leccionVideo}"`, 'name="lesson_type"')
  afirmar(G7, 'cada lección trae su formulario de edición', true, Boolean(formLeccion))
  afirmar(G7, 'con título, tipo y estado', true,
    Boolean(formLeccion) &&
      formLeccion.campos.title === leccionAntes.title &&
      formLeccion.campos.lesson_type === leccionAntes.lesson_type &&
      formLeccion.campos.status === leccionAntes.status)

  if (formLeccion) {
    await enviarFormulario(
      `/admin/cursos/${IDS.curso}`,
      { ...formLeccion, campos: { ...formLeccion.campos, title: 'QA · Lección renombrada', status: 'draft' } },
      admin
    )
    const editada = await leerLeccion(IDS.leccionVideo)
    afirmar(G7, 'editarla guarda el título', 'QA · Lección renombrada', editada?.title)
    afirmar(G7, 'y el estado', 'draft', editada?.status)
    // Lo que este formulario NO manda no se puede perder: el video y el texto
    // rico viven en el editor completo, y escribirlos vacíos los borraría.
    afirmar(G7, 'sin borrar el video ligado', leccionAntes.bunny_video_id, editada?.bunny_video_id)
    afirmar(G7, 'ni el texto de la lección', true, editada?.description_rich !== null)
    // La casilla apagada es la que prueba que no se manda a la ligera.
    afirmar(G7, 'y la casilla decide si es obligatoria', false,
      (await (async () => {
        const sinCasilla = { ...formLeccion.campos }
        delete sinCasilla.is_required
        await enviarFormulario(`/admin/cursos/${IDS.curso}`, { ...formLeccion, campos: sinCasilla }, admin)
        return (await leerLeccion(IDS.leccionVideo))?.is_required
      })()))

    // Se deja como estaba, para que el script sea re-corrible.
    await enviarFormulario(
      `/admin/cursos/${IDS.curso}`,
      {
        ...formLeccion,
        campos: {
          ...formLeccion.campos,
          title: leccionAntes.title,
          status: leccionAntes.status,
          is_required: leccionAntes.is_required ? 'true' : '',
        },
      },
      admin
    )
    const restaurada = await leerLeccion(IDS.leccionVideo)
    afirmar(G7, 'y se restaura completa', true,
      restaurada?.title === leccionAntes.title &&
        restaurada?.status === leccionAntes.status &&
        restaurada?.is_required === leccionAntes.is_required)
  }

  afirmar(G7, 'cada lección se puede eliminar desde el árbol', true,
    arbol.includes(`id="eliminar-leccion-${IDS.leccionVideo}"`))

  // ======================================================================
  // Lo más delicado que escribí en M3: el intercambio de posiciones.
  const G3 = 'REORDENAR (server action real, sin JavaScript)'

  const antes = await posicionesDeModulos()
  const primeroAntes = antes[0]?.title ?? ''

  const formularios = leerFormularios(detalle)
  const bajar = formularios.find(
    (f) => f.campos.id === antes[0]?.id && f.campos.direccion === 'abajo'
  )

  afirmar(G3, 'se encontró el formulario de mover', true, Boolean(bajar))

  if (bajar) {
    const respuesta = await enviarFormulario(`/admin/cursos/${IDS.curso}`, bajar, admin)
    afirmar(G3, 'la acción responde sin error', true, respuesta.status < 400)

    const despues = await posicionesDeModulos()
    afirmar(G3, 'el primer módulo bajó', true, despues[0]?.title !== primeroAntes)
    afirmar(G3, 'no se perdió ningún módulo', antes.length, despues.length)
    afirmar(
      G3,
      'las posiciones siguen siendo únicas',
      despues.length,
      new Set(despues.map((m) => m.position)).size
    )

    // Se deja como estaba, para que el script sea re-corrible.
    const detalle2 = await (await pedir(`/admin/cursos/${IDS.curso}`, admin)).text()
    const subir = leerFormularios(detalle2).find(
      (f) => f.campos.id === antes[0]?.id && f.campos.direccion === 'arriba'
    )
    if (subir) await enviarFormulario(`/admin/cursos/${IDS.curso}`, subir, admin)

    const restaurado = await posicionesDeModulos()
    afirmar(G3, 'el orden se restauró', primeroAntes, restaurado[0]?.title ?? '')
  }

  process.exitCode = imprimir() ? 0 : 1
}

main().catch((error) => {
  console.error('')
  console.error(`  ${error.message}`)
  console.error('')
  process.exitCode = 1
})
