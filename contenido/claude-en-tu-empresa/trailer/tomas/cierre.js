// 11–15 · El cierre. 11 corre solo (noche → lunes 7:00 → amanecer, el reporte llega) ·
// 12 practica y decide (lupa, matriz, cascada de los siete pisos) · 13 lo que te llevas ·
// 14 subida continua al escritorio tranquilo (héroe 13→14) · 15 tarjeta final.
import * as THREE from "three";
import { $, titular, entrar, salir, pop, deslizar, contar, golpe, CHISPA_SVG } from "../estilo/ui.js";
import { relojGrande, sobre3d, barra, libro, mazo, cartucho, carpeta3d, caja, ciclo } from "../mundo/utileria.js";
import { curva, tramo, C, barro } from "../estilo/mundo.js";
import { PASO, PISOS } from "../mundo/escena.js";

const Y = (i) => -PASO * i;
function capaToma(ctx, desde, hasta) {
  const c = $("div", "capa", ctx.raiz);
  ctx.tl.set(c, { autoAlpha: 0 }, 0);
  ctx.tl.set(c, { autoAlpha: 1 }, desde);
  ctx.tl.set(c, { autoAlpha: 0 }, hasta);
  return c;
}
function encabezado(ctx, capa, num, texto, t, tSale, dy = -70) {
  const e = $("div", "eyebrow", capa);
  const n = $("span", "mascara", e); const nn = $("span", "palabra num", n, num + " ·");
  e.appendChild(document.createTextNode(" "));
  const ws = texto.split(" ").map((w) => { const m = $("span", "mascara", e); const x = $("span", "palabra", m, w); e.appendChild(document.createTextNode(" ")); return x; });
  entrar(ctx.tl, [nn, ...ws], t, { escalon: 0.06 });
  salir(ctx.tl, [nn, ...ws], tSale, { dy });
  return e;
}
function card(capa, x, y, w, h, cls = "") {
  const d = $("div", "tarjeta " + cls, capa);
  Object.assign(d.style, { left: x + "px", top: y + "px", width: w + "px", height: h + "px" });
  return d;
}

