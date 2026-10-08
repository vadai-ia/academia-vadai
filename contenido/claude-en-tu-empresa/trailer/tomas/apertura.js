// 01–04 · El problema. Negro → la chispa → el escritorio enterrado en el ciclo de herramientas →
// 6 de 100 → «no es la herramienta, es el método». Termina en la transición héroe 04→05:
// la palabra MÉTODO se vuelve la ventana al título.
import * as THREE from "three";
import { $, titular, entrar, salir, ventana, golpe } from "../estilo/ui.js";
import { titulares, caos, hojaCopiandose, ciclo, puntos } from "../mundo/utileria.js";
import { curva, tramo, azar } from "../estilo/mundo.js";

export function montar(ctx) {
  const { s, dir, tl, raiz, p, B, beat } = ctx;
  const T01 = 0, T02 = B(2), T03 = B(6), T04 = B(8), T05 = B(10);
  const centro = new THREE.Vector3(0, 1.55, 0.3);
  const chispa = s.chispa;
  // 04: el golpe cae en «método» y al volver la palabra ya es ventana al mundo de 05
  const tGolpe = p("04", "método."), tVentana = tGolpe + 0.5;
  ctx.T_VENTANA_04 = tVentana;

  // ---------------- 01 · negro, la chispa, titulares que cruzan la lente ----------------
  const P_CHISPA = new THREE.Vector3(0, 1.75, 4.2);
  const ENCENDIDO = beat(0.45); // primer pulso de la canción
  dir.claves("noche", [{ t: 0, v: 1 }, { t: T02 - 0.05, v: 1 }, { t: T02 + 0.65, v: 0.28, e: "power2.out" }, { t: T03 + 0.1, v: 0.28 }, { t: T03 + 0.55, v: 1, e: "power2.inOut" }, { t: tVentana - 0.001, v: 1 }, { t: tVentana, v: 0 }]);
  dir.claves("luz", [{ t: 0, v: 0.15 }, { t: T02 - 0.05, v: 0.15 }, { t: T02 + 0.5, v: 0.85, e: "power2.out" }, { t: T03 + 0.1, v: 0.85 }, { t: T03 + 0.6, v: 0.12, e: "power2.inOut" }, { t: tVentana - 0.001, v: 0.12 }, { t: tVentana, v: 1 }]);
  dir.camara([
    { t: 0, pos: [0, 1.8, 9.6], mira: [0, 1.75, 4.2] },
    { t: 3.9, pos: [0.15, 1.82, 9.0], mira: [0, 1.75, 4.2], e: "sine.inOut" },
    // la pose de 01 se sostiene hasta el corte: sin esta clave la cámara ya se deslizaba hacia 02
    { t: T02 - 0.001, pos: [0.15, 1.82, 9.0], mira: [0, 1.75, 4.2] },
  ]);
  dir.claves("foco", [{ t: 0, v: P_CHISPA.toArray() }]);
  dir.claves("rango", [{ t: 0, v: 3 }]);
  dir.visible(chispa, 0, T02 + 0.05);
  for (const n of s.nubes) { dir.visible(n, T02, T03 + 0.6); dir.visible(n, tVentana, 999); }
  dir.cada(0, T02 + 0.05, (T) => {
    // enciende en el pulso, late una vez, respira; al final cruza la lente (spark-pass)
    const k = curva("expo.out")(tramo(T, ENCENDIDO - 0.05, ENCENDIDO + 0.5));
    const latido = Math.exp(-Math.pow((T - (ENCENDIDO + 0.6)) / 0.18, 2)) * 0.35;
    const cruce = curva("power3.in")(tramo(T, T02 - 0.55, T02));
    // cruza la lente sin pasar detrás de la cámara (0.4 delante): el destello limpia el cuadro hacia 02
    chispa.position.copy(P_CHISPA).lerp(new THREE.Vector3(0.134, 1.813, 8.5), cruce); // sobre el eje cámara→mira
    chispa.scale.setScalar((0.001 + k * 0.42 + latido) * (1 + cruce * 2.8));
    chispa.rotation.z = T * 0.35;
    chispa.rotation.y = Math.sin(T * 0.8) * 0.3;
    chispa.userData.luz.intensity = (k + latido) * 6 + cruce * 30;
    chispa.userData.malla.material.emissiveIntensity = 1.2 + latido * 3 + cruce * 6;
  });
  dir.blur(T02 - 0.6, T02 + 0.05, 14);
  // titulares inventados (genéricos, sin marcas) que pasan junto a la lente y se van
  const tars = titulares();
  const r01 = azar(101);
  tars.forEach((m, i) => {
    ctx.escena.add(m);
    const t0 = 1.45 + i * 0.36, t1 = t0 + 1.05;
    const lado = i % 2 ? 1 : -1;
    const x = lado * (0.9 + r01() * 1.3), y = 1.75 + (r01() - 0.5) * 1.6;
    dir.visible(m, t0, t1);
    dir.cada(t0, t1, (T) => {
      const u = curva("power2.in")(tramo(T, t0, t1));
      m.position.set(x * (0.5 + u * 1.6), y + (y - 1.75) * u, -6 + u * 15.8);
      m.rotation.set(0.06 * lado, -0.18 * lado * u, 0.05 * lado);
    });
  });
  dir.blur(1.4, 4.0, 10);

  // ---------------- 02 · el escritorio enterrado y el ciclo de herramientas ----------------
  const anillo = ciclo(1.85);
  anillo.position.copy(centro);
  ctx.escena.add(anillo);
  const items = caos();
  items.forEach((it) => ctx.escena.add(it.obj));
  const hoja = hojaCopiandose();
  ctx.escena.add(hoja);
  // giro que acelera cada vuelta: θ(t) = ω0·t + ½·α·t²
  const giro = (T) => { const u = Math.max(0, T - T02); return 0.38 * u + 0.055 * u * u; };
  const L = [beat(5.9), beat(7.7), beat(9.5)]; // los tres tramos del ciclo, uno por frase
  dir.camara([
    { t: T02, pos: [3.0, 2.55, 9.4], mira: [0, 1.5, 0.2] },
    { t: T03 - 0.2, pos: [-1.2, 2.3, 8.6], mira: [0, 1.55, 0.2], e: "sine.inOut" },
  ]);
  dir.claves("foco", [{ t: T02, v: [0, 1.5, 0.4] }]);
  dir.claves("rango", [{ t: T02, v: 6 }]);
  // el escritorio vive en el piso 0; en 01 todavía no existe (negro)
  dir.visible(s.pisos[0].grupo, T02, T03 + 0.6);
  dir.visible(s.pisos[0].grupo, tVentana, 999);
  for (let i = 1; i < s.pisos.length; i++) dir.visible(s.pisos[i].grupo, T05, 999);
  dir.visible(anillo, T02, T03 + 0.75);
  anillo.userData.arcos.forEach((a, i) => {
    dir.visible(a, L[i], T03 + 0.75);
  });
  dir.cada(T02, T03 + 0.75, (T) => {
    const th = giro(Math.min(T, T03));
    anillo.rotation.z = -th;
    anillo.userData.arcos.forEach((a, i) => {
      const k = curva("back.out(2.2)")(tramo(T, L[i], L[i] + 0.45));
      a.scale.setScalar(Math.max(0.001, k));
    });
    // colapso 02→03: el anillo se encoge a un punto mientras nacen los cien puntos
    const c = curva("power3.in")(tramo(T, T03 - 0.05, T03 + 0.6));
    anillo.scale.setScalar(Math.max(0.001, 1 - c));
  });
  items.forEach((it, i) => {
    const n = items.length;
    const fase = (i / n) * Math.PI * 2;
    const r = 1.85 + (i % 3 - 1) * 0.24;
    const z = (i % 2 ? 0.5 : -0.3);
    const tAviso = it.tipo === "aviso" ? beat(10.9 + (i - n + 2) * 0.6) : T02;
    dir.visible(it.obj, tAviso, T03 + 0.6);
    dir.cada(tAviso, T03 + 0.6, (T) => {
      const th = giro(Math.min(T, T03)) + fase;
      const c = curva("power3.in")(tramo(T, T03 - 0.05, T03 + 0.55));
      const pop = it.tipo === "aviso" ? curva("back.out(2.4)")(tramo(T, tAviso, tAviso + 0.4)) : 1;
      it.obj.position.set(centro.x + Math.cos(th) * r * (1 - c), centro.y + Math.sin(th) * r * 0.82 * (1 - c), centro.z + z * (1 - c));
      it.obj.rotation.set(0.05 * Math.sin(th * 2), 0.25 * Math.cos(th), Math.sin(th) * 0.12);
      it.obj.scale.setScalar(Math.max(0.001, pop * (1 - c) * 0.95));
    });
  });
  // la hoja que alguien llena a mano, celda por celda, en primer plano
  const tHoja0 = p("02", "sigue"), tHoja1 = T03 - 0.4;
  dir.visible(hoja, tHoja0 - 0.3, T03 + 0.1);
  dir.cada(tHoja0 - 0.3, T03 + 0.1, (T) => {
    const e = curva("expo.out")(tramo(T, tHoja0 - 0.3, tHoja0 + 0.4));
    const sale = curva("power2.in")(tramo(T, T03 - 0.3, T03 + 0.1));
    hoja.position.set(-2.1 - sale * 1.5, 1.15, 3.1);
    hoja.rotation.set(-0.08, 0.38, 0.02);
    hoja.scale.setScalar(Math.max(0.001, e));
    hoja.userData.pintar(curva("none")(tramo(T, tHoja0, tHoja1)));
  });
  // etiquetas del ciclo (OST), sobre la mitad de cada arco
  const capa02 = $("div", "capa", raiz);
  ventana(tl, capa02, T02, T03 + 0.35);
  const textos = ["Sale una herramienta nueva", "La prueban a su manera", "Sale otra"];
  const etis = textos.map((t, i) => {
    const e = $("div", "eti-ciclo", capa02);
    $("span", "pildora", e, t);
    tl.fromTo(e.firstChild, { scale: 0.7, opacity: 0, filter: "blur(8px)" }, { scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.45, ease: "back.out(2)" }, L[i]);
    return e;
  });
  // flechas «→» entre etiquetas: parte del OST «… → … → …»
  const flechas = [0, 1].map((i) => { const f = $("div", "eti-flecha", capa02, "→"); tl.fromTo(f, { opacity: 0 }, { opacity: 1, duration: 0.3 }, L[i + 1] - 0.1); return f; });
  tl.to(capa02.children, { scale: 0.2, opacity: 0, filter: "blur(10px)", duration: 0.35, ease: "power3.in" }, T03 - 0.05);
  ctx.dom(T02, T03 + 0.35, (T) => {
    anillo.updateMatrixWorld(true);
    // sobre el arco, sin salir de la zona segura (90 % del cuadro, fuera del 15 % de abajo)
    const seguro = (q) => ({ x: Math.min(1824 - 200, Math.max(96 + 200, q.x)), y: Math.min(880, Math.max(80, q.y)) });
    const en = (i) => seguro(ctx.proyectar(anillo.userData.arcos[i].localToWorld(anillo.userData.arcos[i].userData.medio.clone())));
    const ps = [0, 1, 2].map(en);
    etis.forEach((e, i) => ctx.colocar(e, ps[i]));
    flechas.forEach((f, i) => ctx.colocar(f, { x: (ps[i].x + ps[i + 1].x) / 2, y: (ps[i].y + ps[i + 1].y) / 2 }));
  });

  // ---------------- 03 · seis de cada cien (transición héroe 02→03) ----------------
  const grid = puntos();
  grid.position.set(2.0, 1.7, 3.4);
  grid.scale.setScalar(0.92);
  ctx.escena.add(grid);
  const tGrid = T03 + 0.05, tSeis = p("03", "100") + 0.15;
  const elegido = grid.userData.lista[44];
  dir.visible(grid, tGrid, T04);
  dir.cada(tGrid, T04, (T) => {
    grid.userData.lista.forEach((m, i) => {
      const r = Math.floor(i / 10), c = i % 10;
      const d = Math.hypot(r - 4.5, c - 4.5);
      const k = curva("back.out(1.8)")(tramo(T, tGrid + d * 0.07, tGrid + d * 0.07 + 0.45));
      m.position.copy(m.userData.base).multiplyScalar(0.25 + 0.75 * k);
      const enc = m.userData.encendido ? curva("expo.out")(tramo(T, tSeis + [23, 37, 44, 58, 66, 71].indexOf(i) * 0.11, tSeis + 0.4 + [23, 37, 44, 58, 66, 71].indexOf(i) * 0.11)) : 0;
      m.scale.setScalar(Math.max(0.001, k * (1 + enc * 0.35)));
      if (m.userData.encendido) m.material.emissiveIntensity = 0.1 + enc * 2.2;
    });
  });
  const pElegido = elegido.userData.base.clone().multiplyScalar(0.92).add(grid.position);
  dir.camara([
    { t: T03, pos: [-1.2, 2.3, 8.6], mira: [0, 1.55, 0.2] },
    { t: T03 + 0.6, pos: [0.4, 1.75, 13.6], mira: [0.4, 1.7, 3.4], e: "power2.out" },
    { t: tSeis + 0.9, pos: [0.45, 1.72, 13.2], mira: [0.45, 1.7, 3.4], e: "sine.inOut" },
    // empuje decidido hacia un punto encendido; se detiene en seco con la música (04)
    { t: T04, pos: [pElegido.x + 0.05, pElegido.y + 0.02, pElegido.z + 1.35], mira: pElegido.toArray(), e: "power2.in" },
    { t: tVentana - 0.001, pos: [pElegido.x + 0.05, pElegido.y + 0.02, pElegido.z + 1.35], mira: pElegido.toArray() },
  ]);
  dir.claves("foco", [{ t: T03 + 0.3, v: [0, 1.7, 3.4] }, { t: T04, v: pElegido.toArray(), e: "power2.in" }]);
  dir.claves("rango", [{ t: T03 + 0.3, v: 4 }, { t: T04, v: 1.2 }]);
  const capa03 = $("div", "capa", raiz);
  ventana(tl, capa03, T03, T04);
  const cifra = $("div", "cifra", capa03);
  const seis = $("span", "cifra-num", cifra, "6");
  const de100 = $("span", "cifra-de", cifra, " de 100");
  const fuente = $("div", "fuente", capa03, "McKinsey, The State of AI 2026");
  entrar(tl, seis, p("03", "6"), { y: 60 });
  entrar(tl, de100, p("03", "100"), { y: 60 });
  tl.fromTo(fuente, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, ease: "expo.out" }, p("03", "100") + 0.2);
  salir(tl, [seis, de100], T04 - 0.32, { dx: -80, dy: 0 });
  // fuente visible mientras la cifra está en pantalla (brief: la fuente acompaña al 6 %)
  tl.to(fuente, { opacity: 0, duration: 0.2 }, T04 - 0.1);

  // ---------------- 04 · no es la herramienta, es el método ----------------
  const capa04 = $("div", "capa", raiz);
  ventana(tl, capa04, T04, T05 + 0.05);
  const t1 = titular(capa04, ["No es la herramienta."], "tit tit-04 l1");
  const t2 = titular(capa04, ["Es el método."], "tit tit-04 l2");
  t2.palabras[2].classList.add("lima");
  const ws04 = [["no", 1], ["es", 1], ["la", 2], ["herramienta.", 1]].map(([w, n]) => p("04", w, n));
  t1.palabras.forEach((w, i) => entrar(tl, w, ws04[i], { escalon: 0 }));
  [p("04", "Es", 2), p("04", "el"), p("04", "método.")].forEach((t, i) => entrar(tl, t2.palabras[i], t, { escalon: 0 }));
  // tarjeta de golpe en «método» (C2, C11): azul hondo a sangre, MÉTODO en lima
  golpe(tl, raiz, "Método", tGolpe, 0.5);
  // máscara: al volver del golpe, MÉTODO es la ventana al mundo de 05 y crece hasta abrirlo
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "mascara-metodo");
  svg.setAttribute("viewBox", "0 0 1920 1080");
  svg.innerHTML = `<defs><mask id="m-metodo" maskUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080"><rect width="1920" height="1080" fill="#fff"/><text id="m-texto" x="960" y="700" text-anchor="middle" font-family="Anton" font-size="520" fill="#000">MÉTODO</text></mask></defs><rect width="1920" height="1080" fill="var(--navy)" mask="url(#m-metodo)"/>`;
  raiz.appendChild(svg);
  tl.set(svg, { autoAlpha: 0 }, 0);
  tl.set(svg, { autoAlpha: 1 }, tVentana);
  tl.set(svg, { autoAlpha: 0 }, T05);
  tl.set([t1, t2], { autoAlpha: 0 }, tGolpe);
  // zoom hacia el trazo izquierdo de la M: la pantalla se llena de «agujero» y aparece el título
  tl.fromTo(svg.querySelector("#m-texto"), { scale: 1, svgOrigin: "560 520" }, { scale: 26, svgOrigin: "560 520", duration: T05 - tVentana, ease: "power3.in" }, tVentana);
  ctx.items02 = items;
  ctx.anillo02 = anillo;
}
