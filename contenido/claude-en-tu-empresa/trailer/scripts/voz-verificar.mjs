// Autorrevisión de la voz (MOTION-RULES, audio 6): transcribe cada toma con whisper.cpp
// local y la compara palabra por palabra con el guion bloqueado (estilo/guion.js).
// Escribe assets/voz/NN.json (tiempos por palabra) y falla si alguna toma no coincide.
//   node scripts/voz-verificar.mjs [ids...]
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { TOMAS } from "../estilo/guion.js";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const voz = join(raiz, "assets/voz");
const ids = process.argv.slice(2).length ? process.argv.slice(2) : TOMAS.map((t) => t.id);

// Lo que whisper escribe distinto pero suena igual: cifras, la marca, nombres propios.
const NUM = { 6: "seis", 100: "cien", 50: "cincuenta", 35: "treintaycinco", 7: "siete", 3: "tres" };
const ALIAS = { cloud: "claude", clod: "claude", baddai: "vadai", badai: "vadai", vadái: "vadai", badái: "vadai", "badday": "vadai", drive: "drive", draiv: "drive" };
const norm = (s) => {
  let x = s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ ]/g, " ");
  return x.split(/\s+/).filter(Boolean).map((w) => NUM[w] || ALIAS[w] || w).join(" ").replace(/treinta y cinco/g, "treintaycinco").split(" ");
};

let mal = 0;
for (const id of ids) {
  const t = TOMAS.find((x) => x.id === id);
  const mp3 = join(voz, `${id}.mp3`);
  if (!existsSync(mp3)) { console.log(`${id}: falta el audio`); mal++; continue; }
  execFileSync("npx", ["--yes", "hyperframes@0.8.140", "transcribe", `${id}.mp3`, "--model", "medium", "--language", "es"], { cwd: voz, stdio: "ignore", shell: true });
  renameSync(join(voz, "transcript.json"), join(voz, `${id}.json`));
  const palabras = JSON.parse(readFileSync(join(voz, `${id}.json`), "utf8"));
  const oido = norm(palabras.map((w) => w.text).join(" "));
  const guion = norm(t.vo);
  const igual = oido.join(" ") === guion.join(" ");
  if (!igual) mal++;
  console.log(`${id}: ${igual ? "OK " : "DIFIERE"} · ${palabras[0]?.start.toFixed(2)}–${palabras.at(-1)?.end.toFixed(2)} s · ${palabras.map((w) => w.text).join(" ")}`);
  if (!igual) console.log(`     guion: ${guion.join(" ")}\n     oído:  ${oido.join(" ")}`);
}
process.exit(mal ? 1 : 0);
