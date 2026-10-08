// Director: junta lo que cada toma declara (claves de cámara, foco, noche, visibilidad, motion
// blur, rutinas por cuadro) en una sola película continua. Todo es función de T (segundos del
// master); el orden de los seeks no importa (ERRORES E4).
import * as THREE from "three";
import { pista, clamp01 } from "../estilo/mundo.js";

export function crearDirector(mundo) {
  const canales = { pos: [], mira: [], foco: [], rango: [], noche: [], fov: [], luz: [] };
  const visibles = [];   // { obj, desde, hasta }
  const rutinas = [];    // { desde, hasta, fn(T, local) }
  const extras = [];     // { desde, hasta, n } muestras de obturador forzadas (objetos rápidos)
  let pistas = null;

  const d = {
    // claves: [{ t, v, e }]; se pueden declarar en cualquier orden desde cualquier toma
    claves(canal, ks) { canales[canal].push(...ks); pistas = null; },
    camara(ks) { for (const k of ks) { if (k.pos) d.claves("pos", [{ t: k.t, v: k.pos, e: k.e }]); if (k.mira) d.claves("mira", [{ t: k.t, v: k.mira, e: k.e }]); } },
    visible(obj, desde, hasta) { visibles.push({ obj, desde, hasta }); },
    cada(desde, hasta, fn) { rutinas.push({ desde, hasta, fn }); },
    blur(desde, hasta, n) { extras.push({ desde, hasta, n }); },
    preparar() {
      pistas = {};
      for (const [k, v] of Object.entries(canales)) {
        const orden = [...v].sort((a, b) => a.t - b.t);
        pistas[k] = orden.length ? pista(orden) : null;
      }
      // un objeto con varias ventanas se ve si cae en cualquiera
      const porObj = new Map();
      for (const w of visibles) { if (!porObj.has(w.obj)) porObj.set(w.obj, []); porObj.get(w.obj).push(w); }
      d._vis = [...porObj.entries()];
    },
    aplicar(T) {
      if (!pistas) d.preparar();
      const cam = mundo.camara;
      cam.position.fromArray(pistas.pos(T));
      cam.lookAt(tmp.fromArray(pistas.mira(T)));
      if (pistas.fov) { const f = pistas.fov(T); if (cam.fov !== f) { cam.fov = f; cam.updateProjectionMatrix(); } }
      for (const [obj, ws] of d._vis) obj.visible = ws.some((w) => T >= w.desde && T < w.hasta);
      for (const r of rutinas) if (T >= r.desde - 1e-6 && T < r.hasta) r.fn(T, T - r.desde);
      if (mundo.fondo && pistas.noche) mundo.fondo.material.uniforms.noche.value = clamp01(pistas.noche(T));
      if (pistas.luz) mundo.luz(clamp01(pistas.luz(T)));
    },
    enfoque(T) {
      return { punto: tmp2.fromArray(pistas.foco(T)), rango: pistas.rango(T) };
    },
    // muestras del obturador: cuánto barre la cámara en este cuadro (+ extras declarados)
    muestras(T) {
      const h = 1 / 120;
      a0.fromArray(pistas.pos(T - h)); a1.fromArray(pistas.pos(T + h));
      b0.fromArray(pistas.mira(T - h)); b1.fromArray(pistas.mira(T + h));
      const dist = Math.max(2, a1.distanceTo(b1));
      // desplazamiento angular aproximado del encuadre en este cuadro
      const ang = (a0.distanceTo(a1) + b0.distanceTo(b1) * 0.6) / dist;
      let n = Math.ceil(ang * 520);
      for (const x of extras) if (T >= x.desde && T < x.hasta) n = Math.max(n, x.n);
      return Math.max(1, Math.min(16, n));
    },
  };
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const a0 = new THREE.Vector3(), a1 = new THREE.Vector3(), b0 = new THREE.Vector3(), b1 = new THREE.Vector3();
  return d;
}
