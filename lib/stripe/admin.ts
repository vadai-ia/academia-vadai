import 'server-only'

import Stripe from 'stripe'

import { crearClienteStripe } from '@/lib/stripe/cliente'

import { MARCA_PLAN, MARCA_PLAN_ID } from '@/lib/membresia/stripe'
import { feedbackDe, type MOTIVOS } from '@/lib/membresia/motivos'

/**
 * Lo único de la academia que ESCRIBE en Stripe (M18): crear y publicar los
 * planes desde el panel, y cancelar o seguir una membresía desde la plataforma.
 *
 * Usa `STRIPE_ADMIN_KEY`, una llave restringida aparte de la del webhook
 * (que sigue siendo de solo lectura). Lo que este archivo usa, y nada más:
 *   Products, Prices, Payment Links, Customer portal y Subscriptions en Write.
 * La llave tiene permisos más amplios por decisión de Alejandro (16-oct-2026,
 * para reusarla); `node scripts/stripe-verificar-llave.mjs` lo reporta.
 *
 * La cuenta es COMPARTIDA con otros negocios de VADAI. Por eso:
 *   - nada se busca "por nombre" en la cuenta: cada objeto se crea una vez, con
 *     `idempotencyKey`, y su id se guarda en la base;
 *   - una suscripción solo se toca si su metadata dice que es de este plan y es
 *     del mismo cliente que la membresía de quien la pide;
 *   - nunca se toca un ajuste de toda la cuenta (el portal es una configuración
 *     PROPIA, no la default).
 *
 * `STRIPE_ADMIN_SIMULADO` (solo para las suites) manda todo a un Stripe falso
 * en localhost, con una llave falsa: la llave real nunca sale hacia allá.
 */

/**
 * Un plan QA (slug `qa-…`) nunca toca el Stripe real, igual que un correo QA
 * nunca sale (lib/correo/resend.ts): si una suite corre contra un servidor
 * levantado sin el Stripe simulado, esto la detiene antes de crear nada.
 */
function exigirSimuladoParaQa(slug: string): void {
  if (slug.startsWith('qa-') && !process.env.STRIPE_ADMIN_SIMULADO) {
    throw new Error('Un plan QA nunca se publica en el Stripe real (falta STRIPE_ADMIN_SIMULADO).')
  }
}

export function stripeAdminConfigurado(): boolean {
  return Boolean(process.env.STRIPE_ADMIN_KEY || process.env.STRIPE_ADMIN_SIMULADO)
}

export function crearClienteStripeAdmin(): Stripe {
  const simulado = process.env.STRIPE_ADMIN_SIMULADO
  if (simulado) {
    const url = new URL(simulado)
    if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      throw new Error('STRIPE_ADMIN_SIMULADO solo puede apuntar a localhost.')
    }
    return new Stripe('rk_test_simulado', {
      host: url.hostname,
      port: Number(url.port),
      protocol: 'http',
      maxNetworkRetries: 0,
    })
  }
  const llave = process.env.STRIPE_ADMIN_KEY
  if (!llave) throw new Error('Falta STRIPE_ADMIN_KEY: la llave restringida del panel (ver docs/M18.md).')
  // Un reintento: con idempotencyKey no duplica nada, y sin él un corte de red
  // dejaría el plan a medio publicar.
  return new Stripe(llave, { maxNetworkRetries: 1 })
}

// ==========================================================================
// Publicar un plan
// ==========================================================================

export type PlanParaPublicar = {
  id: string
  slug: string
  nombre: string
  descripcion: string | null
  /** URL absoluta (https) de la imagen, o null. */
  imagen: string | null
  precioMxn: number
  stripe_product_id: string | null
  stripe_price_id: string | null
  stripe_payment_link_id: string | null
  stripe_portal_config_id: string | null
}

export type PlanPublicado = {
  productId: string
  priceId: string
  /** El precio cambió: hay que guardarlo en el historial. */
  precioNuevo: boolean
  linkId: string
  linkUrl: string
  portalId: string
  portalUrl: string | null
}

/**
 * Crea o pone al día en Stripe el producto, el precio, el link de pago y el
 * portal propio de un plan. Se puede correr las veces que sea:
 *
 *   - el producto se crea una vez y después solo se actualiza;
 *   - en Stripe un precio no se edita: si el monto cambió se crea uno nuevo y
 *     el viejo se archiva. Quien ya paga sigue con el suyo;
 *   - un link de pago no cambia de precio: con precio nuevo hay link nuevo y el
 *     viejo se apaga. Por eso el QR impreso apunta a la página, nunca al link.
 */
