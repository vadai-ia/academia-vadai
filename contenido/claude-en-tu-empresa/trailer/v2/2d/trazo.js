// v2 · 2D «Un solo trazo»: utilidades sin estado global. Todo se deriva del tiempo (determinista):
// azar con semilla, texto con los contornos reales de Anton (opentype), trazos que se dibujan y se
// borran con DrawSVG, y curvas de las figuras (bucle, anillos enredados, enlaces).
export const NS = "http://www.w3.org/2000/svg";
// colores de estilo/tokens.css resueltos a hex (var() en atributos SVG no es confiable)
const cache = {};
export const K = (n) => cache[n] || (cache[n] = getComputedStyle(document.documentElement).getPropertyValue(`--${n}`).trim());

export function azar(semilla) {
  let a = semilla >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const tramo = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
export const ease = {
  lineal: (u) => u,
  entra2: (u) => u * u,
  entra3: (u) => u * u * u,
  sale3: (u) => 1 - Math.pow(1 - u, 3),
  sale4: (u) => 1 - Math.pow(1 - u, 4),
  suave: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  seno: (u) => -(Math.cos(Math.PI * u) - 1) / 2,
};

export function el(tag, attrs = {}, padre) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (padre) padre.appendChild(n);
  return n;
}

// ---------- texto con contornos de glifos ----------
// lineas: [["PALABRA", ...], ...]; devuelve { palabras: [{ g, mov, glifos, x0, x1, y, tam, estilo }] }
// Cada palabra: g (fijo, con su máscara si el estilo la usa) > mov (lo que se mueve) > glifos.
// estilo de entrada (9-oct, nota de Alejandro: «que la palabra salga de golpe, que suba, que baje»):
//   golpe · sube · cae · barre (rápidos, la palabra completa en su palabra) · traza (el trazo, solo héroes)
// colores: { índiceDePalabra: color } para el énfasis (durazno / azul / cieloClaro)
let nClip = 0;
const CON_MASCARA = new Set(["sube", "cae", "barre"]);
export function texto(fuente, padre, lineas, { x, y, tam, interlinea = 1.0, ancla = "centro", maxAncho = 1e9, color = K("hueso"), trazo = 2.6, estilo = "sube", colores = {} }) {
  const espacio = fuente.getAdvanceWidth(" ", 1);
  const anchoDe = (ps, s) => ps.reduce((a, p, i) => a + fuente.getAdvanceWidth(p, s) + (i ? espacio * s : 0), 0);
  let s = tam;
  const masAncha = Math.max(...lineas.map((l) => anchoDe(l, 1)));
  if (masAncha * s > maxAncho) s = maxAncho / masAncha;
  const g = el("g", { class: "texto" }, padre);
  const palabras = [];
  let base = y, n = 0;
  lineas.forEach((ps, li) => {
    if (li) base += s * interlinea + (/[ÑÁÉÍÓÚÜ]/.test(ps.join("")) ? 0.16 * s : 0);
    const total = anchoDe(ps, s);
    let cx = ancla === "centro" ? x - total / 2 : x;
    for (const p of ps) {
      const w = fuente.getAdvanceWidth(p, s);
      const gp = el("g", { class: "palabra" }, g);
      if (CON_MASCARA.has(estilo)) {
        const id = `mp${++nClip}`;
        const cp = el("clipPath", { id }, gp);
        el("rect", { x: cx - s * 0.3, y: base - s * 1.18, width: w + s * 0.6, height: s * 1.5 }, cp);
        gp.setAttribute("clip-path", `url(#${id})`);
      }
      const mov = el("g", {}, gp);
      const c = colores[n] || color;
      const glifos = fuente.getPaths(p, cx, base, s).map((ruta) => el("path", {
        d: ruta.toPathData(2), fill: c, "fill-opacity": 0, stroke: c, "stroke-width": trazo,
        "stroke-linejoin": "round", "stroke-linecap": "round",
      }, mov)).filter((q) => q.getAttribute("d"));
      palabras.push({ g: gp, mov, glifos, x0: cx, x1: cx + w, y: base, tam: s, estilo, cx: cx + w / 2, cy: base - s * 0.36 });
      cx += w + espacio * s;
      n++;
    }
  });
  return { g, palabras, tam: s };
}
export function colorear(palabra, color) { for (const q of palabra.glifos) { q.setAttribute("fill", color); q.setAttribute("stroke", color); } }

