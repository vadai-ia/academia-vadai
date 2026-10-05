#!/usr/bin/env node
/**
 * test-cm.mjs — El rol de community manager (0036) y «atendida sin responder»
 * (0037), 3-oct-2026.
 *
 * Lo que decidió Alejandro, probado literal:
 *   - Casi admin: entra al panel, a la comunidad, a alumnos, encuestas,
 *     dinámicas, empresas y puntos; NO crea cursos, NO da de alta, NO elimina
 *     cuentas, NO ve pagos.
 *   - Contenido: solo sesiones y grabaciones. Ve el temario, no lo edita.
 *   - Alumnos: todo menos alta y eliminar.
 *   - Contesta como «Equipo VADAI».
 *   - Solo un superadmin da o quita el rol.
 *
 * Se prueba en dos capas: lo que la app le enseña (HTML con su cookie) y lo
 * que la base le deja hacer (PostgREST con su JWT). La segunda es la que
 * protege: un botón escondido no es una guarda.
 *
 *   PORT=3117 pnpm start
 *   node scripts/test-cm.mjs
 */

import { cargarEnv, conectarPostgres, exigir } from './lib/entorno.mjs'
import { CLAVE_QA, IDS, USUARIOS_QA } from './lib/qa.mjs'

const vars = cargarEnv()
const SUPABASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')
const ANON = exigir(vars, 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
const APP = (process.env.APP_URL ?? 'http://localhost:3117').replace(/\/+$/, '')

const correo = Object.fromEntries(USUARIOS_QA.map((u) => [u.llave, u.email]))

const MARCA_POST = 'QA cm pregunta en el muro'
const MARCA_RESPUESTA = 'QA cm respuesta del community manager'
const MARCA_PREGUNTA = 'QA cm pregunta en la leccion'
const MARCA_INSISTE = 'QA cm el alumno vuelve a escribir'

// --- sesión en la app (cookie) ----------------------------------------------

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

async function entrarALaApp(email) {
  const enlace = await fetch(`${SUPABASE}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'recovery', email }),
  })
  const cuerpo = await enlace.json()
  const hash = cuerpo.hashed_token ?? cuerpo.properties?.hashed_token
  if (!hash) throw new Error(`No se pudo generar enlace para ${email}. ¿Corriste \`pnpm db:seed\`?`)
  const frasco = crearFrasco()
  frasco.guardar(
    await fetch(`${APP}/auth/confirmar?token_hash=${encodeURIComponent(hash)}&type=recovery`, { redirect: 'manual' })
  )
  return frasco
}

const pedir = (ruta, frasco, opciones = {}) =>
  fetch(`${APP}${ruta}`, {
    redirect: 'manual',
    ...opciones,
    headers: { ...(frasco?.tamano ? { cookie: frasco.encabezado() } : {}), ...(opciones.headers ?? {}) },
  })
const texto = async (ruta, frasco) => await (await pedir(ruta, frasco)).text()
const destino = (res) => {
  const l = res.headers.get('location')
  return l ? new URL(l, APP).pathname : null
}

/** El <form> que trae TODO lo que se pide. */
function formularioCon(html, ...piezas) {
  for (const bloque of html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)) {
    if (!piezas.every((p) => bloque[1].includes(p))) continue
    const campos = {}
    for (const etiqueta of bloque[1].matchAll(/<input\b[^>]*>/g)) {
      const nombre = etiqueta[0].match(/name="([^"]*)"/)?.[1]
      if (!nombre) continue
      const valor = etiqueta[0].match(/value="([^"]*)"/)?.[1] ?? ''
      campos[nombre] = valor.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&')
    }
    if (Object.keys(campos).some((n) => n.startsWith('$ACTION'))) return { campos }
  }
  return null
}

