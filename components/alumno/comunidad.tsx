'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useActionState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

import { Reaccionar, ResumenDeReacciones } from '@/components/alumno/reacciones'
import { RenderRico } from '@/components/alumno/render-rico'
import { Avatar } from '@/components/ui-vadai/superficie'
import { TextoConLigas } from '@/components/ui-vadai/texto-con-ligas'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  comentarEnPost,
  eliminarComoEquipo,
  eliminarPostPropio,
  fijarPost,
  moderarPost,
  publicarEnComunidad,
} from '@/lib/comunidad/acciones-posts'
import { insigniaDeAutor } from '@/lib/agente/firma'
import { textoPlano } from '@/lib/comunidad/documento'
import type { ComentarioDePost, PostDeComunidad } from '@/lib/comunidad/posts'
import { cn } from '@/lib/utils'

/**
 * Muro y grupos (§3.8), como feed de Skool (22-oct-2026).
 *
 * Alejandro: «que se sienta fácil de leer… como un blog increíble donde la
 * gente quiera interactuar». Antes cada publicación salía entera en el feed,
 * con seis botones de emoji, «Responder» y, al equipo, «Fijar · Ocultar ·
 * eliminar» encima: una noticia medía 1,100 px y la segunda quedaba a tres
 * pantallas. Ahora el feed es de TARJETAS —autor, título, tres líneas, la
 * imagen y una fila «👍 12 · 💬 5 · Me gusta»— y cada una se abre en su página
 * (`PublicacionCompleta`) con el texto entero y la conversación.
 *
 * Una sola reacción con selector (`Reaccionar`), y lo del equipo dentro de un
 * menú «⋯». Todo lo que se abre y se cierra son <details>, y las acciones van
 * directas al <form>: sin JavaScript la comunidad sigue funcionando. React solo
 * emite el $ACTION_ID cuando la acción llega sin envolver; el reset de los
 * campos lo da `key`, desde el servidor.
 *
 * Lo oculto por moderación no llega hasta aquí — lo filtra RLS.
 */

/** El <summary> se disfraza de botón; el triángulo nativo estorba. */
const sinMarcador = 'list-none [&::-webkit-details-marker]:hidden'

function fechaCorta(iso: string): string {
  // Zona fija: el servidor pinta en UTC y el navegador en la suya; si no
  // coinciden, React 418 tira la página entera (21-sep-2026).
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

function Boton({
  etiqueta,
  pendienteEtiqueta,
  className,
}: {
  etiqueta: string
  pendienteEtiqueta: string
  className?: string
}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className={className}>
      {pending ? pendienteEtiqueta : etiqueta}
    </Button>
  )
}

/** Un tema del muro (M17). Local: `lib/comunidad/temas.ts` es server-only. */
type TemaDelMuro = { id: string; nombre: string; slug: string; soloEquipo: boolean }

/** Quién está escribiendo: el avatar del «Escribe algo…». */
type Yo = { nombre: string; avatar: string | null }

// --- El menú «⋯» -----------------------------------------------------------

const renglonDeMenu =
  'flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted pointer-coarse:min-h-11 ' +
  'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none'

function IconoTresPuntos() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden>
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  )
}

/**
 * Fijar, ocultar y eliminar, guardados en «⋯» (22-oct-2026). Estaban a la
 * vista en cada publicación, en rojo, y el equipo los ve en el portal real: eran
 * lo primero que se leía. Borrar sigue pidiendo confirmarlo, porque no se
 * deshace; ocultar es un toque.
 *
 * `despues`: desde la página de una publicación, a dónde volver al ocultarla o
 * borrarla (la página ya no existiría).
 */
