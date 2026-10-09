'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { claseSelect } from '@/components/admin/estilos'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { guardarAccesoExclusivo } from '@/lib/admin/acciones-exclusivas'
import type { PersonaParaAcceso } from '@/lib/admin/exclusivas'
import { SIN_ESTADO } from '@/lib/admin/tipos'
import { cn } from '@/lib/utils'

/**
 * Quién entra a una sesión exclusiva (0038, 9-oct-2026).
 *
 * Alejandro: "que sea un UX fácil de manejar eligiendo a los que yo quiero…
 * buscándolos y teniendo un control de cuáles ya elegí y cuáles me faltan".
 *
 * Una casilla por inscrito, todas dentro del MISMO formulario. Buscar, filtrar
 * por empresa o por «Con acceso / Sin acceso» solo esconde renglones: las
 * casillas escondidas siguen en el formulario, así que lo que marcaste antes de
 * buscar no se pierde al guardar. Sin JavaScript se ve la lista completa y se
 * guarda igual; buscar y los contadores en vivo son la comodidad de tenerlo.
 *
 * El aviso del guardado vive en el padre; la lista va en un hijo con `key`
 * (un valor del servidor) para que, al guardar, vuelva a nacer con lo guardado.
 */

function Guardar({ cambios }: { cambios: number }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? 'Guardando…' : cambios > 0 ? `Guardar ${cambios} ${cambios === 1 ? 'cambio' : 'cambios'}` : 'Guardar'}
    </Button>
  )
}

const ZONA = 'America/Mexico_City'
const fecha = (iso: string) =>
  new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: ZONA }).format(new Date(iso))

type Vista = 'todos' | 'con' | 'sin'

