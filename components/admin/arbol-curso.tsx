import Link from 'next/link'

import { ConfirmarConModal } from '@/components/admin/confirmar-con-modal'
import { EditarLeccion } from '@/components/admin/editar-leccion'
import { EditarModulo } from '@/components/admin/editar-modulo'
import { NuevaLeccion } from '@/components/admin/nueva-leccion'
import { NuevoModulo } from '@/components/admin/nuevo-modulo'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { eliminarModulo, moverLeccion, moverModulo } from '@/lib/admin/acciones'
import type { CursoCompleto } from '@/lib/admin/consultas'
import { ETIQUETA_ESTADO_LECCION, ETIQUETA_TIPO_LECCION } from '@/lib/admin/tipos'
import { cn } from '@/lib/utils'

/**
 * Árbol de módulos y lecciones.
 *
 * Server component: cada acción es un `<form>` con su server action, sin estado
 * de cliente. Reordenar, editar y borrar no necesitan JavaScript para funcionar.
 *
 * §3.2 dice que botones subir/bajar bastan para el MVP, y así es: drag & drop
 * en móvil es peor experiencia que dos botones.
 *
 * M14 (21-sep-2026): hasta hoy aquí solo se podía MOVER. Renombrar un módulo
 * obligaba a borrarlo con sus lecciones y rehacerlo; renombrar o publicar una
 * lección, a abrirla una por una —publicar un módulo de quince eran quince
 * viajes—. Ahora cada módulo tiene "Editar módulo" y cada lección se abre en
 * su propio panel con título, tipo, estado, obligatoriedad y borrado.
 */

function BotonesDeOrden({
  id,
  padre,
  cursoId,
  accion,
  primero,
  ultimo,
  etiqueta,
}: {
  id: string
  padre: string
  cursoId: string
  accion: (datos: FormData) => Promise<void>
  primero: boolean
  ultimo: boolean
  etiqueta: string
}) {
  // UN formulario con dos botones de envío, no dos formularios (24-sep-2026):
  // el botón que se aprieta manda su `direccion`. Con 16 módulos y 34
  // lecciones eran 100 formularios solo para las flechas.
  return (
    <form action={accion} className="flex items-center">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="padre" value={padre} />
      <input type="hidden" name="course_id" value={cursoId} />
      {(['arriba', 'abajo'] as const).map((direccion) => (
        <Button
          key={direccion}
          type="submit"
          name="direccion"
          value={direccion}
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={direccion === 'arriba' ? primero : ultimo}
          aria-label={`Mover ${etiqueta} ${direccion}`}
          title={`Mover ${direccion}`}
        >
          {direccion === 'arriba' ? '↑' : '↓'}
        </Button>
      ))}
    </form>
  )
}

/**
 * El par "Editar/Cerrar" que hace de botón dentro del <summary> de una
 * lección. El control es el propio <summary>; esto solo dice que lo es.
 *
 * Las clases van literales: Tailwind lee el código fuente para generar el CSS,
 * y una clase armada con plantilla (`group-open/${x}:hidden`) no la encuentra.
 */
function PastillaEditar() {
  return (
    <span aria-hidden className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
      <span className="group-open/leccion:hidden">Editar</span>
      <span className="hidden group-open/leccion:inline">Cerrar</span>
    </span>
  )
}

/**
 * Solo se pinta lo que está abierto (24-sep-2026).
 *
 * Con 16 módulos y 34 lecciones, pintar el panel de edición de cada lección y
 * de cada módulo —aunque estuvieran plegados— eran 872 KB de HTML, más otro
 * tanto en la carga de hidratación, cada vez que se entraba al curso. Un
 * módulo cerrado ahora es solo su renglón; sus lecciones y formularios llegan
 * cuando se abre, con `?modulo=<id>` (o `?modulo=todos` para verlos todos).
 * Es el mismo patrón que `?sesion=` en el calendario.
 */
