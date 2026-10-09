// Propuesta 3 · los personajes y la utilería. Cada fábrica devuelve un grupo de three y un `poner(...)`
// que lo deja en un estado completo (posición, deformación, gesto). Nada se anima aquí: las escenas
// calculan el estado desde t y llaman a poner(). Así cada cuadro es independiente (determinismo).
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { COLOR, brillo, arcilla, texturaTexto, rrect } from "./mundo.js";

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const sombra = (m, emite = true, recibe = true) => { m.castShadow = emite; m.receiveShadow = recibe; return m; };
const caja = (w, h, d, r = 0.06, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, r);

// chispa de cuatro puntas (no es el logo de Claude: es el «✦» genérico de los stickers de IA)
export function chispa4(g, cx, cy, r) {
  g.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 - Math.PI / 2, rr = k % 2 ? r * 0.28 : r;
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath(); g.fill();
}

// ---------- el equipo: píldoras brillantes con ojos de punto ----------
const OJO_BLANCO = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 });
const PUPILA = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(COLOR.tinta), roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 });
const PARPADO = (color) => brillo(color);
export function pildora(color, { radio = 0.34, largo = 0.3 } = {}) {
  const alto = largo + 2 * radio;
  const g = new THREE.Group();          // posición y rumbo
  const cuerpo = new THREE.Group();     // deformación desde los pies
  g.add(cuerpo);
  const malla = sombra(new THREE.Mesh(new THREE.CapsuleGeometry(radio, largo, 12, 32), brillo(color, { rugosidad: 0.22 })));
  malla.position.y = alto / 2;
  cuerpo.add(malla);
  const cara = new THREE.Group();
  cara.position.set(0, alto * 0.62, radio * 0.78);
  cuerpo.add(cara);
  const ojos = [-1, 1].map((lado) => {
    const o = new THREE.Group();
    o.position.set(lado * radio * 0.4, 0, 0);
    o.rotation.y = lado * 0.28;
    const blanco = new THREE.Mesh(new THREE.SphereGeometry(radio * 0.33, 28, 18), OJO_BLANCO);
    blanco.scale.set(1, 1.18, 0.6);
    const pupila = new THREE.Mesh(new THREE.SphereGeometry(radio * 0.2, 24, 14), PUPILA);
    pupila.scale.set(1, 1.12, 0.55);
    pupila.position.z = radio * 0.13;
    const brilloOjo = new THREE.Mesh(new THREE.SphereGeometry(radio * 0.06, 10, 8), OJO_BLANCO);
    brilloOjo.position.set(radio * 0.06, radio * 0.07, radio * 0.1);
    pupila.add(brilloOjo);
    // párpado: media esfera del color del cuerpo que baja
    const parpado = new THREE.Mesh(new THREE.SphereGeometry(radio * 0.35, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), PARPADO(color));
    parpado.scale.set(1, 1.2, 0.66);
    o.add(blanco, pupila, parpado);
    return { o, pupila, parpado };
  });
  ojos.forEach((x) => cara.add(x.o));
  // gota de sudor (aparece cuando se dan cuenta)
  const sudor = new THREE.Mesh(new THREE.SphereGeometry(radio * 0.12, 16, 12), new THREE.MeshPhysicalMaterial({ color: new THREE.Color("#BFE9FA"), roughness: 0.05, clearcoat: 1, transmission: 0.3, transparent: true, opacity: 0.95 }));
  sudor.scale.set(0.8, 1.25, 0.8);
  sudor.position.set(radio * 0.95, alto * 0.86, radio * 0.35);
  sudor.visible = false;
  cuerpo.add(sudor);
  const estado = { x: 0, y: 0, z: 0, rumbo: 0, sx: 1, sy: 1, inclina: 0, ladea: 0, mirar: [0, 0], parpado: 0, sudor: 0, visible: true, escala: 1 };
  function poner(e = {}) {
    Object.assign(estado, e);
    const s = estado;
    g.visible = s.visible && s.escala > 0.001;
    g.position.set(s.x, s.y, s.z);
    g.rotation.set(0, s.rumbo, 0);
    cuerpo.scale.set(s.sx * s.escala, s.sy * s.escala, s.sx * s.escala);
    cuerpo.rotation.set(s.inclina, 0, s.ladea);
    for (const ojo of ojos) {
      ojo.pupila.position.x = s.mirar[0] * radio * 0.12;
      ojo.pupila.position.y = s.mirar[1] * radio * 0.12;
      // párpado: rotado hacia arriba (abierto) → hacia el frente (cerrado)
      ojo.parpado.rotation.x = -Math.PI / 2 + (Math.PI / 2) * 0.98 * s.parpado - 0.35 * (1 - s.parpado);
      ojo.parpado.visible = s.parpado > 0.02;
    }
    sudor.visible = s.sudor > 0.01;
    sudor.scale.set(0.8 * s.sudor, 1.25 * s.sudor, 0.8 * s.sudor);
    sudor.position.y = alto * (0.86 - 0.12 * Math.min(1, s.sudor));
  }
  poner();
  return { g, cuerpo, poner, alto, radio, estado };
}

