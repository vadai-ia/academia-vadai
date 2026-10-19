import type { Metadata } from 'next'

import { DatosDePerfil } from '@/components/alumno/datos-de-perfil'
import { EncabezadoPerfil } from '@/components/alumno/encabezado-perfil'
import { FotoYBio } from '@/components/alumno/foto-y-bio'
import { exigirPerfil } from '@/lib/auth/sesion'

export const metadata: Metadata = { title: 'Mi perfil' }
export const dynamic = 'force-dynamic'

/**
 * Mi perfil → Datos.
 *
 * §3.6 lo pide de pasada —"re-descargable desde el perfil"— pero es también
 * donde el alumno corrige su nombre, que es el que se imprime en el
 * certificado y el que ve quien lo verifica. Desde M22 la membresía, los
 * certificados y los puntos viven en sus pestañas (EncabezadoPerfil).
 */
export default async function PaginaPerfil() {
  const perfil = await exigirPerfil()

  return (
    <div className="flex flex-col gap-10">
      <EncabezadoPerfil apoyo="Tus datos, tu membresía, tus certificaciones y tus puntos." />

      <div className="flex max-w-2xl flex-col gap-10">
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Datos</h2>
          <DatosDePerfil nombre={perfil.full_name} correo={perfil.email} />
        </section>

        <section className="flex flex-col gap-4 border-t border-border pt-8">
          <h2 className="text-lg font-semibold">Tu foto y tu bio</h2>
          <FotoYBio nombre={perfil.full_name || perfil.email} foto={perfil.avatar_url} bio={perfil.bio} />
        </section>
      </div>
    </div>
  )
}
