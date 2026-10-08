// Motor del mundo continuo: render, luz, materiales "soft clay", post-proceso y obturador.
// Es la mitad 3D de la definición de estilo única (la otra mitad es estilo/tokens.css,
// generada de estilo/marca.json). Ninguna toma crea su propio renderer, luz o acabado.
//
// Determinismo: todo sale de `t` (segundos del master). No hay reloj, no hay azar sin
// semilla, no hay estado que dependa del cuadro anterior: el grano usa el número de
// cuadro como semilla y el motion blur vuelve a muestrear la escena en t ± obturador.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  EffectComposer, RenderPass, NormalPass, EffectPass, Pass, Effect,
  BloomEffect, DepthOfFieldEffect, SMAAEffect, SMAAPreset, SSAOEffect,
  ToneMappingEffect, ToneMappingMode, BlendFunction,
} from "postprocessing";

export const MARCA = await (await fetch(new URL("./marca.json", import.meta.url))).json();
export const C = Object.fromEntries(Object.entries(MARCA.color).map(([k, v]) => [k, new THREE.Color(v.hex)]));
export const FPS = MARCA.ritmo.fps;

// ---------- azar con semilla ----------
export function azar(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- curvas de tiempo ----------
// Las curvas son las de GSAP (gsap.parseEase), así 3D y tipografía hablan el mismo idioma.
export const curva = (nombre) => window.gsap.parseEase(nombre);
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const tramo = (t, a, b) => clamp01((t - a) / (b - a));

// Pista de claves: [{t, v, e}] — v es número o array; e es la curva del tramo que llega a esa clave.
export function pista(claves) {
  return (t) => {
    if (t <= claves[0].t) return claves[0].v;
    for (let i = 1; i < claves.length; i++) {
      const k0 = claves[i - 1], k1 = claves[i];
      if (t <= k1.t) {
        const p = curva(k1.e || "power2.inOut")(tramo(t, k0.t, k1.t));
        if (Array.isArray(k0.v)) return k0.v.map((x, j) => x + (k1.v[j] - x) * p);
        return k0.v + (k1.v - k0.v) * p;
      }
    }
    return claves[claves.length - 1].v;
  };
}

// ---------- materiales ----------
// "Soft clay": mate, sin metal, con un barniz muy leve para que el filo redondeado atrape luz.
export function barro(color, { rugosidad = 0.62, barniz = 0.12, emisivo = null } = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    color: color instanceof THREE.Color ? color : new THREE.Color(color),
    roughness: rugosidad, metalness: 0, clearcoat: barniz, clearcoatRoughness: 0.55,
    sheen: 0.25, sheenRoughness: 0.8, sheenColor: new THREE.Color(0xffffff),
  });
  if (emisivo) { m.emissive = new THREE.Color(emisivo); m.emissiveIntensity = 0; }
  return m;
}

export function vidrio() {
  return new THREE.MeshPhysicalMaterial({
    color: C.blanco, roughness: 0.32, metalness: 0, transmission: 1, thickness: 0.25,
    ior: 1.35, attenuationColor: C.hueso, attenuationDistance: 2.5, clearcoat: 0.6, clearcoatRoughness: 0.2,
  });
}

// ---------- acabado: grade + viñeta + grano (semilla = cuadro) ----------
const fragAcabado = /* glsl */ `
uniform float semilla;
uniform float grano;
uniform float vineta;
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void mainImage(const in vec4 entrada, const in vec2 uv, out vec4 salida) {
  vec3 c = entrada.rgb;
  // grade unificado: sombras levemente hacia navy, luces hacia hueso; contraste suave
  float l = dot(c, vec3(.2126, .7152, .0722));
  c = mix(c, c * vec3(.94, .98, 1.04), (1. - l) * .25);
  c = mix(vec3(l), c, 1.04);
  // viñeta muy leve
  vec2 d = uv - .5; d.x *= 1.777;
  c *= 1. - vineta * smoothstep(.45, 1.15, length(d));
  // grano casi invisible, fijo por cuadro
  float n = h12(gl_FragCoord.xy + semilla * 37.17) - .5;
  c += n * grano * (1. - l * .6);
  salida = vec4(c, entrada.a);
}`;
class Acabado extends Effect {
  constructor() {
    super("Acabado", fragAcabado, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map([
        ["semilla", new THREE.Uniform(0)],
        ["grano", new THREE.Uniform(MARCA.acabado.grano)],
        ["vineta", new THREE.Uniform(MARCA.acabado.vineta)],
      ]),
    });
  }
}

