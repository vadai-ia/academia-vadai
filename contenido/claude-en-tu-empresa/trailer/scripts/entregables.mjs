// Arma los entregables (brief §8, MOTION-RULES 18) a partir de los renders:
//   renders/master-limpio-1080p60.mp4   (capas=limpio)
//   renders/pase-subs.mov               (capas=subs, alfa)
//   renders/pase-ui.mov, pase-mundo.mp4 (pases para After Effects)
//   renders/master-limpio-4k.mp4        (opcional)
// El audio sale siempre del WAV maestro (assets/mezcla/master.wav), no del render.
//   node scripts/entregables.mjs [paso...]   pasos: masters web poster hoja previas capas audio
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { TOMAS } from "../estilo/guion.js";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const R = (f) => join(raiz, "renders", f);
const E = (f) => join(raiz, "renders/entregables", f);
const NOMBRE = "claude-en-tu-empresa-trailer";
const AUDIO = join(raiz, "assets/mezcla/master.wav");
const FUENTE = join(raiz, "assets/fonts/JetBrainsMono-Variable.ttf").replace(/\\/g, "/").replace(":", "\\:");
mkdirSync(E(""), { recursive: true });
const ff = (args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: ["ignore", "inherit", "inherit"] });
const pasos = process.argv.slice(2).length ? process.argv.slice(2) : ["masters", "web", "poster", "hoja", "previas", "capas", "audio"];
const mb = (f) => (statSync(f).size / 1048576).toFixed(1) + " MB";

