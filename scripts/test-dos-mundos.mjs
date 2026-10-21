#!/usr/bin/env node
/**
 * test-dos-mundos.mjs — Criterio de cierre de M25, parte B: el panel en «dos mundos».
 *
 * Pedido de Alejandro (20-oct-2026): «hay tantas pestañas… muchas cosas
 * significan lo mismo». La barra lateral es la ÚNICA navegación, partida en
 * V-AI-P y Cursos; nada de Cursos enseña V-AI-P ni al revés; el canal de un
 * curso es su «Grupo» y «Comunidad» es solo V-AI-P.
 *
 *   PORT=3141 pnpm start
 *   pnpm qa:mostrar
 *   APP_URL=http://localhost:3141 node scripts/test-dos-mundos.mjs
 *   pnpm qa:esconder
 *
 * La base es la de producción. Lo que se mira de la casa real es SOLO LECTURA
 * (páginas del panel). Lo que se escribe vive en el curso `qa-mundos-casa` y el
 * plan `qa-mundos`, que la suite arma y borra: una casa de plan QA se comporta
 * igual que la real (lib/membresia/mundo.ts).
 *
 * `--limpiar` solo borra lo de la suite.
 */

import { cargarEnv, conectarPostgres, exigir } from './lib/entorno.mjs'
import { IDS } from './lib/qa.mjs'

const vars = cargarEnv()
const SUPABASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')
const APP = (process.env.APP_URL ?? 'http://localhost:3141').replace(/\/+$/, '')
const SOLO_LIMPIAR = process.argv.includes('--limpiar')

const CASA = 'qa-mundos-casa'
const PLAN = 'qa-mundos'
const MARCA_POST = 'QA-MUNDOS pregunta en el muro de la casa'
const MARCA_LECCION = 'QA-MUNDOS pregunta en una clase de la casa'
const MARCA_ANUNCIO = 'QA-MUNDOS anuncio a la casa'
const MARCA_CLASE = 'QA-MUNDOS clase de la casa'
const CORREO_ADMIN = 'qa-admin@academia.vadai.com.mx'
const CORREO_CM = 'qa-cm@academia.vadai.com.mx'
const CORREO_ALUMNO = 'qa-alumno1@academia.vadai.com.mx'

// ============================================================================
// Sesión, formularios y reporte
// ============================================================================

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
  const hashToken = c.hashed_token ?? c.properties?.hashed_token
  const frasco = crearFrasco()
  frasco.guardar(await fetch(`${APP}/auth/confirmar?token_hash=${encodeURIComponent(hashToken)}&type=recovery`, { redirect: 'manual' }))
  return frasco
}
const pedir = (ruta, frasco, opciones = {}) =>
  fetch(`${APP}${ruta}`, { redirect: 'manual', ...opciones, headers: frasco?.tamano ? { cookie: frasco.encabezado() } : {} })
const html = async (ruta, frasco) => (await pedir(ruta, frasco)).text()
const rebota = (r) => r.status >= 300 && r.status < 400
const destino = (r) => {
  const l = r.headers.get('location')
  return l ? new URL(l, APP).pathname + new URL(l, APP).search : null
}

function formularioDonde(pagina, prueba) {
  for (const bloque of pagina.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)) {
    if (!prueba(bloque[1])) continue
    const campos = {}
    for (const etiqueta of bloque[1].matchAll(/<(?:input|select|textarea)\b[^>]*>/g)) {
      const nombre = etiqueta[0].match(/name="([^"]*)"/)?.[1]
      if (!nombre) continue
      const tipo = etiqueta[0].match(/type="([^"]*)"/)?.[1]
      if (tipo === 'file') continue
      if ((tipo === 'checkbox' || tipo === 'radio') && !/\schecked/.test(etiqueta[0])) continue
      campos[nombre] = (etiqueta[0].match(/value="([^"]*)"/)?.[1] ?? '').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&')
    }
    return campos
  }
  return null
}
async function enviarFormulario(ruta, campos, frasco) {
  const cuerpo = new FormData()
  for (const [nombre, valor] of Object.entries(campos ?? {})) cuerpo.append(nombre, valor)
  return pedir(ruta, frasco, { method: 'POST', body: cuerpo })
}

