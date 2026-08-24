/**
 * El script que fija el tema antes del primer pintado.
 *
 * Vive como cadena porque se inyecta inline en el <head> (ver app/layout.tsx).
 * No puede ser un componente ni un efecto: para cuando React hidrata, la página
 * ya se pintó, y quien eligió un tema distinto al de su sistema habría visto el
 * otro durante un instante.
 *
 * Ojo con lo que este script NO hace: no decide el tema por defecto. Eso lo
 * resuelve `light-dark()` en el CSS a partir del `color-scheme`, que sin clase
 * vale `light dark` y sigue al sistema. Por eso la plataforma se ve bien
 * incluso con JavaScript desactivado — este script solo aplica la ELECCIÓN
 * guardada, que es lo único que el CSS no puede saber.
 */

export const LLAVE_TEMA = 'vadai-tema'

export type Tema = 'claro' | 'oscuro'

/**
 * Minificado a mano y envuelto en try/catch.
 *
 * El try/catch no sobra: `localStorage` lanza en navegación privada de algunos
 * navegadores y con el almacenamiento de terceros bloqueado. Sin él, una
 * excepción aquí —en un script síncrono del <head>— dejaría la página a medio
 * pintar.
 */
export const GUION_TEMA = `(function(){try{
var g=localStorage.getItem('${LLAVE_TEMA}');
if(g==='oscuro'||g==='claro'){
document.documentElement.classList.add(g==='oscuro'?'dark':'light');
}
}catch(_){}})();`
