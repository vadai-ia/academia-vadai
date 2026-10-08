// El mundo continuo del tráiler: cielo, nubes, el edificio de siete pisos con la utilería
// de cada área, el escritorio del dueño en el piso de arriba, la ventana de Claude y la
// chispa. Todo procedural, en barro suave con filos redondeados. Lo usan todas las tomas.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { C, barro, vidrio, azar } from "../estilo/mundo.js";

// Orden de arriba abajo = orden del recorrido (06 Dirección → 07 Operaciones → 08 Finanzas
// → 09 Ventas), para que el descenso nunca regrese.
export const PISOS = ["Dirección", "Operaciones", "Finanzas", "Ventas", "RH", "Marketing", "TI"];
export const PASO = 2.3;            // separación vertical entre losas (edificio "explotado")
export const LOSA = { w: 6.2, h: 0.42, d: 4.2 };

const caja = (w, h, d, r = 0.08, color = C.blanco, o = {}) =>
  new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 5, Math.min(r, w / 2, h / 2, d / 2)), barro(color, o));
const sombra = (m) => { m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return m; };
const en = (m, x, y, z, ry = 0) => { m.position.set(x, y, z); m.rotation.y = ry; return m; };

function cilindro(rt, rb, h, color, seg = 48) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1), barro(color));
}

// Textura de canvas dibujada una sola vez, con las fuentes ya cargadas.
function lienzo(w, h, dibujar) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  dibujar(g, w, h);
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.anisotropy = 8;
  return tx;
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
const hex = (k) => "#" + C[k].getHexString();

// ---------- cielo: degradado héroe 135° con los soplos de nube de la "ventana" de los decks ----------
function texturaCielo() {
  return lienzo(1920, 1080, (g, w, h) => {
    const L = Math.hypot(w, h) / 2, a = (135 - 90) * Math.PI / 180;
    const cx = w / 2, cy = h / 2, dx = Math.cos(a) * L, dy = Math.sin(a) * L;
    const lg = g.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    lg.addColorStop(0, hex("cieloClaro"));
    lg.addColorStop(1, hex("cieloHondo"));
    g.fillStyle = lg; g.fillRect(0, 0, w, h);
    for (const [x, y, rx, ry, al] of [[0.28, 0.8, 0.42, 0.26, 0.5], [0.72, 0.9, 0.38, 0.22, 0.38], [0.2, 0, 1.2, 1.4, 0.2]]) {
      const rg = g.createRadialGradient(x * w, y * h, 0, x * w, y * h, Math.max(rx * w, ry * h));
      rg.addColorStop(0, `rgba(255,255,255,${al})`); rg.addColorStop(0.7, "rgba(255,255,255,0)");
      g.save(); g.translate(x * w, y * h); g.scale(1, (ry * h) / Math.max(rx * w, ry * h)); g.translate(-x * w, -y * h);
      g.fillStyle = rg; g.fillRect(-w, -h * 8, w * 3, h * 17); g.restore();
    }
  });
}

// ---------- nubes: racimos de esferas en barro blanco ----------
function racimo(rand, n, radio, ancho) {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(1, 40, 24);
  const mat = barro(C.blanco, { rugosidad: 0.95, barniz: 0 });
  const inst = new THREE.InstancedMesh(geo, mat, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const u = rand() * 2 - 1, ang = rand() * Math.PI * 2;
    const r = radio * (0.45 + rand() * 0.55) * (1 - Math.abs(u) * 0.35);
    p.set(u * ancho, rand() * radio * 0.35, Math.sin(ang) * radio * 0.5 * rand());
    s.setScalar(r);
    m.compose(p, q, s); inst.setMatrixAt(i, m);
  }
  inst.castShadow = false; inst.receiveShadow = true;
  g.add(inst);
  return g;
}

