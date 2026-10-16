'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { generarSlug } from '@/lib/admin/esquemas'
import type { EstadoAccion } from '@/lib/admin/tipos'
import { exigirAdmin } from '@/lib/auth/sesion'
import { SLUG_VAIP } from '@/lib/membresia/consultas'
import { sincronizarPlan } from '@/lib/membresia/sincronizar'
import { apagarLinkDePago, publicarPlanEnStripe, stripeAdminConfigurado } from '@/lib/stripe/admin'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * Los planes desde el panel (M18): crearlos, editarlos, publicarlos en Stripe
 * y archivarlos. Solo admin: son cobros. Las escrituras en la base van con la
 * sesión del admin (RLS `is_admin()`); las de Stripe, por `lib/stripe/admin.ts`.
 */

function registrarFallo(operacion: string, detalle: Record<string, unknown>, error: string) {
  console.error(JSON.stringify({ operacion, ...detalle, error }))
}

const uuid = z.uuid('Dato inválido.')
const opcionalNumero = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : Number(v)))
  .refine((v) => v === null || (Number.isFinite(v) && v > 0), 'El precio tachado tiene que ser un número mayor a 0.')

const esquemaPlan = z
  .object({
    nombre: z.string().trim().min(3, 'El nombre necesita al menos 3 letras.').max(80, 'Hasta 80 caracteres.'),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]{2,40}$/, 'El slug: de 2 a 40 minúsculas, números o guiones.'),
    precio: z.coerce
      .number({ message: 'El precio tiene que ser un número.' })
      .positive('El precio tiene que ser mayor a 0.')
      .max(100000, 'Revisa el precio.'),
    tachado: opcionalNumero,
    frase: z.string().trim().max(140, 'La frase: hasta 140 caracteres.'),
    descripcion: z.string().trim().max(2000, 'La descripción: hasta 2000 caracteres.'),
    imagen: z
      .string()
      .trim()
      .refine((v) => v === '' || /^(https:\/\/|\/)/.test(v), 'La imagen: una URL https:// o una ruta que empiece con /.'),
    casa: z.union([z.literal(''), uuid]),
    cursos: z.array(uuid),
  })
  .refine((d) => d.tachado === null || d.tachado > d.precio, {
    message: 'El precio tachado tiene que ser mayor que el precio.',
    path: ['tachado'],
  })

function leer(datos: FormData) {
  const texto = (campo: string) => String(datos.get(campo) ?? '')
  const nombre = texto('nombre')
  return esquemaPlan.safeParse({
    nombre,
    slug: texto('slug') || generarSlug(nombre).slice(0, 40),
    precio: texto('precio'),
    tachado: texto('tachado'),
    frase: texto('frase'),
    descripcion: texto('descripcion'),
    imagen: texto('imagen'),
    casa: texto('casa'),
    cursos: datos.getAll('cursos').filter((v): v is string => typeof v === 'string'),
  })
}

function revalidarPlan(slug: string) {
  revalidatePath('/admin/vaip')
  revalidatePath('/admin/vaip/planes')
  revalidatePath('/admin/vaip/planes/[id]', 'page')
  revalidatePath(slug === SLUG_VAIP ? '/vaip' : `/membresias/${slug}`)
}

/**
 * Crea o guarda un plan. Los cursos se igualan a lo marcado (más la casa, que
 * siempre va). Si el plan ya está a la venta y ganó cursos, sus miembros los
 * reciben en ese momento, con su aviso por correo.
 */
