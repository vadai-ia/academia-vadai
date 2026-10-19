'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { Desplegable } from '@/components/admin/desplegable'
import { claseSelect } from '@/components/admin/estilos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  agregarConocimiento,
  guardarAjustesAgente,
  guardarVozAgente,
  probarAgente,
  publicarBorrador,
  type EstadoAgente,
  type EstadoProbador,
} from '@/lib/agente/acciones'

/**
 * Los formularios del agente (M21): Ajustes → Agente (solo admin) y los
 * borradores de la pestaña Agente. Todas las acciones van directas al
 * `<form>` (funcionan sin JavaScript); lo que se abre y se cierra es un
 * `<details>`.
 */

const VACIO: EstadoAgente = {}

function Enviar({ texto, ocupado, variante = 'default' }: { texto: string; ocupado: string; variante?: 'default' | 'outline' | 'acento' }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} variant={variante}>
      {pending ? ocupado : texto}
    </Button>
  )
}

export type AjustesDelFormulario = {
  modo: 'apagado' | 'borradores' | 'automatico'
  umbral: number
  espera_min: number
  espera_max: number
  hora_inicio: number
  hora_fin: number
  busqueda_web: boolean
  noticias: boolean
  tope_usd: number
  modelo_rapido: string
  modelo_fuerte: string
}

const MODOS = [
  { valor: 'apagado', titulo: 'Apagado', detalle: 'No lee ni contesta nada.' },
  { valor: 'borradores', titulo: 'Solo borradores', detalle: 'Prepara cada respuesta y la deja aquí para que una persona la publique.' },
  { valor: 'automatico', titulo: 'Automático', detalle: 'Publica solo lo que tiene claro; lo demás, a borrador.' },
] as const

const MODELOS = [
  { valor: 'claude-haiku-5-5', etiqueta: 'Claude Haiku 5.5 (rápido y barato)' },
  { valor: 'claude-sonnet-5-5', etiqueta: 'Claude Sonnet 5.5 (más capaz, 20 veces más caro)' },
]

function Numero({ id, nombre, etiqueta, valor, min, max, paso = 1, ayuda }: { id: string; nombre: string; etiqueta: string; valor: number; min: number; max: number; paso?: number; ayuda?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      <Input id={id} name={nombre} type="number" defaultValue={valor} min={min} max={max} step={paso} required className="max-w-40" />
      {ayuda ? <p className="text-xs text-muted-foreground">{ayuda}</p> : null}
    </div>
  )
}