// escalón: caja redondeada con la tapa casi blanca y los costados al color del material
export function geoEscalon(w = 1, D = 1.5) {
  const geo = caja(w * 0.985, D, w * 0.985, 0.07, 3);
  const n = geo.attributes.normal, col = new Float32Array(n.count * 3);
  for (let i = 0; i < n.count; i++) {
    const arriba = Math.max(0, n.getY(i));
    const k = 1 + 0.55 * Math.pow(arriba, 3);              // la tapa se aclara (el color base es el del costado)
    const y = geo.attributes.position.getY(i) / D + 0.5;   // y el costado se oscurece hacia abajo
    const f = arriba > 0.5 ? k : 0.78 + 0.22 * y;
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = f;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return geo;
}

// ---------- la escalera de Penrose ----------
// Una hélice de N escalones que sube R = N·h. Sus extremos difieren en R·(1,1,1): desde la pose
// isométrica son el mismo lugar. Tramos: a pasos hacia −x, a hacia −z, b hacia +x, b hacia +z, con
// b − a = N·h / w (así cierra). Se construyen los escalones 1..N; el «0» es el N visto de frente.
export function penrose({ a = 3, b = 7, h = 0.2, w = 1, D = 1.5, colores = ["#7FCDEC", "#3FA9DA"] } = {}) {
  const N = 2 * (a + b), R = N * h;
  const dirs = [[-1, 0, a], [0, -1, a], [1, 0, b], [0, 1, b]];
  const P = [V3(0, 0, 0)];
  let x = 0, z = 0;
  for (const [dx, dz, n] of dirs) for (let k = 0; k < n; k++) { x += dx * w; z += dz * w; P.push(V3(x, P.length * h, z)); }
  // centro del lazo en el plano isométrico (lo que se ve)
  const plano = P.slice(1).map((p) => V3(p.x - p.y, 0, p.z - p.y));
  const centro = plano.reduce((s, p) => s.add(p), V3()).multiplyScalar(1 / N);
  const g = new THREE.Group();
  const ca = new THREE.Color(colores[0]), cb = new THREE.Color(colores[1]);
  const geo = geoEscalon(w, D);
  const pasos = [];
  for (let i = 1; i <= N; i++) {
    const u = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);   // gradiente periódico: no delata la costura
    const mat = arcilla("#" + ca.clone().lerp(cb, u).getHexString());
    mat.vertexColors = true;
    const m = sombra(new THREE.Mesh(geo, mat), false, true);
    m.position.set(P[i].x, P[i].y - D / 2, P[i].z);
    g.add(m);
    pasos.push(m);
  }
  // rumbo de cada escalón (hacia dónde se camina en él)
  const rumboDe = (i) => { const j = Math.min(N, Math.max(1, i)); const k = j <= a ? 0 : j <= 2 * a ? 1 : j <= 2 * a + b ? 2 : 3; return [-Math.PI / 2, Math.PI, Math.PI / 2, 0][k]; };
  // posición de la cima del escalón para un índice desenvuelto (…, −1, 0, 1, … N, N+1 …)
  const idx = (k) => ((((k - 1) % N) + N) % N) + 1;
  const cima = (k) => P[idx(k)].clone();
  // de k a k+1 sin costura: si k es N, el siguiente es el 1 desplazado R·(1,1,1) (mismo píxel)
  const siguiente = (k) => { const i = idx(k); return i === N ? P[1].clone().add(V3(R, R, R)) : P[i + 1].clone(); };
  return { g, pasos, P, N, R, h, w, D, a, b, centro, rumboDe, idx, cima, siguiente };
}

