// Coloca cada toma de voz en la línea de tiempo y convierte los tiempos que oyó whisper en
// tiempos de las palabras EXACTAS del guion (whisper escribe «Cloud», «35», «7»; el guion
// dice «Claude», «treinta y cinco», «siete»). Escribe:
//   estilo/vo.js            TIEMPOS_VO absolutos por toma → lo usan subtítulos, OST y 3D
//   assets/mezcla/voz.wav   la pista de voz montada, 150 s, 48 kHz
//   node scripts/voz-montar.mjs
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { TOMAS, DURACION } from "../estilo/guion.js";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NUM = { 6: "seis", 100: "cien", 50: "cincuenta", 35: "treintaycinco", 7: "siete", 3: "tres" };
const ALIAS = { cloud: "claude", clod: "claude", baddai: "vadai", badai: "vadai", badday: "vadai" };
const clave = (w) => {
  const x = w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ]/g, "");
  return NUM[x] || ALIAS[x] || x;
};

function alinear(guion, oido) {
  // cadenas sin espacios; el guion junta «treinta y cinco» como lo junta whisper
  const g = guion.map((text) => ({ text, k: clave(text) }));
  const o = oido.map((w) => ({ ...w, k: clave(w.text) }));
  const G = g.map((w) => w.k).join("");
  const O = o.map((w) => w.k).join("");
  if (G !== O) throw new Error(`voz: no alinean\n guion ${G}\n oído  ${O}`);
  // rango de caracteres de cada palabra del oído
  let c = 0;
  const rangos = o.map((w) => { const r = [c, c + w.k.length]; c += w.k.length; return r; });
  c = 0;
  return g.map((w) => {
    const a = c, b = c + w.k.length;
    c = b;
    const tocan = o.map((x, i) => [x, rangos[i]]).filter(([, [ra, rb]]) => rb > a && ra < b);
    const [p, [pa, pb]] = tocan[0];
    const [u, [ua, ub]] = tocan.at(-1);
    // si una palabra del oído cubre varias del guion, el tiempo se reparte por caracteres
    const ini = p.start + (p.end - p.start) * Math.max(0, (a - pa) / Math.max(1, pb - pa));
    const fin = u.start + (u.end - u.start) * Math.min(1, (b - ua) / Math.max(1, ub - ua));
    return { text: w.text, start: ini, end: Math.max(fin, ini + 0.04) };
  });
}

const salida = {};
const entradas = [];
for (const t of TOMAS) {
  const oido = JSON.parse(readFileSync(join(raiz, `assets/voz/${t.id}.json`), "utf8"));
  // se alinea por caracteres: «treinta»«y»«cinco» del guion juntan lo mismo que «35» de whisper
  const guion = t.vo.split(/\s+/);
  const palabras = alinear(guion, oido.filter((w) => clave(w.text)));
  // el clip se coloca para que su primera palabra caiga en t.voz
  const desfase = t.voz - palabras[0].start;
  salida[t.id] = palabras.map((w) => ({ text: w.text, start: +(w.start + desfase).toFixed(3), end: +(w.end + desfase).toFixed(3) }));
  entradas.push({ id: t.id, desfase });
  const fin = salida[t.id].at(-1).end;
  console.log(`${t.id}: voz ${t.voz.toFixed(2)}–${fin.toFixed(2)} · toma ${t.inicio.toFixed(2)}–${t.fin.toFixed(2)} · holgura ${(t.fin - fin).toFixed(2)} s${fin > t.fin ? "  ← SE PASA" : ""}`);
}
// pista de voz: cada clip con su retardo, sumados, recortada a la duración exacta
mkdirSync(join(raiz, "assets/mezcla"), { recursive: true });
const args = ["-v", "error", "-y"];
for (const e of entradas) args.push("-i", join(raiz, `assets/voz/${e.id}.mp3`));
const ramas = entradas.map((e, i) => `[${i}:a]aresample=48000,aformat=channel_layouts=mono,adelay=${Math.max(0, Math.round(e.desfase * 1000))}:all=1[v${i}]`);
const suma = `${entradas.map((_, i) => `[v${i}]`).join("")}amix=inputs=${entradas.length}:normalize=0:dropout_transition=0,apad=whole_dur=${DURACION},atrim=0:${DURACION}[voz]`;
args.push("-filter_complex", [...ramas, suma].join(";"), "-map", "[voz]", "-c:a", "pcm_s24le", join(raiz, "assets/mezcla/voz.wav"));
execFileSync("ffmpeg", args);
console.log("voz.wav listo");

