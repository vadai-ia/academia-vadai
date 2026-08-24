'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { Button } from '@/components/ui/button'
import { generarCertificado } from '@/lib/certificados/acciones'
import { explicar, type Faltante } from '@/lib/certificados/comun'

function Obtener() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Generando…' : 'Obtener certificado'}
    </Button>
  )
}

/**
 * Bloque de certificado en la página del curso (§3.6).
 *
 * Tres estados, y el tercero es el que importa: cuando falta algo, se dice
 * exactamente QUÉ falta y con liga a la lección. "Completa el curso para obtener
 * tu certificado" no le sirve a nadie que ya cree haberlo completado.
 */
export function CertificadoDelCurso({
  cursoId,
  cursoSlug,
  folio,
  cumple,
  faltantes,
}: {
  cursoId: string
  cursoSlug: string
  folio: string | null
  cumple: boolean
  faltantes: Faltante[]
}) {
  const [estado, accion] = useActionState(generarCertificado, {})
  const emitido = folio ?? estado.folio ?? null

  if (emitido) {
    return (
      <section className="flex flex-col gap-4 rounded-lg border border-exito/40 bg-exito/5 p-5">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold">Curso completado</h2>
          <p className="text-sm text-muted-foreground">
            Folio <span className="font-mono text-foreground">{emitido}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm">
            <a href={`/api/certificados/${emitido}`}>Descargar PDF</a>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/certificado/${emitido}`}>Ver verificación</Link>
          </Button>
        </div>
      </section>
    )
  }

  if (cumple) {
    return (
      <form
        action={accion}
        className="flex flex-col gap-4 rounded-lg border border-exito/40 bg-exito/5 p-5"
      >
        <input type="hidden" name="curso_id" value={cursoId} />

        <div className="flex flex-col gap-1">
          <h2 className="font-semibold">Terminaste el curso</h2>
          <p className="text-sm text-muted-foreground">
            Ya puedes generar tu certificado. Se emite una sola vez y queda en tu perfil.
          </p>
        </div>

        <AvisoAccion estado={estado} />

        <div>
          <Obtener />
        </div>
      </form>
    )
  }

  if (faltantes.length === 0) return null

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold">Certificado</h2>
        <p className="text-sm text-muted-foreground">
          Te falta{faltantes.length === 1 ? '' : 'n'} {faltantes.length}{' '}
          {faltantes.length === 1 ? 'lección obligatoria' : 'lecciones obligatorias'}:
        </p>
      </div>

      <ul className="flex flex-col gap-1.5">
        {faltantes.map((faltante) => (
          <li key={faltante.leccionId} className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <Link
              href={`/curso/${cursoSlug}/${faltante.leccionId}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              {faltante.titulo}
            </Link>
            <span className="text-xs text-muted-foreground">{explicar(faltante.motivo)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
