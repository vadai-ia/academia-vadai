// 06–10 · El recorrido: la cámara baja piso por piso y en cada uno pasa un aprendizaje.
// 06 Dirección (cuenta lista) · 07 Operaciones (PACTO) · 08 Finanzas (trabajo terminado,
// y la transición héroe 08→09 a través de la ventana) · 09 Ventas (conectores) · 10 RH (habilidad).
import * as THREE from "three";
import { $, titular, entrar, salir, pop, deslizar, contar, escribir, llenar, CHISPA_SVG } from "../estilo/ui.js";
import { interruptor, letrasPACTO, archivo, satelite, ICONOS, llave, carpeta3d, enchufe, receta, cartucho, caja, tarjeta } from "../mundo/utileria.js";
import { curva, tramo, C } from "../estilo/mundo.js";
import { PASO } from "../mundo/escena.js";

const Y = (i) => -PASO * i;

// encabezado de sección «NN · TEXTO» (Anton), entra por palabras y sale empujado
function encabezado(ctx, capa, num, texto, t, tSale, dy = -70) {
  const e = $("div", "eyebrow", capa);
  const n = $("span", "mascara", e); const nn = $("span", "palabra num", n, num + " ·");
  e.appendChild(document.createTextNode(" "));
  const ws = texto.split(" ").map((w) => { const m = $("span", "mascara", e); const x = $("span", "palabra", m, w); e.appendChild(document.createTextNode(" ")); return x; });
  entrar(ctx.tl, [nn, ...ws], t, { escalon: 0.06 });
  salir(ctx.tl, [nn, ...ws], tSale, { dy });
  return e;
}
// capa de una toma con ventana de tiempo
function capaToma(ctx, desde, hasta) {
  const c = $("div", "capa", ctx.raiz);
  ctx.tl.set(c, { autoAlpha: 0 }, 0);
  ctx.tl.set(c, { autoAlpha: 1 }, desde);
  ctx.tl.set(c, { autoAlpha: 0 }, hasta);
  return c;
}
function card(capa, x, y, w, h, cls = "") {
  const d = $("div", "tarjeta " + cls, capa);
  Object.assign(d.style, { left: x + "px", top: y + "px", width: w + "px", height: h + "px" });
  return d;
}
// línea de OST en Anton con palabras ancladas a tiempos
function lineaOST(ctx, capa, texto, tiempos, estilo, cls = "tit") {
  const t = titular(capa, [texto], cls);
  Object.assign(t.style, estilo);
  t.palabras.forEach((w, i) => entrar(ctx.tl, w, tiempos[Math.min(i, tiempos.length - 1)], { escalon: 0 }));
  return t;
}

