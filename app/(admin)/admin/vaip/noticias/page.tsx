import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

import { BotonCazar, FormularioLiga, FormularioPropuesta } from '@/components/admin/noticias'
import { Button } from '@/components/ui/button'
import { Seccion, Tarjeta, Titulo } from '@/components/ui-vadai/superficie'
import { dolares } from '@/lib/agente/costos'
import { esAdmin, exigirEquipo } from '@/lib/auth/sesion'
import { descartarNoticia } from '@/lib/noticias/acciones'
import { tableroDeNoticias, type Busqueda } from '@/lib/noticias/consultas'

export const metadata: Metadata = { title: 'Noticias · V-AI-P' }
export const dynamic = 'force-dynamic'
// La búsqueda corre después de responder (`after`): necesita el tiempo de la función.
export const maxDuration = 300

const LIMITE_CACERIAS = 3
const LIMITE_LIGAS = 10

const MOTIVOS: Record<string, string> = {
  duplicada: 'repetidas',
  vieja: 'de hace más de 3 días',
  rota: 'que no abrieron',
  inventada: 'con ligas que no salieron en la búsqueda',
  dominio: 'de medios fuera de la lista',
  invalida: 'con ligas inválidas',
  sin_texto: 'sin texto que leer',
  no_publica: 'no públicas',
}

const fecha = (iso: string) =>
  new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Mexico_City' }).format(new Date(iso))
const dia = (iso: string) =>
  new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', timeZone: 'America/Mexico_City' }).format(new Date(iso))

/**
 * Noticias de IA (M24): cazar las del día, crear una desde una liga y
 * revisar las propuestas. Nada se publica sin el clic de una persona. Mientras
 * una búsqueda corre, la página se refresca sola cada 5 segundos (con o sin
 * JavaScript).
 */
