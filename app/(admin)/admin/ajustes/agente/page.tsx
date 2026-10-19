import type { Metadata } from 'next'

import { FormularioAjustesAgente, FormularioVoz, NuevoConocimiento, Probador } from '@/components/admin/agente'
import { BotonConEspera } from '@/components/admin/boton-con-espera'
import { ConfirmarConModal } from '@/components/admin/confirmar-con-modal'
import { Cifra, Progreso, Seccion, Tarjeta, Titulo } from '@/components/ui-vadai/superficie'
import { fechaLarga } from '@/components/vaip/tu-membresia'
import { Badge } from '@/components/ui/badge'
import { alternarConocimiento, borrarConocimiento } from '@/lib/agente/acciones'
import { claudeConfigurado } from '@/lib/agente/claude'
import { dolares } from '@/lib/agente/costos'
import { gastoDelMes } from '@/lib/agente/panel'
import { REGLAS, VOZ_POR_DEFECTO } from '@/lib/agente/prompt'
import { exigirAdmin } from '@/lib/auth/sesion'
import { esCuentaQa, esCursoQa } from '@/lib/qa'
import { crearClienteServidor } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Agente' }
export const dynamic = 'force-dynamic'

/**
 * Ajustes → Agente (M21), solo admin: si el agente contesta solo, deja
 * borradores o está apagado; cuándo contesta; cuánto puede gastar; cómo habla;
 * un probador que no publica; y lo que sabe.
 */

const FUENTE: Record<string, string> = { repo: 'Material', plataforma: 'Lección', fireflies: 'Clase (Fireflies)', bunny: 'Video (Bunny)', equipo: 'Nota del equipo' }
const TAREA: Record<string, string> = { responder: 'Responder', escalar: 'Casos difíciles', resumen: 'Resumen del día', noticias: 'Noticias', probador: 'Probador' }

