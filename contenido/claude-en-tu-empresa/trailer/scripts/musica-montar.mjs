// Edita la canción a la imagen (MOTION-RULES audio 3): segmentos de compases enteros de la
// pista original, cortados 15 ms antes del tiempo fuerte con fundidos de 25 ms, colocados en la
// rejilla del video (estilo/guion.js → B(k)). Escribe assets/mezcla/musica.wav (150 s).
//   node scripts/musica-montar.mjs
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { B, DURACION } from "../estilo/guion.js";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fuente = join(raiz, "assets/musica/candidata-lyria.mp3");
const an = JSON.parse(readFileSync(join(raiz, "assets/musica/candidata-lyria.analisis.json"), "utf8"));
// la canción comparte rejilla con el video (el intro se usa tal cual): S(k) = B(k) sin el tope en 0
const S = (k) => -0.085 + 2.4036 * k;

// [compás del video desde, hasta) ← compás de la canción desde. `fin: true` deja correr la cola.
export const MAPA = [
  { de: 0, a: 8, s: 0, nota: "intro: problema, el ciclo de herramientas (01–03)" },
  // 8–9.75: silencio total, toma 04 (brief §6); el último pulso es el riser propio de la canción
  { de: 9.75, a: 10, s: 15.75, nota: "riser de la canción que remata en el corte a 05" },
  { de: 10, a: 22, s: 16, nota: "sección A: la revelación del título y el arranque del recorrido (05–07)" },
  { de: 22, a: 25, s: 29, nota: "quiebre: respiro en «lo que entra es lo que sale» (07)" },
  { de: 25, a: 37, s: 32, nota: "sección B: entra justo con los archivos (08–09)" },
  { de: 37, a: 47, s: 36, nota: "B, segunda pasada desde su frase 2: habilidades, corriendo solo, práctica (10–12)" },
  { de: 47, a: 56, s: 46, nota: "clímax: la matriz, la cascada de pisos y lo que te llevas (12–13)" },
  { de: 56, a: 59, s: 55, nota: "resolución: el escritorio tranquilo (14)" },
  { de: 59, a: 60, s: 53, nota: "regreso firme en el CTA (15)" },
  { de: 60, a: null, s: 59, fin: true, nota: "acorde final con su resonancia natural" },
];

const PRE = 0.015, FUNDIDO = 0.025;
const args = ["-v", "error", "-y", "-i", fuente];
const ramas = [];
MAPA.forEach((m, i) => {
  const filmIni = m.de === 0 ? 0 : B(m.de) - PRE;
  const songIni = m.de === 0 ? 0 : S(m.s) - PRE;
  const filmFin = m.a == null ? DURACION : B(m.a) - PRE;
  const dur = m.fin ? Math.min(DURACION - filmIni, an.duracion - songIni) : filmFin - filmIni;
  const salida = m.fin ? `afade=t=out:st=${(dur - 0.08).toFixed(3)}:d=0.08` : `afade=t=out:st=${(dur - FUNDIDO).toFixed(4)}:d=${FUNDIDO}`;
  // el corte antes del silencio de la toma 04 es seco: 60 ms
  const fOut = m.a === 8 ? `afade=t=out:st=${(dur - 0.06).toFixed(4)}:d=0.06` : salida;
  ramas.push(`[0:a]atrim=start=${songIni.toFixed(4)}:duration=${dur.toFixed(4)},asetpts=PTS-STARTPTS,aresample=48000,` +
    `afade=t=in:st=0:d=${m.de === 0 ? 0.001 : FUNDIDO},${fOut},adelay=${Math.round(filmIni * 1000)}:all=1[m${i}]`);
  console.log(`video ${filmIni.toFixed(2)}–${(filmIni + dur).toFixed(2)} ← canción ${songIni.toFixed(2)}–${(songIni + dur).toFixed(2)} · ${m.nota}`);
});
const suma = `${MAPA.map((_, i) => `[m${i}]`).join("")}amix=inputs=${MAPA.length}:normalize=0:dropout_transition=0,apad=whole_dur=${DURACION},atrim=0:${DURACION}[mus]`;
args.push("-filter_complex", [...ramas, suma].join(";"), "-map", "[mus]", "-c:a", "pcm_s24le", join(raiz, "assets/mezcla/musica.wav"));
execFileSync("ffmpeg", args);
console.log("musica.wav listo");
