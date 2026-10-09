// v3 · «La interfaz viva» · 01–04 (0–31 s): el ruido de «todo mundo habla» → el bucle brutalista (una
// pista de tarjetas que se repite y se traga todo en un remolino) → 6 de 100 en arcilla → «vas tarde»
// (la luz baja; una barra de carga atorada en 94 %) → la cámara entra por el punto «tú».
// Una sola página que la cámara recorre hacia abajo (scrollytelling). La gota (la chispa de Claude en
// vidrio líquido) vive en la capa fija y sigue a la página con cam.aPantalla.
import { MARCA as M, caja, bruto, sticker, arcilla, vidrio, etiqueta, mezcla } from "./materiales.js";
import { frase, borrar } from "./tipo.js";
import { tramo, ease, azar } from "./motor.js";
import { LOGOS } from "../v2/logos.js";
import { OLEADAS, PASO_LOGO } from "../v2/cues.js";

const svg = (padre, w, h, html) => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("width", w); s.setAttribute("height", h); s.setAttribute("viewBox", `0 0 ${w} ${h}`); Object.assign(s.style, { position: "absolute", left: "0", top: "0", overflow: "visible" }); s.innerHTML = html || ""; padre.appendChild(s); return s; };
const icono = (padre, logo, s, color = M.navy) => { const n = svg(padre, s, s, `<path d="${logo.d}" fill="${color}" transform="scale(${s / 24})"/>`); return n; };

