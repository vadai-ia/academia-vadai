// Propuesta 3 · las capas que rodean al mundo 3D: fondo vivo (aurora por tramo + palabras gigantes que
// corren), partículas brillantes que flotan con paralaje, el cursor (el líder: eres tú, señala cada
// cosa nueva y da los clics), hilos/redes en SVG y la viñeta. Todo se pinta desde t.
import * as THREE from "three";
import { tramo, clamp01, brillo, COLOR, azar } from "./mundo.js";

const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mezclaHex = (a, b, u) => { const A = hex(a), B = hex(b); return `rgb(${A.map((x, i) => Math.round(x + (B[i] - x) * u)).join(",")})`; };
const suave = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const sale3 = (u) => 1 - Math.pow(1 - u, 3);

// ---------------- fondo: aurora con humor por tramo ----------------
// paleta: [{ t, base, a, b, c }] — se cruza en 0.7 s hacia la siguiente
export function crearFondo(nodo, { W, H, paleta }) {
  nodo.innerHTML = "";
  const base = document.createElement("div");
  Object.assign(base.style, { position: "absolute", inset: "0" });
  nodo.appendChild(base);
  const manchas = [0, 1, 2].map((k) => {
    const d = document.createElement("div");
    const r = [1150, 980, 820][k];
    Object.assign(d.style, { position: "absolute", left: `${-r / 2}px`, top: `${-r / 2}px`, width: `${r}px`, height: `${r}px`, borderRadius: "50%", filter: "blur(80px)", opacity: "0.9", willChange: "transform" });
    nodo.appendChild(d);
    return d;
  });
  // retícula de puntos finos (densidad) que se mueve con la cámara
  const reticula = document.createElement("div");
  Object.assign(reticula.style, { position: "absolute", left: "-120px", top: "-120px", width: `${W + 240}px`, height: `${H + 240}px`, opacity: "0.5",
    backgroundImage: "radial-gradient(circle, rgba(10,26,47,.16) 1.6px, transparent 1.9px)", backgroundSize: "44px 44px" });
  nodo.appendChild(reticula);
  const marquesinas = [];
  const P = [...paleta].sort((a, b) => a.t - b.t);
  function colores(t) {
    let i = 0; while (i < P.length - 1 && t >= P[i + 1].t) i++;
    const a = P[i], b = P[Math.min(P.length - 1, i + 1)];
    const u = b === a ? 0 : suave(tramo(t, b.t - (b.cruce ?? 0.7), b.t));
    const mix = (k) => (u <= 0 ? a[k] : mezclaHex(a[k], b[k], u));
    return { base: mix("base"), a: mix("a"), b: mix("b"), c: mix("c"), reticula: u > 0.5 ? (b.reticula ?? 0.5) : (a.reticula ?? 0.5) };
  }
  return {
    // palabras gigantes que corren detrás (solo palabras del guion)
    marquesina({ t0, t1, texto, color = COLOR.navy, op = 0.09, y = 540, tam = 300, vel = 90 }) {
      y = y * (H / 1080);
      const filas = [-1, 1].map((sentido, k) => {
        const f = document.createElement("div");
        Object.assign(f.style, { position: "absolute", left: "0", top: `${y - tam * 0.62 + (k ? tam * 0.95 : -tam * 0.95) * 0.55}px`, whiteSpace: "nowrap", fontFamily: "Inter", fontWeight: 900, fontSize: `${tam}px`, letterSpacing: "-0.04em", color: "transparent", WebkitTextStroke: `3px ${color}`, opacity: "0", lineHeight: 1 });
        f.textContent = Array(8).fill(texto).join("  ");
        nodo.appendChild(f);
        return { f, sentido };
      });
      marquesinas.push({ t0, t1, filas, op, vel });
    },
    pintar(t, { despX = 0, despY = 0 } = {}) {
      const c = colores(t);
      base.style.background = `radial-gradient(130% 100% at 50% 40%, ${c.base} 0%, ${c.base} 40%, ${c.c} 130%)`;
      const pos = [
        [W * (0.22 + 0.05 * Math.sin(t * 0.21)), H * (0.28 + 0.06 * Math.cos(t * 0.17)), c.a],
        [W * (0.8 + 0.05 * Math.cos(t * 0.19)), H * (0.62 + 0.07 * Math.sin(t * 0.23)), c.b],
        [W * (0.55 + 0.08 * Math.sin(t * 0.13 + 1)), H * (0.95 + 0.04 * Math.cos(t * 0.29)), c.c],
      ];
      manchas.forEach((d, k) => { d.style.background = `radial-gradient(circle, ${pos[k][2]} 0%, transparent 68%)`; d.style.transform = `translate(${pos[k][0].toFixed(1)}px, ${pos[k][1].toFixed(1)}px)`; });
      const mx = ((despX % 44) + 44) % 44, my = ((despY % 44) + 44) % 44;
      reticula.style.transform = `translate(${mx.toFixed(1)}px, ${my.toFixed(1)}px)`;
      reticula.style.opacity = String(c.reticula);
      for (const q of marquesinas) {
        const u = tramo(t, q.t0, q.t0 + 0.5) * (1 - tramo(t, q.t1 - 0.4, q.t1));
        q.filas.forEach(({ f, sentido }) => {
          f.style.opacity = String((q.op * u).toFixed(3));
          const d = (((t - q.t0) * q.vel) % 1600 + 1600) % 1600;
          f.style.transform = `translateX(${(sentido > 0 ? -1600 + d : -d).toFixed(1)}px)`;
          f.style.display = u > 0 ? "block" : "none";
        });
      }
    },
  };
}

