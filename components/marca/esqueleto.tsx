import { cn } from '@/lib/utils'

/**
 * Piezas de esqueleto para las pantallas de carga.
 *
 * Las vistas de alumno tardan entre 600 y 900 ms: son server components que
 * consultan Supabase, y ese viaje no se puede eliminar del todo. Sin nada en
 * pantalla durante ese rato, tocar una lección se siente como si el clic no
 * hubiera registrado — y la gente vuelve a tocar.
 *
 * Un esqueleto con la FORMA de lo que viene es mejor que un spinner por dos
 * razones: dice que la página ya está cargando algo concreto, y no provoca el
 * salto de layout que se produce cuando el contenido real aparece de golpe.
 *
 * `aria-hidden` a propósito: para un lector de pantalla esto es ruido. El
 * anuncio de que la página cambió lo hace Next al completar la navegación.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DÓNDE **NO** PONER UN loading.tsx, Y POR QUÉ
 *
 * Un `loading.tsx` mete la página en un límite de Suspense, y eso hace que Next
 * empiece a transmitir la respuesta de inmediato. A partir de ahí `redirect()`
 * y `notFound()` YA NO PUEDEN cambiar el estado HTTP: la respuesta sale 200 con
 * el esqueleto y el rebote ocurre después, del lado del cliente.
 *
 * Consecuencias, en orden de gravedad:
 *   1. Sin JavaScript el rebote nunca pasa: el alumno vencido se queda varado
 *      mirando un esqueleto de contenido que no puede abrir.
 *   2. Un curso que no existe para ese alumno responde 200 en vez de 404.
 *
 * Se comprobó también moviendo la guarda a un `layout.tsx`: no cambia nada, la
 * transmisión arranca igual.
 *
 * Por eso las vistas de curso, lección, comunidad y admin —que controlan acceso
 * con `redirect()` o `notFound()`— NO llevan esqueleto, aunque sean las más
 * lentas. Solo lo llevan /mis-cursos, /perfil y /blog, donde quien no debería
 * estar ya fue detenido por el middleware.
 * ────────────────────────────────────────────────────────────────────────────
 */
export function Bloque({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('block animate-pulse rounded-md bg-muted', className)}
    />
  )
}

/** Encabezado de página: título y una línea de apoyo. */
export function EsqueletoEncabezado() {
  return (
    <div className="flex flex-col gap-2.5">
      <Bloque className="h-7 w-56" />
      <Bloque className="h-4 w-72 max-w-full" />
    </div>
  )
}

/** Lista de tarjetas, como /mis-cursos o el feed de comunidad. */
export function EsqueletoTarjetas({ cuantas = 3 }: { cuantas?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: cuantas }, (_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-lg border border-border p-5">
          <Bloque className="h-5 w-1/2" />
          <Bloque className="h-3.5 w-3/4" />
          <Bloque className="h-2 w-full rounded-full" />
        </div>
      ))}
    </div>
  )
}

/** Renglones sueltos, para listas simples. */
export function EsqueletoLineas({ cuantas = 4 }: { cuantas?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: cuantas }, (_, i) => (
        <Bloque key={i} className="h-11 w-full" />
      ))}
    </div>
  )
}

/**
 * Envoltorio común: el `role="status"` anuncia una sola vez que se está
 * cargando, en vez de que el lector recite cada bloque del esqueleto.
 */
export function PantallaDeCarga({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-8">
      <span className="sr-only">Cargando…</span>
      {children}
    </div>
  )
}
