import { Suspense, type ReactNode } from 'react'

import { CampanaDeComunidad } from '@/components/admin/campana-comunidad'
import { Encabezado } from '@/components/marca/encabezado'
import {
  IconoComunidad,
  IconoCursos,
  IconoDinamicas,
  IconoEmpresas,
  IconoEncuestas,
  IconoPanel,
  IconoPerfil,
  IconoPuntos,
} from '@/components/marca/iconos-navegacion'
import { BarraDeNavegacion } from '@/components/marca/barra-de-navegacion'
import { SaltarAlContenido } from '@/components/marca/saltar-al-contenido'
import { exigirEquipo } from '@/lib/auth/sesion'

/** Marco del área de administración. Un alumno que llegue aquí es devuelto. */
export default async function LayoutAdmin({ children }: { children: ReactNode }) {
  const perfil = await exigirEquipo()

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
        // La comunidad que espera respuesta (3-oct-2026). En Suspense: leerla
        // no debe frenar el resto del panel.
        extra={
          <Suspense fallback={null}>
            <CampanaDeComunidad />
          </Suspense>
        }
        navegacion={[
          { href: '/admin', etiqueta: 'Panel', icono: IconoPanel, exacto: true },
          { href: '/admin/cursos', etiqueta: 'Cursos', icono: IconoCursos },
          { href: '/admin/alumnos', etiqueta: 'Alumnos', icono: IconoPerfil },
          { href: '/admin/comunidad', etiqueta: 'Comunidad', icono: IconoComunidad },
          { href: '/admin/puntos', etiqueta: 'Puntos', icono: IconoPuntos },
          { href: '/admin/empresas', etiqueta: 'Empresas', icono: IconoEmpresas },
          { href: '/admin/encuestas', etiqueta: 'Encuestas', icono: IconoEncuestas },
          { href: '/admin/dinamicas', etiqueta: 'Dinámicas', icono: IconoDinamicas },
          // Antes «Vista de alumno»: no es una vista simulada, es el portal
          // real, el mismo que usan los alumnos (3-oct-2026).
          { href: '/mis-cursos', etiqueta: 'Portal de alumnos', icono: IconoCursos },
        ]}
      />
      <main id="contenido" className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:py-10">
        {children}
      </main>
    </div>
  )
}
