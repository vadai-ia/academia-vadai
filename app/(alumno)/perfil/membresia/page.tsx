import type { Metadata } from 'next'
import Link from 'next/link'

import { EncabezadoPerfil } from '@/components/alumno/encabezado-perfil'
import { LogoVaip } from '@/components/marca/logo-vaip'
import { Tarjeta } from '@/components/ui-vadai/superficie'
import { TuMembresia, fechaLarga } from '@/components/vaip/tu-membresia'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { exigirPerfil } from '@/lib/auth/sesion'
import { cancelarMembresia, reactivarMembresia } from '@/lib/membresia/cancelar'
import { SLUG_VAIP, enlaceDeSuscripcion, enlaceDelPortal, miMembresia, misMembresias, planPublico, planVaip } from '@/lib/membresia/consultas'
import { espacioVaip } from '@/lib/membresia/espacio'
import { MOTIVOS, esMotivo, etiquetaDeMotivo } from '@/lib/membresia/motivos'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Tu membresía' }
export const dynamic = 'force-dynamic'

type Parametros = { plan?: string; paso?: string; motivo?: string; listo?: string; error?: string }

const ERRORES: Record<string, string> = {
  motivo: 'Elige una de las opciones para seguir.',
  'sin-membresia': 'No encontramos una membresía activa en tu cuenta.',
  'no-coincide': 'No pudimos verificar tu suscripción, así que no se cambió nada. Escríbenos a ayuda@vadai.com.mx y lo resolvemos.',
  stripe: 'Stripe no respondió y no se cambió nada. Inténtalo otra vez en un momento.',
}

/** «Paso 1 de 3», con tres barras: el carrusel de la cancelación. */
function Pasos({ actual }: { actual: 1 | 2 | 3 }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">Paso {actual} de 3</p>
      <div aria-hidden className="grid grid-cols-3 gap-1.5">
        {[1, 2, 3].map((n) => (
          <span key={n} className={cn('h-1 rounded-full', n <= actual ? 'bg-primary' : 'bg-muted')} />
        ))}
      </div>
    </div>
  )
}

/**
 * Administrar la membresía (M18): el estado, la tarjeta y los cobros (portal
 * de Stripe) y —con un enlace discreto— cancelar en tres pasos:
 *
 *   1. lo que dejas, con lo tuyo de verdad (tu nivel, tu lugar, la próxima clase);
 *   2. por qué te vas;
 *   3. confirmar, con un comentario opcional.
 *
 * Todo es servidor: los pasos son enlaces y el último un formulario, así que
 * funciona sin JavaScript. Cancelar es al final del mes pagado; mientras ese
 * mes dure, «Seguir con mi membresía» lo deshace.
 */
