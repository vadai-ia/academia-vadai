// Mezcla final (MOTION-RULES, audio 5). Narración al frente; música como cama que baja ~19 dB
// mientras la voz habla y sube entre frases; SFX debajo de la voz y solo en eventos que importan.
// Master a −14 LUFS integrados y pico real ≤ −1 dBTP. Exporta stems: voz, música, SFX.
//   node scripts/mezcla.mjs
// Los tiempos de cada efecto salen de las mismas palabras y pulsos que su evento visual
// (tomas/*.js); si una toma cambia un ancla, se cambia aquí también.
import { execFileSync, spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { palabra as p, B, COMPAS, FASE, PALABRAS, TOMAS, DURACION } from "../estilo/guion.js";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const M = join(raiz, "assets/mezcla");
mkdirSync(M, { recursive: true });
const PULSO = COMPAS / 4;
const beat = (t) => FASE + Math.round((t - FASE) / PULSO) * PULSO;
const SR = 48000;

// ---------- lista de efectos (archivo, tiempo, ganancia en dB relativa) ----------
const F = {
  tick: "assets/sfx/codigo/tick.wav", pop: "assets/sfx/codigo/pop.wav", contador: "assets/sfx/codigo/contador.wav",
  campanita: "assets/sfx/codigo/campanita.wav", pulso: "assets/sfx/codigo/pulso.wav", marcador: "assets/sfx/codigo/marcador.wav",
  llave1: "assets/sfx/ia/llave-1.mp3", llave2: "assets/sfx/ia/llave-2.mp3", impacto1: "assets/sfx/ia/impacto-1.mp3", impacto2: "assets/sfx/ia/impacto-2.mp3",
  swell1: "assets/sfx/ia/swell-1.mp3", swell2: "assets/sfx/ia/swell-2.mp3", hielo: "assets/sfx/ia/hielo.mp3", sobre: "assets/sfx/ia/sobre.mp3",
};
const S = [];
const sfx = (f, t, db = 0, recorte = 0) => S.push({ f, t, db, recorte });
// 01 · la chispa enciende en el primer pulso
sfx("pulso", beat(0.45), -2);
// 02 · los tres tramos del ciclo y las dos notificaciones
[5.9, 7.7, 9.5].forEach((t) => sfx("pop", beat(t), -10));
[10.9, 11.5].forEach((t) => sfx("pop", beat(t), -8));
// 03 · seis puntos se encienden
for (let k = 0; k < 6; k++) sfx("tick", p("03", "100") + 0.15 + k * 0.11, -12);
// 04 · golpe en «método» y swell que remata en el corte héroe a 05
sfx("impacto2", p("04", "método."), -3);
sfx("swell1", B(10) - 3.0, -9);
// 05 · el título aterriza; chips
sfx("impacto1", p("05", "Claude", 1), -4);
["Excel,", "Word", "correo"].forEach((w) => sfx("pop", p("05", w), -9));
// 06 · cuatro interruptores en el pulso
for (let i = 0; i < 4; i++) sfx("tick", beat(p("06", "cuatro") + 0.3) + i * PULSO, -6);
// 07 · las letras caen; la etiqueta de la O
["perfil,", "acción,", "contexto,", "tono", "omisiones,"].forEach((w) => sfx("pop", p("07", w), -9));
sfx("tick", p("07", "letra"), -6);
// 08 · artefactos que salen de la chispa, recálculo y conteo
sfx("pop", p("08", "Excel"), -7);
sfx("contador", p("08", "vivas,") - 0.25, -12);
sfx("pop", p("08", "tablero"), -7);
sfx("contador", p("08", "tablero") + 0.2, -12);
sfx("pop", p("08", "documento"), -7);
sfx("swell2", B(31) - 3.0, -9); // héroe 08→09: cruzar la ventana
// 09 · la llave en cada conector, la escarcha, los borradores, «nadie envía nada»
[p("09", "Drive,"), p("09", "correo,"), p("09", "calendario."), beat(p("09", "calendario.") + 0.75)].forEach((t, i) => sfx(i % 2 ? "llave2" : "llave1", t - 0.06, -8));
sfx("hielo", p("09", "Con") - 0.45, -12);
for (let i = 0; i < 5; i++) sfx("pop", p("09", "borradores…") - 0.35 + i * 0.17, -14);
sfx("tick", p("09", "nadie"), -6);
// 10 · tres palomitas, se dobla en habilidad, entra el cartucho
for (let i = 0; i < 3; i++) sfx("tick", beat(p("10", "tres") - 0.4) + i * PULSO, -5);
sfx("pop", p("10", "deja") + 0.2, -8);
sfx("marcador", p("10", "prompt.") + 0.75, -6);
// 11 · las 7:00 en punto, el sobre llega, campanita
sfx("tick", p("11", "siete,"), -5);
sfx("sobre", p("11", "llega") - 0.12, -6);
sfx("campanita", p("11", "llega") + 0.05, -9);
// 12 · tres marcadores, la matriz, el ganador, la cascada
[p("12", "problemas"), p("12", "problemas") + 0.5, p("12", "reales…") + 0.3].forEach((t) => sfx("marcador", t, -6));
for (let i = 0; i < 5; i++) sfx("tick", p("12", "decides") + 0.1 + i * 0.13, -14);
sfx("contador", p("12", "decides") + 0.5, -13);
sfx("pop", p("12", "primero", 2), -6);
for (let i = 0; i < 7; i++) sfx("tick", B(51) - 1.35 + i * 0.16, -12 + i * 0.6);
// 13 · entregables y conteos; héroe 13→14
[p("13", "manual"), p("13", "cincuenta"), p("13", "habilidades"), p("13", "listas") + 0.25].forEach((t) => sfx("pop", t, -8));
sfx("contador", p("13", "cincuenta"), -12);
sfx("contador", p("13", "habilidades"), -12);
sfx("pop", p("13", "respaldo"), -9);
sfx("swell1", B(56) - 3.0, -10);
// 14 · golpe en «método» con un swell corto que remata en el corte
sfx("swell2", p("14", "método.") - 0.7, -11, 2.3);
sfx("impacto2", p("14", "método."), -3);
// 15 · la chispa se asienta; campanita del cierre
sfx("pulso", p("15", "Claude"), -4);
sfx("campanita", p("15", "Inscribe"), -8);

// ---------- curva de la música: baja bajo la voz, sube entre frases ----------
const habla = [];
for (const t of TOMAS) {
  for (const w of PALABRAS[t.id]) {
    const u = habla.at(-1);
    if (u && w.start - u[1] < 0.45) u[1] = w.end; else habla.push([w.start, w.end]);
  }
}
const ENTRE = -7, BAJO = -17; // dB respecto del nivel de cama
const silencio14 = [p("14", "Te", 2) - PULSO, p("14", "Te", 2) - 0.02];
const n = Math.round(DURACION * SR);
const env = new Float32Array(n);
const objetivo = (t) => {
  if (t >= silencio14[0] && t < silencio14[1]) return -45; // el pulso de casi-silencio (brief §4/§6)
  for (const [a, b] of habla) if (t >= a - 0.12 && t < b + 0.2) return BAJO;
  return ENTRE;
};
// suavizado: bajada en 120 ms, subida en 450 ms
let g = ENTRE;
const kAb = 1 - Math.exp(-1 / (0.12 * SR)), kSu = 1 - Math.exp(-1 / (0.45 * SR)), kSil = 1 - Math.exp(-1 / (0.03 * SR));
for (let i = 0; i < n; i++) {
  const o = objetivo(i / SR);
  g += (o - g) * (o < -40 || g < -40 ? kSil : o < g ? kAb : kSu);
  env[i] = Math.pow(10, g / 20);
}
const wav = (ruta, datos) => {
  const b = Buffer.alloc(44 + datos.length * 4);
  b.write("RIFF", 0); b.writeUInt32LE(36 + datos.length * 4, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(3, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(32, 34);
  b.write("data", 36); b.writeUInt32LE(datos.length * 4, 40);
  for (let i = 0; i < datos.length; i++) b.writeFloatLE(datos[i], 44 + i * 4);
  writeFileSync(ruta, b);
};
wav(join(M, "curva-musica.wav"), env);

// ---------- niveles ----------
const ffm = (args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args]);
// loudnorm imprime su medición en JSON por stderr
function loudnormJSON(archivo) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", archivo, "-af", "loudnorm=print_format=json", "-f", "null", "-"], { encoding: "utf8" });
  return JSON.parse(r.stderr.match(/\{[\s\S]*\}/)[0]);
}
// la voz a −16 LUFS; la cama de música a −16 LUFS antes de su curva
const Lv = loudnormJSON(join(M, "voz.wav")).input_i * 1;
const Lm = loudnormJSON(join(M, "musica.wav")).input_i * 1;
const gV = -16 - Lv, gM = -16 - Lm;
console.log(`voz ${Lv.toFixed(1)} LUFS → ${gV.toFixed(1)} dB · música ${Lm.toFixed(1)} LUFS → ${gM.toFixed(1)} dB`);

// stem de voz y de música (con su curva)
ffm(["-i", join(M, "voz.wav"), "-af", `volume=${gV.toFixed(2)}dB,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo`, "-c:a", "pcm_f32le", join(M, "stem-voz.wav")]);
ffm(["-i", join(M, "musica.wav"), "-i", join(M, "curva-musica.wav"), "-filter_complex",
  `[0:a]volume=${gM.toFixed(2)}dB,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[m];[1:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[e];[m][e]amultiply,atrim=0:${DURACION}[o]`,
  "-map", "[o]", "-c:a", "pcm_f32le", join(M, "stem-musica.wav")]);
// stem de SFX: cada efecto con su retardo y su ganancia; base ≈ 20 dB bajo la voz
const BASE_SFX = -22;
const ent = [], ramas = [];
S.forEach((x, i) => {
  ent.push("-i", join(raiz, F[x.f]));
  const recorte = x.recorte ? `atrim=start=${x.recorte},asetpts=PTS-STARTPTS,` : "";
  ramas.push(`[${i}:a]${recorte}aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume=${(BASE_SFX + x.db).toFixed(1)}dB,adelay=${Math.max(0, Math.round(x.t * 1000))}:all=1[s${i}]`);
});
const sumaS = `${S.map((_, i) => `[s${i}]`).join("")}amix=inputs=${S.length}:normalize=0:dropout_transition=0,apad=whole_dur=${DURACION},atrim=0:${DURACION}[sfx]`;
ffm([...ent, "-filter_complex", [...ramas, sumaS].join(";"), "-map", "[sfx]", "-c:a", "pcm_f32le", join(M, "stem-sfx.wav")]);
console.log(`efectos: ${S.length}`);

// suma y master: −14 LUFS integrados, pico real ≤ −1 dBTP (loudnorm lineal en dos pasadas)
ffm(["-i", join(M, "stem-voz.wav"), "-i", join(M, "stem-musica.wav"), "-i", join(M, "stem-sfx.wav"), "-filter_complex", "[0:a][1:a][2:a]amix=inputs=3:normalize=0:dropout_transition=0[o]", "-map", "[o]", "-c:a", "pcm_f32le", join(M, "suma.wav")]);
const m1 = loudnormJSON(join(M, "suma.wav"));
const filtro = `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${m1.input_i}:measured_TP=${m1.input_tp}:measured_LRA=${m1.input_lra}:measured_thresh=${m1.input_thresh}:offset=${m1.target_offset}:linear=true:print_format=json`;
ffm(["-i", join(M, "suma.wav"), "-af", filtro + ",aresample=48000", "-ar", "48000", "-c:a", "pcm_s24le", join(M, "master.wav")]);
// la misma ganancia estática a los stems, para que sumen igual que el master
const gFinal = -14 - m1.input_i * 1;
for (const st of ["voz", "musica", "sfx"]) ffm(["-i", join(M, `stem-${st}.wav`), "-af", `volume=${gFinal.toFixed(2)}dB`, "-c:a", "pcm_s24le", join(M, `stem-${st}-final.wav`)]);
const fin = loudnormJSON(join(M, "master.wav"));
console.log(`master: ${(+fin.input_i).toFixed(1)} LUFS integrados · pico real ${(+fin.input_tp).toFixed(1)} dBTP · LRA ${(+fin.input_lra).toFixed(1)}`);
writeFileSync(join(M, "efectos.json"), JSON.stringify(S.map((x) => ({ ...x, archivo: F[x.f] })), null, 1));
