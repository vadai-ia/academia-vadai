// v2 · sonda de construcción: sirve el proyecto, abre una composición 2D en Chrome sin cabeza, espera
// la construcción, busca cada tiempo y reporta errores de página y de consola (ERRORES E36: un snapshot
// «bien guardado» no prueba que la construcción terminó). Usa el puppeteer-core y el Chrome que ya
// trae HyperFrames en la caché de npx.
//   node scripts/v2-sonda.mjs [composición.html] [t1,t2,…]
import http from "node:http";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, extname, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { homedir } from "node:os";
const cache = join(process.env.LOCALAPPDATA || join(homedir(), "AppData/Local"), "npm-cache/_npx");
const conPpt = readdirSync(cache).map((d) => join(cache, d, "node_modules")).find((d) => existsSync(join(d, "puppeteer-core")));
if (!conPpt) throw new Error("sonda: no encontré puppeteer-core en la caché de npx (corre una vez npx hyperframes)");
const puppeteer = createRequire(conPpt + "/")("puppeteer-core");
const base = join(homedir(), ".cache/puppeteer/chrome-headless-shell");
const ver = existsSync(base) ? readdirSync(base).sort().at(-1) : null;
const chrome = ver && join(base, ver, "chrome-headless-shell-win64/chrome-headless-shell.exe");
if (!chrome || !existsSync(chrome)) throw new Error("sonda: no encontré chrome-headless-shell en ~/.cache/puppeteer");
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const comp = process.argv[2] || "v2-2d.html", tiempos = (process.argv[3] || "1,12.5").split(",").map(Number);
const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".ttf": "font/ttf", ".svg": "image/svg+xml", ".png": "image/png", ".m4a": "audio/mp4", ".json": "application/json" };
const srv = http.createServer((q, r) => { const f = join(raiz, decodeURIComponent(q.url.split("?")[0])); if (!existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": TIPOS[extname(f)] || "application/octet-stream" }); r.end(readFileSync(f)); }).listen(0);
const port = srv.address().port;
const nav = await puppeteer.launch({ executablePath: chrome, args: ["--no-sandbox"] });
const p = await nav.newPage();
await p.setViewport({ width: 1920, height: 1080 });
let nCons = 0; p.on("console", (m) => { if (nCons++ < 8) console.log("consola:", m.type(), m.text(), JSON.stringify(m.location()), JSON.stringify(m.stackTrace().slice(0, 4))); });
p.on("pageerror", (e) => console.log("ERROR de página:", e.message));
await p.evaluateOnNewDocument(() => { window.__timelines = {}; });
await p.goto(`http://localhost:${port}/${comp}`, { waitUntil: "networkidle0" });
await p.evaluate(() => window.__hf.buildReady.trazo);
for (const t of tiempos) {
  const r = await p.evaluate((t) => { try { window.__tl.seek(t); window.dispatchEvent(new CustomEvent("hf-seek", { detail: { time: t } })); return "ok"; } catch (e) { return "THROW " + e.message + "\n" + e.stack; } }, t);
  if (r !== "ok") console.log(t, r);
}
await nav.close(); srv.close();
console.log(`sonda: ${tiempos.length} tiempos revisados en ${comp}`);
