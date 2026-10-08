// v2 · subtítulos .srt por cierre (los mismos para 3D y 2D, horizontal y vertical: misma voz).
// Desde los tiempos por palabra (v2/vo-*.js): cada frase se parte en bloques de ≤ 2 líneas de ≤ 42
// caracteres, cortando en signos de puntuación cuando se puede. Mínimo 1.0 s en pantalla.
//   node scripts/v2-srt.mjs → renders/v2/entregables/claude-en-tu-empresa-{platica,curso}.srt
import { writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tiempos } from "../v2/tiempos.js";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(raiz, "renders/v2/entregables");
mkdirSync(OUT, { recursive: true });
const MAX = 42;   // estándar de subtítulos: 42 caracteres por línea, 2 líneas
const hms = (t) => { const ms = Math.round(t * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`; };

for (const v of ["platica", "curso"]) {
  const T = await tiempos(v);
  const bloques = [];
  const L = (a) => a.map((w) => w.text).join(" ").length;
  // corte que mejor reparte: cerca del objetivo, con premio si cae después de puntuación
  const cortar = (ws, objetivo) => {
    let k = 1, mejor = -1e9;
    for (let i = 1; i < ws.length; i++) {
      const a = L(ws.slice(0, i)), p = /[,:;…]$/.test(ws[i - 1].text) ? 12 : 0;
      const b = L(ws.slice(i)), pasa = a > MAX || b > MAX ? 100 : 0;
      const sc = -Math.abs(a - objetivo) + p - pasa;
      if (sc > mejor) { mejor = sc; k = i; }
    }
    return k;
  };
  const partir = (ws) => {
    if (L(ws) <= 2 * MAX) return [ws];
    const n = Math.ceil(L(ws) / (2 * MAX)), k = cortar(ws, L(ws) / n);
    return [...partir(ws.slice(0, k)), ...partir(ws.slice(k))];
  };
  for (const ws of T.porFrase) bloques.push(...partir(ws));
  let srt = "";
  bloques.forEach((b, i) => {
    const txt = b.map((w) => w.text).join(" ");
    // dos líneas balanceadas, ninguna de más de MAX
    let lineas = [txt];
    if (txt.length > MAX) { const k = cortar(b, txt.length / 2); lineas = [b.slice(0, k), b.slice(k)].map((x) => x.map((w) => w.text).join(" ")); }
    const ini = b[0].start, sig = bloques[i + 1] ? bloques[i + 1][0].start - 0.05 : b.at(-1).end + 0.6;
    const fin = Math.min(Math.max(b.at(-1).end + 0.25, ini + 1.0), sig);
    srt += `${i + 1}\n${hms(ini)} --> ${hms(fin)}\n${lineas.join("\n")}\n\n`;
  });
  const f = join(OUT, `claude-en-tu-empresa-${v}.srt`);
  writeFileSync(f, srt);
  console.log(f, bloques.length, "bloques");
}
