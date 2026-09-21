'use client'

import { usePathname, useRouter } from 'next/navigation'
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Seccion } from '@/components/ui-vadai/superficie'
import { SIN_ESTADO } from '@/lib/admin/tipos'
import {
  agregarColumna,
  eliminarColumna,
  guardarTablero,
  puntuarCelda,
  renombrarColumna,
} from '@/lib/dinamicas/acciones-tablero'
import {
  claveCelda,
  formatearPonderado,
  ganadoras,
  iniciales,
  ponderadoDeColumna,
  validarValorDeCelda,
  TOPE_ETIQUETA_COLUMNA,
  TOPE_TEXTO_INFORMATIVO,
  type CeldaTablero,
  type ColumnaTablero,
  type FilaDinamica,
  type TableroParaPintar,
} from '@/lib/dinamicas/comun'
import { cn } from '@/lib/utils'

/**
 * La matriz de decisión ponderada que llena una empresa.
 *
 * Criterios en las filas (los fija el equipo), proyectos en las columnas (los
 * agrega la empresa), una calificación por celda y el ponderado al pie: el
 * Excel de la sesión 1, pero compartido. Todos los miembros editan el MISMO
 * tablero y cada celda guarda una sola calificación —la última— firmada por
 * quien la puso. Eso se dice como regla, arriba de la tabla, no como aviso.
 *
 * SIN JAVASCRIPT todo funciona: las celdas son inputs asociados por
 * `form="matriz"` a un <form> vacío cuya acción es `guardarTablero`, que
 * aplica solo lo que difiere de los `orig:` ocultos; agregar, renombrar y
 * borrar proyectos son formularios dentro de popovers nativos, que se abren
 * con `popovertarget` desde HTML. Nada de <form> anidado ni <details> dentro
 * de un <th>: el overflow de la tabla lo recortaría.
 *
 * CON JAVASCRIPT se guarda al salir de cada celda (`puntuarCelda` en una
 * transición), Enter pasa a la celda siguiente de la fila, y un sondeo cada
 * tres segundos (molde: components/encuestas/pulso.tsx) refresca cuando cambia
 * el ETag y no hay guardado en vuelo. Al llegar datos nuevos se reconcilian:
 * se sueltan los borradores ya guardados o iguales al servidor, JAMÁS la celda
 * con foco; lo que cambió alguien más entra con un fundido.
 */

const CADENCIA_MS = 3000

const CLASE_CELDA_BASE =
  'h-9 rounded-lg border border-input bg-transparent text-sm outline-none transition-colors ' +
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 ' +
  'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20'

const CLASE_NUMERO =
  CLASE_CELDA_BASE +
  ' w-16 text-center tabular-nums [appearance:textfield] ' +
  '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

const CLASE_TEXTO = CLASE_CELDA_BASE + ' w-full min-w-24 px-2 text-left'

const CLASE_INICIALES =
  'rounded-full bg-card px-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase'

const CLASE_POPOVER =
  'm-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-lg ' +
  'border border-border bg-popover p-5 text-popover-foreground shadow-lg backdrop:bg-black/50'

type EstadoLocal = 'editando' | 'guardando' | 'guardada' | 'error'
type Local = { texto: string; estado: EstadoLocal; mensaje?: string }

function idCelda(filaId: string, columnaId: string): string {
  return `celda-${filaId}-${columnaId}`
}

function valorDe(celda: CeldaTablero | undefined): string {
  if (!celda) return ''
  return celda.numero !== null ? String(celda.numero) : (celda.texto ?? '')
}