export async function guardarPlan(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()
  const id = String(datos.get('id') ?? '')
  const r = leer(datos)
  if (!r.success) return { error: r.error.issues[0]?.message ?? 'Revisa los datos del plan.' }
  const d = r.data

  const supabase = await crearClienteServidor()
  const previo = id
    ? (await supabase.from('membership_plans').select('id, slug, status, stripe_product_id').eq('id', id).maybeSingle()).data
    : null
  if (id && !previo) return { error: 'Ese plan ya no existe.' }
  if (previo && previo.slug !== d.slug && (previo.stripe_product_id || previo.slug === SLUG_VAIP)) {
    return { error: 'El slug de un plan publicado no cambia: va en cada suscripción de Stripe.' }
  }

  const fila = {
    name: d.nombre,
    slug: d.slug,
    price_mxn: d.precio,
    price_compare_mxn: d.tachado,
    tagline: d.frase || null,
    description: d.descripcion || null,
    image_url: d.imagen || null,
    hub_course_id: d.casa || null,
  }
  const guardado = previo
    ? await supabase.from('membership_plans').update(fila).eq('id', previo.id).select('id').single()
    : await supabase.from('membership_plans').insert(fila).select('id').single()
  if (guardado.error || !guardado.data) {
    if (guardado.error?.code === '23505') return { error: `Ya hay un plan con el slug «${d.slug}».` }
    registrarFallo('guardarPlan', { id, slug: d.slug }, guardado.error?.message ?? 'sin id')
    return { error: 'No se pudo guardar el plan.' }
  }
  const planId = guardado.data.id

  // Los cursos: lo marcado, más la casa.
  const deseados = new Set([...d.cursos, ...(d.casa ? [d.casa] : [])])
  const { data: actuales } = await supabase.from('membership_plan_courses').select('course_id').eq('plan_id', planId)
  const tenia = new Set((actuales ?? []).map((a) => a.course_id))
  const agregar = [...deseados].filter((c) => !tenia.has(c))
  const quitar = [...tenia].filter((c) => !deseados.has(c))
  if (agregar.length > 0) {
    const { error } = await supabase
      .from('membership_plan_courses')
      .upsert(agregar.map((course_id) => ({ plan_id: planId, course_id })), { onConflict: 'plan_id,course_id', ignoreDuplicates: true })
    if (error) registrarFallo('guardarPlan:cursos', { planId }, error.message)
  }
  if (quitar.length > 0) {
    const { error } = await supabase.from('membership_plan_courses').delete().eq('plan_id', planId).in('course_id', quitar)
    if (error) registrarFallo('guardarPlan:quitarCursos', { planId }, error.message)
  }

  revalidarPlan(d.slug)
  if (!previo) redirect(`/admin/vaip/planes/${planId}?creado=1`)

  // A la venta y con cursos nuevos: los miembros actuales los reciben ya.
  if (previo.status === 'active' && agregar.length > 0) {
    const s = await sincronizarPlan(planId)
    return {
      aviso:
        s.nuevos > 0
          ? `Plan guardado. ${s.nuevos} accesos nuevos para los miembros, cada uno con su aviso por correo.`
          : 'Plan guardado. Los miembros ya estaban al día.',
    }
  }
  return {
    aviso: quitar.length > 0
      ? 'Plan guardado. A quien ya tenía los cursos que quitaste no se le corta: su acceso vence solo.'
      : 'Plan guardado.',
  }
}

/**
 * Publica el plan en Stripe (o lo pone al día): producto, precio, link de pago
 * y portal. Con precio nuevo, quien ya paga sigue con el suyo y el link cambia.
 */
