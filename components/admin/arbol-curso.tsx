import Link from 'next/link'

import { ConfirmarConModal } from '@/components/admin/confirmar-con-modal'
import { ExpandirTodo } from '@/components/admin/expandir-todo'
import { NuevaLeccion } from '@/components/admin/nueva-leccion'
import { NuevoModulo } from '@/components/admin/nuevo-modulo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { eliminarModulo, moverLeccion, moverModulo } from '@/lib/admin/acciones'
import type { CursoCompleto } from '@/lib/admin/consultas'
import { ETIQUETA_ESTADO_LECCION, ETIQUETA_TIPO_LECCION } from '@/lib/admin/tipos'

/**
 * Árbol de módulos y lecciones.
 *
 * Server component: cada acción es un `<form>` con su server action, sin estado
 * de cliente. Reordenar y borrar no necesitan JavaScript para funcionar.
 *
 * §3.2 dice que botones subir/bajar bastan para el MVP, y así es: drag & drop
 * en móvil es peor experiencia que dos botones.
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
  return (
    <div className="flex items-center">
      {(['arriba', 'abajo'] as const).map((direccion) => {
        const deshabilitado = direccion === 'arriba' ? primero : ultimo
        return (
          <form key={direccion} action={accion}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="padre" value={padre} />
            <input type="hidden" name="course_id" value={cursoId} />
            <input type="hidden" name="direccion" value={direccion} />
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={deshabilitado}
              aria-label={`Mover ${etiqueta} ${direccion}`}
              title={`Mover ${direccion}`}
            >
              {direccion === 'arriba' ? '↑' : '↓'}
            </Button>
          </form>
        )
      })}
    </div>
  )
}

export function ArbolCurso({ curso }: { curso: CursoCompleto }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Contenido</h2>
        <span className="flex flex-wrap items-center gap-3">
          {curso.modulos.length > 1 ? <ExpandirTodo selector="details[data-modulo]" /> : null}
          <p className="text-sm text-muted-foreground">
            {curso.modulos.length} módulo(s) ·{' '}
            {curso.modulos.reduce((n, m) => n + m.lecciones.length, 0)} lección(es)
          </p>
        </span>
      </div>

      {curso.modulos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
          Este curso todavía no tiene módulos. Crea el primero con &ldquo;Nuevo módulo&rdquo;.
        </p>
      ) : null}

      {/*
        Cada módulo es un <details> (20-sep-2026): con ocho módulos y veintitrés
        lecciones el árbol completo ya no cabía en una pantalla. Cerrado enseña
        número, título y cuántas lecciones; abierto, las lecciones y al pie los
        botones "Nueva lección" y "Eliminar módulo" (M14: el de eliminar ya no
        vive en el <summary>, donde un formulario no es HTML válido, y pide
        confirmación). El primero abre solo. Los botones de orden sí viven en el
        <summary> y no lo pliegan: el clic lo toma el botón.
      */}
      <ul className="flex flex-col gap-3">
        {curso.modulos.map((modulo, indiceModulo) => (
          <li key={modulo.id}>
          <details data-modulo open={indiceModulo === 0} className="group/modulo rounded-lg border border-border">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-2.5 select-none [&::-webkit-details-marker]:hidden">
              <div className="flex min-w-0 items-center gap-2">
                <span aria-hidden className="text-muted-foreground transition-transform group-open/modulo:rotate-90">
                  ›
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {indiceModulo + 1}
                </span>
                <span className="truncate font-medium">{modulo.title}</span>
                <span className="text-xs text-muted-foreground">
                  {modulo.lecciones.length} lección(es)
                  {modulo.lecciones.some((l) => l.status === 'draft')
                    ? ` · ${modulo.lecciones.filter((l) => l.status === 'draft').length} en borrador`
                    : ''}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <BotonesDeOrden
                  id={modulo.id}
                  padre={curso.id}
                  cursoId={curso.id}
                  accion={moverModulo}
                  primero={indiceModulo === 0}
                  ultimo={indiceModulo === curso.modulos.length - 1}
                  etiqueta="módulo"
                />
              </div>
            </summary>

            {modulo.lecciones.length > 0 ? (
              <ul className="border-t border-border">
                {modulo.lecciones.map((leccion, indiceLeccion) => (
                  <li
                    key={leccion.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2 last:border-b-0"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {indiceModulo + 1}.{indiceLeccion + 1}
                      </span>
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

                    <BotonesDeOrden
                      id={leccion.id}
                      padre={modulo.id}
                      cursoId={curso.id}
                      accion={moverLeccion}
                      primero={indiceLeccion === 0}
                      ultimo={indiceLeccion === modulo.lecciones.length - 1}
                      etiqueta="lección"
                    />
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="flex flex-wrap items-start justify-between gap-2 border-t border-border px-3 py-2">
              <NuevaLeccion
                moduloId={modulo.id}
                cursoId={curso.id}
                reinicio={modulo.lecciones.length}
              />
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
          </details>
          </li>
        ))}
      </ul>

      <NuevoModulo cursoId={curso.id} reinicio={curso.modulos.length} />
    </div>
  )
}
