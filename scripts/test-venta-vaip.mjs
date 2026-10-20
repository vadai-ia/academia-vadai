#!/usr/bin/env node
/**
 * test-venta-vaip.mjs — Criterio de cierre de M23: la página de venta de
 * V-AI-P (/vaip) dice dónde hacer clic, en el teléfono y en la computadora.
 *
 *   El servidor de prueba necesita VAIP_VENTA_DE_PRUEBA=qa-venta-m23:
 *   VAIP_VENTA_DE_PRUEBA=qa-venta-m23 PORT=3117 pnpm start
 *   APP_URL=http://localhost:3117 node scripts/test-venta-vaip.mjs [--conservar | --limpiar]
 *
 * La base es la de producción, así que el plan real NUNCA se toca: la suite
 * siembra su propio plan (`qa-venta-m23`, con su casa `qa-venta-casa`) y el
 * servidor local lo pinta en /vaip en lugar de V-AI-P
 * (`planDeLaVenta()`, lib/membresia/consultas.ts). Afirma propiedades —que
 * todos los botones son el mismo link, que el del encabezado va antes del
 * primer título—, no números de diseño.
 *
 * Con --conservar deja el escenario armado para `pnpm capturas -- --solo=venta`.
 */

import { cargarEnv, conectarPostgres, exigir } from './lib/entorno.mjs'

const vars = cargarEnv()
const SUPABASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')
const APP = (process.env.APP_URL ?? 'http://localhost:3117').replace(/\/+$/, '')
const CONSERVAR = process.argv.includes('--conservar')
const SOLO_LIMPIAR = process.argv.includes('--limpiar')

const SLUG_PLAN = 'qa-venta-m23'
const SLUG_CASA = 'qa-venta-casa'
const FRASE = 'QA · PRECIO DE PRUEBA'
const LINK = 'https://buy.stripe.com/test_qaventam23'
const SUB_VENCIDA = 'sub_qaventa_vencida'
const PRECIO = 349

const CORREO_ALUMNO = 'qa-alumno1@academia.vadai.com.mx'
const CORREO_VENCIDO = 'qa-alumno2@academia.vadai.com.mx'
const CORREO_ADMIN = 'qa-admin@academia.vadai.com.mx'

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

