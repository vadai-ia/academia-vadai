import Link from 'next/link'

import { RenderRico } from '@/components/alumno/render-rico'
import { TarjetaCurso } from '@/components/alumno/tarjeta-curso'
import { MarcaVaip } from '@/components/marca/logo-vaip'
import { Avatar, Seccion, Tarjeta } from '@/components/ui-vadai/superficie'
import { Logros } from '@/components/vaip/logros'
import { Button } from '@/components/ui/button'
import { describirHorario } from '@/lib/calendario/enlaces'
import type { EspacioVaip } from '@/lib/membresia/espacio'
import { cn } from '@/lib/utils'

/**
 * El espacio de V-AI-P (M17, fase 2): lo primero que ve un miembro en /vaip.
 *
 * Sin plano de marca nuevo (el único sigue siendo el hero de Mis cursos): la
 * marca va en el logo, en la lima de lo logrado y en el botón para entrar a la
 * clase, que es la única lima de acción de la pantalla.
 */

/** El botón de entrar se enciende 15 minutos antes, igual que en En vivo. */
const ANTES = 15 * 60 * 1000
const DURA = 150 * 60 * 1000

const fechaCorta = (iso: string) =>
  new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', timeZone: 'America/Mexico_City' }).format(new Date(iso))

export function EspacioDeMiembro({
  nombre,
  userId,
  casaSlug,
  espacio,
  portal,
}: {
  nombre: string
  userId: string
  casaSlug: string | null
  espacio: EspacioVaip
  portal: string | null
}) {
  const { proximaClase, anuncios, biblioteca, ranking, logros } = espacio
  const primerNombre = nombre.trim().split(/\s+/)[0] || nombre
  const inicio = proximaClase ? new Date(proximaClase.programadaEn).getTime() : 0
  const ahora = Date.now()
  const abierta = proximaClase !== null && ahora >= inicio - ANTES && ahora <= inicio + DURA
  const ganados = logros.filter((l) => l.ganado).length

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3">
          <MarcaVaip />
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">Hola, {primerNombre}.</h1>
        </div>
        {casaSlug ? (
          <nav className="flex flex-wrap gap-2" aria-label="Atajos de V-AI-P">
            <Button asChild variant="outline">
              <Link href={`/curso/${casaSlug}/comunidad`}>Muro</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/curso/${casaSlug}/en-vivo`}>Clases en vivo</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/curso/${casaSlug}`}>Grabaciones y material</Link>
            </Button>
          </nav>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Tarjeta className={cn('flex flex-col gap-3 p-5 sm:p-6', abierta && 'border-accent')}>
            <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
              {abierta ? 'En vivo ahora' : 'Próxima clase'}
            </p>
            {proximaClase ? (
              <>
                <p className="text-xl font-semibold tracking-tight text-balance">{proximaClase.titulo}</p>
                <p className="text-sm text-muted-foreground">{describirHorario(proximaClase.programadaEn)}</p>
                {proximaClase.descripcion ? (
                  <p className="text-sm text-pretty text-muted-foreground">{proximaClase.descripcion}</p>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  {abierta && proximaClase.meetUrl ? (
                    <Button asChild variant="acento" size="lg">
                      <a href={proximaClase.meetUrl} target="_blank" rel="noopener noreferrer">
                        Entrar a la clase
                      </a>
                    </Button>
                  ) : null}
                  <Button asChild variant="outline">
                    <Link href={`/curso/${proximaClase.cursoSlug}/en-vivo`}>Ver en En vivo</Link>
                  </Button>
                </div>
                {!abierta ? (
                  <p className="text-xs text-muted-foreground">El botón para entrar se enciende 15 minutos antes.</p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">La siguiente clase se anuncia aquí y te llega por correo.</p>
            )}
          </Tarjeta>

          {anuncios.length > 0 ? (
            <Seccion titulo="Anuncios">
              <ul className="flex flex-col gap-3">
                {anuncios.map((a) => (
                  <li key={a.id}>
                    <Tarjeta className="flex flex-col gap-2 p-5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-medium text-balance">{a.titulo}</p>
                        <span className="text-xs text-muted-foreground">{fechaCorta(a.publicadoEn)}</span>
                      </div>
                      {a.contenido ? (
                        <div className="text-sm text-muted-foreground">
                          <RenderRico contenido={a.contenido} />
                        </div>
                      ) : null}
                    </Tarjeta>
                  </li>
                ))}
              </ul>
            </Seccion>
          ) : null}

          <Seccion titulo="Biblioteca" apoyo="Los cursos y clases que se publican para miembros.">
            {biblioteca.length > 0 ? (
              <ul className="grid gap-5 sm:grid-cols-2">
                {biblioteca.map((c) => (
                  <li key={c.id}>
                    <TarjetaCurso curso={c} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-[10px] border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
                Aquí aparecen los cursos de V-AI-P en cuanto se publican. Las grabaciones de las clases están en
                «Grabaciones y material».
              </p>
            )}
          </Seccion>
        </div>

        <aside className="flex flex-col gap-6">
          <Tarjeta className="flex flex-col gap-4 p-5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-medium">Ranking de V-AI-P</p>
              {ranking.yo ? (
                <span className="text-sm text-muted-foreground">
                  Vas <span className="font-medium text-primary">#{ranking.yo.lugar}</span> de {ranking.total}
                </span>
              ) : null}
            </div>
            {ranking.puestos.length > 0 ? (
              <ol className="flex flex-col gap-1">
                {ranking.puestos.slice(0, 5).map((p) => (
                  <li key={p.userId}>
                    <Link
                      href={`/vaip/miembros/${p.userId}`}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted',
                        p.soyYo && 'bg-primary/10'
                      )}
                    >
                      <span className="w-5 text-right text-sm font-medium tabular-nums text-muted-foreground">{p.lugar}</span>
                      <Avatar nombre={p.nombre} foto={p.foto} tamano={28} />
                      <span className="min-w-0 flex-1 truncate text-sm">{p.nombre}</span>
                      <span className="text-sm font-medium tabular-nums">{p.puntos}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">El ranking arranca con la primera actividad.</p>
            )}
            <Link href={`/vaip/miembros/${userId}`} className="text-sm font-medium text-primary hover:underline">
              Ver mi perfil de miembro
            </Link>
          </Tarjeta>

          <Tarjeta className="flex flex-col gap-3 p-5">
            <div className="flex items-baseline justify-between">
              <p className="font-medium">Tus logros</p>
              <span className="text-sm text-muted-foreground">
                {ganados} de {logros.length}
              </span>
            </div>
            <Logros logros={logros} compacto />
          </Tarjeta>

          {portal ? (
            <a href={portal} className="text-center text-sm text-muted-foreground hover:text-primary">
              Administrar mi suscripción
            </a>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