export async function publicarPlan(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()
  const id = String(datos.get('id') ?? '')
  if (!uuid.safeParse(id).success) return { error: 'Plan inválido.' }
  if (!stripeAdminConfigurado()) {
    return { error: 'Falta la llave del panel (STRIPE_ADMIN_KEY) en el servidor. Ver docs/M18.md.' }
  }

  const supabase = await crearClienteServidor()
  const { data: plan } = await supabase
    .from('membership_plans')
    .select(
      'id, slug, name, description, image_url, price_mxn, stripe_product_id, stripe_price_id, stripe_payment_link_id, stripe_portal_config_id'
    )
    .eq('id', id)
    .maybeSingle()
  if (!plan) return { error: 'Ese plan ya no existe.' }
  const { count } = await supabase
    .from('membership_plan_courses')
    .select('course_id', { count: 'exact', head: true })
    .eq('plan_id', id)
  if (!count) return { error: 'Agrega al menos un curso antes de ponerlo a la venta: el pago tiene que dar algo.' }

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '')
  const pagina = plan.slug === SLUG_VAIP ? '/vaip' : `/membresias/${plan.slug}`
  const imagen = plan.image_url?.startsWith('/') ? `${base}${plan.image_url}` : plan.image_url

  let r
  try {
    r = await publicarPlanEnStripe(
      {
        id: plan.id,
        slug: plan.slug,
        nombre: plan.name,
        descripcion: plan.description,
        // Stripe solo acepta imágenes públicas por https.
        imagen: imagen?.startsWith('https://') ? imagen : null,
        precioMxn: Number(plan.price_mxn),
        stripe_product_id: plan.stripe_product_id,
        stripe_price_id: plan.stripe_price_id,
        stripe_payment_link_id: plan.stripe_payment_link_id,
        stripe_portal_config_id: plan.stripe_portal_config_id,
      },
      {
        gracias: `${base}${pagina}/gracias?session_id={CHECKOUT_SESSION_ID}`,
        volverAlPerfil: `${base}/perfil/membresia?plan=${plan.slug}`,
      }
    )
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error)
    registrarFallo('publicarPlan', { id }, mensaje)
    return { error: `Stripe no aceptó la publicación: ${mensaje}` }
  }

  const { error } = await supabase
    .from('membership_plans')
    .update({
      status: 'active',
      stripe_product_id: r.productId,
      stripe_price_id: r.priceId,
      stripe_payment_link: r.linkUrl,
      stripe_payment_link_id: r.linkId,
      stripe_portal_config_id: r.portalId,
      portal_login_url: r.portalUrl,
    })
    .eq('id', id)
  if (error) {
    registrarFallo('publicarPlan:guardar', { id, ...r }, error.message)
    return { error: 'Quedó publicado en Stripe pero no se guardó aquí. Vuelve a publicar: no se duplica nada.' }
  }
  if (r.precioNuevo) {
    const { error: errorPrecio } = await supabase
      .from('membership_plan_prices')
      .upsert({ stripe_price_id: r.priceId, plan_id: id, amount_mxn: Number(plan.price_mxn) }, { onConflict: 'stripe_price_id' })
    if (errorPrecio) registrarFallo('publicarPlan:historial', { id, precio: r.priceId }, errorPrecio.message)
  }

  revalidarPlan(plan.slug)
  return {
    aviso:
      r.precioNuevo && plan.stripe_price_id
        ? 'Publicado con el precio nuevo. Quien ya pagaba sigue con su precio. El link de pago cambió; el QR de la página no.'
        : 'Publicado en Stripe. El link de pago ya cobra.',
  }
}

/** Saca un plan de venta: apaga su link. Quien ya paga sigue dentro y sigue pagando. */
export async function archivarPlan(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()
  const id = String(datos.get('id') ?? '')
  if (!uuid.safeParse(id).success) return { error: 'Plan inválido.' }
  const supabase = await crearClienteServidor()
  const { data: plan } = await supabase
    .from('membership_plans')
    .select('id, slug, stripe_payment_link_id')
    .eq('id', id)
    .maybeSingle()
  if (!plan) return { error: 'Ese plan ya no existe.' }
  if (plan.slug === SLUG_VAIP) {
    return { error: 'V-AI-P no se archiva desde aquí: su página y el espacio de los miembros dependen de él.' }
  }

  if (plan.stripe_payment_link_id) {
    try {
      await apagarLinkDePago(plan.stripe_payment_link_id, plan.slug)
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error)
      registrarFallo('archivarPlan', { id }, mensaje)
      return { error: `No se pudo apagar el link en Stripe: ${mensaje}` }
    }
  }
  const { error } = await supabase.from('membership_plans').update({ status: 'archived' }).eq('id', id)
  if (error) {
    registrarFallo('archivarPlan:guardar', { id }, error.message)
    return { error: 'El link quedó apagado, pero el plan no se marcó como archivado. Inténtalo otra vez.' }
  }
  revalidarPlan(plan.slug)
  return { aviso: 'Plan archivado. El link ya no cobra; quien ya pagaba sigue dentro.' }
}
