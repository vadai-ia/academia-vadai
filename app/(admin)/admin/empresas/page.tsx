import type { Metadata } from 'next'
import Link from 'next/link'

import { ConfirmarConModal } from '@/components/admin/confirmar-con-modal'
import { NuevaEmpresa } from '@/components/admin/nueva-empresa'
import { Cifra, Tarjeta, Titulo } from '@/components/ui-vadai/superficie'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { eliminarEmpresa, renombrarEmpresa } from '@/lib/admin/acciones-empresas'
import { listarEmpresas } from '@/lib/admin/empresas'
import { exigirAdmin } from '@/lib/auth/sesion'

export const metadata: Metadata = { title: 'Empresas' }
export const dynamic = 'force-dynamic'

/**
 * Las empresas de las que vienen los alumnos.
 *
 * Se dan de alta aquí ANTES y se eligen después, en el alta y en la fila de
 * cada alumno. Es la base de lo que viene: puntaje por empresa y dinámicas
 * segmentadas por empresa. Quien no tiene empresa es "General".
 *
 * Renombrar es un <form> por renglón con el nombre editable en línea; borrar
 * pide confirmación porque, aunque no borra alumnos, los deja en General.
 */
export default async function PaginaEmpresas() {
  await exigirAdmin()
  const empresas = await listarEmpresas()
  const conAlumnos = empresas.filter((e) => e.alumnos > 0).length
  const totalAlumnos = empresas.reduce((n, e) => n + e.alumnos, 0)

  return (
    <div className="flex flex-col gap-8">
      <Titulo apoyo="De dónde viene cada alumno. Sin empresa = General.">Empresas</Titulo>

      <Tarjeta className="p-5">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          <Cifra valor={empresas.length} etiqueta="empresas" />
          <Cifra valor={conAlumnos} etiqueta="con alumnos" destacada />
          <Cifra valor={totalAlumnos} etiqueta="alumnos con empresa" />
        </div>
      </Tarjeta>

      <NuevaEmpresa reinicio={empresas.length} />

      {empresas.length === 0 ? (
        <Tarjeta className="border-dashed px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Todavía no hay empresas. Crea la primera arriba, o sube un padrón con columna
            &ldquo;Empresa&rdquo; en Alumnos y se crean solas.
          </p>
        </Tarjeta>
      ) : (
        <Tarjeta className="overflow-hidden">
          <ul>
            {empresas.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
              >
                <form action={renombrarEmpresa} className="flex min-w-0 flex-1 items-center gap-2">
                  <input type="hidden" name="id" value={e.id} />
                  <Input
                    name="nombre"
                    defaultValue={e.nombre}
                    aria-label={`Nombre de ${e.nombre}`}
                    required
                    minLength={2}
                    className="h-9 max-w-sm"
                  />
                  <Button type="submit" variant="ghost" size="sm">
                    Guardar
                  </Button>
                </form>

                <Link
                  href={`/admin/alumnos?empresa=${e.id}`}
                  className="text-sm text-muted-foreground tabular-nums underline-offset-4 hover:text-primary hover:underline"
                >
                  {e.alumnos} alumno{e.alumnos === 1 ? '' : 's'}
                </Link>

                <ConfirmarConModal
                  idModal={`borrar-empresa-${e.id}`}
                  accion={eliminarEmpresa}
                  campos={{ id: e.id }}
                  boton={{ texto: 'Borrar', etiquetaAccesible: `Borrar la empresa ${e.nombre}`, tono: 'destructivo' }}
                  titulo={`¿Borrar «${e.nombre}»?`}
                  confirmar={{ texto: 'Sí, borrar', enCurso: 'Borrando…', tono: 'destructivo' }}
                >
                  <p>
                    {e.alumnos > 0
                      ? `Sus ${e.alumnos} alumno${e.alumnos === 1 ? '' : 's'} no se borran: quedan en General, sin empresa.`
                      : 'No tiene alumnos.'}
                  </p>
                </ConfirmarConModal>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </div>
  )
}
