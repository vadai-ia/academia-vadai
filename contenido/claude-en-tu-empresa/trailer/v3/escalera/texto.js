// Propuesta 3 · tipografía cinética. Cada frase de la voz es una línea hecha SOLO de sus palabras, que
// entran en su palabra exacta (0.1 s antes): desenfoque → nítido, movimiento con dirección y el
// interletrado que se cierra (MOTION-RULES 5–6). Las palabras con énfasis cambian de peso, color o
// escala al decirse; las que llevan «marca» se pintan con un bloque de color que barre detrás.
// Salida: empujadas en la dirección del movimiento de cámara, con desenfoque. Nunca un fade plano.
//
// Estilos por parte: "n" (Inter 700) · "fuerte" (Inter 900, más grande) · "acento" (Instrument Serif
// itálica, color) · "lima" / "durazno" / "cielo" (bloque de color detrás, texto navy) · "blanco"
// (texto blanco sobre noche).
export const ADELANTO = 0.1;
const NAVY = "#0A1A2F", HONDO = "#006E96";
const BLOQUE = { lima: "#C6F24E", durazno: "#FFB489", cielo: "#4FC6EE", navy: "#0A1A2F", rojo: "#C4342C" };

export function linea(tl, raiz, { partes, anclas, fin, y = 86, tam = 60, color = NAVY, acento = HONDO, alinear = "centro", x = 0, dir = [0, -1], entra = [0, 1], interlinea = 1.12, maxAncho = null, tamAcento = 1.24 }) {
  const c = document.createElement("div");
  Object.assign(c.style, {
    position: "absolute", top: `${y}px`, left: alinear === "centro" ? "0" : `${x}px`, width: alinear === "centro" ? "100%" : maxAncho ? `${maxAncho}px` : "auto",
    textAlign: alinear === "centro" ? "center" : "left", fontFamily: "Inter", fontWeight: 700, fontSize: `${tam}px`, lineHeight: interlinea,
    color, letterSpacing: "-0.025em", whiteSpace: maxAncho ? "normal" : "nowrap", pointerEvents: "none",
  });
  if (alinear === "centro" && maxAncho) Object.assign(c.style, { left: "50%", width: `${maxAncho}px`, marginLeft: `${-maxAncho / 2}px` });
  raiz.appendChild(c);
  // placa sólida detrás (vertical): el texto se lee aunque pase sobre la multitud o la cuadrícula
  let placa = null;
  if (arguments[2].placa) {
    const oscuro = partes.some(([, e]) => e === "blanco" || e === "acentoBlanco");
    Object.assign(c.style, { padding: `${tam * 0.28}px ${tam * 0.4}px` });
    placa = document.createElement("div");
    Object.assign(placa.style, { position: "absolute", inset: "0", borderRadius: `${tam * 0.5}px`, background: oscuro ? "rgba(10,26,47,.88)" : "rgba(246,249,252,.92)", boxShadow: "0 14px 34px rgba(10,26,47,.16)", opacity: "0", zIndex: -1 });
    c.style.zIndex = "1"; c.style.isolation = "isolate";
    c.appendChild(placa);
  }
  const palabras = [];
  let k = 0;
  for (const [texto, estilo = "n"] of partes) {
    // con bloque de color, la parte entera es una sola pieza (un bloque continuo detrás de sus palabras)
    const piezas = BLOQUE[estilo] ? [texto] : texto.split(/\s+/).filter(Boolean);
    for (const p of piezas) {
      const n = p.split(/\s+/).length;
      const caja = document.createElement("span");
      Object.assign(caja.style, { display: "inline-block", position: "relative", marginRight: `${tam * 0.22}px`, verticalAlign: "baseline" });
      const s = document.createElement("span");
      Object.assign(s.style, { display: "inline-block", position: "relative", opacity: "0", willChange: "transform, opacity, filter", zIndex: 1 });
      s.textContent = p;
      let bloque = null;
      if (estilo === "acento") Object.assign(s.style, { fontFamily: "Instrument Serif", fontStyle: "italic", fontWeight: 400, fontSize: `${tam * tamAcento}px`, color: acento, letterSpacing: "-0.01em" });
      if (estilo === "fuerte") Object.assign(s.style, { fontWeight: 900, fontSize: `${tam * 1.18}px`, letterSpacing: "-0.04em" });
      if (estilo === "blanco") Object.assign(s.style, { color: "#FFFFFF" });
      if (estilo === "acentoBlanco") Object.assign(s.style, { fontFamily: "Instrument Serif", fontStyle: "italic", fontWeight: 400, fontSize: `${tam * tamAcento}px`, color: "#C6F24E" });
      if (BLOQUE[estilo]) {
        Object.assign(s.style, { fontWeight: 800, color: estilo === "navy" || estilo === "rojo" ? "#FFFFFF" : NAVY, padding: `0 ${tam * 0.16}px` });
        bloque = document.createElement("span");
        Object.assign(bloque.style, { position: "absolute", left: "0", right: "0", top: `${tam * 0.1}px`, bottom: `${tam * 0.02}px`, background: BLOQUE[estilo], borderRadius: `${tam * 0.18}px`, transformOrigin: "0 50%", transform: "scaleX(0)", zIndex: 0 });
        caja.appendChild(bloque);
      }
      caja.appendChild(s);
      c.appendChild(caja);
      palabras.push({ s, caja, bloque, estilo, k });
      k += n;
    }
  }
  if (palabras.length) palabras.at(-1).caja.style.marginRight = "0";
  if (placa) tl.fromTo(placa, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.25, ease: "power3.out", immediateRender: true }, Math.max(0, anclas[0] - ADELANTO - 0.05));
  palabras.forEach((p, i) => {
    const t = Math.max(0, anclas[Math.min(p.k, anclas.length - 1)] - ADELANTO);
    const fuerte = p.estilo !== "n" && p.estilo !== "blanco";
    // entra: desde la dirección «entra», desenfocada y con el interletrado abierto
    p.tFin = t + (fuerte ? 0.46 : 0.34);
    tl.fromTo(p.s, { opacity: 0, x: entra[0] * -34, y: entra[1] * 30, filter: "blur(12px)", letterSpacing: "0.22em", scale: fuerte ? 1.32 : 1 },
      { opacity: 1, x: 0, y: 0, filter: "blur(0px)", letterSpacing: p.estilo === "fuerte" ? "-0.04em" : "-0.02em", scale: 1, duration: fuerte ? 0.46 : 0.34, ease: "power3.out", immediateRender: true }, t);
    if (p.bloque) tl.fromTo(p.bloque, { scaleX: 0 }, { scaleX: 1, duration: 0.32, ease: "power3.inOut", immediateRender: true }, t + 0.06);
  });
  // la salida nunca empieza antes de que termine la entrada de esa palabra: si se enciman, la entrada
  // termina después y la vuelve a encender (ERRORES E46)
  const salir = (f) => (placa && tl.to(placa, { opacity: 0, duration: 0.2, ease: "power2.in" }, Math.max(f, Math.max(...palabras.map((p) => p.tFin)) + 0.01)), palabras.forEach((p, i) => {
    const ts = Math.max(f + i * 0.006, p.tFin + 0.01);
    tl.to(p.s, { opacity: 0, x: dir[0] * 90, y: dir[1] * 60, filter: "blur(10px)", duration: 0.18, ease: "power2.in" }, ts);
    if (p.bloque) tl.to(p.bloque, { scaleX: 0, transformOrigin: "100% 50%", duration: 0.16, ease: "power2.in" }, Math.max(ts, p.tFin - 0.02));
  }));
  if (fin != null && !arguments[2]?.diferida) salir(fin);
  return { c, palabras, t0: Math.max(0, anclas[0] - ADELANTO), salir };
}

