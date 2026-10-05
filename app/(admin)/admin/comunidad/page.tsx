import type { Metadata } from 'next'
import Link from 'next/link'

import { claseSelect } from '@/components/admin/estilos'
import { HiloDeComunidad } from '@/components/admin/hilo-de-comunidad'
import { Paginacion } from '@/components/admin/paginacion'
import { PublicarEnMuro } from '@/components/admin/publicar-en-muro'
import { AutoEnviar } from '@/components/ui-vadai/auto-enviar'
import { Pestanas, type Pestana } from '@/components/ui-vadai/pestanas'
import { Tarjeta, Titulo } from '@/components/ui-vadai/superficie'
import { Button } from '@/components/ui/button'
import { bandejaDeComunidad, HORAS_DE_ESPERA, type FiltrosComunidad } from '@/lib/admin/comunidad'
import { exigirEquipo } from '@/lib/auth/sesion'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Comunidad' }
export const dynamic = 'force-dynamic'

/**
 * La bandeja de Comunidad (3-oct-2026): contestar y dar seguimiento a lo que
 * escriben los alumnos sin entrar al portal como uno de ellos.
 *
 * Por omisión enseña lo que espera respuesta, de lo más viejo a lo más nuevo.
 * Los filtros son un <form method="get"> (sin JS, en la URL, con "atrás"), y
 * las acciones vuelven aquí mismo con `?aviso=`.
 */

const AVISOS: Record<string, { texto: string; error?: boolean }> = {
  respondida: { texto: 'Respuesta publicada. El alumno la ve con la etiqueta «Equipo VADAI».' },
  oculta: { texto: 'Oculto. Los alumnos ya no lo ven; se puede volver a mostrar.' },
  visible: { texto: 'Visible otra vez para los alumnos.' },
  fijada: { texto: 'Fijada arriba del muro.' },
  desfijada: { texto: 'Ya no está fijada.' },
  eliminada: { texto: 'Eliminado para siempre.' },
  atendida: { texto: 'Marcado como atendido. Si el alumno vuelve a escribir, regresa a «Sin respuesta».' },
  pendiente: { texto: 'De vuelta en «Sin respuesta».' },
  vacia: { texto: 'La respuesta necesita al menos dos caracteres.', error: true },
  sinPermiso: { texto: 'La base no dejó publicar la respuesta. Avísale a quien mantiene la plataforma.', error: true },
  error: { texto: 'No se pudo completar. Intenta de nuevo.', error: true },
}

