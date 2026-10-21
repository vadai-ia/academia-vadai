import Link from 'next/link'

import { MarcaVaip } from '@/components/marca/logo-vaip'
import { Pestanas } from '@/components/ui-vadai/pestanas'
import { Avatar, Tarjeta } from '@/components/ui-vadai/superficie'
import { Logros } from '@/components/vaip/logros'
import { Button } from '@/components/ui/button'
import type { SesionDelAlumno } from '@/lib/alumno/sesiones'
import { describirHorario } from '@/lib/calendario/enlaces'
import { estadoDe } from '@/lib/calendario/estado'
import type { EspacioVaip } from '@/lib/membresia/espacio'
import { cn } from '@/lib/utils'

/**
 * El espacio de V-AI-P (M17; con pestañas propias desde M22, 20-oct-2026).
 *
 * Antes era un tablero —clase, biblioteca, ranking, diez logros— que mandaba
 * el muro a un «curso casa» con barra de avance: la comunidad se sentía como
 * una tarea pendiente. Ahora V-AI-P es un espacio como los de Skool, con sus
 * pestañas:
 *
 *   Muro · Clases · Herramientas · Ranking
 *
 * y el muro es lo que abre. Sin plano de marca nuevo: la marca va en el logo y
 * la única lima de acción es «Entrar a la clase» cuando la clase está abierta.
 */

/**
 * Logo, saludo y pestañas. Si la clase está por empezar o en curso (la misma
 * regla que En vivo: `estadoDe`), un aviso con «Entrar» encima de todo: es lo
 * único que urge.
 */
export function EncabezadoVaip({ nombre, clase }: { nombre: string; clase: SesionDelAlumno | null }) {
  const primerNombre = nombre.trim().split(/\s+/)[0] || nombre
  const estado = clase ? estadoDe(clase.programadaEn, Date.now()) : null
  const abierta = estado === 'porEmpezar' || estado === 'enCurso'

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <MarcaVaip />
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">Hola, {primerNombre}.</h1>
      </header>

      {clase && abierta ? (
        <Tarjeta className="flex flex-wrap items-center justify-between gap-4 border-accent p-5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
              {estado === 'enCurso' ? 'En vivo ahora' : 'Está por empezar'}
            </span>
            <span className="font-medium text-balance">{clase.titulo}</span>
            <span className="text-sm text-muted-foreground">{describirHorario(clase.programadaEn)}</span>
          </div>
          {clase.meetUrl ? (
            <Button asChild variant="acento" size="lg">
              <a href={clase.meetUrl} target="_blank" rel="noopener noreferrer">
                Entrar a la clase
              </a>
            </Button>
          ) : null}
        </Tarjeta>
      ) : null}

      <Pestanas
        etiqueta="Secciones de V-AI-P"
        pestanas={[
          { href: '/vaip', etiqueta: 'Muro', exacto: true },
          { href: '/vaip/clases', etiqueta: 'Clases', insignia: abierta ? 'Ahora' : undefined, tono: 'vivo' },
          { href: '/vaip/herramientas', etiqueta: 'Herramientas' },
          { href: '/vaip/ranking', etiqueta: 'Ranking' },
        ]}
      />
    </div>
  )
}

/** Ranking: todos los miembros, tu lugar y tus logros. */
export function RankingVaip({ ranking, logros, userId }: Pick<EspacioVaip, 'ranking' | 'logros'> & { userId: string }) {
  const ganados = logros.filter((l) => l.ganado).length

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
      <Tarjeta className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-medium">Ranking de V-AI-P</p>
          {ranking.yo ? (
            <span className="text-sm text-muted-foreground">
              Vas <span className="font-medium text-primary">#{ranking.yo.lugar}</span> de {ranking.total}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          Suma publicar y comentar en el muro, ver las clases grabadas y las herramientas.
        </p>
        {ranking.puestos.length > 0 ? (
          <ol className="flex flex-col gap-1">
            {ranking.puestos.map((p) => (
              <li key={p.userId}>
                <Link
                  href={`/vaip/miembros/${p.userId}`}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted',
                    p.soyYo && 'bg-primary/10'
                  )}
                >
                  <span className="w-6 text-right text-sm font-medium tabular-nums text-muted-foreground">{p.lugar}</span>
                  <Avatar nombre={p.nombre} foto={p.foto} tamano={28} />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {p.nombre}
                    {p.soyYo ? <span className="text-muted-foreground"> (tú)</span> : null}
                  </span>
                  <span className="text-xs text-muted-foreground">Nivel {p.nivel.numero}</span>
                  <span className="w-12 text-right text-sm font-medium tabular-nums">{p.puntos}</span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">El ranking arranca con la primera actividad.</p>
        )}
        <Link href={`/vaip/miembros/${userId}`} className="w-fit text-sm font-medium text-primary hover:underline">
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
    </div>
  )
}