// tarjeta de golpe: color de marca a todo el cuadro, una palabra gigante del guion, corte duro de
// entrada y de salida en esa palabra, 0.4–0.6 s (MOTION-RULES 3)
export function golpe(tl, raiz, { t, dur = 0.5, texto, fondo = "#C6F24E", color = NAVY, tam = 330, fam = "Inter", estilo = "normal", peso = 900, sub = null, W = 1920, H = 1080, adorno = true }) {
  const c = document.createElement("div");
  Object.assign(c.style, { position: "absolute", left: "0", top: "0", width: `${W}px`, height: `${H}px`, background: fondo, opacity: "0", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" });
  if (adorno) {
    // anillos concéntricos finos: el cuadro no queda plano
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", W); svg.setAttribute("height", H);
    Object.assign(svg.style, { position: "absolute", left: "0", top: "0" });
    for (let k = 1; k <= 7; k++) {
      const r = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      r.setAttribute("cx", W / 2); r.setAttribute("cy", H / 2); r.setAttribute("r", 120 + k * 150);
      r.setAttribute("fill", "none"); r.setAttribute("stroke", color); r.setAttribute("stroke-opacity", String(0.09 - k * 0.008)); r.setAttribute("stroke-width", 3);
      svg.appendChild(r);
    }
    c.appendChild(svg);
    tl.fromTo(svg, { scale: 0.8, transformOrigin: "50% 50%" }, { scale: 1.12, duration: dur, ease: "power1.out", immediateRender: true }, t);
  }
  const p = document.createElement("div");
  Object.assign(p.style, { position: "relative", fontFamily: fam, fontStyle: estilo, fontWeight: peso, fontSize: `${tam}px`, color, letterSpacing: "-0.05em", lineHeight: 0.9, whiteSpace: "nowrap" });
  p.textContent = texto;
  c.appendChild(p);
  if (sub) { const q = document.createElement("div"); Object.assign(q.style, { position: "relative", fontFamily: "Instrument Serif", fontStyle: "italic", fontSize: `${tam * 0.26}px`, color, marginTop: `${tam * 0.06}px` }); q.textContent = sub; c.appendChild(q); }
  raiz.appendChild(c);
  const t0 = t - ADELANTO * 0.5;
  tl.set(c, { opacity: 1 }, t0);
  tl.fromTo(p, { scale: 1.14, letterSpacing: "0.04em", filter: "blur(6px)" }, { scale: 1, letterSpacing: "-0.05em", filter: "blur(0px)", duration: 0.2, ease: "power4.out", immediateRender: true }, t0);
  tl.to(p, { scale: 1.05, duration: dur - 0.2, ease: "none" }, t0 + 0.2);
  tl.set(c, { opacity: 0 }, t0 + dur);
  c.t0 = t0;
  return c;
}

// micro-etiqueta (mono, en mayúsculas) — solo con texto aprobado
export function etiqueta(raiz, texto, { color = NAVY, fondo = "rgba(255,255,255,.9)", tam = 22 } = {}) {
  const e = document.createElement("div");
  Object.assign(e.style, { position: "absolute", left: "0", top: "0", opacity: "0", fontFamily: "Inter", fontWeight: 700, fontSize: `${tam}px`, letterSpacing: "0.08em", textTransform: "uppercase", color, background: fondo, padding: `${tam * 0.4}px ${tam * 0.8}px`, borderRadius: "999px", whiteSpace: "nowrap", boxShadow: "0 8px 22px rgba(10,26,47,.18)" });
  e.textContent = texto;
  raiz.appendChild(e);
  return e;
}