// Afinado contra la energía real (MOTION-RULES 11: desfase ≤ 2 cuadros). whisper mueve las
// palabras junto a una pausa hasta ~1 s (toma 14: «Te» a 136.96 cuando suena a 138.25).
// Cada silencio real (< −45 dB por ≥ 150 ms) fija el final de la palabra anterior y el ataque
// de la siguiente.
const pcm = execFileSync("ffmpeg", ["-v", "error", "-i", join(raiz, "assets/mezcla/voz.wav"), "-ac", "1", "-ar", "48000", "-f", "f32le", "-"], { maxBuffer: 1 << 30 });
const x = new Float32Array(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.length));
const PASO = 480; // 10 ms
const db = [];
for (let i = 0; i + PASO <= x.length; i += PASO) {
  let e = 0;
  for (let j = i; j < i + PASO; j++) e += x[j] * x[j];
  db.push(10 * Math.log10(e / PASO + 1e-12));
}
const silencios = [];
for (let i = 0; i < db.length; ) {
  if (db[i] < -45) {
    let j = i;
    while (j < db.length && db[j] < -45) j++;
    if (j - i >= 15) silencios.push([i / 100, j / 100]);
    i = j;
  } else i++;
}
// Cada silencio dentro de una toma se asigna a UNA frontera entre palabras (la más cercana, con
// preferencia por las que siguen a un signo de puntuación). Las fronteras parten la frase en islas
// de habla; dentro de cada isla los tiempos de whisper se reescalan a su inicio y fin reales.
let movidas = 0;
for (const ws of Object.values(salida)) {
  const ini = ws[0].start, fin = ws.at(-1).end;
  const dentro = silencios.filter(([s0, s1]) => s1 > ini - 0.6 && s0 < fin + 0.6);
  // borde de entrada y de salida: el silencio que rodea al primer y último ataque
  // un silencio que empieza antes del primer ataque es el borde de entrada; uno que termina
  // después del último final es el de salida (aunque whisper alargue la última palabra)
  const antes = dentro.filter(([s0, s1]) => s0 <= ini && s1 <= ini + 0.6).at(-1);
  const despues = dentro.find(([s0, s1]) => s1 >= fin && s0 >= fin - 1.2);
  const cortes = []; // [índice de palabra que empieza isla, s0, s1]
  for (const sil of dentro) {
    const [s0, s1] = sil;
    if (sil === antes || sil === despues || s0 <= ini || s1 >= fin) continue;
    const medio = (s0 + s1) / 2;
    let mejor = -1, costo = 1e9;
    for (let b = 1; b < ws.length; b++) {
      if (cortes.some((c) => c[0] === b)) continue;
      const m = (ws[b - 1].end + ws[b].start) / 2;
      const c = Math.abs(m - medio) - (/[.,:;…]$/.test(ws[b - 1].text) ? 0.35 : 0);
      if (c < costo) { costo = c; mejor = b; }
    }
    if (mejor > 0) cortes.push([mejor, s0, s1]);
  }
  cortes.sort((a, b) => a[0] - b[0]);
  const islas = [];
  let desde = 0, arranque = antes ? antes[1] : ini;
  for (const [b, s0, s1] of cortes) { islas.push([desde, b, arranque, s0]); desde = b; arranque = s1; }
  islas.push([desde, ws.length, arranque, despues ? despues[0] : fin]);
  for (const [a, b, r0, r1] of islas) {
    const w0 = ws[a].start, w1 = ws[b - 1].end;
    const k = (r1 - r0) / Math.max(0.05, w1 - w0);
    for (let i = a; i < b; i++) {
      const s = r0 + (ws[i].start - w0) * k, e = r0 + (ws[i].end - w0) * k;
      if (Math.abs(s - ws[i].start) > 0.034) movidas++;
      ws[i].start = +s.toFixed(3);
      ws[i].end = +Math.max(e, s + 0.04).toFixed(3);
    }
  }
}
console.log(`afinado: ${silencios.length} silencios, ${movidas} palabras movidas más de 2 cuadros`);
writeFileSync(join(raiz, "estilo/vo.js"), `// GENERADO por scripts/voz-montar.mjs desde la voz real (whisper, verificada y afinada contra la energía). No editar.\nexport const TIEMPOS_VO = ${JSON.stringify(salida)};\n`);