/** "20", "33.33": sin ceros de más y sin depender del locale (hidratación). */
function formatearPeso(peso: number | null): string {
  return peso === null ? '' : String(Math.round(peso * 100) / 100)
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`
}

export function Tablero({
  tablero,
  puedeEscribir,
  soyAdmin,
  miUserId,
}: {
  tablero: TableroParaPintar
  puedeEscribir: boolean
  soyAdmin: boolean
  miUserId: string
}) {
  const router = useRouter()
  const ruta = usePathname()
  const [, iniciarTransicion] = useTransition()
  const [estadoGuardar, enviarGuardar] = useActionState(guardarTablero, SIN_ESTADO)

  // Solo las celdas tocadas: lo demás se lee del servidor tal cual llega.
  const [local, setLocal] = useState<Record<string, Local>>({})
  // Celda → versión en la que alguien más la cambió (para el fundido).
  const [resaltadas, setResaltadas] = useState<Record<string, number>>({})
  const [ultimoGuardado, setUltimoGuardado] = useState(false)

  const activa = useRef<string | null>(null)
  const enVuelo = useRef(0)
  const previas = useRef<CeldaTablero[]>(tablero.celdas)
  const etiqueta = useRef<string | null>(`"${tablero.version}-${tablero.estado}"`)

  const celdasServidor = useMemo(() => {
    const m = new Map<string, CeldaTablero>()
    for (const c of tablero.celdas) m.set(claveCelda(c.filaId, c.columnaId), c)
    return m
  }, [tablero.celdas])

  const filaPorId = useMemo(() => new Map(tablero.filas.map((f) => [f.id, f])), [tablero.filas])
  const criterios = useMemo(() => tablero.filas.filter((f) => f.tipo === 'criterio'), [tablero.filas])

  // Lo que se ve y con lo que se calcula el pie: servidor + borrador válido.
  const celdasEfectivas = useMemo(() => {
    const m = new Map<string, { numero: number | null }>()
    for (const [clave, c] of celdasServidor) m.set(clave, { numero: c.numero })
    for (const [clave, l] of Object.entries(local)) {
      const [filaId] = clave.split(':')
      const fila = filaId ? filaPorId.get(filaId) : undefined
      if (!fila || fila.tipo !== 'criterio') continue
      const v = validarValorDeCelda(fila, tablero.escala, l.texto)
      if (v.ok && v.numero !== null) m.set(clave, { numero: v.numero })
      else m.delete(clave)
    }
    return m
  }, [celdasServidor, filaPorId, local, tablero.escala])

  const mejores = useMemo(
    () => ganadoras(tablero.filas, celdasEfectivas, tablero.columnas),
    [tablero.filas, celdasEfectivas, tablero.columnas]
  )

  // --- reconciliación al llegar datos nuevos ---------------------------------
  useEffect(() => {
    etiqueta.current = `"${tablero.version}-${tablero.estado}"`

    const anteriores = new Map(previas.current.map((c) => [claveCelda(c.filaId, c.columnaId), c]))
    const nuevas: Record<string, number> = {}
    for (const clave of new Set([...anteriores.keys(), ...celdasServidor.keys()])) {
      const antes = anteriores.get(clave)
      const ahora = celdasServidor.get(clave)
      if (valorDe(antes) === valorDe(ahora)) continue
      if ((ahora ?? antes)?.editadaPor === miUserId) continue
      if (clave === activa.current) continue
      nuevas[clave] = tablero.version
    }
    previas.current = tablero.celdas
    if (Object.keys(nuevas).length > 0) setResaltadas((r) => ({ ...r, ...nuevas }))

    setLocal((actual) => {
      let cambio = false
      const siguiente = { ...actual }
      for (const [clave, l] of Object.entries(actual)) {
        if (clave === activa.current) continue
        const servidor = valorDe(celdasServidor.get(clave))
        if (l.estado === 'guardada' || (l.estado === 'editando' && l.texto.trim() === servidor)) {
          delete siguiente[clave]
          cambio = true
        }
      }
      return cambio ? siguiente : actual
    })
  }, [tablero.version, tablero.estado, tablero.celdas, celdasServidor, miUserId])

  // --- sondeo: refresca cuando cambia el ETag y no hay guardado en vuelo -----
  useEffect(() => {
    let vivo = true

    async function latir() {
      if (document.visibilityState !== 'visible') return
      if (enVuelo.current > 0) return

      try {
        const respuesta = await fetch(`/api/dinamicas/${tablero.id}/estado`, {
          cache: 'no-store',
          headers: etiqueta.current ? { 'if-none-match': etiqueta.current } : {},
        })
        if (respuesta.status === 304 || !respuesta.ok) return

        const nueva = respuesta.headers.get('etag')
        if (!nueva || nueva === etiqueta.current) return
        etiqueta.current = nueva
        if (vivo && enVuelo.current === 0) router.refresh()
      } catch {
        // Red caída: se reintenta al siguiente latido sin decirle nada a nadie.
      }
    }

    const reloj = window.setInterval(latir, CADENCIA_MS)
    document.addEventListener('visibilitychange', latir)
    return () => {
      vivo = false
      window.clearInterval(reloj)
      document.removeEventListener('visibilitychange', latir)
    }
  }, [tablero.id, router])

  // --- edición de celdas ------------------------------------------------------
  function alCambiar(clave: string, texto: string) {
    setUltimoGuardado(false)
    setLocal((l) => ({ ...l, [clave]: { texto, estado: 'editando' } }))
  }

  function confirmar(clave: string, fila: FilaDinamica, columnaId: string) {
    const l = local[clave]
    if (!l || l.estado !== 'editando') return

    if (l.texto.trim() === valorDe(celdasServidor.get(clave))) {
      setLocal((actual) => {
        const { [clave]: _fuera, ...resto } = actual
        return resto
      })
      return
    }

    const validado = validarValorDeCelda(fila, tablero.escala, l.texto)
    if (!validado.ok) {
      setLocal((actual) => ({
        ...actual,
        [clave]: { texto: l.texto, estado: 'error', mensaje: validado.error },
      }))
      return
    }

    setLocal((actual) => ({ ...actual, [clave]: { texto: l.texto, estado: 'guardando' } }))
    enVuelo.current += 1

    iniciarTransicion(async () => {
      const r = await puntuarCelda({
        boardId: tablero.id,
        rowId: fila.id,
        columnId: columnaId,
        valor: l.texto,
      })
      enVuelo.current = Math.max(0, enVuelo.current - 1)

      setLocal((actual) => {
        const vigente = actual[clave]
        // Siguió escribiendo mientras se guardaba: se respeta lo nuevo.
        if (!vigente || vigente.texto !== l.texto) return actual
        return {
          ...actual,
          [clave]: r.ok
            ? { texto: l.texto, estado: 'guardada' }
            : { texto: l.texto, estado: 'error', mensaje: r.error },
        }
      })
      if (r.ok) setUltimoGuardado(true)
    })
  }

  function alTeclear(e: KeyboardEvent<HTMLInputElement>, filaId: string, indice: number) {
    if (e.key !== 'Enter') return
    // Sin esto Enter enviaría el <form> completo; con JavaScript se guarda la
    // celda al perder el foco y se pasa a la siguiente del renglón.
    e.preventDefault()
    const siguiente = tablero.columnas[indice + 1]
    if (siguiente) document.getElementById(idCelda(filaId, siguiente.id))?.focus()
    else e.currentTarget.blur()
  }

  // --- estado de la barra -----------------------------------------------------
  const guardando = Object.values(local).some((l) => l.estado === 'guardando')
  const conError = Object.values(local).filter((l) => l.estado === 'error')

  const soloLectura = !puedeEscribir

  return (
    <div className="flex flex-col gap-8">
      <Seccion
        titulo="Proyectos"
        apoyo={`${plural(criterios.length, 'criterio', 'criterios')} · ${plural(tablero.columnas.length, 'proyecto', 'proyectos')}`}
      >
        <p className="text-sm text-muted-foreground">
          {tablero.empresa
            ? 'Todo tu equipo edita el mismo tablero. Cada celda guarda una sola calificación —la última que alguien escriba— y se ve quién la puso.'
            : 'Este tablero es solo tuyo. Cada celda guarda una sola calificación —la última que escribas— y se ve quién la puso.'}
        </p>

        {puedeEscribir ? (
          <form id="matriz" action={enviarGuardar}>
            <input type="hidden" name="board_id" value={tablero.id} />
            <input type="hidden" name="dynamic_id" value={tablero.dinamicaId} />
          </form>
        ) : null}

        <div className="rounded-[10px] border border-border bg-card">
          <div className="overflow-x-auto [scrollbar-width:none] [scroll-padding-left:8rem] [mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)] sm:[scroll-padding-left:11rem] [&::-webkit-scrollbar]:hidden">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <caption className="sr-only">
                {tablero.empresa
                  ? `Matriz de decisión de ${tablero.empresa}: criterios por proyecto`
                  : 'Tu matriz de decisión: criterios por proyecto'}
              </caption>

              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 z-20 w-32 bg-card px-3 py-2.5 text-left font-medium shadow-[1px_0_0_var(--border)] sm:w-44"
                  >
                    Criterio · peso
                  </th>

                  {tablero.columnas.map((c) => {
                    const ajena = c.creadaPor && c.creadaPor !== miUserId ? c.creadaPorNombre : null
                    return (
                      <th
                        key={c.id}
                        scope="col"
                        id={`col-${c.id}`}
                        className="min-w-28 px-3 py-2.5 text-left align-top font-medium text-foreground sm:min-w-32"
                      >
                        <span className="block text-sm text-pretty break-words">{c.etiqueta}</span>
                        <span className="flex items-center justify-between gap-1">
                          {ajena ? (
                            <Iniciales
                              nombre={ajena}
                              verbo="Lo agregó"
                              className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase"
                            />
                          ) : (
                            <span />
                          )}
                          {puedeEscribir ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              popoverTarget={`proyecto-${c.id}`}
                              aria-haspopup="dialog"
                              aria-label={`Opciones de ${c.etiqueta}`}
                            >
                              ⋯
                            </Button>
                          ) : null}
                        </span>
                      </th>
                    )
                  })}

                  <th scope="col" className="w-full px-3 py-2.5 text-left align-top">
                    {puedeEscribir ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        popoverTarget="nuevo-proyecto"
                        aria-haspopup="dialog"
                      >
                        + Agregar proyecto
                      </Button>
                    ) : null}
                  </th>
                </tr>
              </thead>

              <tbody>
                {tablero.filas.map((f) => (
                  <tr key={f.id}>
                    <th
                      scope="row"
                      id={`fila-${f.id}`}
                      className="sticky left-0 z-10 border-t border-border bg-card px-3 py-2 text-left align-middle shadow-[1px_0_0_var(--border)]"
                    >
                      <span className="block text-xs leading-snug font-medium text-pretty sm:text-sm">
                        {f.etiqueta}
                      </span>
                      <span className="block text-[11px] text-muted-foreground tabular-nums">
                        {f.tipo === 'criterio' ? `${formatearPeso(f.peso)} %` : 'Dato'}
                      </span>
                    </th>

                    {tablero.columnas.map((c, i) => {
                      const clave = claveCelda(f.id, c.id)
                      const celda = celdasServidor.get(clave)
                      const servidor = valorDe(celda)
                      const l = local[clave]
                      const mostrado = l?.texto ?? servidor
                      const ajena =
                        celda?.editadaPor && celda.editadaPor !== miUserId
                          ? (celda.editadaPorNombre ?? 'Alguien más')
                          : null
                      const resaltada = resaltadas[clave]

                      return (
                        <td
                          // Cambiar la llave remonta la celda y vuelve a correr
                          // el fundido. Nunca es la celda con foco.
                          key={`${clave}:${resaltada ?? 0}`}
                          className={cn(
                            'relative border-t border-border px-3 py-2 text-center align-middle',
                            resaltada !== undefined && 'animate-in fade-in duration-500'
                          )}
                        >
                          {soloLectura ? (
                            <span className="relative inline-block">
                              {mostrado === '' ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <span className="tabular-nums">{mostrado}</span>
                              )}
                              {ajena ? (
                                <Iniciales
                                  nombre={ajena}
                                  verbo="Calificó"
                                  className={cn(CLASE_INICIALES, 'absolute -top-3 -right-4')}
                                />
                              ) : null}
                            </span>
                          ) : (
                            <span className="relative inline-block max-w-full">
                              {f.tipo === 'criterio' ? (
                                <input
                                  id={idCelda(f.id, c.id)}
                                  type="number"
                                  form="matriz"
                                  name={`celda:${f.id}:${c.id}`}
                                  value={mostrado}
                                  onChange={(e) => alCambiar(clave, e.target.value)}
                                  onFocus={() => {
                                    activa.current = clave
                                  }}
                                  onBlur={() => {
                                    if (activa.current === clave) activa.current = null
                                    confirmar(clave, f, c.id)
                                  }}
                                  onKeyDown={(e) => alTeclear(e, f.id, i)}
                                  min={tablero.escala.min}
                                  max={tablero.escala.max}
                                  step={1}
                                  inputMode="numeric"
                                  aria-labelledby={`col-${c.id} fila-${f.id}`}
                                  aria-invalid={l?.estado === 'error' || undefined}
                                  title={l?.estado === 'error' ? l.mensaje : undefined}
                                  className={cn(CLASE_NUMERO, mostrado === '' && 'border-dashed')}
                                />
                              ) : (
                                <input
                                  id={idCelda(f.id, c.id)}
                                  type="text"
                                  form="matriz"
                                  name={`celda:${f.id}:${c.id}`}
                                  value={mostrado}
                                  onChange={(e) => alCambiar(clave, e.target.value)}
                                  onFocus={() => {
                                    activa.current = clave
                                  }}
                                  onBlur={() => {
                                    if (activa.current === clave) activa.current = null
                                    confirmar(clave, f, c.id)
                                  }}
                                  onKeyDown={(e) => alTeclear(e, f.id, i)}
                                  maxLength={TOPE_TEXTO_INFORMATIVO}
                                  aria-labelledby={`col-${c.id} fila-${f.id}`}
                                  aria-invalid={l?.estado === 'error' || undefined}
                                  title={l?.estado === 'error' ? l.mensaje : undefined}
                                  className={cn(CLASE_TEXTO, mostrado === '' && 'border-dashed')}
                                />
                              )}
                              <input
                                type="hidden"
                                form="matriz"
                                name={`orig:${f.id}:${c.id}`}
                                value={servidor}
                              />
                              {ajena ? (
                                <Iniciales
                                  nombre={ajena}
                                  verbo="Calificó"
                                  className={cn(CLASE_INICIALES, 'absolute -top-1.5 -right-1.5')}
                                />
                              ) : null}
                            </span>
                          )}
                        </td>
                      )
                    })}

                    <td className="border-t border-border" />
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-t border-border bg-card px-3 py-2.5 text-left align-middle font-medium shadow-[1px_0_0_var(--border)]"
                  >
                    <span className="block text-xs leading-snug sm:text-sm">Calificación ponderada</span>
                  </th>

                  {tablero.columnas.map((c) => {
                    const p = ponderadoDeColumna(tablero.filas, celdasEfectivas, c.id)
                    const mejor = mejores.has(c.id)
                    return (
                      <td
                        key={c.id}
                        className={cn(
                          'border-t border-border px-3 py-2.5 text-center align-middle',
                          mejor && 'bg-accent text-accent-foreground'
                        )}
                      >
                        {p.completa ? (
                          <>
                            <span className="block text-base font-medium tabular-nums">
                              {formatearPonderado(p.valor)}
                            </span>
                            {mejor ? (
                              <span className="text-[10px] font-medium tracking-[0.15em] uppercase">
                                Mejor
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <span className="block text-base font-medium text-muted-foreground tabular-nums">
                              —
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              faltan {p.deCriterios - p.puntuados}
                            </span>
                          </>
                        )}
                      </td>
                    )
                  })}

                  <td className="border-t border-border" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {tablero.columnas.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            {puedeEscribir
              ? 'Todavía no hay proyectos. Agrega el primero con «Agregar proyecto».'
              : 'Todavía no hay proyectos en este tablero.'}
          </p>
        ) : null}

        {puedeEscribir ? (
          <>
            <AvisoAccion estado={estadoGuardar} />

            <div className="sticky bottom-0 z-10 -mx-5 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/85 px-5 py-2 backdrop-blur-md sm:mx-0 sm:rounded-lg sm:border sm:px-3">
              <p
                role="status"
                aria-live="polite"
                className={cn(
                  'text-xs text-muted-foreground',
                  conError.length > 0 && !guardando && 'text-destructive',
                  conError.length === 0 && !guardando && ultimoGuardado && 'text-exito'
                )}
              >
                {guardando ? (
                  'Guardando…'
                ) : conError.length > 0 ? (
                  <>
                    No se pudo guardar {plural(conError.length, 'celda', 'celdas')}. Las marcadas
                    conservan tu número; toca Guardar para reintentar.
                    {conError[0]?.mensaje ? ` ${conError[0].mensaje}` : ''}
                  </>
                ) : ultimoGuardado ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Palomita /> Guardado
                  </span>
                ) : null}
              </p>

              <span className="flex items-center gap-3">
                <a href={ruta} className="text-sm text-primary underline-offset-4 hover:underline">
                  Actualizar
                </a>
                <Button type="submit" form="matriz">
                  Guardar
                </Button>
              </span>
            </div>
          </>
        ) : null}
      </Seccion>

      {/* Los popovers viven fuera de la tabla: en el top layer no los recorta
          el overflow, y así ningún <form> queda dentro de un <th>. */}
      {puedeEscribir ? (
        <>
          <PopoverNuevoProyecto tablero={tablero} />
          {tablero.columnas.map((c) => (
            <PopoverProyecto
              key={c.id}
              columna={c}
              tablero={tablero}
              puedeBorrar={soyAdmin || c.creadaPor === miUserId}
              calificaciones={tablero.celdas.filter((x) => x.columnaId === c.id).length}
            />
          ))}
        </>
      ) : null}

      {tablero.columnas.length > 0 ? (
        <Seccion titulo="Resultado" apoyo="Del mejor al que le falta">
          <Resultado
            filas={tablero.filas}
            columnas={tablero.columnas}
            celdas={celdasEfectivas}
            mejores={mejores}
          />
        </Seccion>
      ) : null}
    </div>
  )
}

// --------------------------------------------------------------------------
// Resultado: el pie legible en móvil, sin desplazar la tabla
// --------------------------------------------------------------------------

function Resultado({
  filas,
  columnas,
  celdas,
  mejores,
}: {
  filas: FilaDinamica[]
  columnas: ColumnaTablero[]
  celdas: ReadonlyMap<string, { numero: number | null }>
  mejores: ReadonlySet<string>
}) {
  const conPonderado = columnas.map((c) => ({
    columna: c,
    ponderado: ponderadoDeColumna(filas, celdas, c.id),
  }))

  // Completas primero, de mayor a menor; luego las que van a medias, por
  // cuántos criterios llevan. Empate en el valor = mismo lugar.
  const ordenadas = [...conPonderado].sort((a, b) => {
    if (a.ponderado.completa !== b.ponderado.completa) return a.ponderado.completa ? -1 : 1
    if (a.ponderado.completa) return (b.ponderado.valor ?? 0) - (a.ponderado.valor ?? 0)
    return b.ponderado.puntuados - a.ponderado.puntuados
  })

  let posicion = 0
  let previo: number | null | undefined
  const filasListas = ordenadas.map((r, i) => {
    const valor = r.ponderado.completa ? r.ponderado.valor : null
    if (!(i > 0 && valor !== null && valor === previo)) posicion = i + 1
    previo = valor
    return { ...r, posicion }
  })

  return (
    <ol className="flex flex-col gap-1.5">
      {filasListas.map((r) => {
        const mejor = mejores.has(r.columna.id)
        const faltan = r.ponderado.deCriterios - r.ponderado.puntuados
        return (
          <li
            key={r.columna.id}
            className={cn('flex items-center gap-3 rounded-xl px-3 py-2', mejor && 'bg-muted/60')}
          >
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums',
                mejor
                  ? 'bg-vadai-lima text-vadai-navy'
                  : r.posicion === 2
                    ? 'bg-foreground/10 text-foreground'
                    : r.posicion === 3
                      ? 'bg-accent/40 text-foreground'
                      : 'text-muted-foreground'
              )}
              aria-label={`Lugar ${r.posicion}`}
            >
              {r.posicion}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{r.columna.etiqueta}</span>
            </span>
            {r.ponderado.completa ? (
              <span className="shrink-0 text-sm font-semibold text-primary tabular-nums">
                {formatearPonderado(r.ponderado.valor)}
              </span>
            ) : (
              <span className="shrink-0 text-xs text-muted-foreground">
                faltan {plural(faltan, 'criterio', 'criterios')}
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

// --------------------------------------------------------------------------
// Popovers: agregar, renombrar y eliminar proyectos
// --------------------------------------------------------------------------

function BotonEnviar({
  texto,
  enCurso,
  variant = 'default',
  size = 'default',
}: {
  texto: string
  enCurso: string
  variant?: 'default' | 'destructive'
  size?: 'default' | 'sm'
}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending}>
      {pending ? enCurso : texto}
    </Button>
  )
}

function CamposDelTablero({ tablero }: { tablero: TableroParaPintar }) {
  return (
    <>
      <input type="hidden" name="board_id" value={tablero.id} />
      <input type="hidden" name="dynamic_id" value={tablero.dinamicaId} />
    </>
  )
}

function PopoverNuevoProyecto({ tablero }: { tablero: TableroParaPintar }) {
  const [estado, accion] = useActionState(agregarColumna, SIN_ESTADO)
  const id = 'nuevo-proyecto'

  // Con JavaScript, al crearse el proyecto el popover se cierra solo. Sin él,
  // la respuesta de la acción vuelve a pintar la página y queda cerrado igual.
  useEffect(() => {
    if (!estado.aviso) return
    try {
      document.getElementById(id)?.hidePopover()
    } catch {
      // Ya estaba cerrado.
    }
  }, [estado])

  return (
    <div
      id={id}
      popover="auto"
      role="dialog"
      aria-labelledby={`${id}-titulo`}
      className={CLASE_POPOVER}
    >
      {/* `key` con el total de columnas: al crearse una, el form se reinicia
          con un valor del servidor, no con un setState. */}
      <form key={tablero.columnas.length} action={accion} className="flex flex-col gap-4">
        <CamposDelTablero tablero={tablero} />

        <h2 id={`${id}-titulo`} className="text-lg font-medium">
          Nuevo proyecto
        </h2>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-nombre`}>Nombre del proyecto</Label>
          <Input
            id={`${id}-nombre`}
            name="label"
            required
            maxLength={TOPE_ETIQUETA_COLUMNA}
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Como lo llaman en tu empresa: «Cobranza con IA», «Cotizador automático».
          </p>
        </div>

        <AvisoAccion estado={estado} />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            popoverTarget={id}
            popoverTargetAction="hide"
          >
            Cancelar
          </Button>
          <BotonEnviar texto="Agregar" enCurso="Agregando…" />
        </div>
      </form>
    </div>
  )
}

