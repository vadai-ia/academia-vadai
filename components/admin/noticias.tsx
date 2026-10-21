'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { ConfirmarConModal } from '@/components/admin/confirmar-con-modal'
import { claseSelect } from '@/components/admin/estilos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SIN_ESTADO } from '@/lib/admin/tipos'
import { borrarPublicacion, crearDesdeLiga, iniciarCaceria, publicarEnVaip, publicarNoticia } from '@/lib/noticias/acciones'

/**
 * Los formularios de Noticias y Publicar del panel de V-AI-P (M24). Cada
 * acción va directa al `<form>`: funcionan sin JavaScript. Con JavaScript, el
 * botón dice qué está pasando mientras espera.
 */

function Enviar({
  texto,
  ocupado,
  variante = 'default',
  deshabilitado = false,
  className,
}: {
  texto: string
  ocupado: string
  variante?: 'default' | 'outline' | 'acento'
  deshabilitado?: boolean
  className?: string
}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending || deshabilitado} variant={variante} className={className}>
      {pending ? ocupado : texto}
    </Button>
  )
}

// ==========================================================================
// Noticias
// ==========================================================================

export function BotonCazar({ deshabilitado, motivo }: { deshabilitado: boolean; motivo: string | null }) {
  const [estado, accion] = useActionState(iniciarCaceria, SIN_ESTADO)
  return (
    <form action={accion} className="flex flex-col gap-3">
      <input type="hidden" name="cazar" value="hoy" />
      <Enviar texto="Cazar noticias de hoy" ocupado="Empezando…" variante="acento" deshabilitado={deshabilitado} className="w-full sm:w-fit" />
      {motivo ? <p className="text-sm text-muted-foreground">{motivo}</p> : null}
      <AvisoAccion estado={estado} />
    </form>
  )
}

export function FormularioLiga({ deshabilitado }: { deshabilitado: boolean }) {
  const [estado, accion] = useActionState(crearDesdeLiga, SIN_ESTADO)
  return (
    <form action={accion} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="liga-url">Liga del artículo o del video</Label>
        <Input id="liga-url" name="url" type="url" inputMode="url" required placeholder="https://…" autoComplete="off" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="liga-enfoque">Qué destacar (opcional)</Label>
        <Input id="liga-enfoque" name="enfoque" maxLength={300} placeholder="Por ejemplo: cómo le sirve a un despacho contable" />
      </div>
      <Enviar texto="Crear la noticia" ocupado="Empezando…" deshabilitado={deshabilitado} className="w-full sm:w-fit" />
      <AvisoAccion estado={estado} />
    </form>
  )
}

export type PropuestaParaFormulario = {
  id: string
  titulo: string
  resumen: string
  texto: string
}

export function FormularioPropuesta({ p }: { p: PropuestaParaFormulario }) {
  const [estado, accion] = useActionState(publicarNoticia, SIN_ESTADO)
  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={p.id} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`titulo-${p.id}`}>Título</Label>
        <Input id={`titulo-${p.id}`} name="titulo" defaultValue={p.titulo} required minLength={3} maxLength={160} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`resumen-${p.id}`}>Resumen</Label>
        <Textarea id={`resumen-${p.id}`} name="resumen" defaultValue={p.resumen} required maxLength={600} rows={2} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`texto-${p.id}`}>Texto</Label>
        <Textarea id={`texto-${p.id}`} name="texto" defaultValue={p.texto} required maxLength={5000} rows={6} />
        <p className="text-xs text-muted-foreground">Una línea en blanco separa los párrafos. La liga «Leer más» se agrega sola.</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`fijar-${p.id}`}>Fijar arriba del muro</Label>
          <select id={`fijar-${p.id}`} name="fijar" defaultValue="no" className={`${claseSelect} sm:w-48`}>
            <option value="no">No fijar</option>
            <option value="1">1 día</option>
            <option value="3">3 días</option>
            <option value="7">1 semana</option>
          </select>
        </div>
        <Enviar texto="Publicar en el muro" ocupado="Publicando…" variante="acento" />
      </div>
      <AvisoAccion estado={estado} />
    </form>
  )
}

// ==========================================================================
// Publicar: el compositor
// ==========================================================================

export type TemaParaFormulario = { slug: string; nombre: string; soloEquipo: boolean }

