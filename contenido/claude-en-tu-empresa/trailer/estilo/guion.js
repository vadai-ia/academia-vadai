// Guion bloqueado del brief (§4 VO, §5) y su reloj de palabras. Es la columna del montaje
// (MOTION-RULES 11): subtítulos, texto en pantalla, 3D y SFX se cuelgan de palabras, nunca de
// segundos sueltos. La voz es IA (Ernesto Calderón, ElevenLabs v3 vía Magnific) y su
// transcripción local es el reloj; si falta una toma, sus tiempos se estiman a ~2.7 palabras/s.
//
// Sin DOM: lo importan la composición y los scripts de Node (srt, sfx).

// Rejilla de compases de la canción (99.84 BPM, compás 2.4036 s). El primer tiempo fuerte real
// está en −0.085 s: se fijó con tres golpes audibles de la pista (entrada de A a 38.38 s, de B a
// 76.8 s, del clímax a 110.4 s), no con el detector, que caía 3 pulsos antes.
// Cada frontera de toma cae en un compás (MOTION-RULES audio 3) sin cortar la voz.
export const COMPAS = 2.4036, FASE = -0.085;
export const B = (k) => +Math.max(0, FASE + COMPAS * k).toFixed(3);
// `voz`: dónde cae la primera palabra de la toma (el clip se coloca para que así sea).
export const TOMAS = [
  { id: "01", inicio: 0, fin: B(2), voz: 1.25, vo: "Todo mundo habla de inteligencia artificial." },
  { id: "02", inicio: B(2), fin: B(6), voz: B(2) + 0.55, vo: "Cada semana sale una herramienta nueva… y tu equipo sigue haciendo el reporte a mano." },
  { id: "03", inicio: B(6), fin: B(8), voz: B(6) + 0.3, vo: "Solo 6 de cada 100 empresas le están sacando provecho de verdad." },
  { id: "04", inicio: B(8), fin: B(10), voz: B(8) + 0.12, vo: "La diferencia no es la herramienta. Es el método." },
  { id: "05", inicio: B(10), fin: B(14), voz: B(10) + 0.45, vo: "Esto es Claude en tu Empresa: tu equipo aprende a usar Claude con el Excel, el Word y el correo que ya usa todos los días." },
  { id: "06", inicio: B(14), fin: B(18), voz: B(14) + 0.5, vo: "Primero, dejas tu cuenta lista: cuatro ajustes que se escriben una vez y sirven siempre." },
  { id: "07", inicio: B(18), fin: B(25), voz: B(18) + 0.4, vo: "Después aprendes a pedirle bien, con PACTO: perfil, acción, contexto, tono y formato… y omisiones, la letra que todos se saltan. Porque lo que entra es lo que sale." },
  { id: "08", inicio: B(25), fin: B(31), voz: B(25) + 0.45, vo: "Le das tus archivos y te devuelve trabajo terminado: un Excel con fórmulas vivas, un tablero para tu consejo, el documento con tu formato. No una explicación. El archivo." },
  { id: "09", inicio: B(31), fin: B(37), voz: B(31) + 0.5, vo: "Lo conectas a donde ya vive tu información: tu Drive, tu correo, tu calendario. Con criterio: lee tu bandeja, prepara los borradores… y nadie envía nada sin ti." },
  { id: "10", inicio: B(37), fin: B(42), voz: B(37) + 0.45, vo: "Le enseñas tu forma de trabajar. El proyecto guarda el contexto; la habilidad guarda el método. Lo que te sale bien tres veces, deja de ser prompt." },
  { id: "11", inicio: B(42), fin: B(46), voz: B(42) + 0.6, vo: "Y lo dejas corriendo solo. Cada lunes a las siete, el reporte llega mientras desayunas." },
  { id: "12", inicio: B(46), fin: B(51), voz: B(46) + 0.5, vo: "Practicas primero en una empresa de mentiras con problemas muy reales… y luego decides en equipo qué construyen primero en la tuya." },
  { id: "13", inicio: B(51), fin: B(56), voz: B(51) + 0.5, vo: "Te llevas el manual completo, más de cincuenta prompts ordenados por área, treinta y cinco habilidades listas y el respaldo de VADAI y Total Coach." },
  { id: "14", inicio: B(56), fin: B(59), voz: B(56) + 0.55, vo: "Porque no te falta otra herramienta. Te falta un método." },
  { id: "15", inicio: B(59), fin: 150, voz: B(59) + 0.7, vo: "Claude en tu Empresa. Inscribe a tu equipo." },
];
export const DURACION = 150;