export function crearNubes(escena) {
  const rand = azar(20261007);
  const capas = [];
  // la base: un anillo de nube bajo el edificio (motivo de las láminas)
  const base = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const r = racimo(rand, 14, 1.5 + rand() * 0.8, 1.8);
    r.position.set(Math.cos(a) * 3.8, 0, Math.sin(a) * 2.8);
    r.rotation.y = -a;
    base.add(r);
  }
  base.position.y = -(PISOS.length - 1) * PASO - 1.5;
  escena.add(base);
  capas.push({ g: base, deriva: 0.02, fase: 0 });
  // bancos lejanos y cercanos: tres profundidades para el paralaje
  for (const [x, y, z, k] of [[-16, -9, -22, 1.6], [18, -12, -26, 2], [-9, -15, -12, 1.2], [14, -4, -34, 2.4], [-22, -2, -40, 2.6], [7, -17, 6, 1.1]]) {
    const r = racimo(rand, 18, 1.7 * k, 2.6 * k);
    r.position.set(x, y, z);
    escena.add(r);
    capas.push({ g: r, deriva: 0.05 + rand() * 0.06, fase: rand() * 6 });
  }
  const vivir = (t) => {
    for (const c of capas) {
      c.g.userData.x0 ??= c.g.position.x;
      c.g.position.x = c.g.userData.x0 + Math.sin(t * c.deriva + c.fase) * 0.6;
    }
  };
  return { vivir, grupos: capas.map((c) => c.g) };
}

// ---------- utilería por área ----------
function escritorio() {
  const g = new THREE.Group();
  const cubierta = en(caja(3.4, 0.16, 1.7, 0.07, C.azul), 0, 0.92, 0);
  g.add(cubierta);
  for (const [x, z] of [[-1.5, -0.65], [1.5, -0.65], [-1.5, 0.65], [1.5, 0.65]]) g.add(en(caja(0.12, 0.84, 0.12, 0.05, C.cieloHondo), x, 0.42, z));
  // laptop
  const lap = new THREE.Group();
  lap.add(en(caja(1.05, 0.05, 0.72, 0.03, C.navy), 0, 0, 0));
  const pantalla = caja(1.05, 0.68, 0.04, 0.03, C.navy);
  pantalla.position.set(0, 0.34, -0.36); pantalla.rotation.x = -0.22;
  lap.add(pantalla);
  const vidrioPantalla = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.58), barro(C.cieloClaro, { rugosidad: 0.3, emisivo: C.cieloClaro }));
  vidrioPantalla.material.emissiveIntensity = 0.35;
  vidrioPantalla.position.set(0, 0.34, -0.335); vidrioPantalla.rotation.x = -0.22;
  lap.add(vidrioPantalla);
  g.add(en(lap, -0.2, 1.03, -0.15, 0.12));
  // sobre
  const sobre = new THREE.Group();
  sobre.add(caja(0.62, 0.035, 0.42, 0.015, C.blanco));
  const solapa = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.2, 3), barro(C.hueso));
  solapa.rotation.set(-Math.PI / 2, 0, Math.PI); solapa.scale.set(1, 1, 0.05); solapa.position.set(0, 0.03, -0.06);
  sobre.add(solapa);
  g.add(en(sobre, 1.05, 1.02, 0.35, -0.35));
  // taza-calendario
  const taza = new THREE.Group();
  taza.add(cilindro(0.13, 0.12, 0.28, C.blanco));
  const banda = cilindro(0.132, 0.132, 0.07, C.azul); banda.position.y = 0.08; taza.add(banda);
  const asa = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.022, 16, 32), barro(C.blanco)); asa.position.set(0.15, 0, 0); taza.add(asa);
  g.add(en(taza, 1.3, 1.14, -0.4));
  // hoja de cálculo impresa
  const hoja = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.012, 0.74, 2, 0.004), new THREE.MeshPhysicalMaterial({ map: texturaHoja(), roughness: 0.9 }));
  g.add(en(hoja, -1.25, 1.008, 0.3, 0.28));
  return sombra(g);
}

