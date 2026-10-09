// Propuesta 3 «La escalera infinita» · genera las composiciones desde una plantilla.
//   node scripts/v3e-html.mjs            → v3e-rebanada.html (0–31.5 s de la plática, horizontal)
// Capas (de abajo arriba): fondo CSS (degradado + luz) · lienzo WebGL transparente (el mundo) ·
// #tipo (texto editorial y el sticker en la cámara) · grano. Vertical: lienzo de 1088 (ERRORES E41).
import { writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = ({ W, H, V, cierre, DUR, audio }) => {
  const WR = V ? 1088 : W;
  return `<!doctype html>
<html lang="es" data-resolution="${V ? "portrait" : "landscape"}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${WR}, height=${H}" />
<!-- GENERADO por scripts/v3e-html.mjs: no se edita a mano. Propuesta 3 «La escalera infinita» · ${cierre} · ${V ? "vertical" : "horizontal"}. -->
<script src="./estilo/semilla.js"></script>
<script>
  window.__hf = window.__hf || {}; window.__hf.buildReady = window.__hf.buildReady || {};
  window.__hf.buildReady["escalera"] = new Promise((ok, mal) => { window.__escOk = ok; window.__escMal = mal; });
</script>
<script src="./vendor/gsap/gsap.min.js"></script>
<script src="./estilo/gsap.js"></script>
<script type="importmap">{ "imports": { "three": "./vendor/three/build/three.module.js", "three/addons/": "./vendor/three/addons/" } }</script>
<style>
  @font-face { font-family: "Inter"; src: url("./assets/fonts/Inter-Variable.ttf") format("truetype"); font-weight: 100 900; font-display: block; }
  @font-face { font-family: "Instrument Serif"; src: url("./assets/fonts/InstrumentSerif-Italic.ttf") format("truetype"); font-style: italic; font-weight: 400; font-display: block; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${WR}px; height: ${H}px; overflow: hidden; background: #E8EFF5; }
  #root { position: relative; width: 100%; height: 100%; overflow: hidden; background: #E8EFF5; }
  #fondo { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; background: radial-gradient(120% 90% at 50% 38%, #F6F9FC 0%, #E9F0F6 52%, #D7E3EE 100%); }
  #gl { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; }
  #tipo { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; perspective: 1400px; }
  #grano { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; pointer-events: none; opacity: 0.045; mix-blend-mode: multiply; }
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${DUR}" data-width="${WR}" data-height="${H}" data-fps="60">
  <div id="fondo"></div>
  <canvas id="gl" width="${W}" height="${H}"></canvas>
  <div id="tipo" class="clip" data-start="0" data-duration="${DUR}" data-track-index="1"></div>
  <svg id="grano" width="${W}" height="${H}"><filter id="gr"><feTurbulence id="gr-ruido" type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="1" stitchTiles="stitch" /><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0.05  0 0 0 0 0.12  0 0 0 1 0" /></filter><rect width="${W}" height="${H}" filter="url(#gr)" /></svg>
  <audio id="mezcla-master" src="./assets/v2/mezcla/${audio}" data-start="0" data-duration="${DUR}" data-track-index="3" data-volume="1"></audio>
</div>
<script>
  const tl = gsap.timeline({ paused: true });
  tl.set({}, {}, ${DUR});
  window.__tl = tl; window.__timelines["main"] = tl;
</script>
<script type="module">
  import { tiempos } from "./v2/tiempos.js";
  import { crearMundo } from "./v3/escalera/mundo.js";
  import * as apertura from "./v3/escalera/apertura.js";

  const W = ${W}, H = ${H}, V = ${V}, DUR = ${DUR};
  const tl = window.__tl;
  const $ = (id) => document.getElementById(id);
  (async () => {
    await document.fonts.load('600 54px "Inter"'); await document.fonts.load('800 60px "Inter"'); await document.fonts.load('italic 60px "Instrument Serif"');
    const T = await tiempos("${cierre}");
    const m = crearMundo($("gl"), { ancho: W, alto: H });
    const ctx = { m, T, tl, raiz: $("tipo"), W, H, V, cierre: "${cierre}" };
    const ap = apertura.montar(ctx);
    const ruido = $("gr-ruido");
    function pintar(t0) {
      const t = Math.round(t0 * 60) / 60;      // al cuadro: mismo resultado en todos los workers
      ap.pintar(t);
      m.pintar();
      ruido.setAttribute("seed", String(1 + (Math.floor(t * 30) % 997)));
    }
    const R = { t: 0 };
    tl.fromTo(R, { t: 0 }, { t: DUR, duration: DUR, ease: "none", modifiers: { t: (x) => { pintar(+x); return x; } } }, 0);
    window.addEventListener("hf-seek", (e) => pintar(e.detail.time));
    pintar(tl.time());
  })().then(window.__escOk, (e) => { console.error("escalera: no se construyó", e); window.__escMal(e); });
</script>
</body>
</html>
`;
};
const archivos = [
  { archivo: "v3e-rebanada.html", W: 1920, H: 1080, V: false, cierre: "platica", DUR: 31.5, audio: "master-v3e-platica-previa.m4a" },
];
for (const f of archivos) { writeFileSync(join(raiz, f.archivo), html(f)); console.log("escrito", f.archivo); }