// salto de escalón: s desenvuelto (entero = parado en ese escalón). Devuelve posición y deformación.
export function saltar(esc, s, { alto = 0.32, carril = 0 } = {}) {
  const k = Math.floor(s), u = s - k;
  const p0 = esc.cima(k), p1 = esc.siguiente(k);
  const e = u < 1 ? (u * u * (3 - 2 * u)) : 1;
  const p = p0.clone().lerp(p1, e);
  p.y += Math.sin(Math.PI * u) * alto;
  // carril: a un lado del centro del escalón, perpendicular al rumbo
  const r = esc.rumboDe(esc.idx(k + (u > 0.5 ? 1 : 0)));
  if (carril) { p.x += Math.cos(r) * carril; p.z -= Math.sin(r) * carril; }
  // aplasta al despegar y al caer, estira en el aire
  const sq = u < 0.12 ? 1 - 0.18 * Math.sin((u / 0.12) * Math.PI) : u > 0.88 ? 1 - 0.2 * Math.sin(((u - 0.88) / 0.12) * Math.PI) : 1 + 0.08 * Math.sin(((u - 0.12) / 0.76) * Math.PI);
  return { x: p.x, y: p.y, z: p.z, sy: sq, sx: 1 / Math.sqrt(sq), rumbo: r };
}

// ---------- stickers ----------
export function sticker(texto, { fondo = COLOR.lima, tinta = COLOR.navy, ancho = 1.1, chispa = true, borde = "#FFFFFF", rot = 0 } = {}) {
  const W = 512, H = 256;
  const tx = texturaTexto((g) => {
    g.clearRect(0, 0, W, H);
    g.fillStyle = borde; rrect(g, 6, 6, W - 12, H - 12, 64); g.fill();
    g.fillStyle = fondo; rrect(g, 22, 22, W - 44, H - 44, 50); g.fill();
    g.fillStyle = tinta;
    g.font = '800 128px "Inter"'; g.textBaseline = "middle";
    const tw = g.measureText(texto).width, cw = chispa ? 96 : 0;
    const x0 = (W - tw - cw) / 2;
    g.fillText(texto, x0, H / 2 + 6);
    if (chispa) chispa4(g, x0 + tw + cw / 2 + 10, H / 2, 40);
  }, { w: W, h: H });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, ancho / 2), new THREE.MeshPhysicalMaterial({ map: tx, transparent: true, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.1, alphaTest: 0.02 }));
  m.rotation.z = rot;
  m.castShadow = false;
  return m;
}

