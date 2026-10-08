// v2 · 2D «Un solo trazo» · cierres (49–87 s). Plática: la pantalla en vivo, los tres escalones de
// lo que te contamos, todo entra a una sola ventana, tu equipo resuelve sin hilos hacia ti. Curso: el
// título con la chispa de asterisco, Excel/Word/correo con la chispa adentro, los tres «sin».
// Común: respaldo (+40 encendidos), el eco del arranque, «nosotros te enseñamos», telón al degradado
// héroe y la tarjeta final con la flecha lima (lo único lima del cuadro).
import { el, texto, dibujar, borrar, tramo, ease, K, onda, azar } from "./trazo.js";

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
    lineas.flat().forEach((w, i) => { if (ENFASIS[w] && w !== "CLAUDE") colores[i] = sobreCielo ? K("blanco") : K(ENFASIS[w]); });
    if (sobreCielo) lineas.flat().forEach((w, i) => { if (["LUGAR", "GRATIS.", "MANO.", "EQUIPO", "VIVO"].includes(w)) colores[i] = K("blanco"); });
    const estilo = o.estilo ?? ROTA[nFrase++ % ROTA.length];
    const f = texto(fuente, letras, lineas, { x: o.x ?? CX, y: o.y ?? ARR.y, tam: o.tam ?? ARR.tam, ancla: o.ancla ?? "centro", maxAncho: o.max ?? ARR.max, color: o.color ?? hueso, trazo: o.trazo, interlinea: o.inter ?? 1.0, estilo, colores: { ...colores, ...(o.colores || {}) } });
    f.palabras.forEach((p, i) => dibujar(tl, p, anclas[i], { dur: o.dur ?? 0.32 }));
    if (fin) borrar(tl, f.palabras, fin, { dur: 0.24, escalon: 0.005 });
    return f;
  };
  const w = (i, palabra, n) => T.w(i, palabra, n);
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

    // ---------------- 10 · lo que te contamos: tres escalones ----------------
    const E = q({ x: 330, y: 560, dx: 420, dy: 140, L: 380 }, { x: 110, y: 960, dx: 290, dy: 190, L: 280 });
    const finEsc = C.todo - 0.05;
    const esc = grupoVentana(escena, C.contamos, finEsc + 0.3);
    let px = x1, py = y0 + 30;
    C.b.forEach((tb, k) => {
      const sx = E.x + k * E.dx, sy = E.y + k * E.dy;
      chispa.pierna(`M${px},${py} Q${(px + sx) / 2},${Math.min(py, sy) - 120} ${sx},${sy}`, tb - 0.45, tb - 0.05, { cola: 180 });
      linea(`M${sx},${sy} L${sx + E.L},${sy} L${sx + E.L},${sy + E.dy * 0.6}`, tb - 0.05, tb + 0.45, { padre: esc, ancho: 6 });
      const ix = sx + E.L / 2, iy = sy - q(80, 80);
      const ic = el("g", { transform: `translate(${ix} ${iy})` }, esc);
      onda(tl, esc, ix, iy, tb + 0.1, { r0: 20, r1: 110 });
      if (k === 0) for (let r = 0; r < 7; r++) { const a = -Math.PI * (0.1 + 0.8 * (r / 6)); dibujo(ic, `M${Math.cos(a) * 14},${Math.sin(a) * 14} L${Math.cos(a) * 52},${Math.sin(a) * 52}`, tb + 0.1 + r * 0.03, 0.25, { color: [K("azul"), K("cieloClaro"), hueso][r % 3], ancho: 4 }); }
      if (k === 1) for (let r = 0; r < 6; r++) { const c = el("circle", { cx: (r % 3 - 1) * 30, cy: (Math.floor(r / 3) - 0.5) * 30, r: 0, fill: K("cieloClaro") }, ic); tl.fromTo(c, { attr: { r: 0 } }, { attr: { r: 10 }, duration: 0.3, ease: "back.out(3)" }, tb + 0.1 + r * 0.06); }
      if (k === 2) { dibujo(ic, "M24,-34 A42,42 0 1 0 40,14", tb + 0.1, 0.4, { color: K("azul"), ancho: 6 }); dibujo(ic, "M40,14 L72,-4 M58,-22 L72,-4 L80,18", tb + 0.45, 0.25, { color: K("cieloClaro"), ancho: 5 }); }
      tl.fromTo(ic, { scale: 0.6, transformOrigin: "50% 50%" }, { scale: 1, duration: 0.4, ease: "back.out(2.2)" }, tb + 0.1);
      px = sx + E.L; py = sy + E.dy * 0.6;
    });
    chispa.quieta(C.b[2] + 0.45, C.todo - 0.4, px, py, 4);
    frase(q([["QUÉ", "ESTÁ", "PASANDO"], ["CON", "LA", "IA"]], [["QUÉ", "ESTÁ"], ["PASANDO"], ["CON", "LA", "IA"]]), [C.b[0], w(10, "está"), w(10, "pasando"), w(10, "con", 1), w(10, "la", 1), w(10, "IA,")], C.b[1] - 0.26);
    frase(q([["QUÉ", "HACEN", "LAS", "QUE"], ["SÍ", "LA", "APROVECHAN"]], [["QUÉ", "HACEN"], ["LAS", "QUE", "SÍ"], ["LA", "APROVECHAN"]]), [C.b[1], w(10, "hacen"), w(10, "las"), w(10, "que", 3), w(10, "sí"), w(10, "la", 2), w(10, "aprovechan,")], C.b[2] - 0.24);
    frase(q([["CÓMO", "SALIR"], ["DEL", "BUCLE"]], [["CÓMO", "SALIR"], ["DEL", "BUCLE"]]), [C.b[2], w(10, "salir"), w(10, "del"), w(10, "bucle:")], C.todo - 0.3);
    unLugar(px, py, [C.todo, w(10, "en", 1), w(10, "un", 1), w(10, "mismo", 1), C.lugar], [w(10, "con", 2), C.claude, w(10, "y", 2), w(10, "un", 2), w(10, "mismo", 2), C.metodo2], true);
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

  // ---------------- respaldo: VADAI × Total Coach, +40 empresas ----------------
  const iR = platica ? 11 : 12;
  const PL = q({ y: 330, w: 760, h: 150 }, { y: 640, w: 900, h: 150 });
  const placa = el("g", {}, escena);
  const finR = C.porque2 - 0.3;
  el("rect", { x: CX - PL.w / 2, y: PL.y - PL.h / 2, width: PL.w, height: PL.h, rx: PL.h / 2, fill: K("blanco") }, placa);
  const hV = 62, wV = (3839 / 1302) * hV, hT = 58, wT = (1110 / 252) * hT, gap = 70;
  const tot = wV + gap + wT, lx = CX - tot / 2;
  const iV = el("image", { href: "./assets/marca/vadai-horizontal-recorte.png", x: lx, y: PL.y - hV / 2, width: wV, height: hV }, placa);
  el("rect", { x: lx + wV + gap / 2 - 1, y: PL.y - 25, width: 2, height: 50, fill: hueso }, placa);
  const iT = el("image", { href: "./assets/marca/totalcoach-recorte.png", x: lx + wV + gap, y: PL.y - hT / 2, width: wT, height: hT }, placa);
  tl.fromTo(placa, { opacity: 0, scale: 0.7, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2)" }, C.respaldan);
  tl.fromTo(iV, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.35, ease: "expo.out" }, C.vadai);
  tl.fromTo(iT, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.35, ease: "expo.out" }, C.total);
  tl.fromTo(placa, { opacity: 1 }, { opacity: 0, duration: 0.3, immediateRender: false }, finR);
  // 40 puntos (eco de los cien) que se encienden con el contador
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
  // cada tiempo del cierre vive con un empuje lento de cámara; el cambio de tiempo es un corte
  const tiempos = (platica ? [C.ramal, C.contamos, C.todo, C.equipo2, C.respaldan, C.porque2, C.nosotros] : [C.ramal, C.aprende - 0.4, C.apps[0] - 0.4, C.sin[0] - 0.1, C.sin[1] - 0.1, C.sin[2] - 0.1, C.todo, C.equipo2, C.respaldan, C.porque2, C.nosotros]).concat([C.dale - 0.12]);
  tiempos.slice(0, -1).forEach((t0, i) => { cam.corte(t0, CX, CYm, 1); cam.clave(tiempos[i + 1] - 0.02, CX, CYm, 1.045, ease.seno); });
  cam.corte(C.dale - 0.12, CX, CYm, 1);
  const hv = ctx.ventanaFinal.head;
  chispa.pierna(`M${hv.x},${hv.y} Q${CX + PL.w / 2 + 120},${PL.y - 160} ${CX + PL.w / 2 + 30},${PL.y - PL.h / 2 - 10}`, C.respaldan - 0.3, C.respaldan + 0.1, { cola: 200 });
  chispa.quieta(C.respaldan + 0.1, C.porque2, CX + PL.w / 2 + 30, PL.y - PL.h / 2 - 10, 5);

  // ---------------- «porque todo mundo te va a seguir hablando de IA» (eco del arranque) ----------------
  const iP = iR + 1, iN = iR + 2;
  const ARRIBA = { x: CX, y: q(330, 660) };
  chispa.pierna(`M${CX + PL.w / 2 + 30},${PL.y - PL.h / 2 - 10} Q${CX + 200},${ARRIBA.y - 120} ${ARRIBA.x},${ARRIBA.y}`, C.porque2, C.porque2 + 0.4, { cola: 200 });
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
  if (platica) frase([["ESTO", "ES", "GRATIS."]], [w(15, "esto"), w(15, "es"), C.gratis], C.caro - 0.3, { y: YC, tam: q(150, 130), color: navy, max: q(1600, 960) });
  frase(q([["LO", "CARO", "ES", "QUE", "SIGAN"], ["HACIENDO", "LAS", "COSAS", "A", "MANO."]], [["LO", "CARO", "ES"], ["QUE", "SIGAN"], ["HACIENDO", "LAS"], ["COSAS", "A", "MANO."]]),
    ["lo", "caro", "es", "que", "sigan", "haciendo", "las", "cosas", "a", "mano."].map((x) => w(16, x)), C.fin + 0.15, { y: q(330, 640), tam: q(110, 104), color: navy, max: q(1700, 960) });
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
}