export async function montar(ctx) {
  const { s, dir, tl, p, B, beat, escena } = ctx;
  const T06 = B(14), T07 = B(18), T08 = B(25), T09 = B(31), T10 = B(37), T11 = B(42);

  // =================== 06 · Dirección: deja tu cuenta lista ===================
  dir.camara([
    { t: T06 + 0.05, pos: [18.8, -2.05, 41.6], mira: [-5.95, -7.2, 0] },
    { t: T06 + 0.45, pos: [11.0, 1.2, 24.0], mira: [-2.0, -1.2, 0.4], e: "power2.in" },
    { t: T06 + 1.6, pos: [3.2, 2.35, 9.6], mira: [1.7, 1.2, 1.2], e: "expo.out" },
    { t: T07 - 0.1, pos: [2.8, 2.25, 9.0], mira: [1.6, 1.15, 1.2], e: "sine.inOut" },
  ]);
  dir.claves("foco", [{ t: T06 + 1.6, v: [2.3, 0.95, 2.6] }]);
  dir.claves("rango", [{ t: T06 + 1.6, v: 2.4 }]);
  const c06 = capaToma(ctx, T06, T07 + 0.5);
  encabezado(ctx, c06, "01", "Deja tu cuenta lista", p("06", "Primero,"), T07 - 0.15);
  const nombres06 = ["Instrucciones", "Privacidad", "Capacidades", "Idioma"];
  const PULSO = 2.4036 / 4;
  const tFlip = [0, 1, 2, 3].map((i) => beat(p("06", "cuatro") + 0.3) + i * PULSO);
  const toggles = nombres06.map((n, i) => {
    const g = interruptor();
    g.position.set(0.75 + i * 1.08, 0.95, 2.6);
    g.rotation.y = -0.14;
    g.scale.setScalar(0.85);
    escena.add(g);
    const tEntra = p("06", "dejas") + i * 0.12;
    dir.visible(g, tEntra, T07 + 0.6);
    dir.cada(tEntra, T07 + 0.6, (T) => {
      const k = curva("back.out(1.8)")(tramo(T, tEntra, tEntra + 0.5));
      const sale = curva("power2.in")(tramo(T, T07 - 0.2, T07 + 0.4));
      g.scale.setScalar(Math.max(0.001, 0.85 * k * (1 - sale)));
      g.position.y = 0.95 + (1 - k) * -0.4 + sale * 1.5;
      g.userData.poner(curva("back.out(2.5)")(tramo(T, tFlip[i], tFlip[i] + 0.22)));
    });
    return g;
  });
  const etis06 = nombres06.map((n, i) => {
    const a = $("div", "ancla abajo", c06);
    const pl = $("span", "pildora chica", a, n);
    tl.fromTo(pl, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, ease: "expo.out" }, p("06", "dejas") + 0.2 + i * 0.12);
    return a;
  });
  salir(tl, c06.querySelectorAll(".ancla .pildora"), T07 - 0.2, { dy: -80 });
  ctx.dom(T06, T07 + 0.5, () => toggles.forEach((g, i) => ctx.colocar(etis06[i], ctx.proyectar(g.position.clone().add(new THREE.Vector3(0, -0.36, 0))))));
  // la libreta se escribe sola
  const libreta = card(c06, 96, 250, 640, 300, "libreta");
  const renglones = $("div", "renglones", libreta);
  const txt = $("div", "letra-libreta", libreta);
  deslizar(tl, libreta, p("06", "cuenta") - 0.1, { dx: -60 });
  escribir(tl, txt, "quién eres · a qué se dedica tu empresa · cómo quieres las respuestas", p("06", "cuatro") + 0.1, 2.6);
  salir(tl, libreta, T07 - 0.2, { dy: -120 });
  const tw = ["se", "escriben", "una", "vez", "y", "sirven", "siempre."].map((w) => p("06", w));
  const l06 = lineaOST(ctx, c06, "Se escribe una vez y sirve siempre.", tw, { left: "96px", top: "720px", fontSize: "80px" });
  salir(tl, l06.palabras, T07 - 0.2, { dy: -90 });

  // =================== 07 · Operaciones: pídele bien (PACTO) ===================
  const y1 = Y(1);
  dir.camara([
    { t: T07 + 0.1, pos: [2.5, 2.3, 8.4], mira: [1.1, 1.2, 0.9], e: "power2.in" },
    { t: T07 + 1.3, pos: [1.6, y1 + 1.95, 9.4], mira: [0.75, y1 + 0.75, 1.0], e: "expo.out" },
    { t: T08 - 0.1, pos: [1.3, y1 + 1.85, 8.9], mira: [0.7, y1 + 0.72, 1.0], e: "sine.inOut" },
  ]);
  dir.claves("foco", [{ t: T07 + 1.3, v: [1.9, y1 + 0.5, 1.6] }]);
  dir.claves("rango", [{ t: T07 + 1.3, v: 2.6 }]);
  const c07 = capaToma(ctx, T07, T08 + 0.5);
  encabezado(ctx, c07, "02", "Pídele bien", p("07", "pedirle"), T08 - 0.15);
  // la ventana de chat: el prompt vago y su respuesta gris
  const chat = card(c07, 96, 200, 700, 300, "chat");
  const bv = $("div", "barra-v", chat); $("i", "", bv); $("i", "", bv); $("i", "", bv);
  $("div", "chat-saludo", chat, "¿En qué te ayudo hoy?");
  const burbuja = $("div", "chat-burbuja", chat);
  const bt = $("span", "", burbuja);
  const mancha = $("div", "chat-mancha", chat);
  for (let k = 0; k < 4; k++) $("div", "esqueleto", mancha).style.width = [88, 72, 80, 46][k] + "%";
  const entrada = $("div", "chat-entrada", chat);
  $("span", "chat-placeholder", entrada, "Escribe a Claude…");
  $("span", "chat-enviar", entrada, "↑");
  deslizar(tl, chat, T07 + 0.35, { dx: -70 });
  escribir(tl, bt, "Hazme un reporte de inventario.", T07 + 0.75, 0.9);
  tl.fromTo(mancha, { opacity: 0, filter: "blur(14px)" }, { opacity: 1, filter: "blur(5px)", duration: 0.6, ease: "power2.out" }, T07 + 1.9);
  // letras PACTO que caen una por palabra; la O cae al final con su etiqueta lima
  const letras = await letrasPACTO();
  const palabrasPACTO = [["perfil,", "Perfil"], ["acción,", "Acción"], ["contexto,", "Contexto"], ["tono", "Tono y formato"], ["omisiones,", "Omisiones"]];
  const tLetra = palabrasPACTO.map(([w]) => p("07", w));
  letras.forEach((g, i) => {
    const x = 0.42 + i * 0.76, z = 1.6;
    escena.add(g);
    dir.visible(g, tLetra[i] - 0.4, T08 + 0.6);
    dir.cada(tLetra[i] - 0.4, T08 + 0.6, (T) => {
      const caida = tramo(T, tLetra[i] - 0.38, tLetra[i]);
      const rebote = curva("elastic.out(1, 0.45)")(tramo(T, tLetra[i], tLetra[i] + 0.7));
      const sale = curva("power2.in")(tramo(T, T08 - 0.25, T08 + 0.5));
      const yAire = (1 - curva("power2.in")(caida)) * 3.2;
      const aplasta = T >= tLetra[i] ? (1 - rebote) * 0.18 : 0;
      g.position.set(x, s.pisos[1].grupo.position.y + yAire + sale * 2.2, z);
      g.scale.set(0.9 * (1 + aplasta), 0.9 * Math.max(0.001, 1 - aplasta), 0.9 * (1 + aplasta));
      g.rotation.y = -0.18 + (1 - curva("expo.out")(caida)) * 0.6;
    });
  });
  dir.blur(tLetra[0] - 0.4, tLetra[4] + 0.1, 6);
  const etis07 = palabrasPACTO.map(([w, n], i) => {
    const a = $("div", "ancla abajo", c07);
    const pl = $("span", "pildora chica", a, n);
    pop(tl, pl, tLetra[i] + 0.05, { desde: 0.7, y: 10 });
    return a;
  });
  const tagO = $("div", "ancla", c07);
  const tagOp = $("span", "pildora lima-p", tagO, "La que se saltan");
  const tTag = p("07", "letra");
  pop(tl, tagOp, tTag);
  salir(tl, [...c07.querySelectorAll(".ancla .pildora")], T08 - 0.2, { dy: -80 });
  ctx.dom(T07, T08 + 0.5, () => {
    letras.forEach((g, i) => ctx.colocar(etis07[i], ctx.proyectar(new THREE.Vector3(g.position.x, s.pisos[1].grupo.position.y - 0.08, 1.95))));
    const q = ctx.proyectar(new THREE.Vector3(letras[4].position.x, letras[4].position.y + 1.3, 1.6));
    ctx.colocar(tagO, { x: Math.min(q.x, 1824 - 170), y: q.y });
  });
  // el PACTO completo se teclea y la respuesta gris se vuelve una tabla nítida
  const tPrompt = p("07", "saltan.") + 0.25;
  const pc = card(c07, 96, 200, 700, 300, "oscura prompt");
  $("div", "prompt-eyebrow", pc, "PACTO");
  const pct = $("div", "mono prompt-texto", pc);
  deslizar(tl, pc, tPrompt - 0.15, { dx: 0, dy: 30 });
  escribir(tl, pct, "Actúa como jefe de almacén de una distribuidora médica. Lista los lotes que vencen en 60 días con su valor al costo. Los medicamentos van aparte. Tabla ordenada por valor. No sugieras vender nada vencido.", tPrompt, 1.5);
  const tabla = card(c07, 96, 600, 700, 250, "tabla");
  const filas = [["Lote", "Vence en", "Valor al costo"], ["L-2041", "12 días", "$84,300"], ["L-1987", "27 días", "$61,950"], ["L-2113", "41 días", "$38,200"], ["L-2076", "58 días", "$22,740"]];
  filas.forEach((f, i) => { const r = $("div", "fila-t" + (i ? "" : " cab"), tabla); f.forEach((c) => $("span", "", r, c)); });
  const tSale = p("07", "sale.");
  tl.fromTo(tabla, { opacity: 0, filter: "blur(16px)", y: 20 }, { opacity: 1, filter: "blur(0px)", y: 0, duration: 0.7, ease: "expo.out" }, tSale - 0.35);
  tl.fromTo(tabla.querySelectorAll(".fila-t"), { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.35, stagger: 0.07, ease: "power3.out" }, tSale - 0.25);
  // IN → OUT: el tubo entre lo que entra y lo que sale
  const tubo = $("div", "tubo", c07);
  const gota = $("div", "tubo-gota", tubo);
  const inout = $("div", "inout", c07);
  const tIn = p("07", "entra");
  const sIN = $("span", "palabra", inout, "IN"); const sFl = $("span", "palabra fl", inout, " → "); const sOUT = $("span", "palabra", inout, "OUT");
  entrar(tl, sIN, tIn, { y: 40 }); entrar(tl, sFl, tIn + 0.2, { y: 40 }); entrar(tl, sOUT, tSale, { y: 40 });
  tl.fromTo(tubo, { opacity: 0, scaleY: 0 }, { opacity: 1, scaleY: 1, duration: 0.35, ease: "expo.out", transformOrigin: "50% 0%" }, tIn - 0.1);
  tl.fromTo(gota, { y: 0 }, { y: 40, duration: 0.6, ease: "power1.inOut", repeat: 3, yoyo: false }, tIn);
  salir(tl, [chat, pc, tabla, tubo, inout], T08 - 0.2, { dy: -140 });
  tl.set(chat, { autoAlpha: 0 }, tPrompt - 0.15);

  // =================== 08 · Finanzas: trabajo terminado ===================
  const y2 = Y(2);
  const pChispa = new THREE.Vector3(0.35, y2 + 1.25, 1.7);
  dir.camara([
    { t: T08 + 0.1, pos: [2.2, y1 + 1.5, 8.3], mira: [1.3, y1 + 0.6, 0.9], e: "power2.in" },
    { t: T08 + 1.3, pos: [0.6, y2 + 1.95, 9.6], mira: [0.35, y2 + 1.05, 0.9], e: "expo.out" },
    { t: T09 - 1.7, pos: [0.7, y2 + 1.85, 9.1], mira: [0.35, y2 + 1.05, 0.9], e: "sine.inOut" },
    // 08→09 (héroe): la cámara cruza la ventana de Claude y baja a Ventas
    { t: T09 - 0.25, pos: [0.4, y2 + 0.4, 3.2], mira: [0.35, y2 - 0.2, 0], e: "power3.in" },
  ]);
  dir.claves("foco", [{ t: T08 + 1.3, v: pChispa.toArray() }]);
  dir.claves("rango", [{ t: T08 + 1.3, v: 2.2 }]);
  const chispa08 = s.chispa.clone(true);
  chispa08.traverse((o) => { if (o.isMesh) o.material = o.material.clone(); });
  const luz08 = chispa08.children.find((o) => o.isPointLight);
  escena.add(chispa08);
  dir.visible(chispa08, T08 + 0.2, T09 - 0.5);
  const formatos = [["XLSX", "#" + C.azul.getHexString()], ["DOCX", "#" + C.cieloHondo.getHexString()], ["PDF", "#" + C.navy.getHexString()]];
  const files = formatos.map(([n, c]) => archivo(n, c));
  const factura = tarjeta(0.7, 0.92, (g, w, h) => { g.fillStyle = "#FFFFFF"; g.beginPath(); g.roundRect(0, 0, w, h, 24); g.fill(); g.fillStyle = "#" + C.hueso.getHexString(); for (let k = 0; k < 7; k++) { g.beginPath(); g.roundRect(40, 60 + k * 70, (w - 80) * (k % 3 ? 0.7 : 0.9), 22, 11); g.fill(); } g.fillStyle = "#" + C.navy.getHexString(); g.beginPath(); g.roundRect(w - 260, h - 110, 220, 50, 10); g.fill(); });
  files.push(factura);
  const tArch = p("08", "archivos");
  files.forEach((f, i) => {
    escena.add(f);
    const t0 = tArch - 0.55 + i * 0.3, t1 = t0 + 1.0;
    const desde = new THREE.Vector3(-2.7 + i * 0.2, y2 + 1.55 + (i % 2 ? 0.5 : -0.3), 2.8 - i * 0.2);
    dir.visible(f, t0 - 0.05, t1);
    dir.cada(t0 - 0.05, t1, (T) => {
      const u = curva("power2.inOut")(tramo(T, t0, t1));
      f.position.copy(desde).lerp(pChispa, u);
      f.rotation.set(0, 0.5 * (1 - u), (i % 2 ? 0.2 : -0.15) * (1 - u) + (i === 3 ? 0.12 : 0));
      f.scale.setScalar(Math.max(0.001, 1 - u * u));
    });
  });
  dir.blur(tArch - 0.6, tArch + 1.3, 8);
  const tExcel = p("08", "Excel"), tTablero = p("08", "tablero"), tDoc = p("08", "documento");
  dir.cada(T08 + 0.2, T09 - 0.5, (T) => {
    const absorbe = [0, 1, 2, 3].reduce((a, i) => a + Math.exp(-Math.pow((T - (tArch + 0.15 + i * 0.28)) / 0.08, 2)), 0);
    const sale = [tExcel, tTablero, tDoc].reduce((a, t) => a + Math.exp(-Math.pow((T - t) / 0.1, 2)), 0);
    const k = curva("expo.out")(tramo(T, T08 + 0.2, T08 + 0.9));
    const fin = curva("power2.in")(tramo(T, T09 - 1.4, T09 - 0.5));
    chispa08.position.copy(pChispa);
    chispa08.scale.setScalar(Math.max(0.001, (0.26 + absorbe * 0.06 + sale * 0.1) * k * (1 - fin)));
    chispa08.rotation.z = T * 0.9;
    luz08.intensity = 2.5 + (absorbe + sale) * 7;
  });
  const c08 = capaToma(ctx, T08, T09 + 0.2);
  encabezado(ctx, c08, "03", "Trabajo terminado", p("08", "trabajo"), p("08", "No") - 0.15);
  // Excel con fórmulas vivas: la meta cambia en Supuestos y el Resumen recalcula
  const xl = card(c08, 96, 240, 700, 400, "excel");
  const xt = $("div", "xl-tabs", xl); $("span", "on", xt, "Supuestos"); $("span", "", xt, "Resumen");
  const xb = $("div", "xl-cuerpo", xl);
  const sup = $("div", "xl-sup", xb);
  $("div", "xl-et", sup, "Meta de ventas");
  const meta = $("div", "xl-meta mono", sup, "1,200,000");
  const res = $("div", "xl-res", xb);
  const filasRes = [["Ventas proyectadas", 1200000, 1350000], ["Margen bruto", 372000, 418500], ["Utilidad", 168000, 189000]];
  const valores = filasRes.map(([n]) => { const r = $("div", "xl-fila", res); $("span", "", r, n); return $("span", "mono", r, ""); });
  const mx = (v) => Math.round(v).toLocaleString("en-US");
  pop(tl, xl, tExcel, { desde: 0.4, y: 40 });
  const tVivas = p("08", "vivas,");
  contar(tl, meta, tVivas - 0.25, 1200000, 1350000, 0.5, mx);
  tl.fromTo(meta, { backgroundColor: "rgba(198,242,78,0)" }, { backgroundColor: "rgba(0,160,219,0.18)", duration: 0.2, yoyo: true, repeat: 1 }, tVivas - 0.25);
  filasRes.forEach(([, a, b], i) => contar(tl, valores[i], tVivas + 0.05 + i * 0.08, a, b, 0.6, mx));
  // tablero de una pantalla: seis KPIs contra meta, semáforo y tendencia
  const kp = card(c08, 1160, 220, 664, 470, "kpis");
  $("div", "kpis-tit", kp, "Tablero de dirección");
  const rej = $("div", "kpis-rej", kp);
  const KPI = [["Ventas", 4.2, "$", " M", 0.84, "verde"], ["Margen", 31, "", " %", 0.78, "verde"], ["Cobranza", 87, "", " %", 0.62, "ambar"], ["Inventario", 42, "", " días", 0.48, "rojo"], ["Gastos", 1.1, "$", " M", 0.7, "verde"], ["Clientes nuevos", 128, "", "", 0.9, "verde"]];
  KPI.forEach(([n, v, pre, suf, pct, sem], i) => {
    const t = $("div", "kpi", rej);
    const h = $("div", "kpi-cab", t); $("span", "", h, n); $("i", "sem " + sem, h);
    const val = $("div", "kpi-val", t);
    const barraPista = $("div", "kpi-pista", t); const barra = $("div", "kpi-barra", barraPista);
    const svgns = "http://www.w3.org/2000/svg";
    const sv = document.createElementNS(svgns, "svg"); sv.setAttribute("viewBox", "0 0 100 24"); sv.setAttribute("class", "kpi-spark");
    const pl = document.createElementNS(svgns, "polyline");
    pl.setAttribute("points", Array.from({ length: 8 }, (_, k) => `${k * 14},${20 - ((Math.sin(k * 1.3 + i) + 1) * 6 + k * (sem === "rojo" ? -0.6 : 1.1))}`).join(" "));
    sv.appendChild(pl); t.appendChild(sv);
    const fmt = (x) => pre + (v % 1 ? x.toFixed(1) : Math.round(x)) + suf;
    contar(tl, val, tTablero + 0.2 + i * 0.06, 0, v, 0.8, fmt);
    llenar(tl, barra, tTablero + 0.2 + i * 0.06, pct, 0.8);
    tl.fromTo(pl, { strokeDashoffset: 200 }, { strokeDashoffset: 0, duration: 0.9, ease: "power2.out" }, tTablero + 0.3 + i * 0.06);
  });
  pop(tl, kp, tTablero, { desde: 0.4, y: 40 });
  // el documento con el formato de tu empresa
  const doc = card(c08, 820, 470, 330, 400, "doc");
  $("div", "doc-cab", doc);
  $("div", "doc-tit", doc, "Propuesta comercial");
  for (let k = 0; k < 7; k++) $("div", "esqueleto", doc).style.width = [92, 86, 90, 60, 88, 80, 50][k] + "%";
  pop(tl, doc, tDoc, { desde: 0.4, y: 40 });
  // NO UNA EXPLICACIÓN. EL ARCHIVO.
  const tNo = p("08", "No"), tEl = p("08", "El");
  tl.to([xl, kp, doc], { scale: 0.94, filter: "blur(3px)", opacity: 0.55, duration: 0.5, ease: "power2.out" }, tNo - 0.1);
  const l08a = lineaOST(ctx, c08, "No una explicación.", [tNo, p("08", "una"), p("08", "explicación.")], { left: "0", right: "0", top: "380px", textAlign: "center", fontSize: "120px" });
  const l08b = lineaOST(ctx, c08, "El archivo.", [tEl, p("08", "archivo.")], { left: "0", right: "0", top: "500px", textAlign: "center", fontSize: "150px" });
  l08b.palabras[1].classList.add("azul-h");
  salir(tl, [...l08a.palabras, ...l08b.palabras, xl, kp, doc], T09 - 1.85, { dy: -60 });
  // ventana de Claude que la cámara atraviesa (transición héroe 08→09)
  const vc = card(c08, 610, 250, 700, 450, "cruce");
  const vcb = $("div", "barra-v", vc); $("i", "", vcb); $("i", "", vcb); $("i", "", vcb);
  $("div", "chat-saludo grande", vc, "¿En qué te ayudo hoy?");
  const ve = $("div", "chat-entrada", vc); $("span", "chat-placeholder", ve, "Escribe a Claude…"); $("span", "chat-enviar", ve, "↑");
  tl.set(vc, { autoAlpha: 0 }, 0);
  tl.set(vc, { autoAlpha: 1 }, T09 - 1.75);
  pop(tl, vc, T09 - 1.75, { desde: 0.5, y: 30 });
  tl.to(vc, { scale: 9, filter: "blur(18px)", duration: 1.2, ease: "power3.in", transformOrigin: "50% 62%" }, T09 - 1.25);
  tl.set(vc, { autoAlpha: 0 }, T09);

  // =================== 09 · Ventas: conéctalo ===================
  const y3 = Y(3);
  const pCandado = new THREE.Vector3(2.35, y3 + 1.0, 1.8);
  dir.camara([
    { t: T09 - 0.249, pos: [1.6, y3 + 3.2, 4.0], mira: [1.0, y3 + 1.4, 0.9] },
    { t: T09 + 1.0, pos: [1.2, y3 + 1.95, 9.8], mira: [1.0, y3 + 1.1, 0.9], e: "expo.out" },
    { t: T10 - 0.1, pos: [1.45, y3 + 1.85, 9.2], mira: [1.05, y3 + 1.05, 0.9], e: "sine.inOut" },
  ]);
  dir.blur(T09 - 1.3, T09 + 0.3, 14);
  dir.claves("foco", [{ t: T09 - 0.25, v: [1.0, y3 + 1.2, 1.4] }, { t: T09 + 1.0, v: pCandado.toArray() }]);
  dir.claves("rango", [{ t: T09 + 1.0, v: 3.0 }]);
  const candado = new THREE.Group();
  const cuerpoC = caja(0.72, 0.6, 0.32, 0.1, C.azul);
  const arco = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.07, 18, 40, Math.PI), new THREE.MeshPhysicalMaterial({ color: C.hueso, roughness: 0.5 }));
  arco.position.y = 0.3; arco.castShadow = true;
  const ojo = caja(0.1, 0.18, 0.05, 0.03, C.navy); ojo.position.z = 0.17;
  candado.add(cuerpoC, arco, ojo);
  candado.position.copy(pCandado);
  escena.add(candado);
  dir.visible(candado, T09 - 0.3, T10 + 0.5);
  const iconos = [["Drive", ICONOS.carpeta, "Drive,"], ["Gmail", ICONOS.correo, "correo,"], ["Calendar", ICONOS.calendario, "calendario."], ["Microsoft 365", ICONOS.cuadricula, null]];
  const tLlave = iconos.map(([, , w], i) => (w ? p("09", w) : beat(p("09", "calendario.") + 0.75)));
  const sats = iconos.map(([n, ic], i) => {
    const g = satelite(ic);
    escena.add(g);
    dir.visible(g, T09 - 0.3, T10 + 0.5);
    return g;
  });
  const llaves = iconos.map(() => { const k = llave(); escena.add(k); return k; });
  const rayos = iconos.map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 8), new THREE.MeshBasicMaterial({ color: C.cieloClaro, toneMapped: false })); escena.add(m); return m; });
  const posSat = (i, T) => {
    const a = (i / 4) * Math.PI * 2 + T * 0.22 + 0.6;
    return new THREE.Vector3(pCandado.x + Math.cos(a) * 1.3, pCandado.y + 0.05 + Math.sin(a) * 0.68, pCandado.z + Math.sin(a + 1) * 0.3);
  };
  sats.forEach((g, i) => {
    dir.cada(T09 - 0.3, T10 + 0.5, (T) => {
      const k = curva("back.out(1.7)")(tramo(T, T09 + 0.3 + i * 0.12, T09 + 0.8 + i * 0.12));
      const sale = curva("power2.in")(tramo(T, T10 - 0.25, T10 + 0.5));
      g.position.copy(posSat(i, T));
      g.position.y += sale * 2.2;
      g.scale.setScalar(Math.max(0.001, 0.68 * k));
      g.userData.aro.material.emissiveIntensity = curva("expo.out")(tramo(T, tLlave[i] + 0.3, tLlave[i] + 0.6)) * 1.4;
      g.lookAt(g.position.clone().add(new THREE.Vector3(0, 0, 1)));
    });
    const k = llaves[i], rayo = rayos[i];
    dir.visible(k, tLlave[i] - 0.45, tLlave[i] + 0.55);
    dir.cada(tLlave[i] - 0.45, tLlave[i] + 0.55, (T) => {
      const u = curva("power3.out")(tramo(T, tLlave[i] - 0.45, tLlave[i] - 0.05));
      const gira = curva("back.out(2)")(tramo(T, tLlave[i] - 0.05, tLlave[i] + 0.2));
      const sale = curva("power2.in")(tramo(T, tLlave[i] + 0.3, tLlave[i] + 0.55));
      const desde = posSat(i, tLlave[i]);
      k.position.copy(desde).lerp(pCandado.clone().add(new THREE.Vector3(-0.62, 0, 0.25)), u);
      k.rotation.set(gira * Math.PI / 2, 0, 0);
      k.scale.setScalar(Math.max(0.001, 0.85 * (1 - sale)));
    });
    dir.visible(rayo, tLlave[i] + 0.25, T10 - 0.1);
    dir.cada(tLlave[i] + 0.25, T10 - 0.1, (T) => {
      const a = posSat(i, T), b = pCandado.clone();
      const u = curva("expo.out")(tramo(T, tLlave[i] + 0.25, tLlave[i] + 0.6));
      const fin = a.clone().lerp(b, u);
      rayo.position.copy(a).add(fin).multiplyScalar(0.5);
      rayo.scale.set(1, Math.max(0.001, a.distanceTo(fin)), 1);
      rayo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), fin.clone().sub(a).normalize());
    });
  });
  const c09 = capaToma(ctx, T09, T10 + 0.3);
  encabezado(ctx, c09, "04", "Conéctalo", p("09", "conectas"), T10 - 0.15);
  const etis09 = iconos.map(([n], i) => { const a = $("div", "ancla abajo", c09); const pl = $("span", "pildora chica", a, n); pop(tl, pl, T09 + 0.5 + i * 0.12, { desde: 0.7, y: 8 }); return a; });
  salir(tl, c09.querySelectorAll(".ancla .pildora"), T10 - 0.2, { dy: -80 });
  ctx.dom(T09, T10 + 0.3, (T) => sats.forEach((g, i) => ctx.colocar(etis09[i], ctx.proyectar(g.position.clone().add(new THREE.Vector3(0, -0.4, 0))))));
  const l09 = lineaOST(ctx, c09, "Conectar es entregar una llave", [0, 1, 2, 3, 4].map((i) => p("09", "donde") + i * 0.12), { left: "96px", top: "200px", fontSize: "76px", width: "760px", whiteSpace: "normal" });
  salir(tl, l09.palabras, p("09", "Con") - 0.6, { dy: -60 });
  // subir congela, conectar sigue vivo
  const tCong = p("09", "Con") - 0.45;
  const fa = card(c09, 96, 260, 360, 250, "vivo-c congelado");
  const fb = card(c09, 486, 260, 360, 250, "vivo-c");
  const filaVivo = (d, i0) => { $("div", "vc-nom mono", d, "ventas.xlsx"); const v = $("div", "vc-num mono", d, "$1,284,500"); for (let k = 0; k < 3; k++) $("div", "esqueleto", d).style.width = [80, 64, 72][k] + "%"; return v; };
  filaVivo(fa); const vivo = filaVivo(fb);
  $("i", "punto-vivo", fb);
  const escarcha = $("div", "escarcha", fa);
  deslizar(tl, fa, tCong - 0.3, { dx: -50 }); deslizar(tl, fb, tCong - 0.2, { dx: -50 });
  tl.fromTo(escarcha, { opacity: 0, scale: 1.25 }, { opacity: 1, scale: 1, duration: 0.7, ease: "power2.out" }, tCong);
  for (let k = 0; k < 6; k++) contar(tl, vivo, tCong + 0.1 + k * 0.4, 1284500 + k * 7300, 1284500 + (k + 1) * 7300, 0.3, (v) => "$" + Math.round(v).toLocaleString("en-US"));
  const l09b = lineaOST(ctx, c09, "Subir congela. Conectar sigue vivo.", [tCong, tCong + 0.15, tCong + 0.55, tCong + 0.7, tCong + 0.85], { left: "96px", top: "560px", fontSize: "66px" });
  const tBandeja = p("09", "bandeja,") - 0.5;
  salir(tl, [fa, fb, ...l09b.palabras], tBandeja - 0.1, { dx: -120, dy: 0 });
  // la bandeja: cinco respuestas a «Borradores»; el botón de enviar se queda gris
  const bj = card(c09, 96, 220, 820, 600, "bandeja");
  const bjc = $("div", "bj-cab", bj); $("span", "", bjc, "Bandeja"); const env = $("span", "bj-enviar", bjc, "Enviar");
  const lista = $("div", "bj-lista", bj);
  const correos = ["Cliente · Pedido 1042", "Proveedor · Factura de mayo", "Ventas · Cotización nueva", "Cliente · Cambio de fecha", "Dirección · Junta del lunes"];
  const filasBj = correos.map((c) => { const r = $("div", "bj-fila", lista); $("i", "", r); $("span", "", r, c); return r; });
  const bandejaB = $("div", "bj-borr", bj); const bc = $("div", "bj-borr-cab", bandejaB); $("span", "", bc, "Borradores"); const cuenta = $("span", "bj-cuenta", bc, "0");
  const pilaB = $("div", "bj-pila", bandejaB);
  deslizar(tl, bj, tBandeja, { dx: -60 });
  tl.fromTo(filasBj, { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.4, stagger: 0.06, ease: "power3.out" }, tBandeja + 0.15);
  const tBorr = p("09", "borradores…") - 0.35;
  correos.forEach((c, i) => {
    const b = $("div", "bj-borrador", pilaB);
    $("span", "", b, "Re: " + c.split(" · ")[1]);
    pop(tl, b, tBorr + i * 0.17, { desde: 0.5, y: -30 });
    tl.call(() => (cuenta.textContent = String(i)), null, tBorr + i * 0.17 - 0.001);
    tl.call(() => (cuenta.textContent = String(i + 1)), null, tBorr + i * 0.17 + 0.05);
  });
  const nadie = $("div", "ancla", c09);
  Object.assign(nadie.style, { left: "700px", top: "760px" });
  const nadieP = $("span", "pildora lima-p grande", nadie, "Nadie envía nada");
  pop(tl, nadieP, p("09", "nadie"));
  salir(tl, [bj, nadieP], T10 - 0.2, { dy: -120 });

  // =================== 10 · RH: tu forma de trabajar ===================
  const y4 = Y(4);
  dir.camara([
    { t: T10 + 0.1, pos: [1.45, y3 + 1.45, 9.0], mira: [1.0, y3 + 0.9, 0.9], e: "power2.in" },
    { t: T10 + 1.3, pos: [1.7, y4 + 1.95, 9.6], mira: [1.1, y4 + 0.85, 1.4], e: "expo.out" },
    { t: T11 - 0.1, pos: [1.4, y4 + 1.85, 9.1], mira: [1.05, y4 + 0.8, 1.4], e: "sine.inOut" },
  ]);
  dir.claves("foco", [{ t: T10 + 1.3, v: [1.0, y4 + 0.95, 2.9] }, { t: p("10", "prompt.") + 0.2, v: [1.0, y4 + 0.95, 2.9] }, { t: p("10", "prompt.") + 0.6, v: [1.3, y4 - 0.2, 2.25], e: "power2.inOut" }]);
  dir.claves("rango", [{ t: T10 + 1.3, v: 2.3 }]);
  const c10 = capaToma(ctx, T10, T11 + 0.3);
  encabezado(ctx, c10, "05", "Tu forma de trabajar", p("10", "forma"), T11 - 0.15);
  const objs = [carpeta3d(), enchufe(), receta()];
  const nombres10 = ["Proyecto", "Conector", "Habilidad"];
  const tObj = [p("10", "proyecto"), (p("10", "contexto;") + p("10", "habilidad")) / 2, p("10", "habilidad")];
  objs.forEach((o, i) => {
    escena.add(o);
    const base = new THREE.Vector3(1.0 + (i - 1) * 1.35, y4 + 0.95, 2.9);
    const t0 = p("10", "enseñas") + 0.2 + i * 0.15;
    dir.visible(o, t0, T11 + 0.5);
    dir.cada(t0, T11 + 0.5, (T) => {
      const k = curva("back.out(1.6)")(tramo(T, t0, t0 + 0.55));
      const realce = Math.exp(-Math.pow((T - tObj[i] - 0.2) / 0.3, 2));
      const sale = curva("power2.in")(tramo(T, T11 - 0.25, T11 + 0.5));
      o.position.copy(base); o.position.y += Math.sin(T * 1.1 + i) * 0.05 + (1 - k) * -0.5 + sale * 2.2;
      o.rotation.y = -0.25 + Math.sin(T * 0.6 + i) * 0.08 + realce * 0.5;
      o.scale.setScalar(Math.max(0.001, k * (1 + realce * 0.18)));
    });
  });
  const etis10 = nombres10.map((n, i) => { const a = $("div", "ancla abajo", c10); const pl = $("span", "pildora", a, n); pop(tl, pl, tObj[i] - 0.05, { desde: 0.7, y: 10 }); return a; });
  ctx.dom(T10, T11 + 0.3, () => objs.forEach((o, i) => ctx.colocar(etis10[i], ctx.proyectar(o.position.clone().add(new THREE.Vector3(0, -0.85, 0))))));
  salir(tl, c10.querySelectorAll(".ancla .pildora"), p("10", "Lo") - 0.2, { dy: -60 });
  // el prompt que sale bien tres veces se dobla en habilidad y entra al edificio como cartucho
  const pr = card(c10, 96, 250, 700, 210, "oscura prompt");
  const prt = $("div", "mono prompt-texto", pr, "Haz la cotización para el cliente con nuestras condiciones de siempre.");
  const tTres = p("10", "tres");
  deslizar(tl, pr, p("10", "Lo") - 0.1, { dx: -50 });
  const ticks = $("div", "ticks", c10);
  const tTick = [0, 1, 2].map((i) => beat(tTres - 0.4) + i * PULSO);
  tTick.forEach((t, i) => { const c = $("span", "tick", ticks, "✓"); pop(tl, c, t, { desde: 0.3, y: 0 }); });
  const l10 = $("div", "tres-skill", c10);
  const lw = ["3", "✓", "→", "SKILL"].map((w) => { const m = $("span", "mascara", l10); const x = $("span", "palabra", m, w); l10.appendChild(document.createTextNode(" ")); return x; });
  entrar(tl, lw, tTres, { escalon: 0.09 });
  const tDobla = p("10", "deja") - 0.05;
  const skill = card(c10, 96, 250, 700, 210, "skill");
  $("div", "skill-cab", skill, "Habilidad");
  $("div", "skill-txt", skill, "Cotizaciones · vigencia 15 días · IVA incluido · descuento máx. 8%");
  tl.to(pr, { scaleY: 0.05, opacity: 0, duration: 0.3, ease: "power3.in", transformOrigin: "50% 100%" }, tDobla);
  tl.fromTo(skill, { scaleY: 0.05, opacity: 0, transformOrigin: "50% 0%" }, { scaleY: 1, opacity: 1, duration: 0.4, ease: "back.out(1.8)" }, tDobla + 0.25);
  const tSlot = p("10", "prompt.") + 0.35;
  tl.to(skill, { x: 640, y: 470, scale: 0.25, opacity: 0, filter: "blur(6px)", duration: 0.5, ease: "power3.in" }, tSlot - 0.5);
  salir(tl, [...lw, ticks], tSlot - 0.5, { dy: -60 });
  const cart = cartucho();
  escena.add(cart);
  const ranura = new THREE.Vector3(1.3, y4 - 0.21, 2.16);
  dir.visible(cart, tSlot - 0.1, 999);
  dir.cada(tSlot - 0.1, 999, (T) => {
    const u = curva("power3.out")(tramo(T, tSlot - 0.1, tSlot + 0.45));
    cart.position.set(ranura.x, s.pisos[4].grupo.position.y - 0.21, ranura.z + (1 - u) * 1.4);
    cart.rotation.set(-Math.PI / 2 * u, 0, 0);
    cart.scale.setScalar(0.85);
    cart.userData.contactos.material.emissiveIntensity = curva("expo.out")(tramo(T, tSlot + 0.4, tSlot + 0.9)) * 1.6;
  });
  ctx.tiempos = Object.assign(ctx.tiempos || {}, { tFlip, tLetra, tTag, tExcel, tTablero, tDoc, tVivas, tLlave, tCong, tBorr, tNadie: p("09", "nadie"), tTick, tDobla, tSlot });
}
