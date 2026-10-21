#!/usr/bin/env node
/**
 * test-accesos.mjs — Criterio de cierre de M25, parte A: los correos de acceso.
 *
 * Pedido de Alejandro (20-oct-2026):
 *   - el recordatorio «Mandar a quien falta» solo va a quien nunca entró y
 *     tiene un curso o generación ACTIVA (en curso, por empezar, V-AI-P
 *     vigente); una generación terminada o solo el curso base no cuentan;
 *   - toda alta manda su acceso: cuenta nueva o que nunca entró → bienvenida
 *     con liga; ya entró → curso nuevo; Gen 1 → Gen 2 → «Ya estás en la
 *     Generación N» (misma inscripción, conserva su avance);
 *   - cada correo queda en la bitácora, y lo que falla se ve y se reenvía.
 *
 *   PORT=3141 pnpm start            (con la migración 0047 aplicada)
 *   pnpm qa:mostrar
 *   APP_URL=http://localhost:3141 node scripts/test-accesos.mjs
 *   pnpm qa:esconder
 *
 * La base es la de producción. Todo es QA: el curso `qa-accesos`, las cuentas
 * `qa-acc-*@academia.vadai.com.mx` y el admin `qa-admin`. A las cuentas QA el
 * correo NUNCA se les manda (lib/correo/resend.ts las corta) y su fila queda
 * `omitido`: por eso aquí se afirma la DECISIÓN —tipo, liga, cursos,
 * generación— y no la entrega. «Enviado» y «fallido» se prueban en la parte
 * unitaria, con el módulo de decisión real y sin red.
 *
 * `--limpiar` solo borra lo de la suite.
 */

import { cargarEnv, conectarPostgres, exigir } from './lib/entorno.mjs'
import { CLAVE_QA } from './lib/qa.mjs'

const vars = cargarEnv()
const SUPABASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')
const APP = (process.env.APP_URL ?? 'http://localhost:3141').replace(/\/+$/, '')
const SOLO_LIMPIAR = process.argv.includes('--limpiar')

const CURSO = 'qa-accesos'
const CORREO_ADMIN = 'qa-admin@academia.vadai.com.mx'
const C = (k) => `qa-acc-${k}@academia.vadai.com.mx`
const CUENTAS = [
  'proxima', 'terminada', 'base', 'miembro', 'vencido', 'revocado', 'entro',
  'nuevo', 'invitado', 'entro2', 'mover1', 'mover2', 'mover3', 'csv1', 'csv2',
]

const cabecerasAdmin = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' }

// ============================================================================
// Sesión, formularios y reporte (como las demás suites)
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
    headers: cabecerasAdmin,
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

/** El primer `<form>` que cumple `prueba`, con sus campos ocultos (como sin JS). */
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
async function enviarFormulario(ruta, campos, frasco, archivo) {
  const cuerpo = new FormData()
  for (const [nombre, valor] of Object.entries(campos ?? {})) {
    for (const v of Array.isArray(valor) ? valor : [valor]) cuerpo.append(nombre, v)
  }
  if (archivo) cuerpo.append(archivo.campo, archivo.blob, archivo.nombre)
  return pedir(ruta, frasco, { method: 'POST', body: cuerpo })
}

const resultados = []
const afirmar = (grupo, descripcion, esperado, real) => resultados.push({ grupo, descripcion, esperado, real, ok: esperado === real })
function imprimir() {
  const porGrupo = new Map()
  for (const r of resultados) porGrupo.set(r.grupo, [...(porGrupo.get(r.grupo) ?? []), r])
  const ancho = Math.max(10, ...resultados.map((r) => r.descripcion.length))
  console.log('\n  PRUEBA DE CORREOS DE ACCESO — M25')
  console.log(`  App: ${APP}`)
  for (const [grupo, casos] of porGrupo) {
    console.log(`\n  ${grupo}\n  ${'─'.repeat(ancho + 30)}`)
    for (const c of casos) console.log(`  ${c.ok ? '✓' : '✗'}  ${c.descripcion.padEnd(ancho)}  ${c.ok ? String(c.real) : `esperado ${c.esperado}, obtuvo ${c.real}`}`)
  }
  const fallidas = resultados.filter((r) => !r.ok)
  console.log(`\n  ${'─'.repeat(ancho + 30)}`)
  console.log(fallidas.length === 0 && resultados.length > 0 ? `  M25 (accesos) EN VERDE — ${resultados.length}/${resultados.length} aserciones pasaron.` : `  ${fallidas.length} de ${resultados.length} aserciones FALLARON.`)
  for (const f of fallidas) console.log(`    ${f.grupo} · ${f.descripcion}: esperado ${f.esperado}, obtuvo ${f.real}`)
  console.log('')
  return fallidas.length === 0 && resultados.length > 0
}

