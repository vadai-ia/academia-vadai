import type { Metadata } from 'next'
import Link from 'next/link'

import { PublicarBorrador } from '@/components/admin/agente'
import { BotonConEspera } from '@/components/admin/boton-con-espera'
import { Cifra, Progreso, Seccion, Tarjeta, Titulo } from '@/components/ui-vadai/superficie'
import { Badge } from '@/components/ui/badge'
import { hrefEnPanel, HORAS_DEL_AGENTE } from '@/lib/admin/comunidad'
import { atenderIdea, descartarBorrador } from '@/lib/agente/acciones'
import { dolares } from '@/lib/agente/costos'
import { tableroDelAgente, type BorradorDelPanel } from '@/lib/agente/panel'
import { textoPlano } from '@/lib/comunidad/documento'

export const metadata: Metadata = { title: 'Agente IA · Ajustes' }
export const dynamic = 'force-dynamic'

/**
 * El agente de la comunidad, para el equipo (M21): lo que dejó en borrador
 * para que una persona lo publique, el resumen del día, las ideas y
 * peticiones que fue juntando, y cuánto contestó. El gasto, solo al admin.
 *
 * El agente atiende todas las comunidades de la academia, por eso vive en el
 * grupo Comunidad del panel y no dentro de un solo curso.
 */

const ZONA = 'America/Mexico_City'
const MODO: Record<string, string> = { apagado: 'Apagado', borradores: 'Solo borradores', automatico: 'Automático' }
const TIPO_IDEA: Record<string, string> = {
  idea: 'Ideas',
  peticion: 'Peticiones',
  queja: 'Quejas',
  duda_frecuente: 'Dudas que se repiten',
  elogio: 'Lo que les gusta',
}

function fechaHora(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: ZONA }).format(new Date(iso))
}