/** Los href de la PRIMERA barra lateral (la de teléfono; la de escritorio es igual). */
function destinosDeLaBarra(pagina) {
  const i = pagina.indexOf('aria-label="Secciones del panel"')
  if (i < 0) return []
  const fin = pagina.indexOf('</nav>', i)
  return [...pagina.slice(i, fin).matchAll(/href="([^"]+)"/g)].map((m) => m[1])
}
function etiquetasDeLaBarra(pagina) {
  const i = pagina.indexOf('aria-label="Secciones del panel"')
  if (i < 0) return []
  const fin = pagina.indexOf('</nav>', i)
  return [...pagina.slice(i, fin).matchAll(/<span class="truncate">([^<]+)<\/span>/g)].map((m) => m[1])
}

const resultados = []
const afirmar = (grupo, descripcion, esperado, real) => resultados.push({ grupo, descripcion, esperado, real, ok: esperado === real })
function imprimir() {
  const porGrupo = new Map()
  for (const r of resultados) porGrupo.set(r.grupo, [...(porGrupo.get(r.grupo) ?? []), r])
  const ancho = Math.max(10, ...resultados.map((r) => r.descripcion.length))
  console.log('\n  PRUEBA DE LOS DOS MUNDOS — M25')
  console.log(`  App: ${APP}`)
  for (const [grupo, casos] of porGrupo) {
    console.log(`\n  ${grupo}\n  ${'─'.repeat(ancho + 30)}`)
    for (const c of casos) console.log(`  ${c.ok ? '✓' : '✗'}  ${c.descripcion.padEnd(ancho)}  ${c.ok ? String(c.real) : `esperado ${c.esperado}, obtuvo ${c.real}`}`)
  }
  const fallidas = resultados.filter((r) => !r.ok)
  console.log(`\n  ${'─'.repeat(ancho + 30)}`)
  console.log(fallidas.length === 0 && resultados.length > 0 ? `  M25 (dos mundos) EN VERDE — ${resultados.length}/${resultados.length} aserciones pasaron.` : `  ${fallidas.length} de ${resultados.length} aserciones FALLARON.`)
  for (const f of fallidas) console.log(`    ${f.grupo} · ${f.descripcion}: esperado ${f.esperado}, obtuvo ${f.real}`)
  console.log('')
  return fallidas.length === 0 && resultados.length > 0
}

const una = async (bd, sql, p = []) => (await bd.query(sql, p)).rows[0] ?? null

async function purgar(bd) {
  const casa = await una(bd, `select id from academia.courses where slug = $1`, [CASA])
  if (casa) {
    await bd.query(`delete from academia.posts where audience_course_id = $1`, [casa.id])
    await bd.query(`delete from academia.community_posts where course_id = $1`, [casa.id])
    await bd.query(
      `delete from academia.lesson_comments where lesson_id in (select l.id from academia.lessons l join academia.modules m on m.id = l.module_id where m.course_id = $1)`,
      [casa.id]
    )
    await bd.query(`delete from academia.lessons where module_id in (select id from academia.modules where course_id = $1)`, [casa.id])
    await bd.query(`delete from academia.modules where course_id = $1`, [casa.id])
    await bd.query(`delete from academia.cohort_sessions where cohort_id in (select id from academia.cohorts where course_id = $1)`, [casa.id])
    await bd.query(`delete from academia.cohorts where course_id = $1`, [casa.id])
  }
  await bd.query(`delete from academia.posts where title = $1`, [MARCA_ANUNCIO])
  await bd.query(`delete from academia.membership_plans where slug = $1`, [PLAN])
  await bd.query(`delete from academia.courses where slug = $1`, [CASA])
}

