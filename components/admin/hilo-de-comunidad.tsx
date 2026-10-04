import Link from 'next/link'

import { BotonConEspera } from '@/components/admin/boton-con-espera'
import { ConfirmarConModal } from '@/components/admin/confirmar-con-modal'
import { Desplegable } from '@/components/admin/desplegable'
import { RenderRico } from '@/components/alumno/render-rico'
import { Avatar } from '@/components/ui-vadai/superficie'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  alternarFijado,
  alternarVisibilidad,
  eliminarDeComunidad,
  responderHilo,
} from '@/lib/admin/acciones-comunidad'
import { HORAS_DE_ESPERA, type AutorEnHilo, type Hilo, type MensajeDeHilo } from '@/lib/admin/comunidad'
import { cn } from '@/lib/utils'

/**
 * Un hilo de la bandeja de Comunidad: de dónde viene, quién lo escribió, la
 * conversación completa y lo que el equipo puede hacer con él.
 *
 * Lo primero que se lee es el CONTEXTO —curso · generación · lección— porque
 * fue lo que Alejandro no podía saber desde el portal: "¿de qué generación
 * están escribiendo?". Luego el estado, que es la razón de abrir la bandeja.
 *
 * Todo es servidor: los formularios llevan la acción directa y vuelven a la
 * bandeja por redirect; lo único de cliente es el botón que se apaga mientras
 * envía y el modal de borrar.
 */

const ZONA = 'America/Mexico_City'

function fecha(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: ZONA,
  }).format(new Date(iso))
}

/** "hace 14 h", "hace 3 días". Se calcula al pedir la página. */
function hace(iso: string, ahora: number): string {
  const minutos = Math.max(0, Math.round((ahora - Date.parse(iso)) / 60_000))
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 48) return `hace ${horas} h`
  return `hace ${Math.round(horas / 24)} días`
}

function Contexto({ hilo }: { hilo: Hilo }) {
  const pastilla = 'inline-flex max-w-full items-center truncate rounded-full border px-2.5 py-0.5 text-xs font-medium'
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <span className={cn(pastilla, 'border-border text-muted-foreground')}>
        {hilo.tipo === 'muro' ? 'Muro' : 'Pregunta en lección'}
      </span>
      <span className={cn(pastilla, 'border-border text-foreground')}>{hilo.curso.titulo}</span>
      {hilo.generacion ? (
        <span className={cn(pastilla, 'border-primary/40 bg-primary/10 text-primary')}>{hilo.generacion.nombre}</span>
      ) : null}
      {hilo.leccion ? (
        <span className={cn(pastilla, 'border-border text-muted-foreground')} title={hilo.leccion.titulo}>
          {hilo.leccion.titulo}
        </span>
      ) : null}
    </div>
  )
}

function Estado({ hilo, ahora }: { hilo: Hilo; ahora: number }) {
  if (hilo.estado === 'respondida') {
    return (
      <Badge variant="outline" className="shrink-0 text-muted-foreground">
        Respondida
      </Badge>
    )
  }
  const espera = hilo.esperaDesde ?? hilo.creadoEn
  const vencida = ahora - Date.parse(espera) > HORAS_DE_ESPERA * 3_600_000
  return (
    <Badge
      variant="outline"
      className={cn(
        'shrink-0',
        vencida ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-primary/40 bg-primary/10 text-primary'
      )}
    >
      Sin respuesta · {hace(espera, ahora)}
    </Badge>
  )
}

function Firma({ autor, creadoEn }: { autor: AutorEnHilo; creadoEn: string }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{autor.nombre}</span>
      {autor.equipo ? (
        <Badge className="bg-accent text-[11px] text-accent-foreground">Equipo VADAI</Badge>
      ) : autor.empresa ? (
        <span>{autor.empresa}</span>
      ) : null}
      <span>· {fecha(creadoEn)}</span>
    </span>
  )
}

/** Campos que todo formulario de la bandeja manda para volver a la misma vista. */
function Vuelta({ vuelta }: { vuelta: string }) {
  return <input type="hidden" name="vuelta" value={vuelta} />
}

