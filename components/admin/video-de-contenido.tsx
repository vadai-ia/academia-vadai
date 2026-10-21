import Link from 'next/link'

import { ConfirmarConModal } from '@/components/admin/confirmar-con-modal'
import { PublicacionDeContenido } from '@/components/admin/contenido-vaip'
import { SubidaVideo } from '@/components/admin/subida-video'
import { Tarjeta } from '@/components/ui-vadai/superficie'
import { eliminarContenido } from '@/lib/vaip/acciones'
import type { ContenidoDelPanel } from '@/lib/vaip/admin'
import { duracionCorta, rutaDeContenido } from '@/lib/vaip/rutas'

/**
 * El video de una grabación o herramienta de V-AI-P y si ya la ven los
 * miembros (M26). La subida va directo del navegador a Bunny (TUS), como en
 * las lecciones; publicar sin video no se puede.
 */
export function VideoDeContenido({ c, bunnyListo }: { c: ContenidoDelPanel; bunnyListo: boolean }) {
  const que = c.tipo === 'mes' ? 'grabación' : 'herramienta'
  const duracion = duracionCorta(c.duracionSeg)
  return (
    <Tarjeta className="flex flex-col gap-5 p-4 sm:p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-medium">Video</h2>
        <p className="text-sm text-muted-foreground">
          {c.videoId
            ? `Ya tiene video${duracion ? ` (${duracion})` : ''}. Subir otro lo reemplaza.`
            : c.tipo === 'mes'
              ? 'Sube aquí la grabación de la clase.'
              : c.orientacion === 'vertical'
                ? 'Sube el video vertical (9:16).'
                : 'Sube el video horizontal (16:9).'}
        </p>
      </div>
      {bunnyListo ? (
        <SubidaVideo leccionId={c.id} cursoId={c.cursoId} titulo={c.titulo} guidActual={c.videoId} avisoDeReemplazo={false} />
      ) : (
        <p className="text-sm text-muted-foreground">La subida de video no está configurada (variables BUNNY_STREAM_*).</p>
      )}
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <PublicacionDeContenido id={c.id} publicada={c.status === 'published'} conVideo={Boolean(c.videoId)} que={que} />
        {c.status === 'published' ? (
          <Link
            href={rutaDeContenido(c.tipo, c.id)}
            target="_blank"
            rel="noreferrer"
            className="w-fit text-sm text-primary underline-offset-4 hover:underline"
          >
            Ver como miembro ↗
          </Link>
        ) : null}
      </div>
    </Tarjeta>
  )
}

/** Eliminar: solo admin. */
export function EliminarContenido({ c }: { c: ContenidoDelPanel }) {
  const que = c.tipo === 'mes' ? 'grabación' : 'herramienta'
  return (
    <div className="border-t border-border pt-6">
      <ConfirmarConModal
        idModal={`eliminar-${c.id}`}
        accion={eliminarContenido}
        campos={{ id: c.id }}
        boton={{ texto: `Eliminar ${que}`, etiquetaAccesible: `Eliminar la ${que} ${c.titulo}`, tono: 'destructivo' }}
        titulo={`¿Eliminar «${c.titulo}»?`}
        confirmar={{ texto: 'Sí, eliminar', enCurso: 'Eliminando…', tono: 'destructivo' }}
      >
        <p>
          Se borra con su material, sus comentarios y lo que los miembros llevaban visto. Si es mejor que solo deje de
          verse, regrésala a borrador. No se puede deshacer.
        </p>
      </ConfirmarConModal>
    </div>
  )
}
