import type { Metadata } from 'next'
import Link from 'next/link'

import { claseSelect } from '@/components/admin/estilos'
import { Paginacion } from '@/components/admin/paginacion'
import { TablaPuntos } from '@/components/admin/tabla-puntos'
import { AutoEnviar } from '@/components/ui-vadai/auto-enviar'
import { Cifra, Tarjeta, Titulo } from '@/components/ui-vadai/superficie'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ORDENES_PUNTOS, POR_PAGINA_PUNTOS, tablaDePuntos, type FiltrosPuntos } from '@/lib/admin/puntos'
import { exigirAdmin } from '@/lib/auth/sesion'
import { PUNTOS } from '@/lib/gamificacion/reglas'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Puntos' }
export const dynamic = 'force-dynamic'

/**
 * El ranking completo: cómo va cada alumno camino a los premios (26-sep-2026).
 *
 * Todo filtro es un <form method="get">: funciona sin JavaScript, el resultado
 * queda en la URL (se comparte y se vuelve con "atrás") y con JavaScript se
 * aplica solo (`AutoEnviar`). Los niveles de arriba son a la vez el reparto y
 * el filtro: cuántos hay en cada uno y, al tocarlo, quiénes son.
 */
export default async function PaginaPuntos({ searchParams }: { searchParams: Promise<FiltrosPuntos> }) {
  await exigirAdmin()
  const t = await tablaDePuntos(await searchParams)
  const { q, curso, empresa, nivel, orden, por } = t.filtros

  const hrefDe = (cambios: { nivel?: number | null; pagina?: number }) => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (curso) p.set('curso', curso)
    if (empresa) p.set('empresa', empresa)
    const n = cambios.nivel === undefined ? nivel : cambios.nivel
    if (n) p.set('nivel', String(n))
    if (orden !== 'puntos') p.set('orden', orden)
    if (por !== 25) p.set('por', String(por))
    if ((cambios.pagina ?? 1) > 1) p.set('pagina', String(cambios.pagina))
    const cadena = p.toString()
    return cadena ? `/admin/puntos?${cadena}` : '/admin/puntos'
  }

  const cursoElegido = t.cursos.find((c) => c.id === curso)
  const maximoNivel = Math.max(1, ...t.porNivel.map((n) => n.alumnos))

  return (
    <div className="flex flex-col gap-8">
      <Titulo apoyo="Quién va arriba, de dónde salen sus puntos y cuánto le falta a cada uno para el siguiente nivel.">
        Puntos y ranking
      </Titulo>

      <form method="get" className="flex flex-wrap items-end gap-2">
        {nivel ? <input type="hidden" name="nivel" value={nivel} /> : null}
        <label className="flex min-w-56 flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium">Buscar</span>
          <Input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Nombre, correo o empresa"
            autoComplete="off"
            className="h-10"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Curso</span>
          <select name="curso" defaultValue={curso} className={cn(claseSelect, 'h-10 w-auto')}>
            <option value="">Toda la academia</option>
            {t.cursos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titulo}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Empresa</span>
          <select name="empresa" defaultValue={empresa} className={cn(claseSelect, 'h-10 w-auto max-w-56')}>
            <option value="">Todas</option>
            <option value="general">General (sin empresa)</option>
            {t.empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Ordenar</span>
          <select name="orden" defaultValue={orden} className={cn(claseSelect, 'h-10 w-auto')}>
            {Object.entries(ORDENES_PUNTOS).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Por página</span>
          <select name="por" defaultValue={por} className={cn(claseSelect, 'h-10 w-auto')}>
            {POR_PAGINA_PUNTOS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" size="lg" data-aplicar>
          Aplicar
        </Button>
        <AutoEnviar />
        {q || curso || empresa || nivel || orden !== 'puntos' || por !== 25 ? (
          <Button asChild variant="ghost" size="lg">
            <a href="/admin/puntos">Limpiar</a>
          </Button>
        ) : null}
      </form>

      {t.fallo ? null : (
      <Tarjeta className="flex flex-col gap-6 p-5 sm:p-6">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Cifra valor={t.resumen.enRanking} etiqueta="en el ranking" detalle={cursoElegido?.titulo ?? 'toda la academia'} />
          <Cifra valor={t.resumen.sumaron} etiqueta="ya sumaron puntos" destacada />
          <Cifra valor={t.resumen.promedio} etiqueta="puntos en promedio" />
          <Cifra
            valor={t.resumen.lider?.puntos ?? 0}
            etiqueta="puntos del primer lugar"
            detalle={t.resumen.lider?.nombre}
          />
        </div>

        {/* El reparto por nivel es también el filtro: tocar un nivel enseña
            quiénes son. Es la vista para decidir a partir de dónde hay premio. */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Cuántos hay en cada nivel</p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {t.porNivel.map((n) => {
              const activo = nivel === n.numero
              return (
                <li key={n.numero}>
                  <Link
                    href={hrefDe({ nivel: activo ? null : n.numero, pagina: 1 })}
                    aria-current={activo ? 'true' : undefined}
                    className={cn(
                      'flex h-full flex-col gap-2 rounded-[10px] border p-3 transition-colors',
                      'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                      activo ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                    )}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-xs text-muted-foreground">Nivel {n.numero}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{n.minimo}+ pts</span>
                    </span>
                    <span className="text-sm leading-tight font-medium">{n.nombre}</span>
                    <span className="flex items-baseline gap-1.5">
                      <span className="text-2xl leading-none font-medium tabular-nums">{n.alumnos}</span>
                      <span className="text-xs text-muted-foreground">alumno{n.alumnos === 1 ? '' : 's'}</span>
                    </span>
                    <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
                      <span
                        className={cn('block h-full rounded-full', n.numero >= 4 ? 'bg-accent' : 'bg-primary')}
                        style={{ width: `${Math.round((n.alumnos / maximoNivel) * 100)}%` }}
                      />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
          {nivel ? (
            <Link href={hrefDe({ nivel: null, pagina: 1 })} className="w-fit text-sm text-primary underline-offset-4 hover:underline">
              Ver todos los niveles
            </Link>
          ) : null}
        </div>
      </Tarjeta>
      )}

      <div className="flex flex-col gap-4">
        {t.fallo ? (
          <Tarjeta className="border-destructive/40 bg-destructive/5 px-5 py-6 text-sm text-destructive">
            No se pudo leer el ranking en este momento. Recarga la página; si sigue, avísanos.
          </Tarjeta>
        ) : t.filas.length === 0 ? (
          <Tarjeta className="border-dashed px-5 py-10 text-center text-sm text-muted-foreground">
            {t.resumen.enRanking === 0 && (q || empresa)
              ? 'Nadie coincide con la búsqueda.'
              : t.resumen.enRanking === 0
                ? 'Todavía nadie está en el ranking. Aparece quien tenga un curso activo.'
                : 'Nadie en ese nivel con estos filtros.'}
          </Tarjeta>
        ) : (
          <TablaPuntos filas={t.filas} />
        )}

        <Paginacion
          pagina={t.pagina}
          paginas={t.paginas}
          total={t.total}
          porPagina={t.porPagina}
          hrefDe={(pagina) => hrefDe({ pagina })}
        />
      </div>

      <details className="group/reglas rounded-[10px] border border-border bg-card px-5 py-4 text-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-medium select-none [&::-webkit-details-marker]:hidden">
          Cómo se calculan los puntos
          <span aria-hidden className="text-muted-foreground transition-transform group-open/reglas:rotate-90">›</span>
        </summary>
        <ul className="mt-3 grid gap-1.5 text-muted-foreground sm:grid-cols-2">
          <li>Lección completada: <span className="font-medium text-foreground">+{PUNTOS.leccion}</span></li>
          <li>Comentario: <span className="font-medium text-foreground">+{PUNTOS.comentario}</span></li>
          <li>Publicación en la comunidad: <span className="font-medium text-foreground">+{PUNTOS.publicacion}</span></li>
          <li>Tarea entregada: <span className="font-medium text-foreground">+{PUNTOS.tarea}</span></li>
          <li>Quiz aprobado: <span className="font-medium text-foreground">+{PUNTOS.quiz}</span></li>
          <li>Tarea aprobada: <span className="font-medium text-foreground">+{PUNTOS.tareaAprobada}</span></li>
          <li>Dinámica terminada con su empresa: <span className="font-medium text-foreground">+{PUNTOS.dinamica}</span></li>
          <li>Certificado: <span className="font-medium text-foreground">+{PUNTOS.certificado}</span></li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Son los mismos puntos que ve cada alumno. No se guardan: se calculan de lo que hace, así que un comentario
          borrado se lleva sus puntos. No cuentan las cuentas de prueba ni los cursos archivados.
        </p>
      </details>
    </div>
  )
}