if (pasos.includes("masters")) {
  // master limpio con el audio maestro (video copiado tal cual)
  ff(["-i", R("master-limpio-1080p60.mp4"), "-i", AUDIO, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-shortest", "-movflags", "+faststart", E(`${NOMBRE}-limpio-1080p60.mp4`)]);
  console.log("limpio 1080p:", mb(E(`${NOMBRE}-limpio-1080p60.mp4`)));
  // con subtítulos: el pase de subtítulos (alfa) sobre el limpio, recodificado a la calidad del master
  if (existsSync(R("pase-subs.mov"))) {
    ff(["-i", R("master-limpio-1080p60.mp4"), "-i", R("pase-subs.mov"), "-i", AUDIO, "-filter_complex", "[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[v]", "-map", "[v]", "-map", "2:a",
      "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-tune", "grain", "-profile:v", "high", "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-shortest", "-movflags", "+faststart", E(`${NOMBRE}-subtitulado-1080p60.mp4`)]);
    console.log("subtitulado 1080p:", mb(E(`${NOMBRE}-subtitulado-1080p60.mp4`)));
  }
  if (existsSync(R("master-limpio-4k.mp4"))) {
    ff(["-i", R("master-limpio-4k.mp4"), "-i", AUDIO, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-shortest", "-movflags", "+faststart", E(`${NOMBRE}-limpio-4k60.mp4`)]);
    console.log("limpio 4K:", mb(E(`${NOMBRE}-limpio-4k60.mp4`)));
  }
}
if (pasos.includes("web")) {
  // para la web: con subtítulos, CRF más alto (MOTION-RULES 9: el grano infla el peso)
  const src = existsSync(E(`${NOMBRE}-subtitulado-1080p60.mp4`)) ? E(`${NOMBRE}-subtitulado-1080p60.mp4`) : E(`${NOMBRE}-limpio-1080p60.mp4`);
  ff(["-i", src, "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-tune", "grain", "-maxrate", "14M", "-bufsize", "28M", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", E(`${NOMBRE}-web-1080p60.mp4`)]);
  console.log("web:", mb(E(`${NOMBRE}-web-1080p60.mp4`)));
}
if (pasos.includes("poster")) {
  // póster: el título de 05 sobre el edificio completo
  const src = existsSync(R("master-limpio-4k.mp4")) ? R("master-limpio-4k.mp4") : R("master-limpio-1080p60.mp4");
  ff(["-ss", "32.6", "-i", src, "-frames:v", "1", E(`${NOMBRE}-poster.png`)]);
  console.log("póster listo");
}
if (pasos.includes("hoja")) {
  // hoja de cuadros: un still por toma (en su clímax visual), 5×3, con número y tiempo
  const momento = { "01": 2.2, "02": 9.9, "03": 16.6, "04": 21.0, "05": 32.6, "06": 39.9, "07": 55.0, "08": 66.8, "09": 86.4, "10": 98.9, "11": 106.4, "12": 120.2, "13": 131.6, "14": 140.8, "15": 147.5 };
  const ins = [], filtros = [];
  TOMAS.forEach((t, i) => {
    ins.push("-ss", String(momento[t.id]), "-i", R("master-limpio-1080p60.mp4"));
    filtros.push(`[${i}:v]trim=end_frame=1,scale=640:360,drawbox=x=0:y=0:w=150:h=44:color=0x0A1A2F@0.85:t=fill,drawtext=fontfile='${FUENTE}':text='${t.id}  ${momento[t.id].toFixed(1)}s':x=12:y=11:fontsize=22:fontcolor=white[f${i}]`);
  });
  const lay = TOMAS.map((_, i) => `${(i % 5) * 640}_${Math.floor(i / 5) * 360}`).join("|");
  ff([...ins, "-filter_complex", `${filtros.join(";")};${TOMAS.map((_, i) => `[f${i}]`).join("")}xstack=inputs=15:layout=${lay}:fill=0x0A1A2F[o]`, "-map", "[o]", "-frames:v", "1", E(`${NOMBRE}-hoja-de-cuadros.png`)]);
  console.log("hoja de cuadros lista");
}
if (pasos.includes("previas")) {
  // MOTION-RULES 18: previa 720p y hoja a 4 fps por toma
  mkdirSync(E("revision"), { recursive: true });
  const src = existsSync(E(`${NOMBRE}-subtitulado-1080p60.mp4`)) ? E(`${NOMBRE}-subtitulado-1080p60.mp4`) : E(`${NOMBRE}-limpio-1080p60.mp4`);
  ff(["-i", src, "-vf", "scale=1280:720:flags=lanczos", "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", E(`revision/${NOMBRE}-previa-720p.mp4`)]);
  for (const t of TOMAS) {
    const d = t.fin - t.inicio, n = Math.ceil(d * 4), cols = 6, filas = Math.ceil(n / cols);
    ff(["-ss", String(t.inicio), "-t", String(d), "-i", src, "-vf", `fps=4,scale=320:-1,drawtext=fontfile='${FUENTE}':text='%{pts\\:hms}':x=6:y=6:fontsize=13:fontcolor=white:box=1:boxcolor=0x0A1A2F@0.7,tile=${cols}x${filas}:padding=3:color=0x0A1A2F`, "-frames:v", "1", E(`revision/toma-${t.id}-4fps.png`)]);
  }
  console.log("previa 720p y 15 hojas a 4 fps");
}
if (pasos.includes("capas")) {
  // pases por capas para After Effects, cortados por toma (ProRes 4444 conserva el alfa)
  mkdirSync(E("capas-after-effects"), { recursive: true });
  for (const t of TOMAS) {
    const dir = E(`capas-after-effects/toma-${t.id}`);
    mkdirSync(dir, { recursive: true });
    const d = (t.fin - t.inicio).toFixed(3);
    if (existsSync(R("pase-mundo.mp4"))) ff(["-ss", String(t.inicio), "-t", d, "-i", R("pase-mundo.mp4"), "-c:v", "prores_ks", "-profile:v", "3", "-pix_fmt", "yuv422p10le", join(dir, "1-mundo-3d.mov")]);
    if (existsSync(R("pase-ui.mov"))) ff(["-ss", String(t.inicio), "-t", d, "-i", R("pase-ui.mov"), "-c:v", "prores_ks", "-profile:v", "4", "-pix_fmt", "yuva444p10le", join(dir, "2-tipografia-y-ui-alfa.mov")]);
    if (existsSync(R("pase-subs.mov"))) ff(["-ss", String(t.inicio), "-t", d, "-i", R("pase-subs.mov"), "-c:v", "prores_ks", "-profile:v", "4", "-pix_fmt", "yuva444p10le", join(dir, "3-subtitulos-alfa.mov")]);
  }
  console.log("capas por toma listas");
}
if (pasos.includes("audio")) {
  mkdirSync(E("audio"), { recursive: true });
  for (const [o, d] of [["master.wav", "master-14LUFS.wav"], ["stem-voz-final.wav", "stem-voz.wav"], ["stem-musica-final.wav", "stem-musica.wav"], ["stem-sfx-final.wav", "stem-sfx.wav"]]) copyFileSync(join(raiz, "assets/mezcla", o), E(`audio/${d}`));
  console.log("audio y stems copiados");
}