// ---------- caja de herramienta (la caja «IA» y las que caen cada semana) ----------
export function cajaHerramienta({ color = COLOR.navy, etiqueta = "IA", fondoEtiqueta = COLOR.lima, tinta = COLOR.navy, lado = 0.9, chispa = true } = {}) {
  const g = new THREE.Group();
  const cuerpo = new THREE.Group(); g.add(cuerpo);
  const mat = brillo(color, { rugosidad: 0.28 });
  const base = sombra(new THREE.Mesh(caja(lado, lado * 0.86, lado, 0.07), mat));
  base.position.y = lado * 0.43;
  cuerpo.add(base);
  // cuatro solapas con bisagra en el borde superior
  const solapas = [];
  for (let k = 0; k < 4; k++) {
    const piv = new THREE.Group();
    const ang = (k * Math.PI) / 2;
    piv.position.set(Math.sin(ang) * lado * 0.5, lado * 0.86, Math.cos(ang) * lado * 0.5);
    piv.rotation.y = ang;
    const sol = sombra(new THREE.Mesh(caja(lado * 0.98, 0.05, lado * 0.5, 0.02, 2), mat));
    sol.position.set(0, 0.025, -lado * 0.25);
    piv.add(sol);
    cuerpo.add(piv);
    solapas.push(piv);
  }
  const et = sticker(etiqueta, { fondo: fondoEtiqueta, tinta, ancho: lado * 0.84, chispa });
  et.position.set(0, lado * 0.45, lado * 0.501);
  cuerpo.add(et);
  const et2 = et.clone(); et2.rotation.y = Math.PI / 2; et2.position.set(lado * 0.501, lado * 0.45, 0); cuerpo.add(et2);
  const estado = { x: 0, y: 0, z: 0, rumbo: 0, sx: 1, sy: 1, abre: 0, giroX: 0, giroZ: 0, escala: 1, visible: true };
  function poner(e = {}) {
    Object.assign(estado, e);
    const s = estado;
    g.visible = s.visible && s.escala > 0.001;
    g.position.set(s.x, s.y, s.z);
    g.rotation.set(s.giroX, s.rumbo, s.giroZ);
    cuerpo.scale.set(s.sx * s.escala, s.sy * s.escala, s.sx * s.escala);
    solapas.forEach((p, k) => { p.children[0].rotation.x = -(Math.PI * 0.62 + (k % 2) * 0.12) * s.abre; });
  }
  poner();
  return { g, poner, lado, estado };
}

// ---------- el manual de instrucciones (en blanco) ----------
export function manual({ ancho = 0.8, alto = 1.05 } = {}) {
  const g = new THREE.Group();
  const libro = new THREE.Group(); g.add(libro);
  const tapaTx = texturaTexto((c, W, H) => {
    c.fillStyle = COLOR.hueso; c.fillRect(0, 0, W, H);
    c.fillStyle = COLOR.cieloHondo; c.fillRect(0, 0, W, 34);
    c.fillStyle = COLOR.navy; c.font = '800 54px "Inter"'; c.textAlign = "center";
    c.fillText("MANUAL", W / 2, H * 0.42);
    c.font = 'italic 46px "Instrument Serif"'; c.fillStyle = COLOR.cieloHondo;
    c.fillText("de instrucciones", W / 2, H * 0.52);
    c.fillStyle = COLOR.lima; chispa4(c, W / 2, H * 0.7, 46);
  }, { w: 384, h: 512 });
  const tapaMat = new THREE.MeshPhysicalMaterial({ map: tapaTx, roughness: 0.45, clearcoat: 0.6 });
  const lomoMat = brillo(COLOR.cieloHondo, { rugosidad: 0.4 });
  const hojaMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide });
  const grosor = 0.07;
  // tapa trasera fija, tapa delantera con bisagra en el lomo (x = 0)
  const trasera = sombra(new THREE.Mesh(caja(ancho, grosor * 0.4, alto, 0.015, 2), lomoMat));
  trasera.position.set(ancho / 2, 0, 0);
  libro.add(trasera);
  const bloque = sombra(new THREE.Mesh(new THREE.BoxGeometry(ancho * 0.96, grosor * 0.7, alto * 0.96), hojaMat));
  bloque.position.set(ancho * 0.5, grosor * 0.45, 0);
  libro.add(bloque);
  const bisagra = new THREE.Group(); bisagra.position.set(0, grosor * 0.85, 0); libro.add(bisagra);
  const delantera = sombra(new THREE.Mesh(new THREE.BoxGeometry(ancho, grosor * 0.35, alto), [lomoMat, lomoMat, tapaMat, lomoMat, lomoMat, lomoMat]));
  delantera.position.set(ancho / 2, 0, 0);
  bisagra.add(delantera);
  // hojas que se hojean (todas en blanco)
  const hojas = [];
  for (let k = 0; k < 5; k++) {
    const piv = new THREE.Group(); piv.position.set(0, grosor * 0.82, 0);
    const hoja = sombra(new THREE.Mesh(new THREE.PlaneGeometry(ancho * 0.95, alto * 0.94, 8, 1), hojaMat), true, true);
    hoja.rotation.x = -Math.PI / 2;
    hoja.position.set(ancho * 0.475, 0.002 * k, 0);
    piv.add(hoja);
    libro.add(piv);
    hojas.push({ piv, hoja });
  }
  const estado = { x: 0, y: 0, z: 0, rumbo: 0, inclina: 0, abre: 0, hojas: [0, 0, 0, 0, 0], escala: 1, visible: true };
  function poner(e = {}) {
    Object.assign(estado, e);
    const s = estado;
    g.visible = s.visible && s.escala > 0.001;
    g.position.set(s.x, s.y, s.z);
    g.rotation.set(0, s.rumbo, 0);
    libro.rotation.x = s.inclina;
    libro.scale.setScalar(s.escala);
    bisagra.rotation.z = Math.PI * 0.98 * s.abre;
    hojas.forEach((h, k) => {
      const u = s.hojas[k] || 0;
      h.piv.visible = s.abre > 0.5;
      h.piv.rotation.z = Math.PI * 0.97 * u;
      // la hoja se curva al pasar: la doblamos con una leve rotación extra en su mitad
      h.hoja.rotation.y = -Math.sin(Math.PI * u) * 0.25;
    });
  }
  poner();
  return { g, poner, ancho, alto, estado };
}

