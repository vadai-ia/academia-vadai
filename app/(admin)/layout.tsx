import { Suspense, type ReactNode } from 'react'

import { BarraLateral, type GrupoDeNavegacion } from '@/components/admin/barra-lateral'
import { CampanaDeComunidad } from '@/components/admin/campana-comunidad'
import { InsigniaDelPanel, TotalDelPanel } from '@/components/admin/insignias'
import { Encabezado } from '@/components/marca/encabezado'
import {
  IconoAgente,
  IconoAjustes,
  IconoBlog,
  IconoCertificaciones,
  IconoClases,
  IconoCobros,
  IconoCursos,
  IconoDinamicas,
  IconoEmpresas,
  IconoEncuestas,
  IconoEntregas,
  IconoGrupos,
  IconoHerramientas,
  IconoMiembros,
  IconoMuro,
  IconoNoticias,
  IconoPanel,
  IconoPerfil,
  IconoPortal,
  IconoPuntos,
  IconoVaip,
} from '@/components/marca/iconos-navegacion'
import { BarraDeNavegacion } from '@/components/marca/barra-de-navegacion'
import { SaltarAlContenido } from '@/components/marca/saltar-al-contenido'
import type { ClaveDeContador } from '@/lib/admin/contadores'
import { esAdmin, exigirEquipo } from '@/lib/auth/sesion'

/**
 * Marco del área de administración. Un alumno que llegue aquí es devuelto.
 *
 * Desde M19 (16-oct-2026) la navegación es una barra lateral con grupos; el
 * encabezado se queda con marca, campana y cuenta.
 *
 * M25 (20-oct-2026), «dos mundos»: Alejandro, «hay tantas pestañas… muchas
 * cosas significan lo mismo». La barra es la ÚNICA navegación —ninguna página
 * repite sus destinos en pestañas— y se parte en dos mundos que no se mezclan:
 * V-AI-P (la comunidad de paga) y Cursos (con el grupo de cada generación).
 * Cada destino aparece una sola vez y con un nombre que no se repite.
 */
export default async function LayoutAdmin({ children }: { children: ReactNode }) {
  const perfil = await exigirEquipo()
  const admin = esAdmin(perfil)
  // M26: el número de cada entrada, lo que espera que alguien actúe. Cada uno
  // en su <Suspense>, como la campana: contar no frena el panel.
  const numero = (clave: ClaveDeContador) => (
    <Suspense fallback={null}>
      <InsigniaDelPanel clave={clave} />
    </Suspense>
  )

  const grupos: GrupoDeNavegacion[] = [
    { destinos: [{ href: '/admin', etiqueta: 'Panel', icono: IconoPanel, exacto: true }] },
    {
      titulo: 'V-AI-P',
      destinos: [
        { href: '/admin/vaip', etiqueta: 'Resumen', icono: IconoVaip, exacto: true },
        { href: '/admin/vaip/muro', etiqueta: 'Muro', icono: IconoMuro, insignia: numero('muro') },
        { href: '/admin/vaip/noticias', etiqueta: 'Noticias', icono: IconoNoticias, insignia: numero('noticias') },
        { href: '/admin/vaip/clases', etiqueta: 'Clases', icono: IconoClases, insignia: numero('clases') },
        { href: '/admin/vaip/miembros', etiqueta: 'Miembros', icono: IconoMiembros },
        { href: '/admin/vaip/herramientas', etiqueta: 'Herramientas', icono: IconoHerramientas },
        // Los cobros son solo de admin: el community manager no ve pagos (la página lo exige también).
        ...(admin ? [{ href: '/admin/vaip/planes', etiqueta: 'Planes y cobros', icono: IconoCobros, insignia: numero('planes') }] : []),
      ],
    },
    {
      titulo: 'Cursos',
      destinos: [
        { href: '/admin/cursos', etiqueta: 'Cursos', icono: IconoCursos },
        { href: '/admin/entregas', etiqueta: 'Entregas', icono: IconoEntregas, insignia: numero('entregas') },
        // El canal interno de cada generación, con sus preguntas en lecciones.
        { href: '/admin/grupos', etiqueta: 'Grupos', icono: IconoGrupos, insignia: numero('grupos') },
        { href: '/admin/publicaciones', etiqueta: 'Anuncios y blog', icono: IconoBlog },
        { href: '/admin/puntos', etiqueta: 'Puntos', icono: IconoPuntos },
        { href: '/admin/dinamicas', etiqueta: 'Dinámicas', icono: IconoDinamicas },
        { href: '/admin/encuestas', etiqueta: 'Encuestas', icono: IconoEncuestas },
        // Diplomas de generación: quién lo abrió, quién lo descargó (15-oct-2026).
        { href: '/admin/certificaciones', etiqueta: 'Certificaciones', icono: IconoCertificaciones },
      ],
    },
    {
      titulo: 'Personas',
      destinos: [
        { href: '/admin/alumnos', etiqueta: 'Alumnos', icono: IconoPerfil, insignia: numero('alumnos') },
        { href: '/admin/empresas', etiqueta: 'Empresas', icono: IconoEmpresas },
      ],
    },
    {
      titulo: 'Ajustes',
      destinos: [
        // Una sola entrada: los borradores y el resumen son de todo el equipo;
        // la voz, el conocimiento y el gasto (dentro) son solo de admin.
        { href: '/admin/agente', etiqueta: 'Agente IA', icono: IconoAgente, insignia: numero('agente') },
        ...(admin ? [{ href: '/admin/ajustes/api', etiqueta: 'API', icono: IconoAjustes }] : []),
      ],
    },
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
          total={
            <Suspense fallback={null}>
              <TotalDelPanel />
            </Suspense>
          }
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