/** Los botones de suscribirse de una página: dónde están, su liga y su texto. */
function ctas(pagina) {
  const lista = []
  for (const m of pagina.matchAll(/<a\b[^>]*\bdata-cta="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const etiqueta = m[0].slice(0, m[0].indexOf('>'))
    const href = (etiqueta.match(/\bhref="([^"]*)"/)?.[1] ?? '').replace(/&amp;/g, '&')
    const texto = m[2].replace(/<!-- -->/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    lista.push({ lugar: m[1], href, texto, posicion: m.index })
  }
  return lista
}
const textoPlano = (pagina) => pagina.replace(/<!-- -->/g, '').replace(/&#x27;/g, "'").replace(/&amp;/g, '&')

// --- reporte -------------------------------------------------------------------------

const resultados = []
const afirmar = (grupo, descripcion, esperado, real) => resultados.push({ grupo, descripcion, esperado, real, ok: esperado === real })
function imprimir() {
  const porGrupo = new Map()
  for (const r of resultados) porGrupo.set(r.grupo, [...(porGrupo.get(r.grupo) ?? []), r])
  const ancho = Math.max(10, ...resultados.map((r) => r.descripcion.length))
  console.log('\n  PRUEBA DE LA PÁGINA DE VENTA — M23')
  console.log(`  App: ${APP}`)
  for (const [grupo, casos] of porGrupo) {
    console.log(`\n  ${grupo}\n  ${'─'.repeat(ancho + 30)}`)
    for (const c of casos) console.log(`  ${c.ok ? '✓' : '✗'}  ${c.descripcion.padEnd(ancho)}  ${c.ok ? String(c.real) : `esperado ${c.esperado}, obtuvo ${c.real}`}`)
  }
  const fallidas = resultados.filter((r) => !r.ok)
  console.log(`\n  ${'─'.repeat(ancho + 30)}`)
  console.log(fallidas.length === 0 && resultados.length > 0 ? `  M23 EN VERDE — ${resultados.length}/${resultados.length} aserciones pasaron.` : `  ${fallidas.length} de ${resultados.length} aserciones FALLARON.`)
  for (const f of fallidas) console.log(`    ${f.grupo} · ${f.descripcion}: esperado ${f.esperado}, obtuvo ${f.real}`)
  console.log('')
  return fallidas.length === 0
}

// --- base ------------------------------------------------------------------------------

const una = async (bd, sql, p = []) => (await bd.query(sql, p)).rows[0] ?? null

/** Solo lo suyo, por nombre exacto. */
async function purgar(bd) {
  await bd.query(`delete from academia.memberships where stripe_subscription_id = $1`, [SUB_VENCIDA])
  await bd.query(`delete from academia.membership_plans where slug = $1`, [SLUG_PLAN])
  await bd.query(`delete from academia.courses where slug = $1`, [SLUG_CASA])
}

async function sembrar(bd) {
  const casa = await una(
    bd,
    `insert into academia.courses (slug, title, course_type, status, certificate_enabled)
     values ($1, 'QA · Casa de la venta (test-venta-vaip)', 'evergreen', 'published', false) returning id`,
    [SLUG_CASA]
  )
  const plan = await una(
    bd,
    `insert into academia.membership_plans (slug, name, price_mxn, price_compare_mxn, tagline, status, stripe_payment_link, hub_course_id)
     values ($1, 'QA · Plan de la venta', $2, 499, $3, 'active', $4, $5) returning id`,
    [SLUG_PLAN, PRECIO, FRASE, LINK, casa.id]
  )
  // Un trigger ya mete la casa en los cursos del plan; esto es por si no.
  await bd.query(`insert into academia.membership_plan_courses (plan_id, course_id) values ($1, $2) on conflict do nothing`, [plan.id, casa.id])
  return { plan: plan.id, casa: casa.id }
}

// --- la prueba ---------------------------------------------------------------------------

const bd = await conectarPostgres(vars)
let verde = false
try {
  await purgar(bd)
  if (SOLO_LIMPIAR) {
    console.log('\n  Limpio: el plan, la casa y la suscripción de la suite.\n')
    verde = true
  } else {
    const ids = await sembrar(bd)

    // =========================================================================
    // 0. El servidor pinta el plan de la suite
    // =========================================================================
    const anonimo = await html('/vaip')
    if (!textoPlano(anonimo).includes(FRASE)) {
      throw new Error('/vaip no muestra el plan QA: arranca el servidor con VAIP_VENTA_DE_PRUEBA=qa-venta-m23.')
    }

    // =========================================================================
    // 1. Sin sesión
    // =========================================================================
    const A = 'Sin sesión'
    const botones = ctas(anonimo)
    const enContenido = botones.filter((b) => b.lugar !== 'barra')
    afirmar(A, 'entre 3 y 4 botones de suscribirse en la página', true, enContenido.length >= 3 && enContenido.length <= 4)
    afirmar(A, 'todos llevan al link de pago del plan', true, botones.length > 0 && botones.every((b) => b.href === LINK))
    afirmar(A, 'cada uno con su propio texto', enContenido.length, new Set(enContenido.map((b) => b.texto)).size)
    const hero = botones.find((b) => b.lugar === 'hero')
    afirmar(A, 'el primero es el del encabezado', 'hero', botones[0]?.lugar)
    afirmar(A, 'y va antes del primer título de sección', true, Boolean(hero) && hero.posicion < anonimo.indexOf('<h2'))
    afirmar(A, 'el encabezado invita a unirse', 'Unirme a V-AI-P', hero?.texto)
    // Solo en el HTML: el payload de React repite los atributos en un <script>.
    afirmar(A, 'hay una barra pegada abajo', 1, (anonimo.match(/<div\b[^>]*\bdata-barra-inferior/g) ?? []).length)
    afirmar(A, 'con su botón al mismo link', LINK, botones.find((b) => b.lugar === 'barra')?.href)
    afirmar(A, '«¿Ya eres miembro? Entra» lleva a entrar', true, anonimo.includes('href="/login?destino=%2Fvaip"'))
    // Sin comparación de precio (Alejandro, 20-oct-2026): ni cafés ni «al día».
    afirmar(A, 'sin comparaciones de precio', false, /café|al día|gasto hormiga/i.test(textoPlano(anonimo)))
    afirmar(A, 'el precio tachado y el que se cobra', true, textoPlano(anonimo).includes('$499') && textoPlano(anonimo).includes('MXN al mes'))
    afirmar(A, 'ningún botón vacío', 0, botones.filter((b) => !b.href || !b.texto).length)

    // =========================================================================
    // 2. Con sesión, sin membresía
    // =========================================================================
    const B = 'Con sesión, sin membresía'
    const sAlumno = await entrar(CORREO_ALUMNO)
    const alumno = await una(bd, `select user_id from academia.profiles where email = $1`, [CORREO_ALUMNO])
    const conSesion = await html('/vaip', sAlumno)
    const suyos = ctas(conSesion)
    const personalizado = (b) => {
      try {
        const u = new URL(b.href)
        return u.searchParams.get('prefilled_email') === CORREO_ALUMNO && u.searchParams.get('client_reference_id') === alumno.user_id
      } catch {
        return false
      }
    }
    afirmar(B, 'los botones llevan su correo y su cuenta', true, suyos.length > 0 && suyos.every(personalizado))
    afirmar(B, 'no le pregunta si ya es miembro', false, conSesion.includes('¿Ya eres miembro?'))

    // =========================================================================
    // 3. Fue miembro y su acceso terminó
    // =========================================================================
    const C = 'Miembro vencido'
    const vencido = await una(bd, `select user_id from academia.profiles where email = $1`, [CORREO_VENCIDO])
    await bd.query(
      `insert into academia.memberships (plan_id, user_id, email, stripe_subscription_id, status, access_until, ended_at)
       values ($1, $2, $3, $4, 'canceled', now() - interval '10 days', now() - interval '10 days')`,
      [ids.plan, vencido.user_id, CORREO_VENCIDO, SUB_VENCIDA]
    )
    const sVencido = await entrar(CORREO_VENCIDO)
    const paginaVencido = await html('/vaip', sVencido)
    const deVencido = ctas(paginaVencido)
    afirmar(C, 've la venta, no el muro', true, deVencido.length > 0)
    afirmar(C, 'el encabezado lo invita a volver', 'Volver a V-AI-P', deVencido.find((b) => b.lugar === 'hero')?.texto)
    afirmar(C, 'y le dice cuándo terminó', true, textoPlano(paginaVencido).includes('Tu membresía terminó el'))

    // =========================================================================
    // 4. El equipo ve el muro, no la venta
    // =========================================================================
    const D = 'Equipo'
    const sAdmin = await entrar(CORREO_ADMIN)
    afirmar(D, 'ningún botón de suscribirse', 0, ctas(await html('/vaip', sAdmin)).length)

    // =========================================================================
    // 5. La suscripción cerrada
    // =========================================================================
    const E = 'Cerrada'
    await bd.query(`update academia.membership_plans set stripe_payment_link = null where id = $1`, [ids.plan])
    const cerrada = await html('/vaip')
    afirmar(E, 'sin link no hay ningún botón', 0, ctas(cerrada).length)
    afirmar(E, 'ni barra', false, /<div\b[^>]*\bdata-barra-inferior/.test(cerrada))
    afirmar(E, 'y dice que abre muy pronto', true, cerrada.includes('La suscripción abre muy pronto.'))
    const otraPagina = await html(`/membresias/${SLUG_PLAN}`)
    afirmar(E, 'la página del plan tampoco ofrece pagar', 0, ctas(otraPagina).length)
    await bd.query(`update academia.membership_plans set stripe_payment_link = $2 where id = $1`, [ids.plan, LINK])
    const abierta = await html(`/membresias/${SLUG_PLAN}`)
    afirmar(E, 'abierta, la página del plan usa el mismo botón', LINK, ctas(abierta)[0]?.href)

    verde = imprimir()
    if (CONSERVAR) console.log('  --conservar: el plan QA queda armado para las capturas. Quítalo con --limpiar.\n')
  }
} catch (e) {
  afirmar('Suite', 'terminó sin detenerse', true, false)
  imprimir()
  console.error(`  La suite se detuvo: ${e.message}`)
} finally {
  if (!CONSERVAR) await purgar(bd).catch((e) => console.error(`  No se pudo limpiar: ${e.message}`))
  await bd.end()
  process.exit(verde ? 0 : 1)
}
