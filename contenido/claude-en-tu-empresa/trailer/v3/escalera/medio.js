// Propuesta 3 · «La escalera infinita» — el medio: de «Mientras tanto» a «Te falta un método» (≈31–53 s).
//  08 Reportes a mano ............ la hoja que voló a cámara es una hoja de cálculo gigante; el equipo llena
//                                   cada celda a saltos.
//  09 Las mismas talachas, diario . sol, luna, sol, luna: los días pasan volando, la hoja se borra y se vuelve
//                                   a llenar igual. DÍA 1 · 2 · 3 … 247.
//  10 Cada decisión → tu escritorio cada celda suelta una canica-decisión; ruedan por un tobogán que cruza la
//                                   empresa y caen, plop, plop, en tu escritorio. Tu cursor queda enterrado.
//  11 ¿Cuánto depende de ti? ...... se apaga la luz. Un reflector. La empresa entera cuelga de hilos… de tu cursor.
//  12 No te falta otra herramienta  cae otra caja; el cursor la avienta a la pila de cajas olvidadas.
//  13 Te falta un MÉTODO .......... tarjeta de golpe; vuelve la luz, los hilos se cortan, la chispa de Claude y
//                                   una red lima que conecta al equipo entre sí.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { COLOR, ISO, pista, tramo, clamp01, mezcla, azar, brillo, arcilla, texturaTexto, rrect } from "./mundo.js";
import * as O from "./objetos.js";
import { linea, golpe, etiqueta } from "./texto.js";

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const sale3 = (u) => 1 - Math.pow(1 - u, 3);
const suave = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const caer = (u) => u * u;
const aterriza = (t, t0, f = 0.28, d = 0.38) => { const u = tramo(t, t0, t0 + d); if (u <= 0 || u >= 1) return 1; return 1 - f * Math.exp(-5 * u) * Math.cos(9 * u); };
const caja = (w, h, d, r = 0.06) => new RoundedBoxGeometry(w, h, d, 3, r);
const SVG = "http://www.w3.org/2000/svg";

export const DESDE = (T) => T.w(5, "Mientras") + 0.15;

