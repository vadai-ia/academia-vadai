import type { Metadata } from 'next'

import { RenderRico } from '@/components/alumno/render-rico'
import { Seccion, Tarjeta, Titulo } from '@/components/ui-vadai/superficie'
import { TarjetaCurso } from '@/components/alumno/tarjeta-curso'
import { misCursos } from '@/lib/alumno/consultas'
import { exigirPerfil, nombreVisible } from '@/lib/auth/sesion'
import { publicacionesParaAlumno } from '@/lib/comunidad/posts'

export const metadata: Metadata = { title: 'Mis cursos' }
export const dynamic = 'force-dynamic'

export default async function PaginaMisCursos() {
  const perfil = await exigirPerfil()
  const [cursos, anuncios] = await Promise.all([
    misCursos(),
    publicacionesParaAlumno('announcement'),
  ])

  // Solo el más reciente: si aquí cupieran cinco, el alumno dejaría de leerlos.
  const anuncio = anuncios[0]

  return (
    <div className="flex flex-col gap-8">
      <Titulo
        apoyo={
          cursos.length === 0
            ? 'Aquí aparecerán tus cursos.'
            : cursos.length === 1
              ? 'Tu curso y tu avance.'
              : `Tus ${cursos.length} cursos y tu avance.`
        }
      >
        Hola, {nombreVisible(perfil)}
      </Titulo>

      {anuncio ? (
        <Tarjeta className="flex flex-col gap-2 border-primary/40 bg-primary/5 p-5">
          <span className="text-xs font-medium tracking-[0.15em] text-primary uppercase">
            Anuncio
          </span>
          <h2 className="font-medium text-balance">{anuncio.titulo}</h2>
          {anuncio.contenido ? <RenderRico contenido={anuncio.contenido} /> : null}
        </Tarjeta>
      ) : null}

      {cursos.length === 0 ? (
        <Tarjeta className="border-dashed px-5 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Todavía no tienes ningún curso asignado.
          </p>
          <a
            href="mailto:hola@vadai.com.mx?subject=No%20veo%20mi%20curso"
            className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline"
          >
            Si compraste uno, escríbenos
          </a>
        </Tarjeta>
      ) : (
        <Seccion titulo={cursos.length === 1 ? 'Tu curso' : 'Tus cursos'}>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cursos.map((curso) => (
              <li key={curso.id} className="flex">
                <TarjetaCurso curso={curso} />
              </li>
            ))}
          </ul>
        </Seccion>
      )}
    </div>
  )
}
