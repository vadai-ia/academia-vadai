import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Comunidad } from '@/components/alumno/comunidad'
import { SelectorDeGeneracion } from '@/components/alumno/selector-de-generacion'
import { EncabezadoVaip } from '@/components/vaip/espacio'
import { VentaVaip } from '@/components/vaip/venta'
import { generacionesParaEquipo } from '@/lib/alumno/generaciones-equipo'
import { sesionesDelCurso } from '@/lib/alumno/sesiones'
import { obtenerSesion } from '@/lib/auth/sesion'
import { proximaOActual } from '@/lib/calendario/estado'
import { feedDelCurso } from '@/lib/comunidad/posts'
import { temasDelCurso } from '@/lib/comunidad/temas'
import { enlaceDeSuscripcion, miMembresia, planDeLaVenta, planVaip } from '@/lib/membresia/consultas'
import { contextoVaip, type ContextoVaip } from '@/lib/membresia/espacio'
import { menosQueUnCafe, situacionDeVenta } from '@/lib/membresia/venta'
import { sellarCanal } from '@/lib/notificaciones/canales'

export const metadata: Metadata = {
  title: 'VADAI V-AI-P',
  description:
    'La comunidad de la academia VADAI: clases en vivo personalizadas, acompañamiento del equipo, lo nuevo de todas las plataformas de IA y negocios que ya la usan.',
}
export const dynamic = 'force-dynamic'

type Parametros = { p?: string; por?: string; gen?: string; tema?: string }

/**
 * /vaip (M17): una sola URL para todos, que es la que lleva el QR.
 *
 *   - miembro vigente (o alguien del equipo) → el MURO de V-AI-P, la primera
 *     de sus pestañas (M22: antes era un tablero que mandaba el muro a otra
 *     página);
 *   - cualquier otra persona, con o sin sesión → la página de venta.
 *
 * Con sesión, el link de pago lleva el correo y el id de la cuenta, para que
 * la suscripción caiga en la misma cuenta.
 */
export default async function PaginaVaip({ searchParams }: { searchParams: Promise<Parametros> }) {
  const plan = await planVaip()
  if (!plan) notFound()

  const ctx = await contextoVaip()
  if (ctx) return <MuroVaip ctx={ctx} q={await searchParams} />

  const venta = (await planDeLaVenta()) ?? plan
  const sesion = await obtenerSesion()
  const perfil = sesion.tipo === 'activo' ? sesion.perfil : null
  const membresia = perfil ? await miMembresia(venta.id) : null
  const enlace =
    venta.abierto && venta.linkDePago
      ? enlaceDeSuscripcion(venta.linkDePago, perfil ? { correo: perfil.email, userId: perfil.user_id } : null)
      : null
  const situacion = situacionDeVenta(membresia)
  // M23: a quien ya fue miembro, una línea con la fecha arriba del título en vez
  // de la tarjeta completa, que empujaba el botón bajo el pliegue. La tarjeta
  // sigue en Mi perfil → Membresía.
  const terminoEl =
    situacion === 'vencida' && membresia?.accesoHasta
      ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', timeZone: 'America/Mexico_City' }).format(
          new Date(membresia.accesoHasta)
        )
      : null

  return (
    <VentaVaip
      plan={venta}
      enlace={enlace}
      conSesion={Boolean(perfil)}
      situacion={situacion}
      terminoEl={terminoEl}
      cafe={menosQueUnCafe(venta.precioMxn)}
    />
  )
}

/**
 * Muro: el de la casa de V-AI-P, con sus temas (Noticias, Prompts…). Abrirlo
 * apaga el número de la pastilla V-AI-P.
 */
async function MuroVaip({ ctx, q }: { ctx: ContextoVaip; q: Parametros }) {
  const { perfil, casa, equipo } = ctx
  const nombre = perfil.full_name || perfil.email

  if (!casa) {
    return (
      <div className="flex flex-col gap-8">
        <EncabezadoVaip nombre={nombre} clase={null} />
        <p className="rounded-[10px] border border-dashed border-border px-5 py-12 text-center text-sm text-muted-foreground">
          El muro de V-AI-P abre muy pronto. Te avisamos por correo.
        </p>
      </div>
    )
  }

  const generaciones = equipo && casa.porGeneraciones ? await generacionesParaEquipo(casa.id) : []
  const generacion = generaciones.find((g) => g.id === q.gen) ?? casa.generacion
  const cohortId = generacion?.id ?? null
  const temas = await temasDelCurso(casa.id)
  const temaElegido = temas.find((t) => t.slug === q.tema) ?? null
  const [feed, sesiones] = await Promise.all([
    feedDelCurso(casa.id, cohortId, perfil.user_id, {
      pagina: Number(q.p) || 1,
      porPagina: q.por === undefined ? 10 : Number(q.por),
      temaId: temaElegido?.id ?? null,
    }),
    sesionesDelCurso(casa.slug),
    sellarCanal(perfil, 'comunidad'),
  ])
  const extra: Record<string, string> = q.gen && generacion?.id === q.gen ? { gen: q.gen } : {}

  return (
    <div className="flex flex-col gap-8">
      <EncabezadoVaip nombre={nombre} clase={proximaOActual(sesiones, Date.now())} />

      {generaciones.length > 0 ? (
        <SelectorDeGeneracion base="/vaip" generaciones={generaciones} activa={cohortId} />
      ) : null}

      {casa.sinGeneracion ? (
        <p className="rounded-lg border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
          Todavía no estás en el grupo de miembros. Escríbenos y te agregamos.
        </p>
      ) : (
        <div className="max-w-3xl">
          <Comunidad
            posts={feed.posts}
            cursoId={casa.id}
            cohortId={cohortId}
            porGeneraciones={casa.porGeneraciones}
            cursoSlug={casa.slug}
            soyEquipo={equipo}
            ruta="/vaip"
            pagina={feed.pagina}
            paginas={feed.paginas}
            porPagina={feed.porPagina}
            total={feed.total}
            extra={extra}
            temas={temas}
            temaActual={temaElegido?.slug ?? null}
          />
        </div>
      )}
    </div>
  )
}
