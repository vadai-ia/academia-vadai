// Propuesta 3 · «La escalera infinita» — el mundo: render, luz, cámara ortográfica y materiales de
// juguete brillante (como la moneda de la referencia: volumen, brillo especular, sombra de contacto).
//
// La escalera de Penrose solo existe en proyección ortográfica: dos puntos que difieren en k·(1,1,1)
// caen en el mismo píxel cuando la cámara mira desde (1,1,1). Por eso la cámara es ortográfica y la
// pose «isométrica» es azimut 45° y elevación atan(1/√2).
//
// Determinismo: todo sale de t. Nada guarda estado entre cuadros.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export const COLOR = {
  fondo: "#E8EFF5", fondoNoche: "#0A1A2F",
  navy: "#0A1A2F", navyHondo: "#0C2137", hueso: "#EAF4FA", blanco: "#FFFFFF",
  azul: "#00A0DB", cieloClaro: "#4FC6EE", cieloHondo: "#006E96", lima: "#C6F24E", limaTinta: "#24340A",
  durazno: "#FFB489", coral: "#F08A5D", gris: "#4E6572", tinta: "#13263D",
};
export const ISO = { az: Math.PI / 4, el: Math.atan(1 / Math.SQRT2) };

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const tramo = (t, a, b) => clamp01((t - a) / (b - a));
export const mezcla = (a, b, u) => a + (b - a) * u;
export const curva = (nombre) => window.gsap.parseEase(nombre);
// pista de claves [{t, v, e}] — v número o array; e = curva del tramo que llega a esa clave
export function pista(claves) {
  const cs = claves.map((k) => ({ ...k, f: curva(k.e || "power2.inOut") }));
  return (t) => {
    if (t <= cs[0].t) return cs[0].v;
    for (let i = 1; i < cs.length; i++) {
      const a = cs[i - 1], b = cs[i];
      if (t <= b.t) {
        const p = b.f(tramo(t, a.t, b.t));
        return Array.isArray(a.v) ? a.v.map((x, j) => x + (b.v[j] - x) * p) : a.v + (b.v - a.v) * p;
      }
    }
    return cs[cs.length - 1].v;
  };
}
export function azar(semilla) {
  let a = semilla >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// resorte críticamente amortiguado (ζ<1 leve) para asentar sin rebote de caricatura
export const asentar = (u, k = 7) => (u <= 0 ? 0 : 1 - Math.exp(-k * u) * Math.cos(k * 0.55 * u));

// ---------- materiales ----------
const cacheMat = new Map();
// juguete brillante: plástico con barniz (clearcoat) que atrapa el entorno
export function brillo(color, { rugosidad = 0.32, barniz = 1, emisivo = null, opaco = false } = {}) {
  const k = `b${color}${rugosidad}${barniz}${emisivo}${opaco}`;
  if (cacheMat.has(k) && !emisivo) return cacheMat.get(k);
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color), roughness: rugosidad, metalness: 0,
    clearcoat: barniz, clearcoatRoughness: 0.12, sheen: opaco ? 0.4 : 0, sheenColor: new THREE.Color(0xffffff),
  });
  if (emisivo) { m.emissive = new THREE.Color(emisivo); m.emissiveIntensity = 0; }
  cacheMat.set(k, m);
  return m;
}
// arcilla mate (escalones, edificio): poco barniz, luz suave
export function arcilla(color, opts = {}) { return brillo(color, { rugosidad: 0.62, barniz: 0.25, opaco: true, ...opts }); }

// ---------- texturas de texto (canvas → textura) ----------
export function texturaTexto(dibujar, { w = 512, h = 256 } = {}) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d");
  dibujar(g, w, h);
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
  return tx;
}
export function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

// ---------- el mundo ----------
export function crearMundo(canvas, { ancho, alto }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, powerPreference: "high-performance", stencil: false });
  renderer.setPixelRatio(1);
  renderer.setSize(ancho, alto, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const escena = new THREE.Scene();
  const fondo = new THREE.Color(COLOR.fondo);
  escena.background = null;               // el fondo es CSS (degradado + grano) detrás del lienzo
  renderer.setClearColor(0x000000, 0);
  const pmrem = new THREE.PMREMGenerator(renderer);
  escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  escena.environmentIntensity = 0.55;

  const cielo = new THREE.HemisphereLight(0xffffff, new THREE.Color(COLOR.cieloHondo), 0.9);
  const sol = new THREE.DirectionalLight(0xffffff, 2.2);
  sol.castShadow = true;
  sol.shadow.mapSize.set(4096, 4096);
  sol.shadow.radius = 5;
  sol.shadow.bias = -0.0005;
  sol.shadow.normalBias = 0.03;
  escena.add(cielo, sol, sol.target);

  const camara = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000);
  const aspecto = ancho / alto;
  const vista = { x: 0, y: 0, z: 0, az: ISO.az, el: ISO.el, alto: 10, giro: 0 };
  function ponerCamara(v) {
    Object.assign(vista, v);
    const d = 400;
    const cx = Math.cos(vista.el) * Math.sin(vista.az), cy = Math.sin(vista.el), cz = Math.cos(vista.el) * Math.cos(vista.az);
    camara.position.set(vista.x + cx * d, vista.y + cy * d, vista.z + cz * d);
    camara.up.set(0, 1, 0);
    camara.lookAt(vista.x, vista.y, vista.z);
    if (vista.giro) camara.rotateZ(vista.giro);
    const K = aspecto < 1 ? 1.9 : 1;
    vista.altoReal = vista.alto * K;
    const h = vista.altoReal / 2;
    camara.left = -h * aspecto; camara.right = h * aspecto; camara.top = h; camara.bottom = -h;
    camara.near = 1; camara.far = 2 * d;
    camara.updateProjectionMatrix();
    camara.updateMatrixWorld();
    // en vertical la escena baja un poco: el tercio de arriba es del texto
    if (K > 1) { const up = new THREE.Vector3().setFromMatrixColumn(camara.matrixWorld, 1).multiplyScalar(vista.altoReal * 0.07); camara.position.add(up); camara.updateMatrixWorld(); }
    // la luz sigue a la cámara: arriba-izquierda-frente respecto al cuadro, y su caja de sombra cubre la vista
    const luz = new THREE.Vector3(-0.55, 1, 0.35).applyAxisAngle(new THREE.Vector3(0, 1, 0), vista.az - ISO.az).normalize();
    sol.position.set(vista.x + luz.x * 60, vista.y + luz.y * 60, vista.z + luz.z * 60);
    sol.target.position.set(vista.x, vista.y, vista.z);
    const s = Math.max(12, vista.alto * aspecto * 0.75);
    Object.assign(sol.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 160 });
    sol.shadow.camera.updateProjectionMatrix();
  }
  ponerCamara(vista);

  const mundo = {
    THREE, renderer, escena, camara, sol, cielo, fondo, vista, ponerCamara, ancho, alto,
    // de mundo a pantalla (px)
    proyectar(p) {
      const v = (p.isVector3 ? p.clone() : new THREE.Vector3(p.x, p.y, p.z)).project(camara);
      return { x: (v.x * 0.5 + 0.5) * ancho, y: (-v.y * 0.5 + 0.5) * alto };
    },
    // luz global (día 1 → noche 0)
    luz(u, colorFondo) {
      sol.intensity = 2.2 * u + 0.15; cielo.intensity = 0.9 * (0.3 + 0.7 * u);
      escena.environmentIntensity = 0.55 * (0.35 + 0.65 * u);
      if (colorFondo) fondo.set(colorFondo);
    },
    pintar() { renderer.render(escena, camara); },
  };
  return mundo;
}
