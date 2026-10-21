'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { Desplegable } from '@/components/admin/desplegable'
import { EditorRico } from '@/components/admin/editor-rico'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SIN_ESTADO } from '@/lib/admin/tipos'
import type { Json } from '@/lib/supabase/types'
import type { EtiquetaDelPanel } from '@/lib/vaip/admin'
import {
  alternarEtiqueta,
  cambiarPublicacion,
  crearEtiqueta,
  guardarGrabacion,
  guardarHerramienta,
  nuevaHerramienta,
  redibujarPortada,
  renombrarEtiqueta,
} from '@/lib/vaip/acciones'
import { cn } from '@/lib/utils'

/**
 * Los formularios del contenido de V-AI-P en el panel (M26, 21-oct-2026).
 *
 * Todos son `<form action={accion}>` directos con `useActionState`: sin
 * JavaScript siguen funcionando (CLAUDE.md). Lo que se abre y se cierra va en
 * `Desplegable`, y lo abre el servidor cuando hay algo que ver.
 */

function Enviar({ texto, enCurso, variante = 'default' }: { texto: string; enCurso: string; variante?: 'default' | 'outline' }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant={variante} disabled={pending} className="w-fit">
      {pending ? enCurso : texto}
    </Button>
  )
}

// ==========================================================================
// Grabaciones
// ==========================================================================

/** Título, fecha (la cambia de mes) y descripción de una grabación. */
export function FormularioGrabacion({
  id,
  titulo,
  fecha,
  descripcion,
}: {
  id: string
  titulo: string
  fecha: string
  descripcion: Json | null
}) {
  const [estado, accion] = useActionState(guardarGrabacion, SIN_ESTADO)
  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="titulo">Título</Label>
          <Input id="titulo" name="titulo" defaultValue={titulo} required minLength={2} maxLength={200} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fecha">Día de la clase</Label>
          <Input id="fecha" name="fecha" type="date" defaultValue={fecha} required />
        </div>
      </div>
      <EditorRico
        nombre="descripcion"
        contenidoInicial={descripcion}
        etiqueta="Descripción"
        ayuda="Qué se vio en la clase. La leen los miembros debajo del video."
      />
      <Enviar texto="Guardar" enCurso="Guardando…" />
      <AvisoAccion estado={estado} />
    </form>
  )
}

/**
 * Publicada o en borrador. Sin video la base no deja publicar, y el botón lo
 * dice antes de que lo intentes.
 */
export function PublicacionDeContenido({
  id,
  publicada,
  conVideo,
  que,
}: {
  id: string
  publicada: boolean
  conVideo: boolean
  que: 'grabación' | 'herramienta'
}) {
  const [estado, accion] = useActionState(cambiarPublicacion, SIN_ESTADO)
  return (
    <form action={accion} className="flex flex-col gap-2" data-publicacion={publicada ? 'publicada' : 'borrador'}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="publicar" value={publicada ? 'no' : 'si'} />
      <p className="text-sm text-pretty">
        {publicada
          ? `Publicada: los miembros ya ven esta ${que}.`
          : conVideo
            ? `En borrador: los miembros todavía no la ven.`
            : 'Sube el video y después publícala.'}
      </p>
      <Enviar
        texto={publicada ? 'Regresar a borrador' : 'Publicar'}
        enCurso={publicada ? 'Guardando…' : 'Publicando…'}
        variante={publicada ? 'outline' : 'default'}
      />
      <AvisoAccion estado={estado} />
    </form>
  )
}

// ==========================================================================
// Herramientas
// ==========================================================================

function CamposDeHerramienta({
  etiquetas,
  valores,
}: {
  etiquetas: EtiquetaDelPanel[]
  valores?: { titulo: string; orientacion: 'horizontal' | 'vertical'; etiquetas: string[]; descripcion: Json | null }
}) {
  const activas = etiquetas.filter((e) => !e.archivada || valores?.etiquetas.includes(e.id))
  const orientacion = valores?.orientacion ?? 'vertical'
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="herramienta-titulo">Título</Label>
        <Input
          id="herramienta-titulo"
          name="titulo"
          defaultValue={valores?.titulo}
          required
          minLength={3}
          maxLength={200}
          placeholder="Arma tu flujo de caja con Claude en Excel"
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Formato del video</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { valor: 'vertical', titulo: 'Vertical', apoyo: '9:16, tipo reel' },
              { valor: 'horizontal', titulo: 'Horizontal', apoyo: '16:9, pantalla' },
            ] as const
          ).map((o) => (
            <label
              key={o.valor}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] border border-border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10"
            >
              <input type="radio" name="orientacion" value={o.valor} defaultChecked={o.valor === orientacion} className="accent-primary" />
              <span
                aria-hidden
                className={cn('rounded-[3px] border-2 border-current text-primary', o.valor === 'vertical' ? 'h-6 w-3.5' : 'h-3.5 w-6')}
              />
              <span className="flex flex-col leading-tight">
                <span className="font-medium">{o.titulo}</span>
                <span className="text-xs text-muted-foreground">{o.apoyo}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Etiquetas</legend>
        {activas.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {activas.map((e) => (
              <label
                key={e.id}
                className="flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1 text-sm pointer-coarse:min-h-11 has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary"
              >
                <input
                  type="checkbox"
                  name="etiqueta"
                  value={e.id}
                  defaultChecked={valores?.etiquetas.includes(e.id)}
                  className="accent-primary"
                />
                {e.nombre}
                {e.archivada ? <span className="text-xs text-muted-foreground">(archivada)</span> : null}
              </label>
            ))}
          </div>
        ) : null}
        <div className="flex max-w-xs flex-col gap-1.5">
          <Label htmlFor="herramienta-nueva-etiqueta" className="text-xs font-normal text-muted-foreground">
            ¿Falta una? Escríbela y se crea al guardar.
          </Label>
          <Input id="herramienta-nueva-etiqueta" name="nueva_etiqueta" maxLength={40} placeholder="Nueva etiqueta" className="h-9" />
        </div>
      </fieldset>

      <EditorRico
        nombre="descripcion"
        contenidoInicial={valores?.descripcion ?? null}
        etiqueta="Descripción (opcional)"
        ayuda="Para qué sirve y cuándo usarla. Va junto al video."
      />
    </>
  )
}

