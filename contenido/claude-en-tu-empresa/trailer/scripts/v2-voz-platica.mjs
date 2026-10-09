// v2 · voz de la plática: Camila Rodríguez, eleven_v3, estabilidad 0.4.
//   1. UNA toma completa (--base); se elige la que dice «VADAI» en dos sílabas («Badaï») y todo el
//      guion limpio. Nada de empalmar frases de otras tomas: cambia el acento (ERRORES E32).
//   2. silencios: entre frases ≤ 0.5 s y dentro de una frase ≤ 0.6 s, salvo las pausas dramáticas
//      (después de «¿…depende de ti?» y de «método»). Así dura ~1:27 sin acelerar la voz.
//   3. termina en la última palabra con un fundido: nada de la toma después (ERRORES: en la v2 anterior
//      se colaba el arranque del cierre del curso y se oía una palabra cortada).
//   4. tiempos: whisper sobre la pista armada + afinado por islas de energía (ERRORES E9).
// Salidas: assets/v2/mezcla/voz-<versión>.wav · v2/vo-<versión>.js
//   node scripts/v2-voz-platica.mjs --base camila-g [--version platica|curso]
// (11-oct: también arma el curso; cada versión es su propia toma completa, nunca un empalme)
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SECCIONES, palabrasDe, clave } from "../v2/guion.js";

process.env.HYPERFRAMES_WHISPER_PATH ||= join(process.env.USERPROFILE || process.env.HOME, ".local/whisper.cpp/b5454/Release/whisper-cli.exe");
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const V = join(raiz, "assets/v2/voz"), M = join(raiz, "assets/v2/mezcla");
mkdirSync(M, { recursive: true });
const SR = 48000;
const iVer = process.argv.indexOf("--version");
const VERSION = iVer > 0 ? process.argv[iVer + 1] : "platica";
const FRASES = [...SECCIONES.cuerpo, ...SECCIONES[VERSION]];
const RESPALDO = SECCIONES.cuerpo.length + 2;            // índice de la frase del respaldo
const PAUSA_DRAMATICA = { 6: 1.3, 8: 0.9 };              // tope del silencio DESPUÉS de esa frase
const TOPE_ENTRE = 0.5, TOPE_DENTRO = 0.6;

const leer = (f) => { const b = execFileSync("ffmpeg", ["-v", "error", "-i", f, "-ac", "1", "-ar", String(SR), "-f", "f32le", "-"], { maxBuffer: 1 << 30 }); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); };
const energia = (x) => { const d = []; for (let i = 0; i + 480 <= x.length; i += 480) { let e = 0; for (let j = i; j < i + 480; j++) e += x[j] * x[j]; d.push(10 * Math.log10(e / 480 + 1e-12)); } return d; };
const hondo = (db, t0, t1) => { let m = t0, v = 1e9; for (let k = Math.floor(t0 * 100); k < t1 * 100; k++) if (db[k] < v) { v = db[k]; m = k / 100; } return m; };

// alineación tolerante por caracteres: tiempo de cada palabra del guion en una transcripción
const ALIAS2 = { click: "clic", badaie: "vadai", badai: "vadai" };
const k2 = (w) => ALIAS2[clave(w)] || clave(w);
function alinear(oido) {
  const guion = FRASES.flatMap((f, i) => f.split(/\s+/).map((text) => ({ text, f: i })));
  const gs = guion.map((w) => k2(w.text)).join(""), os = oido.map((w) => k2(w.text)).join("");
  const charW = []; oido.forEach((w, i) => { for (const _ of k2(w.text)) charW.push(i); });
  const mapa = new Int32Array(gs.length).fill(-1);
  for (let i = 0, j = 0; i < gs.length && j < os.length; ) {
    if (gs[i] === os[j]) { mapa[i++] = j++; continue; }
    let ok = false;
    for (let a = 0; a < 30 && !ok; a++) for (let b = 0; b < 30; b++) if (gs.slice(i + a, i + a + 8) === os.slice(j + b, j + b + 8)) { i += a; j += b; ok = true; break; }
    if (!ok) break;
  }
  let c = 0;
  const t = guion.map((w) => {
    const n = k2(w.text).length, a = c, b = c + n - 1; c += n;
    let ia = a; while (ia <= b && mapa[ia] < 0) ia++;
    let ib = b; while (ib >= a && mapa[ib] < 0) ib--;
    if (ia > b) return { ...w, start: null, end: null };
    return { ...w, start: oido[charW[mapa[ia]]].start, end: oido[charW[mapa[ib]]].end };
  });
  t.forEach((w, i) => { if (w.start == null) { const p = t[i - 1], s = t[i + 1]; w.start = p ? p.end : 0; w.end = Math.max(w.start + 0.04, s && s.start != null ? s.start : w.start + 0.1); } });
  return t;
}
const transcribir = (wav, json) => {
  if (!existsSync(json)) {
    execFileSync("npx", ["--yes", "hyperframes@0.8.140", "transcribe", wav.split(/[\\/]/).pop(), "--model", "medium", "--language", "es"], { cwd: dirname(wav), stdio: "ignore", shell: true });
    renameSync(join(dirname(wav), "transcript.json"), json);
  }
  return JSON.parse(readFileSync(json, "utf8")).filter((w) => clave(w.text));
};

