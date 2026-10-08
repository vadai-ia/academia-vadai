// v2 · 3D · 05–08 (28–49 s): el escritorio se llena → ¿cuánto depende de ti? → no te falta otra
// herramienta → te falta un MÉTODO. La cámara sale del punto «tú» al escritorio de noche; el silencio
// es una red que cuelga del escritorio; el golpe de MÉTODO abre (máscara) el mundo de día del cierre.
import * as THREE from "three";
import { $, titular, entrar, salir, ventana, golpe } from "../../estilo/ui.js";
import { hojaCopiandose, tarjeta } from "../../mundo/utileria.js";
import { curva, tramo, azar, C as COL } from "../../estilo/mundo.js";
import { LOGOS } from "../logos.js";
import { tarjetaLogo } from "./logos3d.js";
import { frase } from "./texto.js";

export function montar(ctx) {
  const { s, dir, tl, raiz, C, T, V, F, mundo, W, H } = ctx;
  const q = (h, v) => (V ? v : h);
  const esc = ctx.escena;
  const tCorte = C.mientras + 0.08;
  const fin06 = C.porque;
  const MESA = new THREE.Vector3(0, 1.05, 0.3);   // la cubierta del escritorio (piso de Dirección)

  // ---------------- 05 · de noche, el escritorio se llena ----------------
  // el punto «tú» llenó la pantalla: se disuelve en el escritorio
  const velo = $("div", "velo", raiz);
  tl.fromTo(velo, { opacity: 0 }, { opacity: 1, duration: 0.001 }, tCorte - 0.06);
  tl.fromTo(velo, { opacity: 1 }, { opacity: 0, duration: 0.5, ease: "power2.out", immediateRender: false }, tCorte + 0.02);
  dir.visible(s.pisos[0].grupo, tCorte, C.metodo + 0.5);
  dir.claves("luz", [{ t: tCorte - 0.001, v: 0.12 }, { t: tCorte, v: 0.62 }, { t: C.honesto, v: 0.62 }, { t: C.honesto + 0.6, v: 0.2, e: "power2.inOut" }]);
  dir.camara(V ? [
    { t: tCorte, pos: [0.5, 2.85, 6.4], mira: [0.05, 2.15, 0.2] },
    { t: C.escritorio, pos: [0.35, 2.7, 5.4], mira: [0.05, 2.05, 0.2], e: "sine.inOut" },
  ] : [
    { t: tCorte, pos: [2.9, 2.6, 5.6], mira: [-1.05, 1.5, 0.1] },
    { t: C.escritorio, pos: [2.4, 2.45, 4.7], mira: [-0.95, 1.45, 0.1], e: "sine.inOut" },
  ]);
  dir.claves("foco", [{ t: tCorte, v: [0.1, 1.6, 0.25] }]);
  dir.claves("rango", [{ t: tCorte, v: 4 }]);
  dir.claves("fov", [{ t: tCorte - 0.001, v: F(30) }, { t: tCorte, v: F(30) }]);
  // la hoja que se llena a mano, flotando sobre la laptop
  const hoja = hojaCopiandose();
  hoja.position.set(0.1, 2.2, 0.25);
  esc.add(hoja);
  const tHoja = tCorte + 0.45, tFuera = [C.honesto - 0.05, C.honesto + 0.5];
  dir.visible(hoja, tHoja, tFuera[1]);
  const tGolpe = C.escritorio + 0.05;
  dir.cada(tHoja, tFuera[1], (t) => {
    const k = curva("back.out(1.7)")(tramo(t, tHoja, tHoja + 0.5)), sale = curva("power2.in")(tramo(t, ...tFuera));
    const aplasta = Math.exp(-Math.pow((t - tGolpe - 0.06) / 0.07, 2)) * 0.12;
    hoja.scale.set(k * (1 - sale) * (1 + aplasta), Math.max(0.001, k * (1 - sale) * (1 - aplasta * 1.6)), 1);
    hoja.position.y = 2.2 - curva("power3.in")(tramo(t, tGolpe - 0.1, tGolpe)) * 0.5 + curva("expo.out")(tramo(t, tGolpe, tGolpe + 0.6)) * 0.5;
    hoja.userData.pintar(curva("power1.inOut")(tramo(t, C.reportes, C.mismas - 0.1)));
  });
  // «las mismas talachas»: copias de la hoja que caen apiladas en la mesa
  const copia = () => tarjeta(0.5, 0.34, (g, w, h) => {
    g.beginPath(); g.roundRect(0, 0, w, h, 20); g.fillStyle = "#FFFFFF"; g.fill();
    g.fillStyle = "#" + COL.azul.getHexString(); g.fillRect(14, 14, w - 28, 26);
    g.strokeStyle = "#" + COL.hueso.getHexString(); g.lineWidth = 4;
    for (let y = 60; y < h - 10; y += 34) { g.beginPath(); g.moveTo(14, y); g.lineTo(w - 14, y); g.stroke(); }
  }, { px: 300 });
  const r05 = azar(55);
  const copias = [];
  for (let n = 0; n < 10; n++) {
    const m = copia(); esc.add(m);
    const lado = n % 2 ? 1 : -1, nivel = Math.floor(n / 2);
    const t0 = C.talachas + n * 0.2;
    dir.visible(m, t0, tFuera[1]);
    copias.push({ m, t0, fin: new THREE.Vector3(lado * (0.95 + (r05() - 0.5) * 0.12), MESA.y + 0.02 + nivel * 0.03, 0.55 + (r05() - 0.5) * 0.15), rz: (r05() - 0.5) * 0.5 });
  }
  // «cada decisión…»: los avisos llegan de todos lados y se amontonan frente a la laptop
  const avisos = [];
  const PREGUNTAS = ["¿Lo autorizas?", "¿Cómo le hago?", "¿Me lo revisas?", "¿Qué precio le doy?", "¿Le das el visto bueno?", "Te espero para decidir"];
  const aviso = (txt) => tarjeta(1.5, 0.42, (g, w, h) => {
    g.beginPath(); g.roundRect(0, 0, w, h, h / 2); g.fillStyle = "#FFFFFF"; g.fill();
    g.beginPath(); g.arc(h / 2, h / 2, h * 0.28, 0, 7); g.fillStyle = "#" + COL.azul.getHexString(); g.fill();
    g.fillStyle = "#" + COL.navy.getHexString(); g.font = `500 ${Math.round(h * 0.4)}px Inter`; g.textBaseline = "middle"; g.fillText(txt, h * 0.95, h / 2 + 2);
  }, { r: 0.21 });
  for (let n = 0; n < C.avisos.length; n++) {
    const m = aviso(PREGUNTAS[n]); esc.add(m);
    const a = (n / C.avisos.length) * Math.PI * 2 + 0.6;
    avisos.push({ m, t0: C.avisos[n], desde: new THREE.Vector3(Math.cos(a) * 6, 1.8 + Math.sin(a) * 3.5, 1.5), hacia: new THREE.Vector3((r05() - 0.5) * 0.6, 1.25 + n * 0.17, 0.95), rz: (r05() - 0.5) * 0.3 });
    dir.visible(m, C.avisos[n] - 0.25, tFuera[1]);
  }
  dir.cada(C.talachas - 0.1, tFuera[1], (t) => {
    const cae = curva("power3.in")(tramo(t, tGolpe - 0.12, tGolpe)), rebote = Math.sin(tramo(t, tGolpe, tGolpe + 0.35) * Math.PI) * 0.05;
    const sale = curva("power2.in")(tramo(t, ...tFuera));
    for (const c of copias) {
      const u = curva("power3.out")(tramo(t, c.t0, c.t0 + 0.4));
      c.m.position.lerpVectors(hoja.position, c.fin, u);
      c.m.position.y += Math.sin(u * Math.PI) * 0.35 - sale * 0.4;
      c.m.rotation.set(-Math.PI / 2 * u, 0, c.rz * u);
      c.m.scale.setScalar(Math.max(0.001, (0.4 + 0.6 * u) * (1 - sale)));
    }
    for (const a of avisos) {
      const u = curva("power3.out")(tramo(t, a.t0 - 0.25, a.t0));
      a.m.position.lerpVectors(a.desde, a.hacia, u);
      a.m.position.y -= cae * (a.hacia.y - MESA.y - 0.05) - rebote;
      a.m.rotation.set(-cae * Math.PI / 2.3, 0, a.rz * u * (1 - cae));
      a.m.scale.setScalar(Math.max(0.001, 0.62 * (1 - sale)));
    }
  });
  dir.blur(C.decision - 0.3, tGolpe + 0.4, 8);
  ctx.sacudidas.push({ t: tGolpe, dur: 0.55, amp: 0.06 });
  // la cubierta del escritorio acusa el golpe
  const mueble = s.pisos[0].utileria;
  dir.cada(tGolpe - 0.05, tGolpe + 0.8, (t) => { const u = tramo(t, tGolpe, tGolpe + 0.7); mueble.scale.set(1, 1 - Math.sin(Math.min(1, u * 3) * Math.PI) * Math.exp(-u * 3) * 0.05, 1); });
  dir.cada(tGolpe + 0.8, tGolpe + 0.81, () => mueble.scale.set(1, 1, 1));
  // textos (navy liso detrás: no hace falta placa)
  const L = (h, v) => q(h, v);
  frase(ctx, L(["Mientras tanto…"], ["Mientras", "tanto…"]), [C.mientras + 0.1, T.w(5, "tanto,")], C.reportes - 0.35);
  frase(ctx, ["Reportes", "a mano"], [C.reportes, T.w(5, "a"), C.mano], C.mismas - 0.3);
  frase(ctx, ["Las mismas", "talachas"], [T.w(5, "las"), C.mismas, C.talachas], T.w(5, "cada") - 0.32);
  frase(ctx, ["Cada", "decisión…"], [T.w(5, "cada"), C.decision], C.termina - 0.28);
  frase(ctx, L(["Termina en", "tu escritorio."], ["Termina en", "tu", "escritorio."]), [C.termina, T.w(5, "en"), T.w(5, "tu", 2), C.escritorio], C.honesto - 0.1);

  // ---------------- 06 · «¿cuánto de tu empresa todavía depende de ti?» ----------------
  const foco = new THREE.SpotLight(0xfff4e6, 0, 12, 0.42, 0.55, 1.2);
  foco.position.set(0.2, 6.5, 1.0);
  foco.target.position.copy(MESA);
  esc.add(foco, foco.target);
  const nodos = [];
  const r06 = azar(66);
  const matHilo = () => new THREE.LineBasicMaterial({ color: COL.cieloClaro, transparent: true, opacity: 0 });
  const geoNodo = new THREE.SphereGeometry(0.075, 20, 12);
  for (let n = 0; n < 22; n++) {
    const a = (n / 22) * Math.PI * 2 + (r06() - 0.5) * 0.2, rr = q(3.0, 2.2) * (0.78 + r06() * 0.36);
    const p = new THREE.Vector3(Math.cos(a) * rr, MESA.y + 0.25 + Math.sin(a * 2 + 1) * 0.45 + (r06() - 0.5) * 0.5, 0.3 + Math.sin(a) * rr * 0.7);
    const m = new THREE.Mesh(geoNodo, new THREE.MeshBasicMaterial({ color: COL.hueso, toneMapped: false }));
    const geo = new THREE.BufferGeometry().setFromPoints([p.clone(), p.clone()]);
    const hilo = new THREE.Line(geo, matHilo());
    esc.add(m, hilo);
    nodos.push({ p, m, hilo, t0: C.cuanto + 0.05 + n * 0.055 });
    dir.visible(m, C.cuanto, C.falta + 0.5);
    dir.visible(hilo, C.cuanto, C.falta + 0.5);
  }
  const ANCLA = new THREE.Vector3(0, 1.35, 0.35);
  dir.cada(C.honesto - 0.05, C.falta + 0.5, (t) => {
    const ph = Math.max(0, t - C.cuanto);
    const lat = (Math.exp(-Math.pow(((ph % 1.25) - 0.05) / 0.06, 2)) + 0.6 * Math.exp(-Math.pow(((ph % 1.25) - 0.3) / 0.06, 2))) * tramo(t, C.cuanto, C.cuanto + 0.3);
    foco.intensity = (curva("power2.out")(tramo(t, C.honesto, C.honesto + 0.8)) * (1 - tramo(t, C.falta, C.metodo))) * (30 + lat * 22);
    const tension = curva("power2.inOut")(tramo(t, C.depende, C.ti)), suelta = curva("power2.in")(tramo(t, C.herramienta, C.herramienta + 0.6));
    for (const nd of nodos) {
      const u = curva("power3.out")(tramo(t, nd.t0, nd.t0 + 0.4)), hu = curva("power2.inOut")(tramo(t, nd.t0 + 0.1, nd.t0 + 0.6)) * (1 - suelta);
      const pos = nd.p.clone().lerp(ANCLA, tension * 0.16);
      pos.x += tension * 0.03 * Math.sin(t * 40 + nd.p.z * 10);
      nd.m.position.copy(pos);
      nd.m.scale.setScalar(Math.max(0.001, u * (1 - suelta)));
      const arr = nd.hilo.geometry.attributes.position.array;
      arr[0] = pos.x; arr[1] = pos.y; arr[2] = pos.z;
      arr[3] = pos.x + (ANCLA.x - pos.x) * hu; arr[4] = pos.y + (ANCLA.y - pos.y) * hu; arr[5] = pos.z + (ANCLA.z - pos.z) * hu;
      nd.hilo.geometry.attributes.position.needsUpdate = true;
      nd.hilo.material.opacity = hu > 0.01 ? 0.45 + tension * 0.4 + lat * 0.15 : 0;
    }
  });
  dir.camara(V ? [
    { t: C.honesto, pos: [0.35, 2.7, 5.4], mira: [0.05, 2.05, 0.2] },
    { t: C.honesto + 1.2, pos: [0.2, 5.0, 8.6], mira: [0, 2.6, 0.3], e: "power2.inOut" },
    { t: C.falta, pos: [-0.2, 4.6, 7.6], mira: [0, 2.5, 0.3], e: "sine.inOut" },
  ] : [
    { t: C.honesto, pos: [2.4, 2.45, 4.7], mira: [-0.95, 1.45, 0.1] },
    { t: C.honesto + 1.2, pos: [0.6, 4.4, 8.4], mira: [0, 2.2, 0.3], e: "power2.inOut" },
    { t: C.falta, pos: [-0.7, 4.0, 7.4], mira: [0, 2.1, 0.3], e: "sine.inOut" },
  ]);
  dir.claves("foco", [{ t: C.honesto + 1.2, v: ANCLA.toArray() }]);
  dir.claves("rango", [{ t: C.honesto + 1.2, v: 6 }]);
  frase(ctx, q(["¿Cuánto de tu empresa", "depende de ti?"], ["¿Cuánto de", "tu empresa", "depende de ti?"]),
    [C.cuanto, T.w(6, "de", 1), T.w(6, "tu"), T.w(6, "empresa"), C.depende, T.w(6, "de", 2), T.w(6, "ti?")], C.porque - 0.3, { cls: "tit-arriba" });

  // ---------------- 07 · «porque no te falta otra herramienta» ----------------
  const grises = LOGOS.filter((l) => l.id !== "claude").map((l, n) => {
    const m = tarjetaLogo(l.id, { lado: 0.5, gris: true }); esc.add(m);
    const a = (n / 13) * Math.PI * 2 + 0.2;
    dir.visible(m, C.porque, C.falta + 0.3);
    return { m, a, t0: C.porque + n * 0.045, vuela: 0.7 + (n % 4) * 0.25 };
  });
  dir.cada(C.porque - 0.05, C.falta + 0.3, (t) => {
    const sale = tramo(t, C.herramienta, C.herramienta + 0.65);
    for (const g of grises) {
      const u = curva("back.out(2)")(tramo(t, g.t0, g.t0 + 0.4));
      const rr = q(2.4, 1.9) + curva("power2.in")(sale) * 7 * g.vuela;
      const glitch = sale > 0 && sale < 0.35 ? Math.sin(t * 160 + g.a * 9) * 0.06 : 0;
      g.m.position.set(ANCLA.x + Math.cos(g.a + sale * 0.4) * rr + glitch, ANCLA.y + 0.45 + Math.sin(g.a + sale * 0.4) * rr * 0.42, ANCLA.z + 0.6);
      g.m.lookAt(mundo.camara.position);
      g.m.scale.setScalar(Math.max(0.001, u * (1 - curva("power2.in")(sale))));
    }
  });
  dir.blur(C.herramienta, C.herramienta + 0.7, 8);
  frase(ctx, q(["No te falta", "otra herramienta."], ["No te falta", "otra", "herramienta."]), [T.w(7, "no"), T.w(7, "te"), T.w(7, "falta"), T.w(7, "otra"), C.herramienta], C.falta - 0.26, { cls: "tit-arriba" });

  // ---------------- 08 · «te falta un MÉTODO» ----------------
  const cM = $("div", "capa", raiz);
  ventana(tl, cM, C.falta - 0.1, C.metodo);
  const tM = titular(cM, ["Te falta un"], "tit tit-centro sobre-navy chica2");
  ["te", "falta", "un"].forEach((w, i) => entrar(tl, tM.palabras[i], T.w(8, w), { escalon: 0, y: 100 }));
  dir.camara([{ t: C.metodo - 0.02, pos: q([-0.9, 3.6, 6.4], [-0.2, 4.0, 6.6]), mira: [0, 2.0, 0.3], e: "power2.in" }]);
  ctx.sacudidas.push({ t: C.metodo, dur: 0.4, amp: 0.05 });
  golpe(tl, raiz, "Método", C.metodo, 0.5);
  // máscara: al volver del golpe, MÉTODO es la ventana al mundo de día del cierre y crece hasta abrirlo
  const tV = C.metodo + 0.5;
  ctx.T_VENTANA = tV;
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "mascara-metodo");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const yM = V ? H / 2 + 170 : 700, fM = V ? 330 : 520, oX = V ? W / 2 - 250 : 560, oY = V ? H / 2 + 10 : 520;
  svg.innerHTML = `<defs><mask id="m-metodo" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/><text id="m-texto" x="${W / 2}" y="${yM}" text-anchor="middle" font-family="Anton" font-size="${fM}" fill="#000">MÉTODO</text></mask></defs><rect width="${W}" height="${H}" fill="var(--cieloHondo)" mask="url(#m-metodo)"/>`;
  raiz.appendChild(svg);
  tl.set(svg, { autoAlpha: 0 }, 0);
  tl.set(svg, { autoAlpha: 1 }, tV);
  tl.set(svg, { autoAlpha: 0 }, C.ramal);
  tl.fromTo(svg.querySelector("#m-texto"), { scale: 1, svgOrigin: `${oX} ${oY}` }, { scale: 28, svgOrigin: `${oX} ${oY}`, duration: C.ramal - tV, ease: "power3.in" }, tV);
  // detrás de la máscara ya es de día
  dir.claves("noche", [{ t: tV - 0.001, v: 1 }, { t: tV, v: 0 }]);
  dir.claves("luz", [{ t: tV - 0.001, v: 0.2 }, { t: tV, v: 1 }]);
  ctx.medio = { MESA, ANCLA, hoja };
}
