import Link from 'next/link'

import { BotonSalir } from '@/components/auth/boton-salir'
import { CambiarTema } from '@/components/marca/cambiar-tema'
import { NavegacionPrincipal, type Destino } from '@/components/marca/navegacion'
import { EtiquetaAcademia, Wordmark } from '@/components/marca/wordmark'
import { Avatar } from '@/components/ui-vadai/superficie'
import { nombreVisible, type Perfil } from '@/lib/auth/sesion'

/**
 * Encabezado de la plataforma, en dos filas.
 *
 * La versión anterior metía TODO en una sola fila de 64 px: logo, seis
 * secciones, avatar, nombre, insignia, botón de tema y salir. Al entrar la
 * sexta sección dejó de caber, y la barra de scroll oculta recortaba "Vista de
 * alumno" sin ninguna pista de que hubiera más — un menú que se esconde es peor
 * que uno que no existe, porque la persona ni sabe que le falta algo.
 *
 * La solución no es un sidebar. Es la estructura de Vercel, Linear y GitHub:
 *
 *   fila 1  marca a la izquierda, cuenta a la derecha — y la cuenta es UN solo
 *           avatar que abre un menú con nombre, rol, tema y salir.
 *   fila 2  las secciones, solas y a todo el ancho.
 *
 * Con la segunda fila para ellas solas, seis pastillas de ~130 px caben en los
 * 1152 px del contenedor con más de la mitad libre. En escritorio no hay
 * desborde posible; si algún día hubiera diez, envuelven a un segundo renglón
 * en vez de recortarse. En móvil sí se desplazan, pero con un degradado en el
 * borde que dice "hay más" — ver `NavegacionPrincipal`.
 *
 * Pegajoso: en una lección larga, tener que subir hasta arriba para cambiar de
 * sección es de las cosas que hacen sentir pesada una plataforma. Y como está
 * en el flujo del documento (no `fixed`), no tapa el primer contenido.
 */
export function Encabezado({
  perfil,
  navegacion = [],
}: {
  perfil: Perfil
  navegacion?: Destino[]
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto w-full max-w-6xl px-5">
        {/* --- Fila 1: marca y cuenta ------------------------------------ */}
        <div className="flex h-14 items-center justify-between gap-4">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Wordmark alto={20} prioridad />
            <EtiquetaAcademia className="hidden text-[0.6rem] tracking-[0.28em] sm:inline" />
          </Link>

          <MenuDeCuenta perfil={perfil} />
        </div>

        {/* --- Fila 2: secciones ----------------------------------------- */}
        {navegacion.length > 0 ? (
          <div className="-mx-5 border-t border-border/60 px-5 py-2 sm:mx-0 sm:border-t-0 sm:px-0 sm:pt-0 sm:pb-3">
            <NavegacionPrincipal destinos={navegacion} />
          </div>
        ) : null}
      </div>
    </header>
  )
}

/**
 * Cuenta: un avatar que abre un menú.
 *
 * Es un `popover` nativo abierto con `popovertarget`, no un popover de React. Sin
 * JavaScript un botón con onClick no abre nada, y "cerrar sesión" quedaría
 * inalcanzable — justo el control que la pantalla de sin-acceso necesita para
 * que alguien ajeno pueda irse.
 *
 * CORREGIDO 18-sep-2026. Antes era un `<details>` con DOS `<summary>`: el
 * segundo era una capa invisible a pantalla completa que "cerraba al hacer clic
 * fuera". No cerraba nada: en HTML solo el PRIMER `<summary>` de un `<details>`
 * lo abre y lo cierra, el resto es contenido. Y como esa capa quedaba encima del
 * avatar, el clic para cerrarlo tampoco llegaba. Una vez abierto, el menú ya no
 * se podía cerrar ni con el avatar, ni con un clic fuera, ni con Esc.
 *
 * El popover trae de fábrica lo que aquel truco intentaba: se cierra con otro
 * clic en el botón, con un clic en cualquier otro lado y con Esc, devuelve el
 * foco al botón y vive en la capa superior, así que no pelea con ningún z-index.
 *
 * Posición: un popover vive en la capa superior y no puede anclarse con
 * `absolute` a su botón. Se fija bajo la primera fila del encabezado —que es
 * pegajoso y mide 56 px— y a la derecha del contenedor de 72rem, que es donde
 * está el avatar. `100%` y no `100vw`: el segundo cuenta la barra de scroll.
 */
function MenuDeCuenta({ perfil }: { perfil: Perfil }) {
  const nombre = nombreVisible(perfil)
  const equipo = perfil.role === 'admin' || perfil.role === 'superadmin'
  const idMenu = 'menu-de-cuenta'

  return (
    <div className="group/cuenta">
      <button
        type="button"
        popoverTarget={idMenu}
        className="flex cursor-pointer items-center gap-2 rounded-full py-0.5 pr-2.5 pl-0.5 transition-colors select-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        aria-label={`Cuenta de ${nombre}`}
      >
        <Avatar nombre={nombre} tamano={32} />
        <span className="hidden max-w-40 truncate text-sm font-medium md:inline">{nombre}</span>
        <ChevronAbajo />
      </button>

      {/* Sin clase de `display`: pisaría el `display: none` con el que el
          navegador esconde un popover cerrado. */}
      <div
        id={idMenu}
        popover="auto"
        className="inset-auto top-[3.75rem] right-[max(1.25rem,calc((100%-72rem)/2+1.25rem))] m-0 w-64 overflow-hidden rounded-[12px] border border-border bg-card p-0 text-foreground shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)]"
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Avatar nombre={nombre} tamano={36} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{nombre}</span>
            <span className="truncate text-xs text-muted-foreground">{perfil.email}</span>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-xs text-muted-foreground">Rol</span>
          <span
            className={
              equipo
                ? 'rounded-full bg-vadai-lima px-2 py-0.5 text-[11px] font-medium text-vadai-navy'
                : 'text-xs font-medium'
            }
          >
            {perfil.role}
          </span>
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-2">
          <span className="text-xs text-muted-foreground">Tema</span>
          <CambiarTema />
        </div>

        <div className="border-t border-border px-2 py-2">
          <BotonSalir variante="menu" />
        </div>
      </div>
    </div>
  )
}

function ChevronAbajo() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5 text-muted-foreground transition-transform group-has-[:popover-open]/cuenta:rotate-180"
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
