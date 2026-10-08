// v2 · 2D «Un solo trazo» · cierres (49–87 s). Plática: la pantalla en vivo, los tres escalones de
// lo que te contamos, todo entra a una sola ventana, tu equipo resuelve sin hilos hacia ti. Curso: el
// título con la chispa de asterisco, Excel/Word/correo con la chispa adentro, los tres «sin».
// Común: respaldo (+40 encendidos), el eco del arranque, «nosotros te enseñamos», telón al degradado
// héroe y la tarjeta final con la flecha lima (lo único lima del cuadro).
import { el, texto, dibujar, borrar, tramo, ease, K, onda, azar, mover, circulo, insignia, crearChispa } from "./trazo.js";
import { LOGOS, HERRAMIENTAS } from "../logos.js";
import * as D from "./dibujos.js";

export function montar(ctx) {
  const { tl, capas, C, T, fuente, reloj, chispa, cam, V, W, H, dom } = ctx;
  const { escena, letras, fijo, telon } = capas;
  const q = (h, v) => (V ? v : h);
  const CX = W / 2, CYm = H / 2;
  const platica = T.version === "platica";
  const hueso = K("hueso"), navy = K("navy");
  const ARR = q({ y: 200, tam: 100, max: 1600 }, { y: 470, tam: 100, max: 940 });   // titular de arriba
  // estilo de entrada rotativo (nunca dos frases seguidas iguales) y énfasis por palabra: una palabra
  // por frase en durazno o azul; sobre el degradado final el énfasis va en blanco (contraste)
  const ROTA = ["golpe", "sube", "barre", "cae"];
  let nFrase = 0;
  const ENFASIS = { "GRATUITA": "durazno", "VIVO": "cieloClaro", "IA": "cieloClaro", "APROVECHAN": "durazno", "BUCLE": "azul", "LUGAR": "cieloClaro",
    "ESPERARTE.": "durazno", "CAPACITADAS": "cieloClaro", "ELLA.": "durazno", "ARTIFICIAL": "cieloClaro", "PROGRAMAS": "cieloClaro", "TECNOLOGÍA": "azul", "NUEVO.": "durazno",
    "EXCEL": "cieloClaro", "IA": "cieloClaro" };
  const frase = (lineas, anclas, fin, o = {}) => {
    const sobreCielo = o.color === navy, colores = {};
    if (!o.sinEnfasis) lineas.flat().forEach((w, i) => { if (ENFASIS[w] && w !== "CLAUDE") colores[i] = sobreCielo ? K("blanco") : K(ENFASIS[w]); });
    if (sobreCielo) lineas.flat().forEach((w, i) => { if (["LUGAR", "GRATIS.", "MANO.", "EQUIPO", "VIVO"].includes(w)) colores[i] = K("blanco"); });
    const estilo = o.estilo ?? ROTA[nFrase++ % ROTA.length];
    const f = texto(fuente, letras, lineas, { x: o.x ?? CX, y: o.y ?? ARR.y, tam: o.tam ?? ARR.tam, ancla: o.ancla ?? "centro", maxAncho: o.max ?? ARR.max, color: o.color ?? hueso, trazo: o.trazo, interlinea: o.inter ?? 1.0, estilo, colores: { ...colores, ...(o.colores || {}) } });
    f.palabras.forEach((p, i) => dibujar(tl, p, anclas[i], { dur: o.dur ?? 0.32 }));
    if (fin) borrar(tl, f.palabras, fin, { dur: 0.24, escalon: 0.005 });
    return f;
  };
  const w = (i, palabra, n) => T.w(i, palabra, n);
  // aparición con rebote (0 → 1 con un poco de sobretiro)
  const pop = (u) => (u <= 0 ? 0.001 : Math.max(0.001, 1 + 1.7 * Math.pow(u - 1, 3) + 0.7 * Math.pow(u - 1, 2)));
  const linea = (d, t0, t1, o = {}) => chispa.pierna(d, t0, t1, { modo: "dibuja", ancho: o.ancho ?? 5, color: o.color ?? hueso, padre: o.padre ?? escena, borra: o.borra, fin: o.fin, guia: o.guia ?? true, e: o.e ?? ease.suave });
  const dibujo = (padre, d, t0, dur, o = {}) => {
    const p = el("path", { d, fill: o.fill ?? "none", stroke: o.color ?? hueso, "stroke-width": o.ancho ?? 4, "stroke-linecap": "round", "stroke-linejoin": "round" }, padre);
    tl.fromTo(p, { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", duration: dur, ease: "power2.out" }, t0);
    tl.fromTo(p, { visibility: "hidden" }, { visibility: "visible", duration: 0.001 }, t0);
    return p;
  };
  const grupoVentana = (padre, desde, hasta) => {
    const g = el("g", {}, padre);
    tl.fromTo(g, { opacity: 1 }, { opacity: 0, duration: 0.3, ease: "power1.in", immediateRender: false }, hasta);
    return g;
  };
  const avatar = (padre, x, y, s, t0) => {
    const g = el("g", { transform: `translate(${x} ${y}) scale(${s})` }, padre);
    dibujo(g, "M0,-46 a22,22 0 1 1 0.1,0", t0, 0.3, { ancho: 4 });
    dibujo(g, "M-40,30 Q-40,-8 0,-8 Q40,-8 40,30", t0 + 0.1, 0.3, { ancho: 4 });
    return g;
  };

  // la chispa vuela a una palabra, cae encima con un pulso y un anillo, y regresa a su lugar
  const golpear = (pal, tg, desde, volverA) => {
    const enc = { x: pal.cx, y: pal.y - pal.tam * 1.02 };
    chispa.pierna(`M${desde.x},${desde.y} Q${(desde.x + enc.x) / 2},${Math.min(desde.y, enc.y) - 200} ${enc.x},${enc.y}`, tg - 0.32, tg - 0.01, { cola: 200, e: ease.entra2 });
    chispa.tramo(tg - 0.01, tg + 0.28, (t) => ({ x: enc.x, y: enc.y + 10 * Math.exp(-Math.pow((t - tg - 0.03) / 0.05, 2)) }));
    chispa.escala((t) => 1 + 0.7 * Math.exp(-Math.pow((t - tg) / 0.07, 2)));
    onda(tl, fijo, pal.cx, pal.cy, tg, { r0: 30, r1: pal.tam * 1.6, color: K("durazno"), ancho: 4, dur: 0.5 });
    chispa.pierna(`M${enc.x},${enc.y} Q${(volverA.x + enc.x) / 2},${Math.min(volverA.y, enc.y) - 160} ${volverA.x},${volverA.y}`, tg + 0.28, tg + 0.6, { cola: 180 });
    return tg + 0.6;
  };
  // MÉTODO se recoge cuando arranca el cierre
  const m = ctx.medio;
  borrar(tl, [...m.fM.palabras, ...m.fM1.palabras], C.ramal - 0.15, { dur: 0.3, escalon: 0.01 });
  // la chispa espera al final de la línea que escribió MÉTODO
  chispa.quieta(C.metodo - 0.04, C.ramal, CX + q(600, 440), m.yL, 4);

  let tLibre;   // cuándo empieza el respaldo (común)
  if (platica) {
    // ---------------- 09 · la plática gratuita y en vivo ----------------
    const S = q({ x: CX, y: 640, w: 760, h: 430 }, { x: CX, y: 1180, w: 860, h: 520 });
    const fin09 = C.contamos - 0.2;
    const pant = grupoVentana(escena, C.ramal, fin09);
    const x0 = S.x - S.w / 2, y0 = S.y - S.h / 2, x1 = S.x + S.w / 2, y1 = S.y + S.h / 2;
    chispa.pierna(`M${CX + q(600, 440)},${m.yL} Q${x1 + 60},${y0 - 120} ${x1},${y0 + 30}`, C.ramal, C.ramal + 0.35, { cola: 220 });
    linea(`M${x1},${y0 + 30} L${x1},${y1 - 20} Q${x1},${y1} ${x1 - 20},${y1} L${x0 + 20},${y1} Q${x0},${y1} ${x0},${y1 - 20} L${x0},${y0 + 20} Q${x0},${y0} ${x0 + 20},${y0} L${x1 - 20},${y0} Q${x1},${y0} ${x1},${y0 + 30}`, C.ramal + 0.35, C.ramal + 1.2, { padre: pant, ancho: 5 });
    const cols = 3, filas = 2, tw = (S.w - 80) / cols, th = (S.h - 80) / filas;
    for (let i = 0; i < filas; i++) for (let j = 0; j < cols; j++) {
      const tx = x0 + 40 + j * tw, ty = y0 + 40 + i * th, n = i * cols + j;
      const r = el("rect", { x: tx + 8, y: ty + 8, width: tw - 16, height: th - 16, rx: 14, fill: K("navyHondo"), stroke: K("cieloHondo"), "stroke-width": 2 }, pant);
      tl.fromTo(r, { opacity: 0, scale: 0.8, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2)" }, C.ramal + 1.0 + n * 0.08);
      avatar(pant, tx + tw / 2, ty + th / 2 + 12, Math.min(tw, th) / 150, C.ramal + 1.1 + n * 0.08);
      // «dueños y directivos»: cada uno con su corbata
      dibujo(pant, `M${tx + tw / 2 - 7},${ty + th / 2 + 8} L${tx + tw / 2},${ty + th / 2 + 34} L${tx + tw / 2 + 7},${ty + th / 2 + 8}`, C.duenos + n * 0.07, 0.2, { color: K("cieloClaro"), ancho: 3 });
    }
    const vivo = el("circle", { cx: x0 + 34, cy: y0 + 34, r: 0, fill: K("cieloClaro"), filter: "url(#brillo)" }, pant);
    reloj(C.vivo - 0.05, fin09, (t) => { const u = ease.sale3(tramo(t, C.vivo, C.vivo + 0.25)); vivo.setAttribute("r", (11 * u * (1 + 0.25 * Math.sin((t - C.vivo) * 7))).toFixed(2)); });
    onda(tl, pant, x0 + 34, y0 + 34, C.vivo, { r0: 10, r1: 60 });
    const fPl = frase([["PLÁTICA", "GRATUITA"], ["Y", "EN", "VIVO"]], [C.platica, w(9, "gratuita"), w(9, "y"), w(9, "en"), C.vivo], fin09, { estilo: "golpe" });
    const esq = { x: x1, y: y0 + 30 };
    chispa.quieta(C.ramal + 1.2, w(9, "gratuita") - 0.32, esq.x, esq.y, 4);
    const tLib = golpear(fPl.palabras[1], w(9, "gratuita"), esq, esq);
    chispa.quieta(tLib, C.contamos, esq.x, esq.y, 4);
    // quien presenta habla: anillos que laten alrededor de su recuadro; del resto suben chispitas
    const tw0 = x0 + 40 + tw / 2, th0 = y0 + 40 + th / 2;
    for (let k = 0; k < 3; k++) {
      const an = el("rect", { x: x0 + 48, y: y0 + 48, width: tw - 16, height: th - 16, rx: 14, fill: "none", stroke: K("cieloClaro"), "stroke-width": 3, opacity: 0 }, pant);
      reloj(C.ramal + 1.3, fin09, (t) => { const u = ((t - C.ramal - 1.3 - k * 0.4) % 1.2 + 1.2) % 1.2 / 1.2; const g = 1 + u * 0.12; an.setAttribute("transform", `translate(${tw0} ${th0}) scale(${g.toFixed(3)}) translate(${-tw0} ${-th0})`); an.setAttribute("opacity", ((1 - u) * 0.7 * (t > C.ramal + 1.4 ? 1 : 0)).toFixed(3)); });
    }
    const rch = azar(909);
    for (let k = 0; k < 14; k++) {
      const cx0 = x0 + 60 + rch() * (S.w - 120), t0 = C.ramal + 1.6 + k * 0.17, sp = el("path", { d: ctx.CHISPA_D, fill: k % 3 ? K("cieloClaro") : K("durazno"), opacity: 0 }, pant);
      reloj(t0, t0 + 1.4, (t) => { const u = tramo(t, t0, t0 + 1.3); sp.setAttribute("transform", `translate(${cx0.toFixed(1)} ${(y0 + S.h * 0.7 - u * S.h * 0.9).toFixed(1)}) scale(0.8) translate(-12 -12)`); sp.setAttribute("opacity", (Math.sin(u * Math.PI) * 0.9).toFixed(3)); });
    }

    // ---------------- 10 · lo que te contamos: lo que aprendes, con Claude en el centro ----------------
    // (10-oct, nota de Alejandro: «los iconos que hagan alusión a lo que les vamos a enseñar… los logos de
    // las herramientas que van a aprender… PERO TODO CON EL CENTRO DE APRENDER CLAUDE»; y salir del bucle
    // «que se sienta como un círculo que se infla y explota o truena como un cristal»)
    const CO = q({ x: CX, y: 700, rx: 268, ry: 176, rb: 38, aro: 330 }, { x: CX, y: 1180, rx: 330, ry: 300, rb: 44, aro: 420 });
    const tSale = C.truena;
    const cons = el("g", { class: "constelacion" }, escena);
    const radios = el("g", {}, cons);
    // el centro: Claude, en sus colores, con el anillo durazno de la chispa
    const CLh = HERRAMIENTAS.find((h) => h.id === "claude");
    const centroG = el("g", {}, cons);
    el("circle", { r: 66, fill: K("blanco") }, centroG);
    el("path", { d: CLh.d, fill: CLh.hex, transform: `scale(${((66 * 1.12) / 24).toFixed(3)}) translate(-12 -12)` }, centroG);
    const anilloC = el("circle", { r: 82, fill: "none", stroke: K("durazno"), "stroke-width": 4 }, centroG);
    onda(tl, cons, CO.x, CO.y, C.centro, { r0: 60, r1: 260, color: K("durazno"), ancho: 4 });
    // las herramientas que aprendes alrededor de Claude (logos oficiales; Skills y Conectores dibujados)
    const IMG = { excel: "./assets/marca/herramientas/excel.svg", powerpoint: "./assets/marca/herramientas/powerpoint.svg", higgsfield: "./assets/marca/herramientas/higgsfield.svg" };
    const NOMBRE = { skills: "Skills", conectores: "Conectores" };
    const ORDEN = ["excel", "gmail", "powerpoint", "googlesheets", "skills", "googledocs", "higgsfield", "googledrive", "conectores", "googleslides", "google"];
    const herr = ORDEN.map((id, k) => {
      const g = el("g", { opacity: 0 }, cons), dentro = el("g", {}, g);
      const radio = el("path", { fill: "none", stroke: K("cieloClaro"), "stroke-width": 2, opacity: 0 }, radios);
      el("circle", { r: CO.rb, fill: K("blanco") }, dentro);
      const lado = CO.rb * 1.18;
      if (IMG[id]) el("image", { href: IMG[id], x: -lado / 2, y: -lado / 2, width: lado, height: lado }, dentro);
      else if (id === "skills") el("path", { d: D.iconoSkills(0.95), fill: CLh.hex, stroke: CLh.hex, "stroke-width": 2, "stroke-linejoin": "round" }, dentro);
      else if (id === "conectores") el("path", { d: D.iconoConectores(0.85), fill: "none", stroke: navy, "stroke-width": 5, "stroke-linecap": "round", "stroke-linejoin": "round" }, dentro);
      else { const h = HERRAMIENTAS.find((x) => x.id === id); el("path", { d: h.d, fill: h.hex, transform: `scale(${(lado / 24).toFixed(3)}) translate(-12 -12)` }, dentro); }
      if (NOMBRE[id]) {
        const an = id === "skills" ? 92 : 136;
        el("rect", { x: -an / 2, y: CO.rb + 10, width: an, height: 34, rx: 17, fill: K("navyHondo"), stroke: K("cieloClaro"), "stroke-width": 2 }, dentro);
        const tx = el("text", { y: CO.rb + 34, "text-anchor": "middle", "font-family": "Inter", "font-weight": 700, "font-size": 19, fill: hueso }, dentro);
        tx.textContent = NOMBRE[id];
      }
      const a0 = -Math.PI / 2 + (k / ORDEN.length) * Math.PI * 2, t0 = C.herr[k], aT = a0 + 0.22 * (t0 - C.contamos);
      onda(tl, cons, CO.x + Math.cos(aT) * CO.rx, CO.y + Math.sin(aT) * CO.ry, t0, { r0: CO.rb, r1: CO.rb * 2.6, color: K("cieloClaro"), dur: 0.5 });
      return { g, radio, a0, t0 };
    });
    // qué está pasando con la IA: la gráfica que sube (la dibuja la chispa) con herramientas encima
    const GR = q({ x: 150, y: 792, w: 300, h: 200 }, { x: 110, y: 1700, w: 280, h: 190 });
    const tipG = { x: GR.x + GR.w - 10, y: GR.y - GR.h * 0.92 };
    const dGr = mover(D.graficaSube(GR.w, GR.h), GR.x, GR.y) + ` M${(tipG.x - 30).toFixed(1)},${(tipG.y + 4).toFixed(1)} L${tipG.x.toFixed(1)},${tipG.y.toFixed(1)} L${(tipG.x - 8).toFixed(1)},${(tipG.y + 30).toFixed(1)}`;
    const lado10 = el("g", {}, escena);
    const pGr = chispa.pierna(dGr, C.grafica, C.grafica + 0.6, { modo: "dibuja", ancho: 5, color: hueso, padre: lado10 });
    ["googlegemini", "meta", "perplexity"].forEach((id, k) => {
      const p = [[0.3, 0.35], [0.5, 0.28], [0.72, 0.62]][k];
      const b = insignia(lado10, LOGOS.find((x) => x.id === id), { r: 22 });
      b.g.setAttribute("transform", `translate(${(GR.x + GR.w * p[0]).toFixed(1)} ${(GR.y - GR.h * p[1] - 34).toFixed(1)})`);
      tl.fromTo(b.dentro, { scale: 0, opacity: 0, transformOrigin: "50% 50%" }, { scale: 1, opacity: 1, duration: 0.35, ease: "back.out(2.6)" }, C.grafica + 0.35 + k * 0.1);
    });
    // qué hacen las que sí la aprovechan: seis empresas, cada una con su palomita
    const CI = q({ x: 1480, y: 792, w: 320 }, { x: 640, y: 1700, w: 320 });
    const ALT = [105, 160, 125, 190, 140, 115];
    const pCi = chispa.pierna(mover(D.ciudad(CI.w, ALT), CI.x, CI.y), C.ciudad, C.ciudad + 0.8, { modo: "dibuja", ancho: 4, color: hueso, padre: lado10 });
    ALT.forEach((h, k) => {
      const bw = CI.w / ALT.length, ck = el("g", { transform: `translate(${(CI.x + k * bw + bw / 2).toFixed(1)} ${CI.y - h - 26})` }, lado10);
      const c = el("circle", { r: 0, fill: K("azul") }, ck);
      tl.fromTo(c, { attr: { r: 0 } }, { attr: { r: 16 }, duration: 0.25, ease: "back.out(3)" }, C.ciudad + 0.9 + k * 0.12);
      dibujo(ck, "M-7,0 L-2,6 L8,-6", C.ciudad + 0.96 + k * 0.12, 0.16, { ancho: 3.5 });
    });
    // cómo salir del bucle: la chispa traza el bucle alrededor de todo; se infla como vidrio y truena
    const aroP = chispa.pierna(circulo(CO.x, CO.y, CO.aro), C.aro, C.aro + 0.5, { modo: "dibuja", ancho: 7, color: K("azul"), padre: cons, e: ease.seno, fin: C.aro + 0.5 });
    const vidrio = el("circle", { cx: CO.x, cy: CO.y, r: CO.aro, fill: K("cieloClaro"), "fill-opacity": 0, stroke: K("azul"), "stroke-width": 7, opacity: 0 }, cons);
    const RV = CO.aro * 1.12, aI = -0.7, IMP = { x: CO.x + Math.cos(aI) * RV, y: CO.y + Math.sin(aI) * RV };
    reloj(C.aro + 0.49, tSale + 0.01, (t) => {
      const u = ease.sale3(tramo(t, C.aro + 0.5, tSale)), tiembla = u * 7 * Math.sin(t * 46);
      vidrio.setAttribute("r", (CO.aro + (RV - CO.aro) * u + tiembla).toFixed(1));
      vidrio.setAttribute("fill-opacity", (0.18 * u).toFixed(3));
      vidrio.setAttribute("stroke-width", (7 + 4 * u).toFixed(2));
      vidrio.setAttribute("opacity", t >= C.aro + 0.5 && t < tSale ? 1 : 0);
    });
    // grietas que salen del golpe de la chispa
    const rg = azar(1010);
    for (let k = 0; k < 7; k++) {
      let x = IMP.x, y = IMP.y, d = `M${x.toFixed(1)},${y.toFixed(1)}`;
      const dir = Math.atan2(CO.y - IMP.y, CO.x - IMP.x) + (k - 3) * 0.32;
      for (let s = 0; s < 4; s++) { const l = 60 + rg() * 90, a = dir + (rg() - 0.5) * 0.7; x += Math.cos(a) * l; y += Math.sin(a) * l; d += ` L${x.toFixed(1)},${y.toFixed(1)}`; }
      const gr = el("path", { d, fill: "none", stroke: hueso, "stroke-width": 3, "stroke-linecap": "round", "stroke-linejoin": "round" }, cons);
      tl.fromTo(gr, { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", duration: 0.09, ease: "power1.out" }, tSale - 0.09 + k * 0.004);
      tl.fromTo(gr, { visibility: "hidden" }, { visibility: "visible", duration: 0.001 }, tSale - 0.09);
      tl.fromTo(gr, { opacity: 1 }, { opacity: 0, duration: 0.001, immediateRender: false }, tSale);
    }
    // los vidrios: el disco partido en anillos y sectores, cada pedazo sale volando y girando
    const vidrios = el("g", {}, escena), rv = azar(2020), piezas = [];
    const ANI = [0, 0.38, 0.7, 1.0], SEC = 12;
    for (let i = 0; i < ANI.length - 1; i++) for (let j = 0; j < SEC; j++) {
      const a0 = (j / SEC) * Math.PI * 2 + (rv() - 0.5) * 0.12, a1 = ((j + 1) / SEC) * Math.PI * 2 + (rv() - 0.5) * 0.12;
      const r0 = ANI[i] * RV * (i ? 0.94 + rv() * 0.12 : 0), r1 = ANI[i + 1] * RV * (0.94 + rv() * 0.12);
      const pts = [[r0, a0], [r1, a0], [r1, (a0 + a1) / 2], [r1, a1], [r0, a1]].map(([r, a]) => [Math.cos(a) * r, Math.sin(a) * r]);
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      const g = el("g", { opacity: 0 }, vidrios);
      el("path", { d: "M" + pts.map((p) => `${(p[0] - cx).toFixed(1)},${(p[1] - cy).toFixed(1)}`).join(" L") + " Z", fill: rv() < 0.25 ? hueso : K("cieloClaro"), "fill-opacity": 0.22 + rv() * 0.2, stroke: hueso, "stroke-width": 2, "stroke-linejoin": "round" }, g);
      const dir = Math.atan2(cy, cx), v = 700 + rv() * 900;
      piezas.push({ g, x: CO.x + cx, y: CO.y + cy, vx: Math.cos(dir) * v, vy: Math.sin(dir) * v - 200 * rv(), giro: (rv() - 0.5) * 520 });
    }
    reloj(tSale - 0.01, tSale + 0.9, (t) => {
      const u = tramo(t, tSale, tSale + 0.85), d = ease.sale3(u);
      for (const p of piezas) {
        p.g.setAttribute("transform", `translate(${(p.x + p.vx * d).toFixed(1)} ${(p.y + p.vy * d + 260 * u * u).toFixed(1)}) rotate(${(p.giro * d).toFixed(1)})`);
        p.g.setAttribute("opacity", t < tSale ? 0 : (1 - ease.entra2(u)).toFixed(3));
      }
    });
    const flashV = el("rect", { width: W, height: H, fill: hueso, opacity: 0 }, fijo);
    tl.fromTo(flashV, { opacity: 0 }, { opacity: 0.3, duration: 0.03 }, tSale);
    tl.fromTo(flashV, { opacity: 0.3 }, { opacity: 0, duration: 0.4, ease: "power2.out", immediateRender: false }, tSale + 0.03);
    onda(tl, fijo, CO.x, CO.y, tSale, { r0: RV, r1: RV * 2.4, color: hueso, ancho: 5, dur: 0.6 });
    cam.sacudir(tSale, 0.45, 16);
    // todo gira, todo sale volando con el vidrio; Claude se recoge en la chispa
    reloj(C.contamos, tSale + 0.9, (t) => {
      const rot = 0.22 * (t - C.contamos), vuela = ease.entra2(tramo(t, tSale, tSale + 0.55));
      for (const h of herr) {
        const a = h.a0 + rot, s = pop(tramo(t, h.t0, h.t0 + 0.4)), k = 1 + vuela * 2.4;
        const x = CO.x + Math.cos(a) * CO.rx * k, y = CO.y + Math.sin(a) * CO.ry * k;
        h.g.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(s * (1 - 0.3 * vuela)).toFixed(3)})`);
        h.g.setAttribute("opacity", t < h.t0 ? 0 : (1 - vuela).toFixed(3));
        const hu = ease.sale3(tramo(t, h.t0 - 0.05, h.t0 + 0.25)), xr = CO.x + Math.cos(a) * CO.rx, yr = CO.y + Math.sin(a) * CO.ry;
        h.radio.setAttribute("d", `M${CO.x},${CO.y} L${(CO.x + (xr - CO.x) * hu).toFixed(1)},${(CO.y + (yr - CO.y) * hu).toFixed(1)}`);
        h.radio.setAttribute("opacity", t < h.t0 - 0.05 ? 0 : (0.5 * (1 - tramo(t, tSale - 0.02, tSale + 0.05))).toFixed(3));
      }
      const sc = pop(tramo(t, C.centro, C.centro + 0.4)) * (1 - ease.entra3(tramo(t, tSale + 0.2, tSale + 0.55)));
      centroG.setAttribute("transform", `translate(${CO.x} ${CO.y}) scale(${Math.max(0.001, sc).toFixed(3)})`);
      centroG.setAttribute("opacity", t < C.centro ? 0 : 1);
      anilloC.setAttribute("r", (82 + 5 * Math.sin(t * 4.2)).toFixed(2));
      lado10.setAttribute("opacity", (1 - tramo(t, tSale, tSale + 0.3)).toFixed(3));
    });
    // la chispa: aterriza en Claude, dibuja la gráfica, la ciudad, el bucle; lo golpea y regresa al centro
    const sobreC = { x: CO.x, y: CO.y - 104 };
    const vuelo = (a, b, t0, t1, alto = 120) => chispa.pierna(`M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${((a.x + b.x) / 2).toFixed(1)},${(Math.min(a.y, b.y) - alto).toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`, t0, t1, { cola: 200, e: ease.suave });
    const pt = (tr, u) => tr.path.getPointAtLength(u * tr.L);
    vuelo(esq, sobreC, C.contamos, C.centro, 80);
    chispa.quieta(C.centro, C.grafica - 0.35, sobreC.x, sobreC.y, 4);
    vuelo(sobreC, pt(pGr, 0), C.grafica - 0.35, C.grafica, 100);
    chispa.quieta(C.grafica + 0.6, C.ciudad - 0.35, tipG.x - 8, tipG.y + 30, 4);
    vuelo(pt(pGr, 1), pt(pCi, 0), C.ciudad - 0.35, C.ciudad, 160);
    const sobreCi = { x: CI.x + CI.w / 2, y: CI.y - 250 };
    vuelo(pt(pCi, 1), sobreCi, C.ciudad + 0.8, C.ciudad + 0.95, 40);
    chispa.quieta(C.ciudad + 0.95, C.aro - 0.3, sobreCi.x, sobreCi.y, 4);
    vuelo(sobreCi, pt(aroP, 0), C.aro - 0.3, C.aro, -60);
    const fuera = { x: CO.x + Math.cos(aI) * (RV + 170), y: CO.y + Math.sin(aI) * (RV + 170) };
    vuelo(pt(aroP, 1), fuera, C.aro + 0.5, C.aro + 0.68, -120);
    chispa.quieta(C.aro + 0.68, tSale - 0.12, fuera.x, fuera.y, 4);
    chispa.pierna(`M${fuera.x.toFixed(1)},${fuera.y.toFixed(1)} L${IMP.x.toFixed(1)},${IMP.y.toFixed(1)}`, tSale - 0.12, tSale - 0.03, { cola: 160, e: ease.entra2 });
    chispa.escala((t) => 1 + 0.9 * Math.exp(-Math.pow((t - tSale + 0.03) / 0.06, 2)));
    vuelo(IMP, { x: CO.x, y: CO.y }, tSale + 0.02, tSale + 0.25, 60);
    chispa.quieta(tSale + 0.25, C.todo - 0.4, CO.x, CO.y, 3);
    frase(q([["QUÉ", "ESTÁ", "PASANDO"], ["CON", "LA", "IA"]], [["QUÉ", "ESTÁ"], ["PASANDO"], ["CON", "LA", "IA"]]), [C.b[0], w(10, "está"), w(10, "pasando"), w(10, "con", 1), w(10, "la", 1), w(10, "IA,")], C.b[1] - 0.26);
    frase(q([["QUÉ", "HACEN", "LAS", "QUE"], ["SÍ", "LA", "APROVECHAN"]], [["QUÉ", "HACEN"], ["LAS", "QUE", "SÍ"], ["LA", "APROVECHAN"]]), [C.b[1], w(10, "hacen"), w(10, "las"), w(10, "que", 3), w(10, "sí"), w(10, "la", 2), w(10, "aprovechan,")], C.b[2] - 0.24);
    frase(q([["CÓMO", "SALIR"], ["DEL", "BUCLE"]], [["CÓMO", "SALIR"], ["DEL", "BUCLE"]]), [C.b[2], w(10, "salir"), w(10, "del"), w(10, "bucle:")], C.todo - 0.3);
    unLugar(CO.x, CO.y, [C.todo, w(10, "en", 1), w(10, "un", 1), w(10, "mismo", 1), C.lugar], [w(10, "con", 2), C.claude, w(10, "y", 2), w(10, "un", 2), w(10, "mismo", 2), C.metodo2], true);
    resuelven([w(10, "que", 4), w(10, "tu"), C.equipo2, C.resuelva, w(10, "sin"), C.esperarte]);
  } else {
    // ---------------- 09 · Claude en tu Empresa ----------------
    const tit = q({ y: 480, tam: 160 }, { y: 920, tam: 140 });
    const fT = frase([["CLAUDE"], ["EN", "TU", "EMPRESA"]], [C.claude, w(9, "en"), w(9, "tu", 1), C.empresaT], C.aprende - 0.55, { y: tit.y, tam: tit.tam, max: q(1500, 900), inter: 1.12 });
    fT.palabras[0].glifos.forEach((g) => { g.setAttribute("fill", K("durazno")); g.setAttribute("stroke", K("durazno")); });
    const cl = fT.palabras[0];
    const ast = { x: cl.x1 + q(56, 50), y: cl.y - q(100, 88) };
    chispa.pierna(`M${CX + q(600, 440)},${m.yL} Q${ast.x + 200},${ast.y - 260} ${ast.x},${ast.y}`, C.ramal, C.claude + 0.05, { cola: 260, e: ease.suave });
    chispa.quieta(C.claude + 0.05, C.aprende - 0.55, ast.x, ast.y, 0);
    chispa.escala((t) => 1 + 0.5 * ease.sale3(tramo(t, C.claude, C.claude + 0.3)) * (1 - tramo(t, C.aprende - 0.7, C.aprende - 0.5)));
    onda(tl, fijo, ast.x, ast.y, C.claude + 0.05, { r0: 20, r1: 260, color: K("durazno"), ancho: 4 });
    // ---------------- 09b · tu equipo aprende, dentro de lo que ya usa ----------------
    const eq = grupoVentana(escena, C.aprende - 0.6, C.apps[0] - 0.35);
    const AV = q({ y: 640, dx: 230, s: 1.15 }, { y: 1160, dx: 190, s: 1.0 });
    const avs = [-2, -1, 0, 1, 2].map((n, i) => { avatar(eq, CX + n * AV.dx, AV.y, AV.s, C.aprende - 0.4 + i * 0.08); return { x: CX + n * AV.dx, y: AV.y - 70 * AV.s }; });
    avs.forEach((a, i) => { const s = el("path", { d: ctx.CHISPA_D, transform: `translate(${a.x} ${a.y - 34}) scale(1.4) translate(-12 -12)`, fill: K("durazno") }, eq); tl.fromTo(s, { opacity: 0, scale: 0.2, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2.5)" }, w(9, "usar") + i * 0.07); });
    chispa.pierna(`M${ast.x},${ast.y} Q${CX},${AV.y - 380} ${avs[2].x},${avs[2].y - 90}`, C.aprende - 0.55, C.aprende - 0.1, { cola: 200 });
    chispa.quieta(C.aprende - 0.1, C.apps[0] - 0.4, avs[2].x, avs[2].y - 90, 5);
    frase([["TU", "EQUIPO", "APRENDE"], ["A", "USAR", "LA", "IA"]], [w(9, "tu", 2), w(9, "equipo"), C.aprende, w(9, "a"), w(9, "usar"), w(9, "la"), w(9, "inteligencia")], C.apps[0] - 0.4);
    const AP = q({ y: 620, dx: 470, s: 1 }, { y: 1150, dx: 320, s: 0.82 });
    const appsG = grupoVentana(escena, C.apps[0] - 0.4, C.sin[0] - 0.3);
    const nombres = [["EXCEL"], ["WORD"], ["CORREO"]];
    C.apps.forEach((ta, k) => {
      const ax = CX + (k - 1) * AP.dx, ay = AP.y, s = AP.s;
      const g = el("g", { transform: `translate(${ax} ${ay}) scale(${s})` }, appsG);
      onda(tl, appsG, ax, ay, ta, { r0: 30, r1: 200 * s });
      dibujo(g, "M-130,-100 L130,-100 Q140,-100 140,-90 L140,90 Q140,100 130,100 L-130,100 Q-140,100 -140,90 L-140,-90 Q-140,-100 -130,-100", ta - 0.05, 0.4, { ancho: 5 });
      if (k === 0) for (let r = 0; r < 4; r++) { dibujo(g, `M-120,${-60 + r * 45} L120,${-60 + r * 45}`, ta + 0.15 + r * 0.04, 0.25, { color: K("cieloClaro"), ancho: 2 }); dibujo(g, `M${-120 + r * 80},-80 L${-120 + r * 80},80`, ta + 0.2 + r * 0.04, 0.25, { color: K("cieloClaro"), ancho: 2 }); }
      if (k === 1) [200, 240, 180, 220, 140].forEach((lw, r) => dibujo(g, `M-110,${-60 + r * 30} L${-110 + lw},${-60 + r * 30}`, ta + 0.15 + r * 0.05, 0.25, { color: K("cieloClaro"), ancho: 6 }));
      if (k === 2) dibujo(g, "M-110,-60 L0,20 L110,-60", ta + 0.15, 0.35, { color: K("cieloClaro"), ancho: 6 });
      const sp = el("path", { d: ctx.CHISPA_D, transform: "translate(104 -64) scale(1.9) translate(-12 -12)", fill: K("durazno"), filter: "url(#brillo)" }, g);
      tl.fromTo(sp, { opacity: 0, scale: 0.1, transformOrigin: "50% 50%", rotation: -90 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.4, ease: "back.out(2.6)" }, ta + 0.12);
      const n = texto(fuente, appsG, [nombres[k]], { x: ax, y: ay + 175 * s, tam: q(64, 56) });
      dibujar(tl, n.palabras[0], ta, { dur: 0.3 });
    });
    chispa.pierna(`M${avs[2].x},${avs[2].y - 90} L${CX - AP.dx},${AP.y - 200}`, C.apps[0] - 0.4, C.apps[0] + 0.05, { cola: 160 });
    chispa.pierna(`M${CX - AP.dx},${AP.y - 200} Q${CX - AP.dx / 2},${AP.y - 320} ${CX},${AP.y - 200}`, C.apps[1] - 0.25, C.apps[1] + 0.05, { cola: 160 });
    chispa.pierna(`M${CX},${AP.y - 200} Q${CX + AP.dx / 2},${AP.y - 320} ${CX + AP.dx},${AP.y - 200}`, C.apps[2] - 0.25, C.apps[2] + 0.05, { cola: 160 });
    chispa.quieta(C.apps[2] + 0.05, C.sin[0] - 0.3, CX + AP.dx, AP.y - 200, 5);
    // ---------------- 10 · sin cambiar, sin saber, sin contratar ----------------
    const SI = q({ y: 640, s: 1.3 }, { y: 1180, s: 1.3 });
    const ICONOS_SIN = [
      "M-60,-50 L60,-50 Q70,-50 70,-40 L70,40 Q70,50 60,50 L-60,50 Q-70,50 -70,40 L-70,-40 Q-70,-50 -60,-50 M0,-28 L0,22 M-20,4 L0,24 L20,4",   // otro programa que instalar
      "M-30,-40 L-70,0 L-30,40 M30,-40 L70,0 L30,40 M14,-52 L-14,52",                                                                  // código
      "M-20,-40 a24,24 0 1 1 0.1,0 M-64,48 Q-64,6 -20,6 Q24,6 24,48 M48,-6 L48,34 M28,14 L68,14",                                          // alguien nuevo
    ];
    const fines = [C.sin[1] - 0.25, C.sin[2] - 0.25, C.todo - 0.35];
    const lineasSin = [[["SIN", "CAMBIAR"], ["DE", "PROGRAMAS"]], [["SIN", "SABER"], ["DE", "TECNOLOGÍA"]], q([["SIN", "CONTRATAR"], ["A", "NADIE", "NUEVO."]], [["SIN", "CONTRATAR"], ["A", "NADIE"], ["NUEVO."]])];
    const anclasSin = [
      [C.sin[0], w(10, "cambiar"), w(10, "de", 1), w(10, "programas,")],
      [C.sin[1], w(10, "saber"), w(10, "de", 2), w(10, "tecnología")],
      [C.sin[2], w(10, "contratar"), w(10, "a"), w(10, "nadie"), w(10, "nuevo.")],
    ];
    C.sin.forEach((ts, k) => {
      const g = grupoVentana(escena, ts - 0.1, fines[k]);
      const ig = el("g", { transform: `translate(${CX} ${SI.y}) scale(${SI.s})` }, g);
      dibujo(ig, ICONOS_SIN[k], ts, 0.4, { ancho: 5, color: K("cieloClaro") });
      dibujo(ig, "M-90,70 L90,-70", ts + 0.32, 0.16, { ancho: 9, color: hueso });   // tachado
      onda(tl, g, CX, SI.y, ts + 0.34, { r0: 40, r1: 220, color: hueso });
      frase(lineasSin[k], anclasSin[k], fines[k]);
    });
    chispa.pierna(`M${CX + AP.dx},${AP.y - 200} Q${CX + 300},${SI.y - 300} ${CX + 200 * SI.s},${SI.y - 150 * SI.s}`, C.sin[0] - 0.3, C.sin[0] + 0.1, { cola: 160 });
    chispa.quieta(C.sin[0] + 0.1, C.todo - 0.4, CX + 200 * SI.s, SI.y - 150 * SI.s, 5);
    unLugar(CX + 200 * SI.s, SI.y - 150 * SI.s, [C.todo, w(11, "en"), w(11, "un", 1), w(11, "mismo", 1), C.lugar], [w(11, "con"), w(11, "un", 2), w(11, "mismo", 2), C.metodo2], false);
    resuelven([w(11, "que"), w(11, "tu"), C.equipo2, C.resuelva, w(11, "sin"), C.esperarte]);
  }

  // ---------------- todo en un mismo lugar: una sola ventana con la chispa en el encabezado ----------------
  function unLugar(desdeX, desdeY, anclas1, anclas2, conClaude) {
    const Wn = q({ x: CX, y: 650, w: 720, h: 440 }, { x: CX, y: 1080, w: 840, h: 520 });
    const fin = C.equipo2 - 0.25;
    const g = grupoVentana(escena, C.todo - 0.4, C.respaldan - 0.35);
    const x0 = Wn.x - Wn.w / 2, y0 = Wn.y - Wn.h / 2, x1 = Wn.x + Wn.w / 2, y1 = Wn.y + Wn.h / 2;
    chispa.pierna(`M${desdeX},${desdeY} Q${x0 - 120},${y0 - 200} ${x0},${y0 + 24}`, C.todo - 0.4, C.todo, { cola: 220 });
    linea(`M${x0},${y0 + 24} Q${x0},${y0} ${x0 + 24},${y0} L${x1 - 24},${y0} Q${x1},${y0} ${x1},${y0 + 24} L${x1},${y1 - 24} Q${x1},${y1} ${x1 - 24},${y1} L${x0 + 24},${y1} Q${x0},${y1} ${x0},${y1 - 24} Z`, C.todo, C.todo + 0.5, { padre: g, ancho: 6 });
    dibujo(g, `M${x0 + 4},${y0 + 64} L${x1 - 4},${y0 + 64}`, C.todo + 0.4, 0.3, { ancho: 3, color: K("cieloClaro") });
    [0, 1, 2].forEach((n) => { const c = el("circle", { cx: x0 + 34 + n * 26, cy: y0 + 32, r: 0, fill: K("cieloClaro") }, g); tl.fromTo(c, { attr: { r: 0 } }, { attr: { r: 7 }, duration: 0.2 }, C.todo + 0.45 + n * 0.05); });
    // el trabajo suelto (hojas y avisos de 05) entra ordenado a la ventana
    const r = azar(909);
    for (let n = 0; n < 6; n++) {
      const i = Math.floor(n / 3), j = n % 3, cw = (Wn.w - 120) / 3, chh = (Wn.h - 150) / 2;
      const hx = x0 + 40 + j * (cw + 20) + cw / 2, hy = y0 + 96 + i * (chh + 18) + chh / 2;
      const card = el("g", {}, g);
      el("rect", { x: -cw / 2, y: -chh / 2, width: cw, height: chh, rx: 14, fill: K("navyHondo"), stroke: n % 2 ? K("cieloClaro") : hueso, "stroke-width": 2.5 }, card);
      for (let l = 0; l < 3; l++) el("rect", { x: -cw / 2 + 22, y: -chh / 2 + 26 + l * 28, width: (cw - 44) * [0.9, 0.6, 0.75][l], height: 10, rx: 5, fill: l ? K("gris") : K("cieloClaro") }, card);
      const t0 = C.todo + n * 0.09, ang = r() * Math.PI * 2;
      tl.fromTo(card, { x: hx + Math.cos(ang) * q(1100, 800), y: hy + Math.sin(ang) * q(800, 1100), rotation: (r() - 0.5) * 60, scale: 0.6 }, { x: hx, y: hy, rotation: 0, scale: 1, duration: 0.55, ease: "expo.out" }, t0);
      tl.fromTo(card, { visibility: "hidden" }, { visibility: "visible", duration: 0.001 }, t0);
    }
    const head = { x: x1 - 44, y: y0 + 32 };
    chispa.pierna(`M${x0},${y0 + 24} Q${Wn.x},${y0 - 90} ${head.x},${head.y}`, C.todo + 0.5, (conClaude ? C.claude : C.lugar) + 0.05, { cola: 200 });
    chispa.quieta((conClaude ? C.claude : C.lugar) + 0.05, C.esperarte - 0.32, head.x, head.y, 0);
    onda(tl, g, head.x, head.y, (conClaude ? C.claude : C.lugar) + 0.05, { r0: 16, r1: 160, color: K("durazno"), ancho: 4 });
    // progreso en el encabezado y una palomita en cada tarjeta cuando entra «un mismo método»
    const barP = el("rect", { x: x0 + 120, y: y0 + 26, width: 0, height: 12, rx: 6, fill: K("azul") }, g);
    tl.fromTo(barP, { attr: { width: 0 } }, { attr: { width: Wn.w - 240 }, duration: 1.4, ease: "power2.inOut" }, C.todo + 0.6);
    for (let n = 0; n < 6; n++) {
      const i = Math.floor(n / 3), j = n % 3, cw = (Wn.w - 120) / 3, chh = (Wn.h - 150) / 2;
      const hx = x0 + 40 + j * (cw + 20) + cw - 22, hy = y0 + 96 + i * (chh + 18) + 22;
      const ck = el("g", { transform: `translate(${hx} ${hy})` }, g);
      const c = el("circle", { r: 0, fill: K("azul") }, ck);
      tl.fromTo(c, { attr: { r: 0 } }, { attr: { r: 15 }, duration: 0.25, ease: "back.out(3)" }, C.metodo2 + n * 0.06);
      dibujo(ck, "M-7,0 L-2,6 L8,-6", C.metodo2 + 0.06 + n * 0.06, 0.16, { ancho: 3.5 });
    }
    // «un mismo método»: la ventana se cierra con un clic (borde más grueso que late una vez)
    const borde = el("rect", { x: x0 - 8, y: y0 - 8, width: Wn.w + 16, height: Wn.h + 16, rx: 32, fill: "none", stroke: K("azul"), "stroke-width": 0 }, g);
    tl.fromTo(borde, { attr: { "stroke-width": 0 }, opacity: 1 }, { attr: { "stroke-width": 10 }, duration: 0.12, ease: "power2.out" }, C.metodo2);
    tl.fromTo(borde, { attr: { "stroke-width": 10 } }, { attr: { "stroke-width": 3 }, duration: 0.5, ease: "power2.out", immediateRender: false }, C.metodo2 + 0.12);
    frase([["TODO", "EN", "UN"], ["MISMO", "LUGAR"]], anclas1, anclas2[0] - 0.3);
    const f2 = frase(conClaude ? [["CON", "CLAUDE", "Y", "UN"], ["MISMO", "MÉTODO"]] : [["CON", "UN"], ["MISMO", "MÉTODO"]], anclas2, fin);
    if (conClaude) f2.palabras[1].glifos.forEach((gl) => { gl.setAttribute("fill", K("durazno")); gl.setAttribute("stroke", K("durazno")); });
    ctx.ventanaFinal = { Wn, g, head };
  }

  // ---------------- que tu equipo resuelva sin esperarte: palomitas, ningún hilo hacia ti ----------------
  function resuelven(anclas) {
    const Wn = ctx.ventanaFinal.Wn;
    const g = grupoVentana(escena, C.equipo2 - 0.3, C.respaldan - 0.35);
    const xs = [-2, -1, 0, 1, 2].map((n) => Wn.x + n * q(150, 150));
    const ya = Wn.y + Wn.h / 2 + q(120, 170);
    xs.forEach((x, i) => {
      avatar(g, x, ya, 0.8, C.equipo2 - 0.2 + i * 0.06);
      const ck = el("g", { transform: `translate(${x + 32} ${ya - 54})` }, g);
      const c = el("circle", { r: 0, fill: K("azul") }, ck);
      tl.fromTo(c, { attr: { r: 0 } }, { attr: { r: 18 }, duration: 0.3, ease: "back.out(3)" }, C.resuelva + i * 0.11);
      dibujo(ck, "M-8,0 L-2,7 L9,-7", C.resuelva + 0.08 + i * 0.11, 0.18, { ancho: 4 });
    });
    // tú, aparte y sin hilos: ya no te esperan
    const tu = el("circle", { cx: Wn.x + Wn.w / 2 + q(160, 0), cy: q(ya - 60, Wn.y - Wn.h / 2 - 120), r: 0, fill: K("gris") }, g);
    if (!V) tl.fromTo(tu, { attr: { r: 0 } }, { attr: { r: 30 }, duration: 0.4, ease: "back.out(2)" }, C.esperarte - 0.2);
    const fR = frase(q([["QUE", "TU", "EQUIPO", "RESUELVA"], ["SIN", "ESPERARTE."]], [["QUE", "TU", "EQUIPO"], ["RESUELVA"], ["SIN", "ESPERARTE."]]), anclas, C.respaldan - 0.3, { estilo: "sube" });
    const hv0 = ctx.ventanaFinal.head;
    golpear(fR.palabras.at(-1), C.esperarte, hv0, hv0);
    chispa.quieta(C.esperarte + 0.6, C.respaldan - 0.3, hv0.x, hv0.y, 0);
  }

  // ---------------- respaldo (plática): VADAI × Total Coach más grandes y con movimiento; cientos de empresas
  // que no paran de llegar, hasta el infinito (10-oct, notas de Alejandro) ----------------
  const iR = platica ? 11 : 12;
  const finR = C.porque2 - 0.3;
  const hV = 62, wV = (3839 / 1302) * hV, hT = 58, wT = (1110 / 252) * hT, gap = 70;   // la placa final de la tarjeta
  let finRespaldo;   // dónde queda la chispa al terminar el respaldo
  if (platica) {
    const PL = q({ x: CX, y: 452, w: 1060, h: 214, yArriba: 214 }, { x: CX, y: 760, w: 980, h: 200, yArriba: 470 });
    const placaG = el("g", {}, escena), placa = el("g", {}, placaG);
    el("rect", { x: -PL.w / 2, y: -PL.h / 2, width: PL.w, height: PL.h, rx: PL.h / 2, fill: K("blanco") }, placa);
    // un brillo que cruza la placa (por debajo de los logos: los logos no se tocan)
    const cpId = "placa-cp";
    el("rect", { x: -PL.w / 2, y: -PL.h / 2, width: PL.w, height: PL.h, rx: PL.h / 2 }, el("clipPath", { id: cpId }, placa));
    const brilloP = el("rect", { x: -60, y: -PL.h, width: 110, height: PL.h * 2, fill: K("cieloClaro"), opacity: 0.28, transform: "skewX(-22)" }, el("g", { "clip-path": `url(#${cpId})` }, placa));
    tl.fromTo(brilloP, { x: -PL.w / 2 - 260 }, { x: PL.w / 2 + 260, duration: 0.7, ease: "power2.inOut" }, C.respaldan + 1.6);
    const hVg = 88, wVg = (3839 / 1302) * hVg, hTg = 84, wTg = (1110 / 252) * hTg, gapG = 84;   // Total Coach por debajo de su tamaño nativo (252 px)
    const lxg = -(wVg + gapG + wTg) / 2;
    const iV = el("image", { href: "./assets/marca/vadai-horizontal-recorte.png", x: lxg, y: -hVg / 2, width: wVg, height: hVg }, placa);
    el("rect", { x: lxg + wVg + gapG / 2 - 1, y: -34, width: 2, height: 68, fill: hueso }, placa);
    const iT = el("image", { href: "./assets/marca/totalcoach-recorte.png", x: lxg + wVg + gapG, y: -hTg / 2, width: wTg, height: hTg }, placa);
    tl.fromTo(placa, { opacity: 0, scale: 0.6, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: 0.55, ease: "back.out(2)" }, C.respaldan);
    tl.fromTo(iV, { opacity: 0, scale: 0.4, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(2.6)" }, C.vadai);
    tl.fromTo(iT, { opacity: 0, scale: 0.4, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(2.6)" }, C.total);
    tl.fromTo(placa, { opacity: 1 }, { opacity: 0, duration: 0.3, immediateRender: false }, finR);
    // la placa flota y respira; cuando entran los «cientos» sube para dejarles el centro
    reloj(C.respaldan - 0.1, finR + 0.35, (t) => {
      const sube = ease.suave(tramo(t, C.cuarenta - 0.3, C.cuarenta + 0.15)), flota = tramo(t, C.cuarenta - 0.3, C.cuarenta + 0.2);
      const y = PL.y + (PL.yArriba - PL.y) * sube + 7 * Math.sin((t - C.respaldan) * 1.7) * flota;
      const late = 1 + 0.035 * Math.exp(-Math.pow((t - C.vadai - 0.1) / 0.12, 2)) + 0.035 * Math.exp(-Math.pow((t - C.total - 0.1) / 0.12, 2));
      placaG.setAttribute("transform", `translate(${PL.x} ${y.toFixed(1)}) rotate(${(0.6 * Math.sin((t - C.respaldan) * 1.1) * flota).toFixed(2)}) scale(${((1 - 0.2 * sube) * late).toFixed(4)})`);
    });
    // la chispa rodea la placa con un trazo durazno
    const m0 = 14, ox0 = PL.x - PL.w / 2 - m0, ox1 = PL.x + PL.w / 2 + m0, oy0 = PL.y - PL.h / 2 - m0, oy1 = PL.y + PL.h / 2 + m0, rr = PL.h / 2 + m0;
    const dPl = `M${PL.x},${oy0} L${ox1 - rr},${oy0} A${rr},${rr} 0 0 1 ${ox1 - rr},${oy1} L${ox0 + rr},${oy1} A${rr},${rr} 0 0 1 ${ox0 + rr},${oy0} L${PL.x},${oy0}`;
    const pPl = chispa.pierna(dPl, C.respaldan + 0.05, C.respaldan + 0.7, { modo: "dibuja", ancho: 4, color: K("durazno"), borra: [C.cuarenta - 0.45, C.cuarenta - 0.2], e: ease.suave });
    const hv = ctx.ventanaFinal.head;
    chispa.pierna(`M${hv.x},${hv.y} Q${PL.x + 200},${oy0 - 160} ${PL.x},${oy0}`, C.respaldan - 0.3, C.respaldan + 0.05, { cola: 200 });
    chispa.quieta(C.respaldan + 0.7, C.cuarenta - 0.45, PL.x, oy0, 4);
    // el contador: de 10 a 900 en lo que dice «cientos…», y la chispa lo vuelve infinito
    const YINF = q(414, 760);
    const cont = dom("div", "contador", "+10");
    Object.assign(cont.style, { left: "0px", right: "0px", top: `${YINF - 96}px`, textAlign: "center" });
    tl.fromTo(cont, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.35, ease: "expo.out" }, C.cuarenta - 0.1);
    const nC = { v: 0 }, fmt = (u) => `+${Math.round(10 * Math.pow(90, Math.pow(Math.min(1, Math.max(0, u)), 0.9)))}`;
    tl.fromTo(nC, { v: 0 }, { v: 1, duration: C.infinito - 0.15 - C.cuarenta, ease: "power1.in", onUpdate: () => { cont.textContent = fmt(nC.v); }, modifiers: { v: (x) => { cont.textContent = fmt(+x); return x; } } }, C.cuarenta);
    tl.to(cont, { opacity: 0, scale: 1.3, duration: 0.14, ease: "power2.in" }, C.infinito - 0.15);
    const dInf = mover(D.infinito(200), CX, YINF);
    const gInf = el("g", {}, escena);
    const pInf = chispa.pierna(dInf, C.infinito, C.infinito + 0.55, { modo: "dibuja", ancho: 16, color: K("cieloClaro"), padre: gInf, e: ease.suave });
    const destello = el("path", { d: dInf, fill: "none", stroke: hueso, "stroke-width": 7, "stroke-linecap": "round", opacity: 0 }, gInf);
    reloj(C.infinito + 0.5, finR + 0.35, (t) => {
      const L = pInf.L, u = ((t - C.infinito - 0.55) * 0.55) % 1;
      destello.setAttribute("stroke-dasharray", `90 ${(L - 90).toFixed(1)}`);
      destello.setAttribute("stroke-dashoffset", (-u * L).toFixed(1));
      destello.setAttribute("opacity", t >= C.infinito + 0.55 ? 0.9 : 0);
      pInf.path.setAttribute("filter", t >= C.infinito + 0.55 ? "url(#brillo)" : "none");
    });
    tl.fromTo(gInf, { opacity: 1 }, { opacity: 0, duration: 0.3, immediateRender: false }, finR);
    const pInf0 = pInf.path.getPointAtLength(0);
    chispa.pierna(`M${PL.x},${oy0} Q${pInf0.x + 120},${YINF - 220} ${pInf0.x.toFixed(1)},${pInf0.y.toFixed(1)}`, C.cuarenta - 0.45, C.cuarenta - 0.05, { cola: 220 });
    chispa.quieta(C.cuarenta - 0.05, C.infinito, pInf0.x, pInf0.y, 5);
    // y luego recorre el infinito, sin parar
    chispa.tramo(C.infinito + 0.55, finR + 0.3, (t) => pInf.path.getPointAtLength((((t - C.infinito - 0.55) * 0.55) % 1) * pInf.L));
    finRespaldo = (t) => pInf.path.getPointAtLength((((t - C.infinito - 0.55) * 0.55) % 1) * pInf.L);
    frase([["CIENTOS", "DE", "EMPRESAS", "MEXICANAS"], ["CAPACITADAS", "EN", "EL", "USO", "DE", "IA"]],
      [C.cuarenta, w(iR, "de", 1), w(iR, "empresas"), w(iR, "mexicanas"), C.capacitadas, w(iR, "en"), w(iR, "el"), w(iR, "uso"), w(iR, "de", 2), w(iR, "IA.")], finR,
      { y: q(652, 1000), tam: q(70, 70), max: q(1500, 960), estilo: "sube", sinEnfasis: true, colores: { 0: K("durazno") } });
    // las empresas no paran de llegar: puntos (y edificios) que nacen del centro y se salen del cuadro
    const campo = el("g", {}, escena), rc = azar(4141), PASOc = 54, celdas = [];
    for (let c = -19; c <= 19; c++) for (let r = 0; r < 5; r++) {
      const x = CX + c * PASOc + (r % 2) * PASOc * 0.5, y = q(806, 1500) + r * PASOc;
      const t0 = C.cuarenta + 0.1 + 2.6 * Math.pow(Math.abs(c) / 19, 0.8) + r * 0.04;
      const ed = (c * 7 + r * 3 + 70) % 9 === 0;
      const g = el("g", { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})`, opacity: 0 }, campo);
      if (ed) el("path", { d: D.edificio(1.0), transform: "translate(0 14)", fill: "none", stroke: hueso, "stroke-width": 2.5, "stroke-linejoin": "round" }, g);
      else el("circle", { r: 9, fill: (c + r) % 5 === 0 ? K("durazno") : K("cieloClaro") }, g);
      celdas.push({ g, t0, f: rc() * 6.28, x, y });
    }
    reloj(C.cuarenta, finR + 0.35, (t) => {
      for (const cd of celdas) {
        const s = pop(tramo(t, cd.t0, cd.t0 + 0.3));
        cd.g.setAttribute("transform", `translate(${cd.x.toFixed(1)} ${cd.y.toFixed(1)}) scale(${Math.max(0.001, s).toFixed(3)})`);
        cd.g.setAttribute("opacity", t < cd.t0 ? 0 : (0.75 + 0.25 * Math.sin(t * 3 + cd.f)) * (1 - tramo(t, finR, finR + 0.3)));
      }
    });
  } else {
    const PL = q({ y: 330, w: 760, h: 150 }, { y: 640, w: 900, h: 150 });
    const placa = el("g", {}, escena);
    el("rect", { x: CX - PL.w / 2, y: PL.y - PL.h / 2, width: PL.w, height: PL.h, rx: PL.h / 2, fill: K("blanco") }, placa);
    const tot = wV + gap + wT, lx = CX - tot / 2;
    const iV = el("image", { href: "./assets/marca/vadai-horizontal-recorte.png", x: lx, y: PL.y - hV / 2, width: wV, height: hV }, placa);
    el("rect", { x: lx + wV + gap / 2 - 1, y: PL.y - 25, width: 2, height: 50, fill: hueso }, placa);
    const iT = el("image", { href: "./assets/marca/totalcoach-recorte.png", x: lx + wV + gap, y: PL.y - hT / 2, width: wT, height: hT }, placa);
    tl.fromTo(placa, { opacity: 0, scale: 0.7, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2)" }, C.respaldan);
    tl.fromTo(iV, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.35, ease: "expo.out" }, C.vadai);
    tl.fromTo(iT, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.35, ease: "expo.out" }, C.total);
    tl.fromTo(placa, { opacity: 1 }, { opacity: 0, duration: 0.3, immediateRender: false }, finR);
    const PT = q({ y: 840, paso: 56 }, { y: 1300, paso: 64 });
    const pts = el("g", {}, escena);
    for (let n = 0; n < 40; n++) {
      const i = Math.floor(n / 10), j = n % 10;
      const c = el("circle", { cx: CX + (j - 4.5) * PT.paso, cy: PT.y + (i - 1.5) * PT.paso * 0.9, r: 0, fill: K("cieloClaro") }, pts);
      tl.fromTo(c, { attr: { r: 0 } }, { attr: { r: 13 }, duration: 0.25, ease: "back.out(3)" }, C.cuarenta + n * 0.022);
    }
    tl.fromTo(pts, { opacity: 1 }, { opacity: 0, duration: 0.3, immediateRender: false }, finR);
    const cont = dom("div", "contador", "+0");
    Object.assign(cont.style, { left: "0px", right: "0px", top: `${q(420, 760)}px`, textAlign: "center" });
    tl.fromTo(cont, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4, ease: "expo.out" }, C.cuarenta - 0.1);
    const n40 = { v: 0 };
    tl.fromTo(n40, { v: 0 }, { v: 40, duration: 0.9, ease: "power2.out", onUpdate: () => { cont.textContent = `+${Math.round(n40.v)}`; }, modifiers: { v: (x) => { cont.textContent = `+${Math.round(+x)}`; return x; } } }, C.cuarenta);
    tl.to(cont, { opacity: 0, duration: 0.25 }, finR);
    frase(q([["EMPRESAS", "MEXICANAS", "CAPACITADAS"]], [["EMPRESAS", "MEXICANAS"], ["CAPACITADAS"]]), [w(iR, "empresas"), w(iR, "mexicanas"), C.capacitadas], finR, { y: q(690, 1040), tam: q(72, 76) });
    const hv = ctx.ventanaFinal.head;
    chispa.pierna(`M${hv.x},${hv.y} Q${CX + PL.w / 2 + 120},${PL.y - 160} ${CX + PL.w / 2 + 30},${PL.y - PL.h / 2 - 10}`, C.respaldan - 0.3, C.respaldan + 0.1, { cola: 200 });
    chispa.quieta(C.respaldan + 0.1, C.porque2, CX + PL.w / 2 + 30, PL.y - PL.h / 2 - 10, 5);
    finRespaldo = () => ({ x: CX + PL.w / 2 + 30, y: PL.y - PL.h / 2 - 10 });
  }
  // cada tiempo del cierre vive con un empuje lento de cámara; el cambio de tiempo es un corte
  const tiempos = (platica ? [C.ramal, C.contamos, C.todo, C.equipo2, C.respaldan, C.porque2, C.nosotros] : [C.ramal, C.aprende - 0.4, C.apps[0] - 0.4, C.sin[0] - 0.1, C.sin[1] - 0.1, C.sin[2] - 0.1, C.todo, C.equipo2, C.respaldan, C.porque2, C.nosotros]).concat([C.dale - 0.12]);
  tiempos.slice(0, -1).forEach((t0, i) => { cam.corte(t0, CX, CYm, 1); cam.clave(tiempos[i + 1] - 0.02, CX, CYm, 1.045, ease.seno); });
  cam.corte(C.dale - 0.12, CX, CYm, 1);

  // ---------------- «porque todo mundo te va a seguir hablando de IA» ----------------
  const iP = iR + 1, iN = iR + 2;
  const ARRIBA = { x: CX, y: q(330, 660) };
  const desdeR = finRespaldo(C.porque2);
  if (platica) {
    // el mundo globalizado que ya habla de IA: la chispa dibuja el planeta, la gente encima platica, y las
    // gráficas de tendencia a los lados (10-oct, nota de Alejandro: «gente hablando y tendencias y gráficas
    // y un mundo… todo con íconos y dibujos creados por el logo de Claude»)
    frase([["TODO", "MUNDO", "TE", "VA", "A", "SEGUIR", "HABLANDO", "DE"]], ["todo", "mundo", "te", "va", "a", "seguir", "hablando", "de"].map((x) => w(iP, x)), C.nosotros - 0.3,
      { y: q(446, 700), tam: q(64, 66), max: q(1500, 960), estilo: "sube", sinEnfasis: true });
    const gM = el("g", { class: "mundo" }, escena);
    const GL = q({ x: CX, y: 1190, r: 440 }, { x: CX, y: 2000, r: 560 });
    const yB = q(1080, 1920), hx = Math.sqrt(GL.r ** 2 - (yB - GL.y) ** 2);
    const izqG = { x: GL.x - hx, y: yB }, derG = { x: GL.x + hx, y: yB };
    const pArc = chispa.pierna(`M${izqG.x.toFixed(1)},${izqG.y} A${GL.r},${GL.r} 0 0 1 ${derG.x.toFixed(1)},${derG.y}`, C.mundo, C.mundo + 0.6, { modo: "dibuja", ancho: 6, color: K("cieloClaro"), padre: gM, e: ease.suave });
    chispa.pierna(`M${desdeR.x.toFixed(1)},${desdeR.y.toFixed(1)} Q${(izqG.x - 220).toFixed(1)},${(desdeR.y + 160).toFixed(1)} ${izqG.x.toFixed(1)},${izqG.y}`, C.porque2, C.mundo, { cola: 220 });
    const lineasG = el("g", {}, gM);
    for (const f of [0.75, 0.5]) { const yy = GL.y - GL.r * f, hw = Math.sqrt(GL.r ** 2 - (yy - GL.y) ** 2); el("path", { d: `M${(GL.x - hw).toFixed(1)},${yy} L${(GL.x + hw).toFixed(1)},${yy}`, stroke: K("cieloClaro"), "stroke-width": 2, opacity: 0.5 }, lineasG); }
    const meris = [0, 1, 2, 3, 4].map(() => el("path", { fill: "none", stroke: K("cieloClaro"), "stroke-width": 2, opacity: 0.45 }, lineasG));
    tl.fromTo(lineasG, { opacity: 0 }, { opacity: 1, duration: 0.4 }, C.mundo + 0.45);
    reloj(C.mundo, C.nosotros + 0.1, (t) => meris.forEach((m, k) => { const kk = Math.cos(t * 0.5 + (k * Math.PI) / 5); m.setAttribute("d", mover(D.meridiano(GL.r, Math.abs(kk) < 0.01 ? 0.01 : kk), GL.x, GL.y)); }));
    // la gente, de pie sobre el planeta, cada quien con su globo de diálogo
    [-52, -35, -18, 0, 18, 35, 52].forEach((d, k) => {
      const a = ((-90 + d) * Math.PI) / 180, x = GL.x + Math.cos(a) * GL.r, y = GL.y + Math.sin(a) * GL.r;
      const g = el("g", { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${d})` }, gM);
      const p = el("g", {}, g);
      el("path", { d: D.persona("hablando", 0.5), fill: "none", stroke: hueso, "stroke-width": 3.5, "stroke-linecap": "round", "stroke-linejoin": "round" }, p);
      const b = el("g", { transform: `translate(${k % 2 ? -34 : 34} -128)` }, p);
      const bi = el("g", {}, b);
      el("path", { d: D.dialogo(76, 46), fill: k % 3 === 1 ? K("durazno") : hueso }, bi);
      if (k % 2 === 0) { const tx = el("text", { y: 10, "text-anchor": "middle", "font-family": "Anton", "font-size": 28, fill: navy }, bi); tx.textContent = "IA"; }
      else [-14, 0, 14].forEach((dx) => el("circle", { cx: dx, cy: 0, r: 4.5, fill: navy }, bi));
      tl.fromTo(p, { scale: 0, transformOrigin: "50% 100%" }, { scale: 1, duration: 0.3, ease: "back.out(2.4)" }, C.mundo + 0.55 + k * 0.08);
      tl.fromTo(bi, { scale: 0, transformOrigin: "50% 50%" }, { scale: 1, duration: 0.28, ease: "back.out(3)" }, C.mundo + 0.7 + k * 0.16);
    });
    // las tendencias: barras que suben a la derecha, la gráfica a la izquierda
    const BA = q({ x: 1540, y: 850, w: 270, h: 170 }, { x: 640, y: 1640, w: 280, h: 170 });
    const GF = q({ x: 110, y: 850, w: 270, h: 170 }, { x: 160, y: 1640, w: 280, h: 170 });
    const tipB = { x: BA.x + BA.w + 10, y: BA.y - BA.h - 34 };
    const dBa = mover(D.barras(BA.w, BA.h), BA.x, BA.y) + ` M${BA.x + 14},${BA.y - 50} L${tipB.x.toFixed(1)},${tipB.y.toFixed(1)} M${(tipB.x - 30).toFixed(1)},${(tipB.y - 2).toFixed(1)} L${tipB.x.toFixed(1)},${tipB.y.toFixed(1)} L${(tipB.x - 12).toFixed(1)},${(tipB.y + 27).toFixed(1)}`;
    const pBa = chispa.pierna(dBa, C.mundo + 0.85, C.mundo + 1.3, { modo: "dibuja", ancho: 4, color: hueso, padre: gM });
    const pGf = chispa.pierna(mover(D.graficaSube(GF.w, GF.h), GF.x, GF.y), C.mundo + 1.6, C.mundo + 2.05, { modo: "dibuja", ancho: 4, color: hueso, padre: gM });
    const pt = (tr, u) => tr.path.getPointAtLength(u * tr.L);
    const vuelo = (a, b, t0, t1, alto = 120) => chispa.pierna(`M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${((a.x + b.x) / 2).toFixed(1)},${(Math.min(a.y, b.y) - alto).toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`, t0, t1, { cola: 200, e: ease.suave });
    vuelo(pt(pArc, 1), pt(pBa, 0), C.mundo + 0.6, C.mundo + 0.85, 80);
    vuelo(pt(pBa, 1), pt(pGf, 0), C.mundo + 1.3, C.mundo + 1.6, -330);
    const finGf = pt(pGf, 1);
    chispa.quieta(C.mundo + 2.05, C.nosotros - 0.25, finGf.x, finGf.y - 26, 5);
    vuelo({ x: finGf.x, y: finGf.y - 26 }, ARRIBA, C.nosotros - 0.25, C.nosotros + 0.3, 60);
    chispa.quieta(C.nosotros + 0.3, C.nosotros + 0.6, ARRIBA.x, ARRIBA.y, 7);
    tl.to(gM, { y: 90, opacity: 0, duration: 0.35, ease: "power2.in" }, C.nosotros - 0.3);
  } else {
    chispa.pierna(`M${desdeR.x},${desdeR.y} Q${CX + 200},${ARRIBA.y - 120} ${ARRIBA.x},${ARRIBA.y}`, C.porque2, C.porque2 + 0.4, { cola: 200 });
    chispa.quieta(C.porque2 + 0.4, C.nosotros + 0.6, ARRIBA.x, ARRIBA.y, 7);
    const r2 = azar(4040);
    for (let k = 0; k < 36; k++) {
      const a = -Math.PI * (0.03 + 0.94 * r2()), L = 1000 + r2() * 900;
      const ex = ARRIBA.x + Math.cos(a) * L, ey = ARRIBA.y + Math.sin(a) * L;
      let nx = Math.sin(a), ny = -Math.cos(a); if (ny > 0) { nx = -nx; ny = -ny; }
      const b1 = 120 + r2() * 260;
      const p = el("path", { d: `M${ARRIBA.x},${ARRIBA.y} Q${(ARRIBA.x + Math.cos(a) * L * 0.5 + nx * b1).toFixed(1)},${(ARRIBA.y + Math.sin(a) * L * 0.5 + ny * b1).toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`, fill: "none", stroke: [K("azul"), K("cieloClaro"), hueso][k % 3], "stroke-width": (1.4 + r2() * 2.2).toFixed(1), "stroke-linecap": "round" }, escena);
      const t0 = C.porque2 + 0.45 + k * 0.05, op = +(0.35 + r2() * 0.5).toFixed(2);
      tl.fromTo(p, { opacity: 0 }, { opacity: op, duration: 0.001 }, t0);
      tl.fromTo(p, { opacity: op }, { opacity: 0, duration: 0.001, immediateRender: false }, t0 + 1.1);
      tl.fromTo(p, { drawSVG: "0% 0%" }, { drawSVG: "0% 38%", duration: 0.3, ease: "power1.in" }, t0);
      tl.fromTo(p, { drawSVG: "0% 38%" }, { drawSVG: "100% 100%", duration: 0.78, ease: "power1.out", immediateRender: false }, t0 + 0.3);
    }
  }
  const yIA = q(598, 900);
  frase(q([["INTELIGENCIA", "ARTIFICIAL"]], [["INTELIGENCIA"], ["ARTIFICIAL"]]), [C.ia2, w(iP, "artificial.")], C.nosotros - 0.3, { y: yIA, tam: 150, max: q(1700, 920), dur: 0.3, estilo: "traza" });
  const fNo = frase(q([["NOSOTROS", "TE", "ENSEÑAMOS"], ["QUÉ", "HACER", "CON", "ELLA."]], [["NOSOTROS", "TE"], ["ENSEÑAMOS"], ["QUÉ", "HACER"], ["CON", "ELLA."]]),
    [C.nosotros, w(iN, "te"), C.ensenamos, w(iN, "qué"), w(iN, "hacer"), w(iN, "con"), C.ella], C.dale - 0.2, { y: q(560, 860), tam: q(120, 116), max: q(1600, 940) });
  // la línea limpia: la chispa subraya «qué hacer con ella»
  const yUlt = fNo.palabras.at(-1).y, ult = fNo.palabras.filter((p) => p.y === yUlt);
  const ux0 = ult[0].x0, ux1 = ult.at(-1).x1 - 20, uy = yUlt + 32;
  chispa.pierna(`M${ARRIBA.x},${ARRIBA.y} C${ux0 - 300},${ARRIBA.y} ${ux0 - 300},${uy + 90} ${ux0},${uy}`, C.nosotros + 0.6, C.ella - 0.02, { cola: 240 });
  linea(`M${ux0},${uy} L${ux1},${uy}`, C.ella - 0.02, C.ella + 0.3, { color: K("durazno"), ancho: 9, padre: escena, fin: C.dale - 0.05 });
  chispa.quieta(C.ella + 0.3, C.dale - 0.12 + 0.56, ux1, uy, 3);

  // ---------------- telón: la chispa abre el degradado héroe; tarjeta final ----------------
  const tTelon = C.dale - 0.12;
  const iris = el("circle", { cx: ux1, cy: uy, r: 0, fill: "url(#cielo)" }, telon);
  tl.fromTo(iris, { attr: { r: 0 } }, { attr: { r: Math.hypot(W, H) * 1.1 }, duration: 0.6, ease: "power3.in" }, tTelon);
  chispa.escala((t) => 1 - ease.entra2(tramo(t, tTelon + 0.3, tTelon + 0.55)) + ease.sale3(tramo(t, C.fin + 0.1, C.fin + 0.5)));
  const N2 = { color: navy };
  const tituloF = platica ? [["PLÁTICA", "GRATUITA"], ["Y", "EN", "VIVO"]] : [["CLAUDE"], ["EN", "TU", "EMPRESA"]];
  const ctaF = platica ? [["APARTA", "TU", "LUGAR"]] : [["CAPACITA", "A", "TU", "EQUIPO"]];
  // la flecha lima: aparece en «clic», late hasta el final
  const FL = q({ x: CX, y: 760 }, { x: CX, y: 1330 });
  const flecha = el("g", {}, letras);
  el("path", { d: "M0,-70 L0,60 M-46,16 L0,64 L46,16", fill: "none", stroke: navy, "stroke-width": 26, "stroke-linecap": "round", "stroke-linejoin": "round", transform: "translate(0 6)" }, flecha);
  el("path", { d: "M0,-70 L0,60 M-46,16 L0,64 L46,16", fill: "none", stroke: K("lima"), "stroke-width": 16, "stroke-linecap": "round", "stroke-linejoin": "round" }, flecha);
  const FL2 = q({ x: CX, y: 740 }, { x: CX, y: 1330 });
  const tF = C.fin + 0.3;
  // la flecha la mueve solo el reloj: entra en «clic», late, y se recoloca bajo la tarjeta final
  reloj(C.clic - 0.05, 999, (t) => {
    const u = tramo(t, C.clic, C.clic + 0.5), s = Math.max(0.001, 1 + 1.7 * Math.pow(u - 1, 3) + 0.7 * Math.pow(u - 1, 2));
    const mv = ease.suave(tramo(t, tF, tF + 0.5)), x = FL.x + (FL2.x - FL.x) * mv, y = FL.y + (FL2.y - FL.y) * mv;
    const late = u >= 1 ? 12 * Math.abs(Math.sin((t - C.clic - 0.5) * 3.2)) : 0;
    flecha.setAttribute("transform", `translate(${x.toFixed(1)} ${(y - 60 * (1 - u) + late).toFixed(1)}) scale(${(u >= 1 ? 1 : s).toFixed(3)})`);
    flecha.style.opacity = t < C.clic ? 0 : 1;
  });
  onda(tl, letras, FL.x, FL.y - 60, C.clic, { r0: 20, r1: 180, color: navy, ancho: 4 });
  const YC = q(420, 900);
  const cta1 = frase(ctaF, platica ? [C.cta, w(14, "tu"), w(14, "lugar.")] : [C.cta, w(15, "a"), w(15, "tu"), w(15, "equipo.")], platica ? w(15, "esto") - 0.25 : C.caro - 0.3, { y: YC, tam: q(150, 130), color: navy, max: q(1600, 960) });
  if (platica) {
    // ---------- «esto es gratis»: una segunda chispa (por encima del degradado) dibuja una etiqueta de
    // precio y GRATIS se estampa en ella; luego «lo caro» es otra escena: navy, con rojo y durazno
    // (10-oct, nota de Alejandro: «más creativa… más colores, un poquito de rojo para resaltar lo CARO… que
    // ya no se sienta como la misma escena anterior») ----------
    const tE = C.etiqueta, ROT = -0.09, grad = (ROT * 180) / Math.PI;
    const TG = q({ x: 650, y: 548, w: 620, h: 240, cuelga: 214 }, { x: 240, y: 980, w: 600, h: 240, cuelga: 640 });
    const gTag = el("g", {}, letras);
    const capa2 = el("g", {}, letras);
    const ch2 = crearChispa({ escena: capa2, reloj, CHISPA_D: ctx.CHISPA_D });
    const nace2 = q({ x: 1560, y: 200 }, { x: 900, y: 300 });
    ch2.tramo(0, tE - 0.15, () => nace2);
    ch2.escala((t) => (t < tE - 0.15 || t >= tF ? 0.001 : Math.max(0.001, pop(tramo(t, tE - 0.15, tE + 0.1)))));
    const colgador = { x: TG.x - 34, y: TG.cuelga };
    const relleno = el("path", { d: mover(`M0,0 L60,${-TG.h / 2} L${TG.w},${-TG.h / 2} L${TG.w},${TG.h / 2} L60,${TG.h / 2} Z`, TG.x, TG.y, 1, ROT), fill: K("blanco"), opacity: 0 }, gTag);
    const hoyo = { x: TG.x + 28 * Math.cos(ROT), y: TG.y + 28 * Math.sin(ROT) };
    const pTag = ch2.pierna(`M${colgador.x},${colgador.y} L${hoyo.x.toFixed(1)},${hoyo.y.toFixed(1)} ` + mover(D.etiqueta(TG.w, TG.h), TG.x, TG.y, 1, ROT), tE, tE + 0.48, { modo: "dibuja", ancho: 7, color: navy, padre: gTag, e: ease.suave });
    tl.fromTo(relleno, { opacity: 0 }, { opacity: 1, duration: 0.18 }, tE + 0.38);
    ch2.pierna(`M${nace2.x},${nace2.y} Q${(nace2.x + colgador.x) / 2},${nace2.y - 90} ${colgador.x},${colgador.y}`, tE - 0.15, tE, { cola: 160 });
    const gTx = el("g", { transform: `rotate(${grad.toFixed(2)} ${TG.x} ${TG.y})` }, gTag);
    const fGr = texto(fuente, gTx, [["GRATIS."]], { x: TG.x + 60 + (TG.w - 60) / 2, y: TG.y + 55, tam: 150, maxAncho: TG.w - 130, color: navy, estilo: "golpe", trazo: 3 });
    dibujar(tl, fGr.palabras[0], C.gratis, { dur: 0.2, adelanto: 0 });
    onda(tl, letras, TG.x + TG.w / 2, TG.y, C.gratis, { r0: 120, r1: 520, color: navy, ancho: 5, dur: 0.55 });
    const esqTag = { x: TG.x + TG.w * Math.cos(ROT) + (TG.h / 2) * Math.sin(ROT) + 10, y: TG.y + TG.w * Math.sin(ROT) - (TG.h / 2) * Math.cos(ROT) - 34 };
    const finTag = pTag.path.getPointAtLength(pTag.L);
    ch2.pierna(`M${finTag.x.toFixed(1)},${finTag.y.toFixed(1)} Q${esqTag.x},${esqTag.y - 120} ${esqTag.x.toFixed(1)},${esqTag.y.toFixed(1)}`, tE + 0.48, C.gratis - 0.02, { cola: 120 });
    ch2.tramo(C.gratis - 0.02, C.rojo, (t) => ({ x: esqTag.x, y: esqTag.y + 12 * Math.exp(-Math.pow((t - C.gratis - 0.02) / 0.05, 2)) - 5 * Math.sin((t - C.gratis) * 2.4) }));
    ch2.escala((t) => 1 + 0.7 * Math.exp(-Math.pow((t - C.gratis) / 0.07, 2)));
    frase([["ESTO", "ES"]], [w(15, "esto"), w(15, "es")], C.rojo - 0.1, { y: q(338, 760), tam: q(96, 96), color: navy, max: q(1200, 900) });
    // la etiqueta se mece con el golpe y se cae cuando entra el telón navy
    reloj(C.gratis - 0.01, C.rojo + 0.35, (t) => {
      const u = Math.max(0, t - C.gratis), mece = 5 * Math.exp(-2.2 * u) * Math.sin(u * 8.5), cae = ease.entra2(tramo(t, C.rojo - 0.12, C.rojo + 0.25));
      gTag.setAttribute("transform", `translate(0 ${(cae * 760).toFixed(1)}) rotate(${(mece + cae * 18).toFixed(2)} ${colgador.x} ${colgador.y})`);
      gTag.setAttribute("opacity", (1 - cae).toFixed(3));
    });
    // el telón navy, con un halo rojo; «LO CARO» en rojo, billetes «$» que se van por los lados
    const gRojo = el("g", {}, telon);   // se reacomoda al final de montar: encima de los rayos del degradado
    ctx.alFinal = () => telon.appendChild(gRojo);
    const panel = el("rect", { x: 0, y: H, width: W, height: H, fill: navy }, gRojo);
    tl.fromTo(panel, { attr: { y: H } }, { attr: { y: 0 }, duration: 0.32, ease: "power3.inOut" }, C.rojo);
    const haloR = el("circle", { cx: CX, cy: q(300, 700), r: q(760, 900), fill: "url(#halo-rojo)", opacity: 0 }, gRojo);
    tl.fromTo(haloR, { opacity: 0 }, { opacity: 1, duration: 0.4 }, C.caro);
    tl.fromTo(haloR, { opacity: 1 }, { opacity: 0, duration: 0.25, immediateRender: false }, tF - 0.32);
    const dinero = el("g", {}, gRojo), rd = azar(7171), billetes = [];
    for (let k = 0; k < 30; k++) {
      const x = k % 2 ? W - 70 - rd() * q(330, 230) : 70 + rd() * q(330, 230), tam = 50 + rd() * 110;
      const gl = fuente.getPath("$", 1000, 1000, tam), bb = gl.getBoundingBox();
      const g = el("g", { opacity: 0 }, dinero);
      el("path", { d: gl.toPathData(1), fill: rd() < 0.7 ? K("rojo") : K("durazno"), transform: `translate(${(-(bb.x1 + bb.x2) / 2).toFixed(1)} ${(-(bb.y1 + bb.y2) / 2).toFixed(1)})` }, g);
      billetes.push({ g, x, t0: C.caro + 0.05 + k * 0.085, dur: 1.4 + rd() * 0.8, giro: (rd() - 0.5) * 300, f: rd() * 6.28 });
    }
    reloj(C.caro, tF, (t) => {
      for (const b of billetes) {
        const u = tramo(t, b.t0, b.t0 + b.dur);
        b.g.setAttribute("transform", `translate(${(b.x + 30 * Math.sin(t * 2 + b.f)).toFixed(1)} ${(-120 + u * (H + 240)).toFixed(1)}) rotate(${(b.giro * u).toFixed(1)})`);
        b.g.setAttribute("opacity", t < b.t0 || u >= 1 ? 0 : (0.85 * (1 - tramo(t, tF - 0.32, tF - 0.12))).toFixed(3));
      }
    });
    const fCaro = texto(fuente, letras, [["LO", "CARO"]], { x: CX, y: q(372, 760), tam: q(240, 200), maxAncho: q(1300, 960), color: K("rojo"), estilo: "golpe", trazo: 3 });
    dibujar(tl, fCaro.palabras[0], w(16, "lo"), { dur: 0.2 });
    dibujar(tl, fCaro.palabras[1], C.caro, { dur: 0.2 });
    tl.fromTo(fCaro.g, { x: -14 }, { x: 0, duration: 0.4, ease: "elastic.out(1, 0.3)" }, C.caro);
    const f2 = texto(fuente, letras, [["ES", "QUE", "SIGAN", "HACIENDO"]], { x: CX, y: q(500, 920), tam: q(92, 86), maxAncho: q(1300, 960), estilo: "sube" });
    ["es", "que", "sigan", "haciendo"].forEach((x, i) => dibujar(tl, f2.palabras[i], w(16, x), { dur: 0.24 }));
    const f3 = texto(fuente, letras, [["LAS", "COSAS", "A", "MANO."]], { x: CX, y: q(650, 1080), tam: q(130, 116), maxAncho: q(1300, 960), estilo: "cae", colores: { 2: K("durazno"), 3: K("durazno") } });
    ["las", "cosas", "a", "mano."].forEach((x, i) => dibujar(tl, f3.palabras[i], w(16, x), { dur: 0.3 }));
    // la escena roja entera (telón, halo, billetes y frase) sube de un jalón y descubre la tarjeta final
    tl.fromTo([gRojo, fCaro.g, f2.g, f3.g], { y: 0 }, { y: -H, duration: 0.36, ease: "power3.inOut", immediateRender: false }, tF - 0.3);
    // la segunda chispa espera arriba a la derecha, cae en MANO y vuela al lugar de la tarjeta final
    const parque = q({ x: 1700, y: 210 }, { x: 900, y: 420 });
    ch2.pierna(`M${esqTag.x.toFixed(1)},${esqTag.y.toFixed(1)} Q${(esqTag.x + parque.x) / 2},${parque.y - 100} ${parque.x},${parque.y}`, C.rojo, C.rojo + 0.3, { cola: 160 });
    ch2.quieta(C.rojo + 0.3, C.mano2 - 0.32, parque.x, parque.y, 5);
    const pm = f3.palabras[3], encM = { x: pm.cx, y: pm.y - pm.tam * 1.02 };
    ch2.pierna(`M${parque.x},${parque.y} Q${(parque.x + encM.x) / 2},${Math.min(parque.y, encM.y) - 120} ${encM.x.toFixed(1)},${encM.y.toFixed(1)}`, C.mano2 - 0.32, C.mano2 - 0.01, { cola: 200, e: ease.entra2 });
    ch2.tramo(C.mano2 - 0.01, C.mano2 + 0.28, (t) => ({ x: encM.x, y: encM.y + 10 * Math.exp(-Math.pow((t - C.mano2 - 0.03) / 0.05, 2)) }));
    ch2.escala((t) => 1 + 0.7 * Math.exp(-Math.pow((t - C.mano2) / 0.07, 2)));
    onda(tl, letras, pm.cx, pm.cy, C.mano2, { r0: 30, r1: pm.tam * 1.6, color: K("durazno"), ancho: 4, dur: 0.5 });
    const astF0 = { x: CX, y: q(76, 430) };
    ch2.pierna(`M${encM.x.toFixed(1)},${encM.y.toFixed(1)} Q${CX + 300},${astF0.y + 60} ${astF0.x},${astF0.y}`, C.mano2 + 0.28, tF - 0.04, { cola: 200 });
    ch2.quieta(tF - 0.04, 999, astF0.x, astF0.y, 0);
    ch2.montar();
  } else {
    frase(q([["LO", "CARO", "ES", "QUE", "SIGAN"], ["HACIENDO", "LAS", "COSAS", "A", "MANO."]], [["LO", "CARO", "ES"], ["QUE", "SIGAN"], ["HACIENDO", "LAS"], ["COSAS", "A", "MANO."]]),
      ["lo", "caro", "es", "que", "sigan", "haciendo", "las", "cosas", "a", "mano."].map((x) => w(16, x)), C.fin + 0.15, { y: q(330, 640), tam: q(110, 104), color: navy, max: q(1700, 960) });
  }
  // tarjeta final
  const fTit = frase(tituloF, tituloF.flat().map((_, i) => tF + i * 0.06), null, { y: q(280, 620), tam: q(150, 140), color: navy, max: q(1600, 960), inter: platica ? 1.0 : 1.12 });
  if (!platica) {   // CLAUDE va en navy sobre el degradado (contraste); lo lleva la barra durazno
    const c0 = fTit.palabras[0];
    const b = el("path", { d: `M${c0.x0 + 6},${c0.y + 26} L${c0.x1 - 6},${c0.y + 26}`, fill: "none", stroke: K("durazno"), "stroke-width": 14, "stroke-linecap": "round" }, letras);
    tl.fromTo(b, { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", duration: 0.45, ease: "expo.out" }, tF + 0.2);
    tl.fromTo(b, { visibility: "hidden" }, { visibility: "visible", duration: 0.001 }, tF + 0.2);
  }
  frase(ctaF, ctaF.flat().map((_, i) => tF + 0.35 + i * 0.05), null, { y: q(560, 1110), tam: q(80, 76), color: navy, max: q(1200, 900) });
  const placaF = el("g", {}, letras);
  const PF = q({ y: 960, w: 700, h: 120 }, { y: 1560, w: 820, h: 130 });
  el("rect", { x: CX - PF.w / 2, y: PF.y - PF.h / 2, width: PF.w, height: PF.h, rx: PF.h / 2, fill: K("blanco") }, placaF);
  const k2 = 0.8, tot2 = (wV + gap + wT) * k2, lx2 = CX - tot2 / 2;
  el("image", { href: "./assets/marca/vadai-horizontal-recorte.png", x: lx2, y: PF.y - (hV * k2) / 2, width: wV * k2, height: hV * k2 }, placaF);
  el("rect", { x: lx2 + (wV + gap / 2) * k2 - 1, y: PF.y - 20, width: 2, height: 40, fill: hueso }, placaF);
  el("image", { href: "./assets/marca/totalcoach-recorte.png", x: lx2 + (wV + gap) * k2, y: PF.y - (hT * k2) / 2, width: wT * k2, height: hT * k2 }, placaF);
  tl.fromTo(placaF, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5, ease: "expo.out" }, tF + 0.6);
  // rayos finos que giran lento detrás del título y motas que suben: el degradado no se queda quieto
  const rayos = el("g", { opacity: 0 }, telon);
  const RC = { x: CX, y: q(300, 720) };
  for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; el("path", { d: `M${(Math.cos(a) * 140).toFixed(1)},${(Math.sin(a) * 140).toFixed(1)} L${(Math.cos(a) * 1400).toFixed(1)},${(Math.sin(a) * 1400).toFixed(1)}`, stroke: K("blanco"), "stroke-width": k % 2 ? 2 : 5, "stroke-linecap": "round", opacity: 0.16 }, rayos); }
  reloj(C.dale - 0.1, 999, (t) => { rayos.setAttribute("transform", `translate(${RC.x} ${RC.y}) rotate(${((t - C.dale) * 6).toFixed(2)})`); rayos.setAttribute("opacity", ease.suave(tramo(t, C.dale + 0.3, C.dale + 1.2)).toFixed(3)); });
  const rm = azar(5150);
  for (let k = 0; k < 28; k++) {
    const mx = rm() * W, v = 30 + rm() * 60, r0 = 2 + rm() * 4, mo = el("circle", { r: r0.toFixed(1), fill: K("blanco"), opacity: 0 }, telon);
    reloj(C.dale - 0.1, 999, (t) => { const yy = (((H + 40 - (t - C.dale) * v - k * 47) % (H + 80)) + H + 80) % (H + 80) - 40; mo.setAttribute("cx", (mx + 14 * Math.sin(t * 0.7 + k)).toFixed(1)); mo.setAttribute("cy", yy.toFixed(1)); mo.setAttribute("opacity", (0.35 * ease.suave(tramo(t, C.dale + 0.4, C.dale + 1.4))).toFixed(3)); });
  }
  // la chispa de la tarjeta final vive sobre el telón (la de la escena queda debajo del degradado)
  const astF = platica ? { x: CX, y: q(76, 430) } : { x: fTit.palabras[0].x1 + 56, y: fTit.palabras[0].y - 100 };
  chispa.quieta(tTelon + 0.56, 999, astF.x, astF.y, 0);
  const chF = el("g", {}, letras);
  const chFg = el("g", {}, chF);
  el("path", { d: ctx.CHISPA_D, transform: "scale(3.2) translate(-12 -12)", fill: K("durazno"), filter: "url(#brillo)" }, chFg);
  reloj(tF - 0.05, 999, (t) => {
    const u = tramo(t, tF, tF + 0.6), s = Math.max(0.001, 1 + 1.7 * Math.pow(u - 1, 3) + 0.7 * Math.pow(u - 1, 2));
    chF.setAttribute("transform", `translate(${astF.x} ${(astF.y - 5 * Math.sin(t * 2.2)).toFixed(1)}) scale(${s.toFixed(3)})`);
    chFg.setAttribute("transform", `rotate(${(t * 48).toFixed(1)})`);
    chF.style.opacity = t < tF ? 0 : 1;
  });
  if (ctx.alFinal) ctx.alFinal();
}
