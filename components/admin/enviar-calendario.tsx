'use client'

import { useActionState } from 'react'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { ConfirmarConModal } from '@/components/admin/confirmar-con-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { enviarCalendarioPorCorreo } from '@/lib/admin/acciones-cohortes'
import { SIN_ESTADO } from '@/lib/admin/tipos'

/**
 * Mandar las fechas de las sesiones por correo, con botones de calendario.
 *
 * Primero una prueba a un correo (el mismo mensaje, marcado [PRUEBA]); luego
 * a todos los inscritos de la cohorte, con confirmación porque son decenas de
 * buzones reales.
 */
export function EnviarCalendario({
  cohorteId,
  inscritos,
  sesionesFuturas,
  correoAdmin,
}: {
  cohorteId: string
  inscritos: number
  sesionesFuturas: number
  correoAdmin: string
}) {
  const [estadoPrueba, probar, probando] = useActionState(enviarCalendarioPorCorreo, SIN_ESTADO)

  if (sesionesFuturas === 0) return null

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">Mandar las fechas por correo</span>
        <span className="text-sm text-muted-foreground">
          Las {sesionesFuturas} sesiones futuras con botones para agregarlas a Google Calendar, Outlook o
          .ics.
        </span>
      </div>

      <form action={probar} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="cohort_id" value={cohorteId} />
        <Input name="para" type="email" defaultValue={correoAdmin} aria-label="Correo para la prueba" className="h-9 max-w-xs" />
        <Button type="submit" variant="outline" size="sm" disabled={probando}>
          {probando ? 'Mandando prueba…' : 'Mandarme una prueba'}
        </Button>
      </form>
      <AvisoAccion estado={estadoPrueba} />

      <div>
        <ConfirmarConModal
          idModal={`calendario-todos-${cohorteId}`}
          accion={enviarCalendarioPorCorreo}
          campos={{ cohort_id: cohorteId }}
          boton={{ texto: `Mandar a los ${inscritos} inscritos`, etiquetaAccesible: 'Mandar las fechas a todos los inscritos' }}
          titulo={`¿Mandar las fechas a los ${inscritos} inscritos?`}
          confirmar={{ texto: 'Sí, mandar a todos', enCurso: 'Mandando…' }}
        >
          <p>
            Cada persona recibe un correo con las {sesionesFuturas} sesiones y sus botones de
            calendario. Sale en lote, en segundos. Manda primero una prueba a tu correo.
          </p>
        </ConfirmarConModal>
      </div>
    </div>
  )
}