function Casillas({
  moduloId,
  personas,
  exclusivaInicial,
  empresas,
}: {
  moduloId: string
  personas: PersonaParaAcceso[]
  exclusivaInicial: boolean
  empresas: string[]
}) {
  const [elegidos, setElegidos] = useState(() => new Set(personas.filter((p) => p.enLista).map((p) => p.userId)))
  const [exclusiva, setExclusiva] = useState(exclusivaInicial)
  const [busqueda, setBusqueda] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [vista, setVista] = useState<Vista>('todos')

  const termino = busqueda.trim().toLocaleLowerCase('es')
  const visible = (p: PersonaParaAcceso) =>
    (!termino ||
      p.nombre.toLocaleLowerCase('es').includes(termino) ||
      p.email.toLocaleLowerCase('es').includes(termino) ||
      (p.empresa ?? '').toLocaleLowerCase('es').includes(termino)) &&
    (!empresa || (empresa === '-' ? !p.empresa : p.empresa === empresa)) &&
    (vista === 'todos' || (vista === 'con' ? elegidos.has(p.userId) : !elegidos.has(p.userId)))

  const visibles = personas.filter(visible)
  const nuevos = personas.filter((p) => elegidos.has(p.userId) && !p.enLista).length
  const quitados = personas.filter((p) => !elegidos.has(p.userId) && p.enLista).length
  const cambios = nuevos + quitados + (exclusiva !== exclusivaInicial ? 1 : 0)

  const alternar = (id: string) =>
    setElegidos((previo) => {
      const siguiente = new Set(previo)
      if (siguiente.has(id)) siguiente.delete(id)
      else siguiente.add(id)
      return siguiente
    })
  const marcarVisibles = (marcar: boolean) =>
    setElegidos((previo) => {
      const siguiente = new Set(previo)
      for (const p of visibles) {
        if (marcar) siguiente.add(p.userId)
        else siguiente.delete(p.userId)
      }
      return siguiente
    })

  const pestanas: Array<{ valor: Vista; etiqueta: string; cuantos: number }> = [
    { valor: 'todos', etiqueta: 'Todos', cuantos: personas.length },
    { valor: 'con', etiqueta: 'Con acceso', cuantos: elegidos.size },
    { valor: 'sin', etiqueta: 'Sin acceso', cuantos: personas.length - elegidos.size },
  ]

  return (
    <>
      <input type="hidden" name="modulo_id" value={moduloId} />

      {/* --- El interruptor ------------------------------------------------ */}
      <label
        className={cn(
          'flex cursor-pointer items-start gap-3 rounded-[10px] border p-4 transition-colors',
          exclusiva ? 'border-primary/50 bg-primary/5' : 'border-border bg-card'
        )}
      >
        <input
          type="checkbox"
          name="exclusiva"
          value="si"
          checked={exclusiva}
          onChange={(e) => setExclusiva(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]"
        />
        <span className="flex flex-col gap-1">
          <span className="font-medium">Sesión exclusiva</span>
          <span className="text-sm text-muted-foreground">
            {exclusiva
              ? 'Solo la abren las personas marcadas abajo. El resto de la generación la ve con candado.'
              : 'Apagada: toda la generación la abre. Puedes preparar la lista antes de encenderla.'}
          </span>
        </span>
      </label>

      {/* --- Cómo va la lista ---------------------------------------------- */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-[10px] border border-border bg-card p-3">
          <div className="text-2xl font-medium tabular-nums">{elegidos.size}</div>
          <div className="text-xs text-muted-foreground">con acceso</div>
        </div>
        <div className="rounded-[10px] border border-border bg-card p-3">
          <div className="text-2xl font-medium tabular-nums">{personas.length - elegidos.size}</div>
          <div className="text-xs text-muted-foreground">sin acceso</div>
        </div>
        <div className={cn('rounded-[10px] border p-3', cambios > 0 ? 'border-accent bg-accent/30' : 'border-border bg-card')}>
          <div className="text-2xl font-medium tabular-nums">{cambios}</div>
          <div className="text-xs text-muted-foreground">
            {cambios === 0 ? 'sin cambios' : `${nuevos > 0 ? `+${nuevos} ` : ''}${quitados > 0 ? `−${quitados} ` : ''}por guardar`}
          </div>
        </div>
      </div>

      {/* --- Buscar y filtrar ---------------------------------------------- */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-56 flex-1 flex-col gap-1.5">
            <span className="text-sm font-medium">Buscar</span>
            <Input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre, correo o empresa"
              autoComplete="off"
              className="h-10"
            />
          </label>
          {empresas.length > 0 ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Empresa</span>
              <select value={empresa} onChange={(e) => setEmpresa(e.target.value)} className={cn(claseSelect, 'h-10 w-auto max-w-56')}>
                <option value="">Todas</option>
                <option value="-">General (sin empresa)</option>
                {empresas.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="tablist" aria-label="Qué enseñar" className="flex flex-wrap gap-1.5">
            {pestanas.map((t) => (
              <button
                key={t.valor}
                type="button"
                role="tab"
                aria-selected={vista === t.valor}
                onClick={() => setVista(t.valor)}
                className={cn(
                  'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors',
                  vista === t.valor
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                )}
              >
                {t.etiqueta}
                <span className="tabular-nums text-xs text-muted-foreground">{t.cuantos}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => marcarVisibles(true)} disabled={visibles.length === 0}>
              Marcar los {visibles.length} que se ven
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => marcarVisibles(false)} disabled={visibles.length === 0}>
              Desmarcar
            </Button>
          </div>
        </div>
      </div>

      {/* --- La lista ------------------------------------------------------ */}
      {personas.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
          Nadie está inscrito en esta generación todavía.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-[10px] border border-border bg-card">
          {personas.map((p) => {
            const marcado = elegidos.has(p.userId)
            return (
              <li key={p.userId} hidden={!visible(p)}>
                <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40">
                  <input
                    type="checkbox"
                    name="miembros"
                    value={p.userId}
                    checked={marcado}
                    onChange={() => alternar(p.userId)}
                    className="size-5 shrink-0 accent-[var(--primary)]"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate font-medium">{p.nombre}</span>
                      {marcado && !p.enLista ? (
                        <Badge className="bg-accent text-[11px] text-accent-foreground">Nueva</Badge>
                      ) : null}
                      {!marcado && p.enLista ? (
                        <Badge variant="outline" className="border-destructive/40 text-[11px] text-destructive">
                          Se quita
                        </Badge>
                      ) : null}
                      {p.acceso !== 'vigente' ? (
                        <Badge variant="outline" className="text-[11px] text-muted-foreground">
                          Acceso {p.acceso}
                        </Badge>
                      ) : null}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {p.email}
                      {p.empresa ? ` · ${p.empresa}` : ''}
                      {p.enLista && p.avisadaEn ? ` · avisada el ${fecha(p.avisadaEn)}` : ''}
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
      {personas.length > 0 && visibles.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">Nadie coincide con la búsqueda.</p>
      ) : null}

      {/* --- Guardar: pegado abajo para no tener que volver ---------------- */}
      <div className="sticky bottom-0 -mx-1 flex flex-col gap-3 border-t border-border bg-background/95 px-1 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="avisar" value="si" defaultChecked className="size-4 accent-[var(--primary)]" />
          Mandar correo a las personas nuevas
        </label>
        <Guardar cambios={cambios} />
      </div>
    </>
  )
}

export function ListaDeAcceso({
  moduloId,
  personas,
  exclusiva,
  empresas,
  version,
}: {
  moduloId: string
  personas: PersonaParaAcceso[]
  exclusiva: boolean
  empresas: string[]
  /** Cambia cuando cambia lo guardado: vuelve a armar la lista con eso. */
  version: string
}) {
  const [estado, accion] = useActionState(guardarAccesoExclusivo, SIN_ESTADO)

  return (
    <form action={accion} className="flex flex-col gap-5">
      <AvisoAccion estado={estado} />
      <Casillas key={version} moduloId={moduloId} personas={personas} exclusivaInicial={exclusiva} empresas={empresas} />
    </form>
  )
}