function fechaDelResumen(fecha: string): string {
  return new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${fecha}T12:00:00Z`))
}

function Borrador({ b }: { b: BorradorDelPanel }) {
  // Lo último que escribió un alumno; si nadie contestó todavía, lo que abrió el hilo.
  const ultimo = b.hilo ? [...b.hilo.respuestas].reverse().find((r) => !r.autor.equipo && !r.oculto) : null
  const pregunta = ultimo?.texto ?? (b.hilo?.tipo === 'muro' ? textoPlano(b.hilo.rico) : b.hilo?.texto) ?? null
  return (
    <li id={`borrador-${b.id}`}>
      <Tarjeta className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[11px]">
              {b.tipo === 'noticia' ? 'Noticia' : b.hilo?.tipo === 'leccion' ? 'Pregunta en lección' : 'Muro'}
            </Badge>
            {b.curso ? <span>{b.curso}</span> : null}
            {b.hilo?.leccion ? <span>· {b.hilo.leccion.titulo}</span> : null}
            <span>· {fechaHora(b.creadoEn)}</span>
          </span>
          {b.certeza !== null ? <span className="text-xs text-muted-foreground tabular-nums">certeza {b.certeza.toFixed(2)}</span> : null}
        </div>

        {b.tipo === 'respuesta' ? (
          b.hilo ? (
            <div className="flex flex-col gap-1 rounded-md bg-muted/50 px-4 py-3 text-sm">
              {b.hilo.titulo ? <span className="font-medium">{b.hilo.titulo}</span> : null}
              {pregunta ? <p className="line-clamp-4 whitespace-pre-wrap text-muted-foreground">{pregunta}</p> : null}
              <span className="flex flex-wrap gap-x-4 text-xs">
                <Link href={hrefEnPanel(b.hilo, 'todas')} className="text-primary underline-offset-4 hover:underline">
                  {b.hilo.mundo === 'vaip' ? 'Ver el hilo en el Muro' : 'Ver el hilo en Grupos'}
                </Link>
                <Link href={b.hilo.hrefPortal} className="text-primary underline-offset-4 hover:underline">
                  Verlo como alumno
                </Link>
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">El hilo ya no está visible.</p>
          )
        ) : b.fuente ? (
          <p className="text-xs break-all text-muted-foreground">
            Fuente:{' '}
            <a href={b.fuente} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
              {b.fuente}
            </a>
          </p>
        ) : null}

        {b.motivo ? <p className="text-xs text-muted-foreground">Por qué lo dejó aquí: {b.motivo}</p> : null}

        <PublicarBorrador id={b.id} tipo={b.tipo} titulo={b.titulo} texto={b.texto} />
        <form action={descartarBorrador} className="-mt-2">
          <input type="hidden" name="id" value={b.id} />
          <BotonConEspera texto="Descartar" enCurso="Descartando…" variante="ghost" className="text-muted-foreground" />
        </form>
      </Tarjeta>
    </li>
  )
}

export default async function PaginaAgente() {
  const t = await tableroDelAgente()
  const respuestas = t.borradores.filter((b) => b.tipo === 'respuesta')
  const noticias = t.borradores.filter((b) => b.tipo === 'noticia')
  const ideasPorTipo = new Map<string, typeof t.ideas>()
  for (const i of t.ideas) ideasPorTipo.set(i.tipo, [...(ideasPorTipo.get(i.tipo) ?? []), i])
  const porcentaje = t.gasto && t.gasto.tope > 0 ? (t.gasto.gastado / t.gasto.tope) * 100 : 0

  return (
    <div className="flex flex-col gap-10">
      <Titulo
        ceja="Ajustes"
        apoyo="Contesta en el muro de V-AI-P y en los grupos de los cursos con la voz de VADAI. Lo que no tiene claro lo deja aquí para que una persona lo revise."
        acciones={
          t.esAdmin ? (
            <Link href="/admin/agente/ajustes" className="text-sm text-primary underline-offset-4 hover:underline">
              Voz, conocimiento y gasto
            </Link>
          ) : null
        }
      >
        Agente IA
      </Titulo>

      {!t.ajustes ? (
        <Tarjeta className="border-dashed p-5 text-sm">Falta aplicar la migración academia_0045_agente.</Tarjeta>
      ) : (
        <Tarjeta className="flex flex-wrap items-center gap-x-10 gap-y-4 p-5">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">Modo</span>
            <span className="flex items-center gap-2 text-lg font-medium">
              {MODO[t.ajustes.modo]}
              {t.ajustes.pausado ? <Badge className="bg-destructive text-white">En pausa: llegó al tope</Badge> : null}
              {!t.configurado ? <Badge variant="outline">Sin llave de Claude</Badge> : null}
            </span>
          </div>
          <Cifra valor={respuestas.length + noticias.length} etiqueta="por revisar" destacada={respuestas.length + noticias.length > 0} />
          <Cifra valor={t.semana.contestadas} etiqueta="contestó solo esta semana" />
          <Cifra valor={t.semana.omitidos} etiqueta="no necesitaban respuesta" />
          {t.semana.fallidos > 0 ? <Cifra valor={t.semana.fallidos} etiqueta="fallaron" /> : null}
        </Tarjeta>
      )}

      {t.contestadas48h > 0 ? (
        <p className="text-sm">
          Contestó solo {t.contestadas48h === 1 ? 'un hilo' : `${t.contestadas48h} hilos`} en las últimas {HORAS_DEL_AGENTE} horas.{' '}
          <Link href="/admin/grupos?estado=agente" className="text-primary underline-offset-4 hover:underline">
            Revisarlos en Grupos
          </Link>{' '}
          o en el{' '}
          <Link href="/admin/vaip/muro?estado=agente" className="text-primary underline-offset-4 hover:underline">
            Muro de V-AI-P
          </Link>
        </p>
      ) : null}

      <Seccion titulo="Por revisar" apoyo="Corrígelo si hace falta y publícalo: sale firmado «con Claude · revisado por el equipo».">
        {respuestas.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
            No hay borradores. Cuando el agente no esté seguro de una respuesta, aparece aquí.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {respuestas.map((b) => (
              <Borrador key={b.id} b={b} />
            ))}
          </ul>
        )}
      </Seccion>

      {/* M24: las noticias se cazan, revisan y publican en V-AI-P → Noticias,
          con imagen y «Leer más». Aquí solo quedan los borradores viejos, si hay. */}
      <Seccion titulo="Noticias de IA" apoyo="Se cazan cada mañana a las 7:00 y cuando quieras, y se revisan en V-AI-P → Noticias.">
        {noticias.length === 0 ? (
          <Link
            href="/admin/vaip/noticias"
            className="inline-flex w-fit items-center rounded-full border border-border px-4 py-2 text-sm font-medium pointer-coarse:min-h-11 hover:border-primary/50 hover:text-primary"
          >
            Ir a Noticias →
          </Link>
        ) : (
          <ul className="flex flex-col gap-4">
            {noticias.map((b) => (
              <Borrador key={b.id} b={b} />
            ))}
          </ul>
        )}
      </Seccion>

      <Seccion titulo="Resumen del día" apoyo={t.resumen ? `De ${fechaDelResumen(t.resumen.fecha)}.` : 'Se arma cada mañana a las 7:00.'}>
        {!t.resumen ? (
          <p className="rounded-[10px] border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">Todavía no hay resumen.</p>
        ) : (
          <Tarjeta className="flex flex-col gap-5 p-5 text-sm">
            <p className="text-base text-pretty">{t.resumen.resumen}</p>
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-muted-foreground">
              <span>{t.resumen.cifras.conversaciones} conversaciones</span>
              <span>{t.resumen.cifras.mensajesDeAlumnos} mensajes de alumnos</span>
              <span>{t.resumen.cifras.respuestasDelEquipo} respuestas del equipo</span>
              <span>{t.resumen.cifras.respuestasDelAgente} del agente</span>
            </div>
            {t.resumen.atencion.length > 0 ? (
              <div className="flex flex-col gap-2">
                <span className="font-medium">Necesitan a una persona</span>
                <ul className="flex flex-col gap-1.5">
                  {t.resumen.atencion.map((a) => (
                    <li key={a.href}>
                      <Link href={a.href} className="text-primary underline-offset-4 hover:underline">
                        {a.titulo}
                      </Link>{' '}
                      <span className="text-muted-foreground">
                        · {a.curso} · {a.porQue}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {t.resumen.temas.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {t.resumen.temas.map((x) => (
                  <Badge key={x.tema} variant="outline">
                    {x.tema} · {x.conversaciones}
                  </Badge>
                ))}
              </div>
            ) : null}
            {t.resumen.dudasFrecuentes.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <span className="font-medium">Dudas que se repiten</span>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {t.resumen.dudasFrecuentes.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Tarjeta>
        )}
      </Seccion>

      <Seccion titulo="Ideas y peticiones" apoyo="Lo que la comunidad pide o propone, de los últimos 30 días. Márcalo cuando lo atiendan.">
        {t.ideas.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
            Todavía no junta ideas. Las anota mientras lee las conversaciones.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {[...ideasPorTipo.entries()].map(([tipo, lista]) => (
              <Tarjeta key={tipo} className="flex flex-col gap-3 p-5">
                <span className="text-sm font-medium">
                  {TIPO_IDEA[tipo] ?? tipo} <span className="text-muted-foreground">· {lista.reduce((s, i) => s + i.veces, 0)}</span>
                </span>
                <ul className="flex flex-col gap-2">
                  {lista.map((i) => (
                    <li key={i.ids[0]} className="flex items-start justify-between gap-3 text-sm">
                      <span className="flex flex-col gap-0.5">
                        <span className="text-pretty">
                          {i.resumen}
                          {i.veces > 1 ? <span className="text-primary tabular-nums"> · {i.veces} veces</span> : null}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {i.cursos.join(', ')} · {i.veces > 1 ? 'la última, ' : ''}
                          {fechaHora(i.ultimaVez)}
                        </span>
                      </span>
                      <form action={atenderIdea}>
                        {i.ids.map((id) => (
                          <input key={id} type="hidden" name="id" value={id} />
                        ))}
                        <BotonConEspera texto="Atendida" enCurso="…" variante="ghost" />
                      </form>
                    </li>
                  ))}
                </ul>
              </Tarjeta>
            ))}
          </div>
        )}
      </Seccion>

      {t.gasto ? (
        <Seccion titulo="Gasto del mes" apoyo="Solo lo ve un admin.">
          <Tarjeta className="flex flex-col gap-3 p-5">
            <Cifra valor={dolares(t.gasto.gastado)} etiqueta={`de ${dolares(t.gasto.tope)} · ${t.gasto.llamadas} llamadas`} destacada />
            <Progreso porcentaje={porcentaje} etiqueta={`${Math.round(porcentaje)} % del tope`} />
          </Tarjeta>
        </Seccion>
      ) : null}
    </div>
  )
}
