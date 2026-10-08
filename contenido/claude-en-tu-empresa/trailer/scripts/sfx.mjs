// Efectos pequeños sintetizados en código (MOTION-RULES audio 4): deterministas, sin licencia
// de terceros. Escribe WAV 48 kHz mono en assets/sfx/codigo/.
//   node scripts/sfx.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SR = 48000;
const salida = join(resolve(dirname(fileURLToPath(import.meta.url)), ".."), "assets/sfx/codigo");
mkdirSync(salida, { recursive: true });

let semilla = 7;
const ruido = () => { semilla = (semilla * 1664525 + 1013904223) >>> 0; return semilla / 2 ** 31 - 1; };
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));

function wav(nombre, dur, f) {
  const n = Math.round(dur * SR);
  const datos = new Float32Array(n);
  for (let i = 0; i < n; i++) datos[i] = f(i / SR, i);
  // normaliza a -1 dBFS de pico; el nivel de mezcla se decide en la composición
  const pico = datos.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  const g = 0.891 / pico;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(datos[i] * g * 32767))), 44 + i * 2);
  writeFileSync(join(salida, nombre), buf);
  console.log("sfx:", nombre, dur.toFixed(2), "s");
}

// tick de interruptor: clic seco con un cuerpo tonal breve (checklist tick)
wav("tick.wav", 0.12, (t) => {
  const clic = ruido() * env(t, 0.0004, 0.004);
  const cuerpo = Math.sin(2 * Math.PI * 2400 * t) * env(t, 0.0008, 0.018) * 0.55 + Math.sin(2 * Math.PI * 1200 * t) * env(t, 0.001, 0.03) * 0.35;
  return clic * 0.6 + cuerpo;
});

// pop de tarjeta: burbuja suave con barrido de tono hacia arriba (pop)
wav("pop.wav", 0.18, (t) => {
  const f = 380 + 900 * Math.min(1, t / 0.05);
  const fase = 2 * Math.PI * (380 * t + 900 * (t < 0.05 ? (t * t) / 0.1 : 0.025 + (t - 0.05)));
  return Math.sin(fase) * env(t, 0.002, 0.045) * (f > 0 ? 1 : 0) + ruido() * env(t, 0.0005, 0.003) * 0.15;
});

// rodillo de contador: tren de tics que acelera y frena (count-up), 0.9 s
wav("contador.wav", 0.9, (t) => {
  // posiciones de tic con densidad creciente y frenado al final
  const u = t / 0.9;
  const fase = 26 * (u - (u * u * u) / 3 * 0.9);
  const local = fase - Math.floor(fase);
  const dt = local / (26 * (1 - 0.9 * u * u) / 0.9 + 1e-6);
  const tic = Math.sin(2 * Math.PI * 3100 * dt) * Math.exp(-dt / 0.0025) + ruido() * Math.exp(-dt / 0.0006) * 0.3;
  return tic * (0.55 + 0.45 * Math.sin(Math.PI * u));
});

// campanita: dos notas (re–la), parciales de campana, cola larga (chime)
wav("campanita.wav", 1.6, (t) => {
  const nota = (f0, t0) => {
    if (t < t0) return 0;
    const x = t - t0;
    return [1, 2.76, 5.4].reduce((s, k, j) => s + Math.sin(2 * Math.PI * f0 * k * x) * [1, 0.32, 0.12][j] * Math.exp(-x / [0.7, 0.35, 0.18][j]), 0) * env(x, 0.002, 1);
  };
  return nota(1174.66, 0) * 0.8 + nota(1760, 0.11) * 0.7;
});

// latido de la chispa: pulso grave y cálido de una sola nota (01, 15)
wav("pulso.wav", 1.2, (t) => Math.sin(2 * Math.PI * 73.4 * t + 0.6 * Math.sin(2 * Math.PI * 146.8 * t)) * env(t, 0.012, 0.32) + Math.sin(2 * Math.PI * 587.3 * t) * env(t, 0.003, 0.4) * 0.08);

// marcador rojo clavándose (12): toc corto de madera
wav("marcador.wav", 0.2, (t) => Math.sin(2 * Math.PI * (900 - 2600 * t) * t) * env(t, 0.0006, 0.022) + ruido() * env(t, 0.0003, 0.002) * 0.25);
