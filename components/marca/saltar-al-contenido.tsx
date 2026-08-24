/**
 * Enlace de salto, primero en el orden de tabulación.
 *
 * Sin esto, quien navega con teclado tiene que pasar por toda la navegación del
 * encabezado —logo, cuatro enlaces, tema, salir— antes de llegar al contenido,
 * y eso en CADA página. Con el enlace, un tabulador y un enter.
 *
 * Está oculto hasta que recibe foco, que es como debe comportarse: no estorba a
 * quien no lo necesita y aparece justo cuando alguien tabula.
 */
export function SaltarAlContenido({ destino = '#contenido' }: { destino?: string }) {
  return (
    <a
      href={destino}
      className="sr-only rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      Saltar al contenido
    </a>
  )
}
