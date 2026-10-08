// v2 · 3D · cierres (49–87 s). Detrás de la máscara de MÉTODO ya es de día: el edificio de siete pisos
// sobre nubes (lo que más gustó de la v1). Plática: la pantalla en vivo → el edificio → tres pisos, lo
// que te contamos → todo entra a la ventana de Claude → el escritorio tranquilo con los pisos encendidos.
// Curso: el título junto a la ventana → Excel/Word/correo en tres pisos → los tres «sin» → igual.
// Común: respaldo, el eco de los titulares alrededor de un edificio que ya no se mueve, «nosotros», la
// chispa cruza la lente y la tarjeta final con el degradado héroe y la flecha lima.
import * as THREE from "three";
import { $, titular, entrar, salir, ventana, pop, CHISPA_SVG } from "../../estilo/ui.js";
import { titulares, tarjeta } from "../../mundo/utileria.js";
import { curva, tramo, azar, C as COL } from "../../estilo/mundo.js";
import { PASO } from "../../mundo/escena.js";
import { frase } from "./texto.js";

const hex = (k) => "#" + COL[k].getHexString();

// tarjetas de ícono dibujadas en canvas (blancas, trazo navy/azul): sin texto
function icono(tipo) {
  return tarjeta(1.2, 0.9, (g, w, h) => {
    g.beginPath(); g.roundRect(0, 0, w, h, 60); g.fillStyle = "#FFFFFF"; g.fill();
    g.lineCap = "round"; g.lineJoin = "round";
    const cx = w / 2, cy = h / 2;
    if (tipo === "noticias") { for (let k = 0; k < 3; k++) { g.fillStyle = k ? hex("hueso") : hex("azul"); g.beginPath(); g.roundRect(cx - 300 + k * 40, cy - 190 + k * 120, 560, 90, 30); g.fill(); } }
    if (tipo === "seis") { for (let k = 0; k < 15; k++) { g.beginPath(); g.arc(cx - 240 + (k % 5) * 120, cy - 120 + Math.floor(k / 5) * 120, 36, 0, 7); g.fillStyle = [1, 7, 13].includes(k) ? hex("azul") : hex("hueso"); g.fill(); } }
    if (tipo === "salir") { g.strokeStyle = hex("azul"); g.lineWidth = 40; g.beginPath(); g.arc(cx - 40, cy, 180, 0.5, Math.PI * 2 - 0.3); g.stroke(); g.strokeStyle = hex("cieloHondo"); g.beginPath(); g.moveTo(cx + 120, cy + 90); g.lineTo(cx + 330, cy - 40); g.moveTo(cx + 240, cy - 70); g.lineTo(cx + 330, cy - 40); g.lineTo(cx + 320, cy + 50); g.stroke(); }
    if (tipo === "excel") { g.strokeStyle = hex("azul"); g.lineWidth = 12; for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(cx - 320, cy - 200 + k * 100); g.lineTo(cx + 320, cy - 200 + k * 100); g.stroke(); } for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(cx - 320 + k * 160, cy - 200); g.lineTo(cx - 320 + k * 160, cy + 200); g.stroke(); } }
    if (tipo === "word") { g.fillStyle = hex("azul"); [560, 640, 480, 600, 360].forEach((lw, k) => { g.beginPath(); g.roundRect(cx - 320, cy - 200 + k * 90, lw, 36, 18); g.fill(); }); }
    if (tipo === "correo") { g.strokeStyle = hex("azul"); g.lineWidth = 30; g.beginPath(); g.roundRect(cx - 320, cy - 210, 640, 420, 40); g.stroke(); g.beginPath(); g.moveTo(cx - 300, cy - 180); g.lineTo(cx, cy + 40); g.lineTo(cx + 300, cy - 180); g.stroke(); }
    if (tipo === "instalar") { g.strokeStyle = hex("cieloHondo"); g.lineWidth = 30; g.beginPath(); g.roundRect(cx - 260, cy - 190, 520, 380, 40); g.stroke(); g.beginPath(); g.moveTo(cx, cy - 120); g.lineTo(cx, cy + 90); g.moveTo(cx - 90, cy + 10); g.lineTo(cx, cy + 100); g.lineTo(cx + 90, cy + 10); g.stroke(); }
    if (tipo === "codigo") { g.strokeStyle = hex("cieloHondo"); g.lineWidth = 34; g.beginPath(); g.moveTo(cx - 140, cy - 150); g.lineTo(cx - 300, cy); g.lineTo(cx - 140, cy + 150); g.moveTo(cx + 140, cy - 150); g.lineTo(cx + 300, cy); g.lineTo(cx + 140, cy + 150); g.moveTo(cx + 60, cy - 200); g.lineTo(cx - 60, cy + 200); g.stroke(); }
    if (tipo === "contratar") { g.strokeStyle = hex("cieloHondo"); g.lineWidth = 30; g.beginPath(); g.arc(cx - 80, cy - 90, 90, 0, 7); g.stroke(); g.beginPath(); g.arc(cx - 80, cy + 230, 180, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); g.beginPath(); g.moveTo(cx + 200, cy - 60); g.lineTo(cx + 200, cy + 100); g.moveTo(cx + 120, cy + 20); g.lineTo(cx + 280, cy + 20); g.stroke(); }
    if (["instalar", "codigo", "contratar"].includes(tipo)) { g.strokeStyle = hex("navy"); g.lineWidth = 36; g.beginPath(); g.moveTo(cx - 330, cy + 230); g.lineTo(cx + 330, cy - 230); g.stroke(); }
    if (tipo === "vivo") {
      g.fillStyle = hex("hueso");
      for (let i = 0; i < 6; i++) { const x = 60 + (i % 3) * ((w - 120) / 3), y = 160 + Math.floor(i / 3) * ((h - 220) / 2); g.beginPath(); g.roundRect(x + 10, y + 10, (w - 120) / 3 - 20, (h - 220) / 2 - 20, 30); g.fill(); g.fillStyle = hex("cieloHondo"); g.beginPath(); g.arc(x + (w - 120) / 6, y + 110, 46, 0, 7); g.fill(); g.beginPath(); g.ellipse(x + (w - 120) / 6, y + 250, 96, 70, 0, Math.PI, 0); g.fill(); g.fillStyle = hex("hueso"); }
      g.fillStyle = hex("azul"); g.beginPath(); g.roundRect(60, 50, 300, 76, 38); g.fill(); g.fillStyle = "#FFFFFF"; g.beginPath(); g.arc(104, 88, 14, 0, 7); g.fill();
      g.font = "600 40px Inter"; g.textBaseline = "middle"; g.fillText("EN VIVO", 134, 90);
    }
  }, { px: 600, r: 0.12 });
}

