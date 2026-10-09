// Propuesta 3 · texto editorial: una línea corta arriba, Inter firme y la palabra clave en itálica
// serif (Instrument Serif) con color de marca. Como la referencia: el texto acompaña, la acción manda.
// Cada palabra entra en su palabra de la voz (0.1 s antes), con un subir corto y desenfoque que se
// limpia. Una sola línea a la vez: la anterior sale antes de que entre la siguiente.
export const ADELANTO = 0.1;

// partes: [["Todo mundo habla de"], ["inteligencia artificial.", "acento"]]  — anclas: un tiempo por palabra
export function linea(tl, raiz, { partes, anclas, fin, y = 92, tam = 54, color = "#0A1A2F", acento = "#006E96", alinear = "centro", x = 0, ancho = null, tamAcento = 1.22 }) {
  const c = document.createElement("div");
  Object.assign(c.style, {
    position: "absolute", top: `${y}px`, left: alinear === "centro" ? "0" : `${x}px`, width: alinear === "centro" ? "100%" : ancho ? `${ancho}px` : "auto",
    textAlign: alinear === "centro" ? "center" : "left", fontFamily: "Inter", fontWeight: 600, fontSize: `${tam}px`, lineHeight: 1.08,
    color, letterSpacing: "-0.02em", whiteSpace: "nowrap",
  });
  raiz.appendChild(c);
  const palabras = [];
  for (const [texto, tipo] of partes) {
    for (const p of texto.split(/\s+/).filter(Boolean)) {
      const s = document.createElement("span");
      Object.assign(s.style, { display: "inline-block", marginRight: `${tam * 0.24}px`, opacity: "0", willChange: "transform, opacity, filter" });
      if (tipo === "acento") Object.assign(s.style, { fontFamily: "Instrument Serif", fontStyle: "italic", fontWeight: 400, fontSize: `${tam * tamAcento}px`, color: acento, letterSpacing: "-0.01em", marginRight: `${tam * 0.2}px` });
      s.textContent = p;
      c.appendChild(s);
      palabras.push({ s, acento: tipo === "acento" });
    }
  }
  if (palabras.length) palabras.at(-1).s.style.marginRight = "0";
  palabras.forEach((p, i) => {
    const t = Math.max(0, anclas[Math.min(i, anclas.length - 1)] - ADELANTO);
    tl.fromTo(p.s, { opacity: 0, y: p.acento ? 26 : 18, filter: "blur(8px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: p.acento ? 0.42 : 0.3, ease: "power3.out", immediateRender: true }, t);
  });
  if (fin != null) palabras.forEach((p, i) => tl.to(p.s, { opacity: 0, y: -14, filter: "blur(6px)", duration: 0.22, ease: "power2.in" }, fin + i * 0.01));
  return { c, palabras };
}