// Tiempos reales de la voz (whisper, verificados y alineados al guion por scripts/voz-montar.mjs).
import { TIEMPOS_VO } from "./vo.js";

// Pausas: «…» medio segundo real (brief §5); la toma 14 lleva un tiempo de casi-silencio
// antes de su segunda línea (brief §4).
const PAUSA = { ",": 0.14, ":": 0.2, ";": 0.2, ".": 0.32, "…": 0.5 };
const EXTRA = { "14": { 6: 0.75 } }; // índice de palabra → pausa adicional antes de ella

function estimar(t) {
  const palabras = t.vo.split(/\s+/);
  const extra = EXTRA[t.id] || {};
  // palabras largas duran un poco más y cortas un poco menos; el promedio queda en 1
  const peso = palabras.map((p) => 0.72 + Math.min(0.6, p.replace(/[^\p{L}\d]/gu, "").length * 0.055));
  const medio = peso.reduce((a, b) => a + b, 0) / peso.length;
  const pausas = palabras.reduce((a, p) => a + (PAUSA[p.slice(-1)] || 0), 0) + Object.values(extra).reduce((a, b) => a + b, 0);
  const disponible = t.fin - 0.3 - t.voz;
  // 2.7 palabras/s (brief §5), o lo justo para que quepa en la toma
  let paso = 1 / 2.7;
  if (palabras.length * paso + pausas > disponible) paso = (disponible - pausas) / palabras.length;
  let x = t.voz;
  return palabras.map((p, i) => {
    x += extra[i] || 0;
    const d = paso * (peso[i] / medio);
    const w = { text: p, start: +x.toFixed(3), end: +(x + d * 0.92).toFixed(3) };
    x += d + (PAUSA[p.slice(-1)] || 0);
    return w;
  });
}

export const PALABRAS = Object.fromEntries(TOMAS.map((t) => [t.id, TIEMPOS_VO[t.id] || estimar(t)]));

const limpio = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ]/g, "");
// Tiempo de inicio de una palabra dentro de una toma. `n` = qué aparición (1 = la primera).
export function palabra(id, texto, n = 1) {
  const objetivo = limpio(texto);
  let k = 0;
  for (const w of PALABRAS[id]) if (limpio(w.text) === objetivo && ++k === n) return w.start;
  throw new Error(`guion: no está «${texto}» (#${n}) en la toma ${id}`);
}
export function finPalabra(id, texto, n = 1) {
  const objetivo = limpio(texto);
  let k = 0;
  for (const w of PALABRAS[id]) if (limpio(w.text) === objetivo && ++k === n) return w.end;
  throw new Error(`guion: no está «${texto}» (#${n}) en la toma ${id}`);
}
export const toma = (id) => TOMAS.find((t) => t.id === id);