function Ocultar({ tipo, id, oculto, vuelta }: { tipo: string; id: string; oculto: boolean; vuelta: string }) {
  return (
    <form action={alternarVisibilidad}>
      <Vuelta vuelta={vuelta} />
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="ocultar" value={oculto ? 'no' : 'si'} />
      <BotonConEspera
        texto={oculto ? 'Mostrar' : 'Ocultar'}
        enCurso={oculto ? 'Mostrando…' : 'Ocultando…'}
        variante="ghost"
        className={oculto ? undefined : 'text-muted-foreground'}
      />
    </form>
  )
}

function Respuesta({ mensaje, hilo, vuelta }: { mensaje: MensajeDeHilo; hilo: Hilo; vuelta: string }) {
  const tipo = hilo.tipo === 'muro' ? 'comentario' : 'pregunta'
  return (
    <li className={cn('flex gap-2.5', mensaje.oculto && 'opacity-60')}>
      <Avatar nombre={mensaje.autor.nombre} tamano={28} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <Firma autor={mensaje.autor} creadoEn={mensaje.creadoEn} />
          {mensaje.oculto ? (
            <Badge variant="outline" className="text-[11px]">
              Oculta
            </Badge>
          ) : null}
        </span>
        <p className="text-sm break-words whitespace-pre-wrap">{mensaje.texto}</p>
        <div className="-ml-2 flex flex-wrap items-center">
          <Ocultar tipo={tipo} id={mensaje.id} oculto={mensaje.oculto} vuelta={vuelta} />
          <ConfirmarConModal
            idModal={`eliminar-${mensaje.id}`}
            accion={eliminarDeComunidad}
            campos={{ tipo, id: mensaje.id, vuelta }}
            boton={{ texto: 'Eliminar', etiquetaAccesible: `Eliminar la respuesta de ${mensaje.autor.nombre}`, tono: 'destructivo' }}
            titulo="¿Eliminar esta respuesta?"
            confirmar={{ texto: 'Sí, eliminar', enCurso: 'Eliminando…', tono: 'destructivo' }}
          >
            <p>Se borra para siempre. Si solo estorba, Ocultar se puede deshacer.</p>
          </ConfirmarConModal>
        </div>
      </div>
    </li>
  )
}

/** Con muchas respuestas, las viejas se pliegan y se ven las dos últimas. */
const VISIBLES = 2

