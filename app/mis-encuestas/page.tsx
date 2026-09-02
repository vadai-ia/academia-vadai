import type { Metadata } from 'next'
import Link from 'next/link'

import { BotonSalir } from '@/components/auth/boton-salir'
import { CambiarTema } from '@/components/marca/cambiar-tema'
import { EtiquetaAcademia, Wordmark } from '@/components/marca/wordmark'
import { Badge } from '@/components/ui/badge'
import { Tarjeta, Titulo } from '@/components/ui-vadai/superficie'
import { exigirPerfil, nombreVisible } from '@/lib/auth/sesion'
import { ETIQUETA_ESTADO_ENCUESTA } from '@/lib/encuestas/comun'
import { misEncuestas } from '@/lib/encuestas/consultas'

export const metadata: Metadata = { title: 'Mis dinámicas' }
export const dynamic = 'force-dynamic'

const VARIANTE = {
  live: 'default',
  draft: 'secondary',
  closed: 'outline',
} as const

function fechaLarga(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  }).format(new Date(iso))
}

/**
 * La casa de quien nació en una encuesta.
 *
 * `rutaDeInicio()` manda aquí a los `invitado`. Antes de esta página caían en
 * /mis-cursos, que les decía "todavía no tienes ningún curso asignado — si
 * compraste uno, escríbenos". Es un mensaje correcto para un alumno que espera
 * su acceso y absurdo para alguien que nunca compró nada y solo contestó unas
 * preguntas en un evento: lo mandaba a escribir un correo por un problema que
 * no existía.
 *
 * Tiene su propia envoltura y no el layout de alumno porque ese trae la
 * navegación de cursos, y ofrecerle "Inicio → mis cursos" a quien no tiene
 * ninguno es volver al mismo callejón.
 */
export default async function PaginaMisEncuestas() {
  const perfil = await exigirPerfil()
  const encuestas = await misEncuestas()

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 px-5 py-8 sm:py-12">
      <header className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-2.5">
          <Wordmark alto={20} prioridad />
          <EtiquetaAcademia className="hidden text-[0.6rem] tracking-[0.28em] sm:inline" />
        </span>
        <span className="flex items-center gap-2">
          <CambiarTema />
          <BotonSalir />
        </span>
      </header>

      <Titulo apoyo={`Hola, ${nombreVisible(perfil)}. Aquí está lo que has contestado con nosotros.`}>
        Mis dinámicas
      </Titulo>

      {encuestas.length === 0 ? (
        <Tarjeta className="border-dashed px-5 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Todavía no has participado en ninguna dinámica con esta cuenta.
          </p>
        </Tarjeta>
      ) : (
        <ul className="flex flex-col gap-3">
          {encuestas.map((encuesta) => (
            <li key={encuesta.id}>
              <Tarjeta className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{encuesta.titulo}</span>
                    <Badge variant={VARIANTE[encuesta.estado]} className="shrink-0">
                      {ETIQUETA_ESTADO_ENCUESTA[encuesta.estado]}
                    </Badge>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Participaste el {fechaLarga(encuesta.entreEn)}
                  </span>
                </div>

                {encuesta.estado === 'live' ? (
                  <Link
                    href={`/e/${encuesta.joinCode}`}
                    className="shrink-0 text-sm text-primary underline-offset-4 hover:underline"
                  >
                    Volver a entrar →
                  </Link>
                ) : null}
              </Tarjeta>
            </li>
          ))}
        </ul>
      )}

      {/* La razón de ser de todo esto: la persona dejó su correo en un evento y
          ahora tiene cuenta. Este es el único lugar donde se le puede contar que
          existe algo más que la dinámica a la que entró. */}
      <Tarjeta className="flex flex-col gap-3 px-5 py-6">
        <h2 className="text-lg font-medium">¿Quieres llevarte esto a tu equipo?</h2>
        <p className="text-sm text-muted-foreground text-balance">
          VADAI capacita a empresas en IA aplicada al Excel, el Word y el correo que tu gente ya
          usa todos los días. +40 empresas capacitadas y 4.9 de calificación.
        </p>
        <a
          href="mailto:hola@vadai.com.mx?subject=Quiero%20informaci%C3%B3n%20de%20los%20cursos"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Cuéntanos de tu empresa →
        </a>
      </Tarjeta>
    </main>
  )
}
