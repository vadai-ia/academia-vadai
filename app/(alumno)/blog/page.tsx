import type { Metadata } from 'next'

import { RenderRico } from '@/components/alumno/render-rico'
import { exigirPerfil } from '@/lib/auth/sesion'
import { publicacionesParaAlumno } from '@/lib/comunidad/posts'
import { sellarCanal } from '@/lib/notificaciones/canales'

export const metadata: Metadata = { title: 'Blog' }
export const dynamic = 'force-dynamic'

function fecha(iso: string): string {
  // Zona fija: servidor y navegador tienen que decir lo mismo (React 418).
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso))
}

/**
 * Blog dentro de la plataforma (§3.9).
 *
 * Sin comentarios: el spec los excluye del MVP. Las entradas se muestran
 * completas en la lista porque son pocas y cortas; una pantalla de detalle por
 * entrada sería un clic de más sin nada que ganar.
 */
export default async function PaginaBlog() {
  const perfil = await exigirPerfil()
  const entradas = await publicacionesParaAlumno('blog')

  // Abrir el blog apaga su contador en la navegación.
  await sellarCanal(perfil, 'blog')

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Blog</h1>
        <p className="text-sm text-muted-foreground">
          Ideas y novedades del equipo VADAI.
        </p>
      </header>

      {entradas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-5 py-12 text-center text-sm text-muted-foreground">
          Todavía no hay entradas publicadas.
        </p>
      ) : (
        <ul className="flex flex-col gap-8">
          {entradas.map((entrada) => (
            <li key={entrada.id} className="flex flex-col gap-3">
              {entrada.portada ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={entrada.portada}
                  alt=""
                  className="h-auto w-full rounded-lg border border-border object-cover"
                />
              ) : null}

              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold tracking-tight text-balance">
                  {entrada.titulo}
                </h2>
                <p className="text-xs text-muted-foreground">{fecha(entrada.publicadoEn)}</p>
              </div>

              {entrada.contenido ? <RenderRico contenido={entrada.contenido} /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
