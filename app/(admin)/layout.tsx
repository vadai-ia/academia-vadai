import { Suspense, type ReactNode } from 'react'

import { BarraLateral, type GrupoDeNavegacion } from '@/components/admin/barra-lateral'
import { CampanaDeComunidad } from '@/components/admin/campana-comunidad'
import { Encabezado } from '@/components/marca/encabezado'
import {
  IconoAjustes,
  IconoBlog,
  IconoCertificaciones,
  IconoComunidad,
  IconoCursos,
  IconoDinamicas,
  IconoEmpresas,
  IconoEncuestas,
  IconoEntregas,
  IconoPanel,
  IconoPerfil,
  IconoPortal,
  IconoPuntos,
  IconoVaip,
} from '@/components/marca/iconos-navegacion'
import { BarraDeNavegacion } from '@/components/marca/barra-de-navegacion'
import { SaltarAlContenido } from '@/components/marca/saltar-al-contenido'
import { esAdmin, exigirEquipo } from '@/lib/auth/sesion'

/**
 * Marco del área de administración. Un alumno que llegue aquí es devuelto.
 *
 * Desde M19 (16-oct-2026) la navegación es una barra lateral con grupos; el
 * encabezado se queda con marca, campana y cuenta. Solo cambió el frontend:
 * cada destino es la misma ruta, con la misma guarda, que ya existía.
 */
export default async function LayoutAdmin({ children }: { children: ReactNode }) {
  const perfil = await exigirEquipo()

  const grupos: GrupoDeNavegacion[] = [
    { destinos: [{ href: '/admin', etiqueta: 'Panel', icono: IconoPanel, exacto: true }] },
    {
      titulo: 'Academia',
      destinos: [
        { href: '/admin/cursos', etiqueta: 'Cursos', icono: IconoCursos },
        { href: '/admin/entregas', etiqueta: 'Entregas', icono: IconoEntregas },
        { href: '/admin/publicaciones', etiqueta: 'Publicaciones', icono: IconoBlog },
      ],
    },
    {
      titulo: 'Comunidad',
      destinos: [
        // La bandeja de lo que espera respuesta (3-oct-2026).
        { href: '/admin/comunidad', etiqueta: 'Bandeja', icono: IconoComunidad },
        { href: '/admin/puntos', etiqueta: 'Puntos', icono: IconoPuntos },
      ],
    },
    {
      titulo: 'Contactos',
      destinos: [
        { href: '/admin/alumnos', etiqueta: 'Alumnos', icono: IconoPerfil },
        { href: '/admin/empresas', etiqueta: 'Empresas', icono: IconoEmpresas },
      ],
    },
    {
      titulo: 'Actividades',
      destinos: [
        { href: '/admin/encuestas', etiqueta: 'Encuestas', icono: IconoEncuestas },
        { href: '/admin/dinamicas', etiqueta: 'Dinámicas', icono: IconoDinamicas },
        // Diplomas de generación: quién lo abrió, quién lo descargó (15-oct-2026).
        { href: '/admin/certificaciones', etiqueta: 'Certificaciones', icono: IconoCertificaciones },
      ],
    },
    {
      titulo: 'Membresía',
      // M19: el portal de la comunidad es del equipo. Los cobros y los planes,
      // dentro, siguen siendo solo de admin (sus páginas lo exigen).
      destinos: [{ href: '/admin/vaip', etiqueta: 'V-AI-P', icono: IconoVaip }],
    },
    // M20: llaves de la API y webhooks. Solo admin (la página lo exige también).
    ...(esAdmin(perfil)
      ? [{ titulo: 'Ajustes', destinos: [{ href: '/admin/ajustes/api', etiqueta: 'API', icono: IconoAjustes }] }]
      : []),
  ]

  return (
    <div className="relative flex min-h-dvh flex-col">
      <SaltarAlContenido />
      {/* Sin señal entre el clic y la página nueva, la gente vuelve a apretar.
          Suspense porque lee la URL y algunas rutas del árbol son estáticas. */}
      <Suspense fallback={null}>
        <BarraDeNavegacion />
      </Suspense>
      <Encabezado
        perfil={perfil}
        anchoCompleto
        // La comunidad que espera respuesta (3-oct-2026). En Suspense: leerla
        // no debe frenar el resto del panel.
        extra={
          <Suspense fallback={null}>
            <CampanaDeComunidad />
          </Suspense>
        }
      />
      <div className="flex w-full flex-1 flex-col lg:flex-row">
        <BarraLateral
          grupos={grupos}
          // Antes «Vista de alumno»: no es una vista simulada, es el portal
          // real, el mismo que usan los alumnos (3-oct-2026).
          pie={{ href: '/mis-cursos', etiqueta: 'Portal de alumnos', icono: IconoPortal }}
        />
        <main id="contenido" className="w-full min-w-0 flex-1 px-5 py-8 sm:py-10 lg:px-10">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
