// Tipografía y UI en 2.5D (C1): DOM encima del mundo WebGL. Movimientos con nombre
// (rise, pop, count-up, checklist tick, typewriter, slide-in, blur-in, punch-in, bar fill).
// Reglas de determinismo heredadas de ERRORES.md:
//   · transformaciones 2D (estilo/gsap.js), nada de will-change ni CSS 3D;
//   · lo que se coloca desde el 3D va en left/top enteros (colocar()).
// Entrada (C5): la técnica del brief + desenfoque a nítido + compresión de tracking.
// Salida: empujada en la dirección del movimiento de cámara; nunca un fundido simple.

export const $ = (tag, cls, padre, txt) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  if (padre) padre.appendChild(e);
  return e;
};

// Capa a pantalla completa para una toma; el reloj de visibilidad lo lleva el timeline.
export function capa(raiz, id) {
  const c = $("div", "capa", raiz);
  c.id = id;
  return c;
}

// Mostrar/ocultar sin tocar .clip: autoAlpha sobre nodos internos, en tiempos exactos.
export function ventana(tl, el, desde, hasta) {
  tl.set(el, { autoAlpha: 0 }, 0);
  tl.set(el, { autoAlpha: 1 }, desde);
  if (hasta != null) tl.set(el, { autoAlpha: 0 }, hasta);
}

// Titular Anton por palabras: máscara (cada palabra sube desde su renglón) + blur-in + tracking.
export function titular(padre, lineas, cls = "tit") {
  const t = $("div", cls, padre);
  const palabras = [];
  for (const l of lineas) {
    const fila = $("div", "tit-linea", t);
    for (const p of l.split(" ")) {
      const m = $("span", "mascara", fila);
      const w = $("span", "palabra", m, p);
      palabras.push(w);
      fila.appendChild(document.createTextNode(" "));
    }
  }
  t.palabras = palabras;
  return t;
}
export function entrar(tl, nodos, t, { escalon = 0.07, dur = 0.62, y = 110, blur = 14 } = {}) {
  const arr = [].concat(nodos);
  tl.fromTo(arr, { yPercent: y, filter: `blur(${blur}px)`, letterSpacing: "0.12em", opacity: 0 },
    { yPercent: 0, filter: "blur(0px)", letterSpacing: "-0.01em", opacity: 1, duration: dur, ease: "expo.out", stagger: escalon }, t);
}
// salida empujada: dx/dy en px en la dirección en que se mueve el mundo
export function salir(tl, nodos, t, { dx = 0, dy = -60, dur = 0.42, blur = 10 } = {}) {
  tl.to([].concat(nodos), { x: `+=${dx}`, y: `+=${dy}`, filter: `blur(${blur}px)`, opacity: 0, duration: dur, ease: "power3.in", stagger: 0.03 }, t);
}

// pop con sobrepaso (tarjetas, chips)
export function pop(tl, el, t, { desde = 0.6, dur = 0.5, y = 24 } = {}) {
  tl.fromTo(el, { scale: desde, opacity: 0, y, filter: "blur(8px)" }, { scale: 1, opacity: 1, y: 0, filter: "blur(0px)", duration: dur, ease: "back.out(2)" }, t);
}
// slide-in con asentamiento: el contenedor llega y los hijos se asientan con retraso (follow-through)
export function deslizar(tl, el, t, { dx = 80, dy = 0, dur = 0.7 } = {}) {
  tl.fromTo(el, { x: dx, y: dy, opacity: 0, filter: "blur(10px)" }, { x: 0, y: 0, opacity: 1, filter: "blur(0px)", duration: dur, ease: "expo.out" }, t);
  const hijos = el.querySelectorAll(":scope > *");
  if (hijos.length) tl.fromTo(hijos, { y: 14 }, { y: 0, duration: dur, ease: "back.out(1.6)", stagger: 0.04 }, t + 0.06);
}

// contador (count-up) sobre un nodo de texto; formato opcional
export function contar(tl, el, t, de, a, dur = 0.9, fmt = (v) => Math.round(v).toString()) {
  const o = { v: de };
  el.textContent = fmt(de);
  tl.to(o, { v: a, duration: dur, ease: "power2.out", onUpdate: () => (el.textContent = fmt(o.v)) }, t);
  // estado fijo antes/después para que un seek hacia atrás lo regrese
  tl.call(() => (el.textContent = fmt(de)), null, Math.max(0, t - 0.001));
}

