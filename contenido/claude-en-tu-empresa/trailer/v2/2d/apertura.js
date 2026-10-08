// v2 · 2D «Un solo trazo» · 01–04 (0–28 s): gancho → bucle → 6 de 100 → «vas tarde».
// Una sola chispa encabeza un solo trazo que nunca se corta: escribe, subraya, se vuelve el bucle (con
// las herramientas de IA que llegan en oleadas), se enreda, colapsa en los cien puntos, une a los seis
// y regresa a rodearte. Mismas anclas y efectos que la 3D (v2/cues.js). Un solo texto a la vez.
// Formato: ctx.V (vertical 1080×1920) cambia solo posiciones, nunca la coreografía.
import { el, texto, dibujar, borrar, circulo, anillo, trazoReloj, azar, tramo, ease, K, insignia, onda } from "./trazo.js";
import { LOGOS } from "../logos.js";
import { OLEADAS, PASO_LOGO } from "../cues.js";

const deg = (r) => (r * 180) / Math.PI;

export function montar(ctx) {
  const { tl, capas, C, T, fuente, reloj, dom, chispa, cam, V, W, H } = ctx;
  const { escena, letras, fijo } = capas;
  const q = (h, v) => (V ? v : h);
  const lnz = (tag, a, p = escena) => el(tag, a, p);
  const CX = W / 2;

  // ---------------- 01 · enciende, «todo mundo habla» (cometas), «inteligencia artificial» ----------------
  const ARRIBA = { x: CX, y: q(330, 660) };
  const NACE = { x: CX, y: q(540, 960) };
  chispa.tramo(0, 0.7, () => NACE);
  chispa.escala((t) => {
    const k = ease.sale4(tramo(t, C.enciende - 0.05, C.enciende + 0.45));
    const latido = Math.exp(-Math.pow((t - (C.enciende + 0.5)) / 0.16, 2)) * 0.45;
    const flash = Math.exp(-Math.pow((t - (C.colapso + 0.58)) / 0.12, 2)) * 0.9;
    return t < C.enciende + 0.5 ? Math.max(0.001, k + latido) : 1 + latido + flash;
  });
  chispa.pierna(`M${NACE.x},${NACE.y} L${ARRIBA.x},${ARRIBA.y}`, 0.7, 0.95, { cola: 180 });
  chispa.tramo(0.95, 3.3, (t) => ({ x: ARRIBA.x, y: ARRIBA.y - 7 * Math.sin(((t - 0.95) / 2.35) * Math.PI * 2) }));
  // cometas: la conversación sobre IA que sale de la chispa, solo hacia arriba (nunca cruzan el texto)
  const r01 = azar(2026);
  const COLS = [K("azul"), K("cieloClaro"), K("hueso")];
  for (let k = 0; k < 46; k++) {
    const a = -Math.PI * (0.03 + 0.94 * r01()), L = 1000 + r01() * 900;
    const ex = ARRIBA.x + Math.cos(a) * L, ey = ARRIBA.y + Math.sin(a) * L;
    let nx = Math.sin(a), ny = -Math.cos(a); if (ny > 0) { nx = -nx; ny = -ny; }
    const b1 = 120 + r01() * 260, b2 = 80 + r01() * 220;
    const d = `M${ARRIBA.x},${ARRIBA.y} C${(ARRIBA.x + Math.cos(a) * L * 0.33 + nx * b1).toFixed(1)},${(ARRIBA.y + Math.sin(a) * L * 0.33 + ny * b1).toFixed(1)} ${(ARRIBA.x + Math.cos(a) * L * 0.66 + nx * b2).toFixed(1)},${(ARRIBA.y + Math.sin(a) * L * 0.66 + ny * b2).toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`;
    const op = +(0.4 + r01() * 0.5).toFixed(2);
    const p = lnz("path", { d, fill: "none", stroke: COLS[k % 3], "stroke-width": (1.4 + r01() * 2.4).toFixed(1), "stroke-linecap": "round" });
    const t0 = 0.72 + k * 0.042;
    tl.fromTo(p, { opacity: 0 }, { opacity: op, duration: 0.001 }, t0);
    tl.fromTo(p, { opacity: op }, { opacity: 0, duration: 0.001, immediateRender: false }, t0 + 1.12);
    tl.fromTo(p, { drawSVG: "0% 0%" }, { drawSVG: "0% 38%", duration: 0.32, ease: "power1.in" }, t0);
    tl.fromTo(p, { drawSVG: "0% 38%" }, { drawSVG: "100% 100%", duration: 0.78, ease: "power1.out", immediateRender: false }, t0 + 0.32);
  }
  const fIA = texto(fuente, letras, q([["INTELIGENCIA", "ARTIFICIAL"]], [["INTELIGENCIA"], ["ARTIFICIAL"]]), { x: CX, y: q(598, 900), tam: 150, maxAncho: q(1700, 920), estilo: "traza", colores: { 1: K("cieloClaro") } });
  dibujar(tl, fIA.palabras[0], C.ia, { dur: 0.3 });
  dibujar(tl, fIA.palabras[1], T.w(0, "artificial."), { dur: 0.3 });
  borrar(tl, fIA.palabras, C.pregunta - 0.62, { dur: 0.3, escalon: 0.008 });

  // «¿Qué hacer con ella en tu empresa?» y la barra que subraya EMPRESA: de ahí sale el bucle
  const fQ = texto(fuente, letras, q([["¿QUÉ", "HACER", "CON", "ELLA"], ["EN", "TU", "EMPRESA?"]], [["¿QUÉ", "HACER"], ["CON", "ELLA", "EN"], ["TU", "EMPRESA?"]]),
    { x: CX, y: q(520, 860), tam: q(112, 120), maxAncho: q(1500, 940), estilo: "golpe", colores: { 6: K("azul") } });
  const anclasQ = ["qué", "hacer", "con", "ella", "en", "tu", "empresa."].map((w) => T.w(1, w));
  fQ.palabras.forEach((p, i) => dibujar(tl, p, anclasQ[i], { dur: 0.36, escalon: 0.02 }));
  borrar(tl, fQ.palabras, C.pase01 - 0.5, { dur: 0.28, escalon: 0.006 });
  const emp = fQ.palabras[6];
  const X0 = emp.x0 + 4, X1 = emp.x1 - fuente.getAdvanceWidth("?", emp.tam) - 6, YS = emp.y + 30;
  const izq = Math.max(40, Math.min(...fQ.palabras.map((p) => p.x0)) - 120);
  chispa.pierna(`M${ARRIBA.x},${ARRIBA.y} C${izq},${ARRIBA.y - 30} ${izq},${YS + 60} ${X0},${YS}`, 3.3, C.empresa - 0.03, { cola: 260 });
  const barra = lnz("path", { d: `M${X0},${YS} L${X1},${YS}`, fill: "none", stroke: K("durazno"), "stroke-width": 9, "stroke-linecap": "round" });
  const LB = X1 - X0;
  barra.style.opacity = 0;
  const tBarra = [C.empresa, C.empresa + 0.32], tSuelta = [C.pase01 - 0.32, C.pase01 + 0.02];
  reloj(tBarra[0], tSuelta[1] + 0.05, (t) => {
    const h = ease.sale3(tramo(t, ...tBarra)) * LB, a = ease.entra2(tramo(t, ...tSuelta)) * LB;
    barra.setAttribute("stroke-dasharray", `0 ${a.toFixed(1)} ${Math.max(0, h - a).toFixed(1)} ${LB + 10}`);
    barra.style.opacity = h - a > 0.5 ? 1 : 0;
  });
  chispa.tramo(tBarra[0], tBarra[1], (t) => ({ x: X0 + ease.sale3(tramo(t, ...tBarra)) * LB, y: YS }));
  chispa.tramo(tBarra[1], tSuelta[0], () => ({ x: X1, y: YS }));

  // ---------------- 02 · el bucle ----------------
  const CY = q(540, 1010), R = q(380, 340), RL = R + q(118, 112);
  const T_CIRC = [C.pase01 + 0.3, T.wFin(2, "tecnológico:") - 0.05];
  chispa.pierna(`M${X1},${YS} C${X1 + 120},${YS + 40} ${CX + R * 0.7},${CY + R} ${CX},${CY + R}`, tSuelta[0], T_CIRC[0], { cola: 380, ancho: 6, e: ease.entra2 });
  const bucle = lnz("g", { class: "bucle" });
  const ecos = [0.16, 0.32].map((lag, i) => ({ lag, p: el("path", { d: circulo(CX, CY, R + (i ? -10 : 10)), fill: "none", stroke: K(i ? "cieloClaro" : "azul"), "stroke-width": 3, opacity: 0 }, bucle) }));
  const circ = trazoReloj(el("path", { d: circulo(CX, CY, R), fill: "none", stroke: K("azul"), "stroke-width": 7, "stroke-linecap": "round" }, bucle), { modo: "dibuja" });
  circ.path.style.opacity = 0;
  const T_GIRA = T_CIRC[1];
  const giro = (t) => { const u = Math.max(0, t - T_GIRA); const x = Math.max(0, t - C.avanzaron); return 0.42 * u + 0.05 * u * u + 0.9 * x * x; };
  const vel = (t) => { const u = Math.max(0, t - T_GIRA); const x = Math.max(0, t - C.avanzaron); return t < T_GIRA ? 0 : 0.42 + 0.1 * u + 1.8 * x; };
  const colapsa = (t) => 1 - ease.entra3(tramo(t, C.colapso - 0.05, C.colapso + 0.55));
  reloj(T_CIRC[0], C.colapso + 0.6, (t) => { circ.poner(ease.seno(tramo(t, ...T_CIRC))); });
  chispa.tramo(T_CIRC[0], T_CIRC[1], (t) => circ.path.getPointAtLength(ease.seno(tramo(t, ...T_CIRC)) * circ.L));
  chispa.tramo(T_CIRC[1], C.colapso + 0.55, (t) => { const g = giro(Math.min(t, C.colapso)), s = colapsa(t); return { x: CX - R * Math.sin(g) * s, y: CY + R * Math.cos(g) * s }; });
  // tres flechas: los tramos del ciclo
  [150, 270, 30].forEach((fd, k) => {
    const f = (fd * Math.PI) / 180, px = CX + R * Math.cos(f), py = CY + R * Math.sin(f);
    const tx = -Math.sin(f), ty = Math.cos(f), nx = Math.cos(f), ny = Math.sin(f);
    const fl = el("path", { d: `M${(px - tx * 16 + nx * 20).toFixed(1)},${(py - ty * 16 + ny * 20).toFixed(1)} L${(px + tx * 16).toFixed(1)},${(py + ty * 16).toFixed(1)} L${(px - tx * 16 - nx * 20).toFixed(1)},${(py - ty * 16 - ny * 20).toFixed(1)}`, fill: "none", stroke: K("azul"), "stroke-width": 7, "stroke-linecap": "round", "stroke-linejoin": "round" }, bucle);
    tl.fromTo(fl, { scale: 0, opacity: 0, transformOrigin: "50% 50%" }, { scale: 1, opacity: 1, duration: 0.42, ease: "back.out(2.6)" }, C.L[k]);
  });
  // «cuando sienten que ya avanzaron…»: el bucle se enreda (anillos que tiemblan y giran a destiempo)
  const r02 = azar(77);
  const MULT = [1.35, -0.6, 1.7, -1.0, 0.8];
  const anillos = MULT.map((m, j) => {
    const g = el("g", {}, bucle);
    const p = el("path", { d: anillo(CX, CY, R + 18 + j * q(16, 13), 10 + j * 5, 3 + j, r02() * 6.28), fill: "none", stroke: j % 2 ? K("cieloClaro") : K("azul"), "stroke-width": (2 + (j % 3) * 1.4).toFixed(1), "stroke-linecap": "round", opacity: (0.5 + 0.1 * j).toFixed(2) }, g);
    tl.fromTo(p, { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", duration: 1.25, ease: "power2.inOut" }, T.w(2, "y") + j * 0.42);
    tl.fromTo(p, { visibility: "hidden" }, { visibility: "visible", duration: 0.001 }, T.w(2, "y") + j * 0.42);
    return { g, m };
  });
  // las herramientas: llegan en oleadas (una por «sale…»), orbitan más lento que el bucle (paralaje)
  // y dejan estela cuando todo se acelera. Ángulo áureo: cada logo nuevo cae lejos del anterior.
  const orbita = lnz("g", { class: "herramientas" });
  const llegadas = [];
  C.oleadas.forEach((t0, k) => OLEADAS[k].forEach((id, j) => llegadas.push({ id, t: t0 + j * PASO_LOGO })));
  const logos = llegadas.map((l, n) => {
    const a0 = (n * 137.508 * Math.PI) / 180 - Math.PI / 2;
    const r = RL + ((n % 3) - 1) * q(14, 10);
    const g = el("g", {}, orbita);
    const estela = el("path", { fill: "none", stroke: K("cieloClaro"), "stroke-width": 3, "stroke-linecap": "round", opacity: 0 }, orbita);
    orbita.insertBefore(estela, orbita.firstChild);
    onda(tl, g, 0, 0, l.t, { r0: 20, r1: q(110, 90), color: l.id === "claude" ? K("durazno") : K("cieloClaro") });
    const b = insignia(g, LOGOS.find((x) => x.id === l.id), { r: q(34, 30) });
    tl.fromTo(b.dentro, { scale: 0, opacity: 0, transformOrigin: "50% 50%" }, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(2.4)" }, l.t);
    return { ...l, a0, r, g, estela };
  });
  // destello y sacudida en «sale otra»; empujón de cámara en cada oleada
  const flash = el("rect", { width: W, height: H, fill: K("cieloClaro"), opacity: 0 }, fijo);
  tl.fromTo(flash, { opacity: 0 }, { opacity: 0.22, duration: 0.04 }, C.L[2]);
  tl.fromTo(flash, { opacity: 0.22 }, { opacity: 0, duration: 0.35, ease: "power2.out", immediateRender: false }, C.L[2] + 0.04);
  cam.sacudir(C.L[2] - 0.02, 0.45, 12);
  cam.sacudir(C.avanzaron + 0.4, 1.2, 4);
  C.oleadas.forEach((t0) => { cam.clave(t0 - 0.02, CX, H / 2, 1); cam.clave(t0 + 0.14, CX, H / 2, 1.045, ease.sale3); cam.clave(t0 + 0.9, CX, H / 2, 1, ease.suave); });
  reloj(T_CIRC[0], C.colapso + 0.62, (t) => {
    const tg = Math.min(t, C.colapso);
    const g = giro(tg) + ease.entra3(tramo(t, C.colapso - 0.05, C.colapso + 0.55)) * 2.4, s = Math.max(0.001, colapsa(t));
    bucle.setAttribute("transform", `translate(${CX} ${CY}) rotate(${deg(g).toFixed(2)}) scale(${s.toFixed(4)}) translate(${-CX} ${-CY})`);
    bucle.style.opacity = t < C.colapso + 0.55 ? 1 : 0;
    for (const a of anillos) a.g.setAttribute("transform", `rotate(${deg(g * (a.m - 1)).toFixed(2)} ${CX} ${CY})`);
    // ecos del círculo: aparecen con la velocidad, atrasados en el giro
    const w = vel(tg);
    for (const e of ecos) {
      e.p.setAttribute("transform", `rotate(${(-deg(e.lag * w)).toFixed(2)} ${CX} ${CY})`);
      e.p.setAttribute("opacity", Math.min(0.45, Math.max(0, (w - 1.2) * 0.18)).toFixed(3));
    }
    // herramientas
    const go = 0.55 * giro(tg) + ease.entra3(tramo(t, C.colapso - 0.05, C.colapso + 0.55)) * 1.6, wo = 0.55 * w;
    orbita.style.opacity = t < C.colapso + 0.55 ? 1 : 0;
    for (const l of logos) {
      const a = l.a0 + go, rr = l.r * s;
      const x = CX + rr * Math.cos(a), y = CY + rr * Math.sin(a) + Math.sin(t * 1.7 + l.a0) * 4 * s;
      l.g.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${Math.max(0.001, 0.4 + 0.6 * s).toFixed(3)})`);
      const largo = Math.min(1.1, wo * 0.16) * tramo(t, l.t + 0.4, l.t + 0.8);
      if (largo > 0.02) {
        const a1 = a - largo, x1 = CX + rr * Math.cos(a1), y1 = CY + rr * Math.sin(a1);
        l.estela.setAttribute("d", `M${x1.toFixed(1)},${y1.toFixed(1)} A${rr.toFixed(1)},${rr.toFixed(1)} 0 0 1 ${x.toFixed(1)},${y.toFixed(1)}`);
        l.estela.setAttribute("opacity", (0.45 * Math.min(1, largo * 2)).toFixed(3));
      } else l.estela.setAttribute("opacity", 0);
    }
  });
  // las frases del bucle, una a la vez, en el centro
  const centro = (lineas, tam = 84, estilo = "sube", colores = {}) => texto(fuente, letras, lineas, { x: CX, y: lineas.length > 1 ? CY - 12 : CY + 32, tam, maxAncho: q(620, 560), estilo, colores });
  const frasesBucle = [
    [centro([["SALE", "UNA"], ["HERRAMIENTA", "NUEVA"]], 84, "cae", { 3: K("cieloClaro") }), ["sale", "una", "herramienta", "nueva,"].map((w) => T.w(2, w))],
    [centro([["LA", "PRUEBAN"], ["A", "SU", "MANERA"]], 84, "barre", { 4: K("azul") }), [T.w(2, "usarla"), T.w(2, "usarla") + 0.12, T.w(2, "a"), T.w(2, "su"), T.w(2, "manera,")]],
    [centro([["O", "NI", "ESO."]], 104, "golpe", { 2: K("durazno") }), ["o", "ni", "eso,"].map((w) => T.w(2, w))],
    [centro([["YA", "AVANZARON"]], 96, "sube", { 1: K("cieloClaro") }), [T.w(2, "ya"), C.avanzaron]],
    [centro([["SALE", "OTRA."]], 112, "golpe", { 1: K("durazno") }), [C.L[2], T.w(2, "otra.")]],
  ];
  frasesBucle.forEach(([f, anclas], i) => {
    f.palabras.forEach((p, k) => dibujar(tl, p, anclas[k], { dur: 0.34, escalon: 0.018 }));
    const fin = i < frasesBucle.length - 1 ? frasesBucle[i + 1][1][0] - 0.34 : C.colapso - 0.12;
    borrar(tl, f.palabras, fin, { dur: 0.24, escalon: 0.005 });
  });

  // ---------------- 03 · seis de cada cien ----------------
  // los seis, salteados y sin patrón (9-oct: unidos en orden dibujaban un «3»); la chispa salta de uno
  // a otro dejando solo estela, así no queda ninguna figura
  const PASO = 70, IDX = [13, 38, 52, 27, 76, 64], TU = 45;
  const G0 = q({ x: 1095, y: 225 }, { x: CX - 4.5 * PASO, y: 860 });
  const enRejilla = (i) => ({ x: G0.x + (i % 10) * PASO, y: G0.y + Math.floor(i / 10) * PASO });
  const CG = { x: G0.x + 4.5 * PASO, y: G0.y + 4.5 * PASO };
  const TUF = q({ x: 1400, y: 560 }, { x: CX, y: 1300 });   // dónde te quedas
  const rejilla = lnz("g", { class: "rejilla" });
  const seisG = lnz("g", { class: "seis" });
  const puntos = [];
  for (let i = 0; i < 100; i++) {
    const p = enRejilla(i), j = IDX.indexOf(i);
    const c = el("circle", { cx: p.x, cy: p.y, r: 0, fill: K("gris") }, j >= 0 ? seisG : rejilla);
    puntos.push({ c, ...p, j, d: Math.hypot(Math.floor(i / 10) - 4.5, (i % 10) - 4.5), col: i % 10 });
  }
  const tLlega = C.colapso + 0.95, tOla = tLlega - 0.05;
  chispa.pierna(`M${CX},${CY} C${CX + 160},${CY - 140} ${CG.x - 220},${CG.y - 120} ${CG.x},${CG.y}`, C.colapso + 0.58, tLlega, { cola: 200 });
  onda(tl, rejilla, CG.x, CG.y, tOla, { r0: 20, r1: q(460, 420), ancho: 4, dur: 0.9 });
  chispa.tramo(tLlega, C.seis - 0.3, (t) => ({ x: CG.x + 12 * Math.sin((t - tLlega) * 2.2), y: CG.y - 12 * (1 - Math.cos((t - tLlega) * 2.2)) }));
  const tSeis = IDX.map((_, j) => C.seis + 0.05 + j * 0.09);
  const p6 = IDX.map((i) => enRejilla(i));
  chispa.pierna(`M${CG.x},${CG.y} Q${(CG.x + p6[0].x) / 2 + 40},${(CG.y + p6[0].y) / 2 + 30} ${p6[0].x},${p6[0].y}`, C.seis - 0.3, tSeis[0], { cola: 140, e: ease.entra2 });
  const enlaces = [];
  for (let j = 0; j < 5; j++) {
    const a = p6[j], b = p6[j + 1], mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.18, my = (a.y + b.y) / 2 - (b.x - a.x) * 0.18;
    enlaces.push(chispa.pierna(`M${a.x},${a.y} Q${mx.toFixed(1)},${my.toFixed(1)} ${b.x},${b.y}`, tSeis[j], tSeis[j + 1], { modo: "cola", cola: 160, ancho: 4, padre: seisG, color: K("cieloClaro") }));
  }
  for (let j = 0; j < 5; j++) seisG.insertBefore(enlaces[j].path, seisG.firstChild);   // enlaces detrás de los puntos
  IDX.forEach((i, j) => onda(tl, seisG, p6[j].x, p6[j].y, tSeis[j], { r0: 16, r1: 70, ancho: 3, dur: 0.5 }));
  const tZoom = C.mientras - 0.25;          // 05: la cámara entra por el punto «tú»
  reloj(tOla - 0.05, C.mientras + 0.5, (t) => {
    for (const p of puntos) {
      const k = ease.sale3(tramo(t, tOla + p.d * 0.05, tOla + 0.45 + p.d * 0.05));
      const back = k + Math.sin(k * Math.PI) * 0.25;
      if (p.j >= 0) {
        const enc = ease.sale4(tramo(t, tSeis[p.j], tSeis[p.j] + 0.3));
        const prov = Math.exp(-Math.pow((t - (C.provecho + 0.1 + p.j * 0.05)) / 0.18, 2));
        p.c.setAttribute("r", (15 * back * (1 + enc * 0.3 + prov * 0.25)).toFixed(2));
        p.c.setAttribute("fill", enc > 0.5 ? K("cieloClaro") : K("gris"));
        p.c.setAttribute("filter", enc > 0.5 ? "url(#brillo)" : "none");
      } else if (p.c !== puntos[TU].c) {
        // 04 · «es normal sentir…»: los otros 93 caen en la pausa después de «IA.», de izquierda a derecha
        const cae = ease.entra2(tramo(t, C.normal - 0.35 + p.col * 0.03, C.normal + 0.3 + p.col * 0.03));
        p.c.setAttribute("r", (15 * back).toFixed(2));
        p.c.setAttribute("cy", (p.y + cae * 560).toFixed(1));
        p.c.style.opacity = 1 - ease.entra2(tramo(cae, 0.3, 1));
      }
    }
    const tu = puntos[TU], m = ease.suave(tramo(t, C.normal + 0.15, C.tarde + 0.45));
    const k = ease.sale3(tramo(t, tOla + tu.d * 0.05, tOla + 0.45 + tu.d * 0.05));
    tu.c.setAttribute("cx", (tu.x + (TUF.x - tu.x) * m).toFixed(1));
    tu.c.setAttribute("cy", (tu.y + (TUF.y - tu.y) * m).toFixed(1));
    tu.c.setAttribute("r", (15 * k * (1 + m * 1.7)).toFixed(2));
    tu.c.style.opacity = t < C.mientras + 0.08 ? 1 : 0;
    const va = ease.entra2(tramo(t, C.normal + 0.1, C.tarde + 0.5));
    seisG.setAttribute("transform", `translate(${(va * 900).toFixed(1)} ${(-va * 60).toFixed(1)})`);
  });
  const vaX = (t) => ease.entra2(tramo(t, C.normal + 0.1, C.tarde + 0.5));
  chispa.tramo(tSeis[5], C.tarde + 0.5, (t) => ({ x: p6[5].x + vaX(t) * 900, y: p6[5].y - vaX(t) * 60 }));
  // «6 de 100» sobre navy; la fuente en Inter
  const X6 = q(96, 250), Y6 = q(700, 720);
  const f6 = texto(fuente, letras, [["6"]], { x: X6, y: Y6, tam: 300, ancla: "izq", color: K("azul"), trazo: 3, estilo: "golpe" });
  const fDe = texto(fuente, letras, [["DE", "100"]], { x: f6.palabras[0].x1 + 30, y: Y6, tam: 120, ancla: "izq", estilo: "sube" });
  dibujar(tl, f6.palabras[0], C.seis, { dur: 0.45 });
  dibujar(tl, fDe.palabras[0], T.w(3, "de"), { dur: 0.32 });
  dibujar(tl, fDe.palabras[1], C.cien, { dur: 0.4 });
  const fuenteTxt = dom("div", "fuente", "McKinsey, The State of AI 2026");
  Object.assign(fuenteTxt.style, { left: `${X6}px`, top: `${Y6 + 60}px` });
  tl.fromTo(fuenteTxt, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, ease: "expo.out" }, C.cien + 0.25);
  tl.to(fuenteTxt, { opacity: 0, duration: 0.25, ease: "power1.in" }, C.normal - 0.35);
  borrar(tl, [...f6.palabras, ...fDe.palabras], C.normal - 0.35, { dur: 0.32, escalon: 0.01 });

  // ---------------- 04 · «es normal sentir que vas tarde» → «nadie te ha explicado cómo» ----------------
  const XT = q(96, 80), YT = q(500, 560), TT = q(130, 120);
  const fT = texto(fuente, letras, q([["ES", "NORMAL", "SENTIR"], ["QUE", "VAS", "TARDE."]], [["ES", "NORMAL"], ["SENTIR", "QUE"], ["VAS", "TARDE."]]), { x: XT, y: YT, tam: TT, ancla: "izq", maxAncho: q(1100, 920), estilo: "sube", colores: { 5: K("durazno") } });
  ["es", "normal", "sentir", "que", "vas", "tarde:"].forEach((w, i) => dibujar(tl, fT.palabras[i], T.w(4, w), { dur: 0.36 }));
  const tHa = C.ha;
  borrar(tl, fT.palabras, tHa - 0.3, { dur: 0.22, escalon: 0.004 });
  const fN = texto(fuente, letras, q([["NADIE", "TE", "HA"], ["EXPLICADO", "CÓMO."]], [["NADIE", "TE", "HA"], ["EXPLICADO"], ["CÓMO."]]), { x: XT, y: YT, tam: TT, ancla: "izq", maxAncho: q(1100, 920), estilo: "barre", colores: { 4: K("cieloClaro") } });
  [tHa, tHa + 0.04, tHa + 0.08, T.w(4, "explicado"), T.w(4, "cómo")].forEach((t, i) => dibujar(tl, fN.palabras[i], t, { dur: 0.38 }));
  borrar(tl, fN.palabras, C.mientras - 0.45, { dur: 0.24, escalon: 0.004 });
  // la chispa regresa y te rodea
  const tVuelve = tHa + 0.14, tOrbita = tVuelve + 0.5, RO = 118;
  const ent = q({ x: 2010, y: 380 }, { x: 1150, y: 1080 });
  chispa.pierna(`M${ent.x},${ent.y} C${ent.x - 210},${ent.y - 50} ${TUF.x + 160},${TUF.y - RO - 180} ${TUF.x},${TUF.y - RO}`, tVuelve, tOrbita, { cola: 240, e: ease.sale3 });
  chispa.pierna(`M${TUF.x},${TUF.y - RO} A${RO},${RO} 0 1 1 ${TUF.x - 0.1},${TUF.y - RO}`, tOrbita, tOrbita + 3.0, { modo: "dibuja", ancho: 3, e: ease.seno, color: K("cieloClaro"), fin: C.mientras + 0.08 });
  // empuje lento hacia ti y, en «mientras tanto», la cámara entra por el punto (05)
  cam.clave(C.tarde, CX, H / 2, 1);
  cam.clave(tZoom, TUF.x * 0.06 + CX * 0.94, TUF.y * 0.06 + (H / 2) * 0.94, 1.06, ease.seno);
  cam.clave(C.mientras + 0.08, TUF.x, TUF.y, 40, ease.entra3);
  ctx.ap = { TUF, tZoom };
}