export async function publicarPlanEnStripe(
  plan: PlanParaPublicar,
  urls: { gracias: string; volverAlPerfil: string }
): Promise<PlanPublicado> {
  exigirSimuladoParaQa(plan.slug)
  const stripe = crearClienteStripeAdmin()
  const marca = { [MARCA_PLAN]: plan.slug, [MARCA_PLAN_ID]: plan.id }
  const centavos = Math.round(plan.precioMxn * 100)

  // Si lo guardado no existe en la cuenta de esta llave —se cambió la llave del
  // panel a otra cuenta de Stripe (20-oct-2026)—, el plan se publica de cero
  // aquí en vez de fallar con «No such product».
  const guardadoAqui = plan.stripe_product_id
    ? await existe(() => stripe.products.retrieve(plan.stripe_product_id as string))
    : false
  if (plan.stripe_product_id && !guardadoAqui) {
    plan = { ...plan, stripe_product_id: null, stripe_price_id: null, stripe_payment_link_id: null, stripe_portal_config_id: null }
  }

  // 1. El producto.
  const datosProducto = {
    name: plan.nombre,
    description: plan.descripcion ?? undefined,
    images: plan.imagen ? [plan.imagen] : undefined,
    metadata: marca,
  }
  const producto = plan.stripe_product_id
    ? await stripe.products.update(plan.stripe_product_id, { ...datosProducto, active: true })
    : await stripe.products.create(datosProducto, { idempotencyKey: `academia-plan-${plan.id}-producto` })
  await exigirMismaCuentaQueElWebhook(stripe, producto.id)

  // 2. El precio: se conserva si cobra lo mismo.
  const previo = plan.stripe_price_id ? await stripe.prices.retrieve(plan.stripe_price_id) : null
  const mismoPrecio =
    previo !== null &&
    previo.unit_amount === centavos &&
    previo.currency === 'mxn' &&
    previo.recurring?.interval === 'month'
  const precio = mismoPrecio
    ? previo
    : await stripe.prices.create(
        {
          product: producto.id,
          unit_amount: centavos,
          currency: 'mxn',
          recurring: { interval: 'month' },
          nickname: `${plan.nombre} · mensual`,
          metadata: marca,
        },
        // Con el precio anterior en la llave: volver a un monto que ya se usó
        // (349 → 399 → 349) crea un precio nuevo, no devuelve el archivado.
        { idempotencyKey: `academia-plan-${plan.id}-precio-${centavos}-desde-${plan.stripe_price_id ?? 'nada'}` }
      )
  if (!mismoPrecio && previo?.active) await stripe.prices.update(previo.id, { active: false })

  // 3. El link de pago.
  let link: Stripe.PaymentLink
  if (mismoPrecio && plan.stripe_payment_link_id) {
    link = await stripe.paymentLinks.update(plan.stripe_payment_link_id, { active: true, metadata: marca })
  } else {
    link = await stripe.paymentLinks.create(
      {
        line_items: [{ price: precio.id, quantity: 1 }],
        metadata: marca,
        subscription_data: { metadata: marca },
        after_completion: { type: 'redirect', redirect: { url: urls.gracias } },
        allow_promotion_codes: false,
        payment_method_types: ['card'],
      },
      { idempotencyKey: `academia-plan-${plan.id}-link-${precio.id}` }
    )
    if (plan.stripe_payment_link_id) {
      await stripe.paymentLinks.update(plan.stripe_payment_link_id, { active: false })
    }
  }

  // 4. El portal propio: tarjeta y facturas. Cancelar se hace en la plataforma,
  //    donde la persona ve lo que pierde y deja su motivo (decidido 16-oct-2026).
  const ajustesDelPortal = {
    business_profile: { headline: `${plan.nombre} · Tu tarjeta y tus cobros` },
    features: {
      customer_update: { enabled: false },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: false },
      subscription_update: { enabled: false },
    },
    login_page: { enabled: true },
    default_return_url: urls.volverAlPerfil,
    metadata: marca,
  }
  const portal = plan.stripe_portal_config_id
    ? await stripe.billingPortal.configurations.update(plan.stripe_portal_config_id, ajustesDelPortal)
    : await stripe.billingPortal.configurations.create(ajustesDelPortal, {
        idempotencyKey: `academia-plan-${plan.id}-portal`,
      })

  return {
    productId: producto.id,
    priceId: precio.id,
    precioNuevo: !mismoPrecio,
    linkId: link.id,
    linkUrl: link.url,
    portalId: portal.id,
    portalUrl: portal.login_page?.url ?? null,
  }
}

