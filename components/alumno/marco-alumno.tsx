import Link from 'next/link'
import { Suspense, type ReactNode } from 'react'

import { Campana } from '@/components/marca/campana'
import { Encabezado } from '@/components/marca/encabezado'
import { IconoCursos, IconoInicio, IconoPerfil, IconoVaip } from '@/components/marca/iconos-navegacion'
import { BarraDeNavegacion } from '@/components/marca/barra-de-navegacion'
import { SaltarAlContenido } from '@/components/marca/saltar-al-contenido'
import { esEquipo, type Perfil } from '@/lib/auth/sesion'
import { novedadesDeCanales } from '@/lib/notificaciones/canales'
import { notificacionesDelAlumno } from '@/lib/notificaciones/consultas'

/**
 * Marco del área de alumno: encabezado de dos filas, campana y navegación.
 *
 * Vive aparte del layout de `(alumno)` desde M17 porque /vaip lo comparte: es
 * pública (la abre el QR), pero quien llega con sesión debe verla dentro de su
 * plataforma, con el mismo encabezado. Quien llama ya resolvió el perfil.
 */
export async function MarcoAlumno({ perfil, children }: { perfil: Perfil; children: ReactNode }) {
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
      {/* Sin señal entre el clic y la página nueva, la gente vuelve a apretar.
          Suspense porque lee la URL y algunas rutas del árbol son estáticas. */}
      <Suspense fallback={null}>
        <BarraDeNavegacion />
      </Suspense>
      <Encabezado
        perfil={perfil}
        extra={<Campana lista={novedades.lista} nuevas={novedades.nuevas} />}
        // M22 (20-oct-2026): cuatro destinos, cada cosa en uno. Eran nueve y en
        // el teléfono solo se veían tres y media. Lo que salió del menú tiene
        // casa: Dinámicas dentro de cada curso (y en la campana e Inicio), Blog
        // en Inicio cuando hay entradas, Comunidad en V-AI-P y en cada curso,
        // Puntos y Certificaciones en Mi perfil. Las rutas viejas redirigen.
        navegacion={[
          { href: '/mis-cursos', etiqueta: 'Inicio', icono: IconoInicio, exacto: true },
          // Para el miembro es su espacio; para los demás, la invitación. El
          // número: publicaciones nuevas en el muro de V-AI-P.
          { href: '/vaip', etiqueta: 'V-AI-P', icono: IconoVaip, novedades: canales.vaip },
          { href: '/cursos', etiqueta: 'Mis cursos', icono: IconoCursos, tambien: ['/curso/', '/dinamicas'] },
          { href: '/perfil', etiqueta: 'Perfil', icono: IconoPerfil },
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
                Volver al panel
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
