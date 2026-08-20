import Link from 'next/link'

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
        <p className="text-sm text-muted-foreground">
          {curso.modulos.length} módulo(s) ·{' '}
          {curso.modulos.reduce((n, m) => n + m.lecciones.length, 0)} lección(es)
        </p>
      </div>

      {curso.modulos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
          Este curso todavía no tiene módulos. Crea el primero abajo.
        </p>
      ) : null}

      <ul className="flex flex-col gap-4">
        {curso.modulos.map((modulo, indiceModulo) => (
          <li key={modulo.id} className="rounded-lg border border-border">
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                  {indiceModulo + 1}
                </span>
                <span className="truncate font-medium">{modulo.title}</span>
                <span className="text-xs text-muted-foreground">
                  {modulo.lecciones.length} lección(es)
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
                <form action={eliminarModulo}>
                  <input type="hidden" name="id" value={modulo.id} />
                  <input type="hidden" name="course_id" value={curso.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    // Borrar un módulo se lleva sus lecciones por cascada.
                    title="Eliminar el módulo y todas sus lecciones"
                  >
                    Eliminar
                  </Button>
                </form>
              </div>
            </div>

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

            <NuevaLeccion
              moduloId={modulo.id}
              cursoId={curso.id}
              reinicio={modulo.lecciones.length}
            />
          </li>
        ))}
      </ul>

      <NuevoModulo cursoId={curso.id} reinicio={curso.modulos.length} />
    </div>
  )
}