function MenuDePublicacion({
  post,
  cursoSlug,
  ruta,
  soyEquipo,
  despues,
}: {
  post: PostDeComunidad
  cursoSlug: string
  ruta: string
  soyEquipo: boolean
  despues?: string
}) {
  if (!soyEquipo && !post.esMio) return null
  const ocultos = (
    <>
      <input type="hidden" name="id" value={post.id} />
      <input type="hidden" name="curso_slug" value={cursoSlug} />
      <input type="hidden" name="ruta" value={ruta} />
      {despues ? <input type="hidden" name="despues" value={despues} /> : null}
    </>
  )

  return (
    <details className="group/menu relative z-10 shrink-0">
      <summary
        aria-label="Opciones de la publicación"
        className={cn(
          'flex size-9 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors select-none pointer-coarse:size-11',
          'hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
          'group-open/menu:bg-muted',
          sinMarcador
        )}
      >
        <IconoTresPuntos />
      </summary>
      <div className="absolute top-full right-0 z-30 mt-1 flex w-56 flex-col rounded-[10px] border border-border bg-card p-1 shadow-[0_4px_16px_rgba(0,0,0,0.1)]">
        {soyEquipo ? (
          <>
            <form action={fijarPost}>
              {ocultos}
              <input type="hidden" name="fijar" value={post.fijado ? 'no' : 'si'} />
              <button type="submit" className={renglonDeMenu}>
                {post.fijado ? 'Desfijar' : 'Fijar arriba'}
              </button>
            </form>
            <form action={moderarPost}>
              {ocultos}
              <input type="hidden" name="tipo" value="post" />
              <button type="submit" className={renglonDeMenu}>
                Ocultar
              </button>
            </form>
            <details className="group/borrar">
              <summary className={cn(renglonDeMenu, 'cursor-pointer text-destructive', sinMarcador)}>
                Eliminar…
              </summary>
              <form action={eliminarComoEquipo} className="flex flex-col gap-2 px-3 pt-1 pb-2">
                {ocultos}
                <input type="hidden" name="tipo" value="post" />
                <span className="text-xs text-muted-foreground">
                  Se borra con sus {post.comentarios.length} respuesta(s) y no se puede deshacer. Si solo estorba, usa
                  Ocultar.
                </span>
                <Button type="submit" variant="destructive" size="sm">
                  Sí, eliminar
                </Button>
              </form>
            </details>
          </>
        ) : (
          <form action={eliminarPostPropio}>
            {ocultos}
            <button type="submit" className={cn(renglonDeMenu, 'text-destructive')}>
              Eliminar mi publicación
            </button>
          </form>
        )}
      </div>
    </details>
  )
}

/** Ocultar o eliminar una respuesta (equipo), en su propio «⋯». */
function MenuDeRespuesta({ comentario, ruta }: { comentario: ComentarioDePost; ruta: string }) {
  return (
    <details className="group/menu relative shrink-0">
      <summary
        aria-label="Opciones de la respuesta"
        className={cn(
          'flex size-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors select-none pointer-coarse:size-11',
          'hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
          sinMarcador
        )}
      >
        <IconoTresPuntos />
      </summary>
      <div className="absolute top-full right-0 z-30 mt-1 flex w-52 flex-col rounded-[10px] border border-border bg-card p-1 shadow-[0_4px_16px_rgba(0,0,0,0.1)]">
        <form action={moderarPost}>
          <input type="hidden" name="id" value={comentario.id} />
          <input type="hidden" name="tipo" value="comentario" />
          <input type="hidden" name="ruta" value={ruta} />
          <button type="submit" className={renglonDeMenu}>
            Ocultar
          </button>
        </form>
        <details>
          <summary className={cn(renglonDeMenu, 'cursor-pointer text-destructive', sinMarcador)}>Eliminar…</summary>
          <form action={eliminarComoEquipo} className="flex flex-col gap-2 px-3 pt-1 pb-2">
            <input type="hidden" name="id" value={comentario.id} />
            <input type="hidden" name="tipo" value="comentario" />
            <input type="hidden" name="ruta" value={ruta} />
            <span className="text-xs text-muted-foreground">Se borra esta respuesta. No se puede deshacer.</span>
            <Button type="submit" variant="destructive" size="sm">
              Sí, eliminar
            </Button>
          </form>
        </details>
      </div>
    </details>
  )
}