function texturaHoja() {
  return lienzo(560, 740, (g, w, h) => {
    g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, w, h);
    g.strokeStyle = hex("hueso"); g.lineWidth = 3;
    for (let y = 60; y < h - 30; y += 34) { g.beginPath(); g.moveTo(30, y); g.lineTo(w - 30, y); g.stroke(); }
    for (const x of [30, 200, 330, 450, w - 30]) { g.beginPath(); g.moveTo(x, 60); g.lineTo(x, h - 40); g.stroke(); }
    g.fillStyle = hex("azul"); g.fillRect(30, 26, w - 60, 30);
  });
}

function cajas(rand) {
  const g = new THREE.Group();
  const tarima = en(caja(2.2, 0.14, 1.5, 0.04, C.cieloHondo), 0, 0.07, 0); g.add(tarima);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2 - (i === 2 ? 1 : 0); k++) {
    const b = caja(0.66, 0.5, 0.66, 0.06, C.blanco);
    b.position.set(-0.7 + i * 0.7, 0.4 + k * 0.52, -0.35 + j * 0.7);
    b.rotation.y = (rand() - 0.5) * 0.12;
    const cinta = caja(0.67, 0.08, 0.2, 0.02, C.azul); cinta.position.y = 0.21; b.add(cinta);
    g.add(b);
  }
  return sombra(g);
}

function calculadoraYReloj() {
  const g = new THREE.Group();
  const calc = caja(1.0, 0.18, 1.35, 0.1, C.navy);
  calc.position.set(-0.8, 0.09, 0); calc.rotation.y = 0.25;
  const pant = caja(0.76, 0.04, 0.3, 0.03, C.cieloClaro); pant.position.set(0, 0.1, -0.42); calc.add(pant);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const t = caja(0.15, 0.06, 0.15, 0.03, i === 3 && j === 3 ? C.azul : C.hueso);
    t.position.set(-0.29 + i * 0.195, 0.11, -0.12 + j * 0.19); calc.add(t);
  }
  g.add(calc);
  const reloj = new THREE.Group();
  const disco = cilindro(0.62, 0.62, 0.18, C.blanco, 64); disco.rotation.x = Math.PI / 2; reloj.add(disco);
  const aro = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.07, 20, 64), barro(C.azul)); reloj.add(aro);
  const h1 = caja(0.06, 0.34, 0.04, 0.02, C.navy); h1.position.set(0, 0.15, 0.11); reloj.add(h1);
  const h2 = caja(0.05, 0.46, 0.04, 0.02, C.navy); h2.position.set(0.17, 0.08, 0.11); h2.rotation.z = -1.2; reloj.add(h2);
  reloj.position.set(1.0, 0.72, -0.6); reloj.rotation.y = -0.35;
  const pie = caja(0.5, 0.12, 0.34, 0.05, C.cieloHondo); pie.position.set(1.0, 0.06, -0.6);
  g.add(reloj, pie);
  g.userData.reloj = { corta: h1, larga: h2, centro: reloj };
  return sombra(g);
}

function grafica() {
  const g = new THREE.Group();
  const alturas = [0.5, 0.8, 0.7, 1.15, 1.5];
  const tonos = [C.cieloClaro, C.cieloClaro, C.azul, C.azul, C.cieloHondo];
  alturas.forEach((a, i) => { const b = caja(0.34, a, 0.34, 0.06, tonos[i]); b.position.set(-0.9 + i * 0.45, a / 2, 0); g.add(b); });
  const bolsa = caja(0.6, 0.62, 0.32, 0.06, C.blanco); bolsa.position.set(1.65, 0.31, 0.35); bolsa.rotation.y = -0.4;
  const asa = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 12, 32, Math.PI), barro(C.navy)); asa.position.y = 0.31; bolsa.add(asa);
  g.add(bolsa);
  return sombra(g);
}