// ---------- subtítulos (brief §7): máx. dos líneas, palabra clave en azul ----------
// Cortes a mano para que cada bloque sea una idea; `clave` es la palabra que va en azul.
const BLOQUES = [
  ["01", "Todo mundo habla de inteligencia artificial.", "inteligencia"],
  ["02", "Cada semana sale una herramienta nueva…", "nueva…"],
  ["02", "y tu equipo sigue haciendo el reporte a mano.", "mano."],
  ["03", "Solo 6 de cada 100 empresas le están sacando provecho de verdad.", "6"],
  ["04", "La diferencia no es la herramienta. Es el método.", "método."],
  ["05", "Esto es Claude en tu Empresa:", "Claude"],
  ["05", "tu equipo aprende a usar Claude con el Excel, el Word y el correo que ya usa todos los días.", "ya"],
  ["06", "Primero, dejas tu cuenta lista:", "lista:"],
  ["06", "cuatro ajustes que se escriben una vez y sirven siempre.", "siempre."],
  ["07", "Después aprendes a pedirle bien, con PACTO:", "PACTO:"],
  ["07", "perfil, acción, contexto, tono y formato…", "formato…"],
  ["07", "y omisiones, la letra que todos se saltan.", "omisiones,"],
  ["07", "Porque lo que entra es lo que sale.", "entra"],
  ["08", "Le das tus archivos y te devuelve trabajo terminado:", "terminado:"],
  ["08", "un Excel con fórmulas vivas, un tablero para tu consejo, el documento con tu formato.", "vivas,"],
  ["08", "No una explicación. El archivo.", "archivo."],
  ["09", "Lo conectas a donde ya vive tu información:", "conectas"],
  ["09", "tu Drive, tu correo, tu calendario.", "correo,"],
  ["09", "Con criterio: lee tu bandeja, prepara los borradores…", "borradores…"],
  ["09", "y nadie envía nada sin ti.", "nadie"],
  ["10", "Le enseñas tu forma de trabajar.", "forma"],
  ["10", "El proyecto guarda el contexto; la habilidad guarda el método.", "método."],
  ["10", "Lo que te sale bien tres veces, deja de ser prompt.", "tres"],
  ["11", "Y lo dejas corriendo solo.", "solo."],
  ["11", "Cada lunes a las siete, el reporte llega mientras desayunas.", "lunes"],
  ["12", "Practicas primero en una empresa de mentiras con problemas muy reales…", "reales…"],
  ["12", "y luego decides en equipo qué construyen primero en la tuya.", "equipo"],
  ["13", "Te llevas el manual completo, más de cincuenta prompts ordenados por área,", "manual"],
  ["13", "treinta y cinco habilidades listas y el respaldo de VADAI y Total Coach.", "habilidades"],
  ["14", "Porque no te falta otra herramienta.", "herramienta."],
  ["14", "Te falta un método.", "método."],
  ["15", "Claude en tu Empresa. Inscribe a tu equipo.", "Inscribe"],
];

// Devuelve [{toma, inicio, fin, palabras:[{text,start,end,clave}], lineas:[[i..],[i..]]}]
export function subtitulos() {
  const cursor = {};
  const salida = BLOQUES.map(([id, texto, clave]) => {
    const ws = PALABRAS[id];
    const n = texto.split(/\s+/).length;
    const a = cursor[id] || 0;
    const trozo = ws.slice(a, a + n);
    cursor[id] = a + n;
    const unido = trozo.map((w) => w.text).join(" ");
    if (unido !== texto) throw new Error(`subtítulos: «${texto}» no coincide con la VO («${unido}»)`);
    const palabras = trozo.map((w) => ({ ...w, clave: w.text === clave }));
    if (!palabras.some((w) => w.clave)) throw new Error(`subtítulos: clave «${clave}» no está en «${texto}»`);
    // dos líneas balanceadas si pasa de 38 caracteres
    let lineas = [palabras.map((_, i) => i)];
    if (texto.length > 38) {
      let mejor = 1, dif = 1e9;
      for (let c = 1; c < palabras.length; c++) {
        const l1 = palabras.slice(0, c).map((w) => w.text).join(" ").length;
        const l2 = texto.length - l1 - 1;
        if (Math.abs(l1 - l2) < dif && l1 <= 52 && l2 <= 52) { dif = Math.abs(l1 - l2); mejor = c; }
      }
      lineas = [palabras.slice(0, mejor).map((_, i) => i), palabras.slice(mejor).map((_, i) => i + mejor)];
    }
    return { toma: id, inicio: palabras[0].start - 0.08, fin: palabras.at(-1).end + 0.35, palabras, lineas };
  });
  // un bloque no se encima con el siguiente
  for (let i = 0; i < salida.length - 1; i++) salida[i].fin = Math.min(salida[i].fin, salida[i + 1].inicio - 0.02);
  for (const [id, n] of Object.entries(cursor)) if (n !== PALABRAS[id].length) throw new Error(`subtítulos: la toma ${id} no quedó cubierta completa`);
  return salida;
}
