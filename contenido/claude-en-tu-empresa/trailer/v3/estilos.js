// v3 · styleframes de «La interfaz viva»: un cuadro fijo por tramo (cada segundo de v3-estilos.html es
// uno). Sirven para aprobar el look antes de animar: cada tendencia aplicada a una frase real del guion.
import { MARCA as M, caja, vidrio, liquido, neu, bruto, sticker, arcilla, texto, etiqueta, mezcla } from "./materiales.js";
import { LOGOS, HERRAMIENTAS } from "../v2/logos.js";

const icono = (padre, logo, { x, y, s = 64, color } = {}) => {
  const n = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  n.setAttribute("viewBox", "0 0 24 24"); n.setAttribute("width", s); n.setAttribute("height", s);
  Object.assign(n.style, { position: "absolute", left: `${x}px`, top: `${y}px` });
  n.innerHTML = `<path d="${logo.d}" fill="${color || logo.hex || M.navy}"/>`;
  padre.appendChild(n); return n;
};
const imagen = (padre, src, { x, y, s }) => { const i = document.createElement("img"); i.src = src; Object.assign(i.style, { position: "absolute", left: `${x}px`, top: `${y}px`, width: `${s}px`, height: `${s}px` }); padre.appendChild(i); return i; };
const globo = (padre, { x, y, w, h, fondo, txt, tam = 30, cola = "izq", rot = 0 }) => {
  const b = bruto(padre, { x, y, w, h, fondo, r: 22, grosor: 5, sombra: 10 });
  Object.assign(b.style, { transform: `rotate(${rot}deg)`, display: "flex", alignItems: "center", padding: "0 26px", fontFamily: "Inter", fontWeight: 800, fontSize: `${tam}px`, color: M.navy, lineHeight: "1.1" });
  b.textContent = txt;
  const c = bruto(b, { x: cola === "izq" ? 26 : w - 70, y: h - 18, w: 34, h: 34, fondo, grosor: 5, sombra: 0, r: 4 });
  Object.assign(c.style, { transform: "rotate(45deg)", borderTop: "none", borderLeft: "none" });
  return b;
};

export const AURORAS = {
  noche: { fondo: "#071526", velo: "#4FC6EE", focos: [{ x: 0.5, y: 0.55, r: 0.45, f: 0.9, color: "#00557A" }, { x: 0.82, y: 0.25, r: 0.3, f: 0.7, color: "#0092C8" }, { x: 0.15, y: 0.2, r: 0.25, f: 0.45, color: "#123A66" }, { x: 0.2, y: 0.9, r: 0.18, f: 0.25, color: "#C6F24E" }] },
  metodo: { fondo: "#06121F", velo: "#C6F24E", focos: [{ x: 0.5, y: 0.6, r: 0.42, f: 1.0, color: "#006E96" }, { x: 0.2, y: 0.25, r: 0.32, f: 0.9, color: "#00A0DB" }, { x: 0.85, y: 0.3, r: 0.25, f: 0.75, color: "#4FC6EE" }, { x: 0.75, y: 0.85, r: 0.22, f: 0.55, color: "#C6F24E" }] },
  cielo: { fondo: "#0B2D4D", velo: "#FFB489", focos: [{ x: 0.3, y: 0.3, r: 0.5, f: 1.0, color: "#00A0DB" }, { x: 0.8, y: 0.7, r: 0.45, f: 1.0, color: "#4FC6EE" }, { x: 0.65, y: 0.15, r: 0.25, f: 0.7, color: "#FFB489" }, { x: 0.12, y: 0.85, r: 0.25, f: 0.6, color: "#C6F24E" }] },
};

