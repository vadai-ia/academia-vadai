// v2 · 3D · tarjetas con los logos de herramientas de IA (v2/logos.js). Blancas, logo navy; Claude en
// durazno (el durazno es solo de CLAUDE y la chispa). Opcional: gris, para «no te falta otra herramienta».
import * as THREE from "three";
import { tarjeta } from "../../mundo/utileria.js";
import { C } from "../../estilo/mundo.js";
import { LOGOS } from "../logos.js";

const hex = (k) => "#" + C[k].getHexString();

export function tarjetaLogo(id, { lado = 0.62, gris = false } = {}) {
  const lg = LOGOS.find((l) => l.id === id);
  const t = tarjeta(lado, lado, (g, w, h) => {
    g.beginPath(); g.roundRect(0, 0, w, h, w * 0.2); g.fillStyle = gris ? hex("hueso") : "#FFFFFF"; g.fill();
    const k = (w * 0.56) / 24;
    g.save(); g.translate(w / 2 - 12 * k, h / 2 - 12 * k); g.scale(k, k);
    g.fillStyle = gris ? hex("gris") : lg.id === "claude" ? hex("durazno") : hex("navy");
    g.fill(new Path2D(lg.d));
    g.restore();
  }, { r: lado * 0.2, px: 360 });
  t.userData.id = id;
  return t;
}

// anillo plano que crece y se apaga (la llegada de algo); mira siempre a la cámara
export function onda3d(color = C.cieloClaro) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  m.renderOrder = 10;
  return m;
}