// ---------- 1 · la toma: una sola, completa (10-oct: empalmar una frase de otra toma cambiaba el
// acento, Alejandro la oyó «española»). --base <nombre> en assets/v2/voz/ ----------
const iB = process.argv.indexOf("--base");
const BASE = iB > 0 ? process.argv[iB + 1] : "camila-f";
const E = { x: leer(join(V, `${BASE}.mp3`)), w: alinear(JSON.parse(readFileSync(join(V, `${BASE}.json`), "utf8")).filter((w) => clave(w.text))) };
E.db = energia(E.x);
const fr = (T, i) => ({ ini: T.w.find((w) => w.f === i).start, fin: T.w.filter((w) => w.f === i).at(-1).end });
const inicio = Math.max(0, fr(E, 0).ini - 0.2), final = fr(E, FRASES.length - 1).fin + 0.35;
let y = Float32Array.from(E.x.subarray(Math.round(inicio * SR), Math.round(final * SR)));
let o = 0;
const F = 0.03 * SR;
console.log(`toma única: ${BASE} (${inicio.toFixed(2)}–${final.toFixed(2)} s)`);

// ---------- 2 · silencios con tope (las pausas dramáticas se respetan) ----------
const finFrase = FRASES.map((_, i) => fr(E, i).fin - inicio);
const iniFrase = FRASES.map((_, i) => fr(E, i).ini - inicio);
const dbY = energia(y);
const silencios = [];
for (let i = 0; i < dbY.length; ) { if (dbY[i] < -42) { let j = i; while (j < dbY.length && dbY[j] < -42) j++; if (j - i >= 25) silencios.push([i / 100, j / 100]); i = j; } else i++; }
const PAUSA_MIN = { 6: 1.2, 8: 0.9 };   // «¿…depende de ti?» y «método»: Camila casi no respira ahí
const ops = [];   // { en, quita } o { en, pon, desde } en tiempo de la pista armada
if (process.argv.includes("--depurar")) { for (const i of [5, 6, 7]) console.log("frase", i, "fin", finFrase[i].toFixed(2), "ini sig", iniFrase[i + 1].toFixed(2)); console.log("silencios 38–48 s:", silencios.filter(([a2]) => a2 > 38 && a2 < 48).map(([a2, b2]) => `${a2.toFixed(2)}–${b2.toFixed(2)}`).join(" ")); }
for (const [s0, s1] of silencios) {
  const largo = s1 - s0;
  // la frontera entre frases cuyo punto medio cae en este silencio (whisper estira la última palabra)
  const despues = finFrase.findIndex((f, i) => iniFrase[i + 1] != null && (f + iniFrase[i + 1]) / 2 >= s0 - 0.25 && (f + iniFrase[i + 1]) / 2 <= s1 + 0.25);
  const tope = despues >= 0 ? (PAUSA_DRAMATICA[despues] ?? TOPE_ENTRE) : TOPE_DENTRO;
  const m = (s0 + s1) / 2;
  if (largo > tope + 0.05 && s0 > 0.3 && s1 < y.length / SR - 0.3) ops.push({ en: m - (largo - tope) / 2, quita: largo - tope });
  else if (PAUSA_MIN[despues] && largo < PAUSA_MIN[despues] - 0.05) ops.push({ en: m, pon: PAUSA_MIN[despues] - largo, desde: [s0 + 0.05, s1 - 0.05] });
}
const trozos = []; let c0 = 0;
for (const op of ops) {
  trozos.push(y.subarray(Math.round(c0 * SR), Math.round(op.en * SR)));
  if (op.quita) c0 = op.en + op.quita;
  else {   // ruido de fondo de ese mismo silencio, repetido (no silencio digital)
    const r = y.subarray(Math.round(op.desde[0] * SR), Math.round(op.desde[1] * SR)), n = Math.round(op.pon * SR), q = new Float32Array(n);
    for (let i = 0; i < n; i++) q[i] = r[i % r.length];
    trozos.push(q); c0 = op.en;
  }
}
trozos.push(y.subarray(Math.round(c0 * SR)));
const z = new Float32Array(trozos.reduce((acc, q) => acc + q.length, 0));
o = 0;
trozos.forEach((q0, k) => {
  const q = Float32Array.from(q0);
  for (let i = 0; i < F && i < q.length; i++) { const g = i / F; if (k) q[i] *= g; if (k < trozos.length - 1) q[q.length - 1 - i] *= g; }
  z.set(q, o); o += q.length;
});
// fundido final: la pista muere en la última palabra
const FF = Math.round(0.25 * SR); for (let i = 0; i < FF; i++) z[z.length - 1 - i] *= i / FF;
console.log(`silencios: ${ops.filter((x) => x.quita).length} recortados, ${ops.filter((x) => x.pon).length} alargados · ${(y.length / SR).toFixed(2)} s → ${(z.length / SR).toFixed(2)} s`);
const wav = join(M, `voz-${VERSION}.wav`);
const b = Buffer.alloc(44 + z.length * 4);
b.write("RIFF", 0); b.writeUInt32LE(36 + z.length * 4, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16);
b.writeUInt16LE(3, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(32, 34);
b.write("data", 36); b.writeUInt32LE(z.length * 4, 40);
for (let i = 0; i < z.length; i++) b.writeFloatLE(z[i], 44 + i * 4);
writeFileSync(wav, b);

// ---------- 3 · tiempos de cada palabra en la pista final ----------
const jsonFinal = join(M, `voz-${VERSION}.json`);
if (existsSync(jsonFinal)) renameSync(jsonFinal, jsonFinal + ".viejo");
const t = alinear(transcribir(wav, jsonFinal));
// afinado: cada frase se pega a los bordes de sus silencios reales; dentro, solo se parte en pausas que
// coinciden con puntuación (o muy claras) y los tiempos de whisper se reescalan a cada isla. Nada pasa
// del final de la pista (whisper estira las últimas palabras).
const durZ = z.length / SR, dbz = energia(z), sil = [];
for (let i = 0; i < dbz.length; ) { if (dbz[i] < -45) { let j = i; while (j < dbz.length && dbz[j] < -45) j++; if (j - i >= 12) sil.push([i / 100, j / 100]); i = j; } else i++; }
const finHabla = (() => { let k = dbz.length - 1; while (k > 0 && dbz[k] < -45) k--; return (k + 1) / 100; })();
let movidas = 0;
FRASES.forEach((_, fi) => {
  const ws = t.filter((w) => w.f === fi);
  for (const w of ws) { w.start = Math.min(w.start, finHabla - 0.1); w.end = Math.min(w.end, finHabla); }
  const w0 = ws[0].start, wN = ws.at(-1).end;
  // el silencio que abre la frase termina donde ella empieza; el que la cierra termina donde empieza
  // la siguiente (whisper corre el final de la última palabra hasta 1.3 s hacia la pausa: ERRORES E9)
  const cerca = (t0, tol) => sil.reduce((m, q) => (Math.abs(q[1] - t0) < tol && (!m || Math.abs(q[1] - t0) < Math.abs(m[1] - t0)) ? q : m), null);
  const sig = t.find((w) => w.f === fi + 1);
  const antes = cerca(w0, 0.5);
  const despues = sig ? cerca(sig.start, 0.5) : sil.find(([s0]) => s0 >= wN - 0.7 && s0 <= wN + 0.8);
  const ini = antes ? antes[1] : w0, fin = Math.min(despues ? despues[0] : wN, finHabla);
  const cortes = [];
  for (const [s0, s1] of sil) {
    if (s0 <= ini + 0.1 || s1 >= fin - 0.1 || s1 - s0 < 0.2) continue;
    const medio = (s0 + s1) / 2; let mejor = -1, costo = 1e9;
    for (let k = 1; k < ws.length; k++) {
      if (cortes.some((c) => c[0] === k)) continue;
      const mm = (ws[k - 1].end + ws[k].start) / 2, punt = /[.,:;…?!]$/.test(ws[k - 1].text), d = Math.abs(mm - medio);
      if (d > (punt ? 0.9 : 0.35)) continue;
      const cc = d - (punt ? 0.5 : 0);
      if (cc < costo) { costo = cc; mejor = k; }
    }
    if (mejor > 0) cortes.push([mejor, s0, s1]);
  }
  cortes.sort((p1, p2) => p1[0] - p2[0]);
  const islas = []; let desde = 0, arr = ini;
  for (const [k, s0, s1] of cortes) { if (k > desde) { islas.push([desde, k, arr, s0]); desde = k; arr = s1; } }
  islas.push([desde, ws.length, arr, fin]);
  for (const [i0, i1, r0, r1] of islas) {
    const a0 = ws[i0].start, a1 = ws[i1 - 1].end, kk = (r1 - r0) / Math.max(0.05, a1 - a0);
    for (let i = i0; i < i1; i++) { const st = r0 + (ws[i].start - a0) * kk, en = r0 + (ws[i].end - a0) * kk; if (Math.abs(st - ws[i].start) > 0.034) movidas++; ws[i].start = +st.toFixed(3); ws[i].end = +Math.max(en, st + 0.04).toFixed(3); }
  }
});
// orden mínimo garantizado (whisper a veces pega dos palabras): nunca hacia atrás
for (let i = 1; i < t.length; i++) if (t[i].start < t[i - 1].start + 0.04) { t[i].start = +(t[i - 1].start + 0.04).toFixed(3); t[i].end = Math.max(t[i].end, t[i].start + 0.04); }
// correcciones medidas a mano sobre la energía de la pista (11-oct): whisper estiró «Lo caro es que sigan
// haciendo las cosas a mano» hasta una respiración en 91.7 s; la voz termina en 90.73 y de «haciendo» en
// adelante cada palabra salía 0.5–0.85 s tarde (Alejandro: «tarda en salir las palabras»). ERRORES E38.
const CORRIGE = { "camila-g": { [FRASES.length - 1]: [[88.45, 88.59], [88.63, 88.99], [89.02, 89.13], [89.15, 89.22], [89.22, 89.49], [89.52, 89.94], [89.98, 90.13], [90.15, 90.42], [90.42, 90.5], [90.5, 90.73]] } };
for (const [fi, ts] of Object.entries(CORRIGE[BASE] || {})) t.filter((w) => w.f === +fi).forEach((w, k) => { [w.start, w.end] = ts[k]; });
const nC = SECCIONES.cuerpo.length;
const palabras = t.map((w) => ({ text: w.text, s: w.f < nC ? "cuerpo" : VERSION, start: +w.start.toFixed(3), end: +w.end.toFixed(3) }));
writeFileSync(join(raiz, `v2/vo-${VERSION}.js`), `// GENERADO por scripts/v2-voz-platica.mjs (Camila Rodríguez). Tiempos de cada palabra del guion en la pista de voz.\nexport const DURACION_VOZ = ${(z.length / SR).toFixed(3)};\nexport const PALABRAS = ${JSON.stringify(palabras)};\n`);
console.log(`afinado: ${sil.length} silencios, ${movidas} palabras movidas · ${palabras.length} palabras · habla hasta ${finHabla.toFixed(2)} s · pista ${durZ.toFixed(2)} s`);
