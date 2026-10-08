// v2 · voz en UNA toma: transcribe (whisper.cpp local), compara palabra por palabra contra el
// guion v2 completo (cuerpo → plática → curso) y reporta diferencias, duración y dónde caen los
// dos cortes entre secciones (silencios reales).
//   node scripts/v2-voz.mjs <toma.mp3> [--json salida.json]
import { execFileSync } from "node:child_process";
import { readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { dirname, basename, join, resolve } from "node:path";
import { ORDEN_TOMA, palabrasDe, clave } from "../v2/guion.js";

// whisper.cpp vive fuera del PATH en esta máquina: sin esta variable `transcribe` lo salta sin error
process.env.HYPERFRAMES_WHISPER_PATH ||= join(process.env.USERPROFILE || process.env.HOME, ".local/whisper.cpp/b5454/Release/whisper-cli.exe");
const archivo = resolve(process.argv[2]);
const dir = dirname(archivo), nombre = basename(archivo, ".mp3");
const salidaJson = join(dir, `${nombre}.json`);
// --reusar: usa la transcripción que ya existe junto al mp3
if (!(process.argv.includes("--reusar") && existsSync(salidaJson))) {
  execFileSync("npx", ["--yes", "hyperframes@0.8.140", "transcribe", basename(archivo), "--model", "medium", "--language", "es"], { cwd: dir, stdio: "ignore", shell: true });
  renameSync(join(dir, "transcript.json"), salidaJson);
}
const oido = JSON.parse(readFileSync(salidaJson, "utf8")).filter((w) => clave(w.text));

// guion completo con la sección de cada palabra
// --secciones cuerpo,platica: la toma solo trae esas (por defecto, ORDEN_TOMA completo)
const iSec = process.argv.indexOf("--secciones");
const SECS = iSec > 0 ? process.argv[iSec + 1].split(",") : ORDEN_TOMA;
const guion = SECS.flatMap((s) => palabrasDe(s).map((text) => ({ text, s })));
// alineación por caracteres (whisper junta o separa palabras: «35» = «treinta y cinco»)
const G = guion.map((w) => clave(w.text)).join("");
const O = oido.map((w) => clave(w.text)).join("");
// distancia de edición por palabra (Levenshtein sobre listas) para reportar dónde difiere
const a = guion.map((w) => clave(w.text)), b = oido.map((w) => clave(w.text));
const D = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
for (let j = 1; j <= b.length; j++) D[0][j] = j;
for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
const difs = [];
for (let i = a.length, j = b.length; i > 0 || j > 0; ) {
  if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) { i--; j--; continue; }
  if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + 1) { difs.push(`«${guion[i - 1].text}» → «${oido[j - 1].text}» @${oido[j - 1].start.toFixed(2)}`); i--; j--; }
  else if (i > 0 && D[i][j] === D[i - 1][j] + 1) { difs.push(`falta «${guion[i - 1].text}»`); i--; }
  else { difs.push(`sobra «${oido[j - 1].text}» @${oido[j - 1].start.toFixed(2)}`); j--; }
}
// cortes: fin de la última palabra de cada sección según la alineación de igualdad
const finSeccion = {};
if (G === O) {
  let c = 0;
  const rangos = oido.map((w) => { const r = [c, c + clave(w.text).length]; c += clave(w.text).length; return r; });
  c = 0;
  guion.forEach((w) => {
    c += clave(w.text).length;
    const k = rangos.findIndex(([, fin]) => fin >= c);
    finSeccion[w.s] = { fin: oido[k].end, sig: oido[k + 1] ? oido[k + 1].start : null };
  });
}
const total = oido.at(-1).end - oido[0].start;
console.log(JSON.stringify({ toma: nombre, palabrasGuion: a.length, palabrasOido: b.length, identica: G === O, diferencias: difs.reverse(), duracionHabla: +total.toFixed(2), cortes: finSeccion }, null, 1));
if (process.argv.includes("--json")) writeFileSync(process.argv[process.argv.indexOf("--json") + 1], JSON.stringify({ oido, finSeccion }));