export default async function PaginaAjustesAgente() {
  const perfil = await exigirAdmin()
  const qa = esCuentaQa(perfil.email)
  const supabase = await crearClienteServidor()
  const [{ data: ajustes }, { data: cursos }, { data: conocimiento }, gasto] = await Promise.all([
    supabase.from('agent_settings').select('*').eq('es_qa', qa).maybeSingle(),
    supabase.from('courses').select('id, title, slug').neq('status', 'archived').order('title'),
    supabase
      .from('agent_knowledge')
      .select('id, fuente, titulo, course_id, activo, caracteres, updated_at')
      .order('fuente')
      .order('titulo')
      .limit(500),
    gastoDelMes(qa),
  ])

  const opciones = (cursos ?? []).filter((c) => esCursoQa(c.slug) === qa).map((c) => ({ id: c.id, titulo: c.title }))
  const tituloDeCurso = new Map(opciones.map((c) => [c.id, c.titulo]))
  const faltan = [
    !claudeConfigurado() ? 'ANTHROPIC_API_KEY' : null,
    (process.env.CRON_SECRET ?? '').length < 16 ? 'CRON_SECRET' : null,
  ].filter(Boolean)

  if (!ajustes) {
    return (
      <div className="flex flex-col gap-6">
        <Titulo>Agente</Titulo>
        <Tarjeta className="border-dashed p-5 text-sm">Falta aplicar la migración academia_0045_agente.</Tarjeta>
      </div>
    )
  }

  const porcentaje = gasto && gasto.tope > 0 ? (gasto.gastado / gasto.tope) * 100 : 0

  return (
    <div className="flex flex-col gap-10">
      <Titulo apoyo="Contesta en las comunidades con la voz de VADAI, deja borrador cuando no está seguro y le cuenta al equipo qué está pasando.">
        Agente
      </Titulo>

      {faltan.length > 0 ? (
        <Tarjeta className="border-dashed p-5 text-sm text-pretty">
          Faltan en el servidor: <span className="font-mono">{faltan.join(', ')}</span>. Sin eso el agente no corre. Ver docs/M21.md.
        </Tarjeta>
      ) : null}

      <Seccion titulo="Gasto del mes" apoyo="Se cuenta antes de cada llamada: el agente nunca pasa del tope.">
        <Tarjeta className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            <Cifra valor={dolares(gasto?.gastado ?? 0)} etiqueta={`de ${dolares(gasto?.tope ?? Number(ajustes.tope_usd))}`} destacada />
            <Cifra valor={gasto?.llamadas ?? 0} etiqueta="llamadas a Claude" />
          </div>
          <Progreso porcentaje={porcentaje} etiqueta={`${Math.round(porcentaje)} % del tope`} />
          {ajustes.pausado_por_tope ? (
            <p className="text-sm text-destructive">Llegó al tope: está en pausa. Sube el tope o espera al mes que entra; mientras, todo lo atiende el equipo.</p>
          ) : porcentaje >= 80 ? (
            <p className="text-sm text-destructive">Va en {Math.round(porcentaje)} % del tope del mes.</p>
          ) : null}
          {gasto && gasto.porTarea.length > 0 ? (
            <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              {gasto.porTarea.map((t) => (
                <li key={t.tarea}>
                  {TAREA[t.tarea] ?? t.tarea}: {dolares(t.costo)} · {t.llamadas}
                </li>
              ))}
            </ul>
          ) : null}
        </Tarjeta>
      </Seccion>

      <Seccion titulo="Cómo trabaja">
        <FormularioAjustesAgente
          ajustes={{
            modo: ajustes.modo,
            umbral: Number(ajustes.umbral),
            espera_min: ajustes.espera_min,
            espera_max: ajustes.espera_max,
            hora_inicio: ajustes.hora_inicio,
            hora_fin: ajustes.hora_fin,
            busqueda_web: ajustes.busqueda_web,
            noticias: ajustes.noticias,
            tope_usd: Number(ajustes.tope_usd),
            modelo_rapido: ajustes.modelo_rapido,
            modelo_fuerte: ajustes.modelo_fuerte,
          }}
        />
      </Seccion>

      <Seccion titulo="Voz" apoyo="Cómo contesta. Lo que publica sale firmado «Equipo VADAI · con Claude, nuestra IA».">
        <FormularioVoz prompt={ajustes.prompt} porDefecto={VOZ_POR_DEFECTO} />
        <details className="rounded-[10px] border border-border bg-card px-5 py-3 text-sm">
          <summary className="cursor-pointer font-medium">Las reglas que pone el sistema</summary>
          <pre className="mt-3 font-sans text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">{REGLAS}</pre>
        </details>
      </Seccion>

      <Seccion titulo="Probador" apoyo="Pregúntale algo y ve qué contestaría. No publica nada; sí cuenta en el gasto.">
        {opciones.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay cursos vigentes.</p>
        ) : (
          <Probador cursos={opciones} />
        )}
      </Seccion>

      <Seccion
        titulo="Lo que sabe"
        apoyo="Material del curso, transcripts de las clases y notas del equipo. Por pregunta elige lo que más se parece; sin nada que ver, deja borrador."
        accion={<NuevoConocimiento cursos={opciones} />}
      >
        {(conocimiento ?? []).length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
            Todavía no sabe nada más que cómo funciona la plataforma. Carga el material con node scripts/agente-conocimiento.mjs o agrega una nota.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(conocimiento ?? []).map((k) => (
              <li key={k.id}>
                <Tarjeta className={cn('flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm', !k.activo && 'opacity-60')}>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-medium">{k.titulo}</span>
                    <span className="text-xs text-muted-foreground">
                      {FUENTE[k.fuente] ?? k.fuente} · {k.course_id ? (tituloDeCurso.get(k.course_id) ?? 'Otro curso') : 'Todos los cursos'} ·{' '}
                      {(k.caracteres ?? 0).toLocaleString('es-MX')} letras · {fechaLarga(k.updated_at)}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    {!k.activo ? <Badge variant="outline">Apagado</Badge> : null}
                    <form action={alternarConocimiento}>
                      <input type="hidden" name="id" value={k.id} />
                      <input type="hidden" name="activo" value={k.activo ? 'no' : 'si'} />
                      <BotonConEspera texto={k.activo ? 'Apagar' : 'Encender'} enCurso="…" variante="ghost" />
                    </form>
                    <ConfirmarConModal
                      idModal={`borrar-conocimiento-${k.id}`}
                      accion={borrarConocimiento}
                      campos={{ id: k.id }}
                      boton={{ texto: 'Borrar', etiquetaAccesible: `Borrar «${k.titulo}»`, tono: 'destructivo' }}
                      titulo="¿Borrar este material?"
                      confirmar={{ texto: 'Sí, borrar', enCurso: 'Borrando…', tono: 'destructivo' }}
                    >
                      <p>El agente deja de usarlo. Si viene del script, vuelve la próxima vez que lo corras; para dejarlo fuera, mejor apágalo.</p>
                    </ConfirmarConModal>
                  </span>
                </Tarjeta>
              </li>
            ))}
          </ul>
        )}
      </Seccion>
    </div>
  )
}
