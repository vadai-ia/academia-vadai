// 05 · «Esto es Claude en tu Empresa». La chispa entra a CLAUDE, el título se arma, el caos de 02
// se ordena dentro de una sola ventana de Claude y la cámara retrocede: el escritorio es el
// piso de arriba de un edificio de siete pisos sobre nubes. La vara de calidad es la prueba 0b.
import * as THREE from "three";
import { $, entrar, salir, pop, CHISPA_SVG } from "../estilo/ui.js";
import { curva, tramo } from "../estilo/mundo.js";
import { PISOS } from "../mundo/escena.js";

export async function montar(ctx) {
  const { s, dir, tl, raiz, p, B, beat } = ctx;
  const T05 = B(10), T06 = B(14), tV = ctx.T_VENTANA_04;
  const ventanaC = s.ventana;
  const chispa = s.chispa;

  // ---------- cámara: arranque cerca de la ventana → retroceso con rampa (0b) ----------
  const tAtras = p("05", "tu", 2) - 0.1;              // «tu equipo aprende…»
  const tAterriza = p("05", "días.") + 0.1;
  dir.camara([
    { t: tV, pos: [1.05, 2.5, 6.1], mira: [-1.2, 2.25, 0.2] },
    { t: T05, pos: [1.0, 2.48, 5.9], mira: [-1.15, 2.25, 0.2], e: "sine.out" },
    { t: tAtras, pos: [0.85, 2.43, 5.35], mira: [-1.15, 2.25, 0.2], e: "sine.inOut" },  // anticipación: empuje corto
    { t: tAtras + 0.5, pos: [3.3, 2.0, 10.3], mira: [-1.6, 1.5, 0.1], e: "power2.in" },
    { t: tAterriza, pos: [19.2, -2.2, 42.5], mira: [-6.0, -7.3, 0], e: "expo.out" },
    { t: T06 - 0.05, pos: [18.8, -2.05, 41.6], mira: [-5.95, -7.2, 0], e: "sine.inOut" }, // la cámara sigue viva
  ]);
  dir.claves("foco", [{ t: tV, v: [0.1, 2.25, 0.2] }, { t: tAtras + 0.5, v: [0.1, 1.6, 0.2], e: "power2.in" }, { t: tAterriza, v: [0, -6.6, 0.4], e: "expo.out" }]);
  dir.claves("rango", [{ t: tV, v: 2.6 }, { t: tAterriza, v: 16, e: "expo.out" }]);

  // ---------- la chispa vuela desde el fondo y aterriza en el asterisco del título ----------
  const tLlega = p("05", "Claude", 1);
  dir.visible(chispa, tV, tLlega);
  dir.cada(tV, tLlega, (T) => {
    const u = curva("power2.inOut")(tramo(T, tV, tLlega));
    // de lo hondo del cielo a la posición del asterisco (arriba a la izquierda, cerca de cámara)
    const a = new THREE.Vector3(-2.6, 3.2, -6), b = new THREE.Vector3(-0.42, 2.98, 3.6);
    chispa.position.copy(a).lerp(b, u);
    chispa.position.y += Math.sin(u * Math.PI) * 0.6;
    chispa.scale.setScalar(0.18 + u * 0.12);
    chispa.rotation.z = T * 2.2;
    chispa.userData.luz.intensity = 8;
    chispa.userData.malla.material.emissiveIntensity = 1.6;
  });
  dir.blur(tV, tLlega, 8);

  // ---------- título ----------
  const capa = $("div", "capa", raiz);
  tl.set(capa, { autoAlpha: 0 }, 0);
  tl.set(capa, { autoAlpha: 1 }, T05 - 0.3);
  tl.set(capa, { autoAlpha: 0 }, T06 + 0.6);
  const tit = $("div", "titulo", capa);
  const l1 = $("span", "tit-linea", tit);
  const mC = $("span", "mascara", l1);
  const claude = $("span", "claude palabra", mC);
  const barra = $("span", "barra", claude);
  claude.appendChild(document.createTextNode("Claude"));
  const ast = $("span", "palabra", l1);
  ast.innerHTML = CHISPA_SVG();
  const l2 = $("span", "tit-linea", tit);
  const ws2 = ["en", "tu", "Empresa"].map((w) => { const m = $("span", "mascara", l2); const x = $("span", "palabra", m, w); l2.appendChild(document.createTextNode(" ")); return x; });
  entrar(tl, claude, tLlega - 0.05, { y: 105 });
  tl.fromTo(barra, { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: "expo.out" }, tLlega + 0.1);
  // el asterisco nace donde aterrizó la chispa 3D: escala desde grande y gira hasta asentarse
  tl.fromTo(ast, { scale: 1.8, rotation: -120, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 0.6, ease: "back.out(1.7)" }, tLlega);
  ws2.forEach((w, i) => entrar(tl, w, p("05", ["en", "tu", "Empresa:"][i], 1), { escalon: 0 }));
  // el título respira con la cámara (plano frontal: paralaje más rápido que el mundo)
  tl.fromTo(tit, { y: 0, scale: 1 }, { y: -12, scale: 0.985, duration: T06 - tAtras, ease: "power2.inOut" }, tAtras);

  // chips en sus palabras
  const chips = $("div", "chips", capa);
  const nombres = [["Excel", "Excel,"], ["Word", "Word"], ["Correo", "correo"]];
  nombres.forEach(([n, w], i) => {
    if (i) { const pt = $("span", "punto", chips, "·"); tl.fromTo(pt, { opacity: 0 }, { opacity: 1, duration: 0.2 }, p("05", w) - 0.05); }
    const c = $("span", "pildora", chips, n);
    pop(tl, c, p("05", w));
  });
  // salida de 05: el título y los chips se empujan hacia arriba con la cámara que baja a 06
  salir(tl, [tit, chips], T06 - 0.1, { dy: -90 });

  // ---------- el caos de 02 se ordena dentro de la ventana de Claude ----------
  const tOrden0 = p("05", "Empresa:") - 0.2, tOrden1 = tOrden0 + 0.95;
  const destino = ventanaC.position.clone();
  ctx.items02.forEach((it, i) => {
    dir.visible(it.obj, tV, tOrden1);
    const a = (i / ctx.items02.length) * Math.PI * 2;
    const desde = new THREE.Vector3(destino.x + Math.cos(a) * 3.4, destino.y + Math.sin(a) * 2.1, destino.z + 0.6 + (i % 2) * 0.5);
    dir.cada(tV, tOrden1, (T) => {
      const u = curva("power3.inOut")(tramo(T, tOrden0 + i * 0.03, tOrden1 - 0.1 + i * 0.01));
      it.obj.position.copy(desde).lerp(destino, u);
      it.obj.rotation.set(0, 0, (1 - u) * Math.sin(a) * 0.4);
      it.obj.scale.setScalar(Math.max(0.001, 0.85 * (1 - u * 0.9)));
    });
  });
  dir.blur(tOrden0, tOrden1, 8);
  dir.visible(ventanaC, tOrden1 - 0.25, T06 + 0.7);
  dir.cada(tOrden1 - 0.25, T06 + 0.7, (T) => {
    const k = curva("back.out(1.6)")(tramo(T, tOrden1 - 0.25, tOrden1 + 0.35));
    const sale = curva("power2.in")(tramo(T, T06 + 0.2, T06 + 0.7));
    ventanaC.scale.setScalar(Math.max(0.001, k * (1 - sale)));
  });

  // ---------- etiquetas de piso: entran de arriba abajo conforme la cámara las descubre ----------
  const capaPisos = $("div", "capa", raiz);
  tl.set(capaPisos, { autoAlpha: 0 }, 0);
  tl.set(capaPisos, { autoAlpha: 1 }, T05);
  tl.set(capaPisos, { autoAlpha: 0 }, T06 + 0.5);
  const tPisos = p("05", "Word") - 0.1;
  const etis = PISOS.map((n, i) => {
    const a = $("div", "ancla izq", capaPisos);
    const pl = $("span", "pildora chica", a, n);
    tl.fromTo(pl, { opacity: 0, x: 14, filter: "blur(6px)" }, { opacity: 1, x: 0, filter: "blur(0px)", duration: 0.45, ease: "power3.out" }, tPisos + i * 0.22);
    return a;
  });
  salir(tl, capaPisos.querySelectorAll(".pildora"), T06 - 0.1, { dy: -60 });
  ctx.dom(T05, T06 + 0.5, () => {
    s.pisos.forEach((pi, i) => {
      const v = pi.ancla.clone(); v.y = pi.grupo.position.y - 0.21;
      ctx.colocar(etis[i], ctx.proyectar(v));
    });
  });
  ctx.etiquetasPisos = etis;
}
