import type { ReactNode } from 'react'

import { MarcaVaip } from '@/components/marca/logo-vaip'
import { Pestanas, type Pestana } from '@/components/ui-vadai/pestanas'
import { esAdmin, exigirEquipo } from '@/lib/auth/sesion'

/**
 * El portal de la comunidad V-AI-P en el panel (M19, 16-oct-2026).
 *
 * Del equipo: el admin y el community manager atienden la comunidad desde
 * aquí. Cobros y Planes son solo de admin —el community manager no ve pagos—,
 * y no solo se esconden: cada una de esas páginas exige admin por su cuenta.
 */
export default async function LayoutVaip({ children }: { children: ReactNode }) {
  const perfil = await exigirEquipo()

  const pestanas: Pestana[] = [
    { href: '/admin/vaip', etiqueta: 'Resumen', exacto: true },
    // M24: lo de todos los días, junto al resumen.
    { href: '/admin/vaip/noticias', etiqueta: 'Noticias' },
    { href: '/admin/vaip/publicar', etiqueta: 'Publicar' },
    { href: '/admin/vaip/miembros', etiqueta: 'Miembros' },
    { href: '/admin/vaip/clases', etiqueta: 'Clases y eventos' },
    { href: '/admin/vaip/contenido', etiqueta: 'Contenido' },
    { href: '/admin/vaip/muro', etiqueta: 'Muro' },
    ...(esAdmin(perfil)
      ? [
          { href: '/admin/vaip/cobros', etiqueta: 'Cobros' },
          { href: '/admin/vaip/planes', etiqueta: 'Planes' },
        ]
      : []),
  ]

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <MarcaVaip />
        <p className="text-sm text-pretty text-muted-foreground">
          La comunidad de paga de la academia: quién está dentro, sus clases, su contenido y su muro.
        </p>
      </header>
      <Pestanas pestanas={pestanas} etiqueta="Secciones de V-AI-P" />
      {children}
    </div>
  )
}