function mesaRedonda() {
  const g = new THREE.Group();
  const cub = cilindro(1.0, 1.0, 0.1, C.blanco, 64); cub.position.y = 0.7; g.add(cub);
  const pata = cilindro(0.1, 0.18, 0.66, C.cieloHondo); pata.position.y = 0.33; g.add(pata);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const silla = new THREE.Group();
    silla.add(en(cilindro(0.26, 0.26, 0.1, C.azul), 0, 0.42, 0));
    silla.add(en(caja(0.44, 0.42, 0.08, 0.04, C.azul), 0, 0.68, 0.2));
    silla.add(en(cilindro(0.04, 0.04, 0.4, C.cieloHondo), 0, 0.2, 0));
    silla.position.set(Math.cos(a) * 1.42, 0, Math.sin(a) * 1.42);
    silla.rotation.y = -a - Math.PI / 2;
    g.add(silla);
  }
  return sombra(g);
}

function megafono() {
  const g = new THREE.Group();
  const cono = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.14, 0.9, 48, 1, true), barro(C.azul));
  cono.material.side = THREE.DoubleSide;
  cono.rotation.z = Math.PI / 2 - 0.3; cono.position.set(-0.6, 0.75, 0.2);
  const mango = caja(0.16, 0.4, 0.16, 0.06, C.navy); mango.position.set(-0.85, 0.42, 0.2); mango.rotation.z = -0.3;
  g.add(cono, mango);
  const panel = caja(1.5, 1.0, 0.1, 0.06, C.blanco); panel.position.set(0.9, 0.95, -0.4); panel.rotation.y = -0.3;
  const franja = caja(1.2, 0.18, 0.04, 0.03, C.cieloClaro); franja.position.set(0, 0.2, 0.06); panel.add(franja);
  const franja2 = caja(0.8, 0.12, 0.04, 0.03, C.hueso); franja2.position.set(-0.2, -0.1, 0.06); panel.add(franja2);
  const poste = cilindro(0.05, 0.05, 0.45, C.cieloHondo); poste.position.set(0.9, 0.22, -0.4);
  g.add(panel, poste);
  return sombra(g);
}

function servidores() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const rack = caja(0.7, 1.5, 0.8, 0.07, C.navy);
    rack.position.set(-0.85 + i * 0.85, 0.75, 0);
    for (let j = 0; j < 5; j++) {
      const led = caja(0.12, 0.04, 0.02, 0.01, C.cieloClaro, { emisivo: C.cieloClaro });
      led.material.emissiveIntensity = 0.6;
      led.position.set(0.18, -0.55 + j * 0.27, 0.41); rack.add(led);
      const ranura = caja(0.5, 0.025, 0.02, 0.01, C.navyHondo); ranura.position.set(-0.08, -0.55 + j * 0.27, 0.41); rack.add(ranura);
    }
    g.add(rack);
  }
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.85, 1.5, 0), new THREE.Vector3(-0.4, 1.85, 0.1), new THREE.Vector3(0.4, 1.8, 0.1), new THREE.Vector3(0.85, 1.5, 0),
  ]), 40, 0.035, 12), barro(C.azul));
  g.add(cable);
  g.userData.cable = cable;
  return sombra(g);
}

