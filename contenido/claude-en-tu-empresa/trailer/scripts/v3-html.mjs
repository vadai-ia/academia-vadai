// v3 · genera las composiciones de «La interfaz viva» (Propuesta 3) desde una plantilla:
//   v3-platica.html / v3-platica-v.html · v3-curso.html / v3-curso-v.html · v3-rebanada.html (0–31.5 s)
//   node scripts/v3-html.mjs
// Capas (de abajo arriba): canvas WebGL (aurora + vidrio líquido) · #pagina (la página larga que recorre la
// cámara) · #fijo (la gota y lo que vive en pantalla) · grano. Vertical: lienzo de 1088 (ERRORES E41).
import { writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DURACIONES } from "../v2/tiempos.js";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = ({ W, H, V, cierre, DUR, audio }) => {
  const WR = V ? 1088 : W;
  return `<!doctype html>
<html lang="es" data-resolution="${V ? "portrait" : "landscape"}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${WR}, height=${H}" />
<!-- GENERADO por scripts/v3-html.mjs: no se edita a mano. Propuesta 3 «La interfaz viva» · ${cierre} · ${V ? "vertical" : "horizontal"}. -->
<script src="./estilo/semilla.js"></script>
<script>
  window.__hf = window.__hf || {}; window.__hf.buildReady = window.__hf.buildReady || {};
  window.__hf.buildReady["v3"] = new Promise((ok, mal) => { window.__v3ok = ok; window.__v3mal = mal; });
</script>
<script src="./vendor/gsap/gsap.min.js"></script>
<script src="./estilo/gsap.js"></script>
<link rel="stylesheet" href="./estilo/tokens.css" />
<style>
  @font-face { font-family: "Anton"; src: url("./assets/fonts/Anton-Regular.ttf") format("truetype"); font-weight: 400; font-display: block; }
  @font-face { font-family: "Inter"; src: url("./assets/fonts/Inter-Variable.ttf") format("truetype"); font-weight: 100 900; font-display: block; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${WR}px; height: ${H}px; overflow: hidden; background: #071526; }
  #root { position: relative; width: 100%; height: 100%; overflow: hidden; background: #071526; }
  #gl, #vista, #fijo { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; }
  #vista { overflow: hidden; }
  #pagina { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H * 12}px; transform-origin: 0 0; }
  #grano { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; pointer-events: none; opacity: 0.05; }
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${DUR}" data-width="${WR}" data-height="${H}" data-fps="60">
  <canvas id="gl" width="${W}" height="${H}"></canvas>
  <div id="vista" class="clip" data-start="0" data-duration="${DUR}" data-track-index="1"><div id="pagina"></div></div>
  <div id="fijo" class="clip" data-start="0" data-duration="${DUR}" data-track-index="2"></div>
  <svg id="grano" width="${W}" height="${H}"><filter id="gr"><feTurbulence id="gr-ruido" type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="1" stitchTiles="stitch" /><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.9 0" /></filter><rect width="${W}" height="${H}" filter="url(#gr)" /></svg>
  <svg width="0" height="0" style="position:absolute"><filter id="rgb" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
    <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" /><feOffset id="rgb-r" in="r" dx="0" dy="0" result="r2" />
    <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="gb" /><feOffset id="rgb-b" in="gb" dx="0" dy="0" result="gb2" />
    <feBlend in="r2" in2="gb2" mode="screen" /></filter></svg>
  <audio id="mezcla-master" src="./assets/v2/mezcla/${audio}" data-start="0" data-duration="${DUR}" data-track-index="3" data-volume="1"></audio>
</div>
<script>
  const tl = gsap.timeline({ paused: true });
  tl.set({}, {}, ${DUR});
  window.__tl = tl; window.__timelines["main"] = tl;
</script>
<script type="module">
  import { tiempos } from "./v2/tiempos.js";
  import { cues } from "./v2/cues.js";
  import { CHISPA_SVG } from "./estilo/ui.js";
  import { crearVidrio } from "./v3/vidrio.js";
  import { liquido, MARCA } from "./v3/materiales.js";
  import { crearMotor, tramo, azar } from "./v3/motor.js";
  import * as apertura from "./v3/apertura.js";

  const W = ${W}, H = ${H}, V = ${V}, DUR = ${DUR};
  const tl = window.__tl;
  const $ = (id) => document.getElementById(id);
  (async () => {
    await document.fonts.load('200px "Anton"'); await document.fonts.load('800 30px "Inter"'); await document.fonts.load('600 30px "Inter"');
    const T = await tiempos("${cierre}"), { C } = cues(T, "2d");
    const motor = crearMotor({ W, H });
    const vidrio = crearVidrio($("gl"), W, H);
    const pagina = $("pagina"), fijo = $("fijo");
    const q = (h, v) => (V ? v : h);
    const CHISPA_D = CHISPA_SVG().match(/ d="([^"]+)"/)[1];
    // la gota: la chispa de Claude en vidrio líquido, en la capa fija (pantalla); tramos como la 2D
    const GS = 130;
    const gotaEl = document.createElement("div"); Object.assign(gotaEl.style, { position: "absolute", left: "0", top: "0", width: GS + "px", height: GS + "px" }); fijo.appendChild(gotaEl);
    liquido(gotaEl, { x: 0, y: 0, w: GS, h: GS, forma: "chispa", path: CHISPA_D, escalaPath: GS / 24, fuerza: 55, nucleo: MARCA.durazno });
    const tramos = [];
    const gota = { tramo(desde, hasta, f) { tramos.push({ desde, hasta, f }); } };
    // máscaras del vidrio líquido del shader (se dibujan cada cuadro en coordenadas de pantalla)
    const mascaras = [];
    const glMascara = (fn) => mascaras.push(fn);
    // glitch de la página: aberración cromática + saltos, en ventanas cortas
    let glitches = [];
    const ctx = { tl, C, T, W, H, V, q, pagina, fijo, motor, gota, glMascara, CHISPA_D, glitch: (l) => { glitches = glitches.concat(l); } };
    apertura.montar(ctx);
    tramos.sort((a, b) => a.desde - b.desde);
    const AURORA = { fondo: "#071526", velo: "#4FC6EE", focos: [{ x: 0.5, y: 0.55, r: 0.45, f: 0.9, color: "#00557A" }, { x: 0.82, y: 0.25, r: 0.3, f: 0.7, color: "#0092C8" }, { x: 0.15, y: 0.2, r: 0.25, f: 0.45, color: "#123A66" }, { x: 0.2, y: 0.9, r: 0.18, f: 0.25, color: "#C6F24E" }] };
    const ruido = $("gr-ruido"), rR = $("rgb-r"), rB = $("rgb-b");
    function pintar(t0) {
      const t = motor.pintar(t0);
      const v = motor.cam.en(t);
      pagina.style.transform = \`translate(\${(W / 2).toFixed(2)}px, \${(H / 2).toFixed(2)}px) scale(\${v.s.toFixed(4)}) translate(\${(-v.x - W / 2).toFixed(2)}px, \${(-v.y - H / 2).toFixed(2)}px)\`;
      // la gota
      let tr = tramos[0]; for (const x of tramos) if (t >= x.desde) tr = x;
      const g = tr ? tr.f(Math.min(t, tr.hasta)) : { x: -999, y: -999, s: 0 };
      gotaEl.style.transform = \`translate(\${(g.x - GS / 2).toFixed(1)}px, \${(g.y - GS / 2).toFixed(1)}px) rotate(\${(t * 40).toFixed(1)}deg) scale(\${Math.max(0.001, g.s).toFixed(3)})\`;
      gotaEl.style.opacity = g.s < 0.01 ? 0 : 1;
      // glitch
      const gl = glitches.find((z) => t >= z.t && t < z.t + z.dur);
      if (gl) { const k = Math.floor(t * 30), r = azar(k * 7919 + 3); rR.setAttribute("dx", ((r() - 0.3) * gl.amp).toFixed(1)); rB.setAttribute("dx", (-(r() - 0.3) * gl.amp).toFixed(1)); $("vista").style.filter = "url(#rgb)"; $("vista").style.transform = \`translateX(\${((r() - 0.5) * gl.amp).toFixed(1)}px)\`; }
      else { $("vista").style.filter = "none"; $("vista").style.transform = "none"; }
      // aurora + vidrio líquido
      const m = vidrio.mascara; m.clearRect(0, 0, vidrio.w, vidrio.h); m.fillStyle = "#fff"; m.strokeStyle = "#fff";
      for (const f of mascaras) f(m, t, vidrio.escala);
      AURORA.focos[0].x = 0.5 + 0.06 * Math.sin(t * 0.3); AURORA.focos[1].y = 0.25 + 0.05 * Math.cos(t * 0.25);
      vidrio.pintar(t, { aurora: AURORA, tinte: 0.28, realce: 0.22 });
      ruido.setAttribute("seed", String(1 + (Math.floor(t * 30) % 997)));
    }
    await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
    const R = { t: 0 };
    tl.fromTo(R, { t: 0 }, { t: DUR, duration: DUR, ease: "none", modifiers: { t: (x) => { pintar(+x); return x; } } }, 0);
    window.addEventListener("hf-seek", (e) => pintar(e.detail.time));
    pintar(tl.time());
  })().then(window.__v3ok, (e) => { console.error("v3: no se construyó", e); window.__v3mal(e); });
</script>
</body>
</html>
`;
};
const archivos = [
  { archivo: "v3-rebanada.html", W: 1920, H: 1080, V: false, cierre: "platica", DUR: 31.5, audio: "master-v3-platica-previa.m4a" },
];
for (const f of archivos) { writeFileSync(join(raiz, f.archivo), html(f)); console.log("escrito", f.archivo); }