export default async function PaginaNoticias({ searchParams }: { searchParams: Promise<{ busqueda?: string }> }) {
  const perfil = await exigirEquipo()
  const { busqueda } = await searchParams
  const t = await tableroDeNoticias(busqueda && /^[0-9a-f-]{36}$/i.test(busqueda) ? busqueda : null)
  const admin = esAdmin(perfil)
  const enCurso = t.busquedaEnCurso

  const motivoCaceria =
    enCurso?.tipo === 'caceria'
      ? 'Hay una búsqueda en curso.'
      : t.hoy.cacerias >= LIMITE_CACERIAS
        ? `Ya se hicieron las ${LIMITE_CACERIAS} búsquedas de hoy (incluida la de las 7:00).`
        : `Hoy: ${t.hoy.cacerias} de ${LIMITE_CACERIAS} búsquedas.`

  return (
    <div className="flex flex-col gap-10">
      {enCurso ? <meta httpEquiv="refresh" content="5" /> : null}

      <Titulo
        ceja="V-AI-P"
        apoyo="La IA busca y redacta; tú decides qué sale. Cada noticia se publica con su imagen de VADAI y la liga «Leer más»."
      >
        Noticias de IA
      </Titulo>

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-medium tracking-tight">Cazar noticias de hoy</h2>
            <p className="text-sm text-pretty text-muted-foreground">
              Busca lo más importante de las últimas 48 horas en Anthropic, OpenAI, Google, Microsoft y medios serios.
              Descarta lo repetido, lo viejo y lo que no abre, y te deja el top 3. Tarda de 1 a 3 minutos.
            </p>
          </div>
          <BotonCazar
            deshabilitado={enCurso?.tipo === 'caceria' || t.hoy.cacerias >= LIMITE_CACERIAS}
            motivo={motivoCaceria}
          />
        </Tarjeta>

        <Tarjeta className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-medium tracking-tight">Desde una liga</h2>
            <p className="text-sm text-pretty text-muted-foreground">
              Pega un artículo o un video de YouTube. La IA lo lee, investiga el tema y te deja la noticia para revisarla.
              De un video solo ve el título y la descripción, no el video.
            </p>
          </div>
          <FormularioLiga deshabilitado={enCurso?.tipo === 'liga' || t.hoy.ligas >= LIMITE_LIGAS} />
          <p className="text-xs text-muted-foreground">
            Hoy: {t.hoy.ligas} de {LIMITE_LIGAS}.
          </p>
        </Tarjeta>
      </div>

      {enCurso ? <EnCurso b={enCurso} /> : t.ultima ? <UltimaBusqueda b={t.ultima} admin={admin} /> : null}

      <Seccion
        titulo="Esperan tu clic"
        apoyo={t.propuestas.length ? 'Corrige lo que quieras y publica. Lo que descartes no se vuelve a proponer.' : undefined}
      >
        {t.propuestas.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
            No hay noticias esperando. Caza las de hoy o pega una liga.
          </p>
        ) : (
          <ul className="flex flex-col gap-6">
            {t.propuestas.map((p) => (
              <li key={p.id} id={`propuesta-${p.id}`}>
                <Tarjeta className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
                  <div className="flex flex-col gap-3">
                    <Image
                      src={`/api/noticias/vista-previa?tipo=noticia&titulo=${encodeURIComponent(p.titulo)}&medio=${encodeURIComponent(p.medio ?? '')}`}
                      alt=""
                      width={1200}
                      height={675}
                      unoptimized
                      className="aspect-video w-full rounded-lg border border-border object-cover"
                    />
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{p.medio ?? 'Sin medio'}</span>
                      {p.publicadoEnFuente ? <span>· {dia(p.publicadoEnFuente)}</span> : null}
                      <span>· {p.origen === 'liga' ? (p.tipoFuente === 'video' ? 'desde un video' : 'desde una liga') : 'de la cacería'}</span>
                    </div>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex w-fit items-center text-sm text-primary underline-offset-4 pointer-coarse:min-h-11 hover:underline"
                    >
                      Abrir la nota original ↗
                    </a>
                    {p.notas ? (
                      <details className="rounded-lg border border-border px-3 py-2 text-sm">
                        <summary className="cursor-pointer font-medium">Notas de la IA</summary>
                        <p className="mt-2 text-pretty whitespace-pre-line text-muted-foreground">{p.notas}</p>
                      </details>
                    ) : null}
                  </div>
                  <div className="flex min-w-0 flex-col gap-4">
                    <FormularioPropuesta p={p} />
                    <form action={descartarNoticia} className="border-t border-border pt-3">
                      <input type="hidden" name="id" value={p.id} />
                      <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
                        Descartar esta noticia
                      </Button>
                    </form>
                  </div>
                </Tarjeta>
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      {t.historial.length > 0 ? (
        <Seccion titulo="Ya revisadas">
          <ul className="flex flex-col divide-y divide-border rounded-[10px] border border-border">
            {t.historial.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere]">{h.titulo}</span>
                <span className="flex items-center gap-3 text-muted-foreground">
                  <span className={h.estado === 'publicada' ? 'text-exito' : undefined}>
                    {h.estado === 'publicada' ? 'Publicada' : 'Descartada'}
                  </span>
                  {h.revisada ? <span>{fecha(h.revisada)}</span> : null}
                  {h.urlDelMuro ? (
                    <Link href={h.urlDelMuro} className="text-primary underline-offset-4 pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center hover:underline">
                      Ver en el muro
                    </Link>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </Seccion>
      ) : null}
    </div>
  )
}

function EnCurso({ b }: { b: Busqueda }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-4 rounded-[10px] border border-primary/40 bg-primary/5 px-5 py-4">
      <span aria-hidden className="size-3 shrink-0 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="font-medium">{b.tipo === 'caceria' ? 'Cazando las noticias de hoy…' : 'Creando la noticia desde la liga…'}</p>
        <p className="text-sm text-muted-foreground">
          {b.paso ?? 'Empezando'}. Esta página se actualiza sola; puedes salir y volver.
        </p>
      </div>
    </div>
  )
}

function UltimaBusqueda({ b, admin }: { b: Busqueda; admin: boolean }) {
  const descartes = Object.entries(b.descartes)
  const total = descartes.reduce((s, [, n]) => s + n, 0)
  const titulo =
    b.estado === 'lista'
      ? b.tipo === 'caceria'
        ? 'La última búsqueda terminó.'
        : 'La noticia desde la liga está lista abajo.'
      : b.estado === 'sin_resultados'
        ? 'La última búsqueda no encontró nada nuevo.'
        : 'La última búsqueda no se pudo completar.'
  return (
    <div
      className={
        b.estado === 'fallida'
          ? 'flex flex-col gap-1 rounded-[10px] border border-destructive/40 bg-destructive/5 px-5 py-4'
          : 'flex flex-col gap-1 rounded-[10px] border border-border bg-card px-5 py-4'
      }
    >
      <p className="font-medium">{titulo}</p>
      <p className="text-sm text-pretty text-muted-foreground">
        {fecha(b.iniciada)}
        {b.detalle ? ` · ${b.detalle}` : ''}
        {total > 0 ? ` · Se descartaron ${total}: ${descartes.map(([m, n]) => `${n} ${MOTIVOS[m] ?? m}`).join(', ')}.` : ''}
        {admin && b.costo !== null ? ` · Costó ${dolares(b.costo)}.` : ''}
      </p>
    </div>
  )
}