// entrada de una palabra, completa, en su palabra. traza: el contorno se dibuja y el relleno llega a la mitad
// (un trazo de largo cero con remate redondo pinta un punto: fuera de su ventana el glifo no existe)
export function dibujar(tl, palabra, t, { dur, escalon = 0.012, estilo = palabra.estilo } = {}) {
  const P = palabra, origen = `${P.cx.toFixed(1)} ${P.cy.toFixed(1)}`;
  tl.fromTo(P.glifos, { opacity: 0 }, { opacity: 1, duration: 0.001 }, t);
  if (estilo === "traza") {
    const d = dur ?? 0.26;
    tl.fromTo(P.glifos, { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", duration: d, ease: "power2.out", stagger: escalon }, t);
    tl.fromTo(P.glifos, { fillOpacity: 0 }, { fillOpacity: 1, duration: 0.16, ease: "power1.out", stagger: escalon, immediateRender: false }, t + d * 0.45);
    return;
  }
  tl.fromTo(P.glifos, { fillOpacity: 1, drawSVG: "0% 100%" }, { fillOpacity: 1, drawSVG: "0% 100%", duration: 0.001 }, t);
  if (estilo === "golpe") tl.fromTo(P.mov, { scale: 1.5, opacity: 0, svgOrigin: origen }, { scale: 1, opacity: 1, svgOrigin: origen, duration: 0.2, ease: "power4.out" }, t);
  else if (estilo === "sube") tl.fromTo(P.mov, { y: P.tam * 0.95 }, { y: 0, duration: 0.24, ease: "expo.out" }, t);
  else if (estilo === "cae") tl.fromTo(P.mov, { y: -P.tam * 1.15 }, { y: 0, duration: 0.34, ease: "back.out(2.4)" }, t);
  else if (estilo === "barre") tl.fromTo(P.mov, { x: -P.tam * 0.7, opacity: 0 }, { x: 0, opacity: 1, duration: 0.24, ease: "expo.out" }, t);
}
// salida rápida: las de máscara se van hacia arriba por su máscara; las demás se encogen; traza se recoge
export function borrar(tl, palabras, t, { dur, escalon = 0.012 } = {}) {
  const ps = [].concat(palabras);
  const traza = ps.filter((p) => p.estilo === "traza"), resto = ps.filter((p) => p.estilo !== "traza");
  if (traza.length) {
    const gl = traza.flatMap((p) => p.glifos), d = dur ?? 0.22;
    tl.fromTo(gl, { fillOpacity: 1 }, { fillOpacity: 0, duration: 0.1, ease: "power1.in", immediateRender: false }, t);
    tl.fromTo(gl, { drawSVG: "0% 100%" }, { drawSVG: "100% 100%", duration: d, ease: "power2.in", stagger: Math.min(escalon, 0.006), immediateRender: false }, t);
    tl.fromTo(gl, { opacity: 1 }, { opacity: 0, duration: 0.001, immediateRender: false }, t + d + 0.006 * gl.length + 0.01);
  }
  resto.forEach((p, i) => {
    const ti = t + i * 0.015;
    if (CON_MASCARA.has(p.estilo)) tl.fromTo(p.mov, { y: 0, x: 0 }, { y: -p.tam * 1.35, duration: 0.18, ease: "power3.in", immediateRender: false }, ti);
    else tl.fromTo(p.mov, { scale: 1, opacity: 1, svgOrigin: `${p.cx.toFixed(1)} ${p.cy.toFixed(1)}` }, { scale: 0.82, opacity: 0, svgOrigin: `${p.cx.toFixed(1)} ${p.cy.toFixed(1)}`, duration: 0.16, ease: "power2.in", immediateRender: false }, ti);
    tl.fromTo(p.glifos, { opacity: 1 }, { opacity: 0, duration: 0.001, immediateRender: false }, ti + 0.2);
  });
}

// ---------- figuras ----------
export function circulo(cx, cy, r) {
  const k = 0.5523 * r;   // de abajo, en sentido horario visual (y hacia abajo): abajo → izquierda → arriba → derecha
  return `M${cx},${cy + r} C${cx - k},${cy + r} ${cx - r},${cy + k} ${cx - r},${cy} C${cx - r},${cy - k} ${cx - k},${cy - r} ${cx},${cy - r} C${cx + k},${cy - r} ${cx + r},${cy - k} ${cx + r},${cy} C${cx + r},${cy + k} ${cx + k},${cy + r} ${cx},${cy + r}`;
}
// anillo que tiembla: r(φ) = R + A·sin(kφ + fase); siempre por fuera de rMin
export function anillo(cx, cy, R, A, k, fase, n = 220) {
  let d = "";
  for (let i = 0; i <= n; i++) {
    const f = Math.PI / 2 + (i / n) * Math.PI * 2;
    const r = R + A * Math.sin(k * f + fase) + A * 0.35 * Math.sin((k + 2) * f - fase * 1.7);
    d += `${i ? "L" : "M"}${(cx + r * Math.cos(f)).toFixed(1)},${(cy + r * Math.sin(f)).toFixed(1)}`;
  }
  return d;
}
// Catmull-Rom → Bézier por los puntos (enlace suave entre los seis)
export function suave(pts, tension = 0.5) {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + ((p2[0] - p0[0]) * tension) / 3, p1[1] + ((p2[1] - p0[1]) * tension) / 3];
    const c2 = [p2[0] - ((p3[0] - p1[0]) * tension) / 3, p2[1] - ((p3[1] - p1[1]) * tension) / 3];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return d;
}

// un trazo guiado por el reloj: la cabeza va en u·L; modo "dibuja" deja la figura, "cola" solo una estela
export function trazoReloj(path, { modo = "dibuja", cola = 240 } = {}) {
  const L = path.getTotalLength();
  return {
    path, L,
    // retrae ∈ [0,1]: en modo cola, la estela se recoge hacia la cabeza cuando ya llegó
    // corta ∈ [0,1]: en modo dibuja, la figura se borra desde su inicio (se recoge en el sentido del trazo)
    poner(u, retrae = 0, corta = 0) {
      const h = u * L;
      let visible = u > 0;
      if (modo === "dibuja") {
        const a = corta * L;
        path.setAttribute("stroke-dasharray", `0 ${a.toFixed(1)} ${Math.max(0, h - a).toFixed(1)} ${(L + 10).toFixed(1)}`);
        visible = visible && h - a > 0.5;
      }
      else {
        const a = Math.max(0, h - cola * (1 - retrae));
        path.setAttribute("stroke-dasharray", `0 ${a.toFixed(1)} ${Math.max(0, h - a).toFixed(1)} ${(L + 10).toFixed(1)}`);
        visible = visible && h - a > 0.5;
      }
      path.style.opacity = visible ? 1 : 0;
      return path.getPointAtLength(Math.min(L, Math.max(0, h)));
    },
  };
}

// ---------- la cámara 2D: una sola dueña de la transformación de la escena ----------
// claves { t, x, y, s, e }: centro de la vista (coordenadas de escena) y escala. Sin claves: identidad.
export function crearCamara(escena, reloj, W, H) {
  const ks = [{ t: 0, x: W / 2, y: H / 2, s: 1 }];
  const sacudidas = [];   // { t, dur, amp }: temblor con semilla, decae
  const cam = {
    clave(t, x, y, s = 1, e = ease.suave) { ks.push({ t, x, y, s, e }); },
    // corte seco: hasta t se sostiene la clave anterior; desde t, esta
    corte(t, x, y, s = 1) { ks.push({ t, x, y, s, corte: true }); },
    sacudir(t, dur = 0.35, amp = 10) { sacudidas.push({ t, dur, amp }); },
    en(t) {
      let a = ks[0], b = null;
      for (const k of ks) { if (k.t <= t) a = k; else { b = k; break; } }
      if (!b || b.corte) return a;
      const u = b.e(tramo(t, a.t, b.t));
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, s: a.s * Math.pow(b.s / a.s, u) };
    },
    montar() {
      ks.sort((p, q) => p.t - q.t);
      reloj(0, 999, (t) => {
        const v = cam.en(t);
        let dx = 0, dy = 0;
        for (const z of sacudidas) {
          const u = (t - z.t) / z.dur;
          if (u < 0 || u > 1) continue;
          const a = z.amp * Math.pow(1 - u, 2);
          dx += a * Math.sin(t * 97.3 + z.t * 13.1); dy += a * Math.cos(t * 83.7 + z.t * 7.7);
        }
        escena.setAttribute("transform", `translate(${(W / 2 + dx).toFixed(2)} ${(H / 2 + dy).toFixed(2)}) scale(${v.s.toFixed(4)}) translate(${(-v.x).toFixed(2)} ${(-v.y).toFixed(2)})`);
      });
    },
  };
  return cam;
}