function PopoverProyecto({
  columna,
  tablero,
  puedeBorrar,
  calificaciones,
}: {
  columna: ColumnaTablero
  tablero: TableroParaPintar
  puedeBorrar: boolean
  calificaciones: number
}) {
  const [estadoNombre, renombrar] = useActionState(renombrarColumna, SIN_ESTADO)
  const [estadoBorrar, eliminar] = useActionState(eliminarColumna, SIN_ESTADO)
  const id = `proyecto-${columna.id}`

  return (
    <div
      id={id}
      popover="auto"
      role="dialog"
      aria-labelledby={`${id}-titulo`}
      className={CLASE_POPOVER}
    >
      <div className="flex flex-col gap-4">
        <h2 id={`${id}-titulo`} className="text-lg font-medium text-pretty">
          {columna.etiqueta}
        </h2>

        <form key={columna.etiqueta} action={renombrar} className="flex flex-col gap-3">
          <CamposDelTablero tablero={tablero} />
          <input type="hidden" name="column_id" value={columna.id} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-nombre`}>Nombre del proyecto</Label>
            <Input
              id={`${id}-nombre`}
              name="label"
              defaultValue={columna.etiqueta}
              required
              maxLength={TOPE_ETIQUETA_COLUMNA}
              autoComplete="off"
            />
          </div>

          <AvisoAccion estado={estadoNombre} />

          <div>
            <BotonEnviar texto="Guardar nombre" enCurso="Guardando…" size="sm" />
          </div>
        </form>

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          {puedeBorrar ? (
            <form action={eliminar} className="flex flex-col gap-3">
              <CamposDelTablero tablero={tablero} />
              <input type="hidden" name="column_id" value={columna.id} />

              <p className="text-sm text-muted-foreground">
                Se borra el proyecto y sus {plural(calificaciones, 'calificación', 'calificaciones')}.
                No se puede deshacer.
              </p>

              <AvisoAccion estado={estadoBorrar} />

              <div>
                <BotonEnviar texto="Eliminar proyecto" enCurso="Eliminando…" variant="destructive" />
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              Solo {columna.creadaPorNombre ?? 'quien lo creó'} o el equipo pueden borrarlo.
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <Button type="button" variant="outline" popoverTarget={id} popoverTargetAction="hide">
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------
// Piezas
// --------------------------------------------------------------------------

/** Iniciales de alguien más, con su nombre para el ratón y el lector. */
function Iniciales({
  nombre,
  verbo,
  className,
}: {
  nombre: string
  verbo: string
  className?: string
}) {
  return (
    <span className={className} title={`${verbo} ${nombre}`}>
      <span aria-hidden>{iniciales(nombre)}</span>
      <span className="sr-only">
        {verbo} {nombre}
      </span>
    </span>
  )
}

function Palomita() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5"
      aria-hidden
    >
      <path d="m5 12 5 5L20 7" />
    </svg>
  )
}
