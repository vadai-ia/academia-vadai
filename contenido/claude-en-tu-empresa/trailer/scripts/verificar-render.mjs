// Revisa un render cuadro por cuadro y falla si alguno salió vacío.
// Nació en 0b (7-oct-2026): un render reportó "completo" con 108 de 180 cuadros sin canvas.
// Un cuadro roto es un plano navy casi uniforme; todo cuadro real tiene algo claro (barro,
// chispa, tipografía, tarjeta final), así que se mide el rango de luminancia del cuadro entero.
//   node scripts/verificar-render.mjs renders/x.mp4 [rangoMinimo=120]
import { execFileSync } from "node:child_process";

const [archivo, umbralTxt] = process.argv.slice(2);
if (!archivo) { console.error("uso: node scripts/verificar-render.mjs <video> [umbral]"); process.exit(2); }
const umbral = Number(umbralTxt ?? 120);
const salida = execFileSync("ffmpeg", [
  "-v", "error", "-i", archivo,
  "-vf", "scale=480:-1,signalstats,metadata=print:file=-",
  "-f", "null", "-",
], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const ymax = [...salida.matchAll(/YMAX=(\d+)/g)].map((m) => Number(m[1]));
const ymin = [...salida.matchAll(/YMIN=(\d+)/g)].map((m) => Number(m[1]));
const rotos = ymax.map((v, i) => [i, v - ymin[i]]).filter(([, v]) => v < umbral);
console.log(JSON.stringify({ archivo, cuadros: ymax.length, rotos: rotos.length, primeros: rotos.slice(0, 10).map(([i]) => i), tramos: rotos.reduce((a, [i]) => { const u = a.at(-1); if (u && i === u[1] + 1) u[1] = i; else a.push([i, i]); return a; }, []).map(([a, b]) => `${(a / 60).toFixed(2)}–${(b / 60).toFixed(2)} s`) }));
process.exit(rotos.length ? 1 : 0);
