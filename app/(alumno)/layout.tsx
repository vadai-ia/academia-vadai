import Link from 'next/link'
import type { ReactNode } from 'react'

import { Campana } from '@/components/marca/campana'
import { Encabezado } from '@/components/marca/encabezado'
import {
  IconoBlog,
  IconoComunidad,
  IconoCursos,
  IconoPerfil,
  IconoPuntos,
} from '@/components/marca/iconos-navegacion'
import { SaltarAlContenido } from '@/components/marca/saltar-al-contenido'
import { esEquipo, exigirPerfil } from '@/lib/auth/sesion'
import { novedadesDeCanales } from '@/lib/notificaciones/canales'
import { notificacionesDelAlumno } from '@/lib/notificaciones/consultas'

/**
 * Marco del área de alumno. `exigirPerfil` es la segunda barrera: el middleware
 * ya filtró, pero un server component nunca debe confiar en eso solo.
 */
export default async function LayoutAlumno({ children }: { children: ReactNode }) {
  const perfil = await exigirPerfil()
  const equipo = esEquipo(perfil)
  // La campana va en el layout: en cualquier pantalla del alumno se ve si hay
  // algo nuevo, sin tener que volver al inicio.
  // Las dos van juntas: no dependen entre sí y encadenarlas costaría un viaje
  // de más en CADA pantalla del alumno.
  const [novedades, canales] = await Promise.all([
    notificacionesDelAlumno(perfil),
    novedadesDeCanales(perfil),
  ])

  return (
    <div className="relative flex min-h-dvh flex-col">
      <SaltarAlContenido />
      <Encabezado
        perfil={perfil}
        extra={<Campana lista={novedades.lista} nuevas={novedades.nuevas} />}
        navegacion={[
          { href: '/mis-cursos', etiqueta: 'Inicio', icono: IconoCursos, exacto: true },
          {
            href: '/comunidad',
            etiqueta: 'Comunidad',
            icono: IconoComunidad,
            novedades: canales.comunidad,
          },
          { href: '/blog', etiqueta: 'Blog', icono: IconoBlog, novedades: canales.blog },
          { href: '/puntos', etiqueta: 'Tus puntos', icono: IconoPuntos },
          { href: '/perfil', etiqueta: 'Mi perfil', icono: IconoPerfil },
        ]}
        // Solo para quien puede entrar al panel: un enlace que rebota es peor que
        // no tenerlo. Era una pastilla más al final del menú, "Panel", que nadie
        // leía como "salir de la vista de alumno". Ahora es un botón con ese
        // nombre, junto al avatar y en la fila pegajosa: siempre a la vista.
        accion={
          equipo ? (
            <Link
              href="/admin"
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-primary/40 px-3 text-sm font-medium whitespace-nowrap text-primary transition-colors hover:bg-primary/10 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span aria-hidden>←</span>
              <span className="sm:hidden">Panel</span>
              <span className="hidden sm:inline">
                Volver al panel de {perfil.role === 'superadmin' ? 'superadmin' : 'admin'}
              </span>
            </Link>
          ) : null
        }
      />
      <main id="contenido" className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:py-10">
        {children}
      </main>
    </div>
  )
}
