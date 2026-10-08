// v2 · 2D «Un solo trazo» · 05–08 (28–49 s): el escritorio se llena → ¿cuánto depende de ti? →
// no te falta otra herramienta → te falta un MÉTODO. La cámara sale del punto «tú» al escritorio que
// dibuja la chispa; el silencio es una red que cuelga de ti; el golpe es la línea que se endereza.
import { el, texto, dibujar, borrar, tramo, ease, K, insignia, onda, azar } from "./trazo.js";
import { LOGOS } from "../logos.js";

export function montar(ctx) {
  const { tl, capas, C, T, fuente, reloj, chispa, cam, V, W, H } = ctx;
  const { escena, letras, fijo } = capas;
  const q = (h, v) => (V ? v : h);
  const CX = W / 2, CYm = H / 2;
  const izq = q({ x: 96, y: 470, tam: 120, max: 760 }, { x: 80, y: 560, tam: 112, max: 920 });
  const frase = (lineas, anclas, fin, o = {}) => {
    const f = texto(fuente, letras, lineas, { x: o.x ?? izq.x, y: o.y ?? izq.y, tam: o.tam ?? izq.tam, ancla: o.ancla ?? "izq", maxAncho: o.max ?? izq.max, color: o.color, estilo: o.estilo ?? "sube", colores: o.colores ?? {} });
    f.palabras.forEach((p, i) => dibujar(tl, p, anclas[i], { dur: 0.34 }));
    if (fin) borrar(tl, f.palabras, fin, { dur: 0.24, escalon: 0.005 });
    return f;
  };

  // ---------------- 05 · «mientras tanto…» el escritorio se llena ----------------
  const tCorte = C.mientras + 0.08;
  cam.corte(tCorte, CX, CYm, 1);
  // la entrada por el punto deja la pantalla gris: se disuelve en el escritorio
  const velo = el("rect", { width: W, height: H, fill: K("gris"), opacity: 0 }, fijo);
  tl.fromTo(velo, { opacity: 0 }, { opacity: 1, duration: 0.001 }, tCorte);
  tl.fromTo(velo, { opacity: 1 }, { opacity: 0, duration: 0.45, ease: "power2.out", immediateRender: false }, tCorte + 0.02);
  const D = q({ x: 1300, y: 560 }, { x: CX, y: 1260 }), k = q(1, 0.92);
  const P = (x, y) => `${(D.x + x * k).toFixed(1)},${(D.y + y * k).toFixed(1)}`;
  const mesa = el("g", { class: "escritorio" }, escena);
  const tBorra = [C.honesto - 0.05, C.honesto + 0.5];
  const hueso = K("hueso");
  const linea = (d, t0, t1, ancho = 6, color = hueso) => chispa.pierna(d, t0, t1, { modo: "dibuja", ancho, color, padre: mesa, borra: tBorra, e: ease.suave });
  const tD = tCorte + 0.12;
  // la cubierta se dobla en el golpe de «escritorio»: se dibuja como un solo trazo que luego cambia de forma
  const cubierta = linea(`M${P(-390, 150)} Q${P(0, 150)} ${P(390, 150)}`, tD, tD + 0.45, 7);
  linea(`M${P(-330, 150)} L${P(-330, 330)}`, tD + 0.45, tD + 0.62);
  linea(`M${P(330, 150)} L${P(330, 330)}`, tD + 0.62, tD + 0.79);
  linea(`M${P(-205, 50)} L${P(-205, -200)} Q${P(-205, -215)} ${P(-190, -215)} L${P(190, -215)} Q${P(205, -215)} ${P(205, -200)} L${P(205, 50)} Q${P(205, 65)} ${P(190, 65)} L${P(-190, 65)} Q${P(-205, 65)} ${P(-205, 50)}`, tD + 0.79, tD + 1.45, 5);
  linea(`M${P(0, 65)} L${P(0, 150)} M${P(-70, 150)} L${P(70, 150)}`, tD + 1.45, tD + 1.7, 5);
  const tGolpe = C.escritorio + 0.05;
  reloj(tGolpe - 0.05, tGolpe + 0.9, (t) => {
    const u = tramo(t, tGolpe, tGolpe + 0.7), dip = Math.sin(Math.min(1, u * 4) * Math.PI / 2) * Math.exp(-u * 4) * 34 + (u > 0 ? 6 * Math.exp(-u * 2) : 0);
    cubierta.path.setAttribute("d", `M${P(-390, 150)} Q${P(0, 150 + dip * 2)} ${P(390, 150)}`);
  });
  // la hoja: cuadrícula dentro del monitor que se llena celda por celda «a mano»
  const hoja = el("g", {}, mesa);
  const COLS = 6, FILAS = 5, x0 = -180, y0 = -180, cw = 60, ch = 40;
  const tHoja = tD + 1.7;
  const barraH = el("rect", { x: D.x + x0 * k, y: D.y + (y0 - 22) * k, width: COLS * cw * k, height: 16 * k, rx: 4, fill: K("azul"), opacity: 0 }, hoja);
  tl.fromTo(barraH, { opacity: 0 }, { opacity: 1, duration: 0.2 }, tHoja);
  for (let i = 0; i <= FILAS; i++) {
    const l = el("path", { d: `M${P(x0, y0 + i * ch)} L${P(x0 + COLS * cw, y0 + i * ch)}`, stroke: K("cieloClaro"), "stroke-width": 2, opacity: 0.7 }, hoja);
    tl.fromTo(l, { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", duration: 0.3, ease: "power2.out" }, tHoja + i * 0.04);
  }
  for (let j = 0; j <= COLS; j++) {
    const l = el("path", { d: `M${P(x0 + j * cw, y0)} L${P(x0 + j * cw, y0 + FILAS * ch)}`, stroke: K("cieloClaro"), "stroke-width": 2, opacity: 0.7 }, hoja);
    tl.fromTo(l, { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", duration: 0.3, ease: "power2.out" }, tHoja + 0.1 + j * 0.03);
  }
  const celdas = [], nC = COLS * FILAS, tC0 = C.reportes, tC1 = C.mismas - 0.1;
  for (let n = 0; n < nC; n++) {
    const i = Math.floor(n / COLS), j = n % COLS;
    const c = el("rect", { x: D.x + (x0 + j * cw + 6) * k, y: D.y + (y0 + i * ch + 9) * k, width: (cw - 12) * k * (0.5 + ((n * 37) % 5) / 10), height: (ch - 18) * k, rx: 3, fill: hueso, opacity: 0 }, hoja);
    celdas.push({ c, t: tC0 + (n / nC) * (tC1 - tC0) });
    tl.fromTo(c, { opacity: 0 }, { opacity: 0.75, duration: 0.06 }, tC0 + (n / nC) * (tC1 - tC0));
  }
  // el cursor que lo hace a mano
  const cursor = el("path", { d: "M0,0 L0,30 L8,22 L14,36 L20,33 L14,20 L25,20 Z", fill: hueso, stroke: K("navy"), "stroke-width": 2, opacity: 0 }, mesa);
  reloj(tC0 - 0.3, tC1 + 0.3, (t) => {
    const n = Math.min(nC - 1, Math.max(0, Math.floor(((t - tC0) / (tC1 - tC0)) * nC)));
    const i = Math.floor(n / COLS), j = n % COLS;
    const tc = tC0 + (n / nC) * (tC1 - tC0), u = ease.sale3(tramo(t, tc - 0.04, tc));
    const xp = D.x + (x0 + j * cw + cw * 0.7) * k, yp = D.y + (y0 + i * ch + ch * 0.6) * k;
    cursor.setAttribute("transform", `translate(${xp.toFixed(1)} ${(yp + (1 - u) * 4).toFixed(1)})`);
    cursor.style.opacity = t > tC0 - 0.2 && t < tC1 + 0.25 ? 1 : 0;
  });
  // «las mismas talachas repetitivas diariamente»: la hoja se copia y las copias se apilan en la mesa
  const pila = el("g", {}, mesa);
  const copias = [];
  for (let n = 0; n < 9; n++) {
    const lado = n % 2 ? 1 : -1, nivel = Math.floor(n / 2);
    const t0 = C.talachas + n * 0.2;
    const g = el("g", {}, pila);
    el("rect", { x: -62, y: -40, width: 124, height: 80, rx: 8, fill: K("navyHondo"), stroke: hueso, "stroke-width": 3 }, g);
    for (let r = 1; r < 4; r++) el("path", { d: `M-50,${-40 + r * 20} L50,${-40 + r * 20}`, stroke: K("cieloClaro"), "stroke-width": 2 }, g);
    const fx = D.x + (lado * 270 + (n % 4 < 2 ? 0 : lado * 30)) * k, fy = D.y + (150 - 44 - nivel * 22) * k;
    copias.push({ g, t0, fx, fy });
  }
  // los avisos: cada decisión cae en tu escritorio
  const r05 = azar(505);
  const avisos = C.avisos.map((t0, n) => {
    const g = el("g", {}, pila);
    el("rect", { x: -88, y: -30, width: 176, height: 60, rx: 18, fill: K("blanco"), stroke: K("cieloClaro"), "stroke-width": 2 }, g);
    el("circle", { cx: -56, cy: 0, r: 15, fill: K("azul") }, g);
    el("path", { d: "M-61,-5 Q-61,-11 -56,-11 Q-51,-11 -51,-6 Q-51,-2 -56,0 L-56,4 M-56,8 L-56,9", fill: "none", stroke: K("blanco"), "stroke-width": 3, "stroke-linecap": "round" }, g);
    el("rect", { x: -30, y: -12, width: 96, height: 9, rx: 4.5, fill: K("gris") }, g);
    el("rect", { x: -30, y: 4, width: 64, height: 9, rx: 4.5, fill: K("hueso") }, g);
    const ang = -Math.PI * (0.15 + 0.7 * r05());
    const desde = { x: D.x + Math.cos(ang) * q(1200, 900), y: D.y + Math.sin(ang) * q(900, 1100) };
    const hacia = { x: D.x + ((n % 3) - 1) * 70 * k + (r05() - 0.5) * 30, y: D.y + (150 - 40 - n * 34) * k };
    return { g, t0, desde, hacia, rot: (r05() - 0.5) * 16 };
  });
  reloj(C.talachas - 0.2, tBorra[1] + 0.05, (t) => {
    const golpe = tramo(t, tGolpe, tGolpe + 0.12), rebote = Math.sin(tramo(t, tGolpe + 0.12, tGolpe + 0.5) * Math.PI) * 6;
    const baja = golpe * 18 - rebote, fuera = ease.entra2(tramo(t, tBorra[0], tBorra[1]));
    for (const c of copias) {
      const u = ease.sale3(tramo(t, c.t0, c.t0 + 0.32));
      const x = D.x + (c.fx - D.x) * u, y = D.y - 70 * k + (c.fy - D.y + 70 * k) * u + baja + fuera * 400;
      c.g.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(0.3 + 0.7 * u).toFixed(3)}) rotate(${((1 - u) * 20).toFixed(1)})`);
      c.g.style.opacity = t < c.t0 ? 0 : 1 - fuera;
    }
    for (const a of avisos) {
      const u = ease.sale3(tramo(t, a.t0 - 0.22, a.t0));
      const b = Math.sin(tramo(t, a.t0, a.t0 + 0.25) * Math.PI) * 10;
      const x = a.desde.x + (a.hacia.x - a.desde.x) * u, y = a.desde.y + (a.hacia.y - a.desde.y) * u - b + baja + fuera * 500;
      a.g.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(a.rot * u).toFixed(1)}) scale(${k})`);
      a.g.style.opacity = t < a.t0 - 0.22 ? 0 : 1 - fuera;
    }
    hoja.style.opacity = 1 - fuera;
  });
  for (const a of avisos) onda(tl, pila, a.hacia.x, a.hacia.y, a.t0, { r0: 30, r1: 140, color: K("cieloClaro"), dur: 0.45 });
  cam.sacudir(tGolpe, 0.5, 16);
  cam.clave(tD + 1.7, CX, CYm, 1);
  cam.clave(tGolpe - 0.02, D.x * 0.08 + CX * 0.92, D.y * 0.08 + CYm * 0.92, 1.05, ease.seno);
  cam.clave(tBorra[1], CX, CYm, 1, ease.suave);
  // textos
  frase([["MIENTRAS", "TANTO…"]], [C.mientras + 0.1, T.w(5, "tanto,")], C.reportes - 0.36);
  const fMano = frase([["REPORTES"], ["A", "MANO"]], [C.reportes, T.w(5, "a"), C.mano], C.mismas - 0.3, { estilo: "golpe", colores: { 1: K("durazno"), 2: K("durazno") } });
  const fTal = frase([["LAS", "MISMAS"], ["TALACHAS"]], [T.w(5, "las"), C.mismas, C.talachas], T.w(5, "cada") - 0.34, { estilo: "cae", colores: { 2: K("cieloClaro") } });
  frase([["CADA"], ["DECISIÓN…"]], [T.w(5, "cada"), C.decision], C.termina - 0.3, { estilo: "barre", colores: { 1: K("azul") } });
  const fEsc = frase([["TERMINA", "EN"], ["TU", "ESCRITORIO."]], [C.termina, T.w(5, "en"), T.w(5, "tu", 2), C.escritorio], C.honesto - 0.1, { estilo: "golpe", colores: { 3: K("durazno") } });
  // la chispa dibuja el escritorio y se queda esperando arriba del monitor (no hace el trabajo manual)
  const esquina = { x: D.x + 250 * k, y: D.y - 250 * k };
  chispa.tramo(tD + 1.7, tD + 1.71, () => esquina);
  chispa.pierna(`M${P(0, 150)} Q${P(180, -120)} ${esquina.x},${esquina.y}`, tD + 1.7, tD + 2.1, { cola: 160 });
  // la chispa golpea las palabras clave: vuela del monitor a la palabra, cae encima, regresa
  // (9-oct, nota de Alejandro: «que Claude tenga más interacción: golpeando palabras, cayendo encima»)
  const golpes = [[fMano.palabras[2], C.mano], [fTal.palabras[2], C.talachas], [fEsc.palabras[3], C.escritorio]];
  let tLibre = tD + 2.1;
  for (const [pal, tg] of golpes) {
    const enc = { x: pal.cx, y: pal.y - pal.tam * 1.02 };
    chispa.quieta(tLibre, tg - 0.34, esquina.x, esquina.y, 5);
    chispa.pierna(`M${esquina.x},${esquina.y} Q${(esquina.x + enc.x) / 2},${Math.min(esquina.y, enc.y) - q(220, 260)} ${enc.x},${enc.y}`, tg - 0.34, tg - 0.01, { cola: 220, e: ease.entra2 });
    chispa.tramo(tg - 0.01, tg + 0.3, (t) => ({ x: enc.x, y: enc.y + 10 * Math.exp(-Math.pow((t - tg - 0.03) / 0.05, 2)) }));
    chispa.escala((t) => 1 + 0.7 * Math.exp(-Math.pow((t - tg) / 0.07, 2)));
    onda(tl, fijo, pal.cx, pal.cy, tg, { r0: 30, r1: pal.tam * 1.6, color: K("durazno"), ancho: 4, dur: 0.5 });
    chispa.pierna(`M${enc.x},${enc.y} Q${(esquina.x + enc.x) / 2},${Math.min(esquina.y, enc.y) - q(160, 200)} ${esquina.x},${esquina.y}`, tg + 0.3, tg + 0.62, { cola: 200, e: ease.suave });
    tLibre = tg + 0.62;
  }
  chispa.quieta(tLibre, C.honesto, esquina.x, esquina.y, 5);

  // ---------------- 06 · «¿cuánto de tu empresa todavía depende de ti?» ----------------
  const N = q({ x: CX, y: 690 }, { x: CX, y: 1180 }), RN = q(300, 360);
  const TITY = q(700, 1060);   // línea base de MÉTODO (08)
  // la chispa se va: en este silencio no hay método, solo tú
  chispa.pierna(`M${esquina.x},${esquina.y} Q${esquina.x + 150},${esquina.y - 260} ${W + 150},${q(-120, 300)}`, C.honesto, C.honesto + 0.45, { cola: 200, e: ease.entra2 });
  chispa.quieta(C.honesto + 0.46, C.falta + 0.15, W + 200, q(-200, 200), 0);
  const red = el("g", { class: "red" }, escena);
  const tu = el("ellipse", { cx: N.x, cy: N.y, rx: 0, ry: 0, fill: K("gris") }, red);
  const nodos = [];
  const r06 = azar(606);
  for (let n = 0; n < 22; n++) {
    const a = (n / 22) * Math.PI * 2 + (r06() - 0.5) * 0.25, rr = RN * (0.72 + r06() * 0.42);
    const x = N.x + Math.cos(a) * rr, y = N.y + Math.sin(a) * rr * q(0.92, 1.05);
    const hilo = el("path", { d: `M${x.toFixed(1)},${y.toFixed(1)} L${N.x},${N.y}`, stroke: K("cieloClaro"), "stroke-width": 2, opacity: 0.55 }, red);
    const c = el("circle", { cx: x, cy: y, r: 0, fill: hueso, opacity: 0.85 }, red);
    nodos.push({ x, y, hilo, c, t0: C.cuanto + 0.05 + n * 0.055 });
  }
  red.appendChild(tu);
  const tTu = C.honesto + 0.25;
  reloj(tTu - 0.05, C.ramal + 0.3, (t) => {
    const nace = ease.sale3(tramo(t, tTu, tTu + 0.5));
    // latido: dos golpes por segundo y medio, más tensos en «depende de ti»
    const ph = Math.max(0, t - C.cuanto), lat = (Math.exp(-Math.pow(((ph % 1.25) - 0.05) / 0.06, 2)) + 0.6 * Math.exp(-Math.pow(((ph % 1.25) - 0.3) / 0.06, 2))) * tramo(t, C.cuanto, C.cuanto + 0.3);
    const tension = ease.suave(tramo(t, C.depende, C.ti));
    const suelta = ease.entra2(tramo(t, C.herramienta, C.herramienta + 0.6));   // 07: los hilos se recogen
    const linea = ease.suave(tramo(t, C.falta, C.metodo - 0.02));             // 08: tú te vuelves una línea
    const rx = 40 * nace * (1 + lat * 0.12) + linea * q(560, 400), ry = Math.max(3, 40 * nace * (1 + lat * 0.12) * (1 - linea) + linea * 4);
    tu.setAttribute("rx", rx.toFixed(2)); tu.setAttribute("ry", ry.toFixed(2));
    tu.setAttribute("cy", (N.y + (TITY + 34 - N.y) * linea).toFixed(1));
    tu.setAttribute("fill", linea > 0.6 ? K("durazno") : K("gris"));
    tu.style.opacity = 1 - tramo(t, C.ramal - 0.15, C.ramal + 0.1);   // la barra se va con MÉTODO
    for (const nd of nodos) {
      const u = ease.sale3(tramo(t, nd.t0, nd.t0 + 0.4));
      const tir = 1 - tension * 0.16;
      const x = N.x + (nd.x - N.x) * tir, y = N.y + (nd.y - N.y) * tir;
      const vib = tension * 3 * Math.sin(t * 40 + nd.x);
      nd.c.setAttribute("cx", (x + vib).toFixed(1)); nd.c.setAttribute("cy", y.toFixed(1));
      nd.c.setAttribute("r", (9 * u * (1 - suelta)).toFixed(2));
      const hu = ease.suave(tramo(t, nd.t0 + 0.1, nd.t0 + 0.6)) * (1 - suelta);
      nd.hilo.setAttribute("d", `M${(x + vib).toFixed(1)},${y.toFixed(1)} L${(x + (N.x - x) * hu).toFixed(1)},${(y + (N.y - y) * hu).toFixed(1)}`);
      nd.hilo.setAttribute("stroke-width", (2 + tension * 1.6 + lat * 0.8).toFixed(2));
      nd.hilo.setAttribute("opacity", hu > 0.01 ? (0.5 + tension * 0.35).toFixed(2) : 0);
    }
  });
  onda(tl, red, N.x, N.y, C.ti - 0.1, { r0: 40, r1: q(420, 480), color: K("gris"), ancho: 3, dur: 1.2 });
  frase(q([["¿CUÁNTO", "DE", "TU", "EMPRESA"], ["DEPENDE", "DE", "TI?"]], [["¿CUÁNTO", "DE"], ["TU", "EMPRESA"], ["DEPENDE", "DE", "TI?"]]),
    [C.cuanto, T.w(6, "de", 1), T.w(6, "tu"), T.w(6, "empresa"), C.depende, T.w(6, "de", 2), T.w(6, "ti?")], C.porque - 0.3,
    { x: CX, y: q(200, 470), tam: q(100, 104), ancla: "centro", max: q(1500, 940), estilo: "sube", colores: { 6: K("durazno") } });

  // ---------------- 07 · «porque no te falta otra herramienta» ----------------
  const grises = LOGOS.filter((l) => l.id !== "claude");
  const r07 = azar(707);
  const fueraL = grises.map((lg, n) => {
    const a = (n / grises.length) * Math.PI * 2 - Math.PI / 2, rr = RN * 0.95;
    const g = el("g", {}, escena);
    insignia(g, lg, { r: q(32, 30), fondo: K("navyHondo"), borde: K("gris"), color: K("gris") });
    return { g, a, rr, t0: C.porque + n * 0.045, vuela: 0.6 + r07() * 0.8 };
  });
  reloj(C.porque - 0.1, C.falta + 0.4, (t) => {
    const sale = tramo(t, C.herramienta, C.herramienta + 0.65);
    for (const l of fueraL) {
      const u = ease.sale3(tramo(t, l.t0, l.t0 + 0.35));
      const rr = l.rr * (0.6 + 0.4 * u) + ease.entra2(sale) * q(900, 1000) * l.vuela;
      const glitch = sale > 0 && sale < 0.35 ? Math.sin(t * 160 + l.a * 9) * 14 : 0;
      const x = N.x + Math.cos(l.a + sale * 0.4) * rr + glitch, y = N.y + Math.sin(l.a + sale * 0.4) * rr;
      l.g.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(u * (1 - sale * 0.3)).toFixed(3)})`);
      const parpadeo = sale > 0 && sale < 0.35 ? (Math.floor(t * 30) % 2 ? 0.3 : 1) : 1;
      l.g.style.opacity = t < l.t0 ? 0 : (1 - ease.entra2(sale)) * parpadeo;
    }
  });
  frase(q([["NO", "TE", "FALTA"], ["OTRA", "HERRAMIENTA."]], [["NO", "TE", "FALTA"], ["OTRA"], ["HERRAMIENTA."]]),
    [T.w(7, "no"), T.w(7, "te"), T.w(7, "falta"), T.w(7, "otra"), C.herramienta], C.falta - 0.28,
    { x: CX, y: q(200, 470), tam: q(110, 112), ancla: "centro", max: q(1500, 940), estilo: "barre", colores: { 4: K("cieloClaro") } });

  // ---------------- 08 · «te falta un MÉTODO» ----------------
  // tú te vuelves una línea recta; la chispa la recorre y en «método» la línea escribe la palabra
  const fM1 = texto(fuente, letras, [["TE", "FALTA", "UN"]], { x: CX, y: q(330, 760), tam: 90, maxAncho: q(1200, 900), estilo: "sube" });
  ["te", "falta", "un"].forEach((w, i) => dibujar(tl, fM1.palabras[i], T.w(8, w), { dur: 0.3 }));
  const fM = texto(fuente, letras, [["MÉTODO."]], { x: CX, y: TITY, tam: q(330, 236), maxAncho: q(1500, 960), color: K("lima"), trazo: 4, estilo: "traza" });
  dibujar(tl, fM.palabras[0], C.metodo - 0.02, { dur: 0.24, escalon: 0.02 });
  const lim = el("rect", { width: W, height: H, fill: K("hueso"), opacity: 0 }, fijo);
  tl.fromTo(lim, { opacity: 0 }, { opacity: 0.35, duration: 0.03 }, C.metodo);
  tl.fromTo(lim, { opacity: 0.35 }, { opacity: 0, duration: 0.5, ease: "power2.out", immediateRender: false }, C.metodo + 0.03);
  onda(tl, fijo, CX, TITY - q(110, 80), C.metodo, { r0: 60, r1: q(1300, 1200), color: K("lima"), ancho: 6, dur: 0.9 });
  cam.clave(C.metodo - 0.02, CX, CYm, 1);
  cam.clave(C.metodo + 0.1, CX, CYm, 1.07, ease.sale3);
  cam.clave(C.metodo + 1.0, CX, CYm, 1, ease.suave);
  cam.sacudir(C.metodo, 0.4, 14);
  const yL = TITY + 34;   // la línea queda DEBAJO de la palabra: es su barra
  chispa.pierna(`M${-150},${yL} L${CX + q(600, 440)},${yL}`, C.falta + 0.15, C.metodo - 0.04, { cola: 420, e: ease.entra2 });
  ctx.medio = { TITY, fM, fM1, yL };
}