export function HiloDeComunidad({
  hilo,
  vuelta,
  ahora,
  recienRespondido,
}: {
  hilo: Hilo
  /** La URL de la bandeja tal como está, para volver a ella. */
  vuelta: string
  ahora: number
  recienRespondido: boolean
}) {
  const tipoRaiz = hilo.tipo === 'muro' ? 'post' : 'pregunta'
  const plegadas = hilo.respuestas.length > VISIBLES + 1 ? hilo.respuestas.slice(0, -VISIBLES) : []
  const abiertas = plegadas.length > 0 ? hilo.respuestas.slice(-VISIBLES) : hilo.respuestas

  return (
    <li
      id={`hilo-${hilo.id}`}
      className={cn(
        'flex scroll-mt-32 flex-col gap-4 rounded-[10px] border bg-card p-4 sm:p-5',
        recienRespondido ? 'border-accent ring-3 ring-accent/30' : 'border-border',
        hilo.oculto && 'border-dashed'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Contexto hilo={hilo} />
        <div className="flex flex-wrap items-center gap-1.5">
          {hilo.fijado ? <Badge className="bg-accent text-[11px] text-accent-foreground">Fijada</Badge> : null}
          {hilo.oculto ? (
            <Badge variant="outline" className="text-[11px]">
              Oculta para los alumnos
            </Badge>
          ) : null}
          <Estado hilo={hilo} ahora={ahora} />
        </div>
      </div>

      <div className="flex gap-3">
        <Avatar nombre={hilo.autor.nombre} tamano={38} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Firma autor={hilo.autor} creadoEn={hilo.creadoEn} />
          {hilo.titulo ? <h3 className="text-[1.05rem] leading-snug font-medium text-pretty">{hilo.titulo}</h3> : null}
          {hilo.rico ? <RenderRico contenido={hilo.rico} className="text-sm" /> : null}
          {hilo.texto ? <p className="text-[0.95rem] break-words whitespace-pre-wrap">{hilo.texto}</p> : null}
        </div>
      </div>

      {hilo.respuestas.length > 0 ? (
        <div className="ml-4 flex flex-col gap-3 border-l-2 border-border pl-4 sm:ml-[1.2rem]">
          {plegadas.length > 0 ? (
            <details className="group/plegadas">
              <summary className="w-fit cursor-pointer list-none text-sm font-medium text-primary select-none [&::-webkit-details-marker]:hidden">
                <span className="group-open/plegadas:hidden">Ver {plegadas.length} respuestas anteriores</span>
                <span className="hidden group-open/plegadas:inline">Ocultar respuestas anteriores</span>
              </summary>
              <ul className="mt-3 flex flex-col gap-3">
                {plegadas.map((m) => (
                  <Respuesta key={m.id} mensaje={m} hilo={hilo} vuelta={vuelta} />
                ))}
              </ul>
            </details>
          ) : null}
          <ul className="flex flex-col gap-3">
            {abiertas.map((m) => (
              <Respuesta key={m.id} mensaje={m} hilo={hilo} vuelta={vuelta} />
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-border/70 pt-3">
        <div className="flex flex-wrap items-center gap-1">
          {hilo.tipo === 'muro' ? (
            <form action={alternarFijado}>
              <Vuelta vuelta={vuelta} />
              <input type="hidden" name="id" value={hilo.id} />
              <input type="hidden" name="fijar" value={hilo.fijado ? 'no' : 'si'} />
              <BotonConEspera texto={hilo.fijado ? 'Desfijar' : 'Fijar'} enCurso="Guardando…" variante="ghost" />
            </form>
          ) : null}
          <Ocultar tipo={tipoRaiz} id={hilo.id} oculto={hilo.oculto} vuelta={vuelta} />
          <ConfirmarConModal
            idModal={`eliminar-${hilo.id}`}
            accion={eliminarDeComunidad}
            campos={{ tipo: tipoRaiz, id: hilo.id, vuelta }}
            boton={{
              texto: 'Eliminar',
              etiquetaAccesible: `Eliminar ${hilo.titulo ? `«${hilo.titulo}»` : `la pregunta de ${hilo.autor.nombre}`}`,
              tono: 'destructivo',
            }}
            titulo={hilo.titulo ? `¿Eliminar «${hilo.titulo}»?` : '¿Eliminar esta pregunta?'}
            confirmar={{ texto: 'Sí, eliminar', enCurso: 'Eliminando…', tono: 'destructivo' }}
          >
            <p>
              Se borra para siempre{hilo.respuestas.length > 0 ? `, con sus ${hilo.respuestas.length} respuestas` : ''}.
              Si solo estorba, Ocultar se puede deshacer.
            </p>
          </ConfirmarConModal>
          <Link
            href={hilo.hrefPortal}
            className="ml-auto inline-flex min-h-8 items-center rounded-md px-2.5 text-sm text-primary underline-offset-4 hover:underline"
          >
            Ver en el portal →
          </Link>
        </div>

        <Desplegable etiqueta="Responder" variante={hilo.estado === 'sin' ? 'primario' : 'contorno'} tamano="sm" icono="ninguno">
          <form action={responderHilo} className="flex flex-col gap-3">
            <Vuelta vuelta={vuelta} />
            <input type="hidden" name="tipo" value={hilo.tipo} />
            <input type="hidden" name="id" value={hilo.id} />
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                Tu respuesta{hilo.generacion ? ` (la ve ${hilo.generacion.nombre})` : ''}
              </span>
              <Textarea
                name="contenido"
                required
                minLength={2}
                maxLength={2000}
                rows={4}
                placeholder={`Contesta a ${hilo.autor.nombre.split(' ')[0] ?? hilo.autor.nombre}…`}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Sale con tu nombre y la etiqueta «Equipo VADAI», {hilo.tipo === 'muro' ? 'debajo de la publicación' : 'debajo de la pregunta, en la lección'}.
            </p>
            <div>
              <BotonConEspera texto="Publicar respuesta" enCurso="Publicando…" tamano="default" className="w-full sm:w-auto" />
            </div>
          </form>
        </Desplegable>
      </div>
    </li>
  )
}
