import Image from 'next/image'

import { Tarjeta } from '@/components/ui-vadai/superficie'
import { Button } from '@/components/ui/button'
import { empezarCursoGratis } from '@/lib/alumno/acciones-catalogo'
import { enlaceDeCompra, type CursoDelCatalogo } from '@/lib/alumno/catalogo'
import { diaCorto } from '@/lib/generaciones'

const PESOS = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })

function acceso(dias: number | null): string {
  if (dias === null) return 'Acceso de por vida'
  if (dias % 30 === 0) return `${dias / 30} ${dias / 30 === 1 ? 'mes' : 'meses'} de acceso`
  return `${dias} días de acceso`
}

/**
 * Un curso del catálogo que el alumno todavía no tiene (M15). Misma forma que
 * la tarjeta de sus cursos —portada 16:9 arriba— para que la rejilla se lea
 * igual, pero sin progreso: en su lugar, qué incluye y cómo se toma.
 *
 * Gratis: «Empezar gratis» lo inscribe en ese momento (un formulario que
 * funciona sin JavaScript). De pago: «Comprar» abre el Payment Link del curso
 * con su correo puesto, y el webhook de Stripe le da el acceso como siempre.
 * Sin enlace todavía, no se ofrece un botón que no lleva a ningún lado.
 *
 * Los botones van en cian (`primary`), no en lima: lima es una sola cosa por
 * pantalla y en una rejilla habría una por tarjeta.
 */
export function TarjetaCatalogo({ curso, correo }: { curso: CursoDelCatalogo; correo: string | null }) {
  const detalles = [
    curso.lecciones > 0 ? `${curso.lecciones} ${curso.lecciones === 1 ? 'lección' : 'lecciones'}` : 'Lecciones en camino',
    curso.tipo === 'cohort' ? 'Con sesiones en vivo' : 'A tu ritmo',
    acceso(curso.diasDeAcceso),
  ]

  return (
    <Tarjeta className="flex h-full w-full flex-col overflow-hidden">
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {curso.portada ? (
          <Image src={curso.portada} alt="" fill sizes="(min-width: 640px) 50vw, 100vw" unoptimized className="object-cover" />
        ) : (
          <span
            aria-hidden
            className="flex size-full items-center justify-center bg-gradient-to-br from-vadai-navy via-vadai-azul to-vadai-cyan text-5xl font-medium text-white/90"
          >
            {curso.titulo.trim().charAt(0).toUpperCase()}
          </span>
        )}
        <span className="absolute top-3 left-3 rounded-full bg-background/95 px-2.5 py-1 text-xs font-medium">
          {curso.gratis ? 'Gratis' : curso.precioMxn ? `${PESOS.format(curso.precioMxn)} MXN` : 'Próximamente'}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-col gap-1.5">
          <h3 className="font-medium text-balance">{curso.titulo}</h3>
          {curso.descripcion ? (
            <p className="line-clamp-3 text-sm text-pretty text-muted-foreground">{curso.descripcion}</p>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">{detalles.join(' · ')}</p>

        {/* Un curso por generaciones se ofrece solo mientras una está abierta a
            inscripciones (M16): se dice cuál, y cuándo empieza si se sabe. */}
        {curso.generacionAbierta ? (
          <p className="text-xs font-medium text-primary">
            {curso.generacionAbierta}
            {curso.generacionInicia ? ` · inicia el ${diaCorto(curso.generacionInicia)}` : ' · inscripciones abiertas'}
          </p>
        ) : null}

        <div className="mt-auto pt-1">
          {curso.gratis ? (
            <form action={empezarCursoGratis}>
              <input type="hidden" name="curso" value={curso.id} />
              <Button type="submit" className="w-full">
                Empezar gratis
              </Button>
            </form>
          ) : curso.linkMxn ? (
            <Button asChild className="w-full">
              <a href={enlaceDeCompra(curso.linkMxn, correo)}>
                Comprar{curso.precioMxn ? ` · ${PESOS.format(curso.precioMxn)}` : ''}
              </a>
            </Button>
          ) : (
            <a
              href={`mailto:ayuda@vadai.com.mx?subject=${encodeURIComponent(`Quiero el curso ${curso.titulo}`)}`}
              className="block text-center text-sm text-primary underline-offset-4 hover:underline"
            >
              Pregúntanos por este curso
            </a>
          )}
        </div>
      </div>
    </Tarjeta>
  )
}
