// Subtítulos .srt (brief §7) de los mismos bloques que se queman en el video (estilo/guion.js).
//   node scripts/srt.mjs [salida.srt]
import { writeFileSync } from "node:fs";
import { subtitulos } from "../estilo/guion.js";

const destino = process.argv[2] || "renders/entregables/claude-en-tu-empresa-trailer.srt";
const ts = (s) => {
  const ms = Math.max(0, Math.round(s * 1000));
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), sec = Math.floor((ms % 60000) / 1000), r = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(r).padStart(3, "0")}`;
};
const bloques = subtitulos().map((b, i) => {
  const lineas = b.lineas.map((l) => l.map((k) => b.palabras[k].text).join(" "));
  return `${i + 1}\n${ts(b.inicio)} --> ${ts(b.fin)}\n${lineas.join("\n")}\n`;
});
writeFileSync(destino, "﻿" + bloques.join("\n"), "utf8");
console.log(`srt: ${bloques.length} bloques → ${destino}`);