// hoja suelta (la que cae del manual)
export function hojaSuelta({ ancho = 0.7, alto = 0.92 } = {}) {
  const m = sombra(new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto, 6, 6), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.75, side: THREE.DoubleSide })));
  const g = new THREE.Group(); g.add(m);
  return { g, m };
}

// ---------- la empresa de juguete ----------
export function edificio() {
  const g = new THREE.Group();
  const cuerpo = new THREE.Group(); g.add(cuerpo);
  const W = 2.4, H = 2.5, D = 1.9;
  const muro = sombra(new THREE.Mesh(caja(W, H, D, 0.12, 4), arcilla(COLOR.hueso)));
  muro.position.y = H / 2;
  const techo = sombra(new THREE.Mesh(caja(W + 0.16, 0.22, D + 0.16, 0.08, 3), brillo(COLOR.cieloHondo)));
  techo.position.y = H + 0.08;
  cuerpo.add(muro, techo);
  const vent = brillo(COLOR.cieloClaro, { rugosidad: 0.1, emisivo: "#9EE3FA" });
  for (let fila = 0; fila < 2; fila++) for (let col = 0; col < 3; col++) {
    const v = new THREE.Mesh(caja(0.5, 0.42, 0.06, 0.05, 2), vent);
    v.position.set(-0.72 + col * 0.72, 1.35 + fila * 0.62, D / 2 + 0.02);
    if (fila === 1 && col === 1) continue;
    cuerpo.add(v);
    const v2 = v.clone(); v2.rotation.y = Math.PI / 2; v2.position.set(W / 2 + 0.02, 1.35 + fila * 0.62, 0.55 - col * 0.55); if (col < 2) cuerpo.add(v2);
  }
  const puerta = sombra(new THREE.Mesh(caja(0.62, 0.95, 0.08, 0.06, 2), brillo(COLOR.durazno)));
  puerta.position.set(0, 0.475, D / 2 + 0.03);
  cuerpo.add(puerta);
  const letrero = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.36), new THREE.MeshPhysicalMaterial({ map: texturaTexto((c, w, h) => { c.fillStyle = COLOR.navy; rrect(c, 0, 0, w, h, 40); c.fill(); c.fillStyle = "#fff"; c.font = '800 92px "Inter"'; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("TU EMPRESA", w / 2, h / 2 + 4); }, { w: 640, h: 154 }), roughness: 0.4, clearcoat: 0.6, transparent: true }));
  letrero.position.set(0, 1.12 + 0.62 * 0 + 0.04, D / 2 + 0.05);
  letrero.position.y = 1.97;
  cuerpo.add(letrero);
  const estado = { x: 0, y: 0, z: 0, rumbo: 0, sx: 1, sy: 1, escala: 1, visible: true, luces: 0 };
  function poner(e = {}) {
    Object.assign(estado, e);
    const s = estado;
    g.visible = s.visible && s.escala > 0.001;
    g.position.set(s.x, s.y, s.z); g.rotation.y = s.rumbo;
    cuerpo.scale.set(s.sx * s.escala, s.sy * s.escala, s.sx * s.escala);
    vent.emissiveIntensity = s.luces;
  }
  poner();
  return { g, poner, W, H, D, estado };
}

