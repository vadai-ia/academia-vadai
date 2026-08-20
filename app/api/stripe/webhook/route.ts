import { NextResponse, type NextRequest } from 'next/server'
import type Stripe from 'stripe'

import { crearClienteStripe, secretoDeWebhook } from '@/lib/stripe/cliente'
import { darDeAlta, revocarPorReembolso } from '@/lib/stripe/provisioning'
import { crearClienteServiceRole } from '@/lib/supabase/service-role'

/**
 * Webhook de Stripe (§7.1).
 *
 * ⚠️ ESTA CUENTA DE STRIPE ES COMPARTIDA con otros negocios de VADAI (Maive,
 * Zlip, Conti papelería…). Este endpoint recibe los `checkout.session.completed`
 * de TODOS ellos, no solo los de la academia.
 *
 * Por eso la primera pregunta de cada evento no es "¿qué hago?" sino "¿esto es
 * mío?". El discriminante es `metadata.course_id` del Payment Link, que Stripe
 * propaga a la sesión. Sin esa marca, el evento se ignora y se responde 200:
 * es de otro negocio y no hay nada que hacer. Sin esta guardia, alguien
 * comprando Zlip dispararía un alta en la academia.
 *
 * Es la misma disciplina que la Regla Cero, aplicada a Stripe.
 */

/** El cuerpo crudo es obligatorio para verificar la firma. */
export const dynamic = 'force-dynamic'

function log(operacion: string, detalle: Record<string, unknown>) {
  console.log(JSON.stringify({ operacion, ...detalle }))
}

/**
 * Idempotencia (§7.1): la PK de `stripe_events` es el propio `event.id`, así que
 * un reenvío choca contra la llave primaria. Devuelve true si es la primera vez.
 */
async function marcarProcesado(evento: Stripe.Event): Promise<boolean> {
  const supabase = crearClienteServiceRole()
  const { error } = await supabase
    .from('stripe_events')
    .insert({ event_id: evento.id, event_type: evento.type })

  if (!error) return true

  // 23505 = unique_violation. Ya se procesó: no es un fallo.
  if (error.code === '23505') {
    log('webhook:duplicado', { evento: evento.id, tipo: evento.type })
    return false
  }

  log('webhook:errorIdempotencia', { evento: evento.id, error: error.message })
  // Ante la duda se procesa: perder un alta es peor que intentarla dos veces,
  // porque el alta en sí es idempotente.
  return true
}

