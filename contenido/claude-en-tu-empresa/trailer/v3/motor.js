// v3 · motor de «La interfaz viva»: el reloj (rutinas con su tiempo acotado, como la 2D), la cámara de
// scroll sobre una página larga (scrollytelling: la cámara baja por la página sin cortar) y utilidades.
// Todo determinista: el tiempo se redondea al cuadro de 60 fps antes de pintar (ERRORES: con valores de t
// apenas distintos entre workers se movían el grano y los bordes).
export const tramo = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
export const ease = {
  lineal: (u) => u, entra2: (u) => u * u, entra3: (u) => u * u * u,
  sale3: (u) => 1 - Math.pow(1 - u, 3), sale4: (u) => 1 - Math.pow(1 - u, 4),
  suave: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  rebote: (u) => (u <= 0 ? 0 : u >= 1 ? 1 : 1 + 2.7 * Math.pow(u - 1, 3) + 1.7 * Math.pow(u - 1, 2)),   // sobretiro
};
export function azar(semilla) {
  let a = semilla >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function crearMotor({ W, H }) {
  const rutinas = [];
  const reloj = (desde, hasta, fn) => rutinas.push({ desde, hasta, fn });
  // cámara: claves { t, x, y, s } en coordenadas de la página (x, y = esquina superior izquierda de la vista)
  const claves = [{ t: 0, x: 0, y: 0, s: 1, e: ease.suave }];
  const sacudidas = [];
  const cam = {
    clave(t, x, y, s = 1, e = ease.suave) { claves.push({ t, x, y, s, e }); },
    corte(t, x, y, s = 1) { claves.push({ t, x, y, s, corte: true }); },
    sacudir(t, dur = 0.35, amp = 12) { sacudidas.push({ t, dur, amp }); },
    en(t) {
      let a = claves[0], b = null;
      for (const k of claves) { if (k.t <= t) a = k; else { b = k; break; } }
      let v = a;
      if (b && !b.corte) { const u = b.e(tramo(t, a.t, b.t)); v = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, s: a.s * Math.pow(b.s / a.s, u) }; }
      let dx = 0, dy = 0;
      for (const z of sacudidas) { const u = (t - z.t) / z.dur; if (u < 0 || u > 1) continue; const am = z.amp * Math.pow(1 - u, 2); dx += am * Math.sin(t * 97.3 + z.t * 13.1); dy += am * Math.cos(t * 83.7 + z.t * 7.7); }
      return { x: v.x + dx, y: v.y + dy, s: v.s };
    },
    // de la página a la pantalla: la escala es alrededor del centro de la vista
    aPantalla(px, py, t) { const v = cam.en(t); return { x: (px - v.x - W / 2) * v.s + W / 2, y: (py - v.y - H / 2) * v.s + H / 2, s: v.s }; },
  };
  return {
    reloj, cam,
    pintar(t) { t = Math.round(t * 60) / 60; claves.sort((p, q) => p.t - q.t); for (const r of rutinas) r.fn(Math.min(Math.max(t, r.desde), r.hasta - 1e-4)); return t; },
  };
}
