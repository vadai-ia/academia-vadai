'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { actualizarCurso, crearCurso } from '@/lib/admin/acciones'
import { generarSlug } from '@/lib/admin/esquemas'
import type { Curso } from '@/lib/admin/consultas'
import { ETIQUETA_ESTADO_CURSO, ETIQUETA_TIPO_CURSO, SIN_ESTADO } from '@/lib/admin/tipos'

import { AvisoAccion } from './aviso-accion'

function Guardar({ nuevo }: { nuevo: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Guardando…' : nuevo ? 'Crear curso' : 'Guardar cambios'}
    </Button>
  )
}

function Campo({
  id,
  etiqueta,
  ayuda,
  children,
}: {
  id: string
  etiqueta: string
  ayuda?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{etiqueta}</Label>
      {children}
      {ayuda ? <p className="text-xs text-muted-foreground">{ayuda}</p> : null}
    </div>
  )
}

const claseSelect =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs ' +
  'outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

export function FormularioCurso({ curso }: { curso?: Curso }) {
  const nuevo = !curso
  const [estado, accion] = useActionState(nuevo ? crearCurso : actualizarCurso, SIN_ESTADO)

  const [titulo, setTitulo] = useState(curso?.title ?? '')
  const [slug, setSlug] = useState(curso?.slug ?? '')
  const [slugTocado, setSlugTocado] = useState(Boolean(curso))

  // El slug sigue al título mientras el admin no lo edite a mano. Una vez que lo
  // toca, deja de moverse solo: cambiar el slug de un curso publicado rompe URLs.
  const alCambiarTitulo = (valor: string) => {
    setTitulo(valor)
    if (!slugTocado) setSlug(generarSlug(valor))
  }

  return (
    <form action={accion} className="flex flex-col gap-6">
      {curso ? <input type="hidden" name="id" value={curso.id} /> : null}

      <section className="flex flex-col gap-4">
        <Campo id="title" etiqueta="Título">
          <Input
            id="title"
            name="title"
            value={titulo}
            onChange={(e) => alCambiarTitulo(e.target.value)}
            placeholder="Claude en tu Empresa"
            required
          />
        </Campo>

        <Campo
          id="slug"
          etiqueta="Slug"
          ayuda="Aparece en la URL del curso. Solo minúsculas, números y guiones."
        >
          <Input
            id="slug"
            name="slug"
            value={slug}
            onChange={(e) => {
              setSlugTocado(true)
              setSlug(e.target.value)
            }}
            placeholder="claude-en-tu-empresa"
            required
          />
        </Campo>

        <Campo id="description" etiqueta="Descripción">
          <Textarea
            id="description"
            name="description"
            defaultValue={curso?.description ?? ''}
            rows={3}
            placeholder="De qué trata el curso, en una o dos frases."
          />
        </Campo>

        <Campo id="cover_url" etiqueta="URL de portada" ayuda="Opcional, por ahora.">
          <Input
            id="cover_url"
            name="cover_url"
            type="url"
            defaultValue={curso?.cover_url ?? ''}
            placeholder="https://…"
          />
        </Campo>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Campo id="course_type" etiqueta="Tipo">
          <select
            id="course_type"
            name="course_type"
            defaultValue={curso?.course_type ?? 'cohort'}
            className={claseSelect}
          >
            {Object.entries(ETIQUETA_TIPO_CURSO).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </Campo>

        <Campo id="status" etiqueta="Estado">
          <select
            id="status"
            name="status"
            defaultValue={curso?.status ?? 'draft'}
            className={claseSelect}
          >
            {Object.entries(ETIQUETA_ESTADO_CURSO).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </Campo>

        <Campo id="price_mxn" etiqueta="Precio MXN">
          <Input
            id="price_mxn"
            name="price_mxn"
            type="number"
            step="0.01"
            min="0"
            defaultValue={curso?.price_mxn ?? ''}
            placeholder="14999.00"
          />
        </Campo>

        <Campo id="price_usd" etiqueta="Precio USD">
          <Input
            id="price_usd"
            name="price_usd"
            type="number"
            step="0.01"
            min="0"
            defaultValue={curso?.price_usd ?? ''}
            placeholder="899.00"
          />
        </Campo>

        <Campo
          id="access_days"
          etiqueta="Días de acceso"
          ayuda="Vacío = acceso de por vida."
        >
          <Input
            id="access_days"
            name="access_days"
            type="number"
            min="1"
            step="1"
            defaultValue={curso?.access_days ?? ''}
            placeholder="de por vida"
          />
        </Campo>

        <div className="flex flex-col gap-2">
          <Label htmlFor="certificate_enabled">Certificado</Label>
          <label className="flex h-9 items-center gap-2 text-sm">
            <input
              id="certificate_enabled"
              name="certificate_enabled"
              type="checkbox"
              value="true"
              defaultChecked={curso?.certificate_enabled ?? true}
              className="size-4 accent-vadai-cyan"
            />
            Emitir certificado al completar
          </label>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <Campo
          id="stripe_payment_link_mxn"
          etiqueta="Payment Link MXN"
          ayuda="Se crea en el dashboard de Stripe (M9)."
        >
          <Input
            id="stripe_payment_link_mxn"
            name="stripe_payment_link_mxn"
            type="url"
            defaultValue={curso?.stripe_payment_link_mxn ?? ''}
            placeholder="https://buy.stripe.com/…"
          />
        </Campo>

        <Campo id="stripe_payment_link_usd" etiqueta="Payment Link USD">
          <Input
            id="stripe_payment_link_usd"
            name="stripe_payment_link_usd"
            type="url"
            defaultValue={curso?.stripe_payment_link_usd ?? ''}
            placeholder="https://buy.stripe.com/…"
          />
        </Campo>
      </section>

      <AvisoAccion estado={estado} />

      <div className="flex items-center gap-3">
        <Guardar nuevo={nuevo} />
      </div>
    </form>
  )
}
