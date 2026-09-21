import { ConfirmarConModal } from '@/components/admin/confirmar-con-modal'
import { EditarFilaDinamica } from '@/components/admin/editar-fila-dinamica'
import { NuevaFilaDinamica } from '@/components/admin/nueva-fila-dinamica'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Seccion } from '@/components/ui-vadai/superficie'
import { eliminarFila, moverFila } from '@/lib/dinamicas/acciones'
import { sumaPesos, TOLERANCIA_PESOS } from '@/lib/dinamicas/comun'
import type { DinamicaCompleta, FilaConUso } from '@/lib/dinamicas/consultas'
import { cn } from '@/lib/utils'

/**
 * Las filas de una dinámica —criterios con peso y filas informativas— en el
 * orden en que las ve cada empresa en su tablero. Calco de
 * `constructor-encuesta.tsx`.
 *
 * Server component: cada acción es un `<form>` con su server action, sin
 * estado de cliente. Lo único cliente son los formularios de alta y edición,
 * que necesitan `useActionState` para enseñar su error sin recargar, y el
 * modal de confirmación.
 *
 * La línea de pesos es la brújula de la pantalla: abrir exige que sumen 100,
 * y aquí se ve en todo momento cuánto falta o sobra.
 */

const claseResumen =
  'inline-flex w-fit cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-1.5 ' +
  'text-sm font-medium text-muted-foreground transition-colors select-none ' +
  'hover:bg-muted hover:text-foreground ' +
  'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ' +
  '[&::-webkit-details-marker]:hidden'

function Fila({
  fila,
  indice,
  total,
  dinamicaId,
  abierta,
}: {
  fila: FilaConUso
  indice: number
  total: number
  dinamicaId: string
  abierta: boolean
}) {
  const esCriterio = fila.tipo === 'criterio'
  const bloqueada = abierta && esCriterio

  return (
    <li className="flex flex-col gap-3 rounded-[10px] border border-border px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground tabular-nums">{indice + 1}.</span>
            <span className="font-medium">{fila.etiqueta}</span>
            {esCriterio ? (
              <Badge variant="secondary" className="shrink-0 tabular-nums">
                {fila.peso} %
              </Badge>
            ) : (
              <Badge variant="outline" className="shrink-0">
                Informativa
              </Badge>
            )}
          </span>

          <span className="text-xs text-muted-foreground tabular-nums">
            {esCriterio
              ? `Entra al ponderado · ${fila.celdas} celda(s) llena(s)`
              : 'Texto libre por proyecto, no entra al ponderado'}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <form action={moverFila}>
            <input type="hidden" name="id" value={fila.id} />
            <input type="hidden" name="dynamic_id" value={dinamicaId} />
            <input type="hidden" name="direccion" value="arriba" />
            <Button
              type="submit"
              variant="ghost"
              size="icon-sm"
              disabled={indice === 0 || abierta}
              aria-label={`Subir la fila ${indice + 1}`}
            >
              <Flecha arriba />
            </Button>
          </form>

          <form action={moverFila}>
            <input type="hidden" name="id" value={fila.id} />
            <input type="hidden" name="dynamic_id" value={dinamicaId} />
            <input type="hidden" name="direccion" value="abajo" />
            <Button
              type="submit"
              variant="ghost"
              size="icon-sm"
              disabled={indice === total - 1 || abierta}
              aria-label={`Bajar la fila ${indice + 1}`}
            >
              <Flecha />
            </Button>
          </form>

          {/* SIEMPRE con confirmación: borrar un criterio se lleva sus
              calificaciones en todos los tableros, y el modal dice cuántas. */}
          <ConfirmarConModal
            idModal={`eliminar-fila-${fila.id}`}
            accion={eliminarFila}
            campos={{ id: fila.id, dynamic_id: dinamicaId }}
            boton={{
              texto: 'Eliminar',
              etiquetaAccesible: `Eliminar la fila ${fila.etiqueta}`,
              tono: 'destructivo',
            }}
            titulo={`¿Eliminar «${fila.etiqueta}»?`}
            confirmar={{ texto: 'Sí, eliminar', enCurso: 'Eliminando…', tono: 'destructivo' }}
          >
            {fila.celdas === 0 ? (
              <p>No tiene calificaciones todavía.</p>
            ) : (
              <p>
                Se borran también sus{' '}
                <span className="font-medium text-foreground tabular-nums">
                  {fila.celdas} calificaciones
                </span>{' '}
                en {fila.tableros} tablero(s). No hay manera de recuperarlas.
              </p>
            )}
            {bloqueada ? (
              <p>Está abierta: los criterios no se borran hasta que la cierres.</p>
            ) : null}
          </ConfirmarConModal>
        </div>
      </div>

      {/* La edición va en un `<details>` y no en otra página: corregir un
          nombre no debería costar una navegación, y así la lista sigue
          mostrando el orden mientras se edita. */}
      <details className="border-t border-border pt-2">
        <summary className={claseResumen}>
          <Lapiz /> Editar
        </summary>
        <div className="px-1 pt-4 pb-1">
          <EditarFilaDinamica dinamicaId={dinamicaId} fila={fila} abierta={abierta} />
        </div>
      </details>
    </li>
  )
}

export function ConstructorDinamica({ dinamica }: { dinamica: DinamicaCompleta }) {
  const { filas } = dinamica
  const abierta = dinamica.estadoEfectivo === 'open'
  const criterios = filas.filter((f) => f.tipo === 'criterio').length
  const informativas = filas.length - criterios
  const suma = sumaPesos(filas)
  const diferencia = Math.round((100 - suma) * 100) / 100
  const suman100 = Math.abs(diferencia) <= TOLERANCIA_PESOS

  return (
    <Seccion
      titulo="Criterios"
      apoyo={
        filas.length === 0
          ? 'Todavía no hay ninguno. Agrega el primero abajo.'
          : `${criterios} criterio(s) y ${informativas} fila(s) informativa(s), en el orden en que se ven en el tablero.`
      }
    >
      <p role="status" className="text-sm tabular-nums">
        Pesos:{' '}
        <span className={cn('font-medium', !suman100 && 'text-destructive')}>{suma}</span> de 100
        {suman100
          ? ' · listos para abrirla'
          : diferencia > 0
            ? ` · faltan ${diferencia} para poder abrirla`
            : ` · sobran ${-diferencia} para poder abrirla`}
      </p>

      {filas.length > 0 ? (
        <ol className="flex flex-col gap-3">
          {filas.map((fila, indice) => (
            <Fila
              key={fila.id}
              fila={fila}
              indice={indice}
              total={filas.length}
              dinamicaId={dinamica.id}
              abierta={abierta}
            />
          ))}
        </ol>
      ) : null}

      <NuevaFilaDinamica
        dinamicaId={dinamica.id}
        suma={suma}
        abierta={abierta}
        reinicio={filas.length}
      />
    </Seccion>
  )
}

function Flecha({ arriba = false }: { arriba?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5"
    >
      {arriba ? <path d="m18 15-6-6-6 6" /> : <path d="m6 9 6 6 6-6" />}
    </svg>
  )
}

function Lapiz() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}