// ---------- la chispa: una sola cabeza para todo el video ----------
// cada escena agrega tramos { desde, hasta, f(t) → {x, y} } y piernas (trazos que la chispa dibuja)
export function crearChispa({ escena, reloj, CHISPA_D }) {
  const g = el("g", { class: "chispa" });
  const giro = el("g", {}, g);
  el("path", { d: CHISPA_D, transform: "scale(2.6) translate(-12 -12)", fill: K("durazno"), filter: "url(#brillo)" }, giro);
  const pos = [], escalas = [];
  const ch = {
    g,
    tramo(desde, hasta, f) { pos.push({ desde, hasta, f }); },
    // una pierna: trazo que la cabeza recorre; "cola" deja estela que se recoge, "dibuja" deja la figura
    // fin: desde ahí la figura dibujada deja de existir (si no, una figura «dibuja» se queda para siempre)
    // borra: [t0, t1] en modo dibuja, la figura se recoge en el sentido del trazo
    pierna(d, desde, hasta, { e = ease.suave, modo = "cola", cola = 240, color = K("azul"), ancho = 3, padre = escena, guia = true, fin, borra } = {}) {
      const tr = trazoReloj(el("path", { d, fill: "none", stroke: color, "stroke-width": ancho, "stroke-linecap": "round", "stroke-linejoin": "round" }, padre), { modo, cola });
      tr.path.style.opacity = 0;
      reloj(desde, Math.max(hasta + 0.3, fin ? fin + 0.01 : 0, borra ? borra[1] + 0.01 : 0), (t) => {
        tr.poner(e(tramo(t, desde, hasta)), modo === "cola" ? tramo(t, hasta, hasta + 0.28) : 0, borra ? ease.entra2(tramo(t, borra[0], borra[1])) : 0);
        if (fin && t >= fin - 2e-4) tr.path.style.opacity = 0;
      });
      if (guia) ch.tramo(desde, hasta, (t) => tr.path.getPointAtLength(e(tramo(t, desde, hasta)) * tr.L));
      return tr;
    },
    // fija: la chispa se queda en un punto (o sigue una función) en un intervalo
    quieta(desde, hasta, x, y, flota = 6) { ch.tramo(desde, hasta, (t) => ({ x, y: y - flota * Math.sin((t - desde) * 2.4) })); },
    // escala: f(t) multiplica la escala base (1); escala 0 = oculta
    escala(f) { escalas.push(f); },
    montar() {
      escena.appendChild(g);
      pos.sort((a, b) => a.desde - b.desde);
      reloj(0, 999, (t) => {
        let tr = pos[0];
        for (const p of pos) if (t >= p.desde) tr = p;
        const q = tr.f(Math.min(t, tr.hasta));
        let s = 1;
        for (const f of escalas) s *= f(t);
        g.setAttribute("transform", `translate(${q.x.toFixed(2)} ${q.y.toFixed(2)}) scale(${Math.max(0.001, s).toFixed(4)})`);
        g.style.opacity = s < 0.002 ? 0 : 1;
        giro.setAttribute("transform", `rotate(${(t * 48).toFixed(2)})`);
      });
    },
  };
  return ch;
}