export function montar(ctx) {
  const { tl, C, T, W, H, V, q, pagina, fijo, motor, gota, glMascara } = ctx;
  const { reloj, cam } = motor;
  const CX = W / 2;
  const Y2 = H, Y3 = 2 * H;   // dónde empiezan las secciones en la página

  // ---------------- 01 · «Todo mundo habla de IA»: minimalismo exagerado y el ruido que entra ----------------
  const s1 = caja(pagina, { x: 0, y: 0, w: W, h: H });
  frase(tl, s1, { x: CX, y: q(250, 520), lineas: [["TODO", "MUNDO", "HABLA", "DE"]], tam: q(104, 92), ancla: "centro", estilo: "golpe", anclas: ["Todo", "mundo", "habla", "de"].map((w) => T.w(0, w)), fin: C.pregunta - 0.6 });
  // «INTELIGENCIA ARTIFICIAL» es vidrio líquido (shader): cada palabra crece en su palabra
  const tIA = [C.ia, T.w(0, "artificial.")], finIA = C.pregunta - 0.6;
  glMascara((g, t, s) => {
    if (t < tIA[0] - 0.12 || t > finIA + 0.3) return;
    const v = cam.aPantalla(CX, q(560, 860), t), sal = ease.entra2(tramo(t, finIA, finIA + 0.25));
    g.save(); g.font = `${q(178, 150) * v.s * s}px Anton`; g.textAlign = "center";
    const pals = q([["INTELIGENCIA ARTIFICIAL"]], [["INTELIGENCIA"], ["ARTIFICIAL"]]);
    if (pals.length === 1) {
      const u0 = ease.rebote(tramo(t, tIA[0] - 0.1, tIA[0] + 0.2)), u1 = ease.rebote(tramo(t, tIA[1] - 0.1, tIA[1] + 0.2));
      const anchoI = g.measureText("INTELIGENCIA ").width, total = g.measureText("INTELIGENCIA ARTIFICIAL").width;
      g.textAlign = "left";
      const x0 = v.x * s - total / 2;
      [["INTELIGENCIA", x0, u0], ["ARTIFICIAL", x0 + anchoI, u1]].forEach(([p, x, u]) => { if (u <= 0) return; g.save(); g.translate(x, v.y * s); g.scale(1, Math.max(0.001, u * (1 - sal))); g.fillText(p, 0, 0); g.restore(); });
    }
    g.restore();
  });
  // los globos brutalistas: la conversación sobre IA que invade el cuadro
  const r1 = azar(101);
  const GLOBOS = [
    ["¿Ya probaste la nueva?", M.lima, 70, 800, -4], ["Esto lo cambia todo", M.hueso, 110, 120, 5], ["¡SALIÓ OTRA IA!", M.durazno, 1330, 830, 3],
    ["Hay que usar agentes", M.cieloClaro, 1380, 150, -3], ["¿Viste el nuevo modelo?", M.hueso, 640, 900, 2], ["Prueba este prompt", M.lima, 1420, 660, 6],
  ];
  GLOBOS.forEach(([txt, fondo, x, y, rot], k) => {
    const g = bruto(s1, { x, y, w: 470, h: 92, fondo, r: 22, grosor: 5, sombra: 10 });
    Object.assign(g.style, { display: "flex", alignItems: "center", padding: "0 26px", fontFamily: "Inter", fontWeight: 800, fontSize: "30px", color: M.navy, opacity: 0 });
    g.textContent = txt;
    const t0 = 0.75 + k * 0.32;
    tl.fromTo(g, { opacity: 0, scale: 0.4, rotation: rot - 14 }, { opacity: 1, scale: 1, rotation: rot, duration: 0.3, ease: "back.out(2.6)" }, t0);
    tl.to(g, { opacity: 0, scale: 0.6, duration: 0.2, ease: "power2.in" }, C.pase01 - 0.3 + k * 0.02);
  });
  const notif = etiqueta(s1, { x: 840, y: q(1010, 1700), txt: "+12 notificaciones", fondo: M.rojo, color: M.blanco });
  tl.fromTo(notif, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.25, ease: "back.out(2)" }, 2.3);
  tl.to(notif, { opacity: 0, duration: 0.2 }, C.pase01 - 0.3);
  // «¿qué hacer con ella en tu empresa?»: una tarjeta brutalista sólida (texto sobre superficie)
  const tarj = bruto(s1, { x: q(380, 90), y: q(380, 760), w: q(1160, 900), h: q(330, 420), fondo: M.hueso, r: 18, sombra: 16 });
  tarj.style.opacity = 0;
  tl.fromTo(tarj, { opacity: 0, scale: 0.85, rotation: -2 }, { opacity: 1, scale: 1, rotation: -1, duration: 0.3, ease: "back.out(2)" }, C.pregunta - 0.15);
  tl.to(tarj, { opacity: 0, yPercent: -30, duration: 0.25, ease: "power2.in" }, C.pase01 - 0.35);
  frase(tl, tarj, { x: q(580, 450), y: q(36, 40), lineas: q([["¿QUÉ", "HACER", "CON", "ELLA"], ["EN", "TU", "EMPRESA?"]], [["¿QUÉ", "HACER"], ["CON", "ELLA", "EN"], ["TU", "EMPRESA?"]]), tam: q(118, 104), color: M.navy, ancla: "centro", estilo: "golpe", bloques: { 6: M.lima },
    anclas: ["qué", "hacer", "con", "ella", "en", "tu", "empresa."].map((w) => T.w(1, w)), fin: C.pase01 - 0.4 });

  // en el primer instante la gota cae sobre la pantalla: una onda de vidrio líquido recorre la aurora
  glMascara((g, t, s) => {
    for (const [t0, k] of [[C.enciende, 1], [C.enciende + 0.18, 0.6]]) {
      const u = tramo(t, t0, t0 + 1.1); if (u <= 0 || u >= 1) continue;
      const c = cam.aPantalla(q(1580, 860), q(250, 380), t), r = (40 + 900 * ease.sale3(u)) * k;
      g.save(); g.lineWidth = (26 * (1 - u) + 2) * s; g.globalAlpha = 1 - u; g.beginPath(); g.arc(c.x * s, c.y * s, r * s, 0, Math.PI * 2); g.stroke(); g.restore();
    }
  });
  // la gota: nace arriba a la derecha, late
  const GOTA0 = q({ x: 1580, y: 250 }, { x: 860, y: 380 });
  gota.tramo(0, C.pase01 - 0.2, (t) => ({ x: GOTA0.x, y: GOTA0.y - 8 * Math.sin(t * 2.2), s: ease.rebote(tramo(t, C.enciende - 0.05, C.enciende + 0.4)) * (1 + 0.25 * Math.exp(-Math.pow((t - C.enciende - 0.45) / 0.15, 2))) }));

  // ---------------- 02 · el bucle: neo-brutalismo sobre papel ----------------
  const s2 = caja(pagina, { x: 0, y: Y2, w: W, h: H * 2 });
  s2.style.background = `radial-gradient(${M.navy}22 2px, transparent 2.5px) 0 0 / 34px 34px, ${M.hueso}`;
  // el scroll: la página sube y aparece el papel (con un sobretiro como de dedo en el teléfono)
  cam.clave(C.pase01 - 0.25, 0, 0, 1);
  cam.clave(C.pase01 + 0.35, 0, Y2 + 30, 1, ease.sale4);
  cam.clave(C.pase01 + 0.7, 0, Y2, 1, ease.suave);
  const P = q({ x: 1350, y: Y2 + 540, R: 400 }, { x: 540, y: Y2 + 1200, R: 300 });
  const pista = svg(s2, W, 2 * H, `<circle cx="${P.x}" cy="${P.y - Y2}" r="${P.R}" fill="none" stroke="${M.navy}" stroke-width="16" stroke-linecap="round"/><circle cx="${P.x + 14}" cy="${P.y - Y2 + 14}" r="${P.R}" fill="none" stroke="${M.navy}" stroke-width="16" opacity="0.18"/>`);
  const aro = pista.querySelector("circle"), L = 2 * Math.PI * P.R;
  const tAro = [C.pase01 + 0.12, T.wFin(2, "tecnológico:") - 0.05];
  const giro = (t) => { const u = Math.max(0, t - tAro[1]); const x = Math.max(0, t - C.avanzaron); return 0.42 * u + 0.05 * u * u + 0.9 * x * x; };
  const colapsa = (t) => 1 - ease.entra3(tramo(t, C.colapso - 0.05, C.colapso + 0.55));
  reloj(tAro[0] - 0.01, C.colapso + 0.7, (t) => {
    const u = ease.suave(tramo(t, ...tAro)), g = giro(Math.min(t, C.colapso)) + ease.entra3(tramo(t, C.colapso - 0.05, C.colapso + 0.55)) * 3, s = Math.max(0.001, colapsa(t));
    aro.setAttribute("stroke-dasharray", `${(u * L).toFixed(1)} ${L}`);
    pista.style.transformOrigin = `${P.x}px ${P.y - Y2}px`;
    pista.style.transform = `rotate(${(g * 57.3 + 90).toFixed(2)}deg) scale(${s.toFixed(4)})`;
    pista.style.opacity = t < tAro[0] || t > C.colapso + 0.55 ? 0 : 1;
  });
  // la gota traza la pista y luego corre sobre ella
  const enAro = (t) => { const g = giro(Math.min(t, C.colapso)), s = colapsa(t); return cam.aPantalla(P.x + P.R * s * Math.cos(Math.PI / 2 + g), P.y + P.R * s * Math.sin(Math.PI / 2 + g), t); };
  gota.tramo(C.pase01 - 0.2, tAro[0], (t) => { const u = ease.entra2(tramo(t, C.pase01 - 0.2, tAro[0])), a = cam.aPantalla(P.x, P.y + P.R, t); return { x: GOTA0.x + (a.x - GOTA0.x) * u, y: GOTA0.y + (a.y - GOTA0.y) * u - Math.sin(u * Math.PI) * 160, s: 1 }; });
  gota.tramo(tAro[0], tAro[1], (t) => { const u = ease.suave(tramo(t, ...tAro)), a = Math.PI / 2 + u * Math.PI * 2; return { ...cam.aPantalla(P.x + P.R * Math.cos(a), P.y + P.R * Math.sin(a), t), s: 1 }; });
  gota.tramo(tAro[1], C.colapso + 0.55, (t) => ({ ...enAro(t), s: 1 }));
  // las tarjetas de herramientas: llegan en oleadas (una por «sale…»), golpean y se quedan en la pista
  const llegadas = [];
  C.oleadas.forEach((t0, k) => OLEADAS[k].forEach((id, j) => llegadas.push({ id, t: t0 + j * PASO_LOGO, ola: k })));
  const RC = P.R + q(10, 6);
  const tarjetas = llegadas.filter((l) => l.id !== "claude").map((l, n) => {
    const t = caja(s2, { x: 0, y: 0, w: q(132, 112), h: q(132, 112) }), lado = q(132, 112);
    const fondo = [M.lima, M.blanco, M.cieloClaro, M.durazno][n % 4];
    Object.assign(t.style, { background: fondo, border: `6px solid ${M.navy}`, borderRadius: "18px", boxShadow: `9px 9px 0 ${M.navy}`, left: "0", top: "0", opacity: 0 });
    const ic = caja(t, { x: lado * 0.21, y: lado * 0.21, w: lado * 0.5, h: lado * 0.5 }); icono(ic, LOGOS.find((x) => x.id === l.id), lado * 0.5);
    return { ...l, el: t, a0: (n * 137.508 * Math.PI) / 180, lado, rot: (n % 2 ? 7 : -6) };
  });
  const r2 = azar(202);
  reloj(C.oleadas[0] - 0.1, C.colapso + 0.7, (t) => {
    const g = 0.55 * giro(Math.min(t, C.colapso)) + ease.entra3(tramo(t, C.colapso - 0.05, C.colapso + 0.55)) * 4, s = Math.max(0.001, colapsa(t));
    for (const k of tarjetas) {
      const u = ease.rebote(tramo(t, k.t - 0.05, k.t + 0.3)), a = k.a0 + g, rr = RC * s;
      const x = P.x + rr * Math.cos(a) - k.lado / 2, y = P.y - Y2 + rr * Math.sin(a) - k.lado / 2;
      const vuela = 1 - ease.sale3(tramo(t, k.t - 0.05, k.t + 0.25));   // llega desde afuera, girando
      k.el.style.transform = `translate(${(x + Math.cos(a) * 500 * vuela).toFixed(1)}px, ${(y + Math.sin(a) * 500 * vuela).toFixed(1)}px) rotate(${(k.rot + vuela * 90 + g * 20).toFixed(1)}deg) scale(${Math.max(0.001, (0.4 + 0.6 * u) * (0.5 + 0.5 * s)).toFixed(3)})`;
      k.el.style.opacity = t < k.t - 0.05 || t > C.colapso + 0.55 ? 0 : 1;
    }
  });
  // un sticker NEW! por oleada, pegado a la tarjeta que llegó al último
  C.oleadas.forEach((t0, k) => {
    const st = sticker(s2, { x: 0, y: 0, w: 170, h: 74, texto: k === 3 ? "¡OTRA!" : "NEW!", tam: 50, rot: 0, fondo: k % 2 ? M.lima : M.durazno });
    const ult = tarjetas.filter((x) => x.ola === k).at(-1);
    st.style.opacity = 0;
    reloj(t0 - 0.05, (C.oleadas[k + 1] ?? C.colapso) + 0.1, (t) => {
      const el = ult.el.style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/);
      if (!el) return;
      const u = ease.rebote(tramo(t, t0 + 0.25, t0 + 0.5));
      st.style.transform = `translate(${(+el[1] + 40).toFixed(1)}px, ${(+el[2] - 40).toFixed(1)}px) rotate(${(12 - 24 * (1 - u)).toFixed(1)}deg) scale(${Math.max(0.001, u).toFixed(3)})`;
      st.style.opacity = t > t0 + 0.24 && t < (C.oleadas[k + 1] ?? C.colapso) ? 1 : 0;
    });
  });
  // quien vive en el bucle: una figura de arcilla (sin cara) corriendo al fondo de la pista
  const corre = caja(s2, { x: P.x - 60, y: P.y - Y2 + P.R * 0.35 - 170, w: 120, h: 220 });
  const cab = arcilla(corre, { x: 30, y: 0, w: 64, h: 64, r: "50%", color: M.durazno });
  const cuerpo = arcilla(corre, { x: 18, y: 60, w: 88, h: 100, r: "40px 40px 26px 26px", color: M.azul });
  const p1 = arcilla(corre, { x: 26, y: 150, w: 32, h: 70, r: 16, color: M.cieloHondo }), p2 = arcilla(corre, { x: 66, y: 150, w: 32, h: 70, r: 16, color: M.cieloHondo });
  corre.style.opacity = 0;
  reloj(T.w(2, "tu") - 0.3, C.colapso + 0.6, (t) => {
    const f = Math.sin(t * 15), vivo = t > T.w(2, "tu") - 0.2;
    corre.style.opacity = vivo && t < C.colapso + 0.2 ? 1 : 0;
    corre.style.transform = `translateY(${(-6 * Math.abs(f)).toFixed(1)}px) rotate(${(4 + 2 * f).toFixed(1)}deg) scale(${colapsa(t).toFixed(3)})`;
    p1.style.transform = `rotate(${(28 * f).toFixed(1)}deg)`; p2.style.transform = `rotate(${(-28 * f).toFixed(1)}deg)`;
  });
  // las frases del bucle, una a la vez, a la izquierda (sobre el papel)
  const XL = q(110, 90), YL = q(Y2 + 330, Y2 + 290 - Y2);
  const fr = (lineas, anclas, fin, o = {}) => frase(tl, s2, { x: XL, y: q(330, 290), lineas, tam: o.tam ?? q(118, 120), color: M.navy, estilo: o.estilo ?? "sube", bloques: o.bloques ?? {}, colores: o.colores ?? {}, anclas, fin });
  fr([["EL", "NUEVO"], ["BUCLE"], ["TECNOLÓGICO"]], [T.w(2, "el"), T.w(2, "nuevo"), C.bucle, T.w(2, "tecnológico:")], C.L[0] - 0.34, { estilo: "golpe", bloques: { 2: M.lima } });
  fr([["SALE", "UNA"], ["HERRAMIENTA"], ["NUEVA."]], ["sale", "una", "herramienta", "nueva,"].map((w) => T.w(2, w)), T.w(2, "usarla") - 0.34, { estilo: "cae", bloques: { 3: M.cieloClaro } });
  fr([["LA", "PRUEBAN"], ["A", "SU", "MANERA."]], [T.w(2, "usarla"), T.w(2, "usarla") + 0.12, T.w(2, "a"), T.w(2, "su"), T.w(2, "manera,")], C.niEso - 0.34, { estilo: "barre", bloques: { 4: M.durazno } });
  fr([["O", "NI"], ["ESO."]], ["o", "ni", "eso,"].map((w) => T.w(2, w)), T.w(2, "ya") - 0.34, { estilo: "golpe", tam: q(200, 190), bloques: { 2: M.lima } });
  fr([["YA"], ["AVANZARON…"]], [T.w(2, "ya"), C.avanzaron], C.L[2] - 0.34, { estilo: "sube" });
  // «SALE OTRA.»: golpe con aberración cromática (tres copias corridas)
  const otra = [[M.cieloClaro, -10], [M.durazno, 10], [M.navy, 0]].map(([col, dx]) => {
    const f = frase(tl, s2, { x: XL + dx, y: q(300, 280), lineas: [["SALE"], ["OTRA."]], tam: q(250, 230), color: col, estilo: "golpe", bloques: col === M.navy ? { 1: M.lima } : {}, anclas: [C.L[2], T.w(2, "otra.")], fin: C.colapso - 0.1 });
    return { f, dx };
  });
  reloj(C.L[2] - 0.1, C.colapso, (t) => { const k = Math.floor(t * 30); otra.slice(0, 2).forEach((o, i) => { o.f.c.style.transform = `translate(${(Math.sin(k * (i ? 2.3 : 3.7)) * 9).toFixed(1)}px, ${(Math.cos(k * 1.9) * 4).toFixed(1)}px)`; }); });
  // glitch de toda la página en cada vuelta del bucle (aberración cromática + franjas)
  ctx.glitch(C.glitches.map((t, k) => ({ t, dur: k === 3 ? 0.36 : 0.24, amp: k === 3 ? 22 : 14 })));
  motor.cam.sacudir(C.L[2] - 0.02, 0.45, 14);
  C.oleadas.forEach((t0) => { cam.clave(t0 - 0.02, 0, Y2, 1); cam.clave(t0 + 0.14, 0, Y2, 1.04, ease.sale3); cam.clave(t0 + 0.9, 0, Y2, 1, ease.suave); });

  // ---------------- 03 · 6 de 100: el remolino se vuelve una rejilla de arcilla ----------------
  const s3y = Y3;
  cam.clave(C.colapso + 0.28, 0, Y2, 1);
  cam.clave(C.colapso + 0.72, 0, s3y, 1, ease.sale4);
  const G = q({ x: 1180, y: s3y + 150, paso: 64 }, { x: 540 - 4.5 * 62, y: s3y + 820, paso: 62 });
  const SEIS = [13, 38, 52, 27, 76, 64], TU = 45;
  const pild = [];
  for (let i = 0; i < 100; i++) {
    const x = G.x + (i % 10) * G.paso, y = G.y + Math.floor(i / 10) * G.paso, j = SEIS.indexOf(i);
    const p = arcilla(pagina, { x, y, w: 46, h: 46, r: "50%", color: "#B9C9D4" });
    const luz = j >= 0 ? arcilla(pagina, { x, y, w: 46, h: 46, r: "50%", color: M.cieloClaro }) : null;
    if (luz) luz.style.boxShadow += `, 0 0 30px 10px ${M.cieloClaro}, 0 0 70px 18px ${M.azul}88`;
    pild.push({ p, luz, x, y, j, d: Math.hypot(Math.floor(i / 10) - 4.5, (i % 10) - 4.5), col: i % 10 });
  }
  const tOla = C.colapso + 0.42, tSeis = SEIS.map((_, j) => C.seis + 0.05 + j * 0.09);
  const TUF = q({ x: 1330, y: s3y + 600 }, { x: 540, y: s3y + 1180 });
  reloj(tOla - 0.05, C.mientras + 0.2, (t) => {
    const va = ease.entra2(tramo(t, C.normal + 0.1, C.tarde + 0.5));    // los seis se adelantan
    for (const [i, k] of pild.entries()) {
      const u = ease.rebote(tramo(t, tOla + k.d * 0.05, tOla + 0.4 + k.d * 0.05));
      if (i === TU) {
        const m = ease.suave(tramo(t, C.normal + 0.15, C.tarde + 0.45));
        k.p.style.transform = `translate(${((TUF.x - k.x) * m).toFixed(1)}px, ${((TUF.y - k.y) * m).toFixed(1)}px) scale(${Math.max(0.001, u * (1 + 1.6 * m)).toFixed(3)})`;
        k.p.style.opacity = t < C.mientras + 0.08 ? 1 : 0;
      } else if (k.j >= 0) {
        const on = ease.rebote(tramo(t, tSeis[k.j], tSeis[k.j] + 0.3));
        k.p.style.transform = `scale(${Math.max(0.001, u).toFixed(3)})`;
        k.luz.style.transform = `translate(${(va * 1100).toFixed(1)}px, ${(-va * 80).toFixed(1)}px) scale(${Math.max(0.001, on * (1 + 0.25 * Math.exp(-Math.pow((t - C.provecho - 0.1 - k.j * 0.05) / 0.18, 2)))).toFixed(3)})`;
        k.luz.style.opacity = t < tSeis[k.j] ? 0 : 1;
        k.p.style.opacity = 1 - tramo(t, C.normal - 0.3, C.normal + 0.2);
      } else {   // 04 · los demás se apagan a silueta (la luz cuenta: tú te quedas atrás)
        const cae = ease.entra2(tramo(t, C.normal - 0.35 + k.col * 0.03, C.normal + 0.3 + k.col * 0.03));
        k.p.style.transform = `translateY(${(cae * 520).toFixed(1)}px) scale(${Math.max(0.001, u).toFixed(3)})`;
        k.p.style.opacity = (1 - ease.entra2(tramo(cae, 0.3, 1))).toFixed(3);
      }
    }
  });
  // la gota toca a los seis, uno por uno, y se va con ellos
  const pSeis = SEIS.map((i) => ({ x: pild[i].x + 23, y: pild[i].y - 30 }));
  gota.tramo(C.colapso + 0.55, C.seis - 0.15, (t) => { const c = { x: G.x + 4.5 * G.paso + 23, y: G.y - 60 }; return { ...cam.aPantalla(c.x, c.y - 10 * Math.sin(t * 2.2), t), s: 1 }; });
  tSeis.forEach((ts, j) => {
    const a = j ? pSeis[j - 1] : { x: G.x + 4.5 * G.paso + 23, y: G.y - 60 }, b = pSeis[j], t0 = j ? tSeis[j - 1] : C.seis - 0.15;
    gota.tramo(t0, ts, (t) => { const u = ease.suave(tramo(t, t0, ts)); return { ...cam.aPantalla(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u - Math.sin(u * Math.PI) * 50, t), s: 1 + 0.4 * Math.exp(-Math.pow((t - ts) / 0.06, 2)) }; });
  });
  gota.tramo(tSeis[5], C.tarde + 0.5, (t) => { const va = ease.entra2(tramo(t, C.normal + 0.1, C.tarde + 0.5)); return { ...cam.aPantalla(pSeis[5].x + va * 1100, pSeis[5].y - va * 80, t), s: 1 }; });
  const fseis = frase(tl, pagina, { x: q(70, 130), y: q(s3y + 40, s3y + 250), lineas: [["6"]], tam: q(860, 560), color: M.navy, estilo: "golpe", anclas: [C.seis], fin: C.normal - 0.35 });
  frase(tl, pagina, { x: q(560, 130), y: q(s3y + 740, s3y + 730), lineas: q([["DE", "CADA", "100"], ["EMPRESAS"]], [["DE", "CADA", "100"], ["EMPRESAS"]]), tam: q(104, 100), color: M.navy, estilo: "sube", bloques: { 3: M.lima }, anclas: [T.w(3, "de"), T.w(3, "cada"), C.cien, C.empresas], fin: C.normal - 0.35 });
  const fuente = etiqueta(pagina, { x: q(1180, 130), y: q(s3y + 810, s3y + 980), txt: "McKinsey · The State of AI 2026", fondo: M.navy, tam: 20 });
  tl.fromTo(fuente, { opacity: 0 }, { opacity: 1, duration: 0.3 }, C.empresas + 0.3); tl.to(fuente, { opacity: 0, duration: 0.2 }, C.normal - 0.35);

  // ---------------- 04 · «es normal sentir que vas tarde»: la luz baja; la barra de carga se atora ----------------
  const sombra = caja(pagina, { x: 0, y: s3y, w: W, h: H });
  sombra.style.background = M.navy; sombra.style.opacity = 0;
  tl.fromTo(sombra, { opacity: 0 }, { opacity: 0.94, duration: 0.6, ease: "power2.inOut" }, C.normal - 0.2);
  sombra.style.zIndex = 1;
  for (const k of pild) { k.p.style.zIndex = 2; if (k.luz) k.luz.style.zIndex = 2; }
  const barra = vidrio(pagina, { x: TUF.x - 230, y: TUF.y + 120, w: 460, h: 64, r: 32, blur: 14, tono: "rgba(255,255,255,0.10)", z: 3 });
  const llena = caja(barra, { x: 8, y: 8, w: 0, h: 48 }); Object.assign(llena.style, { borderRadius: "24px", background: `linear-gradient(90deg, ${M.cieloHondo}, ${M.cieloClaro})` });
  const pct = etiqueta(pagina, { x: TUF.x - 52, y: TUF.y + 200, txt: "0 %", fondo: "rgba(10,26,47,0.9)", color: M.hueso, tam: 24, z: 3 });
  barra.style.opacity = 0; pct.style.opacity = 0;
  reloj(C.normal, C.mientras + 0.1, (t) => {
    const u = Math.min(0.94, 0.94 * ease.sale3(tramo(t, C.normal + 0.3, C.tarde + 0.3)));
    llena.style.width = `${(444 * u).toFixed(1)}px`;
    pct.textContent = `${Math.round(u * 100)} %`;
    const vis = tramo(t, C.normal + 0.2, C.normal + 0.45) * (t < C.mientras + 0.08 ? 1 : 0);
    barra.style.opacity = vis; pct.style.opacity = vis * (u >= 0.94 && Math.floor(t * 3) % 2 ? 0.45 : 1);
  });
  const XT = q(110, 130), YT = q(s3y + 300, s3y + 330);
  frase(tl, pagina, { x: XT, y: YT, lineas: q([["ES", "NORMAL", "SENTIR"], ["QUE", "VAS", "TARDE."]], [["ES", "NORMAL"], ["SENTIR", "QUE"], ["VAS", "TARDE."]]), tam: q(124, 118), color: M.hueso, estilo: "sube", colores: { 5: M.durazno }, z: 3,
    anclas: ["es", "normal", "sentir", "que", "vas", "tarde:"].map((w) => T.w(4, w)), fin: C.ha - 0.3 });
  frase(tl, pagina, { x: XT, y: YT, lineas: q([["NADIE", "TE", "HA"], ["EXPLICADO", "CÓMO."]], [["NADIE", "TE", "HA"], ["EXPLICADO"], ["CÓMO."]]), tam: q(124, 118), color: M.hueso, estilo: "barre", colores: { 4: M.cieloClaro }, z: 3,
    anclas: [C.ha, C.ha + 0.04, C.ha + 0.08, T.w(4, "explicado"), T.w(4, "cómo")], fin: C.mientras - 0.45 });
  // el tooltip vacío de «cómo»: una tarjeta de vidrio con un «?» que nadie llena
  const tip = vidrio(pagina, { x: TUF.x - 150, y: TUF.y - 330, w: 300, h: 170, r: 28, blur: 16, tono: "rgba(255,255,255,0.12)", z: 3 });
  const qq = document.createElement("div"); Object.assign(qq.style, { position: "absolute", left: "0", right: "0", top: "8px", textAlign: "center", fontFamily: "Anton", fontSize: "120px", color: M.durazno, lineHeight: "1" }); qq.textContent = "?"; tip.appendChild(qq);
  tip.style.opacity = 0;
  tl.fromTo(tip, { opacity: 0, y: 30, scale: 0.8 }, { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: "back.out(2.4)" }, C.como - 0.1);
  tl.to(tip, { opacity: 0, duration: 0.001 }, C.mientras + 0.08);
  // la gota regresa a ti y te rodea; la cámara entra por el punto «tú» (portal al escritorio)
  const ent = { x: W + 200, y: q(300, 800) };
  gota.tramo(C.tarde + 0.5, C.ha + 0.14, () => ({ ...ent, s: 1 }));
  const RO = 150;
  gota.tramo(C.ha + 0.14, C.ha + 0.64, (t) => { const u = ease.sale3(tramo(t, C.ha + 0.14, C.ha + 0.64)), d = cam.aPantalla(TUF.x + 23, TUF.y + 23 - RO, t); return { x: ent.x + (d.x - ent.x) * u, y: ent.y + (d.y - ent.y) * u, s: 1 }; });
  gota.tramo(C.ha + 0.64, C.mientras + 0.1, (t) => { const a = -Math.PI / 2 + ((t - C.ha - 0.64) / 1.5) * Math.PI * 2; return { ...cam.aPantalla(TUF.x + 23 + Math.cos(a) * RO, TUF.y + 23 + Math.sin(a) * RO, t), s: 1 }; });
  cam.clave(C.tarde, 0, s3y, 1);
  cam.clave(C.mientras - 0.25, (TUF.x + 23 - CX) * 0.06, s3y + (TUF.y + 23 - s3y - H / 2) * 0.06, 1.06, ease.suave);
  cam.clave(C.mientras + 0.08, TUF.x + 23 - CX, TUF.y + 23 - H / 2, 34, ease.entra3);
  ctx.ap = { TUF, s3y };
}
