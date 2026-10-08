// v2 · genera las composiciones v2 en los dos formatos desde una plantilla por versión:
//   v2-2d.html / v2-2d-v.html y v2-3d.html / v2-3d-v.html. Mismos módulos; solo cambia el lienzo.
//   node scripts/v2-html.mjs
import { writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// la duración sale de v2/tiempos.js (voz + acorde final): nunca fija aquí (ERRORES E31)
import { DURACION as DUR } from "../v2/tiempos.js";

const html2d = ({ W, H, V, archivo }) => `<!doctype html>
<html lang="es" data-resolution="${V ? "portrait" : "landscape"}" data-composition-variables='[{"id":"cierre","type":"string","label":"Cierre","default":"platica"}]'>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <!-- GENERADO por scripts/v2-html.mjs: no se edita a mano. v2 · 2D «Un solo trazo» · ${V ? "vertical" : "horizontal"} ${W}×${H}.
         Orden fijo (ERRORES E2, E3, E5): semilla → espera de construcción → gsap → plugins → gsap.js → timeline → módulo. -->
    <script src="./estilo/semilla.js"></script>
    <script>
      window.__hf = window.__hf || {};
      window.__hf.buildReady = window.__hf.buildReady || {};
      window.__hf.buildReady["trazo"] = new Promise((ok, mal) => { window.__trazoListo = ok; window.__trazoFallo = mal; });
    </script>
    <script src="./vendor/gsap/gsap.min.js"></script>
    <script src="./vendor/gsap/DrawSVGPlugin.min.js"></script>
    <script src="./estilo/gsap.js"></script>
    <link rel="stylesheet" href="./estilo/tokens.css" />
    <style>
      @font-face { font-family: "Anton"; src: url("./assets/fonts/Anton-Regular.ttf") format("truetype"); font-weight: 400; font-display: block; }
      @font-face { font-family: "Inter"; src: url("./assets/fonts/Inter-Variable.ttf") format("truetype"); font-weight: 100 900; font-display: block; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: var(--navy); }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; background: var(--navy); }
      #lienzo, #tipo { position: absolute; inset: 0; }
      #lienzo svg { position: absolute; inset: 0; width: ${W}px; height: ${H}px; display: block; }
      .fuente { position: absolute; font-family: "Inter"; font-weight: 500; font-size: 22px; font-style: italic; color: var(--hueso); white-space: nowrap; }
      .contador { position: absolute; font-family: "Anton"; font-size: 190px; line-height: 1; color: var(--cieloClaro); white-space: nowrap; }
      .burbuja { position: absolute; font-family: "Inter"; font-weight: 500; color: var(--navy); padding: 12px 18px 14px; border-radius: 18px; white-space: nowrap; opacity: 0; }
      .burbuja.entra { background: var(--blanco); border-top-left-radius: 4px; }
      .burbuja.sale { background: var(--hueso); border-top-right-radius: 4px; }
      .burbuja .de { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 700; color: var(--cieloHondo); margin-bottom: 4px; }
      .burbuja .msg { font-size: 26px; line-height: 1.25; }
      .burbuja .palomas { display: inline-block; vertical-align: -1px; margin-left: 8px; color: #8696A0; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${DUR}" data-width="${W}" data-height="${H}" data-fps="60">
      <div id="lienzo" class="clip" data-start="0" data-duration="${DUR}" data-track-index="1">
        <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">
          <defs>
            <filter id="brillo" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <radialGradient id="halo-a"><stop offset="0" stop-color="#00A0DB" stop-opacity="0.16" /><stop offset="1" stop-color="#00A0DB" stop-opacity="0" /></radialGradient>
            <radialGradient id="halo-b"><stop offset="0" stop-color="#006E96" stop-opacity="0.22" /><stop offset="1" stop-color="#006E96" stop-opacity="0" /></radialGradient>
            <radialGradient id="halo-rojo"><stop offset="0" stop-color="#FF5A5F" stop-opacity="0.26" /><stop offset="1" stop-color="#FF5A5F" stop-opacity="0" /></radialGradient>
            <radialGradient id="viñeta" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stop-color="#050E1A" stop-opacity="0" /><stop offset="1" stop-color="#050E1A" stop-opacity="0.55" /></radialGradient>
            <linearGradient id="cielo" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="${H}"><stop offset="0" stop-color="#4FC6EE" /><stop offset="1" stop-color="#006E96" /></linearGradient>
            <filter id="grano" x="0" y="0" width="100%" height="100%">
              <feTurbulence id="grano-ruido" type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="1" stitchTiles="stitch" />
              <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.9 0" />
            </filter>
          </defs>
          <g id="fondo">
            <rect width="${W}" height="${H}" fill="#0A1A2F" />
            <circle id="halo1" cx="${W * 0.27}" cy="${H * 0.28}" r="${Math.max(W, H) * 0.4}" fill="url(#halo-a)" />
            <circle id="halo2" cx="${W * 0.77}" cy="${H * 0.76}" r="${Math.max(W, H) * 0.43}" fill="url(#halo-b)" />
          </g>
          <g id="polvo"></g>
          <g id="escena"></g>
          <g id="telon"></g>
          <g id="letras"></g>
          <g id="glitch"></g>
          <g id="fijo"></g>
          <rect width="${W}" height="${H}" fill="url(#viñeta)" />
          <rect width="${W}" height="${H}" filter="url(#grano)" opacity="0.055" />
        </svg>
      </div>
      <div id="tipo" class="clip" data-start="0" data-duration="${DUR}" data-track-index="2"></div>
      <audio id="mezcla-master" src="./assets/v2/mezcla/master-2d-platica-previa.m4a" data-start="0" data-duration="${DUR}" data-track-index="3" data-volume="1"></audio>
    </div>

    <script>
      const tl = gsap.timeline({ paused: true });
      tl.set({}, {}, ${DUR});
      window.__tl = tl;
      window.__timelines["main"] = tl;
    </script>

    <script type="module">
      import { parse } from "./vendor/opentype/opentype.mjs";
      import { CHISPA_SVG } from "./estilo/ui.js";
      import { tiempos } from "./v2/tiempos.js";
      import { cues } from "./v2/cues.js";
      import { crearCamara, crearChispa, crearGlitch, azar, el, K } from "./v2/2d/trazo.js";
      import * as apertura from "./v2/2d/apertura.js";
      import * as medio from "./v2/2d/medio.js";
      import * as cierreM from "./v2/2d/cierre.js";

      const DUR = ${DUR}, W = ${W}, H = ${H}, V = ${V};
      const tl = window.__tl;
      let cierre = "platica";
      try { const v = window.__hyperframes && window.__hyperframes.getVariables ? window.__hyperframes.getVariables() : null; if (v && v.cierre) cierre = v.cierre; } catch (e) {}
      // reloj: cada rutina corre SIEMPRE con su tiempo acotado a su tramo (ERRORES E12, E17)
      const rutinas = [];
      const reloj = (desde, hasta, fn) => rutinas.push({ desde, hasta, fn });
      let listo = false;
      const $ = (id) => document.getElementById(id);
      const ruido = $("grano-ruido"), h1 = $("halo1"), h2 = $("halo2");
      function pintar(t) {
        if (!listo) return;
        for (const r of rutinas) r.fn(Math.min(Math.max(t, r.desde), r.hasta - 1e-4));
        ruido.setAttribute("seed", String(1 + (Math.floor(t * 30) % 997)));
        h1.setAttribute("cx", (W * 0.27 + 140 * Math.sin(t * 0.13)).toFixed(1)); h1.setAttribute("cy", (H * 0.28 + 90 * Math.cos(t * 0.11)).toFixed(1));
        h2.setAttribute("cx", (W * 0.77 - 120 * Math.sin(t * 0.09)).toFixed(1)); h2.setAttribute("cy", (H * 0.76 - 80 * Math.cos(t * 0.15)).toFixed(1));
      }
      (async () => {
        await document.fonts.load('500 22px "Inter"');
        await document.fonts.load('italic 500 22px "Inter"');
        await document.fonts.load('700 26px "Inter"');
        await document.fonts.load('190px "Anton"');
        const fuente = parse(await (await fetch("./assets/fonts/Anton-Regular.ttf")).arrayBuffer());
        // las imágenes se decodifican antes de construir: un cuadro nunca debe ver un logo a medio cargar
        await Promise.all(["excel.svg", "powerpoint.svg", "higgsfield.svg"].map((f) => "./assets/marca/herramientas/" + f).concat(["./assets/marca/vadai-horizontal-recorte.png", "./assets/marca/totalcoach-recorte.png"])
          .map((src) => { const i = new Image(); i.src = src; return i.decode(); }));
        const T = await tiempos(cierre);
        const { C } = cues(T, "2d");
        const tipo = $("tipo");
        const dom = (tag, cls, txt) => { const n = document.createElement(tag); n.className = cls; if (txt) n.textContent = txt; tipo.appendChild(n); return n; };
        const escena = $("escena");
        const CHISPA_D = CHISPA_SVG().match(/ d="([^"]+)"/)[1];
        const cam = crearCamara(escena, reloj, W, H);
        const chispa = crearChispa({ escena, reloj, CHISPA_D });
        const glitch = crearGlitch({ padre: $("glitch"), reloj, W, H });
        const ctx = { tl, C, T, fuente, reloj, dom, cam, chispa, glitch, V, W, H, CHISPA_D,
          capas: { escena, letras: $("letras"), fijo: $("fijo"), telon: $("telon") } };
        apertura.montar(ctx);
        medio.montar(ctx);
        cierreM.montar(ctx);
        // polvo: profundidad; se mueve con la cámara a un cuarto de su velocidad (paralaje)
        const polvo = $("polvo"), rp = azar(31), motas = [];
        for (let i = 0; i < 90; i++) motas.push({ c: el("circle", { r: (1 + rp() * 1.6).toFixed(2), fill: K("cieloClaro"), opacity: (0.12 + rp() * 0.35).toFixed(2) }, polvo), x: rp() * W * 1.3 - W * 0.15, y: rp() * H, v: 6 + rp() * 16, f: rp() * 6.28 });
        reloj(0, 999, (t) => {
          const v = cam.en(t);
          for (const m of motas) {
            const y = ((m.y - t * m.v) % H + H) % H;
            m.c.setAttribute("cx", (m.x + 10 * Math.sin(t * 0.3 + m.f)).toFixed(1)); m.c.setAttribute("cy", y.toFixed(1));
          }
          const s = 1 + (v.s - 1) * 0.12;
          polvo.setAttribute("transform", \`translate(\${(W / 2 - (v.x - W / 2) * 0.25).toFixed(1)} \${(H / 2 - (v.y - H / 2) * 0.25).toFixed(1)}) scale(\${Math.min(s, 3).toFixed(4)}) translate(\${-W / 2} \${-H / 2})\`);
        });
        cam.montar();
        chispa.montar();
        const R = { t: 0 };
        tl.fromTo(R, { t: 0 }, { t: DUR, duration: DUR, ease: "none", modifiers: { t: (v) => { pintar(+v); return v; } } }, 0);
        listo = true;
        pintar(tl.time());
      })().then(window.__trazoListo, (e) => { console.error("trazo: no se construyó", e); window.__trazoFallo(e); });
      window.addEventListener("hf-seek", (e) => pintar(e.detail.time));
    </script>
  </body>
</html>
`;

const html3d = ({ W, H, V }) => `<!doctype html>
<html lang="es" data-resolution="${V ? "portrait" : "landscape"}" data-formato="${V ? "v" : "h"}" data-composition-variables='[{"id":"cierre","type":"string","label":"Cierre","default":"platica"},{"id":"capas","type":"string","label":"Capas","default":"limpio"}]'>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <!-- GENERADO por scripts/v2-html.mjs: no se edita a mano. v2 · 3D · ${V ? "vertical" : "horizontal"} ${W}×${H}.
         Orden fijo (ERRORES E2, E3, E5): semilla → espera del mundo → gsap → gsap.js → timeline → módulos. -->
    <script src="./estilo/semilla.js"></script>
    <script>
      window.__hf = window.__hf || {};
      window.__hf.buildReady = window.__hf.buildReady || {};
      window.__hf.buildReady["mundo"] = new Promise((ok, mal) => { window.__mundoListo = ok; window.__mundoFallo = mal; });
    </script>
    <script src="./vendor/gsap/gsap.min.js"></script>
    <script src="./estilo/gsap.js"></script>
    <script type="importmap">
      { "imports": { "three": "./vendor/three/build/three.module.js", "three/addons/": "./vendor/three/addons/", "postprocessing": "./vendor/postprocessing/index.js" } }
    </script>
    <link rel="stylesheet" href="./estilo/tokens.css" />
    <link rel="stylesheet" href="./v2/3d/base.css" />
    <link rel="stylesheet" href="./v2/3d/v2.css" />
    <style>
      @font-face { font-family: "Anton"; src: url("./assets/fonts/Anton-Regular.ttf") format("truetype"); font-weight: 400; font-display: block; }
      @font-face { font-family: "Inter"; src: url("./assets/fonts/Inter-Variable.ttf") format("truetype"); font-weight: 100 900; font-display: block; }
      @font-face { font-family: "JetBrains Mono"; src: url("./assets/fonts/JetBrainsMono-Variable.ttf") format("truetype"); font-weight: 100 800; font-display: block; }
      html, body { width: ${W}px; height: ${H}px; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${DUR}" data-width="${W}" data-height="${H}" data-fps="60">
      <canvas id="gl"></canvas>
      <div id="tipo" class="clip" data-start="0" data-duration="${DUR}" data-track-index="1"></div>
      <audio id="mezcla-master" src="./assets/v2/mezcla/master-3d-platica-previa.m4a" data-start="0" data-duration="${DUR}" data-track-index="3" data-volume="1"></audio>
    </div>

    <script>
      const tl = gsap.timeline({ paused: true });
      tl.set({}, {}, ${DUR});
      window.__tl = tl;
      window.__timelines["main"] = tl;
    </script>

    <script type="module">
      import * as THREE from "three";
      import { crearMundo } from "./estilo/mundo.js";
      import * as UI from "./estilo/ui.js";
      import { crearEscena } from "./mundo/escena.js";
      import { crearDirector } from "./mundo/director.js";
      import { tiempos } from "./v2/tiempos.js";
      import { cues } from "./v2/cues.js";
      import * as apertura from "./v2/3d/apertura.js";
      import * as medio from "./v2/3d/medio.js";
      import * as cierreM from "./v2/3d/cierre.js";
      import * as finalM from "./v2/3d/final.js";

      const W = ${W}, H = ${H}, V = ${V};
      // fov vertical equivalente: en vertical, el ANCHO del cuadro ve lo que el ALTO del horizontal
      const F = (f) => (V ? (2 * Math.atan(Math.tan((f * Math.PI) / 360) * (16 / 9)) * 180) / Math.PI : f);
      const tl = window.__tl;
      let cierre = "platica", capas = "limpio";
      try { const v = window.__hyperframes && window.__hyperframes.getVariables ? window.__hyperframes.getVariables() : null; if (v) { cierre = v.cierre || cierre; capas = v.capas || capas; } } catch (e) {}
      document.documentElement.dataset.capas = capas;
      const mundo = crearMundo(document.getElementById("gl"), { ancho: W, alto: H });
      const dir = crearDirector(mundo);
      mundo.renderer.domElement.addEventListener("webglcontextlost", () => window.__mundoFallo(new Error("mundo: se perdió el contexto WebGL")));
      let listo = false;
      const posDom = [];
      function renderAt(t) {
        if (!listo) return;
        dir.aplicar(t);
        const f = dir.enfoque(t);
        mundo.enfocar(f.punto, f.rango);
        mundo.pintar(t, (T) => dir.aplicar(T), dir.muestras(t));
        dir.aplicar(t);
        mundo.camara.updateMatrixWorld();
        for (const fn of posDom) fn(t);
      }
      (async () => {
        await document.fonts.load('500 64px "Inter"');
        await document.fonts.load('600 64px "Inter"');
        await document.fonts.load('64px "Anton"');
        await document.fonts.load('400 30px "JetBrains Mono"');
        const T = await tiempos(cierre);
        const { C } = cues(T, "3d");
        const s = await crearEscena(mundo);
        mundo.fondo = s.fondo;
        dir.cada(0, 999, (t) => s.vivir(t));
        const ctx = {
          THREE, mundo, s, dir, tl, escena: mundo.escena, raiz: document.getElementById("tipo"), T, C, cierre, V, W, H, F,
          ui: UI, proyectar: (v) => mundo.proyectar(v), colocar: UI.colocar, sacudidas: [],
          dom(desde, hasta, fn) { posDom.push((t) => { if (t >= desde && t < hasta) fn(t); }); },
        };
        apertura.montar(ctx);
        medio.montar(ctx);
        cierreM.montar(ctx);
        finalM.montar(ctx);
        // sacudidas de cámara (con semilla, decaen): se suman después de que el director pone la cámara
        dir.cada(0, 999, (t) => {
          let dx = 0, dy = 0;
          for (const z of ctx.sacudidas) {
            const u = (t - z.t) / z.dur;
            if (u < 0 || u > 1) continue;
            const a = z.amp * Math.pow(1 - u, 2);
            dx += a * Math.sin(t * 97.3 + z.t * 13.1); dy += a * Math.cos(t * 83.7 + z.t * 7.7);
          }
          mundo.camara.position.x += dx; mundo.camara.position.y += dy;
        });
        dir.preparar();
        listo = true;
        renderAt(window.__hfThreeTime || 0);
      })().then(window.__mundoListo, (e) => { console.error("mundo: no se construyó", e); window.__mundoFallo(e); });
      window.addEventListener("hf-seek", (e) => renderAt(e.detail.time));
    </script>
  </body>
</html>
`;

for (const f of [{ W: 1920, H: 1080, V: false, archivo: "v2-2d.html" }, { W: 1080, H: 1920, V: true, archivo: "v2-2d-v.html" }]) {
  writeFileSync(join(raiz, f.archivo), html2d(f));
  console.log("escrito", f.archivo);
}
for (const f of [{ W: 1920, H: 1080, V: false, archivo: "v2-3d.html" }, { W: 1080, H: 1920, V: true, archivo: "v2-3d-v.html" }]) {
  writeFileSync(join(raiz, f.archivo), html3d(f));
  console.log("escrito", f.archivo);
}