export default async function PaginaComunidadAdmin({
  searchParams,
}: {
  searchParams: Promise<FiltrosComunidad & { aviso?: string; hilo?: string }>
}) {
  await exigirEquipo()
  const parametros = await searchParams
  const b = await bandejaDeComunidad(parametros)
  const { estado, curso, gen, tipo, ocultas } = b.filtros
  const ahora = Date.now()

  const hrefDe = (cambios: { estado?: string; pagina?: number }) => {
    const p = new URLSearchParams()
    const e = cambios.estado ?? estado
    if (e !== 'sin') p.set('estado', e)
    if (curso) p.set('curso', curso)
    if (gen) p.set('gen', gen)
    if (tipo) p.set('tipo', tipo)
    if (ocultas) p.set('ocultas', 'si')
    if ((cambios.pagina ?? 1) > 1) p.set('pagina', String(cambios.pagina))
    const cadena = p.toString()
    return cadena ? `/admin/comunidad?${cadena}` : '/admin/comunidad'
  }
  const vuelta = hrefDe({ pagina: b.pagina })

  const pestanas: Pestana[] = [
    { href: hrefDe({ estado: 'sin' }), etiqueta: 'Sin respuesta', activa: estado === 'sin', insignia: b.conteos.sin },
    { href: hrefDe({ estado: 'respondidas' }), etiqueta: 'Resueltas', activa: estado === 'respondidas', insignia: b.conteos.respondidas },
    { href: hrefDe({ estado: 'todas' }), etiqueta: 'Todo', activa: estado === 'todas', insignia: b.conteos.todas },
  ]

  const aviso = parametros.aviso ? AVISOS[parametros.aviso] : undefined
  const cursoElegido = b.cursos.find((c) => c.id === curso)
  const hayFiltros = Boolean(curso || tipo || ocultas)

  return (
    <div className="flex flex-col gap-6">
      <Titulo apoyo="Lo que escriben los alumnos en los muros y en las lecciones, con su curso y su generación. Lo que espera respuesta va primero.">
        Comunidad
      </Titulo>

      {aviso ? (
        <p
          role="status"
          className={cn(
            'rounded-[10px] border px-4 py-3 text-sm',
            aviso.error ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-accent bg-accent/30 text-foreground'
          )}
        >
          {aviso.texto}
          {(parametros.aviso === 'respondida' || parametros.aviso === 'atendida') && parametros.hilo && estado === 'sin' ? (
            <>
              {' '}
              <Link
                href={`${hrefDe({ estado: 'respondidas' })}#hilo-${parametros.hilo}`}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Verlo en Resueltas
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      <PublicarEnMuro cursos={b.destinos} reinicio={b.publicaciones} />

      <Pestanas pestanas={pestanas} etiqueta="Estado de los hilos" />

      <form method="get" className="flex flex-wrap items-end gap-2">
        {estado !== 'sin' ? <input type="hidden" name="estado" value={estado} /> : null}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Curso</span>
          <select name="curso" defaultValue={curso} className={cn(claseSelect, 'h-10 w-auto max-w-64')}>
            <option value="">Todos</option>
            {b.cursos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titulo}
              </option>
            ))}
          </select>
        </label>
        {cursoElegido && cursoElegido.generaciones.length > 0 ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Generación</span>
            <select name="gen" defaultValue={gen} className={cn(claseSelect, 'h-10 w-auto')}>
              <option value="">Todas</option>
              {cursoElegido.generaciones.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nombre}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Dónde</span>
          <select name="tipo" defaultValue={tipo} className={cn(claseSelect, 'h-10 w-auto')}>
            <option value="">Muro y lecciones</option>
            <option value="muro">Solo el muro</option>
            <option value="leccion">Solo preguntas en lecciones</option>
          </select>
        </label>
        <label className="flex h-10 items-center gap-2 px-1 text-sm">
          <input type="checkbox" name="ocultas" value="si" defaultChecked={ocultas} className="size-4 accent-[var(--primary)]" />
          Incluir lo oculto
        </label>
        <Button type="submit" size="lg" data-aplicar>
          Aplicar
        </Button>
        <AutoEnviar />
        {hayFiltros ? (
          <Button asChild variant="ghost" size="lg">
            <a href={estado === 'sin' ? '/admin/comunidad' : `/admin/comunidad?estado=${estado}`}>Limpiar</a>
          </Button>
        ) : null}
      </form>

      {estado === 'sin' && b.vencidas > 0 ? (
        <p className="text-sm text-destructive">
          {b.vencidas === 1
            ? `Uno lleva más de ${HORAS_DE_ESPERA} horas esperando.`
            : `${b.vencidas} llevan más de ${HORAS_DE_ESPERA} horas esperando.`}{' '}
          Van primero.
        </p>
      ) : null}

      {b.fallo ? (
        <Tarjeta className="border-destructive/40 bg-destructive/5 px-5 py-6 text-sm text-destructive">
          No se pudo leer la comunidad en este momento. Recarga la página; si sigue, avísanos.
        </Tarjeta>
      ) : b.hilos.length === 0 ? (
        <Tarjeta className="border-dashed px-5 py-10 text-center text-sm text-muted-foreground">
          {estado === 'sin'
            ? hayFiltros
              ? 'Nada espera respuesta con estos filtros.'
              : 'Nada espera respuesta. Cuando un alumno publique o pregunte en una lección, aparece aquí.'
            : hayFiltros
              ? 'Nada coincide con estos filtros.'
              : 'Todavía no hay conversaciones.'}
        </Tarjeta>
      ) : (
        <ul className="flex flex-col gap-4">
          {b.hilos.map((h) => (
            <HiloDeComunidad
              key={h.id}
              hilo={h}
              vuelta={vuelta}
              ahora={ahora}
              recienRespondido={(parametros.aviso === 'respondida' || parametros.aviso === 'atendida') && parametros.hilo === h.id}
            />
          ))}
        </ul>
      )}

      <Paginacion
        pagina={b.pagina}
        paginas={b.paginas}
        total={b.total}
        porPagina={b.porPagina}
        hrefDe={(pagina) => hrefDe({ pagina })}
      />
    </div>
  )
}
