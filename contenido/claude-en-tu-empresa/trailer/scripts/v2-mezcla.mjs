// v2 · mezcla por versión (plática / curso): voz de la toma única, canción m1 (retrasada para que su
// golpe caiga en «método»), SFX de la hoja de cues compartida (v2/cues.js). Música ~19 dB bajo la
// voz mientras habla, sube entre frases. Master −14 LUFS, pico real ≤ −1 dBTP. Stems aparte.
//   node scripts/v2-mezcla.mjs [platica|curso ...]
import { execFileSync, spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tiempos, MUSICA_RETRASO } from "../v2/tiempos.js";
import { cues } from "../v2/cues.js";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const M = join(raiz, "assets/v2/mezcla");
mkdirSync(M, { recursive: true });
const SR = 48000;
// efectos: archivo y su medida (scripts/sfx-medir.py → assets/sfx/medidas.json)
const F = {
  tick: "codigo/tick.wav", pop: "codigo/pop.wav", contador: "codigo/contador.wav", campanita: "codigo/campanita.wav",
  pulso: "codigo/pulso.wav", marcador: "codigo/marcador.wav",
  llave1: "ia/llave-1.mp3", impacto1: "ia/impacto-1.mp3", impacto2: "ia/impacto-2.mp3",
  swell1: "ia/swell-1.mp3", swell2: "ia/swell-2.mp3", hielo: "ia/hielo.mp3",
  whoosh1: "v2/whoosh-1.mp3", whoosh2: "v2/whoosh-2.mp3", whoosh3: "v2/whoosh-3.mp3", blip: "v2/blip-2.mp3",
  teclado: "v2/teclado.mp3", ping1: "v2/ping-1.mp3", ping2: "v2/ping-2.mp3", golpePapel: "v2/golpe-papel.mp3",
  latido: "v2/latido.mp3", riser: "v2/riser.mp3", brillo1: "v2/brillo-1.mp3", brillo2: "v2/brillo-2.mp3",
  clic: "v2/clic.mp3", giro: "v2/giro.mp3", glitch1: "v2/glitch-1.mp3", glitch2: "v2/glitch-2.mp3",
  plumon1: "v2/plumon-1.mp3", plumon3: "v2/plumon-3.mp3", murmullo: "v2/murmullo.mp3",
  vidrio1: "v2/vidrio-1.mp3", vidrio2: "v2/vidrio-2.mp3", monedas: "v2/monedas.mp3", pasos: "v2/pasos.mp3",
  sello: "v2/sello.mp3", reloj: "v2/reloj.mp3", chats: "v2/chats.mp3", multitud: "v2/multitud.mp3", foco: "v2/foco.mp3",
  gota: "v3/gota.mp3", thock: "v3/thock.mp3", sticker: "v3/sticker.mp3", arcilla: "v3/arcilla.mp3",
};
const MEDIDAS = JSON.parse(readFileSync(join(raiz, "assets/sfx/medidas.json"), "utf8"));
const REF = -30;
// la canción ya editada a la voz (scripts/v2-musica-editar.py): trae su propio retraso
const MUSICA_DE = (v) => `assets/v2/musica/n5-editada-${v}.wav`;   // nivel RMS del cuerpo de un efecto con db 0 (la voz va a −16 LUFS)
const ffm = (args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args]);
const medir = (f) => JSON.parse(spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", f, "-af", "loudnorm=print_format=json", "-f", "null", "-"], { encoding: "utf8" }).stderr.match(/\{[\s\S]*\}/)[0]);
const wavF32 = (ruta, d) => {
  const b = Buffer.alloc(44 + d.length * 4);
  b.write("RIFF", 0); b.writeUInt32LE(36 + d.length * 4, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(3, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(32, 34);
  b.write("data", 36); b.writeUInt32LE(d.length * 4, 40);
  for (let i = 0; i < d.length; i++) b.writeFloatLE(d[i], 44 + i * 4);
  writeFileSync(ruta, b);
};

// node scripts/v2-mezcla.mjs [3d|2d] [platica|curso] … (sin argumentos: las cuatro)
const args = process.argv.slice(2);
const estilos = args.filter((a) => a === "3d" || a === "2d" || a === "v3"), cierres = args.filter((a) => a === "platica" || a === "curso");
for (const v of cierres.length ? cierres : ["platica", "curso"]) for (const estilo of estilos.length ? estilos : ["3d", "2d"]) {
  const T = await tiempos(v);
  const DURACION = T.duracion;
  const { S, C } = cues(T, estilo);
  const id = `${estilo}-${v}`;
  // curva de la música: −17 dB bajo la voz mientras habla, −7 entre frases (respecto de su cama)
  const habla = [];
  for (const ws of T.porFrase) for (const w of ws) { const u = habla.at(-1); if (u && w.start - u[1] < 0.45) u[1] = w.end; else habla.push([w.start, w.end]); }
  const n = Math.round(DURACION * SR), env = new Float32Array(n);
  // 9-oct (nota de Alejandro: «le falta fuerza e impacto a la música»): bajo la voz −9 dB (antes −17),
  // entre frases −2. Y el golpe de tráiler: de «sé honesto» a «método» la música casi desaparece
  // (−20 dB más) y regresa completa, de golpe, en «método».
  const SIL0 = C.honesto - 0.3, SIL1 = C.metodo - 0.04;
  let g = -2;
  const kAb = 1 - Math.exp(-1 / (0.12 * SR)), kSu = 1 - Math.exp(-1 / (0.45 * SR)), kSil = 1 - Math.exp(-1 / (0.6 * SR));
  let sil = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let o = -2;
    for (const [a, b] of habla) if (t >= a - 0.12 && t < b + 0.2) { o = -9; break; }
    g += (o - g) * (o < g ? kAb : kSu);
    // 10-oct: con la toma G los compases que caen en el silencio son los del crescendo (antes los quietos):
    // −28 en vez de −20 para que siga «casi desapareciendo» como en la versión aprobada
    const objetivo = t >= SIL0 && t < SIL1 ? -28 : 0;
    sil = t >= SIL1 && t < SIL1 + 0.01 ? 0 : sil + (objetivo - sil) * kSil;   // regreso instantáneo en «método»
    const tension = t < SIL0 ? 5 : 0;   // la primera mitad de la canción es tenue de origen: +5 dB
    env[i] = Math.pow(10, (g + sil + tension) / 20);
  }
  wavF32(join(M, `curva-${v}.wav`), env);
  const Lv = +medir(join(M, `voz-${v}.wav`)).input_i, Lm = +medir(join(raiz, MUSICA_DE(v))).input_i;
  ffm(["-i", join(M, `voz-${v}.wav`), "-af", `volume=${(-16 - Lv).toFixed(2)}dB,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,apad=whole_dur=${DURACION},atrim=0:${DURACION}`, "-c:a", "pcm_f32le", join(M, `stem-voz-${v}.wav`)]);
  ffm(["-i", join(raiz, MUSICA_DE(v)), "-i", join(M, `curva-${v}.wav`), "-filter_complex",
    `[0:a]aresample=48000,volume=${(-16 - Lm).toFixed(2)}dB,aformat=sample_fmts=fltp:channel_layouts=stereo,adelay=${Math.round(MUSICA_RETRASO * 1000)}:all=1,apad=whole_dur=${DURACION},atrim=0:${DURACION}[m];[1:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[e];[m][e]amultiply[o]`,
    "-map", "[o]", "-c:a", "pcm_f32le", join(M, `stem-musica-${v}.wav`)]);
  // cada archivo entra una sola vez y se reparte con asplit; el grafo va en un archivo (10-oct: con 170
  // efectos la línea de comando pasaba del límite de Windows, ENAMETOOLONG)
  const ent = [], ramas = [], usos = {};
  for (const x of S) usos[x.f] = (usos[x.f] || 0) + 1;
  const archivos = Object.keys(usos), cuenta = {};
  archivos.forEach((f, k) => {
    if (!MEDIDAS[F[f]]) throw new Error(`mezcla: efecto sin medida ${f}`);
    ent.push("-i", join("assets/sfx", F[f]));
    ramas.push(`[${k}:a]asplit=${usos[f]}${Array.from({ length: usos[f] }, (_, j) => `[e${k}_${j}]`).join("")}`);
  });
  S.forEach((x, i) => {
    const m = MEDIDAS[F[x.f]];
    const k = archivos.indexOf(x.f), j = (cuenta[x.f] = (cuenta[x.f] ?? -1) + 1);
    const r = Math.pow(2, x.tono / 12);
    const ancla = ((x.ancla === "pico" ? m.pico : m.inicio) - x.recorte) / r;   // dónde cae el evento dentro del efecto
    const ini = Math.max(0, x.t - Math.max(0, ancla));
    const cadena = [
      x.recorte ? `atrim=start=${x.recorte},asetpts=PTS-STARTPTS` : null,
      x.tono ? `asetrate=${SR}*${r.toFixed(5)},aresample=${SR}` : `aresample=${SR}`,
      x.dur ? `atrim=0:${x.dur},afade=t=out:st=${Math.max(0, x.dur - 0.25)}:d=0.25` : null,
      "aformat=sample_fmts=fltp:channel_layouts=stereo",
      `volume=${(REF + x.db - m.rms_db).toFixed(1)}dB`,
      `adelay=${Math.round(ini * 1000)}:all=1`,
    ].filter(Boolean).join(",");
    ramas.push(`[e${k}_${j}]${cadena}[s${i}]`);
  });
  const grafo = join(M, `grafo-sfx-${id}.txt`);
  writeFileSync(grafo, `${ramas.join(";\n")};\n${S.map((_, i) => `[s${i}]`).join("")}amix=inputs=${S.length}:normalize=0:dropout_transition=0,apad=whole_dur=${DURACION},atrim=0:${DURACION}[s]`);
  execFileSync("ffmpeg", ["-v", "error", "-y", ...ent, "-filter_complex_script", grafo, "-map", "[s]", "-c:a", "pcm_f32le", join(M, `stem-sfx-${id}.wav`)], { cwd: raiz });
  ffm(["-i", join(M, `stem-voz-${v}.wav`), "-i", join(M, `stem-musica-${v}.wav`), "-i", join(M, `stem-sfx-${id}.wav`), "-filter_complex", "[0:a][1:a][2:a]amix=inputs=3:normalize=0:dropout_transition=0[o]", "-map", "[o]", "-c:a", "pcm_f32le", join(M, `suma-${id}.wav`)]);
  // ganancia para −14 LUFS y un limitador de pico (los golpes de efectos y el acorde final
  // impedían llegar con normalización lineal pura); luego se verifica pico real ≤ −1 dBTP
  let g0 = -14 - +medir(join(M, `suma-${id}.wav`)).input_i;
  for (let it = 0; it < 5; it++) {
    ffm(["-i", join(M, `suma-${id}.wav`), "-af", `volume=${g0.toFixed(2)}dB,aresample=192000,alimiter=limit=0.83:attack=3:release=60:level=disabled,aresample=48000`, "-ar", "48000", "-c:a", "pcm_s24le", join(M, `master-${id}.wav`)]);
    const L = +medir(join(M, `master-${id}.wav`)).input_i;
    if (Math.abs(L + 14) <= 0.3) break;
    g0 += -14 - L;
  }
  ffm(["-i", join(M, `master-${id}.wav`), "-c:a", "aac", "-b:a", "256k", join(M, `master-${id}-previa.m4a`)]);
  const fin = medir(join(M, `master-${id}.wav`));
  console.log(`${id}: ${S.length} efectos · master ${(+fin.input_i).toFixed(1)} LUFS · pico real ${(+fin.input_tp).toFixed(1)} dBTP`);
}
