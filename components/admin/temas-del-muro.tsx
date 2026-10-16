'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { alternarTema, crearTema } from '@/lib/admin/acciones-temas'
import { SIN_ESTADO } from '@/lib/admin/tipos'

function Crear() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Creando…' : 'Agregar tema'}
    </Button>
  )
}

export type TemaDelPanel = { id: string; nombre: string; archivado: boolean; soloEquipo?: boolean }

/** Los temas del muro de un curso (M17): agregar y archivar. */
export function TemasDelMuro({ cursoId, temas }: { cursoId: string; temas: TemaDelPanel[] }) {
  const [estado, accion] = useActionState(crearTema, SIN_ESTADO)

  return (
    <div className="flex flex-col gap-4">
      {temas.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {temas.map((t) => (
            <li key={t.id}>
              <form action={alternarTema} className="flex items-center gap-1.5 rounded-full border border-border py-1 pr-1 pl-3 text-sm">
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="archivar" value={t.archivado ? 'no' : 'si'} />
                <span className={t.archivado ? 'text-muted-foreground line-through' : ''}>
                  {t.nombre}
                  {t.soloEquipo ? <span className="text-xs text-muted-foreground"> · solo equipo</span> : null}
                </span>
                <Button type="submit" variant="ghost" size="xs">
                  {t.archivado ? 'Reactivar' : 'Archivar'}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Sin temas, el muro es uno solo. Con temas, sigue siendo uno y cada quien filtra lo que le interesa.
        </p>
      )}

      <form key={temas.length} action={accion} className="flex flex-wrap items-start gap-2">
        <input type="hidden" name="course_id" value={cursoId} />
        <Input name="nombre" placeholder="Prompts, Automatizaciones, Presenta tu proyecto…" required minLength={2} maxLength={40} className="h-9 max-w-xs" />
        <Crear />
        <div className="basis-full">
          <AvisoAccion estado={estado} />
        </div>
      </form>
    </div>
  )
}