export default async function PaginaMembresia({ searchParams }: { searchParams: Promise<Parametros> }) {
  const perfil = await exigirPerfil()
  const q = await searchParams
  // M22: sin plan es la pestaña «Membresía» de Mi perfil (todas tus
  // membresías); con plan, administrar o cancelar esa.
  if (!q.plan) return <TusMembresias />
  const slug = q.plan
  const plan = await planPublico(slug, { cualquierEstado: true })
  const membresia = plan ? await miMembresia(plan.id) : null
  const base = `/perfil/membresia?plan=${encodeURIComponent(slug)}`
  const error = q.error ? ERRORES[q.error] : null
  const esVaip = slug === SLUG_VAIP

  const encabezado = (
    <header className="flex flex-col gap-3">
      <Link href="/perfil/membresia" className="w-fit text-sm text-muted-foreground hover:text-primary">
        ← Membresía
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        {esVaip ? <LogoVaip className="h-9" /> : null}
        <h1 className="text-2xl font-semibold tracking-tight">Tu membresía{esVaip ? '' : ` ${plan?.nombre ?? ''}`}</h1>
      </div>
    </header>
  )

  if (!plan || !membresia) {
    return (
      <div className="flex max-w-2xl flex-col gap-8">
        {encabezado}
        <Tarjeta className="flex flex-col gap-3 p-6">
          <p className="text-pretty text-muted-foreground">No tienes una membresía en tu cuenta.</p>
          {plan?.abierto ? (
            <Button asChild variant="acento" className="w-fit">
              <Link href={esVaip ? '/vaip' : `/membresias/${slug}`}>Conocer {plan.nombre}</Link>
            </Button>
          ) : null}
        </Tarjeta>
      </div>
    )
  }

  const portal = plan.portal ? enlaceDelPortal(plan.portal, perfil.email) : null
  const viva = membresia.vigente && ['active', 'trialing', 'past_due'].includes(membresia.estado)
  const hasta = membresia.proximoCobro ?? membresia.accesoHasta

  // --- Ya canceló (o acaba de hacerlo): se puede volver atrás ------------
  if (viva && (membresia.seCancela || q.listo === 'cancelada')) {
    return (
      <div className="flex max-w-2xl flex-col gap-8">
        {encabezado}
        {error ? <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">{error}</p> : null}
        <Tarjeta className="flex flex-col gap-4 p-6">
          <h2 className="text-lg font-semibold">Cancelaste la renovación</h2>
          <p className="text-pretty text-muted-foreground">
            No se te vuelve a cobrar. Sigues dentro con todo hasta el{' '}
            <span className="font-medium text-foreground">{membresia.accesoHasta ? fechaLarga(membresia.accesoHasta) : 'fin de tu mes'}</span>, y tu
            avance se queda guardado por si vuelves.
          </p>
          <form action={reactivarMembresia} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="plan" value={slug} />
            <Button type="submit" variant="acento">
              Seguir con mi membresía
            </Button>
            <span className="text-xs text-muted-foreground">Sigue igual, con tu mismo precio. No se cobra nada hoy.</span>
          </form>
        </Tarjeta>
      </div>
    )
  }

  // --- Sin acceso: terminó ---------------------------------------------------
  if (!viva) {
    return (
      <div className="flex max-w-2xl flex-col gap-8">
        {encabezado}
        <Tarjeta className="flex flex-col gap-3 p-6">
          <p className="text-pretty text-muted-foreground">
            Tu membresía terminó{membresia.accesoHasta ? ` el ${fechaLarga(membresia.accesoHasta)}` : ''}. Tu avance se queda
            guardado.
          </p>
          {plan.abierto ? (
            <Button asChild variant="acento" className="w-fit">
              <Link href={esVaip ? '/vaip' : `/membresias/${slug}`}>Volver a suscribirme</Link>
            </Button>
          ) : null}
        </Tarjeta>
      </div>
    )
  }

  const paso = q.paso === '1' || q.paso === '2' || q.paso === '3' ? (Number(q.paso) as 1 | 2 | 3) : 0
  const quedarme = (
    <Button asChild variant="acento">
      <Link href={esVaip ? '/vaip' : '/mis-cursos'}>Me quedo</Link>
    </Button>
  )

  // --- Paso 0: el estado, con la salida discreta -----------------------------
  if (paso === 0) {
    return (
      <div className="flex max-w-2xl flex-col gap-8">
        {encabezado}
        {q.listo === 'sigue' ? (
          <p className="rounded-lg border border-accent bg-accent/15 px-4 py-3 text-sm">
            Listo, sigues dentro. {membresia.proximoCobro ? `Tu próximo cobro es el ${fechaLarga(membresia.proximoCobro)}.` : ''}
          </p>
        ) : null}
        {error ? <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">{error}</p> : null}
        <Tarjeta className="flex flex-col gap-5 p-6">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            {membresia.proximoCobro ? (
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground">Próximo cobro</dt>
                <dd className="font-medium">{fechaLarga(membresia.proximoCobro)}</dd>
              </div>
            ) : null}
            {membresia.accesoHasta ? (
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground">Tienes acceso hasta</dt>
                <dd className="font-medium">{fechaLarga(membresia.accesoHasta)}</dd>
              </div>
            ) : null}
          </dl>
          {portal ? (
            <div className="flex flex-col gap-1.5">
              <Button asChild variant="outline" className="w-fit">
                <a href={portal}>Tarjeta y cobros</a>
              </Button>
              <p className="text-xs text-muted-foreground">
                Cambias tu tarjeta y descargas tus cobros en Stripe. Te pide un código que llega a tu correo.
              </p>
            </div>
          ) : null}
        </Tarjeta>
        <Link href={`${base}&paso=1`} className="w-fit text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline">
          Cancelar mi membresía
        </Link>
      </div>
    )
  }

  // --- Paso 1: lo que dejas ----------------------------------------------------
  if (paso === 1) {
    const espacio = esVaip ? await espacioVaip(perfil, plan) : null
    const yo = espacio?.ranking.yo ?? null
    const ganados = espacio?.logros.filter((l) => l.ganado).length ?? 0
    const cursos = espacio ? espacio.biblioteca.map((c) => c.titulo) : plan.cursos

    return (
      <div className="flex max-w-2xl flex-col gap-8">
        {encabezado}
        <Pasos actual={1} />
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold tracking-tight text-balance">Antes de irte, esto es lo que dejas</h2>
          <ul className="flex flex-col gap-3">
            {espacio?.proximaClase ? (
              <li>
                <Tarjeta className="flex flex-col gap-1 p-4">
                  <span className="text-xs font-medium tracking-[0.18em] text-primary uppercase">Próxima clase</span>
                  <span className="font-medium">{espacio.proximaClase.titulo}</span>
                  <span className="text-sm text-muted-foreground">{fechaLarga(espacio.proximaClase.programadaEn)}</span>
                </Tarjeta>
              </li>
            ) : esVaip ? (
              <li>
                <Tarjeta className="p-4 text-sm text-pretty">Las clases en vivo personalizadas, con su grabación, y el acompañamiento del equipo.</Tarjeta>
              </li>
            ) : null}
            {cursos.length > 0 ? (
              <li>
                <Tarjeta className="flex flex-col gap-2 p-4">
                  <span className="text-xs font-medium tracking-[0.18em] text-primary uppercase">
                    {cursos.length === 1 ? 'Tu curso de miembro' : `Tus ${cursos.length} cursos de miembro`}
                  </span>
                  <span className="text-sm text-pretty">{cursos.slice(0, 6).join(' · ')}</span>
                </Tarjeta>
              </li>
            ) : null}
            {yo ? (
              <li>
                <Tarjeta className="flex flex-col gap-1 p-4">
                  <span className="text-xs font-medium tracking-[0.18em] text-primary uppercase">Tu lugar en la comunidad</span>
                  <span className="text-sm text-pretty">
                    Vas <span className="font-medium">#{yo.lugar}</span> de {espacio?.ranking.total} con {yo.puntos} puntos, en el nivel{' '}
                    {yo.nivel.numero} · {yo.nivel.nombre}
                    {ganados > 0 ? `, y llevas ${ganados} ${ganados === 1 ? 'logro' : 'logros'}.` : '.'}
                  </span>
                </Tarjeta>
              </li>
            ) : null}
          </ul>
          <p className="text-sm text-pretty text-muted-foreground">
            Si cancelas, sigues dentro hasta el {hasta ? fechaLarga(hasta) : 'fin de tu mes'} y tu avance se queda guardado.
          </p>
        </section>
        <div className="flex flex-wrap items-center gap-3">
          {quedarme}
          <Button asChild variant="ghost">
            <Link href={`${base}&paso=2`}>Continuar con la cancelación</Link>
          </Button>
        </div>
      </div>
    )
  }

  // --- Paso 2: por qué te vas -------------------------------------------------
  if (paso === 2) {
    return (
      <div className="flex max-w-2xl flex-col gap-8">
        {encabezado}
        <Pasos actual={2} />
        {error ? <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">{error}</p> : null}
        <form action="/perfil/membresia" method="get" className="flex flex-col gap-5">
          <input type="hidden" name="plan" value={slug} />
          <input type="hidden" name="paso" value="3" />
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-xl font-semibold tracking-tight">¿Por qué te vas?</legend>
            <p className="-mt-1 mb-1 text-sm text-muted-foreground">Nos sirve para mejorar. Elige la que más se acerque.</p>
            {MOTIVOS.map((m) => (
              <label
                key={m.clave}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] border border-border px-4 py-2.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <input
                  type="radio"
                  name="motivo"
                  value={m.clave}
                  required
                  defaultChecked={q.motivo === m.clave}
                  className="size-4 accent-vadai-cyan"
                />
                {m.etiqueta}
              </label>
            ))}
          </fieldset>
          <div className="flex flex-wrap items-center gap-3">
            {quedarme}
            <Button type="submit" variant="ghost">
              Continuar
            </Button>
          </div>
        </form>
      </div>
    )
  }

  // --- Paso 3: confirmar -------------------------------------------------------
  const motivo = esMotivo(q.motivo) ? q.motivo : null
  return (
    <div className="flex max-w-2xl flex-col gap-8">
      {encabezado}
      <Pasos actual={3} />
      {error ? <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">{error}</p> : null}
      {motivo ? (
        <form action={cancelarMembresia} className="flex flex-col gap-5">
          <input type="hidden" name="plan" value={slug} />
          <input type="hidden" name="motivo" value={motivo} />
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold tracking-tight">Confirma tu cancelación</h2>
            <p className="text-pretty text-muted-foreground">
              No se te vuelve a cobrar. Sigues dentro hasta el{' '}
              <span className="font-medium text-foreground">{hasta ? fechaLarga(hasta) : 'fin de tu mes'}</span>, y hasta esa
              fecha puedes volver atrás con un clic.
            </p>
            <p className="text-sm text-muted-foreground">
              Tu motivo: {etiquetaDeMotivo(motivo)} ·{' '}
              <Link href={`${base}&paso=2&motivo=${motivo}`} className="underline-offset-4 hover:text-primary hover:underline">
                cambiar
              </Link>
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="comentario">¿Algo más que quieras decirnos? (opcional)</Label>
            <Textarea id="comentario" name="comentario" maxLength={1000} rows={3} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {quedarme}
            <Button type="submit" variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/5">
              Cancelar mi membresía
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm">
          Falta elegir por qué te vas.{' '}
          <Link href={`${base}&paso=2`} className="font-medium text-primary underline-offset-4 hover:underline">
            Volver al paso 2
          </Link>
        </p>
      )}
    </div>
  )
}

/**
 * Mi perfil → Membresía (M22): una tarjeta por plan, con su estado, la tarjeta
 * y los cobros y «Administrar membresía». Sin V-AI-P y con el plan abierto, una
 * sola invitación. Antes vivía al final de /perfil.
 */
async function TusMembresias() {
  const perfil = await exigirPerfil()
  const [plan, membresias] = await Promise.all([planVaip(), misMembresias()])
  const tieneVaip = membresias.some((m) => m.plan.slug === plan?.slug)

  return (
    <div className="flex flex-col gap-10">
      <EncabezadoPerfil apoyo="Tu membresía, tu tarjeta y tus cobros." />
      <div className="flex max-w-2xl flex-col gap-8">
        {membresias.map(({ plan: suyo, membresia }) => (
          <section key={suyo.id} className="flex flex-col gap-4">
            {suyo.slug === SLUG_VAIP ? null : <h2 className="text-lg font-semibold">{suyo.nombre}</h2>}
            <TuMembresia
              plan={suyo}
              membresia={membresia}
              portal={suyo.portal ? enlaceDelPortal(suyo.portal, perfil.email) : null}
              enlaceDeSuscripcion={
                suyo.activo && suyo.linkDePago
                  ? enlaceDeSuscripcion(suyo.linkDePago, { correo: perfil.email, userId: perfil.user_id })
                  : null
              }
            />
          </section>
        ))}
        {plan && !tieneVaip && plan.abierto ? (
          <Link
            href="/vaip"
            className="flex items-center gap-4 rounded-[10px] border border-border p-4 transition-colors hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <LogoVaip className="h-8" />
            <span className="text-sm text-pretty text-muted-foreground">
              Clases en vivo personalizadas y el equipo de VADAI acompañándote.{' '}
              <span className="font-medium text-primary">Conoce V-AI-P</span>
            </span>
          </Link>
        ) : null}
        {membresias.length === 0 && !(plan && plan.abierto) ? (
          <p className="rounded-[10px] border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
            No tienes una membresía en tu cuenta.
          </p>
        ) : null}
      </div>
    </div>
  )
}