export function FormularioAjustesAgente({ ajustes }: { ajustes: AjustesDelFormulario }) {
  const [estado, accion] = useActionState(guardarAjustesAgente, VACIO)
  return (
    <form action={accion} className="flex flex-col gap-6 rounded-[10px] border border-border bg-card p-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Modo</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {MODOS.map((m) => (
            <label key={m.valor} className="flex cursor-pointer items-start gap-2.5 rounded-[10px] border border-border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              <input type="radio" name="modo" value={m.valor} defaultChecked={ajustes.modo === m.valor} className="mt-0.5 size-4 accent-vadai-cyan" />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">{m.titulo}</span>
                <span className="text-xs text-muted-foreground">{m.detalle}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Numero id="ag-umbral" nombre="umbral" etiqueta="Certeza para publicar solo" valor={ajustes.umbral} min={0.5} max={1} paso={0.05} ayuda="De 0.5 a 1. Debajo de esto, deja borrador." />
        <Numero id="ag-min" nombre="espera_min" etiqueta="Espera mínima (minutos)" valor={ajustes.espera_min} min={0} max={600} />
        <Numero id="ag-max" nombre="espera_max" etiqueta="Espera máxima (minutos)" valor={ajustes.espera_max} min={0} max={1440} ayuda="Contesta al azar entre las dos: que no se sienta un bot." />
        <Numero id="ag-ini" nombre="hora_inicio" etiqueta="Contesta desde las (CDMX)" valor={ajustes.hora_inicio} min={0} max={23} />
        <Numero id="ag-fin" nombre="hora_fin" etiqueta="Hasta las (CDMX)" valor={ajustes.hora_fin} min={1} max={24} ayuda="Lo de la noche se contesta en la mañana." />
        <Numero id="ag-tope" nombre="tope_usd" etiqueta="Tope de gasto al mes (US$)" valor={ajustes.tope_usd} min={0} max={500} ayuda="Al llegar, se pausa solo y lo dice aquí." />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ag-rapido">Modelo que decide</Label>
          <select id="ag-rapido" name="modelo_rapido" defaultValue={ajustes.modelo_rapido} className={claseSelect}>
            {MODELOS.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.etiqueta}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ag-fuerte">Modelo para las difíciles y las noticias</Label>
          <select id="ag-fuerte" name="modelo_fuerte" defaultValue={ajustes.modelo_fuerte} className={claseSelect}>
            {MODELOS.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.etiqueta}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex min-h-9 items-start gap-2 text-sm">
          <input type="checkbox" name="noticias" value="si" defaultChecked={ajustes.noticias} className="mt-0.5 size-4 accent-vadai-cyan" />
          <span>Preparar las noticias del día (en borrador, a las 7:00)</span>
        </label>
        <label className="flex min-h-9 items-start gap-2 text-sm">
          <input type="checkbox" name="busqueda_web" value="si" defaultChecked={ajustes.busqueda_web} className="mt-0.5 size-4 accent-vadai-cyan" />
          <span>
            Permitir búsqueda web para las noticias{' '}
            <span className="text-muted-foreground">(solo en sitios oficiales y prensa seria; US$0.01 por búsqueda)</span>
          </span>
        </label>
      </div>

      <AvisoAccion estado={estado} />
      <div>
        <Enviar texto="Guardar ajustes" ocupado="Guardando…" />
      </div>
    </form>
  )
}

export function FormularioVoz({ prompt, porDefecto }: { prompt: string; porDefecto: string }) {
  const [estado, accion] = useActionState(guardarVozAgente, VACIO)
  return (
    <form action={accion} className="flex flex-col gap-3 rounded-[10px] border border-border bg-card p-5">
      <Label htmlFor="ag-voz">Cómo habla</Label>
      <Textarea id="ag-voz" name="prompt" defaultValue={prompt || porDefecto} rows={16} className="font-mono text-xs leading-relaxed" />
      <p className="text-xs text-muted-foreground">
        Las reglas que impiden inventar (solo con su conocimiento, sin ligas, precios ni fechas, lo delicado a borrador) no se editan aquí: las pone el sistema.
      </p>
      <AvisoAccion estado={estado} />
      <div className="flex flex-wrap gap-2">
        <Enviar texto="Guardar voz" ocupado="Guardando…" />
        <Button type="submit" name="restablecer" value="si" variant="ghost">
          Volver a la voz por defecto
        </Button>
      </div>
    </form>
  )
}

const ETIQUETA_ACCION: Record<string, string> = {
  responder: 'Contestaría',
  borrador: 'Lo dejaría en borrador',
  ignorar: 'No contestaría',
}

