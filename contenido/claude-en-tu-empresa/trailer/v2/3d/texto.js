// v2 · 3D · texto en pantalla (DOM sobre el mundo). Reglas v2: un solo texto a la vez; sobre cielo o
// sobre utilería el texto va en una PLACA navy sólida (sobre el navy liso la placa no se nota y da igual).
// Las clases de posición cambian con el formato (html[data-formato="v"] en la composición).
import { $, titular, entrar, salir, ventana } from "../../estilo/ui.js";

// aire arriba de las líneas con Ñ o vocal acentuada: con Anton la tilde caía en la línea de arriba
export function airear(t) {
  t.querySelectorAll(".tit-linea").forEach((l, i) => { if (i && /[ñáéíóúü]/i.test(l.textContent)) l.style.marginTop = "0.16em"; });
  return t;
}

// entradas rápidas y variadas (9-oct, nota de Alejandro: «que la palabra salga de golpe, que suba, que
// baje, que se mueva»): la palabra aparece COMPLETA en su palabra, en 0.2–0.34 s
export function entrada(tl, w, t, estilo = "sube") {
  if (estilo === "golpe") tl.fromTo(w, { scale: 1.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.2, ease: "power4.out" }, t);
  else if (estilo === "cae") tl.fromTo(w, { yPercent: -120, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.34, ease: "back.out(2.2)" }, t);
  else if (estilo === "barre") tl.fromTo(w, { xPercent: -45, opacity: 0 }, { xPercent: 0, opacity: 1, duration: 0.26, ease: "expo.out" }, t);
  else tl.fromTo(w, { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.28, ease: "expo.out" }, t);
}
// énfasis: una palabra por frase en durazno o azul (sobre navy pasan AA)
const ENFASIS = { "gratuita": "enf-durazno", "vivo": "enf-cielo", "ia": "enf-cielo", "aprovechan": "enf-durazno", "bucle": "enf-azul", "lugar": "enf-cielo",
  "esperarte.": "enf-durazno", "capacitadas": "enf-cielo", "ella.": "enf-durazno", "artificial": "enf-cielo", "mano": "enf-durazno", "talachas": "enf-cielo",
  "decisión…": "enf-azul", "escritorio.": "enf-durazno", "ti?": "enf-durazno", "herramienta.": "enf-cielo", "tarde.": "enf-durazno", "cómo.": "enf-cielo" };
export function enfatizar(t) { for (const w of t.palabras) { const k = ENFASIS[w.textContent.trim().toLowerCase()]; if (k) w.classList.add(k); } return t; }
const ROTA = ["golpe", "sube", "barre", "cae"];
let nFrase = 0;

// lineas: ["Palabras de la línea 1", "línea 2"]; anclas: un tiempo por palabra; fin: cuándo sale
export function frase(ctx, lineas, anclas, fin, { cls = "tit-izq", placa = false, tam, salida = { dy: -50, dur: 0.22 }, colorPalabra, estilo } = {}) {
  const { tl, raiz } = ctx;
  const c = $("div", "capa", raiz);
  ventana(tl, c, anclas[0] - 0.1, (fin ?? 999) + 0.6);
  const t = enfatizar(airear(titular(c, lineas, `tit ${cls} sobre-navy${placa ? " placa-navy" : ""}`)));
  if (tam) t.style.fontSize = `${tam}px`;
  if (colorPalabra) for (const [i, k] of Object.entries(colorPalabra)) t.palabras[i].classList.add(k);
  if (placa) tl.fromTo(t, { "--placa": 0 }, { "--placa": 1, duration: 0.25, ease: "power2.out" }, anclas[0] - 0.08);
  const e = estilo ?? ROTA[nFrase++ % ROTA.length];
  t.palabras.forEach((w, i) => entrada(tl, w, anclas[i], e));
  if (fin != null) {
    salir(tl, t.palabras, fin, salida);
    if (placa) tl.to(t, { "--placa": 0, duration: 0.2, ease: "power2.in" }, fin + 0.08);
  }
  return t;
}

// pastilla fija (no sigue al 3D): una a la vez, abajo al centro, navy sólido
export function pastilla(ctx, texto, t0, t1) {
  const { tl, raiz } = ctx;
  const c = $("div", "capa", raiz);
  ventana(tl, c, t0 - 0.05, t1 + 0.4);
  const p = $("span", "pildora-fija", c, texto);
  tl.fromTo(p, { scale: 0.7, opacity: 0, filter: "blur(8px)" }, { scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.42, ease: "back.out(2)" }, t0);
  tl.to(p, { scale: 0.9, opacity: 0, filter: "blur(8px)", duration: 0.22, ease: "power3.in" }, t1);
  return p;
}