// máquina de escribir determinista: el texto visible es función del tiempo
export function escribir(tl, el, texto, t, dur) {
  const o = { n: 0 };
  el.textContent = "";
  tl.to(o, { n: texto.length, duration: dur, ease: "none", onUpdate: () => (el.textContent = texto.slice(0, Math.round(o.n))) }, t);
}

// barra que se llena (bar fill)
export function llenar(tl, el, t, pct, dur = 0.8) {
  tl.fromTo(el, { scaleX: 0 }, { scaleX: pct, duration: dur, ease: "expo.out", transformOrigin: "0% 50%" }, t);
}

// tarjeta de golpe (punch card, C2/C11): corte duro de entrada y salida en la palabra exacta
export function golpe(tl, raiz, palabra, t, dur = 0.5) {
  const c = $("div", "golpe", raiz);
  $("div", "golpe-palabra", c, palabra);
  tl.set(c, { autoAlpha: 0 }, 0);
  tl.set(c, { autoAlpha: 1 }, t);
  tl.fromTo(c.firstChild, { scale: 1.08 }, { scale: 1, duration: dur, ease: "power2.out" }, t);
  tl.set(c, { autoAlpha: 0 }, t + dur);
  return c;
}

// coloca un nodo en un punto proyectado del 3D, en pixeles enteros (ver ERRORES E5)
export function colocar(el, p) {
  el.style.left = Math.round(p.x) + "px";
  el.style.top = Math.round(p.y) + "px";
}

export const CHISPA_SVG = (cls = "chispa-svg") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m4.714 15.956l4.718-2.648l.079-.23l-.08-.128h-.23l-.79-.048l-2.695-.073l-2.337-.097l-2.265-.122l-.57-.121l-.535-.704l.055-.353l.48-.321l.685.06l1.518.104l2.277.157l1.651.098l2.447.255h.389l.054-.158l-.133-.097l-.103-.098l-2.356-1.596l-2.55-1.688l-1.336-.972l-.722-.491L2 6.223l-.158-1.008l.656-.722l.88.06l.224.061l.893.686l1.906 1.476l2.49 1.833l.364.304l.146-.104l.018-.072l-.164-.274l-1.354-2.446l-1.445-2.49l-.644-1.032l-.17-.619a3 3 0 0 1-.103-.729L6.287.133L6.7 0l.995.134l.42.364l.619 1.415L9.735 4.14l1.555 3.03l.455.898l.243.832l.09.255h.159V9.01l.127-1.706l.237-2.095l.23-2.695l.08-.76l.376-.91l.747-.492l.583.28l.48.685l-.067.444l-.286 1.851l-.558 2.903l-.365 1.942h.213l.243-.242l.983-1.306l1.652-2.064l.728-.82l.85-.904l.547-.431h1.032l.759 1.129l-.34 1.166l-1.063 1.347l-.88 1.142l-1.263 1.7l-.79 1.36l.074.11l.188-.02l2.853-.606l1.542-.28l1.84-.315l.832.388l.09.395l-.327.807l-1.967.486l-2.307.462l-3.436.813l-.043.03l.049.061l1.548.146l.662.036h1.62l3.018.225l.79.522l.473.638l-.08.485l-1.213.62l-1.64-.389l-3.825-.91l-1.31-.329h-.183v.11l1.093 1.068l2.003 1.81l2.508 2.33l.127.578l-.321.455l-.34-.049l-2.204-1.657l-.85-.747l-1.925-1.62h-.127v.17l.443.649l2.343 3.521l.122 1.08l-.17.353l-.607.213l-.668-.122l-1.372-1.924l-1.415-2.168l-1.141-1.943l-.14.08l-.674 7.254l-.316.37l-.728.28l-.607-.461l-.322-.747l.322-1.476l.388-1.924l.316-1.53l.285-1.9l.17-.632l-.012-.042l-.14.018l-1.432 1.967l-2.18 2.945l-1.724 1.845l-.413.164l-.716-.37l.066-.662l.401-.589l2.386-3.036l1.439-1.882l.929-1.086l-.006-.158h-.055L4.138 18.56l-1.13.146l-.485-.456l.06-.746l.231-.243l1.907-1.312Z"/></svg>`;