// ============================================================================
// Principal
// ============================================================================

async function principal() {
  const bd = await conectarPostgres(vars)
  try {
    await purgar(bd)
    if (SOLO_LIMPIAR) {
      console.log('  Limpio: lo de test-dos-mundos se borró.')
      return true
    }

    const admin = await entrar(CORREO_ADMIN)
    const cm = await entrar(CORREO_CM)

    // ------------------------------------------------------------------
    // 1. La barra: la única navegación, partida en dos mundos
    // ------------------------------------------------------------------
    const B = 'La barra lateral'
    const panelAdmin = await html('/admin', admin)
    const panelCm = await html('/admin', cm)
    const ordenAdmin = [
      '/admin',
      '/admin/vaip', '/admin/vaip/muro', '/admin/vaip/noticias', '/admin/vaip/clases', '/admin/vaip/miembros', '/admin/vaip/herramientas', '/admin/vaip/planes',
      '/admin/cursos', '/admin/entregas', '/admin/grupos', '/admin/publicaciones', '/admin/puntos', '/admin/dinamicas', '/admin/encuestas', '/admin/certificaciones',
      '/admin/alumnos', '/admin/empresas',
      '/admin/agente', '/admin/ajustes/api',
      '/mis-cursos',
    ]
    afirmar(B, 'el orden exacto para el admin', ordenAdmin.join(' '), destinosDeLaBarra(panelAdmin).join(' '))
    const ordenCm = ordenAdmin.filter((r) => r !== '/admin/vaip/planes' && r !== '/admin/ajustes/api')
    afirmar(B, 'el community manager, sin Planes y cobros ni API', ordenCm.join(' '), destinosDeLaBarra(panelCm).join(' '))
    const etiquetas = etiquetasDeLaBarra(panelAdmin)
    afirmar(B, 'ninguna etiqueta se repite', etiquetas.length, new Set(etiquetas).size)
    afirmar(B, 'sin «Bandeja», «Publicar» ni «Comunidad»', false, etiquetas.some((e) => ['Bandeja', 'Publicar', 'Comunidad', 'Publicaciones', 'Contenido'].includes(e)))
    afirmar(B, 'un solo «Agente IA»', 1, etiquetas.filter((e) => e.startsWith('Agente')).length)
    afirmar(B, 'los grupos V-AI-P · Cursos · Personas · Ajustes', true,
      ['V-AI-P', 'Cursos', 'Personas', 'Ajustes'].every((g) => panelAdmin.includes(`>${g}</p>`)))

    const C = 'Lo del community manager'
    afirmar(C, 'Planes y cobros lo rebota', true, rebota(await pedir('/admin/vaip/planes', cm)))
    afirmar(C, 'los ajustes del agente lo rebotan', true, rebota(await pedir('/admin/agente/ajustes', cm)))
    afirmar(C, 'la API lo rebota', true, rebota(await pedir('/admin/ajustes/api', cm)))
    afirmar(C, 'Agente IA (borradores) sí abre', 200, (await pedir('/admin/agente', cm)).status)

    // ------------------------------------------------------------------
    // 2. Las rutas viejas llegan a su lugar
    // ------------------------------------------------------------------
    const R = 'Rutas viejas'
    for (const [vieja, nueva] of [
      ['/admin/vaip/publicar', '/admin/vaip/muro'],
      ['/admin/vaip/contenido', '/admin/vaip/herramientas'],
      ['/admin/vaip/cobros', '/admin/vaip/planes'],
      ['/admin/ajustes/agente', '/admin/agente/ajustes'],
      ['/admin/comunidad', '/admin/grupos'],
    ]) {
      afirmar(R, `${vieja} → ${nueva}`, nueva, destino(await pedir(vieja, admin)))
    }

    // ------------------------------------------------------------------
    // 3. La casa real nunca sale en las pantallas de Cursos (solo lectura)
    // ------------------------------------------------------------------
    const V = 'La casa de V-AI-P fuera de Cursos'
    const real = await una(
      bd,
      `select c.id, (select h.id from academia.cohorts h where h.course_id = c.id order by h.created_at limit 1) as gen
         from academia.membership_plans p join academia.courses c on c.id = p.hub_course_id where p.slug = 'v-ai-p'`
    )
    if (real) {
      const cursos = await html('/admin/cursos', admin)
      const archivados = await html('/admin/cursos?ver=archivados', admin)
      afirmar(V, 'no está en Cursos', false, cursos.includes(`href="/admin/cursos/${real.id}"`) || archivados.includes(`href="/admin/cursos/${real.id}"`))
      afirmar(V, 'no está en el filtro de Grupos', false, (await html('/admin/grupos', admin)).includes(`value="${real.id}"`))
      afirmar(V, 'no está en Puntos', false, (await html('/admin/puntos', admin)).includes(`value="${real.id}"`))
      const publicaciones = await html('/admin/publicaciones', admin)
      afirmar(V, 'no se ofrece como audiencia de un anuncio', false, publicaciones.includes(`curso:${real.id}`) || publicaciones.includes(`value="${real.id}"`))
      afirmar(V, 'no está en el selector de Dinámicas', false, (await html('/admin/dinamicas', admin)).includes(`value="${real.id}"`))
      afirmar(V, 'no está en «Avance por curso» del Panel', false, panelAdmin.includes(`href="/admin/cursos/${real.id}"`))
      afirmar(V, 'no se agenda desde el Panel', false, Boolean(real.gen) && panelAdmin.includes(`value="${real.gen}"`))
      afirmar(V, 'su editor manda a V-AI-P → Clases', '/admin/vaip/clases', destino(await pedir(`/admin/cursos/${real.id}`, admin)))
    } else {
      afirmar(V, 'existe el plan V-AI-P con su casa', true, false)
    }

    // ------------------------------------------------------------------
    // 4. Con una casa de plan QA: lo suyo va al Muro, no a Grupos
    // ------------------------------------------------------------------
    const M = 'Lo de una casa va al Muro'
    const casa = await una(
      bd,
      `insert into academia.courses (slug, title, course_type, status, certificate_enabled) values ($1, 'QA · qa-mundos-casa (test-dos-mundos)', 'cohort', 'published', false) returning id`,
      [CASA]
    )
    const miembros = await una(
      bd,
      `insert into academia.cohorts (course_id, name, starts_on, ends_on, open_for_enrollment) values ($1, 'QA Mundos Miembros', current_date, null, true) returning id`,
      [casa.id]
    )
    await bd.query(`insert into academia.membership_plans (slug, name, price_mxn, status, hub_course_id) values ($1, 'QA Mundos', 100, 'draft', $2)`, [PLAN, casa.id])
    const alumno = await una(bd, `select user_id from academia.profiles where email = $1`, [CORREO_ALUMNO])
    const post = await una(
      bd,
      `insert into academia.community_posts (course_id, user_id, title, status, created_at) values ($1, $2, $3, 'visible', now() - interval '1 hour') returning id`,
      [casa.id, alumno.user_id, MARCA_POST]
    )
    const modulo = await una(bd, `insert into academia.modules (course_id, title, position, cohort_id) values ($1, 'QA mundos', 1, $2) returning id`, [casa.id, miembros.id])
    const leccion = await una(
      bd,
      `insert into academia.lessons (module_id, title, position, lesson_type, status, is_required) values ($1, 'QA mundos clase', 1, 'video', 'published', false) returning id`,
      [modulo.id]
    )
    const pregunta = await una(
      bd,
      `insert into academia.lesson_comments (lesson_id, user_id, content, status) values ($1, $2, $3, 'visible') returning id`,
      [leccion.id, alumno.user_id, MARCA_LECCION]
    )

    const muro = await html('/admin/vaip/muro?estado=todas', admin)
    const grupos = await html('/admin/grupos?estado=todas', admin)
    afirmar(M, 'la publicación sale en el Muro de V-AI-P', true, muro.includes(`id="hilo-${post.id}"`))
    // Por el id del hilo, no por la liga: la campana del encabezado liga a todos.
    afirmar(M, '…y NO en Grupos', false, grupos.includes(`id="hilo-${post.id}"`))
    afirmar(M, 'la pregunta en una clase sale en el Muro', true, muro.includes(`id="hilo-${pregunta.id}"`))
    afirmar(M, '…y NO en Grupos', false, grupos.includes(`id="hilo-${pregunta.id}"`))
    const conCampana = await html('/admin/alumnos', admin)
    afirmar(M, 'la campana la cuenta en su sección de V-AI-P', true, Number(conCampana.match(/data-vaip="(\d+)"/)?.[1] ?? 0) >= 1)
    afirmar(M, '…con la liga al Muro', true, conCampana.includes(`/admin/vaip/muro#hilo-${post.id}`))
    afirmar(M, 'la casa no sale en la lista de Cursos', false, (await html('/admin/cursos', admin)).includes(`href="/admin/cursos/${casa.id}"`))
    afirmar(M, 'pero su editor sigue abriendo (las suites lo operan)', 200, (await pedir(`/admin/cursos/${casa.id}`, admin)).status)
    afirmar(M, 'una pregunta de un curso normal sigue en Grupos', true, (await html(`/admin/grupos?estado=todas&curso=${IDS.curso}`, admin)).includes('data-bandeja="cursos"'))

    const A = 'Anuncios solo de cursos'
    // Agendar una clase en la casa con «anunciar» marcado: la sesión queda y el
    // anuncio no sale (la guarda vive en el servidor, no solo en el formulario).
    const rutaCasa = `/admin/cursos/${casa.id}?gen=${miembros.id}`
    const formClase = formularioDonde(await html(rutaCasa, admin), (f) => f.includes('name="title"') && f.includes('name="fecha"') && f.includes('name="hora"'))
    const manana = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date(Date.now() + 2 * 86_400_000))
    const rClase = await enviarFormulario(
      rutaCasa,
      { ...formClase, cohort_id: miembros.id, title: MARCA_CLASE, fecha: manana, hora: '19:00', meet_url: '', description: '', anunciar: 'si' },
      admin
    )
    const textoClase = await rClase.text()
    if (process.env.DEPURAR) console.log('campos:', Object.keys(formClase ?? {}), 'aviso:', textoClase.match(/role="status"[^>]*>([^<]*)/)?.[1])
    afirmar(A, 'agendar en la casa deja la clase', 1, (await una(bd, `select count(*)::int n from academia.cohort_sessions where cohort_id = $1 and title = $2`, [miembros.id, MARCA_CLASE])).n)
    afirmar(A, '…y NO publica anuncio aunque se pida', 0, (await una(bd, `select count(*)::int n from academia.posts where audience_course_id = $1`, [casa.id])).n)

    const formAnuncio = formularioDonde(await html('/admin/publicaciones', admin), (f) => f.includes('name="audiencia"') && f.includes('name="title"'))
    const respuesta = await enviarFormulario(
      '/admin/publicaciones',
      { ...formAnuncio, title: MARCA_ANUNCIO, post_type: 'announcement', audiencia: `curso:${casa.id}`, content_rich: '', publicar: 'si' },
      admin
    )
    const texto = await respuesta.text()
    afirmar(A, 'un anuncio a la casa se rechaza', true, texto.includes('Para V-AI-P usa Muro'))
    afirmar(A, '…y no se guarda', null, await una(bd, `select id from academia.posts where title = $1`, [MARCA_ANUNCIO]))

    return imprimir()
  } finally {
    if (!SOLO_LIMPIAR) await purgar(bd).catch((e) => console.error('limpieza:', e.message))
    await bd.end()
  }
}

principal()
  .then((ok) => process.exit(ok ? 0 : 1))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