export function montar({ ui, W, H, chispa }) {
  const cuadros = [];
  const nuevo = (aurora, vidrioGL) => { const c = caja(ui, { x: 0, y: 0, w: W, h: H }); c.style.overflow = "hidden"; cuadros.push({ c, aurora, vidrioGL }); return c; };

  // ---------- 0 · «Todo mundo habla de IA»: minimalismo exagerado; el ruido brutalista entra por los bordes ----------
  {
    const c = nuevo(AURORAS.noche, (g, s) => { g.font = `${178 * s}px Anton`; g.textAlign = "center"; g.fillText("INTELIGENCIA ARTIFICIAL", 960 * s, 660 * s); });
    texto(c, { x: 960, y: 330, txt: "TODO MUNDO HABLA DE", tam: 104, ancla: "centro" });
    liquido(c, { x: 1460, y: 120, w: 230, h: 230, forma: "chispa", path: chispa, escalaPath: 230 / 24, fuerza: 60, nucleo: M.durazno });
    globo(c, { x: 70, y: 820, w: 470, h: 96, fondo: M.lima, txt: "¿Ya probaste la nueva?", rot: -4 });
    globo(c, { x: 1330, y: 830, w: 470, h: 96, fondo: M.durazno, txt: "¡SALIÓ OTRA IA!", tam: 34, cola: "der", rot: 3 });
    globo(c, { x: 110, y: 120, w: 430, h: 96, fondo: M.hueso, txt: "Esto lo cambia todo", rot: 5 });
    etiqueta(c, { x: 830, y: 930, txt: "+3 notificaciones", fondo: M.rojo, color: M.blanco });
  }
  // ---------- 1 · El bucle: neo-brutalismo sobre papel; las herramientas en una pista que se repite ----------
  {
    const c = nuevo(AURORAS.noche);
    const papel = caja(c, { x: 0, y: 0, w: W, h: H }); Object.assign(papel.style, { background: `radial-gradient(${M.navy}22 2px, transparent 2.5px) 0 0 / 34px 34px, ${M.hueso}` });
    const pista = caja(c, { x: 940, y: 130, w: 820, h: 820 }); Object.assign(pista.style, { borderRadius: "50%", border: `14px solid ${M.navy}`, boxShadow: `14px 14px 0 ${M.navy}` });
    const ids = ["googlegemini", "meta", "perplexity", "mistralai", "deepseek", "notion", "cursor", "huggingface", "qwen", "elevenlabs"];
    ids.forEach((id, k) => {
      const a = -Math.PI / 2 + (k / ids.length) * Math.PI * 2, cx = 1350 + Math.cos(a) * 410, cy = 540 + Math.sin(a) * 410;
      const t = bruto(c, { x: cx - 66, y: cy - 66, w: 132, h: 132, fondo: k % 3 === 0 ? M.lima : k % 3 === 1 ? M.blanco : M.cieloClaro, r: 18, sombra: 9 });
      t.style.transform = `rotate(${(k % 2 ? 6 : -5)}deg)`;
      icono(t, LOGOS.find((l) => l.id === id), { x: 30, y: 30, s: 60, color: M.navy });
    });
    sticker(c, { x: 1560, y: 140, w: 200, h: 86, texto: "NEW!", tam: 58, rot: 12 });
    // la figura de arcilla que corre adentro de la pista (sin cara)
    arcilla(c, { x: 1300, y: 430, w: 100, h: 100, r: "50%", color: M.durazno });
    arcilla(c, { x: 1280, y: 545, w: 140, h: 170, r: "60px 60px 40px 40px", color: M.azul });
    texto(c, { x: 1350, y: 760, txt: "↻", tam: 120, color: M.navy, ancla: "centro", fam: "Inter", peso: 900 });
    // el texto con glitch de aberración cromática
    const tx = (dx, color) => texto(c, { x: 120 + dx, y: 300, txt: "SALE\nOTRA.", tam: 300, color });
    bruto(c, { x: 104, y: 612, w: 560, h: 250, fondo: M.lima, grosor: 0, sombra: 0, r: 0 });
    tx(-10, M.cieloClaro); tx(10, M.durazno); tx(0, M.navy);
    const franja = caja(c, { x: 0, y: 470, w: 900, h: 34 }); Object.assign(franja.style, { background: M.hueso, transform: "translateX(26px)", mixBlendMode: "normal", opacity: "0.9" });
  }
  // ---------- 2 · 6 de 100: minimalismo exagerado + arcilla; seis píldoras se vuelven luz ----------
  {
    const c = nuevo(AURORAS.noche);
    caja(c, { x: 0, y: 0, w: W, h: H }).style.background = `linear-gradient(160deg, ${M.hueso}, #D7E9F3)`;
    texto(c, { x: 70, y: 40, txt: "6", tam: 900, color: M.navy });
    texto(c, { x: 520, y: 760, txt: "DE CADA 100\nEMPRESAS", tam: 110, color: M.navy });
    const SEIS = [13, 38, 52, 27, 76, 64];
    for (let i = 0; i < 100; i++) {
      const x = 1180 + (i % 10) * 64, y = 120 + Math.floor(i / 10) * 64, on = SEIS.includes(i);
      const p = arcilla(c, { x, y, w: 46, h: 46, r: "50%", color: on ? M.cieloClaro : "#B9C9D4" });
      if (on) p.style.boxShadow += `, 0 0 34px 12px ${M.cieloClaro}, 0 0 80px 20px ${M.azul}88`;
    }
    etiqueta(c, { x: 1180, y: 790, txt: "McKinsey · The State of AI", fondo: M.navy });
  }
  // ---------- 3 · El escritorio: arcilla (el trabajo a mano) aplastada por avisos brutalistas ----------
  {
    const c = nuevo(AURORAS.noche);
    caja(c, { x: 0, y: 0, w: W, h: H }).style.background = `linear-gradient(180deg, #F3F8FB, #DCEAF2)`;
    arcilla(c, { x: 820, y: 760, w: 980, h: 70, r: 35, color: "#9FB7C6" });                       // la mesa
    const mon = arcilla(c, { x: 980, y: 210, w: 640, h: 450, r: 46, color: M.navyHondo });        // el monitor
    const pant = caja(mon, { x: 34, y: 34, w: 572, h: 382 }); Object.assign(pant.style, { background: M.hueso, borderRadius: "22px", boxShadow: "inset 6px 8px 18px rgba(0,0,0,0.18)" });
    for (let i = 0; i < 6; i++) for (let j = 0; j < 7; j++) {
      const lleno = i * 7 + j < 23;
      arcilla(pant, { x: 22 + j * 78, y: 22 + i * 58, w: 64, h: 42, r: 12, color: lleno ? (j % 3 === 0 ? M.azul : "#7FA9C2") : "#E3EDF3" });
    }
    arcilla(c, { x: 1250, y: 655, w: 100, h: 110, r: 20, color: "#5B7486" });                    // el pie
    // pila de hojas de arcilla, aplastada por una notificación brutalista
    for (let k = 0; k < 5; k++) arcilla(c, { x: 840 + k * 6, y: 690 - k * 24, w: 230, h: 30, r: 12, color: "#F7FBFD" }).style.transform = `scaleY(${k === 4 ? 0.6 : 1}) rotate(${(k % 2 ? 2 : -2)}deg)`;
    const av = [["Gerencia", "¿Me apruebas el reporte?", 1560, 120, 4, M.durazno], ["Ventas", "Urgente: la cotización", 1580, 310, -5, M.lima], ["Admin", "¿Pago al proveedor?", 820, 600, -9, M.blanco]];
    av.forEach(([de, msg, x, y, r, f]) => {
      const b = bruto(c, { x, y, w: 320, h: 110, fondo: f, r: 14, sombra: 10 }); b.style.transform = `rotate(${r}deg)`;
      texto(b, { x: 22, y: 16, txt: de.toUpperCase(), tam: 20, fam: "Inter", peso: 800, color: M.cieloHondo });
      texto(b, { x: 22, y: 50, txt: msg, tam: 24, fam: "Inter", peso: 700, color: M.navy });
    });
    bruto(c, { x: 92, y: 520, w: 600, h: 150, fondo: M.durazno, grosor: 0, sombra: 0, r: 0 });
    texto(c, { x: 100, y: 340, txt: "REPORTES\nA MANO", tam: 190, color: M.navy });
  }
  // ---------- 4 · «¿Cuánto depende de ti?»: neumorfismo; todo se apaga a un solo botón ----------
  {
    const c = nuevo(AURORAS.noche);
    caja(c, { x: 0, y: 0, w: W, h: H }).style.background = "#12263D";
    const N = { x: 960, y: 660 };
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2 + 0.2, rr = 300 + (k % 3) * 60, x = N.x + Math.cos(a) * rr, y = N.y + Math.sin(a) * rr * 0.62;
      const surco = caja(c, { x: N.x, y: N.y - 7, w: rr, h: 14 }); Object.assign(surco.style, { transformOrigin: "0 50%", transform: `rotate(${a}rad) scaleY(${1})`, borderRadius: "7px", background: "#12263D", boxShadow: "inset 3px 3px 6px #08131F, inset -3px -3px 6px #1C3554" });
      const nd = neu(c, { x: x - 34, y: y - 34, w: 68, h: 68, r: 34, alto: 8 }); nd.ponerHundido(0);
      if (k % 4 === 0) { const l = caja(nd, { x: 24, y: 24, w: 20, h: 20 }); Object.assign(l.style, { borderRadius: "50%", background: M.cieloClaro, boxShadow: `0 0 16px ${M.cieloClaro}` }); }
    }
    const b = neu(c, { x: N.x - 170, y: N.y - 170, w: 340, h: 340, r: 170, alto: 22 }); b.ponerHundido(1);
    texto(b, { x: 170, y: 118, txt: "TÚ", tam: 110, fam: "Inter", peso: 800, color: "#5D7690", ancla: "centro" });
    texto(c, { x: 960, y: 70, txt: "¿CUÁNTO DE TU EMPRESA", tam: 96, ancla: "centro" });
    texto(c, { x: 960, y: 170, txt: "TODAVÍA DEPENDE DE TI?", tam: 96, ancla: "centro", color: M.hueso });
    const ch = (x, y, de, msg) => { const v = vidrio(c, { x, y, w: 420, h: 96, r: 22, blur: 18, tono: "rgba(255,255,255,0.10)" }); texto(v, { x: 22, y: 14, txt: de, tam: 18, fam: "Inter", peso: 800, color: "#25D366" }); texto(v, { x: 22, y: 44, txt: msg, tam: 26, fam: "Inter", peso: 600, color: M.hueso }); };
    ch(80, 420, "Ventas", "¿Le doy el descuento?"); ch(1420, 380, "Compras", "¿Autorizas el pago?"); ch(110, 820, "Admin", "¿Mando la cotización?"); ch(1400, 860, "Operación", "Jefe, ¿qué hago?");
  }
  // ---------- 5 · «Te falta un MÉTODO»: vidrio líquido; la gota cae y todo se aclara ----------
  {
    const c = nuevo(AURORAS.metodo, (g, s) => { g.font = `${380 * s}px Anton`; g.textAlign = "center"; g.fillText("MÉTODO.", 960 * s, 820 * s); g.lineWidth = 12 * s; g.strokeStyle = "#fff"; g.beginPath(); g.ellipse(960 * s, 165 * s, 190 * s, 46 * s, 0, 0, Math.PI * 2); g.stroke(); });   // la onda donde cae la gota
    texto(c, { x: 960, y: 300, txt: "TE FALTA UN", tam: 110, ancla: "centro" });
    liquido(c, { x: 880, y: 40, w: 160, h: 160, forma: "chispa", path: chispa, escalaPath: 160 / 24, fuerza: 60, nucleo: M.durazno });
  }
  // ---------- 6 · Lo que aprendes: UI espacial de vidrio alrededor de Claude ----------
  {
    const c = nuevo(AURORAS.cielo, (g, s) => { g.beginPath(); g.ellipse(960 * s, 610 * s, 150 * s, 150 * s, 0, 0, Math.PI * 2); g.fill(); });
    const tools = [["excel", 560, 420, 1], ["powerpoint", 1330, 380, 0.9], ["gmail", 440, 780, 0.75], ["googledocs", 1440, 760, 1], ["googledrive", 1640, 300, 0.55], ["higgsfield", 1150, 900, 0.7], ["googlesheets", 1700, 580, 0.6], ["skills", 250, 540, 0.6]];
    const IMG = { excel: "./assets/marca/herramientas/excel.svg", powerpoint: "./assets/marca/herramientas/powerpoint.svg", higgsfield: "./assets/marca/herramientas/higgsfield.svg" };
    tools.sort((a, b) => a[3] - b[3]).forEach(([id, x, y, p]) => {
      const s = 200 * p, v = vidrio(c, { x: x - s / 2, y: y - s / 2, w: s, h: s, r: s * 0.24, blur: 20, tono: "rgba(255,255,255,0.26)" });
      if (p < 0.7) v.style.filter = `blur(${(0.7 - p) * 10}px)`;
      if (IMG[id]) imagen(v, IMG[id], { x: s * 0.22, y: s * 0.22, s: s * 0.56 });
      else if (id === "skills") texto(v, { x: s / 2, y: s * 0.28, txt: "⚡", tam: s * 0.42, ancla: "centro", fam: "Inter", color: "#D97757" });
      else icono(v, HERRAMIENTAS.find((h) => h.id === id), { x: s * 0.22, y: s * 0.22, s: s * 0.56 });
    });
    const cl = HERRAMIENTAS.find((h) => h.id === "claude");
    icono(c, cl, { x: 960 - 80, y: 610 - 80, s: 160, color: "#D97757" });
    const tit = vidrio(c, { x: 560, y: 60, w: 800, h: 140, r: 40, tono: "rgba(10,26,47,0.55)" });
    texto(tit, { x: 400, y: 26, txt: "EN CUALQUIER HERRAMIENTA", tam: 86, ancla: "centro" });
  }
  // ---------- 7 · CTA: aurora, botón que la gota presiona, sticker brutalista ----------
  {
    const c = nuevo(AURORAS.cielo, (g, s) => { g.beginPath(); g.roundRect(560 * s, 150 * s, 800 * s, 380 * s, 60 * s); g.fill(); });
    texto(c, { x: 960, y: 205, txt: "PLÁTICA GRATUITA", tam: 140, ancla: "centro", color: M.navy });
    texto(c, { x: 960, y: 345, txt: "Y EN VIVO", tam: 140, ancla: "centro", color: M.blanco });
    const bt = caja(c, { x: 640, y: 610, w: 640, h: 150 });
    Object.assign(bt.style, { borderRadius: "75px", background: `linear-gradient(180deg, #D8FA6E, ${M.lima})`, boxShadow: `inset 0 4px 0 rgba(255,255,255,0.6), inset 0 -10px 18px rgba(36,52,10,0.35), 0 4px 0 #8DB52A, 0 30px 50px rgba(5,14,26,0.35)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Anton", fontSize: "76px", color: M.navy });
    bt.textContent = "APARTA TU LUGAR";
    liquido(c, { x: 1180, y: 610, w: 160, h: 160, forma: "chispa", path: chispa, escalaPath: 160 / 24, fuerza: 50, nucleo: M.durazno });
    sticker(c, { x: 1270, y: 520, w: 260, h: 100, texto: "GRATIS", tam: 64, rot: 9, fondo: M.durazno });
    const pl = vidrio(c, { x: 610, y: 860, w: 700, h: 120, r: 60, tono: "rgba(255,255,255,0.85)", blur: 10 });
    imagen(pl, "./assets/marca/vadai-horizontal-recorte.png", { x: 70, y: 30, s: 0 }).style.cssText += "width:177px;height:60px";
    imagen(pl, "./assets/marca/totalcoach-recorte.png", { x: 380, y: 33, s: 0 }).style.cssText += "width:246px;height:56px";
  }
  return {
    cuadros,
    mostrar(k) { cuadros.forEach((q, i) => { q.c.style.display = i === k ? "block" : "none"; }); },
  };
}

// ---------- verticales (1080×1920, zona segura x 90–950 · y 250–1440): el bucle, el botón «TÚ», el CTA ----------
export function montarV({ ui, W, H, chispa }) {
  const cuadros = [];
  const nuevo = (aurora, vidrioGL) => { const c = caja(ui, { x: 0, y: 0, w: W, h: H }); c.style.overflow = "hidden"; cuadros.push({ c, aurora, vidrioGL }); return c; };
  {
    const c = nuevo(AURORAS.noche);
    caja(c, { x: 0, y: 0, w: W, h: H }).style.background = `radial-gradient(${M.navy}22 2px, transparent 2.5px) 0 0 / 34px 34px, ${M.hueso}`;
    const tx = (dx, color) => texto(c, { x: 130 + dx, y: 280, txt: "SALE\nOTRA.", tam: 250, color });
    bruto(c, { x: 116, y: 530, w: 470, h: 210, fondo: M.lima, grosor: 0, sombra: 0, r: 0 });
    tx(-9, M.cieloClaro); tx(9, M.durazno); tx(0, M.navy);
    sticker(c, { x: 640, y: 330, w: 230, h: 92, texto: "NEW!", tam: 62, rot: 12 });
    const pista = caja(c, { x: 170, y: 820, w: 740, h: 740 }); Object.assign(pista.style, { borderRadius: "50%", border: `14px solid ${M.navy}`, boxShadow: `14px 14px 0 ${M.navy}` });
    const ids = ["googlegemini", "meta", "perplexity", "mistralai", "deepseek", "notion", "cursor", "huggingface"];
    ids.forEach((id, k) => {
      const a = -Math.PI / 2 + (k / ids.length) * Math.PI * 2, cx = 540 + Math.cos(a) * 330, cy = 1110 + Math.sin(a) * 250;
      const t = bruto(c, { x: cx - 60, y: cy - 60, w: 120, h: 120, fondo: k % 3 === 0 ? M.lima : k % 3 === 1 ? M.blanco : M.cieloClaro, r: 18, sombra: 9 });
      t.style.transform = `rotate(${(k % 2 ? 6 : -5)}deg)`;
      icono(t, LOGOS.find((l) => l.id === id), { x: 28, y: 28, s: 54, color: M.navy });
    });
    pista.style.cssText += "left:210px;width:660px;height:500px;top:860px";
    arcilla(c, { x: 500, y: 990, w: 80, h: 80, r: "50%", color: M.durazno });
    arcilla(c, { x: 482, y: 1080, w: 116, h: 132, r: "50px 50px 32px 32px", color: M.azul });
  }
  {
    const c = nuevo(AURORAS.noche);
    caja(c, { x: 0, y: 0, w: W, h: H }).style.background = "#12263D";
    texto(c, { x: 540, y: 300, txt: "¿CUÁNTO DE TU\nEMPRESA TODAVÍA\nDEPENDE DE TI?", tam: 104, ancla: "centro" });
    const N = { x: 540, y: 940 };
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + 0.2, rr = 250 + (k % 3) * 40, x = N.x + Math.cos(a) * rr, y = N.y + Math.sin(a) * rr;
      const surco = caja(c, { x: N.x, y: N.y - 6, w: rr, h: 12 }); Object.assign(surco.style, { transformOrigin: "0 50%", transform: `rotate(${a}rad)`, borderRadius: "6px", background: "#12263D", boxShadow: "inset 3px 3px 6px #08131F, inset -3px -3px 6px #1C3554" });
      const nd = neu(c, { x: x - 30, y: y - 30, w: 60, h: 60, r: 30, alto: 7 }); nd.ponerHundido(0);
      if (k % 3 === 0) { const l = caja(nd, { x: 21, y: 21, w: 18, h: 18 }); Object.assign(l.style, { borderRadius: "50%", background: M.cieloClaro, boxShadow: `0 0 16px ${M.cieloClaro}` }); }
    }
    const b = neu(c, { x: N.x - 150, y: N.y - 150, w: 300, h: 300, r: 150, alto: 20 }); b.ponerHundido(1);
    texto(b, { x: 150, y: 100, txt: "TÚ", tam: 100, fam: "Inter", peso: 800, color: "#5D7690", ancla: "centro" });
    const v = vidrio(c, { x: 110, y: 1270, w: 600, h: 100, r: 22, blur: 18, tono: "rgba(255,255,255,0.10)" });
    texto(v, { x: 22, y: 14, txt: "Ventas", tam: 18, fam: "Inter", peso: 800, color: "#25D366" }); texto(v, { x: 22, y: 44, txt: "¿Le doy el descuento al cliente?", tam: 27, fam: "Inter", peso: 600, color: M.hueso });
    const v2 = vidrio(c, { x: 560, y: 1385, w: 390, h: 64, r: 20, blur: 18, tono: "rgba(234,244,250,0.85)" });
    texto(v2, { x: 20, y: 16, txt: "Espérame, lo reviso. ✓✓", tam: 26, fam: "Inter", peso: 600, color: M.navy });
  }
  {
    const c = nuevo(AURORAS.cielo, (g, s) => { g.beginPath(); g.roundRect(120 * s, 300 * s, 840 * s, 420 * s, 60 * s); g.fill(); });
    texto(c, { x: 540, y: 360, txt: "PLÁTICA", tam: 150, ancla: "centro", color: M.navy });
    texto(c, { x: 540, y: 520, txt: "GRATUITA Y EN VIVO", tam: 92, ancla: "centro", color: M.navy });
    const bt = caja(c, { x: 150, y: 860, w: 780, h: 160 });
    Object.assign(bt.style, { borderRadius: "80px", background: `linear-gradient(180deg, #D8FA6E, ${M.lima})`, boxShadow: `inset 0 4px 0 rgba(255,255,255,0.6), inset 0 -10px 18px rgba(36,52,10,0.35), 0 4px 0 #8DB52A, 0 30px 50px rgba(5,14,26,0.35)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Anton", fontSize: "86px", color: M.navy });
    bt.textContent = "APARTA TU LUGAR";
    liquido(c, { x: 760, y: 870, w: 170, h: 170, forma: "chispa", path: chispa, escalaPath: 170 / 24, fuerza: 50, nucleo: M.durazno });
    sticker(c, { x: 620, y: 740, w: 280, h: 104, texto: "GRATIS", tam: 68, rot: 9, fondo: M.durazno });
    const pl = vidrio(c, { x: 190, y: 1120, w: 700, h: 120, r: 60, tono: "rgba(255,255,255,0.85)", blur: 10 });
    imagen(pl, "./assets/marca/vadai-horizontal-recorte.png", { x: 70, y: 30, s: 0 }).style.cssText += "width:177px;height:60px";
    imagen(pl, "./assets/marca/totalcoach-recorte.png", { x: 380, y: 33, s: 0 }).style.cssText += "width:246px;height:56px";
    texto(c, { x: 540, y: 1290, txt: "↓", tam: 140, fam: "Inter", peso: 900, ancla: "centro", color: M.lima, sombra: `0 6px 0 ${M.navy}` });
  }
  return { cuadros, mostrar(k) { cuadros.forEach((q, i) => { q.c.style.display = i === k ? "block" : "none"; }); } };
}
