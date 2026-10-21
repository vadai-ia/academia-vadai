import type { Metadata } from 'next'

import { AccionesDeWebhook, NuevaLlave, NuevoWebhook } from '@/components/admin/ajustes-api'
import { Seccion, Tarjeta, Titulo } from '@/components/ui-vadai/superficie'
import { fechaLarga } from '@/components/vaip/tu-membresia'
import { Button } from '@/components/ui/button'
import { alternarWebhook, revocarLlaveApi } from '@/lib/api/acciones'
import { LIMITE_POR_HORA } from '@/lib/api/contexto'
import { apiConfigurada } from '@/lib/api/llaves'
import { especificacion } from '@/lib/api/openapi'
import { webhooksConfigurados } from '@/lib/api/webhooks'
import { exigirAdmin } from '@/lib/auth/sesion'
import { crearClienteServidor } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'API' }
export const dynamic = 'force-dynamic'

/**
 * Ajustes → API (M20), solo admin: las llaves para que otras plataformas (o
 * una rutina de Claude) publiquen noticias, agenden eventos, contesten el muro
 * y lean cómo va la comunidad; los webhooks que la academia les manda; y la
 * documentación para conectarlas.
 */
export default async function PaginaApi() {
  await exigirAdmin()
  const supabase = await crearClienteServidor()
  const hace24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const [{ data: llaves }, { data: webhooks }, { data: uso }] = await Promise.all([
    supabase
      .from('api_keys')
      .select('id, nombre, key_id, permisos, created_at, expires_at, revoked_at, last_used_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('webhooks_salientes')
      .select('id, nombre, url, eventos, activo, fallas_seguidas, desactivado_en, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('api_bitacora').select('key_id, status').gte('created_at', hace24).limit(5000),
  ])
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '')
  const rutas = Object.entries(especificacion(base).paths).flatMap(([ruta, metodos]) =>
    Object.entries(metodos).map(([metodo, op]) => ({ metodo: metodo.toUpperCase(), ruta, resumen: (op as { summary: string }).summary }))
  )
  const ahora = Date.now()
  const faltan = [
    !apiConfigurada() ? 'API_KEYS_PEPPER' : null,
    !webhooksConfigurados() ? 'WEBHOOKS_MASTER' : null,
    (process.env.CRON_SECRET ?? '').length < 16 ? 'CRON_SECRET' : null,
  ].filter(Boolean)

  return (
    <div className="flex flex-col gap-10">
      <Titulo ceja="Ajustes" apoyo="Para que otras plataformas —o una rutina de Claude— publiquen noticias, agenden clases, contesten el muro y lean cómo va la comunidad.">
        API
      </Titulo>

      {faltan.length > 0 ? (
        <Tarjeta className="border-dashed p-5 text-sm text-pretty">
          Faltan en el servidor: <span className="font-mono">{faltan.join(', ')}</span>. Ver docs/M20.md.
        </Tarjeta>
      ) : null}

      <Seccion titulo="Llaves" apoyo={`Cada llave tiene sus permisos y un límite de ${LIMITE_POR_HORA} llamadas por hora.`}>
        {(llaves ?? []).length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
            Todavía no hay llaves.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(llaves ?? []).map((l) => {
              const vencida = l.expires_at !== null && Date.parse(l.expires_at) <= ahora
              const activa = !l.revoked_at && !vencida
              const llamadas = (uso ?? []).filter((u) => u.key_id === l.id)
              const errores = llamadas.filter((u) => u.status >= 400).length
              return (
                <li key={l.id}>
                  <Tarjeta className={cn('flex flex-col gap-2 px-4 py-3 text-sm', !activa && 'opacity-60')}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium">{l.nombre}</span>
                      <span className="font-mono text-xs text-muted-foreground">vadai_{l.key_id}_…</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {l.permisos.map((p) => (
                        <span key={p} className="rounded-full border border-border px-2 py-0.5 font-mono text-[11px]">
                          {p}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {l.revoked_at
                        ? `Revocada el ${fechaLarga(l.revoked_at)}`
                        : vencida
                          ? 'Vencida'
                          : l.expires_at
                            ? `Vence el ${fechaLarga(l.expires_at)}`
                            : 'No vence'}
                      {' · '}
                      {l.last_used_at ? `último uso el ${fechaLarga(l.last_used_at)}` : 'sin usar'}
                      {' · '}
                      {llamadas.length} llamadas en 24 h{errores ? `, ${errores} con error` : ''}
                    </p>
                    {activa ? (
                      <form action={revocarLlaveApi}>
                        <input type="hidden" name="id" value={l.id} />
                        <Button type="submit" size="sm" variant="outline" className="border-destructive/50 text-destructive">
                          Revocar
                        </Button>
                      </form>
                    ) : null}
                  </Tarjeta>
                </li>
              )
            })}
          </ul>
        )}
        <NuevaLlave />
      </Seccion>

      <Seccion
        titulo="Webhooks"
        apoyo="La academia avisa a tus plataformas cuando pasa algo. Cada aviso va firmado y se reintenta si no llega; tras 10 fallas seguidas, el webhook se apaga solo."
      >
        {(webhooks ?? []).length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
            Todavía no hay webhooks.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(webhooks ?? []).map((w) => (
              <li key={w.id}>
                <Tarjeta className="flex flex-col gap-2 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{w.nombre}</span>
                    <span className={cn('text-xs', w.activo ? 'text-primary' : 'text-destructive')}>
                      {w.activo ? 'Encendido' : `Apagado${w.desactivado_en ? ` el ${fechaLarga(w.desactivado_en)}` : ''}`}
                    </span>
                  </div>
                  <span className="font-mono text-xs break-all text-muted-foreground">{w.url}</span>
                  <span className="text-xs text-muted-foreground">
                    {w.eventos.join(' · ')}
                    {w.fallas_seguidas ? ` · ${w.fallas_seguidas} fallas seguidas` : ''}
                  </span>
                  <div className="flex flex-wrap items-start gap-2">
                    <AccionesDeWebhook id={w.id} />
                    <form action={alternarWebhook}>
                      <input type="hidden" name="id" value={w.id} />
                      <input type="hidden" name="encender" value={w.activo ? 'no' : 'si'} />
                      <Button type="submit" size="sm" variant="outline">
                        {w.activo ? 'Apagar' : 'Encender'}
                      </Button>
                    </form>
                  </div>
                </Tarjeta>
              </li>
            ))}
          </ul>
        )}
        <NuevoWebhook />
      </Seccion>

      <Seccion titulo="Cómo se usa" apoyo="Cada llamada lleva la llave en el encabezado Authorization.">
        <Tarjeta className="flex flex-col gap-4 p-5 text-sm">
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">{`curl ${base}/api/v1/metricas \\
  -H "Authorization: Bearer vadai_…"

curl -X POST ${base}/api/v1/noticias \\
  -H "Authorization: Bearer vadai_…" \\
  -H "Content-Type: application/json" \\
  -d '{"titulo":"Claude ya lee tus PDFs de 500 páginas","cuerpo":"Qué cambió y cómo lo usas en tu negocio.","fuente":"https://www.anthropic.com/news"}'`}</pre>
          <p className="text-muted-foreground">
            Por omisión todo es sobre V-AI-P; para otro plan, agrega <span className="font-mono">?plan=&lt;slug&gt;</span>. La
            especificación completa, para importarla en Make, Zapier o n8n:{' '}
            <a href="/api/v1/openapi.json" className="font-medium text-primary hover:underline">
              openapi.json
            </a>
            .
          </p>
          <ul className="flex flex-col divide-y divide-border rounded-[10px] border border-border">
            {rutas.map((r) => (
              <li key={`${r.metodo} ${r.ruta}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2">
                <span className="w-14 shrink-0 font-mono text-xs font-medium text-primary">{r.metodo}</span>
                <span className="font-mono text-xs">{r.ruta}</span>
                <span className="text-xs text-muted-foreground">{r.resumen}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-1.5">
            <p className="font-medium">Verificar la firma de un webhook</p>
            <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">{`// X-VADAI-Firma: t=<unix>,v1=<hex>
const [t, v1] = firma.split(',').map((p) => p.split('=')[1])
const esperada = crypto.createHmac('sha256', SECRETO).update(\`\${t}.\${cuerpoCrudo}\`).digest('hex')
const valida = esperada === v1 && Math.abs(Date.now() / 1000 - Number(t)) < 300`}</pre>
          </div>
        </Tarjeta>
      </Seccion>
    </div>
  )
}
