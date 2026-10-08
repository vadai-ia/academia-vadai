// v2 · 3D · 01–04 (0–28 s): gancho → bucle → 6 de 100 → «vas tarde».
// Reglas v2: un solo texto a la vez, siempre sobre superficie sólida (aquí el navy liso); nada pasa
// detrás del texto; cero tiempo muerto; cada escena nace de un elemento de la anterior.
// Formato: ctx.V (vertical 1080×1920, fov vertical 50.9° = el mismo ancho que el alto del horizontal).
import * as THREE from "three";
import { $, titular, entrar, salir, ventana } from "../../estilo/ui.js";
import { titulares, caos, ciclo, puntos } from "../../mundo/utileria.js";
import { curva, tramo, azar } from "../../estilo/mundo.js";
import { OLEADAS, PASO_LOGO } from "../cues.js";
import { tarjetaLogo, onda3d } from "./logos3d.js";
import { pastilla, airear, entrada, enfatizar } from "./texto.js";

export function montar(ctx) {
  const { s, dir, tl, raiz, C, T, V, F, mundo } = ctx;
  const q = (h, v) => (V ? v : h);
  const chispa = s.chispa;
  // la ventana de Claude es la respuesta (llega en el cierre): en la apertura no aparece nunca
  dir.visible(s.ventana, 999, 1000);
  const centro = new THREE.Vector3(0, 1.55, 0.3);
  dir.claves("fov", [{ t: 0, v: F(30) }]);

  // ---------------- 01 · negro, la chispa, titulares; dos frases sobre el navy ----------------
  const P_CHISPA = new THREE.Vector3(0, 2.62, 4.2);       // arriba del texto, nunca detrás
  dir.claves("noche", [{ t: 0, v: 1 }, { t: C.pase01 - 0.02, v: 1 }, { t: C.pase01 + 0.6, v: 0.28, e: "power2.out" }, { t: C.colapso, v: 0.28 }, { t: C.colapso + 0.5, v: 1, e: "power2.inOut" }]);
  dir.claves("luz", [{ t: 0, v: 0.15 }, { t: C.pase01 - 0.02, v: 0.15 }, { t: C.pase01 + 0.5, v: 0.85, e: "power2.out" }, { t: C.colapso, v: 0.85 }, { t: C.colapso + 0.5, v: 0.12, e: "power2.inOut" }]);
  dir.camara([
    { t: 0, pos: [0, 1.8, 9.6], mira: [0, 1.95, 4.2] },
    { t: C.pase01 - 0.6, pos: [0.1, 1.82, 9.1], mira: [0, 1.95, 4.2], e: "sine.inOut" },
    { t: C.pase01 - 0.001, pos: [0.1, 1.82, 9.1], mira: [0, 1.95, 4.2] },
  ]);
  dir.claves("foco", [{ t: 0, v: P_CHISPA.toArray() }]);
  dir.claves("rango", [{ t: 0, v: 3 }]);
  dir.visible(chispa, 0, C.pase01 + 0.02);
  const camPos = new THREE.Vector3(0.1, 1.82, 9.1);
  const lente = camPos.clone().lerp(P_CHISPA, 0.07);
  dir.cada(0, C.pase01 + 0.02, (T_) => {
    const k = curva("expo.out")(tramo(T_, C.enciende - 0.05, C.enciende + 0.5));
    const latido = Math.exp(-Math.pow((T_ - (C.enciende + 0.6)) / 0.18, 2)) * 0.35;
    const cruce = curva("power3.in")(tramo(T_, C.pase01 - 0.5, C.pase01));
    chispa.position.copy(P_CHISPA).lerp(lente, cruce);
    chispa.scale.setScalar((0.001 + k * 0.3 + latido * 0.6) * (1 + cruce * 2.8));
    chispa.rotation.z = T_ * 0.35;
    chispa.rotation.y = Math.sin(T_ * 0.8) * 0.3;
    chispa.userData.luz.intensity = (k + latido) * 6 + cruce * 30;
    chispa.userData.malla.material.emissiveIntensity = 1.2 + latido * 3 + cruce * 6;
  });
  dir.blur(C.pase01 - 0.55, C.pase01 + 0.02, 14);
  const tars = titulares();
  const r01 = azar(101);
  tars.forEach((m, i) => {
    ctx.escena.add(m);
    const t0 = 0.95 + i * 0.3, t1 = t0 + 1.1;
    const lado = i % 2 ? 1 : -1, arriba = i % 4 < 2 ? 1 : -1;
    const x = lado * (0.8 + r01() * 1.4) * q(1, 0.55), y = 1.95 + arriba * (1.85 + r01() * 0.4) * q(1, 1.25);
    dir.visible(m, t0, t1);
    dir.cada(t0, t1, (T_) => {
      const u = curva("power2.in")(tramo(T_, t0, t1));
      m.position.set(x * (0.6 + u * 1.5), y + (y - 1.95) * u * 1.2, -6 + u * 15.6);
      m.rotation.set(0.06 * lado, -0.18 * lado * u, 0.05 * lado);
    });
  });
  dir.blur(0.9, C.pregunta, 10);
  const c01 = $("div", "capa", raiz);
  ventana(tl, c01, 0, C.pase01 - 0.05);
  const fIA = titular(c01, q(["Inteligencia artificial"], ["Inteligencia", "artificial"]), "tit tit-centro sobre-navy");
  enfatizar(fIA); fIA.palabras.forEach((w, i) => entrada(tl, w, [C.ia, T.w(0, "artificial.")][i], "golpe"));
  salir(tl, fIA.palabras, C.pregunta - 0.2, { dy: -70 });
  const fQ = titular(c01, q(["¿Qué hacer con ella", "en tu empresa?"], ["¿Qué hacer", "con ella en", "tu empresa?"]), "tit tit-centro sobre-navy chica2");
  const anclasQ = ["qué", "hacer", "con", "ella", "en", "tu", "empresa."].map((w) => T.w(1, w));
  fQ.palabras[6].classList.add("enf-azul"); fQ.palabras.forEach((w, i) => entrada(tl, w, anclasQ[i], i === 0 ? "golpe" : "sube"));
  salir(tl, fQ.palabras, C.pase01 - 0.45, { dy: -40 });

  // ---------------- 02 · el escritorio enterrado en el bucle de herramientas ----------------
  const anillo = ciclo(1.85);
  anillo.position.copy(centro);
  ctx.escena.add(anillo);
  const items = caos().filter((it) => it.tipo !== "aviso");
  items.forEach((it) => ctx.escena.add(it.obj));
  const T02 = C.pase01, T03 = C.colapso;
  const giro = (t) => { const u = Math.max(0, t - T02); const extra = Math.max(0, t - C.avanzaron); return 0.42 * u + 0.05 * u * u + 0.9 * extra * extra; };
  dir.camara([
    { t: T02, pos: q([3.0, 2.55, 9.4], [2.2, 2.6, 9.8]), mira: [0, 1.5, 0.2] },
    { t: T03 - 0.15, pos: q([-1.2, 2.3, 8.6], [-0.9, 2.35, 9.2]), mira: [0, 1.55, 0.2], e: "sine.inOut" },
  ]);
  dir.claves("foco", [{ t: T02, v: [0, 1.5, 0.4] }]);
  dir.claves("rango", [{ t: T02, v: 6 }]);
  dir.visible(s.pisos[0].grupo, T02, T03 + 0.6);
  for (let i = 1; i < s.pisos.length; i++) dir.visible(s.pisos[i].grupo, 999, 1000);
  for (const n of s.nubes) dir.visible(n, T02, T03 + 0.6);
  dir.visible(anillo, T02, T03 + 0.75);
  anillo.userData.arcos.forEach((a, i) => dir.visible(a, C.L[i] - 0.05, T03 + 0.75));
  dir.cada(T02, T03 + 0.75, (t) => {
    anillo.rotation.z = -giro(Math.min(t, T03));
    anillo.userData.arcos.forEach((a, i) => a.scale.setScalar(Math.max(0.001, curva("back.out(2.2)")(tramo(t, C.L[i] - 0.05, C.L[i] + 0.4)))));
    anillo.scale.setScalar(Math.max(0.001, 1 - curva("power3.in")(tramo(t, T03 - 0.05, T03 + 0.6))));
  });
  dir.blur(C.avanzaron, T03 + 0.3, 10);
  items.forEach((it, i) => {
    const n = items.length, fase = (i / n) * Math.PI * 2, r = 1.85 + (i % 3 - 1) * 0.24, z = i % 2 ? 0.5 : -0.3;
    dir.visible(it.obj, T02, T03 + 0.6);
    dir.cada(T02, T03 + 0.6, (t) => {
      const th = giro(Math.min(t, T03)) + fase;
      const c = curva("power3.in")(tramo(t, T03 - 0.05, T03 + 0.55));
      it.obj.position.set(centro.x + Math.cos(th) * r * (1 - c), centro.y + Math.sin(th) * r * 0.82 * (1 - c), centro.z + z * (1 - c));
      it.obj.rotation.set(0.05 * Math.sin(th * 2), 0.25 * Math.cos(th), Math.sin(th) * 0.12);
      it.obj.scale.setScalar(Math.max(0.001, (1 - c) * 0.95));
    });
  });
  // las herramientas de IA: tarjetas con su logo, en oleadas (una por «sale…»), en una órbita más
  // amplia y más lenta que el ciclo (paralaje); cada llegada con su anillo
  const llegadas = [];
  C.oleadas.forEach((t0, k) => OLEADAS[k].forEach((id, j) => llegadas.push({ id, t: t0 + j * PASO_LOGO })));
  const RX = q(2.65, 2.05), RY = q(1.85, 2.6);
  const logos = llegadas.map((l, n) => {
    const obj = tarjetaLogo(l.id);
    const ond = onda3d(l.id === "claude" ? C.durazno : C.cieloClaro);
    ctx.escena.add(obj, ond);
    dir.visible(obj, l.t, T03 + 0.6);
    dir.visible(ond, l.t, l.t + 0.6);
    return { ...l, obj, ond, a0: (n * 137.508 * Math.PI) / 180 + Math.PI / 2, z: n % 2 ? 0.75 : -0.35, rr: 1 + ((n % 3) - 1) * 0.06 };
  });
  dir.cada(T02, T03 + 0.6, (t) => {
    const tg = Math.min(t, T03), c = curva("power3.in")(tramo(t, T03 - 0.05, T03 + 0.55));
    for (const l of logos) {
      const a = l.a0 - 0.55 * giro(tg) - c * 2.2;
      const k = curva("back.out(2.4)")(tramo(t, l.t, l.t + 0.5));
      l.obj.position.set(centro.x + Math.cos(a) * RX * l.rr * (1 - c), centro.y + Math.sin(a) * RY * l.rr * (1 - c) + Math.sin(t * 1.6 + l.a0) * 0.05, centro.z + l.z * (1 - c));
      l.obj.rotation.set(0.08 * Math.sin(t + l.a0), -0.3 * Math.cos(a), 0.06 * Math.sin(a));
      l.obj.scale.setScalar(Math.max(0.001, k * (1 - c)));
      const u = tramo(t, l.t, l.t + 0.55);
      l.ond.position.copy(l.obj.position);
      l.ond.quaternion.copy(mundo.camara.quaternion);
      l.ond.scale.setScalar(0.25 + curva("expo.out")(u) * 0.95);
      l.ond.material.opacity = 0.85 * (1 - u);
    }
  });
  // empujón de lente en cada oleada; sacudida y destello en «sale otra»
  C.oleadas.forEach((t0) => dir.claves("fov", [{ t: t0 - 0.02, v: F(30) }, { t: t0 + 0.12, v: F(27.6), e: "power3.out" }, { t: t0 + 0.85, v: F(30), e: "sine.inOut" }]));
  const sacudidas = [{ t: C.L[2] - 0.02, dur: 0.45, amp: 0.05 }, { t: C.avanzaron + 0.4, dur: 1.2, amp: 0.018 }];
  ctx.sacudidas = (ctx.sacudidas || []).concat(sacudidas);
  const flash = $("div", "flash", raiz);
  tl.fromTo(flash, { opacity: 0 }, { opacity: 0.25, duration: 0.04 }, C.L[2]);
  tl.fromTo(flash, { opacity: 0.25 }, { opacity: 0, duration: 0.35, ease: "power2.out", immediateRender: false }, C.L[2] + 0.04);
  // las frases del bucle, una a la vez, en pastilla fija abajo (nunca encajonadas entre tarjetas)
  const frasesB = [["Sale una herramienta nueva", C.L[0]], ["La prueban a su manera", C.L[1]], ["O ni eso", C.niEso], ["Ya avanzaron…", T.w(2, "ya")], ["Sale otra", C.L[2]]];
  frasesB.forEach(([txt, t0], i) => pastilla(ctx, txt, t0, i < frasesB.length - 1 ? frasesB[i + 1][1] - 0.26 : T03 - 0.05));

  // ---------------- 03 · seis de cada cien; 04 · los seis se van y tú te quedas ----------------
  const grid = puntos();
  const ESC = q(0.92, 0.82);
  grid.position.set(q(2.0, 0), q(1.7, 1.0), 3.4);
  grid.scale.setScalar(ESC);
  ctx.escena.add(grid);
  const IDX = [23, 37, 44, 58, 66, 71];
  dir.visible(grid, T03 + 0.05, C.mientras + 0.08);
  dir.cada(T03 + 0.05, C.mientras + 0.1, (t) => {
    grid.userData.lista.forEach((m, i) => {
      const r = Math.floor(i / 10), c = i % 10, d = Math.hypot(r - 4.5, c - 4.5);
      const k = curva("back.out(1.8)")(tramo(t, C.realidad - 0.3 + d * 0.05, C.realidad + 0.15 + d * 0.05));
      const j = IDX.indexOf(i);
      const enc = j >= 0 ? curva("expo.out")(tramo(t, C.seis + 0.05 + j * 0.09, C.seis + 0.4 + j * 0.09)) : 0;
      const se_van = j >= 0 ? curva("power2.in")(tramo(t, C.normal + 0.1 + j * 0.06, C.tarde + 0.9)) : 0;
      const solo = j < 0 && i !== 45 ? curva("power2.inOut")(tramo(t, C.normal - 0.35 + c * 0.03, C.normal + 0.15 + c * 0.03)) : 0;
      m.position.copy(m.userData.base).multiplyScalar(0.25 + 0.75 * k);
      m.position.z -= se_van * 14 + solo * 2.5;
      m.position.x += se_van * (2.2 + j * 0.25);
      m.position.y += se_van * (0.6 + (j % 3) * 0.35);
      m.scale.setScalar(Math.max(0.001, k * (1 + enc * 0.35) * (1 - solo)));
      if (j >= 0) m.material.emissiveIntensity = 0.1 + enc * 2.2;
    });
  });
  dir.blur(C.normal, C.tarde + 1.0, 8);
  const tu = grid.userData.lista[45];
  const pTu = tu.userData.base.clone().multiplyScalar(ESC).add(grid.position);
  const tZoom = C.mientras - 0.25;
  dir.camara(V ? [
    { t: T03, pos: [-0.9, 2.35, 9.2], mira: [0, 1.55, 0.2] },
    { t: T03 + 0.6, pos: [0, 2.43, 15.4], mira: [0, 2.43, 3.4], e: "power2.out" },
    { t: C.provecho, pos: [0, 2.4, 14.8], mira: [0, 2.4, 3.4], e: "sine.inOut" },
    { t: C.normal + 0.2, pos: [0.15, 2.3, 13.4], mira: [0.15, 2.3, 3.4], e: "power2.inOut" },
    { t: C.nadie + 0.8, pos: [pTu.x, pTu.y + 0.75, pTu.z + 3.4], mira: [pTu.x, pTu.y + 0.55, pTu.z], e: "power2.inOut" },
    { t: tZoom, pos: [pTu.x, pTu.y + 0.6, pTu.z + 2.8], mira: [pTu.x, pTu.y + 0.45, pTu.z], e: "sine.inOut" },
  ] : [
    { t: T03, pos: [-1.2, 2.3, 8.6], mira: [0, 1.55, 0.2] },
    { t: T03 + 0.6, pos: [0.4, 1.75, 13.6], mira: [0.4, 1.7, 3.4], e: "power2.out" },
    { t: C.provecho, pos: [0.45, 1.72, 13.0], mira: [0.45, 1.7, 3.4], e: "sine.inOut" },
    { t: C.normal + 0.2, pos: [1.0, 1.72, 10.6], mira: [1.4, 1.7, 3.4], e: "power2.inOut" },
    { t: C.nadie + 0.8, pos: [pTu.x - 1.3, pTu.y + 0.12, pTu.z + 3.4], mira: [pTu.x - 0.85, pTu.y, pTu.z], e: "power2.inOut" },
    { t: tZoom, pos: [pTu.x - 1.05, pTu.y + 0.1, pTu.z + 2.75], mira: [pTu.x - 0.7, pTu.y, pTu.z], e: "sine.inOut" },
  ]);
  // «mientras tanto…»: la cámara entra por el punto «tú» (la pantalla se llena de él) → 05
  dir.camara([{ t: C.mientras + 0.08, pos: [pTu.x, pTu.y, pTu.z + 0.17], mira: pTu.toArray(), e: "power3.in" }]);
  dir.blur(tZoom, C.mientras + 0.08, 10);
  dir.claves("foco", [{ t: T03 + 0.3, v: q([2.0, 1.7, 3.4], [0, 1.0, 3.4]) }, { t: C.nadie + 0.8, v: pTu.toArray(), e: "power2.inOut" }]);
  dir.claves("rango", [{ t: T03 + 0.3, v: 4 }, { t: C.nadie + 0.8, v: 1.6, e: "power2.inOut" }, { t: C.mientras + 0.08, v: 1.6 }]);
  const c03 = $("div", "capa", raiz);
  ventana(tl, c03, T03, C.normal + 0.6);
  const cifra = $("div", "cifra", c03);
  const seis = $("span", "cifra-num", cifra, "6");
  const de100 = $("span", "cifra-de", cifra, " de 100");
  const fuente = $("div", "fuente", c03, "McKinsey, The State of AI 2026");
  entrada(tl, seis, C.seis, "golpe");
  entrada(tl, de100, C.cien, "sube");
  tl.fromTo(fuente, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, ease: "expo.out" }, C.cien + 0.2);
  salir(tl, [seis, de100, fuente], C.normal + 0.1, { dx: -80, dy: 0 });
  const c04 = $("div", "capa", raiz);
  ventana(tl, c04, C.normal, C.mientras + 0.2);
  const fT = titular(c04, q(["Es normal sentir", "que vas tarde."], ["Es normal", "sentir que", "vas tarde."]), "tit tit-izq sobre-navy");
  const anclasT = ["es", "normal", "sentir", "que", "vas", "tarde:"].map((w) => T.w(4, w));
  enfatizar(fT); fT.palabras.forEach((w, i) => entrada(tl, w, anclasT[i], "sube"));
  const tHa = C.ha;
  salir(tl, fT.palabras, tHa - 0.27, { dy: -60, dur: 0.2 });
  const fN = airear(titular(c04, q(["Nadie te ha", "explicado cómo."], ["Nadie te ha", "explicado", "cómo."]), "tit tit-izq sobre-navy"));
  const anclasN = [tHa, tHa, tHa, T.w(4, "explicado"), T.w(4, "cómo")];
  enfatizar(fN); fN.palabras.forEach((w, i) => entrada(tl, w, anclasN[i], "barre"));
  salir(tl, fN.palabras, C.mientras - 0.4, { dy: -60, dur: 0.25 });
  ctx.items02 = items; ctx.anillo02 = anillo; ctx.grid = grid; ctx.logos02 = logos; ctx.pTu = pTu;
}