async function manejarCompra(sesion: Stripe.Checkout.Session) {
  const courseId = sesion.metadata?.course_id

  // ¿Es nuestro? Ver el comentario de arriba.
  if (!courseId) {
    log('webhook:ajeno', { sesion: sesion.id, motivo: 'sin metadata.course_id' })
    return
  }

  // Con métodos asíncronos (OXXO, SPEI) la sesión se completa ANTES de que
  // exista el dinero. Hoy solo se acepta tarjeta, pero la guardia queda: sin
  // ella, activar OXXO algún día regalaría cursos a quien genere un voucher y
  // nunca lo pague.
  if (sesion.payment_status !== 'paid') {
    log('webhook:sinPagar', {
      sesion: sesion.id,
      estado: sesion.payment_status,
    })
    return
  }

  const email = sesion.customer_details?.email ?? sesion.customer_email
  if (!email) {
    log('webhook:sinCorreo', { sesion: sesion.id })
    return
  }

  // El schema solo admite mxn y usd (§4). Otra moneda con nuestro course_id
  // significa que un Payment Link quedó mal configurado, y provisionar sobre un
  // cobro que no entendemos es peor que no hacerlo: el pago sigue visible en
  // Stripe y en el admin, y el alta manual lo resuelve (§11).
  const moneda = (sesion.currency ?? '').toLowerCase()
  if (moneda !== 'mxn' && moneda !== 'usd') {
    log('webhook:monedaInesperada', { sesion: sesion.id, moneda })
    return
  }

  const supabase = crearClienteServiceRole()

  // El pago se registra ANTES del alta. Si el alta falla, el pago queda visible
  // en el admin y Alejandro puede dar de alta a mano: es el respaldo de §11.
  const { error: errorPago } = await supabase.from('payments').upsert(
    {
      email,
      course_id: courseId,
      stripe_session_id: sesion.id,
      stripe_payment_intent:
        typeof sesion.payment_intent === 'string'
          ? sesion.payment_intent
          : (sesion.payment_intent?.id ?? null),
      amount: (sesion.amount_total ?? 0) / 100,
      currency: moneda,
      status: 'paid',
    },
    { onConflict: 'stripe_session_id' }
  )

  if (errorPago) {
    log('webhook:pagoNoRegistrado', { sesion: sesion.id, error: errorPago.message })
  }

  const alta = await darDeAlta({
    email,
    nombre: sesion.customer_details?.name ?? null,
    courseId,
    cohortId: sesion.metadata?.cohort_id ?? null,
    origen: 'stripe',
    urlRedireccion: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/nueva-contrasena`,
  })

  if (!alta.ok) {
    log('webhook:altaFallida', { sesion: sesion.id, email, motivo: alta.motivo })
    return
  }

  // Ya con el user_id, se enlaza el pago a la persona.
  if (alta.userId) {
    await supabase
      .from('payments')
      .update({ user_id: alta.userId })
      .eq('stripe_session_id', sesion.id)
  }

  log('webhook:altaOk', { sesion: sesion.id, email, cuentaNueva: alta.creado })
}

async function manejarReembolso(cargo: Stripe.Charge) {
  const intento = typeof cargo.payment_intent === 'string' ? cargo.payment_intent : null
  if (!intento) {
    log('webhook:reembolsoSinIntento', { cargo: cargo.id })
    return
  }

  const supabase = crearClienteServiceRole()

  // Segunda guardia de cuenta compartida: si el intento no está en nuestros
  // pagos, el reembolso es de otro negocio.
  const { data: pago } = await supabase
    .from('payments')
    .select('email, course_id')
    .eq('stripe_payment_intent', intento)
    .maybeSingle()

  if (!pago) {
    log('webhook:reembolsoAjeno', { cargo: cargo.id, intento })
    return
  }

  await supabase
    .from('payments')
    .update({ status: 'refunded' })
    .eq('stripe_payment_intent', intento)

  await revocarPorReembolso(pago.email, pago.course_id)

  log('webhook:reembolsoProcesado', { cargo: cargo.id, email: pago.email })
}

export async function POST(request: NextRequest) {
  const firma = request.headers.get('stripe-signature')
  if (!firma) {
    return NextResponse.json({ error: 'Falta la firma.' }, { status: 400 })
  }

  // Cuerpo crudo, sin parsear: cualquier reserialización invalida la firma.
  const crudo = await request.text()

  let evento: Stripe.Event
  try {
    const stripe = crearClienteStripe()
    evento = stripe.webhooks.constructEvent(crudo, firma, secretoDeWebhook())
  } catch (error) {
    // Firma inválida: o alguien está intentando falsificar eventos, o el secret
    // no corresponde a este endpoint. En ninguno de los dos casos se procesa.
    log('webhook:firmaInvalida', {
      error: error instanceof Error ? error.message : 'desconocido',
    })
    return NextResponse.json({ error: 'Firma inválida.' }, { status: 400 })
  }

  if (!(await marcarProcesado(evento))) {
    return NextResponse.json({ recibido: true, duplicado: true })
  }

  try {
    switch (evento.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await manejarCompra(evento.data.object)
        break

      case 'charge.refunded':
        await manejarReembolso(evento.data.object)
        break

      default:
        // Suscritos pero sin acción propia: async_payment_failed y
        // charge.dispute.created quedan registrados en stripe_events, que es
        // suficiente para auditar.
        log('webhook:sinManejador', { tipo: evento.type, evento: evento.id })
    }
  } catch (error) {
    log('webhook:excepcion', {
      evento: evento.id,
      tipo: evento.type,
      error: error instanceof Error ? error.message : 'desconocido',
    })
    // 500 hace que Stripe reintente. El alta es idempotente, así que reintentar
    // es seguro y preferible a perder una compra.
    return NextResponse.json({ error: 'Error al procesar.' }, { status: 500 })
  }

  return NextResponse.json({ recibido: true })
}