export function Compositor({ temas }: { temas: TemaParaFormulario[] }) {
  const [estado, accion] = useActionState(publicarEnVaip, SIN_ESTADO)
  // Al publicar bien, el formulario se vacía: la llave cambia con el aviso.
  return (
    <form
      key={estado.aviso ?? 'compositor'}
      action={accion}
      encType="multipart/form-data"
      className="group/compositor flex flex-col gap-5 rounded-[10px] border border-border bg-card p-5 sm:p-6"
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Qué vas a publicar</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {(
            [
              ['publicacion', 'Publicación', 'Una conversación en el muro, con el tema que elijas.'],
              ['aviso', 'Aviso', 'Una herramienta nueva, un cambio, una bienvenida. Se fija una semana.'],
              ['noticia', 'Noticia', 'Con resumen y liga «Leer más», en el tema Noticias.'],
            ] as const
          ).map(([valor, titulo, detalle]) => (
            <label
              key={valor}
              className="flex cursor-pointer gap-3 rounded-lg border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input type="radio" name="tipo" value={valor} id={`tipo-${valor}`} defaultChecked={valor === 'publicacion'} className="mt-1" />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{titulo}</span>
                <span className="text-xs text-pretty text-muted-foreground">{detalle}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="c-titulo">Título</Label>
        <Input id="c-titulo" name="titulo" required minLength={3} maxLength={160} />
      </div>

      {/* Solo para noticias (con CSS: sin JavaScript se ven siempre y el servidor ignora lo que no aplica). */}
      <div className="flex flex-col gap-4 group-has-[#tipo-publicacion:checked]/compositor:hidden group-has-[#tipo-aviso:checked]/compositor:hidden">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="c-resumen">Resumen (noticia)</Label>
          <Textarea id="c-resumen" name="resumen" maxLength={600} rows={2} placeholder="1 o 2 oraciones: qué pasó." />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-enlace">Liga «Leer más» (noticia)</Label>
            <Input id="c-enlace" name="enlace" type="url" inputMode="url" placeholder="https://…" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-medio">Medio</Label>
            <Input id="c-medio" name="medio" maxLength={80} placeholder="Sale de la liga" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="c-texto">Texto</Label>
        <Textarea id="c-texto" name="texto" maxLength={5000} rows={6} />
        <p className="text-xs text-muted-foreground">Una línea en blanco separa los párrafos.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 group-has-[#tipo-aviso:checked]/compositor:hidden group-has-[#tipo-noticia:checked]/compositor:hidden">
          <Label htmlFor="c-tema">Tema (publicación)</Label>
          <select id="c-tema" name="tema" defaultValue="" className={claseSelect}>
            <option value="">Sin tema</option>
            {temas.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.nombre}
                {t.soloEquipo ? ' (solo equipo)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="c-fijar">Fijar arriba del muro</Label>
          <select id="c-fijar" name="fijar" defaultValue="tipo" className={claseSelect}>
            <option value="tipo">Según el tipo (aviso: 1 semana)</option>
            <option value="no">No fijar</option>
            <option value="1">1 día</option>
            <option value="3">3 días</option>
            <option value="7">1 semana</option>
            <option value="sin_fin">Hasta que lo desfije</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Firmar como</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="firma" value="equipo" defaultChecked /> Equipo VADAI
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="firma" value="yo" /> Mi nombre
          </label>
        </fieldset>
        <div className="flex flex-col gap-2">
          <label className="flex items-start gap-2 text-sm group-has-[#tipo-publicacion:checked]/compositor:hidden">
            <input type="checkbox" name="imagen_generada" value="si" defaultChecked className="mt-1" />
            <span>
              Imagen con el diseño de VADAI
              <span className="block text-xs text-muted-foreground">Se dibuja sola con el título (avisos y noticias).</span>
            </span>
          </label>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-imagenes">Tus imágenes (opcional)</Label>
            <Input id="c-imagenes" name="imagenes" type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" />
            <p className="text-xs text-muted-foreground">Hasta 4, que juntas pesen menos de 4 MB.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center">
        <Enviar texto="Publicar en V-AI-P" ocupado="Publicando…" variante="acento" />
        <p className="text-xs text-pretty text-muted-foreground">Sale en el muro al momento y en la campana de los miembros.</p>
      </div>
      <AvisoAccion estado={estado} />
    </form>
  )
}

export function BorrarPublicacion({ id, titulo }: { id: string; titulo: string }) {
  return (
    <ConfirmarConModal
      idModal={`borrar-${id}`}
      accion={borrarPublicacion}
      campos={{ id }}
      boton={{ texto: 'Borrar', etiquetaAccesible: `Borrar «${titulo}»`, tono: 'destructivo' }}
      titulo="¿Borrar esta publicación?"
      confirmar={{ texto: 'Borrar', enCurso: 'Borrando…', tono: 'destructivo' }}
    >
      <p className="text-sm text-pretty text-muted-foreground">
        Se borra del muro con sus comentarios y reacciones. No se puede deshacer. Si solo quieres quitarla de la vista,
        usa «Ocultar».
      </p>
    </ConfirmarConModal>
  )
}