// ---------- logos de herramientas (v2/logos.js, caja 24×24) dentro de una insignia redonda ----------
export function insignia(padre, logo, { r = 34, fondo = K("navyHondo"), borde = K("cieloClaro"), color = K("hueso") } = {}) {
  const g = el("g", { class: "insignia" }, padre);
  const dentro = el("g", {}, g);
  el("circle", { r, fill: fondo, stroke: borde, "stroke-width": 2.5 }, dentro);
  const k = (r * 1.08) / 24;
  el("path", { d: logo.d, fill: logo.id === "claude" ? K("durazno") : color, transform: `scale(${k.toFixed(3)}) translate(-12 -12)` }, dentro);
  return { g, dentro };
}

// onda expansiva: un anillo que crece y se apaga (marca la llegada de algo)
export function onda(tl, padre, x, y, t, { r0 = 10, r1 = 120, color = K("cieloClaro"), ancho = 3, dur = 0.55 } = {}) {
  const c = el("circle", { cx: x, cy: y, r: r0, fill: "none", stroke: color, "stroke-width": ancho }, padre);
  tl.fromTo(c, { attr: { r: r0 }, opacity: 0 }, { attr: { r: r0 }, opacity: 0.9, duration: 0.001 }, t);
  tl.fromTo(c, { attr: { r: r0 }, opacity: 0.9, strokeWidth: ancho }, { attr: { r: r1 }, opacity: 0, strokeWidth: 0.5, duration: dur, ease: "expo.out", immediateRender: false }, t + 0.001);
  return c;
}