// ---------- obturador: motion blur por submuestreo ----------
// Vuelve a pintar la escena en N instantes repartidos dentro del ángulo de obturador y los
// promedia. N lo decide la toma según cuánto se mueve la cámara en ese cuadro (determinista).
class Obturador extends Pass {
  constructor(escena, camara, mundo) {
    super("Obturador", escena, camara);
    this.needsSwap = false;
    this.mundo = mundo;
    const opts = { type: THREE.HalfFloatType, depthBuffer: true };
    this.sub = new THREE.WebGLRenderTarget(1, 1, opts);
    this.acc = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    this.mat = new THREE.ShaderMaterial({
      uniforms: { mapa: { value: null }, peso: { value: 1 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }",
      fragmentShader: "uniform sampler2D mapa; uniform float peso; varying vec2 vUv; void main(){ gl_FragColor = texture2D(mapa, vUv) * peso; }",
      depthTest: false, depthWrite: false, blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
    });
    this.copia = this.mat.clone();
    this.copia.blending = THREE.NoBlending;
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quadEscena = new THREE.Scene();
    this.quadEscena.add(this.quad);
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  setSize(w, h) { this.sub.setSize(w, h); this.acc.setSize(w, h); }
  render(renderer, entrada) {
    const { t, muestras } = this.mundo.estado;
    if (muestras <= 1) return;
    const ventana = (MARCA.camara.obturador.angulo / 360) / FPS;
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(this.acc);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, false, false);
    for (let k = 0; k < muestras; k++) {
      const tk = t + ((k + 0.5) / muestras - 0.5) * ventana;
      this.mundo.aplicar(tk);
      renderer.setRenderTarget(this.sub);
      renderer.clear();
      renderer.render(this.scene, this.camera);
      this.mat.uniforms.mapa.value = this.sub.texture;
      this.mat.uniforms.peso.value = 1 / muestras;
      this.quad.material = this.mat;
      renderer.setRenderTarget(this.acc);
      renderer.render(this.quadEscena, this.quadCam);
    }
    this.mundo.aplicar(t);
    // el color promediado reemplaza al del instante central; la profundidad (DOF, AO) se queda
    this.copia.uniforms.mapa.value = this.acc.texture;
    this.copia.uniforms.peso.value = 1;
    this.quad.material = this.copia;
    renderer.setRenderTarget(entrada);
    renderer.render(this.quadEscena, this.quadCam);
    renderer.autoClear = autoClear;
  }
}

// ---------- el mundo ----------
export function crearMundo(canvas, { ancho = 1920, alto = 1080 } = {}) {
  const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", preserveDrawingBuffer: true, stencil: false });
  renderer.setPixelRatio(dpr);
  renderer.setSize(ancho, alto, false);
  renderer.toneMapping = THREE.NoToneMapping; // lo hace el post, una sola vez
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // r186: PCF ya filtra suave con shadow.radius
  renderer.shadowMap.autoUpdate = true;

  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(MARCA.camara.fov, ancho / alto, 0.1, 400);
  const pmrem = new THREE.PMREMGenerator(renderer);
  escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  escena.environmentIntensity = 0.4;

  // Una sola dirección de luz para todo el filme: arriba-izquierda-frente.
  const cielo = new THREE.HemisphereLight(C.blanco, C.cieloHondo, 0.65);
  const sol = new THREE.DirectionalLight(0xffffff, 1.9);
  sol.position.set(-8, 16, 10);
  sol.castShadow = true;
  sol.shadow.mapSize.set(4096, 4096);
  sol.shadow.radius = 6;
  sol.shadow.bias = -0.0004;
  sol.shadow.normalBias = 0.02;
  Object.assign(sol.shadow.camera, { left: -11, right: 11, top: 10, bottom: -19, near: 1, far: 70 });
  escena.add(cielo, sol, sol.target);

  const mundo = { THREE, renderer, escena, camara, sol, luzCielo: cielo, estado: { t: 0, muestras: 1 }, aplicar: () => {} };
  // luz global 0..1 (03–04 apagan el mundo; 11 hace la noche): escala sol, cielo y entorno
  mundo.luz = (u) => { sol.intensity = 1.9 * u; cielo.intensity = 0.65 * (0.25 + 0.75 * u); escena.environmentIntensity = 0.4 * (0.2 + 0.8 * u); };

  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
  composer.addPass(new RenderPass(escena, camara));
  const normales = new NormalPass(escena, camara);
  composer.addPass(normales);
  composer.addPass(new Obturador(escena, camara, mundo));
  const ao = new SSAOEffect(camara, normales.texture, {
    blendFunction: BlendFunction.MULTIPLY, samples: 16, rings: 4, radius: MARCA.acabado.ao.radio,
    intensity: MARCA.acabado.ao.intensidad, luminanceInfluence: 0.6, bias: 0.025, fade: 0.02,
    worldDistanceThreshold: 30, worldDistanceFalloff: 5, worldProximityThreshold: 0.6, worldProximityFalloff: 0.3,
    resolutionScale: 0.75, color: C.navy,
  });
  const dof = new DepthOfFieldEffect(camara, { worldFocusDistance: 10, worldFocusRange: 8, bokehScale: 2.2, resolutionScale: 0.75 });
  const bloom = new BloomEffect({ intensity: MARCA.acabado.bloom.intensidad, luminanceThreshold: MARCA.acabado.bloom.umbral, luminanceSmoothing: MARCA.acabado.bloom.suavidad, mipmapBlur: true, radius: 0.7 });
  const tono = new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL });
  const acabado = new Acabado();
  composer.addPass(new EffectPass(camara, ao));
  composer.addPass(new EffectPass(camara, dof));
  composer.addPass(new EffectPass(camara, bloom, tono));
  composer.addPass(new EffectPass(camara, new SMAAEffect({ preset: SMAAPreset.HIGH })));
  composer.addPass(new EffectPass(camara, acabado));

  Object.assign(mundo, {
    composer, dof, bloom, ao, acabado,
    // enfoque en unidades de mundo: distancia de la cámara al punto que se quiere nítido
    enfocar(punto, rango = 8) {
      dof.cocMaterial.worldFocusDistance = camara.position.distanceTo(punto);
      dof.cocMaterial.worldFocusRange = rango;
    },
    proyectar(v3) {
      const p = v3.clone().project(camara);
      return { x: (p.x * 0.5 + 0.5) * ancho, y: (-p.y * 0.5 + 0.5) * alto, delante: p.z < 1 };
    },
    pintar(t, aplicar, muestras = 1) {
      mundo.aplicar = aplicar;
      mundo.estado.t = t;
      mundo.estado.muestras = muestras;
      aplicar(t);
      acabado.uniforms.get("semilla").value = Math.round(t * FPS) % 4096;
      composer.render(1 / FPS);
    },
  });
  return mundo;
}