export function Probador({ cursos }: { cursos: Array<{ id: string; titulo: string }> }) {
  const [estado, accion] = useActionState(probarAgente, {} as EstadoProbador)
  const r = estado.resultado
  return (
    <form action={accion} className="flex flex-col gap-4 rounded-[10px] border border-border bg-card p-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ag-curso">Curso</Label>
        <select id="ag-curso" name="curso" required className={claseSelect}>
          {cursos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.titulo}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ag-pregunta">Pregunta, como la escribiría un alumno</Label>
        <Textarea id="ag-pregunta" name="pregunta" rows={3} required minLength={5} maxLength={2000} placeholder="¿Cómo le pido a Claude que me arme la conciliación del viernes con mi Excel?" />
      </div>
      <AvisoAccion estado={{ error: estado.error }} />
      {r ? (
        <div className="flex flex-col gap-3 rounded-[10px] border border-primary/30 bg-primary/5 p-4 text-sm">
          <p className="flex flex-wrap gap-x-3 gap-y-1">
            <span className="font-medium">{ETIQUETA_ACCION[r.accion] ?? r.accion}</span>
            <span className="text-muted-foreground">certeza {r.certeza.toFixed(2)}</span>
            <span className="text-muted-foreground">{r.complejidad}</span>
            <span className="text-muted-foreground">
              {r.modelo}
              {r.escalado ? ' (escaló)' : ''}
            </span>
            <span className="text-muted-foreground">{r.costo}</span>
          </p>
          {r.texto ? <p className="rounded-md bg-card p-3 whitespace-pre-wrap">{r.texto}</p> : null}
          <p className="text-muted-foreground">Por qué: {r.motivo}</p>
          {r.problemas.length ? <p className="text-destructive">No se publicaría: la respuesta {r.problemas.join(', ')}.</p> : null}
          {r.ideas.length ? <p className="text-muted-foreground">Ideas que anotaría: {r.ideas.join(' · ')}</p> : null}
        </div>
      ) : null}
      <div>
        <Enviar texto="Probar" ocupado="Pensando…" variante="outline" />
      </div>
    </form>
  )
}

export function NuevoConocimiento({ cursos }: { cursos: Array<{ id: string; titulo: string }> }) {
  const [estado, accion] = useActionState(agregarConocimiento, VACIO)
  return (
    <Desplegable etiqueta="Agregar una nota" abierto={Boolean(estado.error || estado.aviso)}>
      <form action={accion} className="mt-3 flex max-w-2xl flex-col gap-4 rounded-[10px] border border-border bg-card p-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="con-titulo">Título</Label>
          <Input id="con-titulo" name="titulo" required minLength={2} maxLength={200} placeholder="Cómo se entregan las tareas" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="con-curso">Vale para</Label>
          <select id="con-curso" name="curso" defaultValue="" className={claseSelect}>
            <option value="">Todos los cursos</option>
            {cursos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titulo}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="con-texto">Lo que el agente tiene que saber</Label>
          <Textarea id="con-texto" name="contenido" rows={8} required minLength={20} />
        </div>
        <AvisoAccion estado={estado} />
        <div>
          <Enviar texto="Guardar nota" ocupado="Guardando…" />
        </div>
      </form>
    </Desplegable>
  )
}

/** Un borrador: se corrige ahí mismo y se publica, o se descarta. */
export function PublicarBorrador({ id, tipo, titulo, texto }: { id: string; tipo: 'respuesta' | 'noticia'; titulo: string | null; texto: string }) {
  const [estado, accion] = useActionState(publicarBorrador, VACIO)
  return (
    <form action={accion} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      {tipo === 'noticia' ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`b-titulo-${id}`}>Título</Label>
          <Input id={`b-titulo-${id}`} name="titulo" defaultValue={titulo ?? ''} required minLength={3} maxLength={160} />
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`b-texto-${id}`}>{tipo === 'noticia' ? 'Texto' : 'Respuesta'}</Label>
        <Textarea
          id={`b-texto-${id}`}
          name="texto"
          defaultValue={texto}
          rows={Math.min(12, Math.max(4, Math.ceil(texto.length / 90)))}
          required
          minLength={2}
          maxLength={2000}
          placeholder={texto ? undefined : 'El agente no propuso texto: escribe la respuesta.'}
        />
      </div>
      <AvisoAccion estado={estado} />
      <div>
        <Enviar texto={tipo === 'noticia' ? 'Publicar en Noticias' : 'Publicar como revisado'} ocupado="Publicando…" variante="acento" />
      </div>
    </form>
  )
}