export async function montar(ctx) {
  const { s, dir, tl, p, B, beat, escena, raiz } = ctx;
  const T11 = B(42), T12 = B(46), T13 = B(51), T14 = B(56), T15 = B(59), FIN = 150;
  const y4 = Y(4), y5 = Y(5);

  // =================== 11 · déjalo corriendo solo ===================
  dir.camara([
    { t: T11 + 0.1, pos: [1.4, y4 + 1.85, 9.1], mira: [1.05, y4 + 0.8, 1.4], e: "power2.in" },
    { t: T11 + 2.5, pos: [2.9, 2.25, 9.2], mira: [-0.1, 1.35, 0.4], e: "expo.out" },
    { t: T12 - 0.1, pos: [2.5, 2.15, 8.6], mira: [-0.1, 1.3, 0.4], e: "sine.inOut" },
  ]);
  dir.blur(T11 + 0.1, T11 + 1.4, 12);
  dir.claves("foco", [{ t: T11 + 2.5, v: [0.2, 1.2, 0.4] }]);
  dir.claves("rango", [{ t: T11 + 2.5, v: 3.5 }]);
  const tSiete = p("11", "siete,"), tLlega = p("11", "llega");
  dir.claves("noche", [{ t: T11 + 0.4, v: 0 }, { t: T11 + 2.0, v: 0.9, e: "power2.inOut" }, { t: tSiete, v: 0.9 }, { t: tSiete + 1.6, v: 0, e: "power2.inOut" }]);
  dir.claves("luz", [{ t: T11 + 0.4, v: 1 }, { t: T11 + 2.0, v: 0.32, e: "power2.inOut" }, { t: tSiete, v: 0.32 }, { t: tSiete + 1.6, v: 1, e: "power2.inOut" }]);
  dir.visible(s.telefono, T11, 999);
  const reloj = relojGrande();
  reloj.position.set(-1.95, 2.15, 1.0);
  reloj.rotation.y = 0.32;
  reloj.scale.setScalar(0.72);
  escena.add(reloj);
  dir.visible(reloj, T11 + 0.8, T12 + 0.4);
  dir.cada(T11 + 0.8, T12 + 0.4, (T) => {
    const k = curva("back.out(1.6)")(tramo(T, T11 + 0.8, T11 + 1.4));
    const sale = curva("power2.in")(tramo(T, T12 - 0.2, T12 + 0.4));
    reloj.scale.setScalar(Math.max(0.001, 0.72 * k * (1 - sale)));
    // time-lapse: de la noche anterior a las 7:00 en punto, sobre la palabra «siete»
    const u = curva("power2.inOut")(tramo(T, T11 + 1.6, tSiete));
    reloj.userData.hora(-0.5 + u * 7.5);
  });
  dir.blur(T11 + 1.6, tSiete, 10);
  const sobre = sobre3d();
  escena.add(sobre);
  const desde = new THREE.Vector3(3.4, 2.9, 1.6), sobreFin = new THREE.Vector3(0.95, 1.04, 0.42);
  dir.visible(sobre, tSiete + 0.15, T12 + 0.5);
  dir.cada(tSiete + 0.15, T12 + 0.5, (T) => {
    const u = curva("power2.inOut")(tramo(T, tSiete + 0.15, tLlega));
    const pos = desde.clone().lerp(sobreFin, u);
    pos.y += Math.sin(u * Math.PI) * 0.7;
    sobre.position.copy(pos);
    sobre.rotation.set((1 - u) * 0.6, (1 - u) * 1.2 - 0.3, (1 - u) * 0.3);
    const asienta = Math.exp(-Math.pow((T - tLlega) / 0.08, 2));
    sobre.scale.set(1 + asienta * 0.06, 1 - asienta * 0.2, 1 + asienta * 0.06);
  });
  dir.blur(tSiete + 0.15, tLlega, 8);
  const c11 = capaToma(ctx, T11, T12 + 0.3);
  encabezado(ctx, c11, "06", "Déjalo corriendo", p("11", "dejas"), T12 - 0.15);
  const lun = $("div", "lun", c11);
  const lw = ["LUN", "7:00"].map((w) => { const m = $("span", "mascara", lun); const x = $("span", "palabra", m, w); lun.appendChild(document.createTextNode(" ")); return x; });
  entrar(tl, lw, tSiete, { escalon: 0.08 });
  ctx.dom(T11, T12 + 0.3, () => ctx.colocar(lun, ctx.proyectar(reloj.position.clone().add(new THREE.Vector3(0, -0.95, 0)))));
  salir(tl, lw, T12 - 0.15, { dy: -70 });
  const tarea = card(c11, 1220, 230, 600, 300, "tarea");
  const tc = $("div", "tarea-cab", tarea); $("span", "tarea-reloj", tc); $("span", "", tc, "LUN 7:00");
  $("div", "tarea-txt", tarea, "Cada lunes a las 7 de la mañana, toma el tablero de dirección y dime qué cambió contra la semana pasada, qué se salió de meta y qué decisión me toca. No mandes ningún correo.");
  const anilloT = $("div", "tarea-pulso", tarea);
  deslizar(tl, tarea, p("11", "corriendo") - 0.1, { dx: 80 });
  tl.fromTo(anilloT, { scale: 0.9, opacity: 0.9 }, { scale: 1.25, opacity: 0, duration: 0.7, ease: "power2.out" }, tSiete);
  tl.fromTo(tarea, { boxShadow: "0 0 0 0 rgba(0,160,219,0.0)" }, { boxShadow: "0 0 0 12px rgba(0,160,219,0.35)", duration: 0.25, yoyo: true, repeat: 1 }, tSiete);
  salir(tl, tarea, T12 - 0.15, { dy: -90 });

  // =================== 12 · practica y decide ===================
  dir.camara([
    { t: T12 + 0.1, pos: [2.5, 2.1, 8.6], mira: [-0.1, 1.2, 0.4], e: "power2.in" },
    { t: T12 + 1.4, pos: [1.5, y5 + 1.95, 9.6], mira: [1.3, y5 + 0.85, 1.4], e: "expo.out" },
    { t: p("12", "tuya.") + 0.3, pos: [1.25, y5 + 1.85, 9.1], mira: [1.3, y5 + 0.8, 1.4], e: "sine.inOut" },
    // cascada: retroceso al edificio completo
    { t: T13 - 0.6, pos: [19.2, -2.2, 42.5], mira: [-6.0, -7.3, 0], e: "expo.inOut" },
    { t: T13 + 0.2, pos: [18.9, -2.1, 41.8], mira: [-6.0, -7.25, 0], e: "sine.inOut" },
  ]);
  dir.blur(T12 + 0.1, T12 + 1.2, 12);
  dir.claves("foco", [{ t: T12 + 1.4, v: [2.4, y5 + 0.7, 2.0] }, { t: p("12", "tuya.") + 0.3, v: [2.4, y5 + 0.7, 2.0] }, { t: T13 - 0.6, v: [0, -6.6, 0.4], e: "expo.inOut" }]);
  dir.claves("rango", [{ t: T12 + 1.4, v: 3 }, { t: p("12", "tuya.") + 0.3, v: 3 }, { t: T13 - 0.6, v: 16, e: "expo.inOut" }]);
  const c12 = capaToma(ctx, T12, T13 + 0.3);
  encabezado(ctx, c12, "07", "Practica y decide", p("12", "Practicas"), T13 - 1.4);
  const tagM = $("div", "ancla izq", c12);
  Object.assign(tagM.style, { left: "78px", top: "190px" });
  const tagMp = $("span", "pildora", tagM, "Distribuidora · Morelia");
  pop(tl, tagMp, p("12", "empresa"), { desde: 0.7, y: 10 });
  salir(tl, tagMp, T13 - 1.4, { dy: -60 });
  // la lupa revisa los archivos de la empresa de práctica y clava tres marcadores rojos
  const hojas = [0, 1, 2].map((i) => {
    const h = card(c12, 96 + i * 230, 280 + (i % 2) * 30, 300, 360, "hoja-p");
    $("div", "hoja-p-cab", h);
    for (let k = 0; k < 9; k++) { const r = $("div", "hoja-p-fila", h); for (let j = 0; j < 3; j++) $("i", "", r); }
    deslizar(tl, h, p("12", "primero") + i * 0.1, { dx: -60 });
    return h;
  });
  const lupa = $("div", "lupa", c12);
  tl.fromTo(lupa, { x: 120, y: 360, opacity: 0, scale: 0.8 }, { x: 120, y: 360, opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }, p("12", "mentiras") - 0.2);
  tl.to(lupa, { x: 720, y: 420, duration: 1.35, ease: "sine.inOut" }, p("12", "mentiras"));
  const marcas = [["por debajo del costo", 180, 380], ["fórmula rota · mayo", 420, 470], ["pagado dos veces", 650, 420]];
  const tMarca = [p("12", "problemas"), p("12", "problemas") + 0.5, p("12", "reales…") + 0.3];
  marcas.forEach(([t, x, y], i) => {
    const a = $("div", "ancla", c12); Object.assign(a.style, { left: x + "px", top: y + "px" });
    const m = $("span", "marca-roja", a, t);
    pop(tl, m, tMarca[i], { desde: 0.4, y: -14 });
  });
  const tMatriz = p("12", "decides");
  salir(tl, [...hojas, lupa, ...c12.querySelectorAll(".marca-roja")], tMatriz - 0.45, { dx: -140, dy: 0 });
  // la matriz de decisión: cinco criterios con su peso
  const mat = card(c12, 96, 250, 760, 520, "matriz");
  $("div", "matriz-tit", mat, "Matriz de decisión");
  const filas = [["Lo que vale al mes", 30], ["Qué tan listo está el dato", 20], ["Qué tan fácil para el equipo", 20], ["Qué tan solo corre", 15], ["Qué tan poco duele", 15]];
  filas.forEach(([n, w], i) => {
    const r = $("div", "matriz-fila", mat); $("span", "", r, n);
    const pis = $("div", "matriz-pista", r); const br = $("div", "matriz-barra", pis);
    const v = $("span", "matriz-peso", r, String(w));
    const t = tMatriz + 0.1 + i * 0.13;
    tl.fromTo(r, { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.35, ease: "power3.out" }, t);
    tl.fromTo(br, { scaleX: 0 }, { scaleX: w / 30, duration: 0.6, ease: "expo.out", transformOrigin: "0% 50%" }, t + 0.05);
    contar(tl, v, t + 0.05, 0, w, 0.5);
  });
  deslizar(tl, mat, tMatriz - 0.15, { dx: -60 });
  salir(tl, mat, T13 - 1.4, { dx: -120, dy: 0 });
  // barras 3D sobre el piso de Marketing: el proyecto ganador sube y su piso se enciende
  const alturas = [0.95, 1.35, 1.95];
  const tGana = p("12", "primero", 2);
  const barras = alturas.map((h, i) => {
    const b = barra(i === 2 ? C.lima : C.azul);
    b.position.set(1.7 + i * 0.85, y5, 2.0);
    escena.add(b);
    dir.visible(b, tMatriz, T13 + 1);
    dir.cada(tMatriz, T13 + 1, (T) => {
      const u = curva("expo.out")(tramo(T, tMatriz + 0.5 + i * 0.12, tMatriz + 1.3 + i * 0.12));
      const extra = i === 2 ? curva("back.out(1.7)")(tramo(T, tGana, tGana + 0.6)) * 0.45 : 0;
      b.position.y = s.pisos[5].grupo.position.y;
      b.scale.set(1, Math.max(0.001, (h * 0.8) * u + extra), 1);
      if (i === 2) b.material.emissiveIntensity = curva("expo.out")(tramo(T, tGana, tGana + 0.5)) * 0.35;
    });
    return b;
  });
  // la cascada: los siete pisos se encienden, de arriba abajo, con su nombre
  const tCasc = T13 - 1.35;
  s.pisos.forEach((pi, i) => {
    pi.filo.material.emissive = C.cieloClaro.clone();
    const t0 = i === 5 ? p("12", "tuya.") : tCasc + i * 0.16;
    // la rutina cubre todo el video: antes de t0 el filo está apagado (sin historia entre cuadros)
    dir.cada(0, FIN + 0.01, (T) => {
      const k = curva("expo.out")(tramo(T, t0, t0 + 0.5));
      pi.filo.material.emissiveIntensity = k * 1.25;
      pi.losa.material.emissiveIntensity = k * 0.12;
    });
  });
  const capaCasc = $("div", "capa", raiz);
  tl.set(capaCasc, { autoAlpha: 0 }, 0); tl.set(capaCasc, { autoAlpha: 1 }, tCasc); tl.set(capaCasc, { autoAlpha: 0 }, T13 + 0.6);
  const etisC = PISOS.map((n, i) => { const a = $("div", "ancla izq", capaCasc); const pl = $("span", "pildora chica", a, n); pop(tl, pl, tCasc + 0.3 + i * 0.16, { desde: 0.6, y: 0 }); return a; });
  salir(tl, capaCasc.querySelectorAll(".pildora"), T13 + 0.1, { dy: -50 });
  ctx.dom(tCasc, T13 + 0.6, () => s.pisos.forEach((pi, i) => { const v = pi.ancla.clone(); v.y = pi.grupo.position.y - 0.21; ctx.colocar(etisC[i], ctx.proyectar(v)); }));

  // =================== 13 · lo que te llevas ===================
  const pBase = new THREE.Vector3(5.6, y4 - 0.4, 4.4);
  const base = new THREE.Group();
  const disco = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, 0.32, 64), barro(C.blanco));
  disco.castShadow = disco.receiveShadow = true;
  base.add(disco);
  base.position.copy(pBase);
  escena.add(base);
  dir.visible(base, T13 - 0.6, T14 + 1.2);
  dir.camara([
    { t: T13 + 0.25, pos: [18.9, -2.1, 41.8], mira: [-6.0, -7.25, 0] },
    { t: T13 + 1.5, pos: [8.6, pBase.y + 2.3, pBase.z + 6.4], mira: [pBase.x - 0.6, pBase.y + 0.9, pBase.z], e: "expo.out" },
    { t: T14 - 0.65, pos: [8.2, pBase.y + 2.25, pBase.z + 6.0], mira: [pBase.x - 0.6, pBase.y + 0.95, pBase.z], e: "sine.inOut" },
  ]);
  dir.blur(T13 + 0.25, T13 + 1.3, 12);
  dir.claves("foco", [{ t: T13 + 1.5, v: [pBase.x, pBase.y + 0.8, pBase.z] }]);
  dir.claves("rango", [{ t: T13 + 1.5, v: 3 }]);
  const entregables = [
    [libro(), p("13", "manual"), 0.16 + 0.12],
    [mazo(), p("13", "cincuenta"), 0.45 + 0.15],
    [cartucho(), p("13", "habilidades"), 0.62 + 0.15],
    [cartucho(), p("13", "habilidades") + 0.12, 0.62 + 0.15],
    [cartucho(), p("13", "habilidades") + 0.24, 0.62 + 0.15],
    [carpeta3d(), p("13", "listas") + 0.25, 0.75],
  ];
  entregables.forEach(([o, t0, alto], i) => {
    escena.add(o);
    const fin = pBase.clone().add(i >= 2 && i <= 4 ? new THREE.Vector3(-0.45 + (i - 2) * 0.45, alto + 0.3, 0.1) : i === 5 ? new THREE.Vector3(0.75, alto, -0.35) : new THREE.Vector3(0, alto, 0));
    dir.visible(o, t0 - 0.35, T14 + 1.2);
    dir.cada(t0 - 0.35, T14 + 1.2, (T) => {
      const caida = tramo(T, t0 - 0.35, t0);
      const rebote = curva("elastic.out(1, 0.5)")(tramo(T, t0, t0 + 0.6));
      o.position.copy(fin); o.position.y += (1 - curva("power2.in")(caida)) * 2.6;
      const aplasta = T >= t0 ? (1 - rebote) * 0.12 : 0;
      o.scale.set(1 + aplasta, Math.max(0.001, 1 - aplasta), 1 + aplasta);
      if (i >= 2 && i <= 4) { o.scale.multiplyScalar(0.55); o.rotation.set(-0.2, 0.3, 0); }
      if (i === 5) { o.rotation.set(0, -0.6, -0.12); o.scale.multiplyScalar(0.7); }
      if (i === 0) o.rotation.y = 0.35;
      if (i === 1) o.rotation.y = -0.2;
    });
  });
  const c13 = capaToma(ctx, T13, T14 + 0.4);
  const lista = $("div", "llevas", c13);
  const L = (cls) => $("div", "llevas-l " + (cls || ""), lista);
  const l1 = L(); l1.innerHTML = `<span class="mascara"><span class="palabra">El manual completo</span></span>`;
  const l2 = L(); l2.innerHTML = `<span class="mascara"><span class="palabra">+<span class="n50">0</span> prompts por área</span></span>`;
  const l3 = L(); l3.innerHTML = `<span class="mascara"><span class="palabra"><span class="n35">0</span> habilidades</span></span>`;
  const l4 = L(); l4.innerHTML = `<span class="mascara"><span class="palabra">Plantillas</span></span>`;
  const l5 = L("logos-l"); l5.innerHTML = `<span class="mascara"><span class="palabra">VADAI + Total Coach</span></span>`;
  const tL = [p("13", "manual"), p("13", "cincuenta"), p("13", "habilidades"), p("13", "listas") + 0.25, p("13", "VADAI")];
  [l1, l2, l3, l4, l5].forEach((l, i) => entrar(tl, l.querySelector(".palabra"), tL[i], { y: 100 }));
  contar(tl, l2.querySelector(".n50"), tL[1], 0, 50, 0.7);
  contar(tl, l3.querySelector(".n35"), tL[2], 0, 35, 0.7);
  const placa = $("div", "placa-logos", c13);
  placa.innerHTML = `<img src="./assets/marca/vadai-horizontal-recorte.png" class="logo-vadai" alt="VADAI"><img src="./assets/marca/totalcoach-recorte.png" class="logo-tc" alt="Total Coach">`;
  pop(tl, placa, p("13", "respaldo"), { desde: 0.7, y: 20 });
  salir(tl, [...lista.querySelectorAll(".palabra"), placa], T14 - 0.55, { dy: 120 });

  // =================== 14 · no te falta otra herramienta (subida 13→14) ===================
  dir.camara([
    { t: T14 - 0.6, pos: [8.2, pBase.y + 2.25, pBase.z + 6.0], mira: [pBase.x - 0.6, pBase.y + 0.95, pBase.z], e: "sine.inOut" },
    // subida continua: de los entregables, por la fachada encendida, hasta el escritorio
    { t: T14 + 1.6, pos: [4.2, 7.4, 12.6], mira: [0.15, -0.9, 0.3], e: "expo.inOut" },
    { t: T15 - 0.85, pos: [3.7, 7.0, 11.6], mira: [0.15, -0.8, 0.3], e: "sine.inOut" },
    { t: T15, pos: [0.7, 3.0, 3.6], mira: [0.15, 2.2, 0.3], e: "power3.in" },
  ]);
  dir.blur(T14 - 0.6, T14 + 1.6, 14);
  dir.blur(T15 - 0.85, T15, 14);
  dir.claves("foco", [{ t: T14 + 1.6, v: [0.2, 1.0, 0.3] }]);
  dir.claves("rango", [{ t: T14 + 1.6, v: 9 }]);
  dir.claves("fov", [{ t: 0, v: 30 }, { t: T14 - 0.6, v: 30 }, { t: T14 + 1.6, v: 40, e: "expo.inOut" }, { t: T15 - 0.85, v: 40 }, { t: T15, v: 30, e: "power3.in" }]);
  const c14 = capaToma(ctx, T14, T15);
  const tH = [["no", 1], ["te", 1], ["falta", 1], ["otra", 1], ["herramienta.", 1]].map(([w, n]) => p("14", w, n));
  const a14 = titular(c14, ["No te falta otra herramienta."], "tit tit-14 l1");
  a14.palabras.forEach((w, i) => entrar(tl, w, tH[i], { escalon: 0 }));
  const tM = [["Te", 2], ["falta", 2], ["un", 1], ["método.", 1]].map(([w, n]) => p("14", w, n));
  const b14 = titular(c14, ["Te falta un método."], "tit tit-14 l2");
  b14.palabras[3].classList.add("lima-sobre-claro");
  b14.palabras.forEach((w, i) => entrar(tl, w, tM[i], { escalon: 0 }));
  golpe(tl, raiz, "Método", tM[3], 0.5);
  salir(tl, [...a14.palabras, ...b14.palabras], T15 - 0.8, { dy: -80 });
  // el ciclo de 02 reaparece como un aro tenue y se disuelve en la chispa
  // aro propio (no el de 02): su opacidad no debe arrastrarse a otros cuadros
  const aro = ciclo(1.85);
  aro.traverse((o) => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.35; o.material.depthWrite = false; } });
  escena.add(aro);
  const tAro = tH[4] + 0.45, tChispa = tM[0] - 0.4;
  dir.visible(aro, tAro, tChispa + 0.25);
  const pAro = new THREE.Vector3(0.15, 2.35, 0.3);
  dir.cada(tAro, tChispa + 0.25, (T) => {
    const k = curva("expo.out")(tramo(T, tAro, tAro + 0.5));
    const c = curva("power3.in")(tramo(T, tChispa - 0.5, tChispa + 0.2));
    aro.position.copy(pAro);
    aro.rotation.z = -T * 0.4;
    aro.scale.setScalar(Math.max(0.001, k * (1 - c) * 0.85));

  });
  dir.visible(s.chispa, tChispa, T15 + 0.02);
  dir.cada(tChispa, T15 + 0.02, (T) => {
    const k = curva("expo.out")(tramo(T, tChispa, tChispa + 0.5));
    const cruce = curva("power3.in")(tramo(T, T15 - 0.55, T15));
    s.chispa.position.copy(pAro).lerp(new THREE.Vector3(0.66, 2.95, 3.45), cruce);
    s.chispa.scale.setScalar(Math.max(0.001, 0.22 * k * (1 + cruce)));
    s.chispa.rotation.z = T * 0.6;
    s.chispa.userData.luz.intensity = 6 * k + cruce * 30;
    s.chispa.userData.malla.material.emissiveIntensity = 1.3 + cruce * 6;
  });

  // =================== 15 · tarjeta final ===================
  const c15 = capaToma(ctx, T15, FIN + 1);
  c15.classList.add("final");
  const fondo = $("div", "final-fondo", c15);
  const tit = $("div", "titulo final-tit", c15);
  const fl1 = $("span", "tit-linea", tit);
  const mC = $("span", "mascara", fl1);
  const claude = $("span", "claude palabra", mC);
  const barraC = $("span", "barra", claude);
  claude.appendChild(document.createTextNode("Claude"));
  const ast = $("span", "palabra", fl1); ast.innerHTML = CHISPA_SVG();
  const fl2 = $("span", "tit-linea", tit);
  const ws2 = ["en", "tu", "Empresa"].map((w) => { const m = $("span", "mascara", fl2); const x = $("span", "palabra", m, w); fl2.appendChild(document.createTextNode(" ")); return x; });
  const tC = p("15", "Claude");
  // la chispa llega desde la lente y se asienta en el asterisco del título
  const grande = $("div", "chispa-grande", c15); grande.innerHTML = CHISPA_SVG("chispa-svg g");
  tl.fromTo(grande, { x: 0, y: 0, scale: 7, rotation: -40, opacity: 1, filter: "blur(10px)" }, { x: -298, y: -350, scale: 1, rotation: 0, opacity: 1, filter: "blur(0px)", duration: tC - T15 + 0.05, ease: "power3.inOut" }, T15);
  tl.set(grande, { autoAlpha: 0 }, tC + 0.06);
  tl.fromTo(ast, { opacity: 0 }, { opacity: 1, duration: 0.01 }, tC + 0.05);
  entrar(tl, claude, tC, { y: 105 });
  tl.fromTo(barraC, { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: "expo.out" }, tC + 0.1);
  ws2.forEach((w, i) => entrar(tl, w, p("15", ["en", "tu", "Empresa."][i]), { escalon: 0 }));
  const cta = $("div", "cta", c15);
  const ctaW = ["Inscribe", "a", "tu", "equipo"].map((w) => { const m = $("span", "mascara", cta); const x = $("span", "palabra", m, w); cta.appendChild(document.createTextNode(" ")); return x; });
  const flecha = $("span", "cta-flecha", cta);
  flecha.innerHTML = `<svg viewBox="0 0 40 52" aria-hidden="true"><path d="M20 4v38M6 28l14 16 14-16" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const tI = [p("15", "Inscribe"), p("15", "a"), p("15", "tu", 2), p("15", "equipo.")];
  ctaW.forEach((w, i) => entrar(tl, w, tI[i], { escalon: 0 }));
  tl.fromTo(flecha, { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "back.out(2.4)" }, tI[3] + 0.2);
  tl.to(flecha, { y: 10, duration: 0.3, yoyo: true, repeat: 1, ease: "sine.inOut" }, tI[3] + 0.8);
  const url = $("div", "url", c15, "claude-en-tu-empresa.vadai.com.mx");
  tl.fromTo(url, { opacity: 0, y: 16, filter: "blur(6px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.55, ease: "expo.out" }, tI[3] + 0.55);
  const placa15 = $("div", "placa-logos final-logos", c15);
  placa15.innerHTML = `<img src="./assets/marca/vadai-horizontal-recorte.png" class="logo-vadai" alt="VADAI"><span class="sep"></span><img src="./assets/marca/totalcoach-recorte.png" class="logo-tc" alt="Total Coach">`;
  pop(tl, placa15, tI[3] + 0.9, { desde: 0.85, y: 16 });
  ctx.tiempos = Object.assign(ctx.tiempos || {}, { tSiete, tLlega, tMarca, tMatriz, tGana, tCasc, tL, tH, tM, tC, tI, T15 });
}