// ---------- la ventana de Claude (UI recreada de los decks, no captura de una cuenta) ----------
function texturaVentana() {
  return lienzo(1600, 1000, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    rr(g, 0, 0, w, h, 44); g.fillStyle = "#FFFFFF"; g.fill();
    // barra de título con tres puntos
    g.fillStyle = hex("hueso"); rr(g, 0, 0, w, 84, [44, 44, 0, 0]); g.fill();
    [0, 1, 2].forEach((i) => { g.beginPath(); g.arc(56 + i * 40, 42, 12, 0, Math.PI * 2); g.fillStyle = hex("cieloClaro"); g.fill(); });
    g.fillStyle = hex("navy"); g.font = "500 64px Inter"; g.textAlign = "center";
    g.fillText("¿En qué te ayudo hoy?", w / 2, 300);
    // burbuja del usuario
    g.font = "500 34px Inter"; g.textAlign = "left";
    rr(g, w - 760, 380, 640, 96, 48); g.fillStyle = hex("hueso"); g.fill();
    g.fillStyle = hex("navy"); g.fillText("Ordena mis pendientes de hoy", w - 718, 440);
    // líneas esqueleto de la respuesta
    g.fillStyle = hex("hueso");
    for (const [y, a] of [[540, 0.78], [592, 0.66], [644, 0.72], [696, 0.42]]) { rr(g, 120, y, (w - 240) * a, 26, 13); g.fill(); }
    // campo de entrada con botón durazno
    rr(g, 100, h - 200, w - 200, 120, 60); g.fillStyle = "#FFFFFF"; g.fill();
    g.lineWidth = 4; g.strokeStyle = hex("hueso"); g.stroke();
    g.fillStyle = hex("gris"); g.font = "500 36px Inter"; g.fillText("Escribe a Claude…", 160, h - 128);
    g.beginPath(); g.arc(w - 170, h - 140, 40, 0, Math.PI * 2); g.fillStyle = hex("durazno"); g.fill();
    g.strokeStyle = hex("navy"); g.lineWidth = 7; g.lineCap = "round";
    g.beginPath(); g.moveTo(w - 170, h - 122); g.lineTo(w - 170, h - 160); g.moveTo(w - 186, h - 145); g.lineTo(w - 170, h - 161); g.lineTo(w - 154, h - 145); g.stroke();
  });
}

function ventanaClaude() {
  const g = new THREE.Group();
  const W = 2.4, H = 1.5;
  const panel = new THREE.Mesh(new RoundedBoxGeometry(W + 0.16, H + 0.16, 0.06, 6, 0.06), vidrio());
  panel.position.z = -0.05;
  const forma = new THREE.Shape();
  const r = 0.07, x0 = -W / 2, y0 = -H / 2;
  forma.moveTo(x0 + r, y0); forma.lineTo(x0 + W - r, y0); forma.quadraticCurveTo(x0 + W, y0, x0 + W, y0 + r);
  forma.lineTo(x0 + W, y0 + H - r); forma.quadraticCurveTo(x0 + W, y0 + H, x0 + W - r, y0 + H);
  forma.lineTo(x0 + r, y0 + H); forma.quadraticCurveTo(x0, y0 + H, x0, y0 + H - r);
  forma.lineTo(x0, y0 + r); forma.quadraticCurveTo(x0, y0, x0 + r, y0);
  const geo = new THREE.ShapeGeometry(forma, 12);
  const uv = geo.attributes.uv; const pos = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) - x0) / W, (pos.getY(i) - y0) / H);
  const cara = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texturaVentana(), transparent: true, toneMapped: false }));
  cara.position.z = 0.0;
  g.add(panel, cara);
  panel.castShadow = true;
  return g;
}

// ---------- la chispa: la marca del curso extruida ----------
async function chispa() {
  const txt = await (await fetch(new URL("../assets/marca/chispa.svg", import.meta.url))).text();
  const datos = new SVGLoader().parse(txt.replace(/currentColor/g, "#000"));
  const formas = datos.paths.flatMap((p) => p.toShapes(true));
  const geo = new THREE.ExtrudeGeometry(formas, { depth: 1.4, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.35, bevelSegments: 6, curveSegments: 24 });
  geo.center();
  geo.scale(1 / 24, -1 / 24, 1 / 24);
  const mat = barro(C.durazno, { rugosidad: 0.35, emisivo: C.durazno });
  mat.emissiveIntensity = 1.4;
  const m = new THREE.Mesh(geo, mat);
  const g = new THREE.Group();
  g.add(m);
  const luz = new THREE.PointLight(C.durazno, 0, 6, 1.6);
  g.add(luz);
  g.userData = { malla: m, luz };
  return g;
}