const una = async (bd, sql, p = []) => (await bd.query(sql, p)).rows[0] ?? null
const varias = async (bd, sql, p = []) => (await bd.query(sql, p)).rows

/** Una consulta como el admin QA, con su RLS: así la lee la app. */
async function comoAdmin(bd, adminId, sql, p = []) {
  await bd.query('begin')
  try {
    await bd.query('set local role authenticated')
    await bd.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: adminId, role: 'authenticated' })])
    return (await bd.query(sql, p)).rows
  } finally {
    await bd.query('rollback')
  }
}

// ============================================================================
// Cuentas y montaje: solo lo de la suite, por marca exacta
// ============================================================================

async function buscarCuenta(email) {
  const r = await fetch(`${SUPABASE}/auth/v1/admin/users?filter=${encodeURIComponent(email)}&per_page=200`, { headers: cabecerasAdmin })
  const cuerpo = await r.json().catch(() => ({}))
  return (cuerpo.users ?? []).find((u) => (u.email ?? '').toLowerCase() === email.toLowerCase()) ?? null
}
async function borrarCuentaQa(email) {
  const usuario = await buscarCuenta(email)
  if (!usuario) return
  await fetch(`${SUPABASE}/auth/v1/admin/users/${usuario.id}`, { method: 'DELETE', headers: cabecerasAdmin })
}
async function crearCuentaQa(email, nombre) {
  const r = await fetch(`${SUPABASE}/auth/v1/admin/users`, {
    method: 'POST',
    headers: cabecerasAdmin,
    body: JSON.stringify({ email, password: CLAVE_QA, email_confirm: true, user_metadata: { full_name: nombre, qa: true } }),
  })
  const cuerpo = await r.json()
  if (!r.ok) throw new Error(`No se pudo crear ${email}: ${cuerpo.msg ?? cuerpo.message ?? r.status}`)
  return cuerpo.id
}

async function purgar(bd) {
  const inicio = await una(bd, `select id from academia.profiles where email = $1`, [CORREO_ADMIN])
  // Lo que el recordatorio de la suite le anotó a OTRAS cuentas QA.
  if (inicio) {
    await bd.query(
      `delete from academia.access_emails where es_qa and creado_por = $1 and origen in ('recordatorio', 'reenvio_fallidos') and created_at > now() - interval '2 hours'`,
      [inicio.id]
    )
  }
  for (const k of CUENTAS) {
    const p = await una(bd, `select user_id from academia.profiles where email = $1`, [C(k)])
    if (p) {
      await bd.query(`delete from academia.lesson_progress where user_id = $1`, [p.user_id])
      await bd.query(`delete from academia.enrollments where user_id = $1`, [p.user_id])
    }
    await borrarCuentaQa(C(k))
    await bd.query(`delete from academia.profiles where email = $1`, [C(k)])
  }
  const curso = await una(bd, `select id from academia.courses where slug = $1`, [CURSO])
  if (curso) {
    await bd.query(`delete from academia.enrollments where course_id = $1`, [curso.id])
    await bd.query(`delete from academia.lessons where module_id in (select id from academia.modules where course_id = $1)`, [curso.id])
    await bd.query(`delete from academia.modules where course_id = $1`, [curso.id])
    await bd.query(`delete from academia.cohorts where course_id = $1`, [curso.id])
    await bd.query(`delete from academia.courses where id = $1`, [curso.id])
  }
}

