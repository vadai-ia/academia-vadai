import type { Metadata } from 'next'

import { NuevaPublicacion } from '@/components/admin/nueva-publicacion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { alternarPublicacion, eliminarPublicacion } from '@/lib/admin/acciones-blog'
import { opcionesDeAlta } from '@/lib/admin/alumnos'
import { listarPublicaciones } from '@/lib/admin/blog'
import { exigirAdmin } from '@/lib/auth/sesion'

export const metadata: Metadata = { title: 'Publicaciones' }
export const dynamic = 'force-dynamic'

function fecha(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  }).format(new Date(iso))
}

export default async function PaginaPublicaciones() {
  await exigirAdmin()

  const [publicaciones, cursos] = await Promise.all([listarPublicaciones(), opcionesDeAlta()])
  const borradores = publicaciones.filter((p) => !p.publicadoEn).length

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Publicaciones</h1>
        <p className="text-sm text-muted-foreground">
          {publicaciones.length} en total
          {borradores > 0 ? ` · ${borradores} sin publicar` : ''}
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Nueva publicación</h2>
        <NuevaPublicacion
          cursos={cursos.map((c) => ({ id: c.id, titulo: c.titulo }))}
          reinicio={publicaciones.length}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Todas</h2>

        {publicaciones.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            Todavía no has publicado nada.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {publicaciones.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-3"
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{p.titulo}</span>
                    <Badge variant={p.tipo === 'announcement' ? 'default' : 'secondary'}>
                      {p.tipo === 'announcement' ? 'Anuncio' : 'Blog'}
                    </Badge>
                    {!p.publicadoEn ? <Badge variant="outline">Borrador</Badge> : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {p.cursoAudiencia ? `Solo ${p.cursoAudiencia}` : 'Todos los alumnos'}
                    {p.publicadoEn ? ` · publicado ${fecha(p.publicadoEn)}` : ''}
                  </span>
                </span>

                <span className="flex shrink-0 items-center">
                  <form action={alternarPublicacion}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="publicar" value={p.publicadoEn ? 'no' : 'si'} />
                    <Button type="submit" variant="ghost" size="sm">
                      {p.publicadoEn ? 'Despublicar' : 'Publicar'}
                    </Button>
                  </form>

                  <form action={eliminarPublicacion}>
                    <input type="hidden" name="id" value={p.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                    >
                      Eliminar
                    </Button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