export function montar(ctx) {
  const { m, T, tl, raiz, ap } = ctx;
  const esc0 = m.escena;
  const w = (i, p, n = 1) => T.w(i, p, n), wf = (i, p, n = 1) => T.wFin(i, p, n);
  const t = {
    mientras: w(5, "Mientras"), equipo: w(5, "equipo"), sigue: w(5, "sigue"), reportes: w(5, "reportes"), mano: w(5, "mano,"), manoF: wf(5, "mano,"),
    haciendo2: w(5, "haciendo", 2), mismas: w(5, "mismas"), talachas: w(5, "talachas"), repetitivas: w(5, "repetitivas"), diariamente: w(5, "diariamente"), diariamenteF: wf(5, "diariamente"),
    y: w(5, "y"), asi: w(5, "así"), cada: w(5, "cada"), decision: w(5, "decisión…"), decisionF: wf(5, "decisión…"), termina: w(5, "termina"), otra: w(5, "otra"), vez: w(5, "vez"), escritorio: w(5, "escritorio."), escritorioF: wf(5, "escritorio."),
    entonces: w(6, "Entonces,"), se: w(6, "sé"), honesto: w(6, "honesto:"), cuanto: w(6, "¿cuánto"), empresa: w(6, "empresa"), todavia: w(6, "todavía"), depende: w(6, "depende"), de2: w(6, "de", 2), ti: w(6, "ti?"), tiF: wf(6, "ti?"),
    porque: w(7, "Porque"), falta: w(7, "falta"), otra2: w(7, "otra"), herramienta: w(7, "herramienta."), herramientaF: wf(7, "herramienta."),
    te: w(8, "Te"), falta2: w(8, "falta"), un: w(8, "un"), metodo: w(8, "método."), metodoF: wf(8, "método."),
  };
  const desde = DESDE(T), hasta = T.w(9, "Por") - 0.25;
  ctx.tiemposMedio = t;

  // ================= la hoja de cálculo =================
  const RD = V3(Math.cos(ISO.az), 0, -Math.sin(ISO.az)), DN = V3(Math.sin(ISO.az), 0, Math.cos(ISO.az));
  const SH = V3(60, 0, 0);
  const COLS = 8, FILAS = 6, CW = 1.3, CH = 1.05;
  const celda = (c, f) => SH.clone().addScaledVector(RD, (c - (COLS - 1) / 2) * CW).addScaledVector(DN, (f - (FILAS - 1) / 2) * CH);
  const lienzo = document.createElement("canvas"); lienzo.width = 1664; lienzo.height = 1100;
  const g2 = lienzo.getContext("2d");
  const txHoja = new THREE.CanvasTexture(lienzo); txHoja.colorSpace = THREE.SRGBColorSpace; txHoja.anisotropy = 8;
  const hojaW = COLS * CW + 0.9, hojaH = FILAS * CH + 0.75;
  const hoja = new THREE.Mesh(new THREE.BoxGeometry(hojaW, 0.08, hojaH), [arcilla("#E7EEF4"), arcilla("#E7EEF4"), new THREE.MeshPhysicalMaterial({ map: txHoja, roughness: 0.7 }), arcilla("#E7EEF4"), arcilla("#E7EEF4"), arcilla("#E7EEF4")]);
  hoja.receiveShadow = true;
  // la hoja: columnas a lo ancho de la pantalla (vista desde arriba)
  hoja.position.copy(SH).add(V3(0, -0.04, 0)).addScaledVector(RD, -0.2).addScaledVector(DN, -0.2);
  hoja.rotation.y = ISO.az;
  esc0.add(hoja);
  const rN = azar(404);
  const numeros = Array.from({ length: COLS * FILAS }, () => { const v = Math.floor(80 + rN() * 9800); return v >= 1000 ? `${Math.floor(v / 1000)},${String(v % 1000).padStart(3, "0")}` : String(v); });
  // quién llena qué: A la fila 1, B la 3, C la 5; los días
  const dias = [
    { t0: t.equipo - 0.1, paso: 0.34 },                                                   // día 1, con calma
    ...[0, 1, 2].map((k) => ({ t0: t.haciendo2 + k * 1.1, paso: 0.12 })),               // días 2–4, a prisa
    { t0: t.haciendo2 + 3.3, paso: 0.3 },                                                // y sigue
  ];
  const filasEq = [1, 3, 5];
  const diaEn = (tt) => { let d = 0; for (let k = 0; k < dias.length; k++) if (tt >= dias[k].t0) d = k; return d; };
  function pintarHoja(tt) {
    const d = diaEn(tt), dia = dias[d];
    const Wc = 1664, Hc = 1100, mx = 70, my = 72, cw = (Wc - mx) / COLS, ch = (Hc - my) / FILAS;
    g2.fillStyle = "#FFFFFF"; g2.fillRect(0, 0, Wc, Hc);
    g2.fillStyle = "#EEF4F8"; g2.fillRect(0, 0, Wc, my); g2.fillRect(0, 0, mx, Hc);
    g2.strokeStyle = "#CFDDE8"; g2.lineWidth = 3;
    for (let c = 0; c <= COLS; c++) { g2.beginPath(); g2.moveTo(mx + c * cw, 0); g2.lineTo(mx + c * cw, Hc); g2.stroke(); }
    for (let f = 0; f <= FILAS; f++) { g2.beginPath(); g2.moveTo(0, my + f * ch); g2.lineTo(Wc, my + f * ch); g2.stroke(); }
    g2.fillStyle = "#6F8596"; g2.font = '700 34px "Inter"'; g2.textAlign = "center"; g2.textBaseline = "middle";
    for (let c = 0; c < COLS; c++) g2.fillText(String.fromCharCode(65 + c), mx + (c + 0.5) * cw, my / 2 + 2);
    for (let f = 0; f < FILAS; f++) g2.fillText(String(f + 1), mx / 2, my + (f + 0.5) * ch);
    // las celdas llenas hoy (las demás filas traen lo de ayer: el trabajo de siempre)
    g2.font = '600 46px "Inter"';
    for (let f = 0; f < FILAS; f++) for (let c = 0; c < COLS; c++) {
      const k = filasEq.indexOf(f);
      let lleno = false, nuevo = 0;
      if (k >= 0) { const tc = dia.t0 + (c + 0.6) * dia.paso + k * 0.04; lleno = tt >= tc; nuevo = clamp01(1 - (tt - tc) / 0.35); }
      else lleno = d > 0 || tt > dias[0].t0 + 0.5;
      if (!lleno) continue;
      const x = mx + (c + 0.5) * cw, y = my + (f + 0.5) * ch;
      if (nuevo > 0) { g2.fillStyle = `rgba(198,242,78,${(0.55 * nuevo).toFixed(3)})`; g2.fillRect(mx + c * cw + 3, my + f * ch + 3, cw - 6, ch - 6); }
      g2.fillStyle = k >= 0 ? "#0A1A2F" : "#7D93A3";
      g2.fillText(numeros[(f * COLS + c + d * 7) % numeros.length], x, y + 2);
    }
    txHoja.needsUpdate = true;
  }

  // ================= sol y luna =================
  const sol = new THREE.Mesh(new THREE.SphereGeometry(0.75, 32, 20), new THREE.MeshPhysicalMaterial({ color: new THREE.Color("#FFD27A"), emissive: new THREE.Color("#FFB84D"), emissiveIntensity: 0.8, roughness: 0.3, clearcoat: 1 }));
  const luna = new THREE.Mesh(new THREE.SphereGeometry(0.62, 32, 20), new THREE.MeshPhysicalMaterial({ color: new THREE.Color("#EAF4FA"), emissive: new THREE.Color("#BFE6F7"), emissiveIntensity: 0.5, roughness: 0.4, clearcoat: 1 }));
  esc0.add(sol, luna);
  const contador = etiqueta(ctx.ui, "DÍA 1", { tam: 30, color: COLOR.navy });
  // fase del día: 0 día pleno … 1 noche (en el tramo de los días)
  const ciclo = (tt) => { const u = (tt - t.haciendo2) / 1.1; if (u < 0 || u > 3) return { k: -1, f: 0 }; const k = Math.floor(u); return { k, f: u - k }; };

  // ================= canicas, tobogán, escritorio =================
  const FY = -7.2;   // el piso de la oficina (abajo de la hoja)
  const E0 = SH.clone().addScaledVector(RD, COLS * CW / 2 + 0.6).addScaledVector(DN, 0.4);
  const ruta = [E0, E0.clone().addScaledVector(DN, 3.0).add(V3(0, -1.6, 0))];
  ruta.push(ruta[1].clone().addScaledVector(RD, -3.4).add(V3(0, -1.7, 0)));
  ruta.push(ruta[2].clone().addScaledVector(DN, 2.6).add(V3(0, -1.6, 0)));
  const DK = ruta[3].clone().addScaledVector(RD, -1.5).addScaledVector(DN, 0.6);
  DK.y = FY;
  const deskAlto = 1.25;
  ruta.push(V3(DK.x, FY + deskAlto + 0.2, DK.z).addScaledVector(RD, 0.4));
  const largos = []; let total = 0;
  for (let i = 1; i < ruta.length; i++) { const l = ruta[i].distanceTo(ruta[i - 1]); largos.push(l); total += l; }
  const enRuta = (s) => { let r = s; for (let i = 1; i < ruta.length; i++) { if (r <= largos[i - 1]) return ruta[i - 1].clone().lerp(ruta[i], r / largos[i - 1]); r -= largos[i - 1]; } return ruta.at(-1).clone(); };
  // rieles del tobogán
  const matRiel = brillo(COLOR.cieloClaro, { rugosidad: 0.25 });
  const rieles = new THREE.Group(); esc0.add(rieles);
  for (let i = 1; i < ruta.length - 1; i++) {
    const a = ruta[i - 1], b = ruta[i], l = a.distanceTo(b);
    const g = new THREE.Mesh(caja(0.5, 0.12, l + 0.3, 0.05), matRiel);
    g.position.copy(a).lerp(b, 0.5).add(V3(0, -0.24, 0));
    g.lookAt(b.clone().add(V3(0, -0.24, 0)));
    g.castShadow = true; g.receiveShadow = true;
    rieles.add(g);
    for (const lado of [-1, 1]) { const p = new THREE.Mesh(caja(0.06, 0.22, l + 0.3, 0.03), brillo(COLOR.azul, { rugosidad: 0.25 })); p.position.set(lado * 0.25, 0.1, 0); g.add(p); }
  }
  // escritorio
  const escritorio = new THREE.Group(); esc0.add(escritorio);
  const cubierta = new THREE.Mesh(caja(3.4, 0.2, 2.0, 0.08), brillo(COLOR.blanco, { rugosidad: 0.35 }));
  cubierta.position.y = deskAlto; cubierta.castShadow = cubierta.receiveShadow = true;
  escritorio.add(cubierta);
  for (const [x, z] of [[-1.5, -0.8], [1.5, -0.8], [-1.5, 0.8], [1.5, 0.8]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, deskAlto, 12), brillo(COLOR.navy)); p.position.set(x, deskAlto / 2, z); p.castShadow = true; escritorio.add(p); }
  const placa = O.sticker("TÚ", { fondo: COLOR.navy, tinta: "#FFFFFF", ancho: 0.9, chispa: false });
  placa.position.set(0, deskAlto - 0.02, 1.02); escritorio.add(placa);
  escritorio.position.copy(DK); escritorio.rotation.y = ISO.az;
  const pisoO = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ color: new THREE.Color(COLOR.cieloHondo), opacity: 0.25 }));
  pisoO.rotation.x = -Math.PI / 2; pisoO.position.y = FY; pisoO.receiveShadow = true; esc0.add(pisoO);
  // canicas: una por celda que se vuelve decisión
  const NC = 14;
  const matCan = [COLOR.durazno, COLOR.lima, COLOR.cieloClaro, COLOR.azul].map((c) => brillo(c, { rugosidad: 0.12 }));
  const canicas = [];
  const rC = azar(88);
  for (let k = 0; k < NC; k++) {
    const g = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), matCan[k % 4]); g.castShadow = true; esc0.add(g);
    const q = O.letra("?", { tam: 0.32, color: COLOR.navy, fuente: '900 190px "Inter"' }); esc0.add(q);
    const c = Math.floor(rC() * COLS), f = filasEq[k % 3];
    // pila en el escritorio
    const ang = k * 2.4, rad = 0.18 + 0.12 * Math.sqrt(k);
    const pila = V3(DK.x, FY + deskAlto + 0.3 + Math.floor(k / 6) * 0.3, DK.z).addScaledVector(RD, Math.cos(ang) * rad).addScaledVector(DN, Math.sin(ang) * rad * 0.7);
    canicas.push({ g, q, c, f, t0: t.decision - 0.15 + k * 0.07, pila });
  }
  const tRueda = t.termina - 0.35;   // arrancan a rodar por el tobogán

  // ================= la marioneta =================
  const spot = new THREE.SpotLight(0xffffff, 0, 40, 0.55, 0.65, 1.2);
  spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048);
  esc0.add(spot, spot.target);
  const PB = DK.clone().addScaledVector(RD, -3.6).addScaledVector(DN, -1.4); PB.y = FY;
  const cuelga = [V3(-1.9, 0, 1.2), V3(-0.6, 0, 1.9), V3(0.9, 0, 1.7), V3(2.2, 0, 1.0)].map((d) => PB.clone().addScaledVector(RD, d.x).addScaledVector(DN, d.z));
  const pilaCajas = [V3(-3.2, 0, -0.4), V3(-3.9, 0, 0.3), V3(-3.5, 0.62, -0.05), V3(-2.7, 0, 0.5)].map((d) => PB.clone().addScaledVector(RD, d.x).addScaledVector(DN, d.z).add(V3(0, d.y, 0)));
  const nueva = O.cajaHerramienta({ color: COLOR.durazno, etiqueta: "NUEVA", fondoEtiqueta: COLOR.blanco, lado: 0.62, chispa: false });
  esc0.add(nueva.g);
  const tSube = t.cuanto - 0.15;         // los hilos los levantan
  const tCorta = t.metodo + 0.5;         // al salir de la tarjeta: los hilos ya no están
  // hilos y red (SVG)
  const hilos = cuelga.map(() => { const p = document.createElementNS(SVG, "path"); p.setAttribute("fill", "none"); p.setAttribute("stroke", "#EAF4FA"); p.setAttribute("stroke-width", "2.6"); p.setAttribute("stroke-linecap", "round"); ctx.lineas.appendChild(p); return p; });
  const hiloE = document.createElementNS(SVG, "path"); hiloE.setAttribute("fill", "none"); hiloE.setAttribute("stroke", "#EAF4FA"); hiloE.setAttribute("stroke-width", "3"); ctx.lineas.appendChild(hiloE);
  const red = [];
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) { const p = document.createElementNS(SVG, "line"); p.setAttribute("stroke", COLOR.lima); p.setAttribute("stroke-width", "6"); p.setAttribute("stroke-linecap", "round"); ctx.lineas.appendChild(p); red.push({ p, a, b }); }
  // la chispa de Claude (logo oficial, sin alterar su forma), sobre la empresa al volver la luz
  const chispa = document.createElement("div");
  Object.assign(chispa.style, { position: "absolute", left: "0", top: "0", width: "150px", height: "150px", marginLeft: "-75px", marginTop: "-75px", color: COLOR.durazno, opacity: "0", filter: "drop-shadow(0 0 30px rgba(255,180,137,.7))" });
  chispa.innerHTML = ctx.CHISPA_SVG ? ctx.CHISPA_SVG : "";
  ctx.ui.appendChild(chispa);
  const pinEsc = etiqueta(ctx.ui, "tu escritorio", { tam: 24 });

  // ================= textos =================
  const L = (partes, anclas, fin, op = {}) => { const l = linea(tl, raiz, { partes, anclas, ...op, ...(ctx.V ? ctx.textoV(op) : {}) }); ctx.textos.push({ l, fin }); return l; };
  const G = (q, op) => golpe(tl, q, { ...op, W: ctx.W, H: ctx.H, tam: ctx.V ? op.tam * 0.52 : op.tam });
  const pal = (i, desdeK = 0, n = 99) => T.porFrase[i].slice(desdeK, desdeK + n).map((p) => p.start);
  L([["Mientras tanto, tu equipo sigue haciendo"], ["reportes a mano,", "durazno"]], pal(5, 0, 9), t.haciendo2 - 0.15, { tam: 56 });
  L([["haciendo las mismas"], ["talachas repetitivas", "lima"], ["diariamente…", "acento"]], pal(5, 9, 6), t.y - 0.18, { tam: 56 });
  L([["y aun así cada"], ["decisión…", "acento"]], pal(5, 15, 5), t.termina - 0.12, { tam: 60 });
  L([["termina otra vez en"], ["tu escritorio.", "lima"]], pal(5, 20, 6), t.entonces - 0.1, { tam: 60, dir: [0, 1] });
  L([["Entonces,", "blanco"], ["sé honesto:", "acentoBlanco"]], pal(6, 0, 3), t.cuanto - 0.15, { tam: 64 });
  L([["¿cuánto de tu empresa todavía", "blanco"], ["depende", "acentoBlanco"]], pal(6, 3, 6), t.de2 - 0.06, { tam: 62 });
  G(ctx.golpes, { t: t.de2, dur: 0.6, texto: "¿DE TI?", fondo: COLOR.lima, color: COLOR.navy, tam: 360 });
  L([["Porque no te falta", "blanco"], ["otra herramienta.", "durazno"]], pal(7), t.te - 0.12, { tam: 62 });
  L([["Te falta un", "blanco"]], pal(8, 0, 3), t.metodo - 0.04, { tam: 66 });
  G(ctx.golpes, { t: t.metodo, dur: 0.56, texto: "MÉTODO.", fondo: COLOR.lima, color: COLOR.navy, tam: 360 });

  // ================= fondo por tramo =================
  const dia = { base: "#FBF7F2", a: "#FFE0C9", b: "#CDEBF7", c: "#DFE7EE" };
  const noche = { base: "#0C2137", a: "#123A66", b: "#0A1A2F", c: "#06111F", reticula: 0.12 };
  ctx.paleta.push({ t: desde, ...dia });
  for (let k = 0; k < 3; k++) { ctx.paleta.push({ t: t.haciendo2 + k * 1.1 + 0.55, ...noche, a: "#1B3F6B", cruce: 0.35 }); ctx.paleta.push({ t: t.haciendo2 + k * 1.1 + 1.1, ...dia, cruce: 0.35 }); }
  ctx.paleta.push({ t: t.entonces + 0.15, ...noche, a: "#13406A", cruce: 0.45 });
  ctx.paleta.push({ t: t.metodo + 0.56, base: "#F3FAE6", a: "#DDF6A8", b: "#BFE9F8", c: "#D8E8EF", cruce: 0.05 });
  ctx.marquesinas.push(
    { t0: desde, t1: t.haciendo2, texto: "A MANO · A MANO ·", color: COLOR.cieloHondo, op: 0.08, y: 600, tam: 280, vel: 70 },
    { t0: t.haciendo2, t1: t.y, texto: "DIARIAMENTE · DIARIAMENTE ·", color: COLOR.cieloHondo, op: 0.07, y: 600, tam: 240, vel: 220 },
    { t0: t.entonces + 0.2, t1: t.metodo, texto: "¿DE TI? · ¿DE TI? ·", color: "#EAF4FA", op: 0.05, y: 600, tam: 260, vel: 50 },
  );
  ctx.particulas = ((prev) => (tt) => (tt >= desde && tt < hasta ? (tt > t.entonces && tt < t.metodo + 0.5 ? 0.35 : 1) : prev ? prev(tt) : 1))(ctx.particulas);

  // ================= cursor =================
  const P = (v3) => m.proyectar(v3);
  const topCentro = () => ({ x: ctx.W / 2, y: ctx.V ? 360 : 175 });
  const cajaEn = () => P(V3(PB.x + 2.5, FY + 2.2, PB.z - 0.5));
  ctx.cursorClaves.push(
    { t: t.escritorio - 0.5, p: () => { const q = P(V3(DK.x, FY + deskAlto + 0.3, DK.z)); return { x: q.x + 160, y: q.y - 260 }; }, oculto: true },
    { t: t.escritorio - 0.1, p: () => { const q = P(V3(DK.x, FY + deskAlto + 0.3, DK.z)); return { x: q.x + 30, y: q.y - 10 }; }, viaje: 0.4 },
    { t: t.entonces + 0.4, p: () => { const q = P(V3(DK.x, FY + deskAlto + 0.3, DK.z)); return { x: q.x + 30, y: q.y - 10 }; } },
    { t: tSube + 0.25, p: topCentro, viaje: 0.55 },
    { t: t.porque + 0.4, p: topCentro },
    { t: t.otra2 + 0.25, p: () => { const q = cajaEn(); return { x: q.x + 160, y: q.y - 40 }; }, viaje: 0.3 },
    { t: t.otra2 + 0.4, p: () => { const q = cajaEn(); return { x: q.x - 40, y: q.y + 10 }; }, viaje: 0.15, clic: true },
    { t: t.metodo - 0.1, p: topCentro, viaje: 0.5 },
    { t: tCorta - 0.05, p: () => ({ x: ctx.W / 2, y: -200 }), viaje: 0.12 },
    { t: tCorta, p: () => ({ x: ctx.W / 2, y: -200 }), oculto: true },
  );

  // ================= cámara =================
  const vista = (p, el, alto, y = 0) => [p.x - (el < 1.3 ? p.y : 0), y, p.z - (el < 1.3 ? p.y : 0), ISO.az, el, alto];
  const cam = pista([
    { t: desde, v: [SH.x, 0, SH.z, ISO.az, 1.5, 1.4] },
    { t: t.equipo + 0.3, v: [SH.x, 0, SH.z, ISO.az, 1.5, 9.5], e: "power3.inOut" },
    { t: t.manoF, v: [SH.x, 0.6, SH.z, ISO.az, 0.95, 10.6], e: "power2.inOut" },
    { t: t.diariamenteF, v: [SH.x + 0.4, 0.6, SH.z + 0.4, ISO.az, 0.8, 10.2], e: "power1.inOut" },
    { t: t.decisionF, v: [SH.x + 1.2, 0.2, SH.z + 0.6, ISO.az, 0.7, 10.8], e: "power1.inOut" },
    { t: t.escritorio + 0.15, v: [DK.x - FY * 0, FY + 1.5, DK.z, ISO.az, ISO.el, 7.2], e: "power3.inOut" },
    { t: t.entonces + 0.3, v: [DK.x, FY + 1.5, DK.z, ISO.az, ISO.el, 6.4], e: "power1.inOut" },
    { t: tSube + 0.9, v: [PB.x + 1.4, FY + 3.6, PB.z + 0.6, ISO.az, ISO.el, 12.5], e: "power3.inOut" },
    { t: t.herramientaF, v: [PB.x + 1.2, FY + 3.4, PB.z + 0.5, ISO.az, ISO.el, 12.2], e: "power1.inOut" },
    { t: tCorta + 0.6, v: [PB.x + 1.0, FY + 2.6, PB.z + 0.4, ISO.az, ISO.el, 10.4], e: "power3.out" },
    { t: hasta, v: [PB.x + 1.0, FY + 2.5, PB.z + 0.4, ISO.az, ISO.el, 10.0], e: "power1.inOut" },
  ]);
  const sacudidas = [{ t: tCorta - 0.02, dur: 0.4, amp: 0.12 }, { t: t.otra2 + 0.4, dur: 0.3, amp: 0.08 }];

  // ================= por cuadro =================
  const [A, B, Cc, D] = ap.equipo;
  function pintar(tt) {
    let v = cam(tt);
    let dx = 0, dy = 0;
    for (const z of sacudidas) { const u = (tt - z.t) / z.dur; if (u < 0 || u > 1) continue; const a = z.amp * Math.pow(1 - u, 2); dx += a * Math.sin(tt * 97.3); dy += a * Math.cos(tt * 83.7); }
    m.ponerCamara({ x: v[0] + dx * RD.x, y: v[1] + dy, z: v[2] + dx * RD.z, az: v[3], el: v[4], alto: v[5] });
    // luz: día · ciclo de días · noche del reflector · vuelve la luz
    const cy = ciclo(tt);
    let luz = 1;
    if (cy.k >= 0) luz = 0.45 + 0.55 * (0.5 + 0.5 * Math.cos(cy.f * Math.PI * 2));
    const noche = tramo(tt, t.entonces, t.entonces + 0.35) * (1 - (tt >= tCorta - 0.05 ? 1 : 0));
    luz = luz * (1 - noche * 0.82);
    m.luz(luz);
    spot.intensity = noche * 260;
    spot.position.set(DK.x - 1.5, FY + 11, DK.z - 0.6); spot.target.position.set(PB.x * 0.4 + DK.x * 0.6, FY, PB.z * 0.4 + DK.z * 0.6);
    if (tt > tSube) spot.target.position.set(PB.x + 0.8, FY, PB.z + 0.4);

    // la hoja y el equipo que la llena a saltos
    const enHoja = tt < t.escritorio + 0.4;
    hoja.visible = enHoja;
    if (enHoja) pintarHoja(tt);
    const d = diaEn(tt), di = dias[d];
    [A, B, Cc].forEach((p, k) => {
      if (!enHoja || tt > tSube) return;
      const f = filasEq[k];
      const u = (tt - di.t0) / di.paso - k * 0.04 / di.paso;
      const c0 = Math.max(-1, Math.min(COLS - 1, Math.floor(u)));
      const uu = clamp01(u - Math.floor(u));
      const a = celda(Math.max(0, c0), f), b = celda(Math.min(COLS - 1, c0 + 1), f);
      const pos = c0 < 0 ? celda(0, f) : a.clone().lerp(b, Math.min(1, uu * 1.4));
      const salto = c0 < COLS - 1 && c0 >= 0 ? Math.sin(Math.PI * Math.min(1, uu * 1.4)) * 0.45 : 0;
      const sq = uu > 0.6 && uu < 0.85 ? 1 - 0.2 * Math.sin(((uu - 0.6) / 0.25) * Math.PI) : 1;
      p.poner({ x: pos.x, y: pos.y + salto, z: pos.z, rumbo: Math.atan2(RD.x, RD.z), sy: sq, sx: 1 / Math.sqrt(sq), escala: 1, visible: true, parpado: cy.k >= 0 && cy.f > 0.4 && cy.f < 0.7 ? 0.6 : 0, mirar: [0.3, -0.5], sudor: tt > t.diariamente ? 1 : 0, ladea: 0, inclina: 0 });
    });
    // sol y luna en arco sobre la hoja
    sol.visible = luna.visible = cy.k >= 0;
    if (cy.k >= 0) {
      const arco = (u) => SH.clone().addScaledVector(RD, Math.cos(Math.PI * (1 - u)) * 6.8).add(V3(0, 1.2 + Math.sin(Math.PI * u) * 3.6, 0)).addScaledVector(DN, -4.2);
      sol.position.copy(arco(clamp01(cy.f * 2)));
      luna.position.copy(arco(clamp01(cy.f * 2 - 1)));
      sol.visible = cy.f < 0.5; luna.visible = cy.f >= 0.5;
    }
    // contador de días
    const nDia = tt < t.haciendo2 ? 1 : tt < t.haciendo2 + 3.3 ? 2 + Math.floor((tt - t.haciendo2) / 1.1) : Math.round(4 + (247 - 4) * sale3(tramo(tt, t.haciendo2 + 3.3, t.diariamenteF + 0.2)));
    contador.textContent = `DÍA ${nDia}`;
    const uCt = tramo(tt, t.equipo, t.equipo + 0.3) * (1 - tramo(tt, t.decision, t.decision + 0.3));
    contador.style.opacity = String(uCt);
    const dDia = tt - t.haciendo2 - 1.1 * Math.floor(Math.max(0, tt - t.haciendo2) / 1.1);
    contador.style.transform = `translate(${ctx.V ? 800 : 1590}px, ${ctx.V ? 470 : 170}px) scale(${(tt >= t.haciendo2 && tt < t.haciendo2 + 3.3 ? 1 + 0.18 * Math.exp(-dDia / 0.12) : 1).toFixed(3)})`;

    // canicas: saltan de la celda, ruedan al tobogán, caen en la pila del escritorio
    rieles.visible = tt > t.decision - 0.3 && tt < t.entonces + 0.6;
    canicas.forEach((k, i) => {
      const u0 = tramo(tt, k.t0, k.t0 + 0.3);
      const vis = u0 > 0 && tt < tSube + 0.3;
      k.g.visible = k.q.visible = vis;
      if (!vis) return;
      let p;
      const salida = celda(k.c, k.f).add(V3(0, 0.2, 0));
      const tR = tRueda + i * 0.09;
      if (tt < tR) {
        // saltan y van rodando hacia la orilla de la hoja
        const ub = tramo(tt, k.t0 + 0.3, tR);
        p = salida.clone().lerp(E0, suave(ub));
        p.y += Math.sin(Math.PI * u0) * 0.9 * (1 - ub) + Math.abs(Math.sin(ub * 9)) * 0.1;
      } else {
        const s = Math.min(total, 2.4 * (tt - tR) + 5.5 * (tt - tR) * (tt - tR));
        if (s < total) p = enRuta(s);
        else {
          const tL = tR + (-2.4 + Math.sqrt(2.4 * 2.4 + 4 * 5.5 * total)) / (2 * 5.5);
          const ul = tramo(tt, tL, tL + 0.32);
          p = ruta.at(-1).clone().lerp(k.pila, suave(ul));
          p.y += Math.sin(Math.PI * ul) * 0.5;
        }
      }
      k.g.position.copy(p);
      k.g.rotation.set(tt * 6 + i, tt * 4, 0);
      k.q.position.copy(p).add(V3(0, 0.36, 0));
      k.q.material.opacity = 1;
    });
    escritorio.visible = pisoO.visible = tt > t.termina - 0.6;
    pisoO.material.opacity = 0.25 * (1 - noche * 0.4);
    const qd = P(V3(DK.x, FY + deskAlto, DK.z));
    const uPin = tramo(tt, t.escritorio, t.escritorio + 0.3) * (1 - tramo(tt, t.entonces, t.entonces + 0.25));
    pinEsc.style.opacity = String(uPin);
    pinEsc.style.transform = `translate(${(qd.x - 110).toFixed(1)}px, ${(qd.y + 70).toFixed(1)}px)`;

    // la marioneta: la empresa y el equipo cuelgan de hilos… de tu cursor
    const enM = tt > tSube - 0.4;
    const cur = ctx.cursorPos ? ctx.cursorPos(tt) : { x: 960, y: 175 };
    const sube = suave(tramo(tt, tSube, tSube + 0.8));
    const baja = sale3(tramo(tt, tCorta - 0.05, tCorta + 0.35));
    const altura = (k) => (2.2 + 0.35 * k) * sube * (1 - baja);
    const vaiven = (k) => 0.14 * Math.sin(tt * 1.6 + k * 1.3) * (1 - baja);
    if (enM) {
      ap.empresa.poner({ x: PB.x, y: FY + altura(1) * 0.8 + 0.05 * Math.sin(tt * 1.2), z: PB.z, rumbo: ISO.az, visible: true, escala: 1, sx: 1, sy: aterriza(tt, tCorta + 0.3, 0.2, 0.4), luces: 0.6 });
      [A, B, Cc, D].forEach((p, k) => {
        const c = cuelga[k];
        const y = FY + altura(k) + 0.08 * Math.sin(tt * 2 + k);
        const al = tt > tCorta + 0.3;
        p.poner({ x: c.x, y, z: c.z, rumbo: ISO.az + (k - 1.5) * 0.25, visible: true, escala: 1, ladea: vaiven(k), inclina: 0.1 * Math.sin(tt * 1.3 + k) * (1 - baja), parpado: al ? 0.55 : 0, mirar: al ? [0, 0.3] : [0, 0.9], sudor: tt > t.depende && !al ? 1 : 0, sy: al ? aterriza(tt, tCorta + 0.35 + k * 0.04, 0.25, 0.35) : 1.04, sx: 1 });
      });
    }
    // hilos: del cursor a cada cabeza (con comba); se cortan en la tarjeta
    const verHilos = enM && tt < tCorta - 0.05 && sube > 0.01;
    [A, B, Cc, D].forEach((p, k) => {
      if (!verHilos) { hilos[k].setAttribute("d", ""); return; }
      const e = p.estado; const q = P(V3(e.x, e.y + p.alto * e.sy, e.z));
      const mx = (q.x + cur.x) / 2, my = (q.y + cur.y) / 2 + 40;
      hilos[k].setAttribute("d", `M${(cur.x + 4).toFixed(1)},${(cur.y + 4).toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${q.x.toFixed(1)},${q.y.toFixed(1)}`);
      hilos[k].setAttribute("opacity", String(Math.min(1, sube * 2)));
    });
    if (verHilos) { const q = P(V3(PB.x, FY + altura(1) * 0.8 + 2.6, PB.z)); hiloE.setAttribute("d", `M${(cur.x + 4).toFixed(1)},${(cur.y + 4).toFixed(1)} L${q.x.toFixed(1)},${q.y.toFixed(1)}`); } else hiloE.setAttribute("d", "");
    // la caja NUEVA cae; el cursor la avienta a la pila de cajas olvidadas
    {
      const tc = t.falta - 0.1, tg = t.otra2 + 0.4;
      const u = tramo(tt, tc, tg);
      const golpeU = tramo(tt, tg, tg + 0.55);
      let p = V3(PB.x + 2.5, FY + 9 - 6.8 * caer(u), PB.z - 0.5);
      if (tt > tg) { const dst = pilaCajas[1].clone().add(V3(0, 1.22, 0)); p = p.clone().lerp(dst, suave(golpeU)); p.y += Math.sin(Math.PI * golpeU) * 2.2; }
      nueva.poner({ x: p.x, y: p.y, z: p.z, rumbo: ISO.az + tt * (tt > tg ? 7 : 0.5) * (1 - golpeU), escala: u > 0 && tt < hasta ? 1 : 0, sy: aterriza(tt, tg + 0.55, 0.25, 0.3) });
      // la pila: las cajas del bucle, olvidadas
      [...ap.cajas, ap.otra].forEach((c, k) => {
        const q = pilaCajas[k];
        const ver = tt > t.porque - 0.3;
        c.poner({ x: q.x, y: q.y + (1 - sale3(tramo(tt, t.porque - 0.3 + k * 0.06, t.porque + k * 0.06))) * 5, z: q.z, rumbo: ISO.az + k * 0.7, giroX: 0, giroZ: k === 2 ? 0.3 : 0, escala: ver ? (k === 3 ? 0.55 : 1) : 0, abre: 0.4, sy: 1, sx: 1 });
      });
    }
    // red lima entre el equipo y la chispa de Claude
    const uRed = tramo(tt, tCorta + 0.3, tCorta + 0.9);
    red.forEach((r, i) => {
      if (uRed <= 0 || tt >= hasta) { r.p.setAttribute("opacity", "0"); return; }
      const pa = [A, B, Cc, D][r.a].estado, pb = [A, B, Cc, D][r.b].estado;
      const qa = P(V3(pa.x, pa.y + 0.6, pa.z)), qb = P(V3(pb.x, pb.y + 0.6, pb.z));
      const u = clamp01(uRed * 1.6 - i * 0.1);
      r.p.setAttribute("x1", qa.x.toFixed(1)); r.p.setAttribute("y1", qa.y.toFixed(1));
      r.p.setAttribute("x2", (qa.x + (qb.x - qa.x) * u).toFixed(1)); r.p.setAttribute("y2", (qa.y + (qb.y - qa.y) * u).toFixed(1));
      r.p.setAttribute("opacity", u > 0 ? "0.9" : "0");
    });
    const qc = P(V3(PB.x, FY + 4.6, PB.z));
    const uCh = tramo(tt, tCorta + 0.05, tCorta + 0.45);
    chispa.style.opacity = tt < hasta ? String(uCh) : "0";
    chispa.style.transform = `translate(${qc.x.toFixed(1)}px, ${(qc.y + 6 * Math.sin(tt * 2.2)).toFixed(1)}px) rotate(${(tt * 50).toFixed(1)}deg) scale(${(0.4 + 0.6 * sale3(uCh)).toFixed(3)})`;
  }
  // lo que vive fuera de este acto (SVG, DOM, luz) se apaga desde aquí
  function siempre(tt) {
    if (tt >= desde && tt < hasta) return;
    hilos.forEach((h) => h.setAttribute("d", "")); hiloE.setAttribute("d", "");
    red.forEach((r) => r.p.setAttribute("opacity", "0"));
    spot.intensity = 0;
    chispa.style.opacity = "0"; contador.style.opacity = "0"; pinEsc.style.opacity = "0";
  }
  return { pintar, siempre, t, DK, PB, FY, SH, escritorio, canicas, ruta, cuelga, red, chispa, rieles, pisoO, deskAlto };
}
