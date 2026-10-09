// v3 · tipografía cinética con texto real (DOM): cada palabra entra completa en su palabra de la voz,
// 0.1 s antes (ADELANTO, como la 2D). Estilos: golpe · sube · cae · barre. Resaltes brutalistas detrás de
// las palabras clave (un bloque plano de color). Las anclas son tiempos de v2/cues.js / tiempos.js.
export const ADELANTO = 0.1;
const MASCARA = new Set(["sube", "cae", "barre"]);

export function frase(tl, padre, { x, y, lineas, tam = 96, color = "#EAF4FA", ancla = "izq", inter = 0.98, estilo = "sube", colores = {}, bloques = {}, anclas, fin, fam = "Anton", peso = 400, z, sombra, adelanto = ADELANTO, dur } = {}) {
  const c = document.createElement("div");
  Object.assign(c.style, { position: "absolute", top: `${y}px`, fontFamily: fam, fontWeight: peso, fontSize: `${tam}px`, lineHeight: inter, color, whiteSpace: "nowrap", textAlign: ancla === "centro" ? "center" : ancla === "der" ? "right" : "left" });
  if (ancla === "centro") Object.assign(c.style, { left: `${x}px`, transform: "translateX(-50%)" });
  else if (ancla === "der") c.style.right = `${x}px`;
  else c.style.left = `${x}px`;
  if (z != null) c.style.zIndex = z;
  const palabras = [];
  let n = 0;
  lineas.forEach((ps) => {
    const l = document.createElement("div");
    ps.forEach((p, k) => {
      const caja = document.createElement("span");
      Object.assign(caja.style, { display: "inline-block", verticalAlign: "top", overflow: MASCARA.has(estilo) ? "hidden" : "visible", padding: `${tam * 0.08}px ${tam * 0.04}px ${tam * 0.02}px`, margin: `0 ${k < ps.length - 1 ? tam * 0.13 : 0}px 0 0` });
      const s = document.createElement("span");
      Object.assign(s.style, { display: "inline-block", color: colores[n] || color, opacity: "0" });
      if (bloques[n]) Object.assign(s.style, { background: bloques[n], padding: `0 ${tam * 0.08}px`, boxShadow: sombra || "none" });
      else if (sombra) s.style.textShadow = sombra;
      s.textContent = p;
      caja.appendChild(s); l.appendChild(caja);
      palabras.push({ caja, s, estilo });
      n++;
    });
    c.appendChild(l);
  });
  padre.appendChild(c);
  // entradas
  palabras.forEach((p, i) => {
    const t = Math.max(0, anclas[Math.min(i, anclas.length - 1)] - adelanto);
    tl.fromTo(p.s, { opacity: 0 }, { opacity: 1, duration: 0.001 }, t);
    if (p.estilo === "golpe") tl.fromTo(p.s, { scale: 1.55, opacity: 0 }, { scale: 1, opacity: 1, duration: dur ?? 0.2, ease: "power4.out", immediateRender: false }, t);
    else if (p.estilo === "sube") tl.fromTo(p.s, { yPercent: 105 }, { yPercent: 0, duration: dur ?? 0.24, ease: "expo.out", immediateRender: false }, t);
    else if (p.estilo === "cae") tl.fromTo(p.s, { yPercent: -120 }, { yPercent: 0, duration: dur ?? 0.32, ease: "back.out(2.2)", immediateRender: false }, t);
    else if (p.estilo === "barre") tl.fromTo(p.s, { xPercent: -70, opacity: 0 }, { xPercent: 0, opacity: 1, duration: dur ?? 0.24, ease: "expo.out", immediateRender: false }, t);
  });
  if (fin != null) borrar(tl, palabras, fin);
  return { c, palabras };
}
// salida rápida: las de máscara suben por su máscara; las demás se encogen y se apagan
export function borrar(tl, palabras, t) {
  palabras.forEach((p, i) => {
    const ti = t + i * 0.012;
    if (MASCARA.has(p.estilo)) tl.to(p.s, { yPercent: -115, xPercent: 0, duration: 0.18, ease: "power3.in" }, ti);
    else tl.to(p.s, { scale: 0.82, opacity: 0, duration: 0.16, ease: "power2.in" }, ti);
    tl.to(p.s, { opacity: 0, duration: 0.001 }, ti + 0.2);
  });
}