// --- Escribir ----------------------------------------------------------------

/**
 * «Escribe algo…» como en Skool: un renglón con tu avatar que se abre en el
 * formulario. Era un botón suelto, «Escribir una publicación», que se leía como
 * un control más entre los filtros.
 */
function NuevaPublicacion({
  cursoId,
  cohortId,
  porGeneraciones,
  soyEquipo,
  cursoSlug,
  ruta,
  temas,
  temaActual,
  yo,
  invitacion,
}: {
  cursoId: string
  cohortId: string | null
  porGeneraciones: boolean
  soyEquipo: boolean
  cursoSlug: string
  ruta: string
  temas: TemaDelMuro[]
  temaActual: TemaDelMuro | null
  yo: Yo | null
  invitacion: string
}) {
  const temasParaPublicar = temas.filter((t) => soyEquipo || !t.soloEquipo)
  const [estado, accion] = useActionState(publicarEnComunidad, {})

  return (
    <details className="group/escribir rounded-[14px] border border-border bg-card" open={Boolean(estado.error)}>
      <summary
        className={cn(
          'flex cursor-pointer items-center gap-3 rounded-[14px] p-3 transition-colors select-none hover:bg-muted/50 sm:p-4',
          'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
          sinMarcador
        )}
      >
        {yo ? <Avatar nombre={yo.nombre} foto={yo.avatar} tamano={36} /> : null}
        <span className="flex h-11 flex-1 items-center rounded-full bg-muted px-4 text-[0.95rem] text-muted-foreground group-open/escribir:hidden">
          {invitacion}
        </span>
        <span className="hidden flex-1 text-[0.95rem] font-medium group-open/escribir:inline">Nueva publicación</span>
      </summary>

      <form action={accion} className="flex flex-col gap-4 border-t border-border p-4">
        <input type="hidden" name="course_id" value={cursoId} />
        <input type="hidden" name="cohort_id" value={cohortId ?? ''} />
        <input type="hidden" name="curso_slug" value={cursoSlug} />
        <input type="hidden" name="ruta" value={ruta} />

        {/* Solo el equipo elige (M16): el alumno publica en su generación y
            el servidor la sella. «Todas» crea una copia por generación. */}
        {soyEquipo && porGeneraciones ? (
          <fieldset className="flex flex-wrap gap-4 text-sm">
            <legend className="mb-1.5 text-sm font-medium">Publicar en</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="alcance" value="esta" defaultChecked className="accent-primary" />
              Esta generación
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="alcance" value="todas" className="accent-primary" />
              Todas las generaciones del curso
            </label>
          </fieldset>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="post-titulo">Título</Label>
          <Input
            id="post-titulo"
            name="titulo"
            placeholder="¿De qué quieres hablar?"
            required
            minLength={3}
            className="h-11 text-base"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="post-cuerpo">Mensaje</Label>
          <Textarea id="post-cuerpo" name="cuerpo" rows={5} placeholder="Cuéntanos…" className="text-base" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* M19: un alumno no ve los temas donde solo publica el equipo
              (Noticias); la base lo rechazaría igual (academia_0043). */}
          {temasParaPublicar.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="post-tema">Tema</Label>
              <select
                id="post-tema"
                name="topic_id"
                defaultValue={temasParaPublicar.some((t) => t.id === temaActual?.id) ? temaActual?.id : ''}
                className="h-11 rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="">Sin tema</option>
                {temasParaPublicar.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="post-imagenes">Imágenes (hasta 4)</Label>
            <Input
              id="post-imagenes"
              name="imagenes"
              type="file"
              accept="image/*"
              multiple
              className="h-11 py-2 file:mr-3 file:text-sm"
            />
          </div>
        </div>

        {estado.error ? (
          <p role="status" className="text-sm text-destructive">
            {estado.error}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Boton etiqueta="Publicar" pendienteEtiqueta="Publicando…" className="h-10 px-5" />
        </div>
      </form>
    </details>
  )
}

function Comentar({ postId, cursoSlug, ruta }: { postId: string; cursoSlug: string; ruta: string }) {
  const [estado, accion] = useActionState(comentarEnPost, {})

  return (
    <form action={accion} className="flex flex-col gap-2">
      <input type="hidden" name="post_id" value={postId} />
      <input type="hidden" name="curso_slug" value={cursoSlug} />
      <input type="hidden" name="ruta" value={ruta} />

      <Textarea
        name="contenido"
        rows={3}
        placeholder="Escribe una respuesta…"
        aria-label="Respuesta"
        required
        minLength={2}
        className="text-base"
      />

      {estado.error ? <p className="text-sm text-destructive">{estado.error}</p> : null}

      <div className="flex justify-end">
        <Boton etiqueta="Responder" pendienteEtiqueta="Publicando…" className="h-10 px-5" />
      </div>
    </form>
  )
}

// --- Piezas comunes ---------------------------------------------------------

function Autoria({
  post,
  temaNombre,
  tamano = 40,
}: {
  post: PostDeComunidad
  temaNombre: string | null
  tamano?: number
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <Avatar nombre={post.autor.nombre} foto={post.autor.avatar} tamano={tamano} />
      <div className="flex min-w-0 flex-col">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="truncate text-[0.95rem] font-medium">{post.autor.nombre}</span>
          <Insignia texto={insigniaDeAutor(post.autor, post.via)} />
        </span>
        <span className="flex flex-wrap items-center gap-x-1.5 text-[0.8125rem] text-muted-foreground">
          <span>{fechaCorta(post.creadoEn)}</span>
          {temaNombre ? (
            <>
              <span aria-hidden>·</span>
              <span className="text-primary">{temaNombre}</span>
            </>
          ) : null}
        </span>
      </div>
    </div>
  )
}

function Fijado() {
  return (
    <Badge className="shrink-0 bg-vadai-lima text-[11px] text-vadai-navy">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3" aria-hidden>
        <path d="M12 17v5M9 10.76V6h6v4.76l2 3.24H7l2-3.24ZM8 2h8" />
      </svg>
      Fijado
    </Badge>
  )
}

function IconoComentario() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

// --- La tarjeta del feed -----------------------------------------------------

/**
 * Una publicación en el feed: lo justo para decidir si abrirla. Toda la tarjeta
 * abre la publicación (el título lleva un `after:` que la cubre), y encima
 * quedan tocables «⋯», «Me gusta» y su selector.
 */
function TarjetaPublicacion({
  post,
  href,
  cursoSlug,
  ruta,
  soyEquipo,
  temaNombre,
}: {
  post: PostDeComunidad
  href: string
  cursoSlug: string
  ruta: string
  soyEquipo: boolean
  temaNombre: string | null
}) {
  const extracto = (post.noticia?.resumen || textoPlano(post.contenido)).trim()
  const portada = post.imagenes[0] ?? null
  const respuestas = post.comentarios.length

  return (
    <li
      id={`publicacion-${post.id}`}
      className="relative flex scroll-mt-32 flex-col gap-3 rounded-[14px] border border-border bg-card p-4 transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-[0_1px_2px_rgba(0,0,0,0.05),0_4px_12px_rgba(0,0,0,0.05)] sm:p-5"
    >
      <div className="flex items-start gap-2">
        <Autoria post={post} temaNombre={temaNombre} />
        {post.fijado ? <Fijado /> : null}
        <MenuDePublicacion post={post} cursoSlug={cursoSlug} ruta={ruta} soyEquipo={soyEquipo} />
      </div>

      <div className="flex flex-col gap-1.5">
        <h3 className="text-[1.125rem] leading-snug font-medium text-pretty [overflow-wrap:anywhere]">
          <Link
            href={href}
            className="after:absolute after:inset-0 after:rounded-[14px] focus-visible:outline-none focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
          >
            {post.titulo}
          </Link>
        </h3>
        {extracto ? (
          <p className="line-clamp-3 text-[0.95rem] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
            {extracto}
          </p>
        ) : null}
      </div>

      {portada ? (
        <div className="relative overflow-hidden rounded-[10px] border border-border">
          <Image
            src={portada.url}
            alt=""
            width={1200}
            height={675}
            unoptimized
            className="aspect-video h-auto w-full object-cover"
          />
          {post.imagenes.length > 1 ? (
            <span className="absolute right-2 bottom-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
              +{post.imagenes.length - 1}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-4 pt-1">
        <Reaccionar datos={post.reacciones} postId={post.id} ruta={ruta} />
        <ResumenDeReacciones datos={post.reacciones} />
        <span className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <IconoComentario />
          {respuestas === 0 ? 'Responder' : `${respuestas} respuesta${respuestas === 1 ? '' : 's'}`}
        </span>
      </div>
    </li>
  )
}

/**
 * Las flechas para moverse entre páginas, con «Página 2 de 5» en medio. El
 * selector de «cuántas por página» salió (22-oct-2026): era un control para
 * algo que nadie cambia, y en el teléfono ocupaba un renglón entero. `?por=`
 * sigue funcionando en la URL.
 */
export function Paginacion({
  pagina,
  paginas,
  anterior,
  siguiente,
  etiqueta = 'Navegar las publicaciones',
}: {
  pagina: number
  paginas: number
  /** Ya armadas: el componente se usa también desde páginas del servidor. */
  anterior: string
  siguiente: string
  etiqueta?: string
}) {
  if (paginas <= 1) return null

  const claseFlecha = (habilitada: boolean) =>
    cn(
      'inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium',
      'transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
      habilitada ? 'border-border bg-card hover:bg-muted' : 'pointer-events-none border-border/40 text-muted-foreground/40'
    )

  return (
    <nav aria-label={etiqueta} className="flex items-center justify-between gap-3 pt-2">
      <Link
        href={anterior}
        rel="prev"
        aria-disabled={pagina <= 1}
        tabIndex={pagina <= 1 ? -1 : undefined}
        className={claseFlecha(pagina > 1)}
      >
        <span aria-hidden>←</span> Anterior
      </Link>
      <span className="text-sm text-muted-foreground tabular-nums">
        Página {pagina} de {paginas}
      </span>
      <Link
        href={siguiente}
        rel="next"
        aria-disabled={pagina >= paginas}
        tabIndex={pagina >= paginas ? -1 : undefined}
        className={claseFlecha(pagina < paginas)}
      >
        Siguiente <span aria-hidden>→</span>
      </Link>
    </nav>
  )
}

// --- El feed ----------------------------------------------------------------

export function Comunidad({
  posts,
  cursoId,
  cohortId = null,
  porGeneraciones = false,
  cursoSlug,
  soyEquipo,
  ruta,
  rutaDetalle,
  rutaNoticias,
  pagina,
  paginas,
  porPagina,
  total,
  extra = {},
  temas = [],
  temaActual = null,
  temasOcultos = [],
  yo = null,
  invitacion = 'Escribe algo…',
  intermedio = null,
  intermedioTras = 2,
  intermedioSoloMovil = false,
}: {
  posts: PostDeComunidad[]
  cursoId: string
  /** El muro de qué generación es (M16); null en cursos sin generaciones. */
  cohortId?: string | null
  porGeneraciones?: boolean
  cursoSlug: string
  soyEquipo: boolean
  /** Qué ruta revalidar al reaccionar o moderar: este mismo feed. */
  ruta: string
  /** Dónde vive cada publicación: `${rutaDetalle}/${id}`. */
  rutaDetalle: string
  /** V-AI-P: las noticias se abren en su sección (`${rutaNoticias}/${id}`). */
  rutaNoticias?: string
  pagina: number
  paginas: number
  porPagina: number
  total: number
  /** Parámetros que la paginación debe conservar (la generación del equipo). */
  extra?: Record<string, string>
  /** M17: los temas del muro. Sin temas, el muro es como siempre. */
  temas?: TemaDelMuro[]
  /** El slug del tema que se está filtrando, o null para el muro principal. */
  temaActual?: string | null
  /** Temas que no salen como filtro (en V-AI-P, Noticias tiene su pestaña). */
  temasOcultos?: string[]
  yo?: Yo | null
  /** El texto del «Escribe algo…». */
  invitacion?: string
  /**
   * Lo que va entre publicaciones (22-oct-2026): en el muro de V-AI-P, el
   * carrusel de noticias y el ranking, después de las primeras dos.
   */
  intermedio?: ReactNode
  intermedioTras?: number
  /** Desde `lg` lo intermedio vive en otra columna: aquí se esconde. */
  intermedioSoloMovil?: boolean
}) {
  const nombreDeTema = new Map(temas.map((t) => [t.id, t.nombre]))
  const elegido = temas.find((t) => t.slug === temaActual) ?? null
  const filtros = temas.filter((t) => !temasOcultos.includes(t.slug))
  const conTema = (slug: string | null) => {
    const q = new URLSearchParams(extra)
    if (slug) q.set('tema', slug)
    const cadena = q.toString()
    return cadena ? `${ruta}?${cadena}` : ruta
  }
  const tarjeta = (post: PostDeComunidad) => (
    <TarjetaPublicacion
      key={`${post.id}:${post.comentarios.length}:${post.reacciones.total}:${post.reacciones.mias.join('')}`}
      post={post}
      href={post.noticia && rutaNoticias ? `${rutaNoticias}/${post.id}` : `${rutaDetalle}/${post.id}`}
      cursoSlug={cursoSlug}
      ruta={ruta}
      soyEquipo={soyEquipo}
      temaNombre={post.temaId ? (nombreDeTema.get(post.temaId) ?? null) : null}
    />
  )
  const hrefPagina = (p: number) => {
    const params = new URLSearchParams(elegido ? { ...extra, tema: elegido.slug } : extra)
    if (p > 1) params.set('p', String(p))
    if (porPagina !== 10) params.set('por', String(porPagina))
    const cadena = params.toString()
    return cadena ? `${ruta}?${cadena}` : ruta
  }

  return (
    <div className="flex flex-col gap-4">
      {/* `key` es el reset: al publicarse algo cambia el conteo que manda el
          servidor, el <details> se remonta cerrado y los campos quedan limpios. */}
      <NuevaPublicacion
        key={`${total}:${cohortId ?? ''}`}
        cursoId={cursoId}
        cohortId={cohortId}
        porGeneraciones={porGeneraciones}
        soyEquipo={soyEquipo}
        cursoSlug={cursoSlug}
        ruta={ruta}
        temas={temas}
        temaActual={elegido}
        yo={yo}
        invitacion={invitacion}
      />

      {filtros.length > 0 ? (
        <nav
          aria-label="Temas"
          className="relative -mx-5 flex gap-2 overflow-x-auto px-5 pr-10 [scrollbar-width:none] [mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:[mask-image:none] [&::-webkit-scrollbar]:hidden"
        >
          {[{ slug: null, nombre: 'Todo' }, ...filtros.map((t) => ({ slug: t.slug, nombre: t.nombre }))].map((t) => {
            const activo = (t.slug ?? null) === (elegido?.slug ?? null)
            return (
              <Link
                key={t.slug ?? 'todo'}
                href={conTema(t.slug)}
                data-slot="destino"
                aria-current={activo ? 'true' : undefined}
                className={cn(
                  'inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors',
                  'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                  activo
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'
                )}
              >
                {t.nombre}
              </Link>
            )
          })}
        </nav>
      ) : null}

      {posts.length === 0 ? (
        <>
          {/* Sin publicaciones, lo que sí hay (noticias, ranking) va primero. */}
          {intermedio ? <div className={cn('flex flex-col gap-6 pb-2', intermedioSoloMovil && 'lg:hidden')}>{intermedio}</div> : null}
          <p className="rounded-[14px] border border-dashed border-border px-5 py-10 text-center text-[0.95rem] text-muted-foreground">
            {elegido ? 'Todavía no hay publicaciones en este tema.' : 'Todavía no hay publicaciones. Empieza la conversación.'}
          </p>
        </>
      ) : (
        <>
          <ul className="flex flex-col gap-3">{posts.slice(0, intermedioTras).map(tarjeta)}</ul>
          {intermedio ? <div className={cn('flex flex-col gap-6 py-2', intermedioSoloMovil && 'lg:hidden')}>{intermedio}</div> : null}
          {posts.length > intermedioTras ? (
            <ul className="flex flex-col gap-3">{posts.slice(intermedioTras).map(tarjeta)}</ul>
          ) : null}

          <Paginacion
            pagina={pagina}
            paginas={paginas}
            anterior={hrefPagina(Math.max(1, pagina - 1))}
            siguiente={hrefPagina(Math.min(paginas, pagina + 1))}
          />
        </>
      )}
    </div>
  )
}

// --- La publicación completa ---------------------------------------------------

/** Una respuesta, con su autor, su texto y su reacción. */
function Respuesta({
  comentario,
  ruta,
  soyEquipo,
}: {
  comentario: ComentarioDePost
  ruta: string
  soyEquipo: boolean
}) {
  return (
    <li className="flex gap-3">
      <Avatar nombre={comentario.autor.nombre} foto={comentario.autor.avatar} tamano={32} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="rounded-[14px] bg-muted/60 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
              <span className="font-medium">{comentario.autor.nombre}</span>
              <Insignia texto={insigniaDeAutor(comentario.autor, comentario.via)} />
              <span className="text-[0.8125rem] text-muted-foreground">{fechaCorta(comentario.creadoEn)}</span>
            </span>
            {soyEquipo ? <MenuDeRespuesta comentario={comentario} ruta={ruta} /> : null}
          </div>
          <p className="mt-1 text-[0.95rem] leading-relaxed break-words whitespace-pre-wrap">
            <TextoConLigas texto={comentario.contenido} />
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Reaccionar
            key={`${comentario.reacciones.total}:${comentario.reacciones.mias.join('')}`}
            datos={comentario.reacciones}
            comentarioId={comentario.id}
            ruta={ruta}
            chico
          />
          <ResumenDeReacciones datos={comentario.reacciones} className="text-xs" />
        </div>
      </div>
    </li>
  )
}

/**
 * La página de una publicación (22-oct-2026): el texto entero con letra de
 * lectura, la imagen, la noticia con su liga, la reacción y la conversación
 * abierta con el campo para responder arriba.
 *
 * `despues`: a dónde volver si el equipo la oculta o la borra desde aquí.
 */
export function PublicacionCompleta({
  post,
  cursoSlug,
  ruta,
  soyEquipo,
  temaNombre = null,
  despues,
}: {
  post: PostDeComunidad
  cursoSlug: string
  ruta: string
  soyEquipo: boolean
  temaNombre?: string | null
  despues: string
}) {
  const imagenesExtra = post.imagenes.slice(post.noticia ? 1 : 0)
  // La imagen de una noticia trae su título dibujado (lib/noticias/imagen.tsx):
  // va primero y el <h1> queda para el lector de pantalla, sin repetirlo.
  const portadaConTitulo = post.noticia && post.imagenes[0] ? post.imagenes[0] : null

  return (
    <article className="flex flex-col gap-6">
      {portadaConTitulo ? (
        <Image
          src={portadaConTitulo.url}
          alt=""
          width={1200}
          height={675}
          unoptimized
          priority
          className="-mx-5 aspect-video h-auto w-[calc(100%+2.5rem)] max-w-none object-cover sm:mx-0 sm:w-full sm:rounded-[14px] sm:border sm:border-border"
        />
      ) : null}

      <div className="flex items-start gap-2">
        <Autoria post={post} temaNombre={temaNombre} tamano={44} />
        {post.fijado ? <Fijado /> : null}
        <MenuDePublicacion post={post} cursoSlug={cursoSlug} ruta={ruta} soyEquipo={soyEquipo} despues={despues} />
      </div>

      <h1
        className={cn(
          'text-[1.625rem] leading-tight font-medium tracking-tight text-pretty [overflow-wrap:anywhere] sm:text-[2rem]',
          portadaConTitulo && 'sr-only'
        )}
      >
        {post.titulo}
      </h1>

      {post.noticia?.resumen ? (
        portadaConTitulo ? (
          // Con la portada, el resumen es el subtítulo de la nota.
          <p className="text-[1.25rem] leading-snug font-medium tracking-tight text-pretty sm:text-[1.5rem]">
            {post.noticia.resumen}
          </p>
        ) : (
          <p className="rounded-[14px] border-l-4 border-primary bg-primary/6 px-5 py-4 text-[1.0625rem] leading-relaxed text-pretty">
            {post.noticia.resumen}
          </p>
        )
      ) : null}

      {post.contenido ? (
        <div className="text-[1.0625rem] leading-relaxed">
          <RenderRico contenido={post.contenido} />
        </div>
      ) : null}

      {imagenesExtra.length > 0 ? (
        <div className={cn('grid gap-2', imagenesExtra.length > 1 && 'sm:grid-cols-2')}>
          {imagenesExtra.map((img) => (
            <Image
              key={img.url}
              src={img.url}
              alt=""
              width={1200}
              height={800}
              unoptimized
              className="h-auto w-full rounded-[10px] border border-border object-cover"
            />
          ))}
        </div>
      ) : null}

      {post.noticia?.url ? (
        <a
          href={post.noticia.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-5 text-[0.95rem] font-medium transition-colors hover:border-primary/50 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:w-fit"
        >
          {post.noticia.medio ? `Leer la nota original en ${post.noticia.medio}` : 'Abrir la nota original'}
          <span aria-hidden>↗</span>
        </a>
      ) : null}

      <div className="flex items-center gap-4 border-y border-border py-3">
        <Reaccionar
          key={`${post.reacciones.total}:${post.reacciones.mias.join('')}`}
          datos={post.reacciones}
          postId={post.id}
          ruta={ruta}
        />
        <ResumenDeReacciones datos={post.reacciones} />
      </div>

      <section aria-labelledby="respuestas" className="flex flex-col gap-5">
        <h2 id="respuestas" className="text-lg font-medium tracking-tight">
          {post.comentarios.length === 0
            ? 'Sé el primero en responder'
            : `${post.comentarios.length} respuesta${post.comentarios.length === 1 ? '' : 's'}`}
        </h2>

        {post.comentarios.length > 0 ? (
          <ul className="flex flex-col gap-4">
            {post.comentarios.map((c) => (
              <Respuesta key={c.id} comentario={c} ruta={ruta} soyEquipo={soyEquipo} />
            ))}
          </ul>
        ) : null}

        <Comentar key={post.comentarios.length} postId={post.id} cursoSlug={cursoSlug} ruta={ruta} />
      </section>
    </article>
  )
}

/** «Equipo VADAI», o la firma del agente (lib/agente/firma.ts). */
function Insignia({ texto }: { texto: string | null }) {
  if (!texto) return null
  return (
    <Badge variant="outline" className="text-[11px]">
      {texto}
    </Badge>
  )
}
