#!/usr/bin/env node
/**
 * test-stripe.mjs — Criterio de cierre de M9.
 *
 * Prueba el webhook firmando eventos sintéticos con el `whsec_` REAL y
 * mandándolos al endpoint. Es mejor que un pago de prueba: cubre los caminos que
 * un pago feliz nunca ejerce —firma inválida, evento duplicado, evento de otro
 * negocio, sesión sin pagar— y no mueve un peso.
 *
 * La cuenta de Stripe está en modo LIVE y es compartida con otros negocios de
 * VADAI, así que esos caminos no son hipotéticos: son el día a día del endpoint.
 *
 *   PORT=3117 pnpm start
 *   node scripts/test-stripe.mjs
 */

import { createHmac } from 'node:crypto'

import { cargarEnv, conectarPostgres, exigir } from './lib/entorno.mjs'
import { IDS } from './lib/qa.mjs'

const vars = cargarEnv()
const SUPABASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')
const SECRETO = exigir(vars, 'STRIPE_WEBHOOK_SECRET')
const APP = (process.env.APP_URL ?? 'http://localhost:3117').replace(/\/+$/, '')

const CORREO_QA = 'qa-stripe@academia.vadai.com.mx'
const RUTA = '/api/stripe/webhook'

// --- firma de Stripe -------------------------------------------------------

/**
 * Esquema de firma de Stripe: `t=<epoch>,v1=<hmac_sha256(t + "." + cuerpo)>`.
 * Es lo mismo que hace Stripe al enviar, así que `constructEvent` la acepta.
 */
function firmar(cuerpo, secreto, epoch = Math.floor(Date.now() / 1000)) {
  const hmac = createHmac('sha256', secreto).update(`${epoch}.${cuerpo}`).digest('hex')
  return `t=${epoch},v1=${hmac}`
}

let contador = 0
function evento(tipo, objeto) {
  contador += 1
  return {
    id: `evt_qa_${Date.now()}_${contador}`,
    object: 'event',
    type: tipo,
    api_version: '2026-04-22.dahlia',
    created: Math.floor(Date.now() / 1000),
    data: { object: objeto },
  }
}

async function enviar(cuerpoObjeto, { firmaMala = false } = {}) {
  const cuerpo = JSON.stringify(cuerpoObjeto)
  const firma = firmaMala ? firmar(cuerpo, 'whsec_secreto_incorrecto') : firmar(cuerpo, SECRETO)

  const respuesta = await fetch(`${APP}${RUTA}`, {
    method: 'POST',
    headers: { 'stripe-signature': firma, 'content-type': 'application/json' },
    body: cuerpo,
  })

  return { status: respuesta.status, cuerpo: await respuesta.json().catch(() => ({})) }
}

// --- constructores de payload ---------------------------------------------

function sesion({ id, courseId, email, estado = 'paid', moneda = 'mxn', intento }) {
  return {
    id,
    object: 'checkout.session',
    amount_total: 1499900,
    currency: moneda,
    payment_status: estado,
    payment_intent: intento,
    customer_details: { email, name: 'QA Stripe' },
    customer_email: email,
    metadata: courseId ? { course_id: courseId } : {},
  }
}

const cargo = (intento) => ({
  id: `ch_qa_${Date.now()}`,
  object: 'charge',
  payment_intent: intento,
  refunded: true,
})

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
  console.log('  PRUEBA DE STRIPE — M9')
  console.log(`  App: ${APP}`)

  for (const [grupo, casos] of porGrupo) {
    console.log('')
    console.log(`  ${grupo}`)
    console.log('  ' + '─'.repeat(ancho + 32))
    for (const c of casos) {
      console.log(
        `  ${c.ok ? '✓' : '✗'}  ${c.descripcion.padEnd(ancho)}  ` +
          (c.ok ? String(c.real) : `esperado ${c.esperado}, obtuvo ${c.real}`)
      )
    }
  }

  const fallidas = resultados.filter((r) => !r.ok)
  console.log('')
  console.log('  ' + '─'.repeat(ancho + 32))
  console.log(
    fallidas.length === 0
      ? `  M9 EN VERDE — ${resultados.length}/${resultados.length} aserciones pasaron.`
      : `  ${fallidas.length} de ${resultados.length} aserciones FALLARON.`
  )
  for (const f of fallidas) {
    console.log(`    ${f.grupo} · ${f.descripcion}: esperado ${f.esperado}, obtuvo ${f.real}`)
  }
  console.log('')
  return fallidas.length === 0
}

