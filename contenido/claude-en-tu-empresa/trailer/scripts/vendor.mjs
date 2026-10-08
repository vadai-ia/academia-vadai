// Copia al proyecto todo lo que el render necesita, para que nada se pida a la red
// ni a node_modules mientras se renderiza. Se corre tras `npm install`: `npm run vendor`.
//
//   vendor/        librerías (three, postprocessing, gsap) — generado, no se versiona
//   assets/fonts/  Anton, Inter y JetBrains Mono: los mismos archivos que usan los decks
//   assets/marca/  logos oficiales y la chispa del curso
//   estilo/tokens.css  generado de estilo/marca.json (la única definición de estilo)
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(raiz, "../../..");
const nm = join(raiz, "node_modules");
const skill = join(repo, ".claude/skills/presentacion-vadai/activos");
const dropbox = "C:/Users/Alejandro Martinez/Dropbox/Alejandro Martinez/VADAI/BRANDING VADAI";

function copiar(origen, destino) {
  if (!existsSync(origen)) throw new Error(`vendor: no existe ${origen}`);
  mkdirSync(dirname(destino), { recursive: true });
  cpSync(origen, destino, { recursive: true });
}

rmSync(join(raiz, "vendor"), { recursive: true, force: true });
copiar(join(nm, "three/build/three.module.js"), join(raiz, "vendor/three/build/three.module.js"));
copiar(join(nm, "three/build/three.core.js"), join(raiz, "vendor/three/build/three.core.js"));
for (const d of ["geometries", "loaders", "utils", "libs/draco", "libs/meshopt_decoder.module.js", "libs/opentype.module.js", "environments", "curves", "math", "lights", "shaders", "postprocessing"]) {
  const o = join(nm, "three/examples/jsm", d);
  if (existsSync(o)) copiar(o, join(raiz, "vendor/three/addons", d));
}
copiar(join(nm, "postprocessing/build/index.js"), join(raiz, "vendor/postprocessing/index.js"));
for (const f of ["gsap.min.js", "CustomEase.min.js", "SplitText.min.js", "MotionPathPlugin.min.js", "MorphSVGPlugin.min.js", "DrawSVGPlugin.min.js"]) {
  copiar(join(nm, "gsap/dist", f), join(raiz, "vendor/gsap", f));
}
copiar(join(nm, "opentype.js/dist/opentype.mjs"), join(raiz, "vendor/opentype/opentype.mjs"));

for (const f of ["Anton-Regular.ttf", "Inter-Variable.ttf", "JetBrainsMono-Variable.ttf", "README.md"]) {
  copiar(join(skill, "tipografias", f), join(raiz, "assets/fonts", f));
}
copiar(join(skill, "marca/claude-simple-icons.svg"), join(raiz, "assets/marca/chispa.svg"));
copiar(join(skill, "marca/totalcoach-logo-1200.png"), join(raiz, "assets/marca/totalcoach.png"));
// Logos de VADAI: los que Alejandro señaló como oficiales (7-oct-2026). Si Dropbox no
// está, se conservan los que ya se copiaron.
const vadai = {
  "LOGO VADAI TECNOLOGIA 1.png": "vadai-horizontal.png",
  "LOGO VADAI TECNOLOGIA 2.png": "vadai-sello.png",
  "LOGO VADAI TECNOLOGIA 3.jpg": "vadai-sello-fondo.jpg",
  "vadai_favicon.png": "vadai-isotipo.png",
};
for (const [o, d] of Object.entries(vadai)) {
  if (existsSync(join(dropbox, o))) copiar(join(dropbox, o), join(raiz, "assets/marca", d));
}

// tokens.css: variables de color y @font-face, generados de la definición única.
const marca = JSON.parse(readFileSync(join(raiz, "estilo/marca.json"), "utf8"));
const vars = Object.entries(marca.color).map(([k, v]) => `  --${k}: ${v.hex};`).join("\n");
const css = `/* GENERADO por scripts/vendor.mjs desde estilo/marca.json. No editar a mano. */
/* Las @font-face van en cada composición: HyperFrames exige que vivan en el mismo archivo. */
:root {
${vars}
  --cielo: linear-gradient(${marca.gradiente.heroe.angulo}deg, ${marca.gradiente.heroe.de}, ${marca.gradiente.heroe.a});
}
`;
writeFileSync(join(raiz, "estilo/tokens.css"), css);
console.log("vendor: listo");