// ---------- objetos de todos los días (a todos les pegan «IA») ----------
export function taza(color = COLOR.durazno) {
  const g = new THREE.Group();
  const perfil = [[0, 0], [0.34, 0], [0.38, 0.04], [0.4, 0.62], [0.36, 0.62], [0.34, 0.08], [0, 0.08]].map(([x, y]) => new THREE.Vector2(x, y));
  const cuerpo = sombra(new THREE.Mesh(new THREE.LatheGeometry(perfil, 48), brillo(color, { rugosidad: 0.18 })));
  const asa = sombra(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 16, 32, Math.PI * 1.1), brillo(color, { rugosidad: 0.18 })));
  asa.position.set(0.4, 0.33, 0); asa.rotation.z = -Math.PI * 0.55;
  const cafe = new THREE.Mesh(new THREE.CircleGeometry(0.35, 32), brillo("#6B3E26", { rugosidad: 0.1 }));
  cafe.rotation.x = -Math.PI / 2; cafe.position.y = 0.55;
  g.add(cuerpo, asa, cafe);
  return { g, alto: 0.62, frente: 0.4 };
}
export function tostador(color = COLOR.cieloClaro) {
  const g = new THREE.Group();
  const cuerpo = sombra(new THREE.Mesh(caja(1.1, 0.72, 0.6, 0.16, 4), brillo(color, { rugosidad: 0.2 })));
  cuerpo.position.y = 0.36;
  g.add(cuerpo);
  for (const x of [-0.22, 0.22]) { const r = new THREE.Mesh(caja(0.32, 0.06, 0.4, 0.03, 2), brillo(COLOR.tinta)); r.position.set(x, 0.72, 0); g.add(r); }
  const pan = sombra(new THREE.Mesh(caja(0.28, 0.3, 0.34, 0.08, 3), arcilla("#E7B27A")));
  pan.position.set(-0.22, 0.8, 0); g.add(pan);
  const palanca = sombra(new THREE.Mesh(caja(0.12, 0.06, 0.16, 0.025, 2), brillo(COLOR.navy)));
  palanca.position.set(0.6, 0.5, 0); g.add(palanca);
  return { g, alto: 0.72, frente: 0.3 };
}
export function foco(color = COLOR.lima) {
  const g = new THREE.Group();
  const vidrio = sombra(new THREE.Mesh(new THREE.SphereGeometry(0.36, 40, 28), new THREE.MeshPhysicalMaterial({ color: new THREE.Color("#FFF6D6"), roughness: 0.05, clearcoat: 1, transmission: 0.25, emissive: new THREE.Color(color), emissiveIntensity: 0.15 })));
  vidrio.position.y = 0.62;
  const base = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.32, 32), brillo(COLOR.gris, { rugosidad: 0.25 })));
  base.position.y = 0.16;
  g.add(vidrio, base);
  for (let k = 0; k < 3; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.02, 8, 32), brillo("#8FA3B0")); r.rotation.x = Math.PI / 2; r.position.y = 0.07 + k * 0.08; g.add(r); }
  return { g, alto: 0.98, frente: 0.36 };
}
export function audifonos(color = COLOR.azul) {
  const g = new THREE.Group();
  const diadema = sombra(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 16, 48, Math.PI), brillo(COLOR.navy, { rugosidad: 0.25 })));
  diadema.position.y = 0.42;
  g.add(diadema);
  for (const x of [-0.42, 0.42]) {
    const c = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.18, 32), brillo(color, { rugosidad: 0.2 })));
    c.rotation.z = Math.PI / 2; c.position.set(x, 0.3, 0); g.add(c);
    const coj = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.06, 12, 32), arcilla(COLOR.hueso)); coj.rotation.y = Math.PI / 2; coj.position.set(x * 0.8, 0.3, 0); g.add(coj);
  }
  return { g, alto: 0.9, frente: 0.2 };
}
export function cepillo(color = COLOR.durazno) {
  const g = new THREE.Group();
  const mango = sombra(new THREE.Mesh(caja(0.22, 1.15, 0.22, 0.09, 3), brillo(color, { rugosidad: 0.2 })));
  mango.position.y = 0.58;
  const cabeza = sombra(new THREE.Mesh(caja(0.24, 0.32, 0.16, 0.06, 2), brillo(color, { rugosidad: 0.2 })));
  cabeza.position.set(0, 1.25, 0);
  const cerdas = new THREE.Mesh(caja(0.14, 0.26, 0.12, 0.02, 2), arcilla(COLOR.blanco));
  cerdas.position.set(0, 1.25, 0.11);
  g.add(mango, cabeza, cerdas);
  return { g, alto: 1.4, frente: 0.12 };
}

