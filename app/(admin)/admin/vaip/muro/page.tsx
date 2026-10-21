import type { Metadata } from 'next'
import Link from 'next/link'

import { TemasDelMuro } from '@/components/admin/temas-del-muro'
import { Seccion, Tarjeta } from '@/components/ui-vadai/superficie'
import { fechaLarga } from '@/components/vaip/tu-membresia'
import { Button } from '@/components/ui/button'
import { bandejaDeComunidad } from '@/lib/admin/comunidad'
import { exigirEquipo } from '@/lib/auth/sesion'
import { planVaip } from '@/lib/membresia/consultas'
import { crearClienteServidor } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Muro de V-AI-P' }
export const dynamic = 'force-dynamic'

/**
 * El muro de V-AI-P (M19): lo que espera respuesta, los temas y la entrada a
 * la comunidad. Responder se hace en la bandeja de Comunidad (la misma de
 * todos los cursos, ya filtrada a la casa) o directo en el muro: el equipo
 * entra al portal de alumnos con su propia cuenta y contesta como Equipo VADAI.
 */
export default async function PaginaMuro() {
  await exigirEquipo()
  const plan = await planVaip()
  if (!plan?.casa) return <p className="text-sm text-muted-foreground">V-AI-P todavía no tiene curso casa.</p>
  const casa = plan.casa

  const supabase = await crearClienteServidor()
  const [bandeja, { data: temas }] = await Promise.all([
    bandejaDeComunidad({ curso: casa.id }),
    supabase
      .from('community_topics')
      .select('id, name, archived, solo_equipo')
      .eq('course_id', casa.id)
      .order('position'),
  ])
  // La bandeja cae a toda la academia si la casa no tiene hilos: solo vale si de verdad filtró.
  const deLaCasa = !bandeja.fallo && bandeja.filtros.curso === casa.id
  const hilos = deLaCasa ? bandeja.hilos.slice(0, 5) : []
  const sinRespuesta = deLaCasa ? bandeja.conteos.sin : 0

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href={`/curso/${casa.slug}/comunidad`}>Entrar a la comunidad</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/vaip/publicar">Publicar en el muro</Link>
        </Button>
      </div>

      <Seccion
        titulo="Esperan respuesta"
        apoyo={
          sinRespuesta === 0
            ? 'Nadie espera respuesta en V-AI-P.'
            : `${sinRespuesta} ${sinRespuesta === 1 ? 'hilo espera' : 'hilos esperan'} al equipo, el más antiguo primero.`
        }
        accion={
          <Link href={`/admin/comunidad?curso=${casa.id}`} className="text-sm font-medium text-primary hover:underline">
            Abrir en la bandeja
          </Link>
        }
      >
        {hilos.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {hilos.map((h) => (
              <li key={h.id}>
                <Tarjeta className="flex flex-col gap-1 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{h.titulo ?? h.leccion?.titulo ?? 'Pregunta'}</span>
                    <span className="text-xs text-muted-foreground">
                      {h.autor.nombre} · {fechaLarga(h.esperaDesde ?? h.creadoEn)}
                    </span>
                  </div>
                  {h.texto ? <p className="line-clamp-2 text-pretty text-muted-foreground">{h.texto}</p> : null}
                  <Link href={h.hrefPortal} className="w-fit text-xs font-medium text-primary hover:underline">
                    Ver en el muro
                  </Link>
                </Tarjeta>
              </li>
            ))}
          </ul>
        ) : null}
      </Seccion>

      <Seccion
        titulo="Temas del muro"
        apoyo="El muro de V-AI-P es uno solo; los temas sirven para filtrarlo y se eligen al publicar. En «Noticias» solo publica el equipo."
      >
        <TemasDelMuro
          cursoId={casa.id}
          temas={(temas ?? []).map((t) => ({ id: t.id, nombre: t.name, archivado: t.archived, soloEquipo: t.solo_equipo }))}
        />
      </Seccion>
    </div>
  )
}
