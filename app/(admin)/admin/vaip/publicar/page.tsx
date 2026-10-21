import Link from 'next/link'

import { BorrarPublicacion, Compositor } from '@/components/admin/noticias'
import { claseSelectCompacto } from '@/components/admin/estilos'
import { Button } from '@/components/ui/button'
import { Seccion, Titulo } from '@/components/ui-vadai/superficie'
import { exigirEquipo } from '@/lib/auth/sesion'
import { cambiarVisibilidad, fijarPublicacion } from '@/lib/noticias/acciones'
import { paraPublicar } from '@/lib/noticias/consultas'

export const dynamic = 'force-dynamic'

const fecha = (iso: string) =>
  new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Mexico_City' }).format(new Date(iso))

/**
 * Publicar en el muro de V-AI-P desde el panel (M24): publicaciones, avisos
 * fijados y noticias escritas por el equipo, con imagen dibujada por código
 * o subida. Debajo, lo que publicó el equipo para fijar, ocultar o borrar.
 */
export default async function PaginaPublicar() {
  await exigirEquipo()
  const { casa, temas, publicaciones } = await paraPublicar()

  if (!casa) {
    return (
      <p className="rounded-[10px] border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
        No encontré el muro de V-AI-P. Revisa que el plan tenga su curso casa.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-10">
      <Titulo apoyo="Lo que publiques aquí sale en el muro de V-AI-P y en la campana de los miembros.">Publicar</Titulo>

      <Compositor temas={temas} />

      <Seccion titulo="Lo que publicó el equipo" apoyo="Las últimas 20, del equipo y de la cuenta Equipo VADAI.">
        {publicaciones.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
            Todavía no hay publicaciones del equipo en el muro.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-[10px] border border-border">
            {publicaciones.map((p) => (
              <li key={p.id} className="flex flex-col gap-3 px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Link href={p.url} className="font-medium underline-offset-4 [overflow-wrap:anywhere] hover:underline">
                      {p.titulo}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {[p.tema, p.autor, fecha(p.creada), `${p.comentarios} ${p.comentarios === 1 ? 'comentario' : 'comentarios'}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {p.fijada ? (
                      <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                        Fijada{p.fijadaHasta ? ` hasta el ${fecha(p.fijadaHasta)}` : ''}
                      </span>
                    ) : null}
                    {!p.visible ? (
                      <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Oculta</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <form action={fijarPublicacion} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={p.id} />
                    <label className="sr-only" htmlFor={`dias-${p.id}`}>
                      Fijar
                    </label>
                    <select id={`dias-${p.id}`} name="dias" defaultValue={p.fijada ? (p.fijadaHasta ? '7' : 'sin_fin') : '7'} className={claseSelectCompacto}>
                      <option value="1">Fijar 1 día</option>
                      <option value="3">Fijar 3 días</option>
                      <option value="7">Fijar 1 semana</option>
                      <option value="30">Fijar 1 mes</option>
                      <option value="sin_fin">Fijar sin fin</option>
                      <option value="no">Desfijar</option>
                    </select>
                    <Button type="submit" variant="outline" size="sm">
                      Guardar
                    </Button>
                  </form>
                  <form action={cambiarVisibilidad}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="status" value={p.visible ? 'hidden' : 'visible'} />
                    <Button type="submit" variant="ghost" size="sm">
                      {p.visible ? 'Ocultar' : 'Mostrar'}
                    </Button>
                  </form>
                  <BorrarPublicacion id={p.id} titulo={p.titulo} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Seccion>
    </div>
  )
}