// ---------------- partículas brillantes con paralaje (3D, siguen a la cámara) ----------------
export function crearParticulas(m, n = 26, semilla = 9) {
  const r = azar(semilla);
  const g = new THREE.Group();
  m.escena.add(g);
  const geos = [new THREE.SphereGeometry(1, 20, 14), new THREE.TorusGeometry(0.8, 0.28, 12, 28), new THREE.IcosahedronGeometry(1, 0)];
  const cols = [COLOR.lima, COLOR.durazno, COLOR.cieloClaro, COLOR.blanco, COLOR.azul];
  const ps = [];
  for (let k = 0; k < n; k++) {
    const mesh = new THREE.Mesh(geos[k % 3 === 2 ? 2 : k % 4 === 1 ? 1 : 0], brillo(cols[k % cols.length], { rugosidad: 0.2 }));
    g.add(mesh);
    ps.push({ mesh, u: r(), v: r(), tam: 0.006 + r() * 0.012, par: 0.35 + r() * 0.6, gx: r() * 6, gy: r() * 6, fase: r() * 6 });
  }
  const R = new THREE.Vector3(), U = new THREE.Vector3(), Dv = new THREE.Vector3();
  return {
    g,
    pintar(t, { op = 1 } = {}) {
      const v = m.vista, cam = m.camara;
      g.visible = op > 0.01;
      if (!g.visible) return;
      R.setFromMatrixColumn(cam.matrixWorld, 0); U.setFromMatrixColumn(cam.matrixWorld, 1); Dv.setFromMatrixColumn(cam.matrixWorld, 2);
      const altoV = v.altoReal || v.alto, anchoV = altoV * (m.ancho / m.alto);
      // la cámara se mueve: las partículas se desplazan menos (paralaje) y dan la vuelta al salir
      const fx = (v.x * R.x + v.z * R.z) / anchoV, fy = (v.y * U.y + v.x * U.x + v.z * U.z) / altoV;
      for (const p of ps) {
        const sx = ((((p.u - fx * p.par + 0.02 * Math.sin(t * 0.3 + p.fase)) % 1) + 1) % 1) - 0.5;
        const sy = ((((p.v - fy * p.par + 0.015 * t * (0.4 + p.par)) % 1) + 1) % 1) - 0.5;
        p.mesh.position.set(v.x, v.y, v.z).addScaledVector(R, sx * anchoV * 1.1).addScaledVector(U, sy * altoV * 1.1).addScaledVector(Dv, -120);
        p.mesh.scale.setScalar(p.tam * altoV * op * (m.ancho < m.alto ? 0.75 : 1));
        p.mesh.rotation.set(p.gx + t * 0.6, p.gy + t * 0.4, 0);
      }
    },
  };
}

// ---------------- el cursor: el líder ----------------
// claves: [{ t, p: {x,y} | (t) => {x,y}, forma: "flecha" | "mano", clic: bool, oculto: bool }]
const FLECHA = `<svg viewBox="0 0 64 64" width="84" height="84"><defs><linearGradient id="cfl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#DCE9F2"/></linearGradient></defs>
  <path d="M10 6 L10 50 L21 39 L29 57 L37 53.5 L29 36 L45 36 Z" fill="url(#cfl)" stroke="#0A1A2F" stroke-width="3.6" stroke-linejoin="round"/></svg>`;
const MANO = `<svg viewBox="0 0 64 64" width="88" height="88"><defs><linearGradient id="cmn" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#DCE9F2"/></linearGradient></defs>
  <path d="M24 30 V9.5 a4.5 4.5 0 0 1 9 0 V27 a4.2 4.2 0 0 1 8.4 0 V29 a4.2 4.2 0 0 1 8.4 0 V31.5 a4 4 0 0 1 8 0 V44 c0 8 -5 15 -14 15 h-6 c-6 0 -10 -3 -13 -8 L14.5 40 a4.6 4.6 0 0 1 7.5 -5.2 Z" fill="url(#cmn)" stroke="#0A1A2F" stroke-width="3.4" stroke-linejoin="round"/></svg>`;
