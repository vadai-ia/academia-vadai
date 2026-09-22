import type { Metadata } from 'next'
import Link from 'next/link'

import { Ranking } from '@/components/alumno/ranking'
import { Seccion, Tarjeta, Titulo } from '@/components/ui-vadai/superficie'
import { misCursos } from '@/lib/alumno/consultas'
import { exigirPerfil } from '@/lib/auth/sesion'
import { miNivel } from '@/lib/gamificacion/consultas'
import { COMO_GANAR, NIVELES, PUNTOS } from '@/lib/gamificacion/reglas'

/**
 * "Tus puntos": la gamificación como sección propia (21-sep-2026).
 *
 * Existía a medias —una tarjeta en Mis cursos y un ranking arriba del feed—,
 * pero sin un lugar donde ver DE DÓNDE salen los puntos. Alejandro lo pidió
 * así: "que cada usuario pueda ver cómo va avanzando en puntaje por
 * comentarios, comunidad, blog, quizzes... y cómo van ellos mismos comparados".
 *
 * Por eso el desglose es lo primero después del número: sin él, el puntaje es
 * una cifra que aparece sola y nadie sabe qué hacer para moverla. Con él, cada
 * renglón es una instrucción.
 *
 * El ranking sigue siendo POR CURSO y no de toda la academia: compites con tu
 * grupo, que es a quien ves en la comunidad.
 *
 * NO lleva `loading.tsx` ni lo necesita: no hay `redirect()` ni `notFound()`.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Tus puntos' }

/** Las columnas del desglose, en el mismo orden que la lista de "cómo ganar". */
const DESGLOSE = [
  { llave: 'lecciones', que: 'Lecciones completadas', vale: PUNTOS.leccion },
  { llave: 'comentarios', que: 'Comentarios', vale: PUNTOS.comentario },
  { llave: 'publicaciones', que: 'Publicaciones en la comunidad', vale: PUNTOS.publicacion },
  { llave: 'tareas', que: 'Tareas entregadas', vale: PUNTOS.tarea },
  { llave: 'quizzes', que: 'Quizzes aprobados', vale: PUNTOS.quiz },
  { llave: 'tareasAprobadas', que: 'Tareas aprobadas', vale: PUNTOS.tareaAprobada },
  { llave: 'certificados', que: 'Certificados', vale: PUNTOS.certificado },
] as const

export default async function PaginaPuntos() {
  const perfil = await exigirPerfil()

  const [nivel, cursos] = await Promise.all([miNivel(perfil.user_id), misCursos()])

  const filas = DESGLOSE.map((d) => {
    const cuantas = nivel.actividad[d.llave]
    return { ...d, cuantas, puntos: cuantas * d.vale }
  })

  const conActividad = filas.filter((f) => f.cuantas > 0)

  return (
    <div className="flex flex-col gap-8">
      <Titulo apoyo="De dónde salen tus puntos, y cómo vas frente a tu grupo.">
        Tus puntos
      </Titulo>

      {/* --- El número, el nivel y lo que falta ------------------------- */}
      <Tarjeta className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs tracking-wider text-muted-foreground uppercase">
              Puntos acumulados
            </span>
            <span className="text-[3rem] leading-none font-medium tabular-nums text-primary">
              {nivel.puntos}
            </span>
          </div>

          <div className="flex flex-col items-start gap-1 sm:items-end">
            <span className="rounded-full bg-primary/12 px-3 py-1 text-sm font-medium text-primary">
              Nivel {nivel.nivel.numero} · {nivel.nivel.nombre}
            </span>
            {nivel.nivel.siguiente ? (
              <span className="text-xs text-muted-foreground">
                Te faltan {nivel.nivel.faltan} para {nivel.nivel.siguiente.nombre}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Llegaste al último nivel.</span>
            )}
          </div>
        </div>

        {/* La barra hacia el siguiente nivel. El ancho va inline porque es un
            dato, no una clase: Tailwind no puede generar un porcentaje que solo
            se conoce al pintar. */}
        <div className="flex flex-col gap-1.5">
          <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={nivel.nivel.progreso}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Avance hacia ${nivel.nivel.siguiente?.nombre ?? 'el último nivel'}`}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-700"
              style={{ width: `${nivel.nivel.progreso}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            {NIVELES.map((n) => (
              <span
                key={n.nombre}
                className={nivel.puntos >= n.minimo ? 'font-medium text-primary' : undefined}
              >
                {n.minimo}
              </span>
            ))}
          </div>
        </div>
      </Tarjeta>

      {/* --- De dónde salen ------------------------------------------------ */}
      <Seccion
        titulo="De dónde salen tus puntos"
        apoyo={
          conActividad.length === 0
            ? 'Todavía no has sumado. Cualquiera de estas cosas empieza a contar.'
            : undefined
        }
      >
        <Tarjeta className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-left font-medium">
                  Actividad
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                  Cuántas
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                  Cada una
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                  Puntos
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filas.map((f) => (
                <tr key={f.llave} className={f.cuantas === 0 ? 'text-muted-foreground' : undefined}>
                  <td className="px-4 py-2.5">{f.que}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{f.cuantas}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                    {f.vale}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums">{f.puntos}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-border bg-muted/30">
              <tr>
                <td className="px-4 py-3 font-medium" colSpan={3}>
                  Total
                </td>
                <td className="px-4 py-3 text-right text-base font-medium tabular-nums text-primary">
                  {nivel.puntos}
                </td>
              </tr>
            </tfoot>
          </table>
        </Tarjeta>
      </Seccion>

      {/* --- Cómo vas frente a tu grupo ------------------------------------ */}
      {cursos.length > 0 ? (
        <Seccion
          titulo="Cómo vas en tu grupo"
          apoyo="Compites con las personas de tu curso, que son a quienes ves en la comunidad."
        >
          <div className="flex flex-col gap-5">
            {cursos.map((c) => (
              <div key={c.id} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-medium">{c.titulo}</h3>
                  <Link
                    href={`/curso/${c.slug}/comunidad`}
                    className="text-xs text-primary underline-offset-4 hover:underline"
                  >
                    Ir a su comunidad →
                  </Link>
                </div>
                <Ranking cursoId={c.id} userId={perfil.user_id} />
              </div>
            ))}
          </div>
        </Seccion>
      ) : null}

      {/* --- Cómo ganar más ------------------------------------------------ */}
      <Seccion titulo="Cómo ganar más puntos">
        <Tarjeta className="flex flex-col gap-2 p-5">
          <ul className="flex flex-col gap-1.5 text-sm">
            {COMO_GANAR.map((g) => (
              <li key={g.que} className="flex items-baseline justify-between gap-4">
                <span>{g.que}</span>
                <span className="shrink-0 font-medium tabular-nums text-primary">
                  +{g.puntos}
                </span>
              </li>
            ))}
          </ul>
          <p className="pt-1 text-xs text-muted-foreground">
            Los puntos se calculan solos a partir de lo que haces. Si borras un comentario, sus
            puntos se van con él.
          </p>
        </Tarjeta>
      </Seccion>
    </div>
  )
}
