// v2 · 2D · dibujos de línea que traza la chispa (10-oct-2026, notas de Alejandro: «personas estresadas,
// corriendo, buscando… todo dibujado por el mismo logo de Claude»). Cada dibujo es un path compuesto en
// coordenadas locales (origen en sus pies o en su centro) para que la chispa lo recorra de un solo trazo.
// Sin estado: devuelven strings `d`.

// persona de palitos: cabeza + tronco + brazos + piernas (origen: entre los pies). s = escala
export function persona(pose = "parada", s = 1) {
  const k = (v) => (v * s).toFixed(1);
  const cab = (cx, cy, r) => `M${k(cx + r)},${k(cy)} A${k(r)},${k(r)} 0 1 0 ${k(cx - r)},${k(cy)} A${k(r)},${k(r)} 0 1 0 ${k(cx + r)},${k(cy)}`;
  const L = (...pts) => "M" + pts.map(([x, y]) => `${k(x)},${k(y)}`).join(" L");
  if (pose === "corriendo") return [cab(14, -150, 17), L([8, -132], [-6, -70]), L([-6, -70], [26, -38], [14, 0]), L([-6, -70], [-36, -40], [-62, -48]), L([4, -118], [36, -98], [52, -120]), L([4, -118], [-26, -100], [-40, -78])].join(" ");
  // el otro paso de la carrera (se alterna con «corriendo» a 9 Hz)
  if (pose === "corriendo2") return [cab(14, -150, 17), L([8, -132], [-6, -70]), L([-6, -70], [-22, -36], [-34, 0]), L([-6, -70], [20, -44], [42, -30]), L([4, -118], [30, -100], [44, -80]), L([4, -118], [-24, -106], [-38, -128])].join(" ");
  if (pose === "buscando") return [cab(0, -152, 17), L([0, -135], [0, -70]), L([0, -70], [-20, 0]), L([0, -70], [20, 0]), L([0, -120], [-30, -92]), L([0, -120], [34, -110], [58, -126])].join(" ");
  if (pose === "estresado") return [cab(0, -150, 17), L([0, -133], [0, -70]), L([0, -70], [-22, 0]), L([0, -70], [22, 0]), L([0, -122], [-30, -140], [-14, -166]), L([0, -122], [30, -140], [14, -166])].join(" ");
  if (pose === "hablando") return [cab(0, -150, 17), L([0, -133], [0, -70]), L([0, -70], [-20, 0]), L([0, -70], [20, 0]), L([0, -122], [-28, -96]), L([0, -122], [32, -132])].join(" ");
  return [cab(0, -150, 17), L([0, -133], [0, -70]), L([0, -70], [-20, 0]), L([0, -70], [20, 0]), L([0, -122], [-26, -88]), L([0, -122], [26, -88])].join(" ");
}
// lupa (origen en el centro del vidrio; el mango baja a la izquierda, hacia la mano)
export const lupa = (s = 1) => `M${24 * s},0 A${24 * s},${24 * s} 0 1 0 ${-24 * s},0 A${24 * s},${24 * s} 0 1 0 ${24 * s},0 M${-17 * s},${17 * s} L${-44 * s},${44 * s}`;
// tres zigzags de estrés sobre la cabeza de una persona (mismo origen que persona())
export const tension = (s = 1) => [[-44, -196], [-8, -214], [28, -196]].map(([x, y]) => `M${x * s},${y * s} L${(x + 7) * s},${(y - 12) * s} L${(x + 14) * s},${y * s} L${(x + 21) * s},${(y - 12) * s}`).join(" ");
// rueda de hámster (centro): aro y rayos
export function rueda(r = 125, rayos = 8) {
  let d = `M0,${r} A${r},${r} 0 1 1 0,${-r} A${r},${r} 0 1 1 0,${r}`;
  for (let i = 0; i < rayos; i++) { const a = (i / rayos) * Math.PI * 2; d += ` M${(Math.cos(a) * 12).toFixed(1)},${(Math.sin(a) * 12).toFixed(1)} L${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`; }
  return d;
}
// el infinito (lemniscata de Bernoulli, centro), un solo trazo cerrado
export function infinito(a = 190, n = 160) {
  let d = "";
  for (let i = 0; i <= n; i++) { const t = (i / n) * Math.PI * 2, k = 1 + Math.sin(t) ** 2; d += `${i ? "L" : "M"}${((a * Math.cos(t)) / k).toFixed(1)},${((a * Math.sin(t) * Math.cos(t)) / k * 1.15).toFixed(1)}`; }
  return d;
}
// gráfica de barras (origen en la esquina inferior izquierda) y su flecha de tendencia
export const barras = (w = 260, h = 180, alturas = [0.3, 0.5, 0.45, 0.75, 1]) => `M0,${-h - 10} L0,0 L${w},0 ` + alturas.map((a, i) => { const bw = w / alturas.length, x = i * bw + bw * 0.2; return `M${x.toFixed(1)},0 L${x.toFixed(1)},${(-a * h).toFixed(1)} L${(x + bw * 0.6).toFixed(1)},${(-a * h).toFixed(1)} L${(x + bw * 0.6).toFixed(1)},0`; }).join(" ");
// fila de edificios de oficinas (origen en la base, a la izquierda): seis, de alturas distintas, con ventanas
export function ciudad(ancho = 340, alturas = [110, 170, 130, 200, 150, 120]) {
  const n = alturas.length, bw = ancho / n;
  let d = `M-20,0 L${ancho + 20},0`;
  alturas.forEach((h, i) => {
    const x0 = i * bw + 6, x1 = (i + 1) * bw - 6;
    d += ` M${x0.toFixed(1)},0 L${x0.toFixed(1)},${-h} L${x1.toFixed(1)},${-h} L${x1.toFixed(1)},0`;
    for (let y = -h + 22; y < -16; y += 30) d += ` M${(x0 + 9).toFixed(1)},${y} L${(x0 + 18).toFixed(1)},${y} M${(x1 - 18).toFixed(1)},${y} L${(x1 - 9).toFixed(1)},${y}`;
  });
  return d;
}
// reloj (centro): carátula + marcas de hora
export function reloj(r = 80) {
  let d = `M${r},0 A${r},${r} 0 1 0 ${-r},0 A${r},${r} 0 1 0 ${r},0`;
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; d += ` M${(Math.cos(a) * r * 0.82).toFixed(1)},${(Math.sin(a) * r * 0.82).toFixed(1)} L${(Math.cos(a) * r * 0.94).toFixed(1)},${(Math.sin(a) * r * 0.94).toFixed(1)}`; }
  return d;
}
// pizarrón (esquina superior izquierda en el origen) con su repisa
export const pizarron = (w = 480, h = 290) => `M0,0 L${w},0 L${w},${h} L0,${h} Z M-14,${h + 14} L${w + 14},${h + 14} M${w * 0.18},${h + 14} L${w * 0.12},${h + 90} M${w * 0.82},${h + 14} L${w * 0.88},${h + 90}`;
// signo de interrogación grande (centro)
export const interrogacion = (s = 1) => `M${-38 * s},${-40 * s} C${-38 * s},${-88 * s} ${40 * s},${-92 * s} ${40 * s},${-44 * s} C${40 * s},${-10 * s} ${0},${-6 * s} 0,${26 * s} M0,${56 * s} L0,${62 * s}`;
// foco (centro del bulbo)
export const foco = (s = 1) => `M${-20 * s},${30 * s} C${-48 * s},${6 * s} ${-44 * s},${-52 * s} 0,${-52 * s} C${44 * s},${-52 * s} ${48 * s},${6 * s} ${20 * s},${30 * s} L${20 * s},${50 * s} L${-20 * s},${50 * s} Z M${-14 * s},${62 * s} L${14 * s},${62 * s} M${-8 * s},${30 * s} L${-4 * s},${8 * s} L${4 * s},${8 * s} L${8 * s},${30 * s}`;
// globo terráqueo (centro): contorno, ecuador, paralelos y meridianos
export function globo(r = 220) {
  let d = `M${r},0 A${r},${r} 0 1 0 ${-r},0 A${r},${r} 0 1 0 ${r},0`;
  for (const f of [-0.6, -0.3, 0, 0.3, 0.6]) { const y = f * r, w = Math.sqrt(r * r - y * y); d += ` M${-w.toFixed(1)},${y.toFixed(1)} L${w.toFixed(1)},${y.toFixed(1)}`; }
  return d;
}
export const meridiano = (r, k) => `M0,${-r} A${(Math.abs(k) * r).toFixed(1)},${r} 0 0 ${k > 0 ? 1 : 0} 0,${r}`;
// etiqueta de precio (origen en el agujero)
export const etiqueta = (w = 360, h = 180) => `M0,0 L60,${-h / 2} L${w},${-h / 2} L${w},${h / 2} L60,${h / 2} Z M18,0 A10,10 0 1 0 38,0 A10,10 0 1 0 18,0`;
// edificio de oficinas chiquito (origen en la base, centro)
export const edificio = (s = 1) => `M${-12 * s},0 L${-12 * s},${-34 * s} L${12 * s},${-34 * s} L${12 * s},0 Z M${-6 * s},${-26 * s} L${-2 * s},${-26 * s} M${2 * s},${-26 * s} L${6 * s},${-26 * s} M${-6 * s},${-16 * s} L${-2 * s},${-16 * s} M${2 * s},${-16 * s} L${6 * s},${-16 * s}`;
// gráfica que sube (origen en la esquina inferior izquierda)
export const graficaSube = (w = 320, h = 200) => `M0,${-h} L0,0 L${w},0 M10,-30 L${w * 0.3},${-h * 0.35} L${w * 0.5},${-h * 0.28} L${w * 0.72},${-h * 0.62} L${w - 10},${-h * 0.92}`;
// globo de diálogo (centro)
export const dialogo = (w = 120, h = 70) => `M${-w / 2 + 16},${-h / 2} L${w / 2 - 16},${-h / 2} Q${w / 2},${-h / 2} ${w / 2},${-h / 2 + 16} L${w / 2},${h / 2 - 16} Q${w / 2},${h / 2} ${w / 2 - 16},${h / 2} L${-w / 2 + 34},${h / 2} L${-w / 2 + 14},${h / 2 + 22} L${-w / 2 + 18},${h / 2} L${-w / 2 + 16},${h / 2} Q${-w / 2},${h / 2} ${-w / 2},${h / 2 - 16} L${-w / 2},${-h / 2 + 16} Q${-w / 2},${-h / 2} ${-w / 2 + 16},${-h / 2} Z`;
// ícono de «skills» (rayo en un engrane simple) y de «conectores» (dos enchufes)
export const iconoSkills = (s = 1) => `M${6 * s},${-30 * s} L${-14 * s},${4 * s} L${0},${4 * s} L${-6 * s},${30 * s} L${14 * s},${-6 * s} L0,${-6 * s} Z`;
export const iconoConectores = (s = 1) => `M${-34 * s},${-10 * s} L${-10 * s},${-10 * s} L${-10 * s},${10 * s} L${-34 * s},${10 * s} M${-10 * s},${-5 * s} L0,${-5 * s} M${-10 * s},${5 * s} L0,${5 * s} M${34 * s},${-10 * s} L${10 * s},${-10 * s} L${10 * s},${10 * s} L${34 * s},${10 * s} M${10 * s},0 L${4 * s},0`;