export function ArbolCurso({
  curso,
  moduloAbierto,
  cohortId = null,
  soloLectura = false,
}: {
  /** Con los módulos ya acotados a la generación de la pestaña (M16). */
  curso: CursoCompleto
  /** El id del módulo abierto, 'todos', o null. */
  moduloAbierto: string | null
  /** La generación de la pestaña: los módulos nuevos nacen en ella y los enlaces la conservan. */
  cohortId?: string | null
  /**
   * Para el community manager (0036): ve el temario y entra a cada lección a
   * subir su video o sus adjuntos, pero no crea, mueve, renombra ni borra.
   */
  soloLectura?: boolean
}) {
  const estaAbierto = (id: string) => moduloAbierto === 'todos' || moduloAbierto === id
  const raiz = `/admin/cursos/${curso.id}`
  const base = cohortId ? `${raiz}?gen=${cohortId}` : raiz
  const con = (q: string) => `${base}${cohortId ? '&' : '?'}${q}`
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium">Contenido</h2>
        <span className="flex flex-wrap items-center gap-3">
          {curso.modulos.length > 1 ? (
            <span className="inline-flex items-center gap-1 text-xs">
              <Link href={con('modulo=todos')} scroll={false} className="rounded-md px-2 py-1 text-primary hover:bg-primary/10">
                Expandir todo
              </Link>
              <span aria-hidden className="text-muted-foreground">·</span>
              <Link href={base} scroll={false} className="rounded-md px-2 py-1 text-primary hover:bg-primary/10">
                Contraer todo
              </Link>
            </span>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {curso.modulos.length} módulo(s) ·{' '}
            {curso.modulos.reduce((n, m) => n + m.lecciones.length, 0)} lección(es)
          </p>
        </span>
      </div>

      {curso.modulos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
          {soloLectura
            ? 'Este curso todavía no tiene módulos.'
            : <>Este curso todavía no tiene módulos. Crea el primero con &ldquo;Nuevo módulo&rdquo;.</>}
        </p>
      ) : null}

      {/*
        Cada módulo es un <details> (20-sep-2026): con ocho módulos y veintitrés
        lecciones el árbol completo ya no cabía en una pantalla. Cerrado enseña
        número, título y cuántas lecciones; abierto, sus lecciones y al pie los
        botones de editar, agregar y eliminar. Ninguno abre solo (24-sep-2026):
        el primero abría por defecto y, con dieciséis, la Sesión 1 amanecía
        desplegada cada vez que se entraba al curso; quien edita decide cuál
        abrir. Los botones de orden viven en el <summary> y no lo pliegan: el
        clic lo toma el botón.
      */}
      <ul className="flex flex-col gap-3">
        {curso.modulos.map((modulo, indiceModulo) => {
          const abierto = estaAbierto(modulo.id)
          const borradores = modulo.lecciones.filter((l) => l.status === 'draft').length
          // Lo que se ve en la fila, abierto o cerrado.
          const encabezado = (
            <>
              <span
                aria-hidden
                className="text-muted-foreground transition-transform group-open/modulo:rotate-90"
              >
                ›
              </span>
              <span className="font-mono text-xs text-muted-foreground">{indiceModulo + 1}</span>
              <span className="truncate font-medium">{modulo.title}</span>
              <span className="text-xs text-muted-foreground">
                {modulo.lecciones.length} lección(es)
                {borradores > 0 ? ` · ${borradores} en borrador` : ''}
              </span>
              {modulo.is_restricted ? (
                <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  Exclusiva · {modulo.miembros} {modulo.miembros === 1 ? 'persona' : 'personas'}
                </span>
              ) : null}
            </>
          )
          const claseFila = 'flex min-w-0 flex-1 flex-wrap items-center gap-2 px-3 py-2.5'
          return (
          <li key={modulo.id} id={`modulo-${modulo.id}`}>
            <details
              data-modulo
              open={abierto || undefined}
              className="group/modulo rounded-lg border border-border"
            >
              {/*
                Cerrado, TODA la fila es el enlace que lo abre (25-sep-2026): el
                cuerpo no viene en el HTML hasta que se pide con ?modulo=, así
                que plegar el <details> a mano no enseñaba nada y el chevron
                parecía roto: solo el título, que era el enlace, hacía algo.
                `scroll={false}` abre el módulo donde está, sin brincar al ancla
                (que sigue en el href para la carga sin JavaScript, donde la
                página vuelve a cargar desde arriba). Abierto, la fila es el
                <summary> de siempre: cierra al instante, sin ir al servidor.
              */}
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 pr-3 select-none [&::-webkit-details-marker]:hidden">
                {abierto ? (
                  <span className={claseFila}>{encabezado}</span>
                ) : (
                  <Link
                    href={`${con(`modulo=${modulo.id}`)}#modulo-${modulo.id}`}
                    scroll={false}
                    className={`${claseFila} rounded-l-lg transition-colors hover:bg-muted/40`}
                  >
                    {encabezado}
                  </Link>
                )}

                {soloLectura ? null : (
                  <BotonesDeOrden
                    id={modulo.id}
                    padre={curso.id}
                    cursoId={curso.id}
                    accion={moverModulo}
                    primero={indiceModulo === 0}
                    ultimo={indiceModulo === curso.modulos.length - 1}
                    etiqueta="módulo"
                  />
                )}
              </summary>

              {abierto ? (
                <>
              {/* Quién abre este módulo (0038). Lo maneja también el
                  community manager, así que va aunque el árbol sea de solo
                  lectura. */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/25 px-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  {modulo.is_restricted
                    ? `Sesión exclusiva: la abren ${modulo.miembros} ${modulo.miembros === 1 ? 'persona' : 'personas'}; el resto la ve con candado.`
                    : 'La abre toda la generación.'}
                </span>
                <Link
                  href={`/admin/modulos/${modulo.id}/acceso`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {modulo.is_restricted ? 'Editar quién entra →' : 'Hacerla exclusiva →'}
                </Link>
              </div>
              {modulo.lecciones.length > 0 ? (
                <ul className="border-t border-border">
                  {modulo.lecciones.map((leccion, indiceLeccion) => {
                    const numero = `${indiceModulo + 1}.${indiceLeccion + 1}`
                    if (soloLectura) {
                      return (
                        <li key={leccion.id} className="flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-2 last:border-b-0">
                          <span className="font-mono text-xs text-muted-foreground">{numero}</span>
                          <Link
                            href={`/admin/lecciones/${leccion.id}`}
                            className="truncate text-sm underline-offset-4 hover:underline"
                          >
                            {leccion.title}
                          </Link>
                          <Badge variant="outline" className="shrink-0 text-[11px]">
                            {ETIQUETA_TIPO_LECCION[leccion.lesson_type]}
                          </Badge>
                          {leccion.status === 'draft' ? (
                            <Badge variant="secondary" className="shrink-0 text-[11px]">
                              {ETIQUETA_ESTADO_LECCION.draft}
                            </Badge>
                          ) : null}
                        </li>
                      )
                    }
                    return (
                      <li key={leccion.id} className="border-b border-border/60 last:border-b-0">
                        <details data-leccion className="group/leccion">
                          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-2 transition-colors select-none hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                aria-hidden
                                className="text-muted-foreground transition-transform group-open/leccion:rotate-90"
                              >
                                ›
                              </span>
                              <span className="font-mono text-xs text-muted-foreground">{numero}</span>
                              {/* El título lleva al editor completo, que es a
                                  donde se va a subir el video o escribir el
                                  texto; el resto del renglón abre el panel. */}
                              <Link
                                href={`/admin/lecciones/${leccion.id}`}
                                className="truncate text-sm underline-offset-4 hover:underline"
                              >
                                {leccion.title}
                              </Link>
                              <Badge variant="outline" className="shrink-0 text-[11px]">
                                {ETIQUETA_TIPO_LECCION[leccion.lesson_type]}
                              </Badge>
                              {leccion.status === 'draft' ? (
                                <Badge variant="secondary" className="shrink-0 text-[11px]">
                                  {ETIQUETA_ESTADO_LECCION.draft}
                                </Badge>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-1">
                              <PastillaEditar />
                              <BotonesDeOrden
                                id={leccion.id}
                                padre={modulo.id}
                                cursoId={curso.id}
                                accion={moverLeccion}
                                primero={indiceLeccion === 0}
                                ultimo={indiceLeccion === modulo.lecciones.length - 1}
                                etiqueta="lección"
                              />
                            </div>
                          </summary>

                          <div className="border-t border-border/60 bg-muted/25 px-3 py-3">
                            <EditarLeccion
                              leccion={leccion}
                              cursoId={curso.id}
                              ubicacion={`${numero} · ${leccion.title}`}
                            />
                          </div>
                        </details>
                      </li>
                    )
                  })}
                </ul>
              ) : null}

              {soloLectura ? null : (
              <div className="flex flex-wrap items-start justify-between gap-2 border-t border-border px-3 py-2">
                <div className="flex flex-wrap items-start gap-2">
                  <NuevaLeccion
                    moduloId={modulo.id}
                    cursoId={curso.id}
                    reinicio={modulo.lecciones.length}
                    nombre={`modulo-${modulo.id}`}
                  />
                  <EditarModulo
                    moduloId={modulo.id}
                    cursoId={curso.id}
                    titulo={modulo.title}
                    nombre={`modulo-${modulo.id}`}
                  />
                </div>

                <ConfirmarConModal
                  idModal={`eliminar-modulo-${modulo.id}`}
                  accion={eliminarModulo}
                  campos={{ id: modulo.id, course_id: curso.id }}
                  boton={{
                    texto: 'Eliminar módulo',
                    etiquetaAccesible: `Eliminar el módulo ${modulo.title}`,
                    tono: 'destructivo',
                  }}
                  titulo={`¿Eliminar el módulo «${modulo.title}» y sus ${modulo.lecciones.length} lecciones?`}
                  confirmar={{ texto: 'Sí, eliminar', enCurso: 'Eliminando…', tono: 'destructivo' }}
                >
                  <p>
                    Se borra con sus lecciones: videos ligados, adjuntos, quizzes o tareas, y el
                    avance que los alumnos tuvieran en ellas. No se puede deshacer.
                  </p>
                </ConfirmarConModal>
              </div>
              )}
                </>
              ) : null}
            </details>
          </li>
          )
        })}
      </ul>

      {soloLectura ? null : <NuevoModulo cursoId={curso.id} cohortId={cohortId} reinicio={curso.modulos.length} />}
    </div>
  )
}
