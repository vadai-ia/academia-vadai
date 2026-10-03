import type { Metadata } from 'next'

import { TarjetaCatalogo } from '@/components/alumno/tarjeta-catalogo'
import { TarjetaCurso } from '@/components/alumno/tarjeta-curso'
import { Seccion, Tarjeta, Titulo } from '@/components/ui-vadai/superficie'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { catalogo } from '@/lib/alumno/catalogo'
import { misCursos } from '@/lib/alumno/consultas'
import { esEquipo, exigirPerfil } from '@/lib/auth/sesion'

export const metadata: Metadata = { title: 'Cursos' }
export const dynamic = 'force-dynamic'

/**
 * Cursos (M15, 3-oct-2026): los que ya son tuyos, arriba y separados de los
 * que la academia ofrece y todavía no tienes. Alejandro: «que sí se vean bien
 * separados los cursos a los que ya es parte de los que aún no».
 *
 * Lo ofrecido sale del catálogo: solo los cursos que el equipo marcó con
 * «Mostrar en el catálogo». Los gratis se empiezan con un botón; los de pago
 * se compran con su Payment Link.
 */
export default async function PaginaCursos({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const [perfil, propios, { disponible, cursos: ofrecidos }, { error }] = await Promise.all([
    exigirPerfil(),
    misCursos(),
    catalogo(),
    searchParams,
  ])

  const equipo = esEquipo(perfil)
  // Al equipo `misCursos` le lista todos los cursos (entra sin inscripción);
  // para que vea el catálogo como un alumno, ahí cuenta solo la inscripción real.
  const idsPropios = new Set(propios.map((c) => c.id))
  const porTomar = ofrecidos.filter((c) => !c.inscrito && (equipo || !idsPropios.has(c.id)))

  return (
    <div className="flex flex-col gap-10">
      <Titulo apoyo="Los tuyos, y los que puedes empezar o comprar.">Cursos</Titulo>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Seccion titulo={propios.length === 1 ? 'Tu curso' : 'Tus cursos'} apoyo={equipo ? 'Como equipo entras a todos.' : undefined}>
        {propios.length === 0 ? (
          <Tarjeta className="border-dashed px-5 py-10 text-center text-sm text-muted-foreground">
            Todavía no tienes cursos. Abajo están los que puedes empezar.
          </Tarjeta>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {propios.map((curso) => (
              <li key={curso.id} className="flex">
                <TarjetaCurso curso={curso} />
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      {disponible ? (
        <section className="flex flex-col gap-4 border-t pt-8">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-lg font-medium tracking-tight">Más cursos de la academia</h2>
            <p className="text-sm text-muted-foreground">
              {equipo
                ? 'Vista de equipo: así los ve un alumno que todavía no los tiene.'
                : 'Todavía no son tuyos. Los gratis se empiezan al momento.'}
            </p>
          </div>
          {porTomar.length === 0 ? (
            <Tarjeta className="border-dashed px-5 py-10 text-center text-sm text-muted-foreground">
              {ofrecidos.length === 0 ? 'Pronto habrá más cursos aquí.' : 'Ya tienes todos los cursos de la academia.'}
            </Tarjeta>
          ) : (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {porTomar.map((curso) => (
                <li key={curso.id} className="flex">
                  <TarjetaCatalogo curso={curso} correo={perfil.email ?? null} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  )
}
