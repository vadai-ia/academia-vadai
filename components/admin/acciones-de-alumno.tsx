'use client'

import { useActionState } from 'react'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import type { CursoOpcion, EmpresaOpcion } from '@/components/admin/dar-de-alta'
import { Desplegable } from '@/components/admin/desplegable'
import { claseSelectCompacto } from '@/components/admin/estilos'
import { ListaSeleccionable, gruposDesdeCursos } from '@/components/admin/lista-seleccionable'
import { Button } from '@/components/ui/button'
import { darAccesoACursos } from '@/lib/admin/acciones-alumnos'
import { cambiarEmpresaDeAlumnoConAviso } from '@/lib/admin/acciones-empresas'
import { enlaceDeAcceso } from '@/lib/admin/acciones-equipo'
import { SIN_ESTADO } from '@/lib/admin/tipos'

/**
 * Las acciones de una persona que necesitan estado en el cliente. Las usa la
 * ficha (/admin/alumnos/[userId]); nacieron en la fila desplegable de la
 * lista, que M14 volvió tabla.
 */

/**
 * El enlace de acceso de 30 días.
 *
 * Es el respaldo de §11: cuando el correo no llega, en vez de decirle al alumno
 * "revisa tu spam" se le pasa el enlace por WhatsApp. Aparece en pantalla; en
 * la base queda solo su hash (lib/auth/enlace-durable.ts).
 */
export function EnlaceDeAcceso({ email }: { email: string }) {
  const [estado, accion] = useActionState(enlaceDeAcceso, SIN_ESTADO)

  return (
    <div className="flex flex-col gap-2">
      <form action={accion}>
        <input type="hidden" name="email" value={email} />
        <Button type="submit" variant="outline" size="sm">
          Generar enlace de acceso
        </Button>
      </form>

      {estado.aviso ? (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            Vale 30 días. Cópialo y mándaselo por WhatsApp:
          </span>
          <input
            readOnly
            value={estado.aviso}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-md border border-border bg-muted/50 px-2.5 py-2 font-mono text-xs"
          />
        </label>
      ) : estado.error ? (
        <AvisoAccion estado={estado} />
      ) : null}
    </div>
  )
}

/**
 * Da acceso a más cursos a alguien que ya tiene cuenta.
 *
 * Los cursos se eligen en una lista de casillas: un toque marca, otro desmarca,
 * igual con ratón que con dedo. Un curso sin grupos es un renglón suelto; uno
 * con grupos es un bloque donde cada grupo es un renglón, así un solo control
 * resuelve curso Y grupo sin depender de JavaScript.
 *
 * Solo lista lo que la persona NO tiene. El aviso vive FUERA del desplegable:
 * cuando se le da el último curso que le faltaba el formulario deja de
 * pintarse, y el aviso tiene que sobrevivirlo.
 */
export function DarAcceso({ userId, disponibles }: { userId: string; disponibles: CursoOpcion[] }) {
  const [estado, accion] = useActionState(darAccesoACursos, SIN_ESTADO)

  return (
    <div className="flex flex-col gap-2">
      {disponibles.length > 0 ? (
        <Desplegable
          etiqueta="Dar acceso a otro curso"
          variante="discreto"
          tamano="sm"
          abierto={Boolean(estado.error)}
        >
          {/* `key` con un valor del servidor: al agregarse inscripciones el
              formulario se remonta limpio, sin envolver la acción en un closure. */}
          <form key={disponibles.length} action={accion} className="flex flex-col gap-3">
            <input type="hidden" name="user_id" value={userId} />

            <ListaSeleccionable nombre="accesos" leyenda="Cursos" grupos={gruposDesdeCursos(disponibles)} />

            <p className="text-xs text-muted-foreground">
              Toca los que quieras; toca otra vez para quitar. Se le avisa por correo que ya tiene
              el curso.
            </p>

            <div>
              <Button type="submit" size="sm">
                Dar acceso
              </Button>
            </div>
          </form>
        </Desplegable>
      ) : (
        <p className="text-xs text-muted-foreground">Ya tiene todos los cursos activos.</p>
      )}
      <AvisoAccion estado={estado} />
    </div>
  )
}

/**
 * La empresa de la persona, con aviso.
 *
 * Roberto reportó que "Guardar empresa no funciona" (21-sep-2026). La acción
 * sí guardaba, pero no decía nada: la fila se redibujaba igual y parecía que
 * el clic se había perdido. Ahora contesta ("Empresa guardada: Mormen") y
 * además se puede escribir una empresa nueva sin ir a Empresas.
 */
export function CambiarEmpresa({
  userId,
  actual,
  empresas,
}: {
  userId: string
  actual: string
  empresas: EmpresaOpcion[]
}) {
  const [estado, accion, guardando] = useActionState(cambiarEmpresaDeAlumnoConAviso, SIN_ESTADO)

  return (
    <div className="flex flex-col gap-1.5">
      <form action={accion} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="user_id" value={userId} />
        <label htmlFor={`empresa-${userId}`} className="text-sm text-muted-foreground">
          Empresa
        </label>
        <select id={`empresa-${userId}`} name="company_id" defaultValue={actual} className={claseSelectCompacto}>
          <option value="">General</option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
        <input
          type="text"
          name="company_nueva"
          placeholder="…o una nueva"
          autoComplete="off"
          aria-label="Empresa nueva"
          className="h-8 w-40 rounded-lg border border-input bg-transparent px-2 text-sm"
        />
        <Button type="submit" variant="outline" size="sm" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
      <AvisoAccion estado={estado} />
    </div>
  )
}
