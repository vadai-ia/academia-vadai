// v3 · «La interfaz viva»: los materiales de las tendencias, como recetas DOM/CSS/SVG deterministas.
//   vidrio (glassmorphism) · liquido (liquid glass: refracta LO QUE TENGA DETRÁS, también la interfaz) ·
//   neu (neumorfismo) · bruto / sticker (neo-brutalismo) · arcilla (claymorphism) · etiqueta (UI espacial)
// Probado en render real (11-oct): backdrop-filter con blur y con url(#filtro SVG de desplazamiento) sí
// se capturan igual que en el navegador.
export const MARCA = { navy: "#0A1A2F", navyHondo: "#0C2137", hueso: "#EAF4FA", blanco: "#FFFFFF", azul: "#00A0DB", cieloClaro: "#4FC6EE", cieloHondo: "#006E96", lima: "#C6F24E", durazno: "#FFB489", gris: "#4E6572", rojo: "#FF5A5F" };

let nId = 0;
const css = (n, o) => { for (const [k, v] of Object.entries(o)) n.style[k] = v; return n; };
export function caja(padre, { x = 0, y = 0, w, h, z, clase = "" } = {}) {
  const n = document.createElement("div");
  if (clase) n.className = clase;
  css(n, { position: "absolute", left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
  if (z != null) n.style.zIndex = z;
  padre.appendChild(n);
  return n;
}
// mezcla de color en hex: t=0 → a, t=1 → b
export function mezcla(a, b, t) { const p = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)); const A = p(a), B = p(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join(""); }

// ---------- glassmorphism: vidrio esmerilado (desenfoca lo de atrás) ----------
export function vidrio(padre, { x, y, w, h, r = 32, blur = 26, tono = "rgba(255,255,255,0.14)", borde = "rgba(255,255,255,0.45)", z } = {}) {
  const n = caja(padre, { x, y, w, h, z });
  css(n, { borderRadius: `${r}px`, background: `linear-gradient(135deg, ${tono}, rgba(255,255,255,0.04))`, backdropFilter: `blur(${blur}px) saturate(170%)`,
    border: `1.5px solid ${borde}`, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -20px 40px rgba(10,26,47,0.18), 0 30px 60px rgba(5,14,26,0.35)" });
  return n;
}

// ---------- liquid glass: lente que refracta todo lo que tiene detrás ----------
// la forma (círculo, píldora o el path de la chispa de Claude) sale de una máscara desenfocada: su
// gradiente es la normal → mapa de desplazamiento para feDisplacementMap. Brillos y canto encima.
const svgDefs = () => {
  let s = document.getElementById("v3-defs");
  if (!s) { s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.id = "v3-defs"; css(s, { position: "absolute", width: "0", height: "0" }); document.body.appendChild(s); }
  return s;
};
function mapaNormales(w, h, dibujar, suave) {
  const m = document.createElement("canvas"); m.width = w; m.height = h;
  const g = m.getContext("2d"); g.fillStyle = "#fff"; dibujar(g);
  const b = document.createElement("canvas"); b.width = w; b.height = h;
  const gb = b.getContext("2d"); gb.filter = `blur(${suave}px)`; gb.drawImage(m, 0, 0);
  const A = gb.getImageData(0, 0, w, h).data, M = g.getImageData(0, 0, w, h).data;
  const n = document.createElement("canvas"); n.width = w; n.height = h;
  const gn = n.getContext("2d"), im = gn.createImageData(w, h);
  const alto = (x, y) => A[(Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, dx = alto(x + 2, y) - alto(x - 2, y), dy = alto(x, y + 2) - alto(x, y - 2), dentro = M[i] / 255;
    im.data[i] = 128 - 127 * Math.max(-1, Math.min(1, dx * 6)) * dentro; im.data[i + 1] = 128 - 127 * Math.max(-1, Math.min(1, dy * 6)) * dentro; im.data[i + 2] = 128; im.data[i + 3] = 255;
  }
  gn.putImageData(im, 0, 0);
  return n.toDataURL();
}
// nucleo: color del corazón de la gota (la chispa de Claude es durazno): un halo detrás y un degradado adentro
export function liquido(padre, { x, y, w, h, forma = "circulo", path, escalaPath = 1, fuerza = 70, suave, tinte = "rgba(255,255,255,0.06)", nucleo, z } = {}) {
  const id = `liq${++nId}`;
  const traza = (g) => {
    if (forma === "circulo") { g.beginPath(); g.ellipse(w / 2, h / 2, w / 2 - 1, h / 2 - 1, 0, 0, Math.PI * 2); g.fill(); }
    else if (forma === "pildora") { const r = Math.min(w, h) / 2; g.beginPath(); g.roundRect(1, 1, w - 2, h - 2, r); g.fill(); }
    else if (forma === "rect") { g.beginPath(); g.roundRect(1, 1, w - 2, h - 2, 36); g.fill(); }
    else { g.save(); g.scale(escalaPath, escalaPath); g.fill(new Path2D(path)); g.restore(); }
  };
  const f = document.createElementNS("http://www.w3.org/2000/svg", "filter");
  f.setAttribute("id", id); f.setAttribute("x", "0"); f.setAttribute("y", "0"); f.setAttribute("width", "100%"); f.setAttribute("height", "100%"); f.setAttribute("color-interpolation-filters", "sRGB");
  const fi = document.createElementNS("http://www.w3.org/2000/svg", "feImage");
  fi.setAttribute("href", mapaNormales(w, h, traza, suave ?? Math.max(6, Math.min(w, h) * 0.12))); fi.setAttribute("x", 0); fi.setAttribute("y", 0); fi.setAttribute("width", w); fi.setAttribute("height", h); fi.setAttribute("result", "m");
  const fd = document.createElementNS("http://www.w3.org/2000/svg", "feDisplacementMap");
  fd.setAttribute("in", "SourceGraphic"); fd.setAttribute("in2", "m"); fd.setAttribute("scale", fuerza); fd.setAttribute("xChannelSelector", "R"); fd.setAttribute("yChannelSelector", "G");
  f.append(fi, fd); svgDefs().appendChild(f);
  if (nucleo && forma === "chispa") {   // el halo: la misma forma, desenfocada, detrás de la lente
    const hs = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    hs.setAttribute("width", w * 1.6); hs.setAttribute("height", h * 1.6);
    css(hs, { position: "absolute", left: `${x - w * 0.3}px`, top: `${y - h * 0.3}px`, overflow: "visible", pointerEvents: "none" });
    hs.innerHTML = `<defs><filter id="${id}h" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${(w * 0.07).toFixed(1)}"/></filter></defs><g transform="translate(${w * 0.3} ${h * 0.3})"><path d="${path}" transform="scale(${escalaPath})" fill="${nucleo}" opacity="0.75" filter="url(#${id}h)"/></g>`;
    padre.appendChild(hs);
  }
  const n = caja(padre, { x, y, w, h, z });
  const clip = forma === "circulo" ? "ellipse(50% 50% at 50% 50%)" : forma === "pildora" ? `inset(0 round ${Math.min(w, h) / 2}px)` : forma === "rect" ? "inset(0 round 36px)" : null;
  css(n, { backdropFilter: `url(#${id}) saturate(1.35) brightness(1.06)`, background: nucleo ? `radial-gradient(circle at 50% 50%, ${nucleo}ee 0%, ${nucleo}88 34%, ${nucleo}44 70%, ${nucleo}30 100%)` : tinte });
  if (clip) n.style.clipPath = clip;
  else {   // la chispa trae arcos: se escala con transform dentro de un clipPath SVG, nunca a mano
    const cp = document.createElementNS("http://www.w3.org/2000/svg", "clipPath"); cp.setAttribute("id", `${id}c`);
    cp.innerHTML = `<path d="${path}" transform="scale(${escalaPath})"/>`; svgDefs().appendChild(cp);
    n.style.clipPath = `url(#${id}c)`;
  }
  // brillo especular y canto: un SVG con la misma forma encima
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("width", w); s.setAttribute("height", h); s.setAttribute("viewBox", `0 0 ${w} ${h}`); css(s, { position: "absolute", left: "0", top: "0", overflow: "visible" });
  const gid = `${id}g`;
  s.innerHTML = `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.55"/><stop offset="0.35" stop-color="#fff" stop-opacity="0.06"/><stop offset="0.75" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0.22"/></linearGradient></defs>`;
  const d = forma === "circulo" ? `M${w / 2},1 A${w / 2 - 1},${h / 2 - 1} 0 1 1 ${w / 2 - 0.01},1 Z` : forma === "chispa" ? path
    : `M${Math.min(w, h) / 2},1 L${w - Math.min(w, h) / 2},1 A${Math.min(w, h) / 2 - 1},${Math.min(w, h) / 2 - 1} 0 0 1 ${w - Math.min(w, h) / 2},${h - 1} L${Math.min(w, h) / 2},${h - 1} A${Math.min(w, h) / 2 - 1},${Math.min(w, h) / 2 - 1} 0 0 1 ${Math.min(w, h) / 2},1 Z`;
  const p1 = document.createElementNS("http://www.w3.org/2000/svg", "path"); p1.setAttribute("d", d); p1.setAttribute("fill", `url(#${gid})`); p1.setAttribute("stroke", "rgba(255,255,255,0.85)");
  if (forma === "chispa") { p1.setAttribute("transform", `scale(${escalaPath})`); p1.setAttribute("stroke-width", (1.6 / escalaPath).toFixed(3)); } else p1.setAttribute("stroke-width", "1.6");
  s.appendChild(p1); n.appendChild(s);
  return n;
}

// ---------- neumorfismo: la superficie y lo que sale o se hunde de ella ----------
export function neu(padre, { x, y, w, h, r = 48, base = "#12263D", hundido = 0, alto = 18, z } = {}) {
  const n = caja(padre, { x, y, w, h, z });
  const claro = mezcla(base, "#FFFFFF", 0.09), oscuro = mezcla(base, "#000000", 0.45);
  css(n, { borderRadius: `${r}px`, background: base });
  n.ponerHundido = (u) => { n.style.boxShadow = u > 0 ? `inset ${alto * u}px ${alto * u}px ${alto * 2 * u}px ${oscuro}, inset ${-alto * u}px ${-alto * u}px ${alto * 2 * u}px ${claro}` : `${-alto}px ${-alto}px ${alto * 2}px ${claro}, ${alto}px ${alto}px ${alto * 2}px ${oscuro}`; };
  n.ponerHundido(hundido);
  return n;
}

// ---------- neo-brutalismo: bloques planos, borde grueso, sombra sólida desplazada ----------
export function bruto(padre, { x, y, w, h, fondo = MARCA.lima, borde = MARCA.navy, grosor = 6, sombra = 14, r = 6, z } = {}) {
  const n = caja(padre, { x, y, w, h, z });
  css(n, { background: fondo, border: `${grosor}px solid ${borde}`, borderRadius: `${r}px`, boxShadow: `${sombra}px ${sombra}px 0 ${borde}` });
  return n;
}
export function sticker(padre, { x, y, w, h, fondo = MARCA.durazno, texto = "NEW!", tam = 48, rot = -8, z } = {}) {
  const n = bruto(padre, { x, y, w, h, fondo, grosor: 5, sombra: 8, r: h / 2, z });
  css(n, { transform: `rotate(${rot}deg)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Anton", fontSize: `${tam}px`, color: MARCA.navy, lineHeight: "1" });
  n.textContent = texto;
  return n;
}

// ---------- claymorphism: volumen blando de arcilla ----------
export function arcilla(padre, { x, y, w, h, r = 48, color = MARCA.azul, z } = {}) {
  const n = caja(padre, { x, y, w, h, z });
  const luz = mezcla(color, "#FFFFFF", 0.42), sombra = mezcla(color, "#000000", 0.4);
  css(n, { borderRadius: typeof r === "number" ? `${r}px` : r, background: `radial-gradient(120% 95% at 30% 22%, ${luz} 0%, ${color} 48%, ${sombra} 100%)`,
    boxShadow: `inset ${w * 0.05}px ${h * 0.07}px ${Math.max(w, h) * 0.09}px rgba(255,255,255,0.5), inset ${-w * 0.07}px ${-h * 0.09}px ${Math.max(w, h) * 0.14}px rgba(0,0,0,0.28), ${w * 0.08}px ${h * 0.14}px ${Math.max(w, h) * 0.2}px rgba(5,14,26,0.35)` });
  return n;
}

// ---------- texto ----------
export function texto(padre, { x, y, txt, tam = 96, color = MARCA.hueso, fam = "Anton", peso = 400, ancla = "izq", z, sombra } = {}) {
  const n = document.createElement("div");
  css(n, { position: "absolute", top: `${y}px`, fontFamily: fam, fontWeight: peso, fontSize: `${tam}px`, lineHeight: "0.95", color, whiteSpace: "pre", letterSpacing: fam === "Anton" ? "-0.005em" : "0" });
  if (ancla === "centro") css(n, { left: `${x}px`, transform: "translateX(-50%)", textAlign: "center" });
  else if (ancla === "der") css(n, { right: `${x}px`, textAlign: "right" });
  else n.style.left = `${x}px`;
  if (z != null) n.style.zIndex = z;
  if (sombra) n.style.textShadow = sombra;
  n.textContent = txt;
  padre.appendChild(n);
  return n;
}
// pastilla de UI (etiqueta espacial): fondo sólido, texto Inter
export function etiqueta(padre, { x, y, txt, fondo = MARCA.navy, color = MARCA.hueso, tam = 22, z } = {}) {
  const n = document.createElement("div");
  css(n, { position: "absolute", left: `${x}px`, top: `${y}px`, padding: `${tam * 0.45}px ${tam * 0.9}px`, borderRadius: "999px", background: fondo, color, fontFamily: "Inter", fontWeight: 700, fontSize: `${tam}px`, whiteSpace: "nowrap" });
  if (z != null) n.style.zIndex = z;
  n.textContent = txt;
  padre.appendChild(n);
  return n;
}