export function montar(ctx) {
  const { s, dir, tl, raiz, C, T, V, F, mundo, W, H } = ctx;
  const q = (h, v) => (V ? v : h);
  const esc = ctx.escena;
  const platica = T.version === "platica";
  const tV = ctx.T_VENTANA;
  const P = (k) => -k * PASO;   // altura de la losa del piso k
  // el mundo de día existe desde que se abre la máscara
  for (const p of s.pisos) dir.visible(p.grupo, tV, 999);
  for (const n of s.nubes) dir.visible(n, tV, 999);
  dir.claves("fov", [{ t: tV - 0.001, v: F(30) }, { t: tV, v: F(30) }]);
  dir.camara([{ t: tV - 0.001, pos: q([-0.9, 3.6, 6.4], [-0.2, 4.0, 6.6]), mira: [0, 2.0, 0.3] }]);
  const placa = { placa: true };
  const w = (i, p, n) => T.w(i, p, n);

  // ---------- el brillo de los filos de piso: UNA rutina para todo el cierre (ERRORES E12) ----------
  const encendidos = s.pisos.map(() => []);   // [{ t, fuerza, dur }]
  // dur: el piso se apaga al terminar su tiempo (si no, desde abajo el filo encendido del piso de
  // arriba se volvía un plano lima enorme). Sin dur: se queda encendido (cascadas finales).
  const enciende = (k, t, fuerza = 1, dur = 0) => encendidos[k].push({ t, fuerza, dur });
  dir.cada(tV, 999, (t) => {
    s.pisos.forEach((p, k) => {
      let v = 0;
      for (const e of encendidos[k]) v = Math.max(v, e.fuerza * curva("power2.out")(tramo(t, e.t, e.t + 0.4)) * (e.dur ? 1 - tramo(t, e.t + e.dur, e.t + e.dur + 0.5) : 1));
      p.filo.material.emissiveIntensity = 0.05 + v * 0.95;   // de cerca, 1.4 volvía el filo un plano lima
    });
  });

  // ---------- la ventana de Claude y el trabajo que entra a ella ----------
  const vC = s.ventana;
  const trabajo = [];
  const unLugar = (t0, tCabeza, tMetodo, tFin) => {
    dir.visible(vC, t0 - 0.2, tFin);
    dir.cada(t0 - 0.2, tFin, (t) => {
      const k = curva("back.out(1.6)")(tramo(t, t0 - 0.2, t0 + 0.3)), late = Math.exp(-Math.pow((t - tMetodo - 0.08) / 0.1, 2)) * 0.08;
      vC.scale.setScalar(Math.max(0.001, k * (1 + late)));
    });
    const r = azar(123);
    for (let n = 0; n < 8; n++) {
      const m = tarjeta(0.62, 0.42, (g, ww, hh) => { g.beginPath(); g.roundRect(0, 0, ww, hh, 30); g.fillStyle = "#FFFFFF"; g.fill(); g.fillStyle = n % 2 ? hex("azul") : hex("cieloClaro"); g.fillRect(20, 20, ww - 40, 34); g.fillStyle = hex("hueso"); for (let l = 0; l < 3; l++) g.fillRect(20, 80 + l * 40, (ww - 40) * [0.9, 0.6, 0.75][l], 18); }, { px: 300 });
      esc.add(m);
      const a = (n / 8) * Math.PI * 2, desde = new THREE.Vector3(Math.cos(a) * 4.2, 2.2 + Math.sin(a) * 2.6, 1.2 + r() * 0.6);
      const ts = t0 + n * 0.09;
      dir.visible(m, ts - 0.05, ts + 0.75);
      dir.cada(ts - 0.05, ts + 0.75, (t) => {
        const u = curva("power3.inOut")(tramo(t, ts, ts + 0.7));
        m.position.lerpVectors(desde, vC.position, u);
        m.rotation.set(0, 0, (1 - u) * Math.sin(a) * 0.5);
        m.scale.setScalar(Math.max(0.001, 1 - u * 0.85));
      });
      trabajo.push(m);
    }
    dir.blur(t0, t0 + 1.4, 8);
    // la chispa aterriza en el encabezado de la ventana
    dir.visible(s.chispa, t0 + 0.2, tFin);
    const cab = new THREE.Vector3(1.05, 2.98, 0.45);
    dir.cada(t0 + 0.2, tFin, (t) => {
      const u = curva("power2.inOut")(tramo(t, t0 + 0.2, tCabeza));
      s.chispa.position.copy(new THREE.Vector3(-2.6, 4.2, 2.0)).lerp(cab, u);
      s.chispa.position.y += Math.sin(u * Math.PI) * 0.5;
      const late = Math.exp(-Math.pow((t - tCabeza - 0.1) / 0.14, 2));
      s.chispa.scale.setScalar(0.16 + u * 0.06 + late * 0.12);
      s.chispa.rotation.z = t * 2;
      s.chispa.userData.luz.intensity = 6 + late * 18;
      s.chispa.userData.malla.material.emissiveIntensity = 1.5 + late * 3;
    });
    dir.camara(V ? [
      { t: t0 - 0.2, pos: [0.4, 3.4, 7.8], mira: [0.1, 2.2, 0.2], e: "expo.inOut" },
      { t: tFin, pos: [0.25, 3.2, 6.9], mira: [0.1, 2.2, 0.2], e: "sine.inOut" },
    ] : [
      { t: t0 - 0.2, pos: [1.6, 2.9, 7.2], mira: [-0.9, 2.2, 0.2], e: "expo.inOut" },
      { t: tFin, pos: [1.35, 2.8, 6.4], mira: [-0.9, 2.2, 0.2], e: "sine.inOut" },
    ]);
    dir.claves("foco", [{ t: t0 - 0.35, v: [0.1, 2.25, 0.2] }]);
    dir.claves("rango", [{ t: t0 - 0.35, v: 3 }]);
  };

  // ---------- el escritorio tranquilo: el teléfono boca abajo, todos los pisos encendidos ----------
  const tranquilo = (t0, tResuelva, tFin) => {
    dir.visible(s.telefono, t0, 999);
    dir.camara(V ? [
      { t: t0, pos: [2.6, 9.4, 13.2], mira: [0.1, -2.6, 0.3], e: "expo.inOut" },
      { t: tFin, pos: [2.3, 9.0, 12.4], mira: [0.1, -2.6, 0.3], e: "sine.inOut" },
    ] : [
      { t: t0, pos: [4.2, 7.4, 12.6], mira: [0.15, -0.9, 0.3], e: "expo.inOut" },
      { t: tFin, pos: [3.7, 7.0, 11.6], mira: [0.15, -0.8, 0.3], e: "sine.inOut" },
    ]);
    dir.claves("fov", [{ t: t0 - 0.4, v: F(30) }, { t: t0 + 0.4, v: F(40), e: "expo.inOut" }, { t: tFin, v: F(40) }, { t: tFin + 0.5, v: F(30), e: "power2.inOut" }]);
    dir.claves("foco", [{ t: t0, v: [0.2, 1.0, 0.3] }]);
    dir.claves("rango", [{ t: t0, v: 9 }]);
    s.pisos.forEach((_, k) => enciende(k, tResuelva + k * 0.12));
    dir.blur(t0 - 0.3, t0 + 0.5, 12);
  };

  let tEdificio;   // cuándo se ve el edificio entero (respaldo)
  if (platica) {
    // ---------------- 09 · la plática gratuita y en vivo ----------------
    const pant = icono("vivo");
    pant.scale.setScalar(0.001);
    pant.position.set(0.1, 2.3, 0.3);
    esc.add(pant);
    pant.scale.set(2.3, 2.3, 1);
    const tPant1 = C.contamos - 0.4;
    dir.visible(pant, tV, tPant1);
    const vivoP = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 10), new THREE.MeshBasicMaterial({ color: COL.cieloClaro, toneMapped: false }));
    esc.add(vivoP);
    dir.visible(vivoP, C.vivo - 0.05, tPant1);
    dir.cada(tV, tPant1, (t) => {
      const sale = curva("power2.in")(tramo(t, tPant1 - 0.4, tPant1));
      pant.scale.set(2.3 * (1 - sale) + 0.001, 2.3 * (1 - sale) + 0.001, 1);
      vivoP.position.set(0.1 - 1.38 + 0.25, 2.3 + 1.03 - 0.12, 0.33);
      vivoP.scale.setScalar(1 + 0.6 * Math.max(0, Math.sin((t - C.vivo) * 7)));
    });
    const tAtras = C.duenos - 0.1;
    dir.camara(V ? [
      { t: tV, pos: [0.25, 2.6, 6.6], mira: [0.1, 2.0, 0.3] },
      { t: tAtras, pos: [0.25, 2.5, 6.0], mira: [0.1, 2.05, 0.3], e: "sine.inOut" },
      { t: C.contamos - 0.3, pos: [7.5, -2.5, 24.0], mira: [0, -5.6, 0], e: "expo.inOut" },
    ] : [
      { t: tV, pos: [0.9, 2.6, 6.2], mira: [-0.6, 2.2, 0.3] },
      { t: tAtras, pos: [0.8, 2.55, 5.7], mira: [-0.6, 2.2, 0.3], e: "sine.inOut" },
      { t: C.contamos - 0.3, pos: [19.2, -2.2, 42.5], mira: [-6.0, -7.3, 0], e: "expo.inOut" },
    ]);
    dir.claves("foco", [{ t: tV, v: [0.1, 2.3, 0.3] }, { t: C.contamos - 0.3, v: [0, -6.6, 0.4], e: "expo.inOut" }]);
    dir.claves("rango", [{ t: tV, v: 2.6 }, { t: C.contamos - 0.3, v: 16, e: "expo.inOut" }]);
    dir.blur(tAtras, C.contamos - 0.3, 12);
    s.pisos.forEach((_, k) => enciende(k, C.duenos + 0.15 + k * 0.08, 0.55, 1.4));   // dueños y directivos: toda la empresa
    frase(ctx, q(["Plática gratuita", "y en vivo"], ["Plática", "gratuita", "y en vivo"]), [C.platica, w(9, "gratuita"), w(9, "y"), w(9, "en"), C.vivo], C.contamos - 0.25, placa);

    // ---------------- 10 · lo que te contamos: tres pisos ----------------
    const tipos = ["noticias", "seis", "salir"];
    const lineas = [q(["Qué está pasando", "con la IA"], ["Qué está", "pasando", "con la IA"]), q(["Qué hacen las que", "sí la aprovechan"], ["Qué hacen", "las que sí", "la aprovechan"]), ["Cómo salir", "del bucle"]];
    const anclas = [
      [C.b[0], w(10, "está"), w(10, "pasando"), w(10, "con", 1), w(10, "la", 1), w(10, "IA,")],
      [C.b[1], w(10, "hacen"), w(10, "las"), w(10, "que", 3), w(10, "sí"), w(10, "la", 2), w(10, "aprovechan,")],
      [C.b[2], w(10, "salir"), w(10, "del"), w(10, "bucle:")],
    ];
    const keys = [];
    C.b.forEach((tb, k) => {
      const piso = k + 1, y = P(piso);
      const ic = icono(tipos[k]);
      ic.position.set(q(2.2, 0), y + 1.5, 2.3);
      esc.add(ic);
      const fin = k < 2 ? C.b[k + 1] - 0.15 : C.todo - 0.55;
      dir.visible(ic, tb - 0.1, fin + 0.4);
      dir.cada(tb - 0.1, fin + 0.4, (t) => {
        const kk = curva("back.out(1.8)")(tramo(t, tb, tb + 0.5)), sale = curva("power2.in")(tramo(t, fin, fin + 0.4));
        ic.scale.setScalar(Math.max(0.001, kk * (1 - sale)));
        ic.rotation.y = 0.25 * Math.sin(t * 0.8);
      });
      enciende(piso, tb, 1.2, fin - tb);
      keys.push(V
        ? { t: tb - 0.05, pos: [0.5, y + 1.35, 7.8], mira: [0, y + 1.75, 0.8], e: "expo.inOut" }
        : { t: tb - 0.05, pos: [3.9, y + 1.2, 7.4], mira: [0.7, y + 1.25, 0.8], e: "expo.inOut" });
      keys.push(V
        ? { t: fin, pos: [0.4, y + 1.3, 7.2], mira: [0, y + 1.75, 0.8], e: "sine.inOut" }
        : { t: fin, pos: [3.5, y + 1.18, 6.8], mira: [0.7, y + 1.25, 0.8], e: "sine.inOut" });
      frase(ctx, lineas[k], anclas[k], fin - 0.1, placa);
    });
    dir.camara(keys);
    dir.claves("foco", C.b.map((tb, k) => ({ t: tb - 0.05, v: [q(2.2, 0), P(k + 1) + 1.5, 2.3], e: "expo.inOut" })));
    dir.claves("rango", [{ t: C.b[0] - 0.05, v: 4 }]);
    C.b.forEach((tb) => dir.blur(tb - 0.45, tb + 0.1, 12));
    // ---------------- todo en un mismo lugar ----------------
    unLugar(C.todo, C.claude, C.metodo2, C.equipo2 - 0.3);
    frase(ctx, ["Todo en un", "mismo lugar"], [C.todo, w(10, "en", 1), w(10, "un", 1), w(10, "mismo", 1), C.lugar], w(10, "con", 2) - 0.28, placa);
    frase(ctx, q(["Con Claude y un", "mismo método"], ["Con Claude", "y un mismo", "método"]), [w(10, "con", 2), C.claude, w(10, "y", 2), w(10, "un", 2), w(10, "mismo", 2), C.metodo2], C.equipo2 - 0.28, { placa: true, colorPalabra: { 1: "claude-txt" } });
    tranquilo(C.equipo2 - 0.2, C.resuelva, C.respaldan - 0.2);
    frase(ctx, q(["Que tu equipo resuelva", "sin esperarte."], ["Que tu equipo", "resuelva", "sin esperarte."]), [w(10, "que", 4), w(10, "tu"), C.equipo2, C.resuelva, w(10, "sin"), C.esperarte], C.respaldan - 0.3, { cls: "tit-arriba", placa: true });
  } else {
    // ---------------- 09 · Claude en tu Empresa (la toma que fijó la vara en la v1) ----------------
    dir.visible(vC, tV, C.aprende);
    dir.cada(tV, C.aprende, (t) => { vC.scale.setScalar(Math.max(0.001, 1 - curva("power2.in")(tramo(t, C.aprende - 0.4, C.aprende)))); });
    dir.camara(V ? [
      { t: tV, pos: [0.6, 3.1, 6.6], mira: [0.0, 2.75, 0.2] },
      { t: C.aprende - 0.4, pos: [0.5, 3.05, 6.0], mira: [0.0, 2.8, 0.2], e: "sine.inOut" },
    ] : [
      { t: tV, pos: [1.05, 2.5, 6.1], mira: [-1.2, 2.25, 0.2] },
      { t: C.aprende - 0.4, pos: [0.85, 2.43, 5.35], mira: [-1.15, 2.25, 0.2], e: "sine.inOut" },
    ]);
    dir.claves("foco", [{ t: tV, v: [0.1, 2.25, 0.2] }]);
    dir.claves("rango", [{ t: tV, v: 2.6 }]);
    // la chispa vuela del fondo y aterriza en el asterisco del título
    dir.visible(s.chispa, tV, C.claude);
    dir.cada(tV, C.claude, (t) => {
      const u = curva("power2.inOut")(tramo(t, tV, C.claude));
      const a = new THREE.Vector3(-2.6, 3.2, -6), b = q(new THREE.Vector3(-0.42, 2.98, 3.6), new THREE.Vector3(0.25, 3.15, 3.6));
      s.chispa.position.copy(a).lerp(b, u);
      s.chispa.position.y += Math.sin(u * Math.PI) * 0.6;
      s.chispa.scale.setScalar(0.18 + u * 0.12);
      s.chispa.rotation.z = t * 2.2;
      s.chispa.userData.luz.intensity = 8;
      s.chispa.userData.malla.material.emissiveIntensity = 1.6;
    });
    const cT = $("div", "capa", raiz);
    ventana(tl, cT, tV, C.aprende + 0.2);
    const tit = $("div", "titulo", cT);
    const l1 = $("span", "tit-linea", tit);
    const mC = $("span", "mascara", l1);
    const claude = $("span", "claude palabra", mC);
    const barra = $("span", "barra", claude);
    claude.appendChild(document.createTextNode("Claude"));
    const ast = $("span", "palabra", l1); ast.innerHTML = CHISPA_SVG();
    const l2 = $("span", "tit-linea", tit);
    const ws2 = ["en", "tu", "Empresa"].map((x) => { const m = $("span", "mascara", l2); const y = $("span", "palabra", m, x); l2.appendChild(document.createTextNode(" ")); return y; });
    entrar(tl, claude, C.claude - 0.05, { y: 105 });
    tl.fromTo(barra, { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: "expo.out" }, C.claude + 0.1);
    tl.fromTo(ast, { scale: 1.8, rotation: -120, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 0.6, ease: "back.out(1.7)" }, C.claude);
    ws2.forEach((x, i) => entrar(tl, x, [w(9, "en"), w(9, "tu", 1), C.empresaT][i], { escalon: 0 }));
    salir(tl, [tit], C.aprende - 0.3, { dy: -90 });
    // ---------------- 09b · tu equipo aprende, dentro de lo que ya usa: tres pisos ----------------
    const tA = C.aprende - 0.2;
    dir.camara(V ? [
      { t: tA + 0.6, pos: [7.5, -2.5, 24.0], mira: [0, -5.6, 0], e: "expo.inOut" },
    ] : [
      { t: tA + 0.6, pos: [19.2, -2.2, 42.5], mira: [-6.0, -7.3, 0], e: "expo.inOut" },
    ]);
    dir.claves("foco", [{ t: tA + 0.6, v: [0, -6.6, 0.4], e: "expo.inOut" }]);
    dir.claves("rango", [{ t: tA + 0.6, v: 16, e: "expo.inOut" }]);
    dir.blur(tA, tA + 0.7, 12);
    s.pisos.forEach((_, k) => enciende(k, w(9, "usar") + k * 0.08, 0.55, 1.4));
    frase(ctx, q(["Tu equipo aprende", "a usar la IA"], ["Tu equipo", "aprende a", "usar la IA"]), [w(9, "tu", 2), w(9, "equipo"), C.aprende, w(9, "a"), w(9, "usar"), w(9, "la"), w(9, "inteligencia")], C.apps[0] - 0.3, placa);
    const apps = ["excel", "word", "correo"].map((tipo, k) => {
      const ic = icono(tipo);
      // en fila frente al edificio (como en la 2D): cada uno enciende su piso
      ic.position.set(q(1.2, 0) + (k - 1) * q(1.6, 1.32), P(2) + 1.4, 3.6);
      esc.add(ic);
      return ic;
    });
    const tAppsFin = C.sin[0] - 0.2;
    dir.camara(V ? [
      { t: C.apps[0] - 0.3, pos: [0.3, P(2) + 1.0, 10.4], mira: [0, P(2) + 1.75, 2.0], e: "expo.inOut" },
      { t: tAppsFin, pos: [0.2, P(2) + 1.0, 9.6], mira: [0, P(2) + 1.75, 2.0], e: "sine.inOut" },
    ] : [
      { t: C.apps[0] - 0.3, pos: [2.4, P(2) + 1.15, 10.6], mira: [1.0, P(2) + 1.45, 2.0], e: "expo.inOut" },
      { t: tAppsFin, pos: [2.2, P(2) + 1.1, 9.8], mira: [1.0, P(2) + 1.45, 2.0], e: "sine.inOut" },
    ]);
    dir.claves("foco", [{ t: C.apps[0] - 0.3, v: [q(1.2, 0), P(2) + 1.4, 3.6], e: "expo.inOut" }]);
    dir.claves("rango", [{ t: C.apps[0] - 0.3, v: 6 }]);
    apps.forEach((ic, k) => {
      const ta = C.apps[k];
      dir.visible(ic, ta - 0.05, tAppsFin + 0.4);
      dir.cada(ta - 0.05, tAppsFin + 0.4, (t) => {
        const kk = curva("back.out(1.8)")(tramo(t, ta, ta + 0.45)), sale = curva("power2.in")(tramo(t, tAppsFin, tAppsFin + 0.4));
        ic.scale.setScalar(Math.max(0.001, kk * (1 - sale) * q(1.15, 1.0)));
        ic.rotation.y = -0.12 + 0.08 * Math.sin(t + k);
      });
      enciende(k + 1, ta, 1.2, tAppsFin - ta);
    });
    const cChips = $("div", "capa", raiz);
    ventana(tl, cChips, C.apps[0] - 0.1, tAppsFin + 0.3);
    const chips = $("div", "chips chips-v2", cChips);
    [["Excel", 0], ["Word", 1], ["Correo", 2]].forEach(([n, k]) => {
      if (k) { const pt = $("span", "punto", chips, "·"); tl.fromTo(pt, { opacity: 0 }, { opacity: 1, duration: 0.2 }, C.apps[k] - 0.05); }
      const c = $("span", "pildora", chips, n);
      pop(tl, c, C.apps[k]);
    });
    salir(tl, [chips], tAppsFin, { dy: -60 });
    // la chispa entra a cada programa
    dir.visible(s.chispa, C.apps[0] - 0.2, tAppsFin + 0.2);
    dir.cada(C.apps[0] - 0.2, tAppsFin + 0.2, (t) => {
      let k = 0; for (let i = 0; i < 3; i++) if (t >= C.apps[i] - 0.2) k = i;
      const ic = apps[k], prev = apps[Math.max(0, k - 1)];
      const u = curva("power2.inOut")(tramo(t, C.apps[k] - 0.2, C.apps[k] + 0.1));
      const dest = ic.position.clone().add(new THREE.Vector3(0.45, 0.32, 0.12));
      s.chispa.position.copy(prev.position.clone().add(new THREE.Vector3(0.45, 0.32, 0.12))).lerp(dest, k ? u : 1);
      s.chispa.scale.setScalar(0.14 * curva("back.out(2)")(tramo(t, C.apps[0] - 0.2, C.apps[0] + 0.2)));
      s.chispa.rotation.z = t * 2;
      s.chispa.userData.luz.intensity = 7;
      s.chispa.userData.malla.material.emissiveIntensity = 1.6;
    });
    // ---------------- 10 · sin cambiar, sin saber, sin contratar: bajando el edificio ----------------
    const tiposSin = ["instalar", "codigo", "contratar"];
    const lineasSin = [["Sin cambiar", "de programas"], ["Sin saber", "de tecnología"], q(["Sin contratar", "a nadie nuevo."], ["Sin contratar", "a nadie", "nuevo."])];
    const anclasSin = [
      [C.sin[0], w(10, "cambiar"), w(10, "de", 1), w(10, "programas,")],
      [C.sin[1], w(10, "saber"), w(10, "de", 2), w(10, "tecnología")],
      [C.sin[2], w(10, "contratar"), w(10, "a"), w(10, "nadie"), w(10, "nuevo.")],
    ];
    const keys = [];
    C.sin.forEach((ts, k) => {
      const piso = k + 4, y = P(piso);
      const ic = icono(tiposSin[k]);
      ic.position.set(q(2.2, 0), y + 1.5, 2.3);
      esc.add(ic);
      const fin = k < 2 ? C.sin[k + 1] - 0.15 : C.todo - 0.55;
      dir.visible(ic, ts - 0.1, fin + 0.4);
      dir.cada(ts - 0.1, fin + 0.4, (t) => {
        const kk = curva("back.out(1.8)")(tramo(t, ts, ts + 0.5)), sale = curva("power2.in")(tramo(t, fin, fin + 0.4));
        ic.scale.setScalar(Math.max(0.001, kk * (1 - sale)));
        ic.rotation.y = 0.25 * Math.sin(t * 0.8);
      });
      enciende(piso, ts + 0.3, 1.2, fin - ts - 0.3);
      keys.push(V ? { t: ts - 0.05, pos: [0.5, y + 1.35, 7.8], mira: [0, y + 1.75, 0.8], e: "expo.inOut" } : { t: ts - 0.05, pos: [3.9, y + 1.2, 7.4], mira: [0.7, y + 1.25, 0.8], e: "expo.inOut" });
      keys.push(V ? { t: fin, pos: [0.4, y + 1.3, 7.2], mira: [0, y + 1.75, 0.8], e: "sine.inOut" } : { t: fin, pos: [3.5, y + 1.18, 6.8], mira: [0.7, y + 1.25, 0.8], e: "sine.inOut" });
      frase(ctx, lineasSin[k], anclasSin[k], fin - 0.1, placa);
    });
    dir.camara(keys);
    dir.claves("foco", C.sin.map((ts, k) => ({ t: ts - 0.05, v: [q(2.2, 0), P(k + 4) + 1.5, 2.3], e: "expo.inOut" })));
    dir.claves("rango", [{ t: C.sin[0] - 0.05, v: 4 }]);
    C.sin.forEach((ts) => dir.blur(ts - 0.45, ts + 0.1, 12));
    unLugar(C.todo, C.lugar, C.metodo2, C.equipo2 - 0.3);
    frase(ctx, ["Todo en un", "mismo lugar"], [C.todo, w(11, "en"), w(11, "un", 1), w(11, "mismo", 1), C.lugar], w(11, "con") - 0.28, placa);
    frase(ctx, ["Con un", "mismo método"], [w(11, "con"), w(11, "un", 2), w(11, "mismo", 2), C.metodo2], C.equipo2 - 0.28, placa);
    tranquilo(C.equipo2 - 0.2, C.resuelva, C.respaldan - 0.2);
    frase(ctx, q(["Que tu equipo resuelva", "sin esperarte."], ["Que tu equipo", "resuelva", "sin esperarte."]), [w(11, "que"), w(11, "tu"), C.equipo2, C.resuelva, w(11, "sin"), C.esperarte], C.respaldan - 0.3, { cls: "tit-arriba", placa: true });
  }

  // ---------------- respaldo: el edificio entero; VADAI × Total Coach; +40 ----------------
  const iR = platica ? 11 : 12, iP = iR + 1, iN = iR + 2;
  dir.camara(V ? [
    { t: C.respaldan - 0.1, pos: [7.5, -2.5, 24.0], mira: [0, -5.6, 0], e: "expo.inOut" },
    { t: C.nosotros - 0.2, pos: [6.6, -3.2, 21.5], mira: [0, -5.6, 0], e: "sine.inOut" },
  ] : [
    { t: C.respaldan - 0.1, pos: [19.2, -2.2, 42.5], mira: [-6.0, -7.3, 0], e: "expo.inOut" },
    { t: C.nosotros - 0.2, pos: [17.4, -3.0, 38.6], mira: [-6.0, -7.3, 0], e: "sine.inOut" },
  ]);
  dir.claves("fov", [{ t: C.respaldan - 0.6, v: F(30) }]);
  dir.claves("foco", [{ t: C.respaldan - 0.1, v: [0, -6.6, 0.4], e: "expo.inOut" }]);
  dir.claves("rango", [{ t: C.respaldan - 0.1, v: 16, e: "expo.inOut" }]);
  dir.blur(C.respaldan - 0.6, C.respaldan + 0.1, 12);
  const finR = C.porque2 - 0.3;
  const cR = $("div", "capa", raiz);
  ventana(tl, cR, C.respaldan - 0.1, finR + 0.5);
  const placaL = $("div", "placa-logos placa-v2", cR);
  placaL.innerHTML = `<img src="./assets/marca/vadai-horizontal-recorte.png" class="logo-vadai" alt="VADAI"><span class="sep"></span><img src="./assets/marca/totalcoach-recorte.png" class="logo-tc" alt="Total Coach">`;
  pop(tl, placaL, C.respaldan, { desde: 0.8, y: 20 });
  tl.fromTo(placaL.children[0], { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.35, ease: "expo.out" }, C.vadai);
  tl.fromTo(placaL.children[2], { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.35, ease: "expo.out" }, C.total);
  tl.to(placaL, { opacity: 0, y: -30, duration: 0.3, ease: "power2.in" }, finR);
  const cont = $("div", "contador3d", cR, "+0");
  const n40 = { v: 0 };
  tl.fromTo(cont, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4, ease: "expo.out" }, C.cuarenta - 0.1);
  tl.fromTo(n40, { v: 0 }, { v: 40, duration: 0.9, ease: "power2.out", modifiers: { v: (x) => { cont.textContent = `+${Math.round(+x)}`; return x; } } }, C.cuarenta);
  tl.to(cont, { opacity: 0, duration: 0.25 }, finR);
  frase(ctx, q(["Empresas mexicanas", "capacitadas"], ["Empresas", "mexicanas", "capacitadas"]), [w(iR, "empresas"), w(iR, "mexicanas"), C.capacitadas], finR, { cls: "tit-respaldo", placa: true });
  s.pisos.forEach((_, k) => enciende(k, C.cuarenta + k * 0.1, 1.4));

  // ---------------- «porque todo mundo te va a seguir hablando de IA»: los titulares rodean un edificio que ya no se mueve ----------------
  const camE = q(new THREE.Vector3(17.4, -3.0, 38.6), new THREE.Vector3(6.6, -3.2, 21.5)), miraE = q(new THREE.Vector3(-6.0, -7.3, 0), new THREE.Vector3(0, -5.6, 0));
  const fwd = miraE.clone().sub(camE).normalize(), der = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize(), arr = new THREE.Vector3().crossVectors(der, fwd);
  const tanV = Math.tan((F(30) * Math.PI) / 360), asp = W / H;
  const r2 = azar(202);
  titulares().concat(titulares()).forEach((m, i) => {
    esc.add(m);
    const t0 = C.porque2 + 0.1 + i * 0.2, t1 = t0 + 1.25;
    const lado = i % 2 ? 1 : -1, arriba = i % 4 < 2 ? 1 : -1;
    const fx = lado * (0.15 + r2() * 0.55), fy = arriba * (0.5 + r2() * 0.3);   // fracción del medio cuadro
    dir.visible(m, t0, t1);
    dir.cada(t0, t1, (t) => {
      const u = curva("power2.in")(tramo(t, t0, t1));
      const d = 24 - u * 23, sale = 1 + u * 1.6;
      m.position.copy(camE).addScaledVector(fwd, d).addScaledVector(der, fx * sale * d * tanV * asp).addScaledVector(arr, fy * sale * d * tanV);
      m.quaternion.copy(mundo.camara.quaternion);
      m.scale.setScalar(1.3);
    });
  });
  dir.blur(C.porque2, C.nosotros, 8);
  frase(ctx, q(["Inteligencia artificial"], ["Inteligencia", "artificial"]), [C.ia2, w(iP, "artificial.")], C.nosotros - 0.25, { cls: "tit-centro", placa: true });

  // ---------------- «nosotros te enseñamos qué hacer con ella»: la chispa frente a la lente ----------------
  const camN = q(new THREE.Vector3(17.4, -3.0, 38.6), new THREE.Vector3(6.6, -3.2, 21.5)), miraN = q(new THREE.Vector3(-6.0, -7.3, 0), new THREE.Vector3(0, -5.6, 0));
  const dirN = miraN.clone().sub(camN).normalize();
  const pChispa = camN.clone().add(dirN.clone().multiplyScalar(5)).add(new THREE.Vector3(0, q(1.1, 1.6), 0));
  const tLente = C.dale - 0.12;
  dir.visible(s.chispa, C.nosotros - 0.1, tLente + 0.02);
  dir.cada(C.nosotros - 0.1, tLente + 0.02, (t) => {
    const k = curva("expo.out")(tramo(t, C.nosotros - 0.1, C.nosotros + 0.4));
    const late = Math.exp(-Math.pow((t - C.ella - 0.05) / 0.15, 2));
    const cruce = curva("power3.in")(tramo(t, tLente - 0.5, tLente));
    s.chispa.position.copy(pChispa).lerp(camN.clone().add(dirN.clone().multiplyScalar(0.4)), cruce);
    s.chispa.scale.setScalar(Math.max(0.001, (k * 0.32 + late * 0.15) * (1 + cruce * 2.8)));
    s.chispa.rotation.z = t * 0.6;
    s.chispa.userData.luz.intensity = 6 * k + late * 18 + cruce * 30;
    s.chispa.userData.malla.material.emissiveIntensity = 1.3 + late * 3 + cruce * 6;
  });
  dir.claves("foco", [{ t: C.nosotros - 0.2, v: pChispa.toArray() }]);
  dir.claves("rango", [{ t: C.nosotros - 0.2, v: 3 }]);
  dir.blur(tLente - 0.55, tLente + 0.02, 14);
  frase(ctx, q(["Nosotros te enseñamos", "qué hacer con ella."], ["Nosotros te", "enseñamos", "qué hacer", "con ella."]), [C.nosotros, w(iN, "te"), C.ensenamos, w(iN, "qué"), w(iN, "hacer"), w(iN, "con"), C.ella], tLente - 0.15, { cls: "tit-nosotros", placa: true });

  // ---------------- tarjeta final: el degradado héroe, la flecha lima, los logos ----------------
  ctx.final = { tLente };
}