// ---------- el edificio ----------
export async function crearEscena(mundo) {
  const { escena } = mundo;
  // Fondo: el cielo héroe y el escenario navy son el mismo plano a distinta «noche» (0 = cielo,
  // 1 = navy). Así 01→02, 03–04, la noche de 11 y el cierre no cambian de mundo.
  const fondo = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { cielo: { value: texturaCielo() }, noche: { value: 0 }, navy: { value: C.navy.clone() }, hondo: { value: C.navyHondo.clone() } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1., 1.); }",
    fragmentShader: `uniform sampler2D cielo; uniform float noche; uniform vec3 navy; uniform vec3 hondo; varying vec2 vUv;
      void main(){ vec3 c = texture2D(cielo, vUv).rgb; vec3 n = mix(navy, hondo, smoothstep(0., 1., vUv.y)); gl_FragColor = vec4(mix(c, n, noche), 1.); }`,
    depthTest: false, depthWrite: false,
  }));
  fondo.material.uniforms.cielo.value.colorSpace = THREE.SRGBColorSpace;
  fondo.frustumCulled = false;
  fondo.renderOrder = -1000;
  escena.add(fondo);
  const nubes = crearNubes(escena);
  const rand = azar(7);
  const edificio = new THREE.Group();
  const utileria = [escritorio(), cajas(rand), calculadoraYReloj(), grafica(), mesaRedonda(), megafono(), servidores()];
  const pisos = PISOS.map((nombre, i) => {
    const piso = new THREE.Group();
    const losa = caja(LOSA.w, LOSA.h, LOSA.d, 0.18, C.hueso, { emisivo: C.cieloClaro });
    losa.position.y = -LOSA.h / 2;
    const filo = caja(LOSA.w + 0.04, 0.1, LOSA.d + 0.04, 0.05, C.azul, { emisivo: C.lima });
    filo.position.y = -LOSA.h + 0.02;
    piso.add(losa, filo);
    const u = utileria[i];
    u.position.set(i === 0 ? 0.2 : 0, 0, 0.1);
    piso.add(u);
    sombra(piso);
    piso.position.y = -i * PASO;
    piso.rotation.y = (i % 2 ? 1 : -1) * 0.035;
    edificio.add(piso);
    return { nombre, grupo: piso, losa, filo, utileria: u, ancla: new THREE.Vector3(LOSA.w / 2, -i * PASO - LOSA.h / 2, LOSA.d / 2) };
  });
  escena.add(edificio);

  const ventana = ventanaClaude();
  ventana.position.set(0.1, 2.25, 0.2);
  ventana.rotation.x = -0.06;
  escena.add(ventana);

  const spark = await chispa();
  spark.visible = false;
  escena.add(spark);

  mundo.sol.target.position.set(0, -7, 0);
  // vida secundaria: flotación lenta de cada piso, deriva de nubes, segundero, cable
  function vivir(t) {
    nubes.vivir(t);
    pisos.forEach((p, i) => {
      p.grupo.position.y = -i * PASO + Math.sin(t * 0.55 + i * 0.9) * 0.035;
    });
    ventana.position.y = 2.25 + Math.sin(t * 0.7) * 0.03;
    const reloj = pisos[2].utileria.userData.reloj;
    if (reloj) reloj.larga.rotation.z = -1.2 - t * 0.6;
  }
  // teléfono boca abajo (14): se queda sobre el escritorio; visible solo al final
  const telefono = caja(0.36, 0.035, 0.7, 0.05, C.navy);
  telefono.position.set(0.85, 1.025, 0.5); telefono.rotation.y = -0.4; telefono.castShadow = true;
  pisos[0].utileria.add(telefono);
  return { edificio, pisos, ventana, chispa: spark, vivir, fondo, telefono, nubes: nubes.grupos };
}
