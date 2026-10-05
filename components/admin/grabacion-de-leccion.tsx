'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { SubidaVideo } from '@/components/admin/subida-video'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cambiarPublicacionDeLeccion } from '@/lib/admin/acciones'
import { SIN_ESTADO } from '@/lib/admin/tipos'

function Enviar({ publicar }: { publicar: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant={publicar ? 'default' : 'outline'} size="sm" disabled={pending}>
      {pending ? 'Guardando…' : publicar ? 'Publicar' : 'Pasar a borrador'}
    </Button>
  )
}

/**
 * Lo que el community manager hace en una lección (0036): subir su video —la
 * grabación de la sesión— y publicarla. El resto del editor (título, tipo,
 * descripción, quiz, tarea, borrar) es de admin y no se le enseña.
 */
export function GrabacionDeLeccion({
  leccion,
  cursoId,
  bunnyListo,
}: {
  leccion: { id: string; title: string; status: 'draft' | 'published'; bunny_video_id: string | null; lesson_type: string }
  cursoId: string
  bunnyListo: boolean
}) {
  const [estado, accion] = useActionState(cambiarPublicacionDeLeccion, SIN_ESTADO)
  const publicada = leccion.status === 'published'

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-border p-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Estado:</span>
          <Badge variant={publicada ? 'default' : 'secondary'}>{publicada ? 'Publicada' : 'Borrador'}</Badge>
        </div>
        <form action={accion}>
          <input type="hidden" name="id" value={leccion.id} />
          <input type="hidden" name="course_id" value={cursoId} />
          <input type="hidden" name="publicar" value={publicada ? 'no' : 'si'} />
          <Enviar publicar={!publicada} />
        </form>
      </div>
      <AvisoAccion estado={estado} />

      {leccion.lesson_type === 'video' ? (
        <div className="flex flex-col gap-3 rounded-[10px] border border-border p-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium">Video</h2>
            <p className="text-xs text-muted-foreground">
              {leccion.bunny_video_id
                ? 'Ya tiene video. Subir otro lo reemplaza.'
                : 'Todavía no tiene video. Sube aquí la grabación de la sesión.'}
            </p>
          </div>
          {bunnyListo ? (
            <SubidaVideo
              leccionId={leccion.id}
              cursoId={cursoId}
              titulo={leccion.title}
              guidActual={leccion.bunny_video_id}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              La subida de video no está configurada. Pídele a un admin que la ligue.
            </p>
          )}
        </div>
      ) : null}
    </section>
  )
}
