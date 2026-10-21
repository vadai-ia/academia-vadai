import type { Metadata } from 'next'
import Link from 'next/link'

import { Bandeja, type ParametrosDeBandeja } from '@/components/admin/bandeja'
import { claseSelectCompacto } from '@/components/admin/estilos'
import { BorrarPublicacion, Compositor } from '@/components/admin/noticias'
import { TemasDelMuro } from '@/components/admin/temas-del-muro'
import { Seccion, Titulo } from '@/components/ui-vadai/superficie'
import { Button } from '@/components/ui/button'
import { exigirEquipo } from '@/lib/auth/sesion'
import { cambiarVisibilidad, fijarPublicacion } from '@/lib/noticias/acciones'
import { paraPublicar, type PublicacionDelEquipo } from '@/lib/noticias/consultas'
import { crearClienteServidor } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Muro · V-AI-P' }
export const dynamic = 'force-dynamic'

const fecha = (iso: string) =>
  new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Mexico_City' }).format(new Date(iso))

/**
 * El Muro de V-AI-P (M25, 20-oct-2026): TODO lo del muro en un lugar. Antes
 * eran cuatro —Muro, Publicar, la Bandeja de Comunidad y el portal—, y
 * Alejandro no sabía en cuál se hacía qué.
 *
 *   1. Publicar: el compositor (publicación, aviso fijado o noticia), cerrado
 *      detrás de su botón.
 *   2. Avisos fijados: lo que los miembros ven arriba del muro ahora mismo.
 *   3. Lo que escriben los miembros: la bandeja de V-AI-P, con respuesta,
 *      ocultar, fijar y «atendida».
 *   4. Lo que publicó el equipo: fijar con fecha, ocultar o borrar.
 *   5. Los temas del muro.
 *
 * Los avisos de V-AI-P son publicaciones fijadas en el tema Avisos (decisión
 * de Alejandro): los «Anuncios» son solo de los cursos.
 */
export default async function PaginaMuro({ searchParams }: { searchParams: Promise<ParametrosDeBandeja> }) {
  await exigirEquipo()
  const parametros = await searchParams
  const { casa, temas, publicaciones } = await paraPublicar()

  if (!casa) {
    return (
      <div className="flex flex-col gap-6">
        <Titulo ceja="V-AI-P">Muro</Titulo>
        <p className="rounded-[10px] border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
          No encontré el muro de V-AI-P para publicar. Revisa que el plan tenga su curso casa.
        </p>
        <Bandeja ruta="/admin/vaip/muro" mundo="vaip" parametros={parametros} />
      </div>
    )
  }

  const supabase = await crearClienteServidor()
  const { data: todosLosTemas } = await supabase
    .from('community_topics')
    .select('id, name, archived, solo_equipo')
    .eq('course_id', casa.id)
    .order('position')

  const fijadas = publicaciones.filter((p) => p.fijada && p.visible)
  const demas = publicaciones.filter((p) => !(p.fijada && p.visible))

  return (
    <div className="flex flex-col gap-10">
      <Titulo
        ceja="V-AI-P"
        apoyo="Publica avisos, noticias y conversaciones, y contesta lo que escriben los miembros. Sale en el muro al momento y en su campana."
        acciones={
          <Button asChild variant="outline" size="sm">
            <Link href="/vaip">Ver el muro como miembro</Link>
          </Button>
        }
      >
        Muro
      </Titulo>

      <Compositor temas={temas} enDesplegable />

      <Seccion
        titulo="Avisos fijados"
        apoyo="Lo que los miembros ven arriba del muro ahora mismo. Un aviso se fija una semana; al vencer, se baja solo."
      >
        {fijadas.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
            Nada fijado. Un aviso nuevo se publica con «Publicar en el muro» → Aviso.
          </p>
        ) : (
          <ListaDelEquipo publicaciones={fijadas} />
        )}
      </Seccion>

      <Seccion titulo="Lo que escriben los miembros" apoyo="Lo que espera respuesta va primero, del más viejo al más nuevo.">
        <Bandeja ruta="/admin/vaip/muro" mundo="vaip" parametros={parametros} />
      </Seccion>

      <Seccion titulo="Lo que publicó el equipo" apoyo="Las últimas 20, del equipo y de la cuenta Equipo VADAI.">
        {demas.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
            Todavía no hay más publicaciones del equipo en el muro.
          </p>
        ) : (
          <ListaDelEquipo publicaciones={demas} />
        )}
      </Seccion>

      <details className="group rounded-[10px] border border-border">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 font-medium [&::-webkit-details-marker]:hidden">
          Temas del muro
          <span className="text-sm font-normal text-muted-foreground group-open:hidden">Abrir</span>
        </summary>
        <div className="flex flex-col gap-3 border-t border-border px-5 py-4">
          <p className="text-sm text-pretty text-muted-foreground">
            El muro de V-AI-P es uno solo; los temas sirven para filtrarlo y se eligen al publicar. En «Avisos» y
            «Noticias» solo publica el equipo.
          </p>
          <TemasDelMuro
            cursoId={casa.id}
            temas={(todosLosTemas ?? []).map((t) => ({ id: t.id, nombre: t.name, archivado: t.archived, soloEquipo: t.solo_equipo }))}
          />
        </div>
      </details>
    </div>
  )
}

/** Las publicaciones del equipo con sus controles: fijar, ocultar, borrar. */
function ListaDelEquipo({ publicaciones }: { publicaciones: PublicacionDelEquipo[] }) {
  return (
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
  )
}