async function enviar(ruta, formulario, frasco, extra = {}) {
  const cuerpo = new FormData()
  for (const [n, v] of Object.entries(formulario.campos)) cuerpo.append(n, v)
  for (const [n, v] of Object.entries(extra)) cuerpo.set(n, v)
  const respuesta = await pedir(ruta, frasco, { method: 'POST', body: cuerpo })
  frasco.guardar(respuesta)
  return respuesta
}

// --- sesión en la base (JWT) ------------------------------------------------

async function token(email) {
  const res = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: CLAVE_QA }),
  })
  const cuerpo = await res.json()
  if (!res.ok || !cuerpo.access_token) throw new Error(`No se pudo entrar como ${email}`)
  return cuerpo.access_token
}

async function rest(jwt, metodo, consulta, cuerpo) {
  const res = await fetch(`${SUPABASE}/rest/v1/${consulta}`, {
    method: metodo,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${jwt}`,
      'Accept-Profile': 'academia',
      'Content-Profile': 'academia',
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
  const datos = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, filas: Array.isArray(datos) ? datos : [], mensaje: datos?.message ?? '' }
}

// --- reporte ----------------------------------------------------------------

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
  console.log('  PRUEBA DEL COMMUNITY MANAGER — 0036 / 0037')
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
      ? `  CM EN VERDE — ${resultados.length}/${resultados.length} aserciones pasaron.`
      : `  ${fallidas.length} de ${resultados.length} aserciones FALLARON.`
  )
  for (const f of fallidas) console.log(`    ${f.grupo} · ${f.descripcion}: esperado ${f.esperado}, obtuvo ${f.real}`)
  console.log('')
  return fallidas.length === 0
}

// --- main -------------------------------------------------------------------

/** Solo lo suyo, por marca exacta. */
async function purgar(bd) {
  await bd.query(`delete from academia.community_posts where title = $1`, [MARCA_POST])
  await bd.query(`delete from academia.lesson_comments where content = any($1::text[])`, [[MARCA_PREGUNTA, MARCA_INSISTE]])
}

async function main() {
  const bd = await conectarPostgres(vars)
  const id = async (email) => (await bd.query(`select user_id from academia.profiles where email = $1`, [email])).rows[0]?.user_id

  const ids = {
    cm: await id(correo.cm),
    alumno: await id(correo.alumnoVigente),
    superadmin: await id(correo.superadmin),
  }

  try {
    await purgar(bd)
    const { rows: [rolCm] } = await bd.query(`select role from academia.profiles where user_id = $1`, [ids.cm])
    if (rolCm?.role !== 'community_manager') {
      throw new Error('qa-cm no es community manager. ¿Aplicaste 0036 y corriste `pnpm db:seed`?')
    }

    const [cm, admin, superadmin, alumno] = await Promise.all([
      entrarALaApp(correo.cm),
      entrarALaApp(correo.admin),
      entrarALaApp(correo.superadmin),
      entrarALaApp(correo.alumnoVigente),
    ])

    // ================================================================
    const G1 = 'ENTRA AL PANEL, NO A LO QUE NO LE TOCA'
    const panel = await pedir('/admin', cm)
    afirmar(G1, 'el panel abre', 200, panel.status)
    afirmar(G1, 'su rol se lee «Community manager»', true, (await panel.text()).includes('Community manager'))
    for (const ruta of ['/admin/comunidad', '/admin/alumnos', '/admin/encuestas', '/admin/dinamicas', '/admin/empresas', '/admin/puntos', '/admin/publicaciones', '/admin/entregas']) {
      afirmar(G1, `abre ${ruta}`, 200, (await pedir(ruta, cm)).status)
    }
    afirmar(G1, 'crear un curso lo devuelve al panel', '/admin', destino(await pedir('/admin/cursos/nuevo', cm)))
    afirmar(G1, 'la lista de cursos no ofrece «Nuevo curso»', false,
      (await texto('/admin/cursos', cm)).includes('href="/admin/cursos/nuevo"'))
    afirmar(G1, 'un alumno sigue sin entrar al panel', '/mis-cursos', destino(await pedir('/admin', alumno)))

    // ================================================================
    const G2 = 'CONTENIDO: SOLO SESIONES Y GRABACIONES'
    const curso = await texto(`/admin/cursos/${IDS.curso}?gen=${IDS.cohorte}`, cm)
    afirmar(G2, 've las sesiones en vivo', true, curso.includes('Sesiones en vivo'))
    afirmar(G2, 'puede agendar una sesión', true, curso.includes('Agendar sesión'))
    // Los módulos vienen cerrados; con ?modulo=todos se ven sus lecciones.
    const temario = await texto(`/admin/cursos/${IDS.curso}?gen=${IDS.cohorte}&modulo=todos`, cm)
    afirmar(G2, 've el temario con ligas a cada lección', true, temario.includes(`href="/admin/lecciones/${IDS.leccionVideo}"`))
    afirmar(G2, 'el temario no trae botones de editar', false, temario.includes('Nueva lección') || temario.includes('Eliminar módulo'))
    afirmar(G2, 'no crea módulos', false, curso.includes('Nuevo módulo'))
    afirmar(G2, 'no edita los datos del curso', false, curso.includes('Datos del curso'))
    afirmar(G2, 'no crea generaciones', false, curso.includes('Nueva generación'))
    afirmar(G2, 'no borra la generación', false, curso.includes('Eliminar generación'))
    afirmar(G2, 'no inscribe a nadie desde el curso', false, curso.includes('Agregar alumnos'))
    const delAdmin = await texto(`/admin/cursos/${IDS.curso}?gen=${IDS.cohorte}`, admin)
    afirmar(G2, 'el admin sí ve todo eso', true, delAdmin.includes('Nuevo módulo') && delAdmin.includes('Datos del curso'))

    const leccion = await texto(`/admin/lecciones/${IDS.leccionVideo}`, cm)
    afirmar(G2, 'en la lección: publicar o pasar a borrador', true,
      leccion.includes('Pasar a borrador') || leccion.includes('>Publicar<'))
    afirmar(G2, 'en la lección: adjuntos', true, leccion.includes('Subir adjunto'))
    afirmar(G2, 'en la lección: no edita el título', false, leccion.includes('name="title"'))
    afirmar(G2, 'en la lección: no la elimina', false, leccion.includes('Eliminar lección'))

    // ================================================================
    const G3 = 'ALUMNOS: TODO MENOS ALTA Y ELIMINAR'
    afirmar(G3, 'no ve «Dar de alta»', true,
      (await texto('/admin/alumnos', admin)).includes('Dar de alta') && !(await texto('/admin/alumnos', cm)).includes('Dar de alta'))
    const ficha = await texto(`/admin/alumnos/${ids.alumno}`, cm)
    afirmar(G3, 'la ficha abre con su avance', true, ficha.includes('Cursos y avance'))
    afirmar(G3, 'puede suspender', true, ficha.includes('Suspender cuenta'))
    afirmar(G3, 'puede extender el acceso', true, ficha.includes('Extender días'))
    afirmar(G3, 'no la elimina', false, ficha.includes('Eliminar cuenta'))
    afirmar(G3, 'no la quita del curso', false, ficha.includes('Quitar del curso'))
    afirmar(G3, 'no cambia roles', false, ficha.includes('name="rol"'))
    afirmar(G3, 'el superadmin sí cambia roles', true, (await texto(`/admin/alumnos/${ids.alumno}`, superadmin)).includes('name="rol"'))

    // Una liga de acceso es entrar como esa persona: para alguien del equipo,
    // solo la genera un superadmin.
    const fichaSuper = await texto(`/admin/alumnos/${ids.superadmin}`, cm)
    const liga = formularioCon(fichaSuper, `value="${correo.superadmin}"`, 'Generar enlace de acceso')
    if (liga) {
      const res = await enviar(`/admin/alumnos/${ids.superadmin}`, liga, cm)
      const html = await res.text()
      afirmar(G3, 'no genera ligas para entrar como superadmin', true,
        html.includes('Solo un superadmin genera ligas') && !html.includes('/acceso/'))
    } else {
      afirmar(G3, 'no genera ligas para entrar como superadmin', true, !fichaSuper.includes('Generar liga'))
    }

    // ================================================================
    const G4 = 'LA BASE LO SOSTIENE (RLS con su JWT)'
    const jwtCm = await token(correo.cm)
    afirmar(G4, 'no lee pagos', 0, (await rest(jwtCm, 'GET', 'payments?select=id')).filas.length)
    afirmar(G4, 'lee los perfiles de los alumnos', true, (await rest(jwtCm, 'GET', 'profiles?select=user_id&limit=5')).filas.length > 1)
    const modulo = await rest(jwtCm, 'POST', 'modules', { course_id: IDS.curso, cohort_id: IDS.cohorte, title: 'QA cm no', position: 999 })
    afirmar(G4, 'no crea módulos', false, modulo.ok)
    if (modulo.ok) await bd.query(`delete from academia.modules where title = 'QA cm no'`)
    const titulo = await rest(jwtCm, 'PATCH', `lessons?id=eq.${IDS.leccionVideo}`, { title: 'QA cm cambiado' })
    afirmar(G4, 'no cambia el título de una lección', false, titulo.ok)
    const { rows: [otroCurso] } = await bd.query(
      `select id from academia.courses where id not in (select course_id from academia.enrollments where user_id = $1) limit 1`, [ids.alumno])
    if (otroCurso) {
      const alta = await rest(jwtCm, 'POST', 'enrollments', { user_id: ids.alumno, course_id: otroCurso.id, status: 'active' })
      afirmar(G4, 'no inscribe a nadie', false, alta.ok)
      if (alta.ok) await bd.query(`delete from academia.enrollments where user_id = $1 and course_id = $2`, [ids.alumno, otroCurso.id])
    }
    const ascenso = await rest(jwtCm, 'PATCH', `profiles?user_id=eq.${ids.alumno}`, { role: 'admin' })
    afirmar(G4, 'no cambia el rol de nadie', false, ascenso.ok)
    const jwtAdmin = await token(correo.admin)
    const nombrar = await rest(jwtAdmin, 'PATCH', `profiles?user_id=eq.${ids.alumno}`, { role: 'community_manager' })
    afirmar(G4, 'un admin no nombra community managers', false, nombrar.ok)
    await bd.query(`update academia.profiles set role = 'alumno' where user_id = $1`, [ids.alumno])

    // ================================================================
    const G5 = 'CONTESTA COMO EQUIPO Y DA SEGUIMIENTO'
    const { rows: [post] } = await bd.query(
      `insert into academia.community_posts (course_id, user_id, title, status, pinned, cohort_id)
       values ($1, $2, $3, 'visible', false,
               (select cohort_id from academia.enrollments where course_id = $1 and user_id = $2))
       returning id`,
      [IDS.curso, ids.alumno, MARCA_POST])
    const { rows: [pregunta] } = await bd.query(
      `insert into academia.lesson_comments (lesson_id, user_id, content, status, created_at)
       values ($1, $2, $3, 'visible', now() - interval '2 hours') returning id`,
      [IDS.leccionVideo, ids.alumno, MARCA_PREGUNTA])

    const BANDEJA = `/admin/comunidad?curso=${IDS.curso}`
    const bandeja = await texto(BANDEJA, cm)
    afirmar(G5, 'la bandeja le trae lo del alumno', true, bandeja.includes(MARCA_POST) && bandeja.includes(MARCA_PREGUNTA))

    const responder = formularioCon(bandeja, 'name="contenido"', `value="${post.id}"`)
    afirmar(G5, 'puede responder', true, Boolean(responder))
    if (responder) {
      await enviar(BANDEJA, responder, cm, { contenido: MARCA_RESPUESTA })
      const { rows } = await bd.query(
        `select user_id from academia.community_comments where post_id = $1 and content = $2`, [post.id, MARCA_RESPUESTA])
      afirmar(G5, 'la respuesta queda firmada por el CM', ids.cm, rows[0]?.user_id ?? null)
      const muro = await texto(`/curso/qa-curso-prueba/comunidad`, alumno)
      const bloque = muro.slice(Math.max(0, muro.indexOf(MARCA_RESPUESTA) - 1500), muro.indexOf(MARCA_RESPUESTA))
      afirmar(G5, 'el alumno la ve con «Equipo VADAI»', true, muro.includes(MARCA_RESPUESTA) && bloque.includes('Equipo VADAI'))
    }

    const atender = formularioCon(bandeja, 'name="atender" value="si"', `name="id" value="${pregunta.id}"`)
    afirmar(G5, 'puede marcar «Atendida sin responder»', true, Boolean(atender))
    if (atender) {
      const res = await enviar(BANDEJA, atender, cm)
      afirmar(G5, 'vuelve a la bandeja con aviso', true, (res.headers.get('location') ?? '').includes('aviso=atendida'))
      const { rows } = await bd.query(`select attended_by from academia.lesson_comments where id = $1`, [pregunta.id])
      afirmar(G5, 'queda marcada en la base con quién', ids.cm, rows[0]?.attended_by ?? null)
      afirmar(G5, 'sale de «Sin respuesta»', false, (await texto(BANDEJA, cm)).includes(MARCA_PREGUNTA))
      const resueltas = await texto(`${BANDEJA}&estado=respondidas`, cm)
      afirmar(G5, 'y aparece como atendida en «Resueltas»', true,
        resueltas.includes(MARCA_PREGUNTA) && resueltas.includes('Atendida sin respuesta'))

      // El alumno vuelve a escribir: regresa sola a pendiente.
      await bd.query(
        `insert into academia.lesson_comments (lesson_id, user_id, parent_id, content, status)
         values ($1, $2, $3, $4, 'visible')`,
        [IDS.leccionVideo, ids.alumno, pregunta.id, MARCA_INSISTE])
      afirmar(G5, 'si el alumno insiste, vuelve a «Sin respuesta»', true, (await texto(BANDEJA, cm)).includes(MARCA_PREGUNTA))
    }

    const jwtAlumno = await token(correo.alumnoVigente)
    const trampa = await rest(jwtAlumno, 'PATCH', `lesson_comments?id=eq.${pregunta.id}`, { attended_at: new Date().toISOString() })
    afirmar(G5, 'el alumno no se marca atendido a sí mismo', false, trampa.ok && trampa.filas.length > 0)

    // ================================================================
    const G6 = 'SOLO UN SUPERADMIN NOMBRA COMMUNITY MANAGERS'
    const fichaParaSuper = await texto(`/admin/alumnos/${ids.alumno}`, superadmin)
    const cambiar = formularioCon(fichaParaSuper, 'name="user_id"', `value="${ids.alumno}"`, 'Cambiar rol')
    const cambiarRol = cambiar ?? formularioCon(fichaParaSuper, `value="${ids.alumno}"`, 'name="rol"')
    afirmar(G6, 'la ficha del superadmin trae el cambio de rol', true, Boolean(cambiarRol))
    if (cambiarRol) {
      await enviar(`/admin/alumnos/${ids.alumno}`, cambiarRol, superadmin, { rol: 'community_manager' })
      const { rows } = await bd.query(`select role from academia.profiles where user_id = $1`, [ids.alumno])
      afirmar(G6, 'lo nombra community manager', 'community_manager', rows[0]?.role)
    }
  } finally {
    // El alumno QA vuelve a ser alumno pase lo que pase: otras suites lo usan.
    await bd.query(`update academia.profiles set role = 'alumno' where user_id = $1`, [ids.alumno]).catch(() => {})
    await purgar(bd).catch(() => {})
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