// ---------- calendario de escritorio ----------
export function calendario() {
  const g = new THREE.Group();
  const base = sombra(new THREE.Mesh(caja(0.78, 0.82, 0.18, 0.05, 2), brillo(COLOR.blanco, { rugosidad: 0.4 })));
  base.position.y = 0.41;
  const barra = new THREE.Mesh(caja(0.78, 0.18, 0.2, 0.05, 2), brillo(COLOR.cieloHondo));
  barra.position.y = 0.78;
  g.add(base, barra);
  const paginas = [];
  const hacerPagina = (n) => texturaTexto((c, W, H) => {
    c.fillStyle = "#fff"; c.fillRect(0, 0, W, H);
    c.fillStyle = COLOR.gris; c.font = '700 52px "Inter"'; c.textAlign = "center"; c.fillText("SEMANA", W / 2, 96);
    c.fillStyle = COLOR.navy; c.font = '800 200px "Inter"'; c.fillText(String(n), W / 2, 300);
  }, { w: 320, h: 330 });
  function pagina(n) {
    const piv = new THREE.Group(); piv.position.set(0, 0.69, 0.1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.66), new THREE.MeshPhysicalMaterial({ map: hacerPagina(n), roughness: 0.7 }));
    m.position.y = -0.34;
    const dorso = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.66), new THREE.MeshPhysicalMaterial({ color: 0xf3f6f9, roughness: 0.8 }));
    dorso.rotation.y = Math.PI; dorso.position.y = -0.34;
    piv.add(m, dorso); g.add(piv); paginas.push({ piv, m });
    return piv;
  }
  return { g, pagina, paginas };
}

// ---------- bandera ----------
export function bandera(color = COLOR.lima) {
  const g = new THREE.Group();
  const asta = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 12), brillo(COLOR.navy)));
  asta.position.y = 0.45;
  const forma = new THREE.Shape(); forma.moveTo(0, 0); forma.lineTo(0.42, -0.14); forma.lineTo(0, -0.28); forma.closePath();
  const tela = sombra(new THREE.Mesh(new THREE.ShapeGeometry(forma), new THREE.MeshPhysicalMaterial({ color: new THREE.Color(color), roughness: 0.35, clearcoat: 0.6, side: THREE.DoubleSide })));
  tela.position.set(0.025, 0.88, 0);
  const bola = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), brillo(COLOR.lima));
  bola.position.y = 0.92;
  g.add(asta, tela, bola);
  return { g, tela };
}

// letra flotante (zzz, ?, etc.) como sprite con Instrument Serif
export function letra(texto, { color = COLOR.cieloHondo, tam = 0.5, fuente = 'italic 200px "Instrument Serif"' } = {}) {
  const tx = texturaTexto((c, W, H) => { c.fillStyle = color; c.font = fuente; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(texto, W / 2, H / 2); }, { w: 256, h: 256 });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false }));
  s.scale.set(tam, tam, 1);
  return s;
}