async function montar(bd) {
  const curso = await una(
    bd,
    `insert into academia.courses (slug, title, course_type, status, access_days, is_default, in_catalog)
     values ($1, 'QA Accesos', 'cohort', 'published', null, false, false) returning id`,
    [CURSO]
  )
  const hoy = `(now() at time zone 'America/Mexico_City')::date`
  const gen = async (nombre, desde, hasta, abierta) =>
    (
      await una(
        bd,
        `insert into academia.cohorts (course_id, name, starts_on, ends_on, open_for_enrollment)
         values ($1, $2, ${hoy} + $3::int, ${hoy} + $4::int, $5) returning id`,
        [curso.id, nombre, desde, hasta, abierta]
      )
    ).id
  const terminada = await gen('QA Generación 1 · terminada', -40, -1, false)
  const proxima = await gen('QA Generación 2 · próxima', 15, 30, true)
  const miembros = await una(
    bd,
    `insert into academia.cohorts (course_id, name, starts_on, ends_on, open_for_enrollment)
     values ($1, 'QA Miembros', ${hoy} - 10, null, false) returning id`,
    [curso.id]
  )
  const modulo = await una(
    bd,
    `insert into academia.modules (course_id, title, position, cohort_id) values ($1, 'QA módulo', 1, $2) returning id`,
    [curso.id, terminada]
  )
  const leccion = await una(
    bd,
    `insert into academia.lessons (module_id, title, position, lesson_type, status, is_required) values ($1, 'QA lección', 1, 'text', 'published', true) returning id`,
    [modulo.id]
  )
  const base = await una(bd, `select id from academia.courses where is_default and status = 'published' order by created_at limit 1`)

  const ids = {}
  for (const k of CUENTAS.filter((x) => !['nuevo', 'csv1', 'csv2'].includes(x))) {
    ids[k] = await crearCuentaQa(C(k), `QA Acc ${k}`)
    await bd.query(
      `insert into academia.profiles (user_id, email, full_name, role, status, last_sign_in_at)
       values ($1, $2, $3, $4, 'active', $5)
       on conflict (user_id) do update set role = excluded.role, last_sign_in_at = excluded.last_sign_in_at`,
      [ids[k], C(k), `QA Acc ${k}`, k === 'invitado' ? 'invitado' : 'alumno', ['entro', 'entro2', 'mover3'].includes(k) ? new Date().toISOString() : null]
    )
  }
  const inscribir = (k, cohorte, extra = {}) =>
    bd.query(
      `insert into academia.enrollments (user_id, course_id, cohort_id, source, status, expires_at)
       values ($1, $2, $3, 'manual', $4, $5)`,
      [ids[k], extra.curso ?? curso.id, cohorte, extra.status ?? 'active', extra.expira ?? null]
    )
  await inscribir('proxima', proxima)
  await inscribir('terminada', terminada)
  if (base) await inscribir('base', null, { curso: base.id })
  await inscribir('miembro', miembros.id, { expira: new Date(Date.now() + 20 * 86_400_000).toISOString() })
  await inscribir('vencido', proxima, { expira: new Date(Date.now() - 86_400_000).toISOString() })
  await inscribir('revocado', proxima, { status: 'revoked' })
  await inscribir('entro', proxima)
  await inscribir('mover1', terminada)
  await inscribir('mover2', terminada)
  await inscribir('mover3', terminada)
  await bd.query(
    `insert into academia.lesson_progress (user_id, lesson_id, completed, seconds_watched, completed_at) values ($1, $2, true, 60, now())`,
    [ids.mover1, leccion.id]
  )
  return { curso: curso.id, terminada, proxima, miembros: miembros.id, leccion: leccion.id, ids, base: base?.id ?? null }
}

/** Las filas de la bitácora de una persona, de la más nueva a la más vieja. */
const bitacora = (bd, userId) =>
  varias(
    bd,
    `select tipo, origen, estado, motivo, con_enlace, access_link_id, course_ids, cohort_id, lote_id, es_qa
       from academia.access_emails where user_id = $1 order by created_at desc`,
    [userId]
  )
const idDe = async (bd, email) => (await una(bd, `select user_id from academia.profiles where email = $1`, [email]))?.user_id ?? null

// ============================================================================
// 1. La regla, sin red: el módulo de decisión REAL
// ============================================================================