/** ¿Existe en esta cuenta? null/false si Stripe dice 404 (resource_missing). */
async function existe(pedir: () => Promise<unknown>): Promise<boolean> {
  try {
    await pedir()
    return true
  } catch (e) {
    if (e instanceof Stripe.errors.StripeError && (e.statusCode === 404 || e.code === 'resource_missing')) return false
    throw e
  }
}

/**
 * La llave del panel tiene que ser de la MISMA cuenta de Stripe que la del
 * webhook (20-oct-2026): se publicó el plan con una llave de otra cuenta y, de
 * haberse abierto la venta, el dinero habría caído en esa otra cuenta y la
 * academia nunca se habría enterado del pago. Se comprueba leyendo el producto
 * recién creado con la llave del webhook; si no lo ve, se archiva y se detiene.
 * Si esa llave no puede leer productos (403), no se puede comprobar y se sigue.
 */
async function exigirMismaCuentaQueElWebhook(stripe: Stripe, productoId: string): Promise<void> {
  if (process.env.STRIPE_ADMIN_SIMULADO) return
  try {
    await crearClienteStripe().products.retrieve(productoId)
  } catch (e) {
    if (e instanceof Stripe.errors.StripeError && (e.statusCode === 404 || e.code === 'resource_missing')) {
      await stripe.products.update(productoId, { active: false })
      throw new Error(
        'la llave del panel (STRIPE_ADMIN_KEY) es de otra cuenta de Stripe que la del webhook (STRIPE_SECRET_KEY). Los pagos no llegarían a la academia: crea la llave del panel en la cuenta VADAI (docs/M18.md).'
      )
    }
    console.error(JSON.stringify({ operacion: 'stripe:mismaCuenta', productoId, error: e instanceof Error ? e.message : String(e) }))
  }
}

/** Apaga el link de pago de un plan archivado. Quien ya paga sigue pagando. */
export async function apagarLinkDePago(linkId: string, slug: string): Promise<void> {
  exigirSimuladoParaQa(slug)
  await crearClienteStripeAdmin().paymentLinks.update(linkId, { active: false })
}

// ==========================================================================
// Cancelar o seguir
// ==========================================================================

/**
 * La suscripción, solo si de verdad es de este plan y de este cliente. El id
 * sale de `memberships` de quien la pide, nunca de un formulario; aun así se
 * comprueba en Stripe, porque la cuenta es de varios negocios.
 */
export async function suscripcionDelPlan(
  subscriptionId: string,
  plan: { id: string; slug: string },
  clienteEsperado: string | null
): Promise<Stripe.Subscription | null> {
  const sub = await crearClienteStripeAdmin().subscriptions.retrieve(subscriptionId)
  const marca = sub.metadata?.[MARCA_PLAN] ?? null
  const marcaId = sub.metadata?.[MARCA_PLAN_ID] ?? null
  const cliente = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const esDelPlan = marcaId === plan.id || marca === plan.slug
  if (!esDelPlan || (clienteEsperado !== null && cliente !== clienteEsperado)) return null
  return sub
}

/** Cancela al final del periodo pagado, con el motivo, también en Stripe. */
export async function cancelarAlFinalDelPeriodo(
  subscriptionId: string,
  motivo: (typeof MOTIVOS)[number]['clave'],
  comentario: string | null
): Promise<Stripe.Subscription> {
  return crearClienteStripeAdmin().subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
    cancellation_details: { feedback: feedbackDe(motivo), comment: comentario ?? undefined },
  })
}

/** «Seguir con mi membresía»: deshace la cancelación mientras el periodo siga vigente. */
export async function seguirConLaMembresia(subscriptionId: string): Promise<Stripe.Subscription> {
  return crearClienteStripeAdmin().subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
    cancellation_details: { feedback: '', comment: '' },
  })
}
