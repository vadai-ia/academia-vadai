import { Pestanas } from '@/components/ui-vadai/pestanas'
import { Titulo } from '@/components/ui-vadai/superficie'

/**
 * Mi perfil, con sus pestañas (M22, 20-oct-2026). Antes eran tres destinos del
 * menú —«Tus puntos», «Mis certificaciones», «Mi perfil»— y los certificados
 * salían dos veces, en Perfil y en Certificaciones, con los mismos botones.
 * Ahora todo lo que es tuyo vive aquí, una vez cada cosa:
 *
 *   Datos · Membresía · Certificaciones · Puntos y logros
 *
 * Las rutas viejas (/puntos, /certificaciones) redirigen (next.config.ts).
 */
export function EncabezadoPerfil({ apoyo }: { apoyo?: string }) {
  return (
    <div className="flex flex-col gap-5 print:hidden">
      <Titulo apoyo={apoyo}>Mi perfil</Titulo>
      <Pestanas
        etiqueta="Secciones de tu perfil"
        llenar
        pestanas={[
          { href: '/perfil', etiqueta: 'Datos', exacto: true },
          { href: '/perfil/membresia', etiqueta: 'Membresía' },
          { href: '/perfil/certificaciones', etiqueta: 'Certificaciones' },
          { href: '/perfil/puntos', etiqueta: 'Puntos' },
        ]}
      />
    </div>
  )
}
