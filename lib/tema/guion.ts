/**
 * El script que fija el tema antes del primer pintado.
 *
 * Vive como cadena porque se inyecta inline en el <head> (ver app/layout.tsx).
 * No puede ser un componente ni un efecto: para cuando React hidrata, la página
 * ya se pintó, y quien eligió un tema distinto al de su sistema habría visto el
 * otro durante un instante.
 *
 * Ojo con lo que este script NO hace: no decide el tema por defecto. El default
 * es el CLARO y lo fija el CSS con `color-scheme: light`. Por eso la plataforma
 * se ve bien incluso con JavaScript desactivado — este script solo aplica la
 * ELECCIÓN guardada, que es lo único que el CSS no puede saber.
 */

export const LLAVE_TEMA = 'vadai-tema'

export type Tema = 'claro' | 'oscuro'

/**
 * El color de la barra de estado del teléfono por tema (22-oct-2026). Con la
 * app instalada (app/manifest.ts) esa barra es parte de la app: en oscuro, una
 * franja clara arriba de la página navy se ve rota. El layout publica el claro
 * en `themeColor`; el guion y `CambiarTema` lo cambian al elegir oscuro.
 */
export const COLOR_BARRA: Record<Tema, string> = { claro: '#f5f8fb', oscuro: '#0a1a2f' }

/** Pinta la barra de estado del tema elegido. Del lado del navegador. */
export function pintarBarra(tema: Tema): void {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLOR_BARRA[tema])
}

/**
 * Minificado a mano y envuelto en try/catch.
 *
 * El try/catch no sobra: `localStorage` lanza en navegación privada de algunos
 * navegadores y con el almacenamiento de terceros bloqueado. Sin él, una
 * excepción aquí —en un script síncrono del <head>— dejaría la página a medio
 * pintar.
 */
export const GUION_TEMA = `(function(){try{
if(localStorage.getItem('${LLAVE_TEMA}')==='oscuro'){
document.documentElement.classList.add('dark');
var b=function(){var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content','${COLOR_BARRA.oscuro}')};
b();document.addEventListener('DOMContentLoaded',b);
}
}catch(_){}})();`
