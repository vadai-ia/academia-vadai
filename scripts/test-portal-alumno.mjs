#!/usr/bin/env node
/**
 * test-portal-alumno.mjs — Criterio de cierre de M22: el portal de alumnos,
 * con cuatro lugares y cada cosa en uno (docs/revision-portal-alumno.md).
 *
 *   pnpm qa:mostrar
 *   APP_URL=http://localhost:3117 node scripts/test-portal-alumno.mjs
 *   pnpm qa:esconder
 *
 * Usa el curso QA del seed (qa-curso-prueba) y el plan real de V-AI-P solo para
 * LEER (su casa está en borrador mientras no abra: el equipo la ve, un alumno
 * no). Lo que escribe —una publicación, un comentario, una pregunta y su
 * respuesta— lleva la marca «QA-M22» y se borra al terminar.
 */

import { cargarEnv, conectarPostgres, exigir } from './lib/entorno.mjs'
import { CURSO_QA, IDS } from './lib/qa.mjs'

const vars = cargarEnv()
const SUPABASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')
const APP = (process.env.APP_URL ?? 'http://localhost:3117').replace(/\/+$/, '')
const CORREO_ALUMNO = 'qa-alumno1@academia.vadai.com.mx'
const CORREO_ADMIN = 'qa-admin@academia.vadai.com.mx'
const MARCA = 'QA-M22'

// --- sesión ------------------------------------------------------------------------

