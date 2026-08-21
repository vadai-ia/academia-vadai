import { FormularioTarea } from '@/components/admin/formulario-tarea'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

import { crearTarea } from '@/lib/admin/acciones-tareas'
import type { TareaConEntregas } from '@/lib/admin/tareas'

/** Builder de tareas (§3.5). Server component, como el resto del admin. */
export function ConstructorTarea({
  tarea,
  leccionId,
}: {
  tarea: TareaConEntregas | null
  leccionId: string
}) {
  if (!tarea) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Tarea</h2>
        <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Esta lección es de tipo tarea pero todavía no está configurada.
          </p>
          <form action={crearTarea}>
            <input type="hidden" name="lesson_id" value={leccionId} />
            <Button type="submit" variant="outline">
              Crear la tarea
            </Button>
          </form>
        </div>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Tarea</h2>
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          {tarea.entregas} entrega(s)
          {tarea.pendientes > 0 ? (
            <Badge className="bg-vadai-lima text-vadai-navy">
              {tarea.pendientes} por revisar
            </Badge>
          ) : null}
          <Link
            href="/admin/entregas"
            className="text-vadai-cyan underline-offset-4 hover:underline"
          >
            Ir a la bandeja
          </Link>
        </span>
      </div>

      <FormularioTarea tarea={tarea} leccionId={leccionId} />
    </section>
  )
}