/** «Nueva herramienta»: se crea en borrador y abre su editor para subir el video. */
export function NuevaHerramienta({ etiquetas }: { etiquetas: EtiquetaDelPanel[] }) {
  const [estado, accion] = useActionState(nuevaHerramienta, SIN_ESTADO)
  return (
    <Desplegable
      etiqueta="Nueva herramienta"
      variante="primario"
      id="nueva-herramienta"
      abierto={Boolean(estado.error)}
      ayuda="Un video corto: vertical u horizontal."
    >
      <form action={accion} className="flex max-w-2xl flex-col gap-5">
        <CamposDeHerramienta etiquetas={etiquetas} />
        <Enviar texto="Crear y subir el video" enCurso="Creando…" />
        <AvisoAccion estado={estado} />
      </form>
    </Desplegable>
  )
}

export function FormularioHerramienta({
  id,
  etiquetas,
  valores,
}: {
  id: string
  etiquetas: EtiquetaDelPanel[]
  valores: { titulo: string; orientacion: 'horizontal' | 'vertical'; etiquetas: string[]; descripcion: Json | null }
}) {
  const [estado, accion] = useActionState(guardarHerramienta, SIN_ESTADO)
  return (
    // `key` con las etiquetas: al crear una nueva desde aquí, el formulario
    // vuelve a pintarse con la casilla ya marcada y el campo vacío.
    <form key={valores.etiquetas.join(',')} action={accion} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={id} />
      <CamposDeHerramienta etiquetas={etiquetas} valores={valores} />
      <Enviar texto="Guardar" enCurso="Guardando…" />
      <AvisoAccion estado={estado} />
    </form>
  )
}

export function RedibujarPortada({ id }: { id: string }) {
  const [estado, accion] = useActionState(redibujarPortada, SIN_ESTADO)
  return (
    <form action={accion} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <Enviar texto="Volver a dibujar la portada" enCurso="Dibujando…" variante="outline" />
      <AvisoAccion estado={estado} />
    </form>
  )
}

// ==========================================================================
// Etiquetas
// ==========================================================================

function Etiqueta({ e }: { e: EtiquetaDelPanel }) {
  const [estado, accion] = useActionState(renombrarEtiqueta, SIN_ESTADO)
  return (
    <li className="flex flex-col gap-2 rounded-[10px] border border-border px-3 py-2" data-etiqueta={e.slug}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={cn('text-sm', e.archivada && 'text-muted-foreground line-through')}>
          {e.nombre} <span className="text-xs text-muted-foreground no-underline">· {e.cuantas} {e.cuantas === 1 ? 'video' : 'videos'}</span>
        </span>
        <form action={alternarEtiqueta}>
          <input type="hidden" name="id" value={e.id} />
          <input type="hidden" name="archivar" value={e.archivada ? 'no' : 'si'} />
          <Button type="submit" variant="ghost" size="xs">
            {e.archivada ? 'Reactivar' : 'Archivar'}
          </Button>
        </form>
      </div>
      <details open={Boolean(estado.error) || undefined}>
        <summary className="w-fit cursor-pointer list-none text-xs text-primary underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
          Renombrar
        </summary>
        <form action={accion} className="mt-2 flex flex-wrap items-start gap-2">
          <input type="hidden" name="id" value={e.id} />
          <Input name="nombre" defaultValue={e.nombre} required minLength={2} maxLength={40} className="h-9 max-w-[14rem]" aria-label={`Nuevo nombre de ${e.nombre}`} />
          <Enviar texto="Guardar" enCurso="Guardando…" variante="outline" />
          <div className="basis-full">
            <AvisoAccion estado={estado} />
          </div>
        </form>
      </details>
    </li>
  )
}

/** Agregar, renombrar y archivar o reactivar etiquetas: el mismo patrón que los temas del muro. */
export function EtiquetasDeHerramientas({ etiquetas }: { etiquetas: EtiquetaDelPanel[] }) {
  const [estado, accion] = useActionState(crearEtiqueta, SIN_ESTADO)
  return (
    <div className="flex flex-col gap-4">
      {etiquetas.length > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {etiquetas.map((e) => (
            <Etiqueta key={`${e.id}:${e.nombre}:${e.archivada}`} e={e} />
          ))}
        </ul>
      ) : null}
      <form key={etiquetas.length} action={accion} className="flex flex-wrap items-start gap-2">
        <Input name="nombre" placeholder="Ventas, Marketing, Operación…" required minLength={2} maxLength={40} className="h-9 max-w-xs" aria-label="Nombre de la etiqueta" />
        <Enviar texto="Agregar etiqueta" enCurso="Agregando…" />
        <div className="basis-full">
          <AvisoAccion estado={estado} />
        </div>
      </form>
    </div>
  )
}