async function parteUnitaria() {
  const G = 'Decisión (sin red)'
  const d = await import('../lib/correo/decision.ts')
  const base = { userId: 'u', email: 'a@b.com', nombre: null, cuentaNueva: false, yaEntro: false, cursosNuevos: [], generacionesNuevas: [], sinCambio: [] }
  const curso = [{ id: 'c1', titulo: 'Curso' }]
  const gen = [{ cursoId: 'c1', cursoTitulo: 'Curso', cursoSlug: 'curso', cohorteId: 'g2', nombre: 'Generación 2 · nov 2026', startsOn: null, endsOn: null, anterior: 'Generación 1' }]
  const t = (c) => d.decidirCorreo({ ...base, ...c })

  afirmar(G, 'cuenta nueva → bienvenida con liga', 'bienvenida/true', `${t({ cuentaNueva: true }).tipo}/${t({ cuentaNueva: true }).conEnlace}`)
  afirmar(G, 'cuenta nueva sin curso (encuesta) → bienvenida', 'bienvenida', t({ cuentaNueva: true }).tipo)
  afirmar(G, 'existía y nunca entró + curso nuevo → bienvenida', 'bienvenida/true', `${t({ cursosNuevos: curso }).tipo}/${t({ cursosNuevos: curso }).conEnlace}`)
  afirmar(G, 'ya entró + curso nuevo → curso nuevo sin liga', 'nuevo_curso/false', `${t({ yaEntro: true, cursosNuevos: curso }).tipo}/${t({ yaEntro: true, cursosNuevos: curso }).conEnlace}`)
  afirmar(G, 'cambio de generación sin haber entrado → con liga', 'nueva_generacion/true', `${t({ generacionesNuevas: gen }).tipo}/${t({ generacionesNuevas: gen }).conEnlace}`)
  afirmar(G, 'cambio de generación ya entró → sin liga', 'nueva_generacion/false', `${t({ yaEntro: true, generacionesNuevas: gen }).tipo}/${t({ yaEntro: true, generacionesNuevas: gen }).conEnlace}`)
  afirmar(G, 'el cambio de generación gana a un curso nuevo', 'nueva_generacion', t({ cursosNuevos: curso, generacionesNuevas: gen }).tipo)
  afirmar(G, 'nada cambió → ningún correo', null, t({ sinCambio: curso }).tipo)
  afirmar(G, 'reenvío forzado → bienvenida aunque ya entró', 'bienvenida', t({ yaEntro: true, forzar: 'bienvenida' }).tipo)
  afirmar(G, 'recordatorio forzado → recordatorio con liga', 'recordatorio/true', `${t({ forzar: 'recordatorio' }).tipo}/${t({ forzar: 'recordatorio' }).conEnlace}`)

  const junto = d.juntarCambios({ ...base, cuentaNueva: true, cursosNuevos: curso }, { ...base, cursosNuevos: [{ id: 'c2', titulo: 'Otro' }] })
  afirmar(G, 'dos cursos de la misma persona → un correo que nombra los dos', 'Curso, Otro', d.titulosDelCambio(junto).join(', '))

  const ok = d.repartirLote(['a@x.com', 'b@x.com'], { ok: true, ids: ['re_1', 're_2'] })
  afirmar(G, 'lote aceptado → enviado con su id, en orden', 'enviado:re_1,enviado:re_2', ok.map((r) => `${r.estado}:${r.id}`).join(','))
  const mal = d.repartirLote(['a@x.com', 'b@x.com'], { ok: false, motivo: 'HTTP 422' })
  afirmar(G, 'lote rechazado → todos fallidos con el motivo', 'fallido:HTTP 422,fallido:HTTP 422', mal.map((r) => `${r.estado}:${r.motivo}`).join(','))
  afirmar(G, 'una dirección mal escrita se separa antes del lote', false, d.direccionValida('juan@empresa'))
  afirmar(G, 'una dirección buena pasa', true, d.direccionValida('juan@empresa.com'))

  const resumen = d.resumenDeAvisos({
    ...d.conteoVacio(),
    fallidos: [{ email: 'x@y.com', motivo: 'rebote' }],
    sinCambio: 2,
    sinCambioSinEntrar: 1,
  })
  afirmar(G, 'el resumen enumera a quién no le salió, con su motivo', 'x@y.com (rebote)', resumen.lista[0])
  afirmar(G, 'el resumen dice cuántos nunca han entrado de los sin cambio', true, resumen.resumen.includes('1 nunca ha entrado'))
}