function crearFrasco() {
  const cookies = new Map()
  return {
    guardar(r) {
      for (const cruda of r.headers.getSetCookie?.() ?? []) {
        const [par] = cruda.split(';')
        const i = par.indexOf('=')
        if (i === -1) continue
        const v = par.slice(i + 1).trim()
        if (v === '' || /Max-Age=0/i.test(cruda)) cookies.delete(par.slice(0, i).trim())
        else cookies.set(par.slice(0, i).trim(), v)
      }
    },
    encabezado: () => [...cookies.entries()].map(([n, v]) => `${n}=${v}`).join('; '),
    get tamano() {
      return cookies.size
    },
  }
}
async function entrar(email) {
  const r = await fetch(`${SUPABASE}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'recovery', email }),
  })
  const c = await r.json()
  const hash = c.hashed_token ?? c.properties?.hashed_token
  const frasco = crearFrasco()
  frasco.guardar(await fetch(`${APP}/auth/confirmar?token_hash=${encodeURIComponent(hash)}&type=recovery`, { redirect: 'manual' }))
  return frasco
}
const pedir = (ruta, frasco) => fetch(`${APP}${ruta}`, { redirect: 'manual', headers: frasco?.tamano ? { cookie: frasco.encabezado() } : {} })
const html = async (ruta, frasco) => (await pedir(ruta, frasco)).text()
/** A dónde redirige (ruta relativa), o null si no redirige. */
async function destino(ruta, frasco) {
  const r = await pedir(ruta, frasco)
  if (r.status < 300 || r.status >= 400) return null
  const l = r.headers.get('location') ?? ''
  return l.replace(APP, '').replace(/^https?:\/\/[^/]+/, '')
}
/** Los href de un <nav aria-label="…">, en orden. */
function enlacesDelNav(pagina, etiqueta) {
  const i = pagina.indexOf(`aria-label="${etiqueta}"`)
  if (i < 0) return null
  const fin = pagina.indexOf('</nav>', i)
  return [...pagina.slice(i, fin).matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'))
}

// --- reporte -------------------------------------------------------------------------

const resultados = []
const afirmar = (grupo, descripcion, esperado, real) => resultados.push({ grupo, descripcion, esperado, real, ok: esperado === real })
function imprimir() {
  const porGrupo = new Map()
  for (const r of resultados) porGrupo.set(r.grupo, [...(porGrupo.get(r.grupo) ?? []), r])
  const ancho = Math.max(...resultados.map((r) => r.descripcion.length))
  console.log('\n  PRUEBA DEL PORTAL DE ALUMNOS — M22')
  console.log(`  App: ${APP}`)
  for (const [grupo, casos] of porGrupo) {
    console.log(`\n  ${grupo}\n  ${'─'.repeat(ancho + 30)}`)
    for (const c of casos) console.log(`  ${c.ok ? '✓' : '✗'}  ${c.descripcion.padEnd(ancho)}  ${c.ok ? String(c.real) : `esperado ${c.esperado}, obtuvo ${c.real}`}`)
  }
  const fallidas = resultados.filter((r) => !r.ok)
  console.log(`\n  ${'─'.repeat(ancho + 30)}`)
  console.log(fallidas.length === 0 ? `  M22 EN VERDE — ${resultados.length}/${resultados.length} aserciones pasaron.` : `  ${fallidas.length} de ${resultados.length} aserciones FALLARON.`)
  for (const f of fallidas) console.log(`    ${f.grupo} · ${f.descripcion}: esperado ${f.esperado}, obtuvo ${f.real}`)
  console.log('')
  return fallidas.length === 0
}

// --- base ------------------------------------------------------------------------------

const una = async (bd, sql, p = []) => (await bd.query(sql, p)).rows[0] ?? null

async function purgar(bd) {
  await bd.query(`delete from academia.community_posts where title like $1`, [`${MARCA}%`])
  await bd.query(`delete from academia.lesson_comments where content like $1`, [`${MARCA}%`])
}

// --- la prueba ---------------------------------------------------------------------------

const bd = await conectarPostgres(vars)
let verde = false
try {
  await purgar(bd)
  const alumno = await una(bd, `select user_id from academia.profiles where email = $1`, [CORREO_ALUMNO])
  const admin = await una(bd, `select user_id from academia.profiles where email = $1`, [CORREO_ADMIN])
  const curso = await una(bd, `select status from academia.courses where id = $1`, [CURSO_QA.id])
  if (curso?.status !== 'published') throw new Error('El curso QA está archivado: corre `pnpm qa:mostrar` antes.')
  const casa = await una(
    bd,
    `select c.id, c.slug from academia.membership_plans p join academia.courses c on c.id = p.hub_course_id where p.slug = 'v-ai-p'`
  )

  const sAlumno = await entrar(CORREO_ALUMNO)
  const sAdmin = await entrar(CORREO_ADMIN)

  // =========================================================================
  // 1. El menú: cuatro lugares
  // =========================================================================
  const M = 'El menú'
  const inicio = await html('/mis-cursos', sAlumno)
  const menu = enlacesDelNav(inicio, 'Secciones')
  afirmar(M, 'cuatro pastillas: Inicio · V-AI-P · Mis cursos · Perfil', '/mis-cursos /vaip /cursos /perfil', menu?.join(' '))
  for (const viejo of ['/puntos', '/certificaciones', '/comunidad', '/dinamicas', '/blog']) {
    afirmar(M, `${viejo} ya no está en el menú`, false, Boolean(menu?.includes(viejo)))
  }

  // =========================================================================
  // 2. Las rutas viejas llegan a su lugar nuevo
  // =========================================================================
  const R = 'Las ligas viejas'
  afirmar(R, '/puntos → Mi perfil → Puntos', '/perfil/puntos', await destino('/puntos', sAlumno))
  afirmar(R, '/certificaciones → Mi perfil → Certificaciones', '/perfil/certificaciones', await destino('/certificaciones', sAlumno))
  afirmar(R, '/comunidad → Inicio', '/mis-cursos', await destino('/comunidad', sAlumno))
  afirmar(R, '/comunidad?curso=… → el muro de ese curso', `/curso/${CURSO_QA.slug}/comunidad`, await destino(`/comunidad?curso=${CURSO_QA.slug}`, sAlumno))
  if (casa) {
    afirmar(R, 'el muro de la casa de V-AI-P → /vaip (con su tema)', '/vaip?tema=noticias', await destino(`/curso/${casa.slug}/comunidad?tema=noticias`, sAdmin))
    afirmar(R, 'sus clases → V-AI-P → Clases', '/vaip/clases', await destino(`/curso/${casa.slug}/en-vivo`, sAdmin))
    afirmar(R, 'su contenido → V-AI-P → Clases', '/vaip/clases', await destino(`/curso/${casa.slug}`, sAdmin))
  }

  // =========================================================================
  // 3. Inicio
  // =========================================================================
  const I = 'Inicio'
  afirmar(I, 'sin la tarjeta de nivel (el puntaje por generación ya se premió)', false, inicio.includes('TU NIVEL') || inicio.includes('>Tu nivel<'))
  afirmar(I, 'sin «Tus certificados» (viven en Mi perfil)', false, inicio.includes('Tus certificados'))
  afirmar(I, 'lo último del muro de su curso, con liga a la publicación', true, new RegExp(`href="/curso/${CURSO_QA.slug}/comunidad#publicacion-`).test(inicio))
  afirmar(I, 'a quien no es miembro no le pinta el bloque de V-AI-P', false, inicio.includes('Escribir en el muro'))
  const inicioEquipo = await html('/mis-cursos', sAdmin)
  afirmar(I, 'a quien está en V-AI-P (aquí, el equipo), V-AI-P primero', true, inicioEquipo.includes('Escribir en el muro') && inicioEquipo.includes('href="/vaip"'))
  afirmar(I, 'la casa de V-AI-P no sale como curso', false, Boolean(casa) && inicioEquipo.includes(`href="/curso/${casa.slug}"`))

  // =========================================================================
  // 4. V-AI-P con pestañas
  // =========================================================================
  const V = 'V-AI-P'
  afirmar(V, 'a quien no es miembro, sus pestañas lo regresan a la invitación', '/vaip', await destino('/vaip/clases', sAlumno))
  const vaipEquipo = await html('/vaip', sAdmin)
  afirmar(V, 'el espacio abre en el Muro con sus pestañas', '/vaip /vaip/clases /vaip/herramientas /vaip/ranking', enlacesDelNav(vaipEquipo, 'Secciones de V-AI-P')?.join(' '))
  for (const pestana of ['/vaip/clases', '/vaip/herramientas', '/vaip/ranking']) {
    afirmar(V, `${pestana} abre`, 200, (await pedir(pestana, sAdmin)).status)
  }
  afirmar(V, 'el Ranking es el de V-AI-P', true, (await html('/vaip/ranking', sAdmin)).includes('Ranking de V-AI-P'))

  // =========================================================================
  // 5. Mi perfil con pestañas
  // =========================================================================
  const P = 'Mi perfil'
  const perfil = await html('/perfil', sAlumno)
  afirmar(P, 'pestañas Datos · Membresía · Certificaciones · Puntos', '/perfil /perfil/membresia /perfil/certificaciones /perfil/puntos', enlacesDelNav(perfil, 'Secciones de tu perfil')?.join(' '))
  afirmar(P, 'Datos ya no repite los certificados', false, perfil.includes('Descargar PDF'))
  const puntos = await html('/perfil/puntos', sAlumno)
  afirmar(P, 'Puntos: el desglose cuenta las dinámicas', true, puntos.includes('Dinámicas terminadas con tu empresa'))
  afirmar(P, 'Puntos: sin ranking por generación', false, puntos.includes('Cómo vas en tu generación'))
  afirmar(P, 'Certificaciones abre', 200, (await pedir('/perfil/certificaciones', sAlumno)).status)
  afirmar(P, 'Membresía abre', 200, (await pedir('/perfil/membresia', sAlumno)).status)

  // =========================================================================
  // 6. El curso
  // =========================================================================
  const C = 'El curso'
  const contenido = await html(`/curso/${CURSO_QA.slug}`, sAlumno)
  const pestanas = (enlacesDelNav(contenido, 'Secciones del curso') ?? []).map((h) => h.replace(`/curso/${CURSO_QA.slug}`, '') || '/')
  afirmar(C, 'Comunidad es la segunda pestaña', '/comunidad', pestanas[1])
  afirmar(C, 'Dinámicas, la última', '/dinamicas', pestanas[pestanas.length - 1])
  afirmar(C, '«← Mis cursos» lleva a Mis cursos', true, contenido.includes('href="/cursos"'))
  const muro = await html(`/curso/${CURSO_QA.slug}/comunidad`, sAlumno)
  afirmar(C, 'el muro ya no lleva ranking de la generación', false, muro.includes('Ranking de tu generación') || muro.includes('Ranking del curso'))
  afirmar(C, 'ni «suman puntos»', false, muro.includes('suman puntos'))

  // =========================================================================
  // 7. La campana: «Te respondieron»
  // =========================================================================
  const B = 'La campana'
  const post = await una(
    bd,
    `insert into academia.community_posts (course_id, cohort_id, user_id, title, status) values ($1, $2, $3, $4, 'visible') returning id`,
    [CURSO_QA.id, IDS.cohorte, alumno.user_id, `${MARCA} ¿Cómo concilio el viernes?`]
  )
  await bd.query(`insert into academia.community_comments (post_id, user_id, content, status) values ($1, $2, $3, 'visible')`, [post.id, admin.user_id, 'Así: sube el Excel del banco.'])
  const pregunta = await una(
    bd,
    `insert into academia.lesson_comments (lesson_id, user_id, content, status) values ($1, $2, $3, 'visible') returning id`,
    [IDS.leccionVideo, alumno.user_id, `${MARCA} ¿Dónde está el material?`]
  )
  await bd.query(`insert into academia.lesson_comments (lesson_id, user_id, parent_id, content, status) values ($1, $2, $3, 'En la columna de la derecha.', 'visible')`, [IDS.leccionVideo, admin.user_id, pregunta.id])

  // La campana va en todas las pantallas; se lee en Perfil para no confundirla
  // con «lo último de los muros» de Inicio, que liga a la misma publicación.
  const conCampana = await html('/perfil', sAlumno)
  afirmar(B, 'avisa «Te respondieron» en el muro', true, conCampana.includes('Te respondieron') && conCampana.includes(`${MARCA} ¿Cómo concilio el viernes?`))
  afirmar(B, '…y lleva a la publicación', true, conCampana.includes(`/curso/${CURSO_QA.slug}/comunidad#publicacion-${post.id}`))
  afirmar(B, 'avisa la respuesta a su pregunta de la lección', true, conCampana.includes(`/curso/${CURSO_QA.slug}/${IDS.leccionVideo}#comentario-${pregunta.id}`))
  const delAdmin = await html('/perfil', sAdmin)
  afirmar(B, 'a quien respondió no le avisa su propia respuesta', false, delAdmin.includes(`#publicacion-${post.id}`))

  verde = imprimir()
} catch (e) {
  imprimir()
  console.error(`  La suite se detuvo: ${e.message}`)
} finally {
  await purgar(bd).catch((e) => console.error(`  No se pudo limpiar: ${e.message}`))
  await bd.end()
  process.exit(verde ? 0 : 1)
}