export function crearCursor(nodo, claves) {
  const c = document.createElement("div");
  Object.assign(c.style, { position: "absolute", left: "0", top: "0", width: "88px", height: "88px", transformOrigin: "12% 8%", filter: "drop-shadow(0 12px 14px rgba(10,26,47,.32))", opacity: "0" });
  const fl = document.createElement("div"); fl.innerHTML = FLECHA;
  const mn = document.createElement("div"); mn.innerHTML = MANO; Object.assign(mn.style, { position: "absolute", left: "-12px", top: "-2px" });
  c.appendChild(fl); c.appendChild(mn);
  const onda = document.createElement("div");
  Object.assign(onda.style, { position: "absolute", left: "0", top: "0", width: "40px", height: "40px", marginLeft: "-20px", marginTop: "-20px", borderRadius: "50%", border: "5px solid #C6F24E", opacity: "0" });
  nodo.appendChild(onda); nodo.appendChild(c);
  const K = [...claves].sort((a, b) => a.t - b.t);
  const pos = (k, t) => (typeof k.p === "function" ? k.p(t) : k.p);
  return {
    pintar(t) {
      if (!K.length || t < K[0].t - 0.4) { c.style.opacity = "0"; onda.style.opacity = "0"; return; }
      let i = 0; while (i < K.length - 1 && t >= K[i + 1].t) i++;
      const a = K[i], b = K[Math.min(K.length - 1, i + 1)];
      const dur = Math.max(0.001, b.t - a.t), viaje = Math.min(dur, b.viaje ?? 0.55);
      const u = b === a ? 0 : suave(tramo(t, b.t - viaje, b.t));
      const pa = pos(a, t), pb = pos(b, t);
      // arco: el cursor no viaja en línea recta (anticipación y seguimiento)
      const arco = Math.sin(Math.PI * u) * Math.min(120, Math.hypot(pb.x - pa.x, pb.y - pa.y) * 0.18);
      const x = pa.x + (pb.x - pa.x) * u, y = pa.y + (pb.y - pa.y) * u - arco;
      const oculto = (u < 0.5 ? a : b).oculto;
      const entra = tramo(t, K[0].t - 0.4, K[0].t);
      c.style.opacity = oculto ? "0" : String(entra);
      const mano = (u < 0.5 ? a : b).forma === "mano";
      fl.style.opacity = mano ? "0" : "1"; mn.style.opacity = mano ? "1" : "0";
      // clic: se hunde y suelta una onda lima
      let s = 1, o = 0, r = 0;
      for (const k of K) if (k.clic) { const d = t - k.t; if (d > -0.12 && d < 0.1) s = Math.min(s, 1 - 0.18 * Math.sin(((d + 0.12) / 0.22) * Math.PI)); if (d >= 0 && d < 0.45) { o = 1 - d / 0.45; r = 1 + d * 7; const q = pos(k, t); onda.style.transform = `translate(${q.x.toFixed(1)}px, ${q.y.toFixed(1)}px) scale(${r.toFixed(2)})`; } }
      onda.style.opacity = String(o.toFixed(3));
      const tilt = (pb.x - pa.x) * 0.012 * Math.sin(Math.PI * u);
      c.style.transform = `translate(${(x - 10).toFixed(1)}px, ${(y - 6).toFixed(1)}px) rotate(${Math.max(-14, Math.min(14, tilt)).toFixed(2)}deg) scale(${s.toFixed(3)})`;
    },
    posicion(t) { let i = 0; while (i < K.length - 1 && t >= K[i + 1].t) i++; const a = K[i], b = K[Math.min(K.length - 1, i + 1)]; const viaje = Math.min(Math.max(0.001, b.t - a.t), b.viaje ?? 0.55); const u = b === a ? 0 : suave(tramo(t, b.t - viaje, b.t)); const pa = pos(a, t), pb = pos(b, t); const arco = Math.sin(Math.PI * u) * Math.min(120, Math.hypot(pb.x - pa.x, pb.y - pa.y) * 0.18); return { x: pa.x + (pb.x - pa.x) * u, y: pa.y + (pb.y - pa.y) * u - arco }; },
  };
}

// ---------------- viñeta ----------------
export function viñeta(nodo, { fuerza = 0.18 } = {}) {
  Object.assign(nodo.style, { background: `radial-gradient(120% 95% at 50% 45%, transparent 60%, rgba(10,26,47,${fuerza}) 100%)` });
}
