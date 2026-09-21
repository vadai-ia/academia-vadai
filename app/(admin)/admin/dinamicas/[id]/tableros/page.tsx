import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { RefrescoPeriodico } from '@/components/encuestas/refresco-periodico'
import { Avatar, Progreso, Seccion, Tarjeta, TarjetaEnlace } from '@/components/ui-vadai/superficie'
import { fechaHoraCdmx } from '@/lib/admin/fechas'
import { exigirAdmin } from '@/lib/auth/sesion'
import {
  empresasDelCursoSinTablero,
  obtenerDinamica,
  tablerosDeDinamica,
  type ResumenTablero,
} from '@/lib/dinamicas/consultas'

export const dynamic = 'force-dynamic'

// Sin `loading.tsx`: el notFound() es control de acceso.

export const metadata: Metadata = { title: 'Tableros de la dinámica' }

const MAX_AVATARES = 5

/**
 * Una tarjeta por tablero, entera clickeable: la empresa, cuántos proyectos,
 * quiénes editan, cuánto llevan y el mejor ponderado. Es lo que el admin mira
 * entre sesiones para saber a quién empujar.
 */
function TarjetaTablero({ tablero, base }: { tablero: ResumenTablero; base: string }) {
  const porcentaje = tablero.total === 0 ? 0 : (tablero.llenas / tablero.total) * 100

  return (
    <li>
      <TarjetaEnlace href={`${base}/${tablero.id}`} className="flex flex-col gap-3 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate font-medium">{tablero.empresa ?? tablero.dueno}</span>
          <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
            {tablero.columnas} proyectos
          </span>
        </div>

        {tablero.editores.length > 0 ? (
          <div className="flex items-center gap-1">
            {tablero.editores.slice(0, MAX_AVATARES).map((nombre, i) => (
              <Avatar key={`${nombre}-${i}`} nombre={nombre} tamano={28} />
            ))}
            {tablero.editores.length > MAX_AVATARES ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                +{tablero.editores.length - MAX_AVATARES}
              </span>
            ) : null}
            <span className="sr-only">Editan: {tablero.editores.join(', ')}</span>
          </div>
        ) : null}

        <Progreso
          porcentaje={porcentaje}
          etiqueta={`${tablero.llenas} de ${tablero.total} celdas calificadas`}
        />

        <p className="text-xs text-muted-foreground tabular-nums">
          {tablero.columnas === 0 ? (
            'Tablero abierto, todavía sin proyectos.'
          ) : (
            <>
              <strong className="font-medium text-foreground">
                {tablero.llenas} de {tablero.total}
              </strong>{' '}
              celdas
              {tablero.mejor ? (
                <>
                  {' '}
                  · Mejor: {tablero.mejor.proyecto} ·{' '}
                  <strong className="font-medium text-foreground">
                    {tablero.mejor.valor.toFixed(1)}
                  </strong>
                </>
              ) : null}
              {tablero.ultimaEdicion ? (
                <> · Última edición {fechaHoraCdmx(tablero.ultimaEdicion)} (CDMX)</>
              ) : null}
            </>
          )}
        </p>
      </TarjetaEnlace>
    </li>
  )
}

export default async function PaginaTableros({ params }: { params: Promise<{ id: string }> }) {
  await exigirAdmin()

  const { id } = await params
  const [dinamica, tableros, sinTablero] = await Promise.all([
    obtenerDinamica(id),
    tablerosDeDinamica(id),
    empresasDelCursoSinTablero(id),
  ])
  if (!dinamica) notFound()

  const base = `/admin/dinamicas/${dinamica.id}/tableros`
  const porEmpresa = tableros.filter((t) => t.empresa !== null)
  const individuales = tableros.filter((t) => t.empresa === null)
  const completos = tableros.filter((t) => t.mejor !== null).length

  return (
    <div className="flex flex-col gap-8">
      <Seccion
        titulo="Por empresa"
        apoyo={`${tableros.length} tableros · ${completos} con al menos un proyecto completo`}
        accion={
          // El sondeo de abajo es JavaScript; sin él, esto es lo que recarga.
          <a href={base} className="text-sm text-primary underline-offset-4 hover:underline">
            Actualizar
          </a>
        }
      >
        {tableros.length === 0 ? (
          <Tarjeta className="border-dashed px-5 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {dinamica.status === 'draft'
                ? 'Los tableros aparecen cuando la abras: en borrador nadie puede entrar todavía.'
                : dinamica.estadoEfectivo === 'closed'
                  ? 'Esta dinámica cerró sin que ninguna empresa empezara un tablero.'
                  : 'Todavía nadie empieza un tablero. En cuanto una empresa entre aparece aquí; esta pantalla se actualiza sola cada 3 segundos.'}
            </p>
          </Tarjeta>
        ) : porEmpresa.length === 0 ? (
          <Tarjeta className="border-dashed px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Ninguna empresa ha empezado su tablero; los que hay son individuales.
            </p>
          </Tarjeta>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {porEmpresa.map((t) => (
              <TarjetaTablero key={t.id} tablero={t} base={base} />
            ))}
          </ul>
        )}
      </Seccion>

      {individuales.length > 0 ? (
        <Seccion titulo="Individuales" apoyo="Alumnos sin empresa (General)">
          <ul className="grid gap-3 sm:grid-cols-2">
            {individuales.map((t) => (
              <TarjetaTablero key={t.id} tablero={t} base={base} />
            ))}
          </ul>
        </Seccion>
      ) : null}

      <Seccion
        titulo="Sin tablero todavía"
        apoyo="Empresas inscritas al curso que no han entrado"
      >
        {sinTablero.length === 0 ? (
          <Tarjeta className="border-dashed px-5 py-8 text-center text-sm text-muted-foreground">
            Todas las empresas del curso ya tienen tablero.
          </Tarjeta>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {sinTablero.map((e) => (
              <li
                key={e.id}
                className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                title={`${e.alumnos} alumno(s) inscritos`}
              >
                {e.nombre}
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      <RefrescoPeriodico />
    </div>
  )
}