// ============================================================================
// Principal
// ============================================================================

async function principal() {
  const bd = await conectarPostgres(vars)
  try {
    await purgar(bd)
    if (SOLO_LIMPIAR) {
      console.log('  Limpio: lo de test-accesos se borró.')
      return true
    }

    await parteUnitaria()

    const tabla = await una(bd, `select to_regclass('academia.access_emails') is not null as hay`)
    if (!tabla.hay) {
      afirmar('Montaje', 'la migración 0047 está aplicada', true, false)
      return imprimir()
    }

    const m = await montar(bd)
    const admin = await una(bd, `select user_id from academia.profiles where email = $1`, [CORREO_ADMIN])
    const sAdmin = await entrar(CORREO_ADMIN)

    // ------------------------------------------------------------------
    // 2. A quién le toca el recordatorio
    // ------------------------------------------------------------------
    const G2 = 'Recordatorio: solo cursos y generaciones activas'
    const porActivar = new Set(
      (await comoAdmin(bd, admin.user_id, `select user_id from academia.academia_por_activar(true)`)).map((r) => r.user_id)
    )
    afirmar(G2, 'entra quien está en una generación por empezar', true, porActivar.has(m.ids.proxima))
    afirmar(G2, 'entra un miembro con acceso vigente (sin fecha de fin)', true, porActivar.has(m.ids.miembro))
    afirmar(G2, 'NO entra quien es de una generación terminada', false, porActivar.has(m.ids.terminada))
    afirmar(G2, 'NO entra quien solo tiene el curso base', false, porActivar.has(m.ids.base))
    afirmar(G2, 'NO entra quien tiene la inscripción vencida', false, porActivar.has(m.ids.vencido))
    afirmar(G2, 'NO entra quien tiene la inscripción revocada', false, porActivar.has(m.ids.revocado))
    afirmar(G2, 'NO entra quien ya entró', false, porActivar.has(m.ids.entro))
    afirmar(G2, 'NO entra un invitado de encuesta', false, porActivar.has(m.ids.invitado))
    const reales = await comoAdmin(
      bd,
      admin.user_id,
      `select count(*)::int n from academia.academia_por_activar(false) where email ~* '^qa-.*@academia\\.vadai\\.com\\.mx$'`
    )
    afirmar(G2, 'el modo real nunca cuenta una cuenta QA', 0, reales[0].n)
    const alumnoLee = await comoAdmin(bd, m.ids.proxima, `select count(*)::int n from academia.academia_por_activar(true)`)
    afirmar(G2, 'un alumno no lee la lista (guarda de equipo)', 0, alumnoLee[0].n)

    const esperados = await comoAdmin(
      bd,
      admin.user_id,
      `select count(*)::int n from academia.academia_por_activar(true) where ultimo_enlace is null or ultimo_enlace < now() - interval '24 hours'`
    )
    const pagina = await html('/admin/alumnos', sAdmin)
    const numeroBoton = Number(pagina.match(/data-recordatorio="(\d+)"/)?.[1] ?? -1)
    afirmar(G2, 'el número del botón es el que la base dice', esperados[0].n, numeroBoton)

    const formRecordar = formularioDonde(pagina, (f) => f.includes('data-recordatorio'))
    const r1 = await enviarFormulario('/admin/alumnos', formRecordar, sAdmin)
    await r1.text()
    const deProxima = await bitacora(bd, m.ids.proxima)
    afirmar(G2, 'quien le toca queda con su recordatorio en la bitácora', 'recordatorio/recordatorio/omitido/qa', deProxima[0] ? `${deProxima[0].tipo}/${deProxima[0].origen}/${deProxima[0].estado}/${deProxima[0].motivo}` : 'nada')
    afirmar(G2, 'el recordatorio lleva su liga de 30 días', true, Boolean(deProxima[0]?.con_enlace && deProxima[0]?.access_link_id))
    afirmar(G2, 'el miembro vigente también lo recibe', 1, (await bitacora(bd, m.ids.miembro)).length)
    const sinNada = await varias(
      bd,
      `select count(*)::int n from academia.access_emails where user_id = any($1::uuid[])`,
      [[m.ids.terminada, m.ids.base, m.ids.vencido, m.ids.revocado, m.ids.entro, m.ids.invitado]]
    )
    afirmar(G2, 'a los que no les toca no se les anota nada', 0, sinNada[0].n)

    const r2 = await enviarFormulario('/admin/alumnos', formularioDonde(await html('/admin/alumnos', sAdmin), (f) => f.includes('data-recordatorio')), sAdmin)
    await r2.text()
    afirmar(G2, 'un segundo clic no repite a nadie (24 h)', 1, (await bitacora(bd, m.ids.proxima)).length)

    // ------------------------------------------------------------------
    // 3. Toda alta manda su acceso
    // ------------------------------------------------------------------
    const G3 = 'Altas: a cada quien su correo'
    const formAlta = () =>
      html('/admin/alumnos', sAdmin).then((p) =>
        formularioDonde(p, (f) => f.includes('name="email"') && f.includes('name="accesos"') && !f.includes('type="file"') && !f.includes('name="rol"'))
      )
    const altaManual = async (email, gen) => {
      const r = await enviarFormulario('/admin/alumnos', { ...(await formAlta()), email, nombre: '', accesos: `${m.curso}|${gen}` }, sAdmin)
      return r.text()
    }

    const pNuevo = await altaManual(C('nuevo'), m.proxima)
    const idNuevo = await idDe(bd, C('nuevo'))
    const bNuevo = idNuevo ? await bitacora(bd, idNuevo) : []
    afirmar(G3, 'alta nueva → bienvenida con liga', 'bienvenida/true', bNuevo[0] ? `${bNuevo[0].tipo}/${bNuevo[0].con_enlace}` : 'nada')
    afirmar(G3, 'alta nueva → anotada como alta manual, omitida por ser QA', 'alta_manual/omitido', bNuevo[0] ? `${bNuevo[0].origen}/${bNuevo[0].estado}` : 'nada')
    afirmar(G3, 'alta nueva → anota el curso', m.curso, bNuevo[0]?.course_ids?.[0] ?? null)
    afirmar(G3, 'el aviso dice que es cuenta de prueba', true, pNuevo.includes('cuenta de prueba'))

    await altaManual(C('invitado'), m.proxima)
    const bInv = await bitacora(bd, m.ids.invitado)
    afirmar(G3, 'invitado de encuesta → bienvenida con liga (no «curso nuevo»)', 'bienvenida/true', bInv[0] ? `${bInv[0].tipo}/${bInv[0].con_enlace}` : 'nada')
    afirmar(G3, 'invitado de encuesta → pasa a alumno', 'alumno', (await una(bd, `select role from academia.profiles where user_id = $1`, [m.ids.invitado]))?.role)

    await altaManual(C('entro2'), m.proxima)
    const bEntro = await bitacora(bd, m.ids.entro2)
    afirmar(G3, 'quien ya entró → curso nuevo sin liga', 'nuevo_curso/false', bEntro[0] ? `${bEntro[0].tipo}/${bEntro[0].con_enlace}` : 'nada')

    const filasAntes = bNuevo.length
    const pMisma = await altaManual(C('nuevo'), m.proxima)
    afirmar(G3, 'misma generación otra vez → ningún correo nuevo', filasAntes, (await bitacora(bd, idNuevo)).length)
    afirmar(G3, 'y el aviso lo dice', true, pMisma.includes('no cambió nada'))

    // Gen 1 → Gen 2, por los tres caminos.
    const G4 = 'Gen 1 → Gen 2: se mueve y se le avisa'
    await altaManual(C('mover1'), m.proxima)
    const ins1 = await varias(bd, `select cohort_id from academia.enrollments where user_id = $1 and course_id = $2`, [m.ids.mover1, m.curso])
    afirmar(G4, 'alta manual: sigue habiendo UNA inscripción', 1, ins1.length)
    afirmar(G4, 'alta manual: ahora en la Gen 2', m.proxima, ins1[0]?.cohort_id ?? null)
    afirmar(G4, 'alta manual: su avance sigue ahí', 1, (await una(bd, `select count(*)::int n from academia.lesson_progress where user_id = $1 and lesson_id = $2`, [m.ids.mover1, m.leccion])).n)
    const b1 = await bitacora(bd, m.ids.mover1)
    afirmar(G4, 'alta manual: «nueva generación» con liga (nunca entró)', 'nueva_generacion/true', b1[0] ? `${b1[0].tipo}/${b1[0].con_enlace}` : 'nada')
    afirmar(G4, 'alta manual: anota la generación nueva', m.proxima, b1[0]?.cohort_id ?? null)

    const pCurso = await html(`/admin/cursos/${m.curso}?gen=${m.proxima}&buscar=qa-acc-mover2`, sAdmin)
    afirmar(G4, 'la pestaña de la Gen 2 ofrece a quien está en la Gen 1', true, pCurso.includes(C('mover2')) && pCurso.includes('se cambia a la que elijas'))
    const formCurso = formularioDonde(pCurso, (f) => f.includes('name="user_ids"'))
    const rCurso = await enviarFormulario(`/admin/cursos/${m.curso}?gen=${m.proxima}`, { ...formCurso, cohort_id: m.proxima, user_ids: m.ids.mover2 }, sAdmin)
    await rCurso.text()
    const ins2 = await varias(bd, `select cohort_id from academia.enrollments where user_id = $1 and course_id = $2`, [m.ids.mover2, m.curso])
    afirmar(G4, 'desde el curso: una inscripción, en la Gen 2', `1/${m.proxima}`, `${ins2.length}/${ins2[0]?.cohort_id}`)
    const b2 = await bitacora(bd, m.ids.mover2)
    afirmar(G4, 'desde el curso: «nueva generación», origen curso', 'nueva_generacion/curso', b2[0] ? `${b2[0].tipo}/${b2[0].origen}` : 'nada')

    const pFicha = await html(`/admin/alumnos/${m.ids.mover3}`, sAdmin)
    const formFicha = formularioDonde(pFicha, (f) => f.includes('name="user_id"') && f.includes('name="accesos"'))
      ?? formularioDonde(pFicha, (f) => f.includes('name="user_id"') && f.includes('Dar acceso'))
    const rFicha = await enviarFormulario(`/admin/alumnos/${m.ids.mover3}`, { ...(formFicha ?? {}), user_id: m.ids.mover3, accesos: `${m.curso}|${m.proxima}` }, sAdmin)
    await rFicha.text()
    const b3 = await bitacora(bd, m.ids.mover3)
    afirmar(G4, 'desde la ficha: «nueva generación» sin liga (ya entró)', 'nueva_generacion/false/ficha', b3[0] ? `${b3[0].tipo}/${b3[0].con_enlace}/${b3[0].origen}` : 'nada')
    afirmar(G4, 'desde la ficha: en la Gen 2', m.proxima, (await una(bd, `select cohort_id from academia.enrollments where user_id = $1 and course_id = $2`, [m.ids.mover3, m.curso]))?.cohort_id)

    // El Excel.
    const G5 = 'Excel: una fila por persona'
    const pAlumnos = await html('/admin/alumnos', sAdmin)
    const formArchivo = formularioDonde(pAlumnos, (f) => f.includes('type="file"') && f.includes('name="archivo"'))
    const csv = `Nombre,Correo\nQA Csv Uno,${C('csv1')}\nQA Csv Dos,${C('csv2')}\n`
    const rCsv = await enviarFormulario('/admin/alumnos', { ...formArchivo, accesos: `${m.curso}|${m.proxima}` }, sAdmin, {
      campo: 'archivo',
      blob: new Blob([csv], { type: 'text/csv' }),
      nombre: 'qa-accesos.csv',
    })
    const pCsv = await rCsv.text()
    const id1 = await idDe(bd, C('csv1'))
    const id2 = await idDe(bd, C('csv2'))
    const c1 = id1 ? await bitacora(bd, id1) : []
    const c2 = id2 ? await bitacora(bd, id2) : []
    afirmar(G5, 'cada fila nueva → su bienvenida con liga', 'bienvenida/true|bienvenida/true', `${c1[0]?.tipo}/${c1[0]?.con_enlace}|${c2[0]?.tipo}/${c2[0]?.con_enlace}`)
    afirmar(G5, 'anotadas como Excel, en el mismo lote', true, c1[0]?.origen === 'alta_masiva' && Boolean(c1[0]?.lote_id) && c1[0]?.lote_id === c2[0]?.lote_id)
    afirmar(G5, 'el resultado cuenta las cuentas nuevas', true, pCsv.includes('2 cuentas nuevas'))

    // ------------------------------------------------------------------
    // 4. Lo que no salió se ve y se reenvía
    // ------------------------------------------------------------------
    const G6 = 'Correos que no salieron'
    await bd.query(
      `insert into academia.access_emails (user_id, email, tipo, origen, estado, motivo, es_qa, creado_por, created_at)
       values ($1, $2, 'bienvenida', 'alta_manual', 'fallido', 'QA: rebote simulado', true, $3, now() - interval '5 minutes'),
              ($4, $5, 'bienvenida', 'alta_manual', 'pendiente', null, true, $3, now() - interval '30 minutes')`,
      [m.ids.terminada, C('terminada'), admin.user_id, m.ids.base, C('base')]
    )
    const pendientes = new Set(
      (await comoAdmin(bd, admin.user_id, `select user_id from academia.academia_correos_por_reintentar(true)`)).map((r) => r.user_id)
    )
    afirmar(G6, 'un fallido cuenta', true, pendientes.has(m.ids.terminada))
    afirmar(G6, 'un pendiente de más de 15 min cuenta', true, pendientes.has(m.ids.base))
    afirmar(G6, 'uno que salió no cuenta', false, pendientes.has(m.ids.proxima))

    const pFallos = await html('/admin/alumnos', sAdmin)
    afirmar(G6, 'Alumnos enseña la tarjeta con cuántos', true, Number(pFallos.match(/data-correos-fallidos="(\d+)"/)?.[1] ?? 0) >= 2)
    afirmar(G6, 'la tarjeta nombra a quién', true, pFallos.includes(C('terminada')) && pFallos.includes(C('base')))
    const pLista = await html(`/admin/alumnos?q=${encodeURIComponent('qa-acc-terminada')}`, sAdmin)
    afirmar(G6, 'la lista marca «Correo falló»', true, pLista.includes('data-correo-fallo'))
    const pFichaB = await html(`/admin/alumnos/${m.ids.terminada}`, sAdmin)
    afirmar(G6, 'la ficha enseña el correo que falló con su motivo', true, pFichaB.includes('data-estado="fallido"') && pFichaB.includes('QA: rebote simulado'))
    afirmar(G6, 'la ficha ofrece «Reintentar»', true, pFichaB.includes('Reintentar'))

    const formReenviar = formularioDonde(pFallos, (f) => f.includes('Reenviar') && !f.includes('name="email"') && !f.includes('data-recordatorio'))
    const rReenviar = await enviarFormulario('/admin/alumnos', formReenviar, sAdmin)
    await rReenviar.text()
    const bB = await bitacora(bd, m.ids.terminada)
    afirmar(G6, 'Reenviar deja un correo nuevo, del mismo tipo', 'bienvenida/reenvio_fallidos/omitido', bB[0] ? `${bB[0].tipo}/${bB[0].origen}/${bB[0].estado}` : 'nada')
    const despues = new Set(
      (await comoAdmin(bd, admin.user_id, `select user_id from academia.academia_correos_por_reintentar(true)`)).map((r) => r.user_id)
    )
    afirmar(G6, 'y ya no aparece entre los que no salieron', false, despues.has(m.ids.terminada) || despues.has(m.ids.base))
    afirmar(G6, 'un alumno no lee la bitácora (RLS)', 0, (await comoAdmin(bd, m.ids.proxima, `select count(*)::int n from academia.access_emails`))[0].n)

    return imprimir()
  } finally {
    if (!SOLO_LIMPIAR && !process.argv.includes('--conservar')) await purgar(bd).catch((e) => console.error('limpieza:', e.message))
    await bd.end()
  }
}

principal()
  .then((ok) => process.exit(ok ? 0 : 1))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