// --- limpieza --------------------------------------------------------------

async function purgar(bd) {
  await bd.query(`delete from academia.payments where email = $1`, [CORREO_QA])
  await bd.query(`delete from academia.stripe_events where event_id like 'evt_qa_%'`)
  await bd.query(`delete from academia.profiles where email = $1`, [CORREO_QA])

  const lista = await (
    await fetch(`${SUPABASE}/auth/v1/admin/users?per_page=200`, {
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
    })
  ).json()

  const usuario = (lista.users ?? []).find((u) => u.email?.toLowerCase() === CORREO_QA)
  if (usuario) {
    await fetch(`${SUPABASE}/auth/v1/admin/users/${usuario.id}`, {
      method: 'DELETE',
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
    })
  }
}

// --- main ------------------------------------------------------------------

async function main() {
  const bd = await conectarPostgres(vars)

  try {
    await purgar(bd)

    // ==================================================================
    const G1 = 'SEGURIDAD DE LA FIRMA'

    const mala = await enviar(
      evento('checkout.session.completed', sesion({ id: 'cs_qa_mala', courseId: IDS.curso, email: CORREO_QA })),
      { firmaMala: true }
    )
    afirmar(G1, 'firma incorrecta se rechaza', 400, mala.status)

    const sinFirma = await fetch(`${APP}${RUTA}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    afirmar(G1, 'sin firma se rechaza', 400, sinFirma.status)

    const { rows: trasRechazo } = await bd.query(
      `select count(*)::int n from academia.profiles where email = $1`,
      [CORREO_QA]
    )
    afirmar(G1, 'nada se creó con firma mala', 0, trasRechazo[0].n)

    // ==================================================================
    // La guardia de cuenta compartida: eventos de Maive, Zlip, etc.
    const G2 = 'CUENTA COMPARTIDA'

    const ajeno = await enviar(
      evento(
        'checkout.session.completed',
        sesion({ id: 'cs_qa_ajeno', courseId: null, email: 'cliente@otronegocio.com' })
      )
    )
    afirmar(G2, 'evento sin course_id se acepta', 200, ajeno.status)

    const { rows: pagosAjenos } = await bd.query(
      `select count(*)::int n from academia.payments where email = 'cliente@otronegocio.com'`
    )
    afirmar(G2, 'pero NO crea nada nuestro', 0, pagosAjenos[0].n)

    const monedaRara = await enviar(
      evento(
        'checkout.session.completed',
        sesion({ id: 'cs_qa_eur', courseId: IDS.curso, email: CORREO_QA, moneda: 'eur' })
      )
    )
    afirmar(G2, 'moneda fuera de mxn/usd se ignora', 200, monedaRara.status)

    const { rows: trasEur } = await bd.query(
      `select count(*)::int n from academia.payments where email = $1`,
      [CORREO_QA]
    )
    afirmar(G2, 'y tampoco provisiona', 0, trasEur[0].n)

    // ==================================================================
    const G3 = 'SESIÓN SIN PAGAR (guardia de OXXO/SPEI)'

    await enviar(
      evento(
        'checkout.session.completed',
        sesion({ id: 'cs_qa_unpaid', courseId: IDS.curso, email: CORREO_QA, estado: 'unpaid' })
      )
    )
    const { rows: trasUnpaid } = await bd.query(
      `select count(*)::int n from academia.enrollments e
         join academia.profiles p on p.user_id = e.user_id where p.email = $1`,
      [CORREO_QA]
    )
    afirmar(G3, 'payment_status unpaid no da acceso', 0, trasUnpaid[0].n)

    // ==================================================================
    // El camino feliz: el criterio literal de M9.
    const G4 = 'COMPRA REAL → CUENTA E INSCRIPCIÓN'

    const INTENTO = `pi_qa_${Date.now()}`
    const SESION = `cs_qa_ok_${Date.now()}`
    const compra = evento(
      'checkout.session.completed',
      sesion({ id: SESION, courseId: IDS.curso, email: CORREO_QA, intento: INTENTO })
    )

    // Curso base (20-sep-2026): mientras dura esta compra, el curso ajeno QA
    // es "base" y el alta debe inscribir ahí también. Se apaga en cuanto se
    // comprueba; el seed lo apaga igual por si esto revienta a medias.
    await bd.query(`update academia.courses set is_default = true where id = $1`, [IDS.cursoAjeno])

    const respuesta = await enviar(compra)
    afirmar(G4, 'el webhook responde 200', 200, respuesta.status)

    await bd.query(`update academia.courses set is_default = false where id = $1`, [IDS.cursoAjeno])

    const { rows: perfil } = await bd.query(
      `select user_id, role from academia.profiles where email = $1`,
      [CORREO_QA]
    )
    afirmar(G4, 'se creó el perfil', 1, perfil.length)
    afirmar(G4, 'con rol alumno', 'alumno', perfil[0]?.role)

    const { rows: inscripcion } = await bd.query(
      `select e.status, e.source, e.expires_at from academia.enrollments e
        where e.user_id = $1 and e.course_id = $2`,
      [perfil[0]?.user_id, IDS.curso]
    )
    afirmar(G4, 'se creó la inscripción', 1, inscripcion.length)
    afirmar(G4, 'activa', 'active', inscripcion[0]?.status)
    afirmar(G4, 'con origen stripe', 'stripe', inscripcion[0]?.source)
    afirmar(G4, 'de por vida (access_days null)', null, inscripcion[0]?.expires_at)

    const { rows: base } = await bd.query(
      `select status, source from academia.enrollments where user_id = $1 and course_id = $2`,
      [perfil[0]?.user_id, IDS.cursoAjeno]
    )
    afirmar(G4, 'también quedó en el curso base', 1, base.length)
    afirmar(G4, 'con el mismo origen', 'stripe', base[0]?.source)

    const { rows: pago } = await bd.query(
      `select status, amount, currency, user_id from academia.payments where stripe_session_id = $1`,
      [SESION]
    )
    afirmar(G4, 'se registró el pago', 1, pago.length)
    afirmar(G4, 'con el monto correcto', '14999.00', pago[0]?.amount)
    afirmar(G4, 'enlazado a la cuenta', perfil[0]?.user_id, pago[0]?.user_id)

    // ==================================================================
    const G5 = 'IDEMPOTENCIA'

    const repetido = await enviar(compra)
    afirmar(G5, 'el reenvío se acepta', 200, repetido.status)
    afirmar(G5, 'y se marca duplicado', true, repetido.cuerpo?.duplicado === true)

    // Solo se cuentan los cursos QA: el comprado y el base de arriba. Los
    // cursos base REALES de producción ("Academia VADAI") también inscriben a
    // este alumno QA, y cuántos haya no es asunto de esta prueba. El alumno se
    // purga al final, con todo y esas inscripciones.
    const { rows: sinDuplicar } = await bd.query(
      `select count(*)::int n from academia.enrollments e
         join academia.profiles p on p.user_id = e.user_id
        where p.email = $1 and e.course_id = any($2::uuid[])`,
      [CORREO_QA, [IDS.curso, IDS.cursoAjeno]]
    )
    afirmar(G5, 'no duplicó la inscripción', 2, sinDuplicar[0].n)

    // ==================================================================
    const G6 = 'REEMBOLSO'

    const ajenoRefund = await enviar(evento('charge.refunded', cargo('pi_de_otro_negocio')))
    afirmar(G6, 'reembolso ajeno se ignora', 200, ajenoRefund.status)

    await enviar(evento('charge.refunded', cargo(INTENTO)))

    const { rows: pagoTras } = await bd.query(
      `select status from academia.payments where stripe_session_id = $1`,
      [SESION]
    )
    afirmar(G6, 'el pago queda reembolsado', 'refunded', pagoTras[0]?.status)

    const { rows: inscripcionTras } = await bd.query(
      `select status from academia.enrollments where user_id = $1 and course_id = $2`,
      [perfil[0]?.user_id, IDS.curso]
    )
    afirmar(G6, 'el acceso queda revocado', 'revoked', inscripcionTras[0]?.status)

    await purgar(bd)
  } finally {
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
