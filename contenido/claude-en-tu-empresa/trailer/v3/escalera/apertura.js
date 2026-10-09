// Propuesta 3 · «La escalera infinita» — de 0 a «nadie te ha explicado cómo» (≈31 s).
//  01 Todo mundo habla de IA ............ una multitud de píldoras, todas con su globo «IA». La cámara se
//                                          aleja y sube: vista desde arriba, la multitud forma las letras «IA».
//                                          Afuera, sola, TU EMPRESA. La cámara baja en picada hasta su puerta.
//  02 …qué hacer con ella en tu empresa .. a la puerta de TU EMPRESA cae la caja «IA»: trae un manual en blanco.
//  03 El nuevo bucle tecnológico ......... la caja se despliega en escalones y la cámara gira: es una escalera
//                                          de Penrose (sube para siempre y regresa al mismo escalón).
//  04 Cada semana… a su manera, o ni eso . cae una caja por semana; cada quien la usa a su manera; una se duerme.
//  05 …ya avanzaron… sale otra ........... clavan la bandera, dan tres saltos más y caen junto a la dormida:
//                                          nunca subieron. Y cae otra caja.
//  06 6 de cada 100 ...................... zoom out: 100 escaleras; seis rompen el lazo y suben en rampa.
//  07 Vas tarde: nadie te ha explicado cómo  regresa el manual en blanco; se le zafa una hoja que vuela a cámara.
import * as THREE from "three";
import { COLOR, ISO, pista, tramo, clamp01, mezcla, azar, asentar, brillo, arcilla } from "./mundo.js";
import * as O from "./objetos.js";
import { linea, golpe } from "./texto.js";
import { eventos } from "./eventos.js";

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const caer = (u) => u * u;                        // caída libre (sin rebote)
const sale3 = (u) => 1 - Math.pow(1 - u, 3);
const suave = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
// golpe de aterrizaje: aplasta y regresa con un asentado amortiguado
const aterriza = (t, t0, fuerza = 0.28, dur = 0.38) => { const u = tramo(t, t0, t0 + dur); if (u <= 0 || u >= 1) return 1; return 1 - fuerza * Math.exp(-5 * u) * Math.cos(9 * u); };

export function montar(ctx) {
  const { m, T, tl, raiz } = ctx;
  const golpes = ctx.golpes, fondo = ctx.fondo;
  ctx.cursorClaves = ctx.cursorClaves || [];
  const esc0 = m.escena;
  const w = (i, p, n = 1) => T.w(i, p, n);
  const wf = (i, p, n = 1) => T.wFin(i, p, n);

  // ================= tiempos (de la voz): v3/escalera/eventos.js, compartidos con la mezcla =================
  const E = eventos(T);
  const { t, tObj, tSt, tLente, tDespega, tCorte, tCae, tLlega, tAbre, tSaleMan, tAbreMan, tHojas, tGuarda, tPuerta,
    tArma0, tArmaPaso, tCierra, tSuben, tCajas, tBandera, tFesta, tLlegan, tOtraCae, tOtraLlega, tSeis, tPin0, tPin1, tMan2, tAbre2, tZafa } = E;
  ctx.tiemposApertura = t;

  // ================= el escenario =================
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ color: new THREE.Color(COLOR.cieloHondo), opacity: 0.22 }));
  piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true;
  esc0.add(piso);

  const derecha = V3(1, 0, -1).normalize();          // horizontal de pantalla en la pose isométrica

  // ---- 02: la empresa, la caja IA y el manual ----
  const esc = O.penrose();
  esc0.add(esc.g);
  const P1 = esc.P[1];
  const empresa = O.edificio();
  const BE = V3(P1.x + 2.1, 0, P1.z - 0.9);
  esc0.add(empresa.g);
  const cajaIA = O.cajaHerramienta({ etiqueta: "IA", lado: 0.95 });
  esc0.add(cajaIA.g);
  const man = O.manual();
  esc0.add(man.g);

  // ---- 01: la multitud que, vista desde arriba, forma «IA» (todos hablan de lo mismo) ----
  const RD = V3(Math.cos(ISO.az), 0, -Math.sin(ISO.az)), DN = V3(Math.sin(ISO.az), 0, Math.cos(ISO.az));   // derecha / abajo de pantalla
  const XC = BE.clone().add(V3(-16.5, 0, 5.0));
  const KPX = 0.115;
  const lienzo = document.createElement("canvas"); lienzo.width = 260; lienzo.height = 150;
  const gq = lienzo.getContext("2d");
  gq.fillStyle = "#000"; gq.font = '900 156px "Inter"'; gq.textAlign = "center"; gq.textBaseline = "middle"; gq.fillText("IA", 130, 84);
  const pxl = gq.getImageData(0, 0, 260, 150).data;
  const rM = azar(31), gente = [];
  for (let py = 4; py < 150; py += 8.3) for (let pxx = 4; pxx < 260; pxx += 8.3) {
    const jx = pxx + (rM() - 0.5) * 3.2, jy = py + (rM() - 0.5) * 3.2;
    const ix = Math.round(jx), iy = Math.round(jy);
    if (ix < 0 || iy < 0 || ix >= 260 || iy >= 150 || pxl[(iy * 260 + ix) * 4 + 3] < 128) continue;
    const pos = XC.clone().addScaledVector(RD, (jx - 130) * KPX).addScaledVector(DN, (jy - 75) * KPX);
    gente.push({ pos, px: jx, py: jy, rumbo: ISO.az + (rM() - 0.5) * 2.6, fase: rM() * 6.28, vel: 9 + rM() * 5, col: Math.floor(rM() * 5), vari: Math.floor(rM() * 3), azar: rM() });
  }
  const minPx = Math.min(...gente.map((g) => g.px));
  const origen = gente.reduce((a, g) => (Math.hypot(g.px - (minPx + 17), g.py - 70) < Math.hypot(a.px - (minPx + 17), a.py - 70) ? g : a), gente[0]);
  const dBmax = Math.max(...gente.map((g) => g.pos.distanceTo(BE)));
  gente.forEach((g) => { g.tPop = 0.06 + Math.hypot(g.px - origen.px, g.py - origen.py) * 0.0072 + g.azar * 0.12; g.tFuera = E.t.pero + 0.1 + (g.pos.distanceTo(BE) / dBmax) * 0.0 + (1 - g.pos.distanceTo(BE) / dBmax) * 0.5; });
  const NG = gente.length;
  const colGente = [COLOR.durazno, COLOR.azul, COLOR.lima, COLOR.cieloClaro, "#F4F7FA"].map((c) => new THREE.Color(c));
  const cuerpoG = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.34, 0.3, 8, 20), brillo("#ffffff", { rugosidad: 0.22 }), NG);
  cuerpoG.castShadow = true; cuerpoG.receiveShadow = true;
  gente.forEach((g, i) => cuerpoG.setColorAt(i, colGente[g.col]));
  const ojoB = new THREE.InstancedMesh(new THREE.SphereGeometry(0.112, 14, 10), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.15, clearcoat: 1 }), NG * 2);
  const ojoN = new THREE.InstancedMesh(new THREE.SphereGeometry(0.068, 12, 8), new THREE.MeshPhysicalMaterial({ color: new THREE.Color(COLOR.tinta), roughness: 0.2, clearcoat: 1 }), NG * 2);
  const globoTx = (txt, fondoG, tinta) => O.texturaGlobo(txt, fondoG, tinta);
  const globos = [["IA", "#FFFFFF", COLOR.navy], ["¡IA!", COLOR.lima, COLOR.navy], ["IA?", COLOR.cieloClaro, COLOR.navy]].map(([txt, f, c]) => {
    const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.95, 0.72), new THREE.MeshBasicMaterial({ map: globoTx(txt, f, c), transparent: true, alphaTest: 0.05, depthWrite: true }), NG);
    esc0.add(im); return im;
  });
  esc0.add(cuerpoG, ojoB, ojoN);
  // las mallas instanciadas se reparten lejos de su origen: sin esto three las descarta enteras (frustum)
  [cuerpoG, ojoB, ojoN, ...globos].forEach((x) => (x.frustumCulled = false));
  const dum = new THREE.Object3D(), mG = new THREE.Matrix4(), mE = new THREE.Matrix4(), cero = new THREE.Matrix4().makeScale(0, 0, 0);

  // ---- el equipo ----
  const equipo = [COLOR.durazno, COLOR.azul, COLOR.lima, COLOR.cieloClaro].map((c) => { const p = O.pildora(c); esc0.add(p.g); return p; });
  const [A, B, Cc, D] = equipo;
  const frentePuerta = [V3(0.1, 0, 1.55), V3(0.75, 0, 1.75), V3(1.4, 0, 1.6), V3(2.0, 0, 1.25)].map((d) => d.add(BE));

  // ---- 03: la escalera se arma ----

  // ---- 04: semanas y cajas ----
  const cal = O.calendario();
  esc0.add(cal.g);
  const semanas = [1, 2, 3, 4].map((n) => cal.pagina(n));
  const cent = V3(esc.centro.x - 3.1 + 0.6, 0.6, esc.centro.z + 3.4 + 0.6);   // a la izquierda del lazo (en pantalla)
  cal.g.position.copy(cent); cal.g.rotation.y = ISO.az; cal.g.scale.setScalar(1.55);
  const cajas = [
    O.cajaHerramienta({ color: COLOR.durazno, etiqueta: "NUEVA", fondoEtiqueta: COLOR.blanco, lado: 0.56, chispa: false }),
    O.cajaHerramienta({ color: COLOR.lima, etiqueta: "BETA", fondoEtiqueta: COLOR.navy, tinta: COLOR.lima, lado: 0.56, chispa: false }),
    O.cajaHerramienta({ color: COLOR.azul, etiqueta: "PRO", fondoEtiqueta: COLOR.blanco, lado: 0.56, chispa: false }),
  ];
  cajas.forEach((c) => esc0.add(c.g));
  const otra = O.cajaHerramienta({ color: COLOR.navy, etiqueta: "OTRA", lado: 1.5 });
  esc0.add(otra.g);
  const flag = O.bandera(); esc0.add(flag.g);
  const zzz = [0, 1, 2].map(() => { const s = O.letra("z", { tam: 0.42, color: COLOR.cieloHondo }); esc0.add(s); return s; });
  const pregunta = O.letra("?", { tam: 0.9, color: COLOR.cieloHondo }); esc0.add(pregunta);
  // confeti del festejo
  const confeti = [];
  const rC = azar(77);
  for (let k = 0; k < 26; k++) {
    const q = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.05), new THREE.MeshPhysicalMaterial({ color: new THREE.Color([COLOR.lima, COLOR.durazno, COLOR.azul, COLOR.cieloClaro][k % 4]), roughness: 0.4, side: THREE.DoubleSide }));
    q.userData = { vx: (rC() - 0.5) * 2.4, vy: 2.4 + rC() * 2.2, vz: (rC() - 0.5) * 2.4, gx: rC() * 9, gz: rC() * 9 };
    esc0.add(q); confeti.push(q);
  }

  // ---- 06: las otras 99 escaleras ----
  const S = 11.5, cel = [];
  for (let i = -5; i < 5; i++) for (let j = -5; j < 5; j++) if (i || j) cel.push({ i, j });
  const brillan = new Set(["-1,0", "0,-1", "-3,-2", "2,-4", "-4,2", "-2,-4"]);
  const geoP = O.geoEscalon(esc.w, esc.D);
  const matI = arcilla("#ffffff"); matI.vertexColors = true;
  const inst = new THREE.InstancedMesh(geoP, matI, cel.length * esc.N);
  inst.receiveShadow = true;
  const colBase = [new THREE.Color("#7FCDEC"), new THREE.Color("#3FA9DA")], colLima = new THREE.Color(COLOR.lima), colTmp = new THREE.Color();
  const mtx = new THREE.Matrix4(), escalaM = new THREE.Matrix4();
  let instSucio = false;
  cel.forEach((c, ci) => {
    for (let k = 1; k <= esc.N; k++) {
      const p = esc.P[k];
      mtx.makeTranslation(p.x + c.i * S, p.y - esc.D / 2, p.z + c.j * S);
      inst.setMatrixAt(ci * esc.N + k - 1, mtx);
      const u = 0.5 - 0.5 * Math.cos((2 * Math.PI * k) / esc.N);
      inst.setColorAt(ci * esc.N + k - 1, colTmp.copy(colBase[0]).lerp(colBase[1], u));
    }
  });
  inst.frustumCulled = false;
  esc0.add(inst);
  // pildoritas de las otras empresas (sin ojos a esa escala)
  const coloresEq = [COLOR.durazno, COLOR.azul, COLOR.lima].map((c) => new THREE.Color(c));
  const instP = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.34, 0.3, 6, 16), brillo("#ffffff", { rugosidad: 0.25 }), cel.length * 3);
  instP.castShadow = true;
  cel.forEach((c, ci) => { for (let k = 0; k < 3; k++) instP.setColorAt(ci * 3 + k, coloresEq[k]); });
  instP.frustumCulled = false;
  esc0.add(instP);
  // rayos de las seis: columna lima que sale del lazo hacia arriba
  const rayos = cel.filter((c) => brillan.has(`${c.i},${c.j}`)).map((c, k) => {
    const g = new THREE.Mesh(O.geoEscalon(esc.w * 0.9, 1), brillo(COLOR.lima, { rugosidad: 0.3, emisivo: COLOR.lima }));
    g.material.emissiveIntensity = 0.35;
    esc0.add(g);
    return { g, c, k };
  });

  // ---- 07: el manual vuelve; la hoja suelta ----
  const man2 = O.manual(); esc0.add(man2.g);
  const hoja = O.hojaSuelta(); esc0.add(hoja.g);

  // ================= textos =================
  const L = (partes, anclas, fin, op = {}) => { const l = linea(tl, raiz, { partes, anclas, ...op, ...(ctx.V ? ctx.textoV(op) : {}) }); ctx.textos.push({ l, fin }); return l; };
  const G = (q, op) => golpe(tl, q, { ...op, W: ctx.W, H: ctx.H, tam: ctx.V ? op.tam * 0.52 : op.tam });
  L([["Todo mundo", "fuerte"], ["habla de"], ["inteligencia", "cielo"], ["artificial.", "acento"]], [t.todo, t.todo + 0.11, t.habla, t.habla + 0.26, t.inteligencia, t.artificial], t.pero - 0.12, { dir: [0, 1] });
  L([["Casi nadie te dice"], ["qué hacer", "lima"], ["con ella"], ["en tu empresa.", "acento"]], [t.casi, t.nadie, t.dice - 0.05, t.dice + 0.05, t.que, t.hacer, t.ella - 0.08, t.ella, t.empresa - 0.12, t.empresa], t.fin1 + 0.25, { entra: [0, 1] });
  L([["Te presento el nuevo"], ["bucle", "cielo"], ["tecnológico.", "acento"]], [t.presento - 0.03, t.presento + 0.18, t.presento + 0.42, t.bucle - 0.12, t.bucle, t.tecno], t.cada - 0.2);
  L([["Cada"], ["semana", "acento"], ["sale una"], ["herramienta nueva.", "durazno"]], [t.cada, t.semana, t.sale, t.sale + 0.2, t.herramienta, t.nueva], t.equipo - 0.22);
  L([["Tu equipo intenta usarla"], ["a su manera…", "acento"]], [t.equipo - 0.04, t.equipo, t.intenta, t.usarla, t.manera - 0.18, t.manera - 0.08, t.manera], t.o - 0.18);
  L([["…o"], ["ni eso.", "fuerte"]], [t.o, t.o + 0.08, t.eso], t.y - 0.2);
  L([["Y cuando sienten que"], ["ya avanzaron…", "acento"]], [t.y + 0.02, t.y + 0.05, t.sienten, t.sienten + 0.3, t.ya, t.avanzaron], t.sale2 - 0.18);
  L([["sale", "acento"]], [t.sale2], t.otra - 0.06, { tam: 70 });
  G(golpes, { t: t.otra, dur: 0.48, texto: "OTRA.", fondo: COLOR.navy, color: COLOR.lima, tam: 380 });
  L([["Solo"], ["6", "fuerte"], ["de cada 100", "lima"], ["empresas"]], [t.solo, t.seis, t.seis + 0.22, t.seis + 0.42, t.cien, t.empresas], t.realmente - 0.18);
  L([["realmente le están sacando"], ["provecho", "acento"], ["a la IA."]], [t.realmente, t.realmente + 0.55, t.realmente + 0.62, t.realmente + 0.9, t.provecho, t.ia3 - 0.15, t.ia3], t.y4 - 0.2);
  L([["Es normal sentir que"]], [t.normal - 0.1, t.normal + 0.15, t.normal + 0.35, t.normal + 0.6], t.vas - 0.06);
  G(golpes, { t: t.vas, dur: 0.56, texto: "VAS TARDE", fondo: COLOR.durazno, color: COLOR.navy, tam: 300 });
  L([["Nadie te ha explicado"], ["cómo", "acento"], ["implementarla en tu negocio.", "cielo"]], [t.nadie4, t.nadie4 + 0.18, t.nadie4 + 0.3, t.explicado, t.como, w(4, "implementarla"), w(4, "en", 1), w(4, "tu"), t.negocio], t.fin4 + 0.2, { maxAncho: 1300, tam: 58 });

  // ---- la etiqueta «tu empresa» en la cuadrícula (sigue al lazo en pantalla) ----
  const pin = document.createElement("div");
  Object.assign(pin.style, { position: "absolute", left: "0", top: "0", opacity: "0", fontFamily: "Inter", fontWeight: 700, fontSize: "26px", color: "#fff", background: COLOR.navy, padding: "10px 20px", borderRadius: "999px", whiteSpace: "nowrap", boxShadow: "0 10px 24px rgba(10,26,47,.25)" });
  pin.innerHTML = 'tu empresa <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#C6F24E;margin-left:8px;vertical-align:2px"></span>';
  const pinPunta = document.createElement("div");
  Object.assign(pinPunta.style, { position: "absolute", left: "0", top: "0", width: "3px", height: "70px", background: COLOR.navy, opacity: "0", transformOrigin: "50% 0" });
  raiz.appendChild(pinPunta); raiz.appendChild(pin);

  // ================= cámara =================
  const cIso = (p, alto, extra = {}) => ({ v: [p.x - p.y, 0, p.z - p.y, ISO.az, ISO.el, alto], ...extra });
  const centroLazo = V3(esc.centro.x, 0, esc.centro.z);
  const enfoqueD = V3(P1.x - P1.y + 0.4, 0, P1.z - P1.y + 0.6);
  // foco en el plano isométrico sobre el escalón s (para seguir a los que suben)
  const focoSube = (sv) => { const a0 = esc.cima(Math.floor(sv)), a1 = esc.siguiente(Math.floor(sv)), u = sv - Math.floor(sv); const q = a0.clone().lerp(a1, u); return V3(q.x - q.y, 0, q.z - q.y); };
  const vB = (alto) => [P1.x + 1.0, 1.55, P1.z + 0.4, 0.42, 0.36, alto];
  const camB = pista([
    { t: 0, v: [origen.pos.x, 1.25, origen.pos.z, ISO.az, ISO.el, 3.7] },
    { t: 0.42, v: [origen.pos.x, 1.25, origen.pos.z, ISO.az, ISO.el, 4.0], e: "power1.in" },
    { t: t.artificial + 0.35, v: [XC.x - DN.x * 1.6, 0, XC.z - DN.z * 1.6, ISO.az, 1.5, 27.5], e: "power3.inOut" },
    { t: t.pero - 0.05, v: [XC.x - DN.x * 1.6, 0, XC.z - DN.z * 1.6, ISO.az, 1.5, 28.6], e: "power1.inOut" },
    { t: tLlega + 0.28, v: vB(5.6), e: "power3.inOut" },
    { t: tGuarda, v: vB(5.0), e: "power1.inOut" },
    { t: tArma0 + 0.4, v: [centroLazo.x * 0.6 + (P1.x + 1.1) * 0.4, 1.0, centroLazo.z * 0.6 + (P1.z + 0.5) * 0.4, 0.34, 0.4, 7.4], e: "power2.in" },
    { t: tCierra, v: [centroLazo.x, 0.55, centroLazo.z, ISO.az, ISO.el, 7.9], e: "power3.out" },
    { t: t.equipo - 0.1, v: [centroLazo.x, 0.55, centroLazo.z, ISO.az, ISO.el, 7.7], e: "power1.inOut" },
    { t: t.intenta + 0.25, v: [focoSube(13).x, 0.5, focoSube(13).z, ISO.az, ISO.el, 5.4], e: "power3.inOut" },
    { t: t.o - 0.12, v: [focoSube(15).x, 0.5, focoSube(15).z, ISO.az, ISO.el, 5.2], e: "power1.inOut" },
    { t: t.o + 0.25, v: [enfoqueD.x, 0.35, enfoqueD.z, ISO.az, ISO.el, 5.2], e: "power3.out" },
    { t: t.y - 0.05, v: [enfoqueD.x, 0.35, enfoqueD.z, ISO.az, ISO.el, 5.0], e: "power1.inOut" },
    { t: t.y + 0.45, v: [focoSube(17).x, 0.5, focoSube(17).z, ISO.az, ISO.el, 5.6], e: "power3.inOut" },
    { t: t.avanzaron + 0.2, v: [focoSube(18.5).x, 0.5, focoSube(18.5).z, ISO.az, ISO.el, 5.5], e: "power1.inOut" },
    { t: t.otra - 0.15, v: [centroLazo.x * 0.4 + enfoqueD.x * 0.6, 0.45, centroLazo.z * 0.4 + enfoqueD.z * 0.6, ISO.az, ISO.el, 6.4], e: "power2.inOut" },
    { t: t.realidad - 0.05, v: [centroLazo.x * 0.4 + enfoqueD.x * 0.6, 0.45, centroLazo.z * 0.4 + enfoqueD.z * 0.6, ISO.az, ISO.el, 6.6], e: "power1.inOut" },
    { t: t.seis + 0.1, v: [0, 15, 0, ISO.az, ISO.el, 88], e: "power3.inOut" },
    { t: t.ia3 + 0.1, v: [0, 14, 0, ISO.az, ISO.el, 82], e: "power1.inOut" },
    { t: t.normal + 0.25, v: [centroLazo.x - 1.5, 6.2, centroLazo.z - 1.5, ISO.az, ISO.el, 21], e: "power3.inOut" },
    { t: t.nadie4 - 0.15, v: [centroLazo.x - 1.5, 6.4, centroLazo.z - 1.5, ISO.az, ISO.el, 20], e: "power1.inOut" },
    { t: t.explicado + 0.1, v: [enfoqueD.x, 0.45, enfoqueD.z, ISO.az, ISO.el, 5.6], e: "power3.inOut" },
    { t: t.fin4 + 1.4, v: [enfoqueD.x + 0.4, 0.45, enfoqueD.z + 0.4, ISO.az, ISO.el, 5.0], e: "power1.inOut" },
  ]);
  const sacudidas = [{ t: t.otra + 0.1, dur: 0.45, amp: 0.16 }, { t: tLlega, dur: 0.3, amp: 0.05 }];

  // ================= estados por cuadro =================
  // posición de un personaje sobre la escalera para s desenvuelto
  const sobre = (s, extra = {}) => ({ ...O.saltar(esc, s), ...extra });
  // calendario de saltos: [t, s] → s(t) con cada salto de 0.26 s
  function trayecto(saltos) {
    return (tt) => {
      let s = saltos[0][1];
      for (const [ti, si] of saltos) {
        if (tt < ti) break;
        const u = clamp01((tt - ti) / 0.26);
        s = si - 1 + u;
        if (u >= 1) s = si;
      }
      return s;
    };
  }
  // A va al frente; B y C, un escalón atrás cada uno. Saltos en corcheas del pulso de la música.
  const trA = trayecto(E.hops);
  const trB = (tt) => trA(tt - 0.06) - 1, trC = (tt) => trA(tt - 0.12) - 2;

  function ponerEquipo(tt) {
    // salida por la puerta (02) → saltos a la escalera (03) → la escalera
    const salida = (k) => {
      const u = tramo(tt, tPuerta + k * 0.09, tPuerta + k * 0.09 + 0.45);
      const p = BE.clone().add(V3(0.0, 0, 0.9)).lerp(frentePuerta[k], sale3(u));
      return { x: p.x, y: Math.sin(Math.PI * u) * 0.35, z: p.z, escala: u > 0 ? 1 : 0, rumbo: 0.42 + (k - 1.5) * 0.15, sy: aterriza(tt, tPuerta + k * 0.09 + 0.45, 0.2) };
    };
    const destino = [4, 3, 2, 1];
    equipo.forEach((p, k) => {
      let e;
      const tSal = tSuben + k * 0.08;
      if (tt < tSal) {
        e = salida(k);
        // miran la caja y luego el manual
        e.mirar = [-0.6, tt > tSaleMan ? 0.5 : 0.1];
        if (tt > tHojas[1]) e.mirar = [-0.4 + 0.3 * Math.sin(tt * 3 + k), 0.4];
        e.parpado = (Math.abs(tt - (tHojas[2] + k * 0.13)) < 0.07) ? 1 : 0;
      } else {
        // salto largo de la puerta a su escalón
        const u = tramo(tt, tSal, tSal + 0.5);
        const a0 = frentePuerta[k], b0 = esc.cima(destino[k]);
        const p = a0.clone().lerp(b0, suave(u));
        p.y = mezcla(0, b0.y, suave(u)) + Math.sin(Math.PI * u) * 1.1;
        e = { x: p.x, y: p.y, z: p.z, rumbo: mezcla(0.42, esc.rumboDe(destino[k] + 1), sale3(u)), sy: u < 1 ? 1 + 0.1 * Math.sin(Math.PI * u) : aterriza(tt, tSal + 0.5, 0.25), sx: 1, escala: 1, mirar: [0, 0.2], parpado: 0 };
        if (u >= 1 && k < 3) {
          const s = [trA, trB, trC][k](tt);
          e = { ...sobre(s), escala: 1, mirar: [0.2, 0.25], parpado: 0, sudor: 0, ladea: 0, inclina: 0 };
        }
        if (u >= 1 && k === 3) {
          // la dormida: se acuesta en el escalón 1 en cuanto llega
          const c = esc.cima(1);
          const ua = tramo(tt, tSal + 0.55, tSal + 0.95);
          e = { x: c.x + 0.05, y: c.y, z: c.z + 0.18, rumbo: ISO.az + 0.25, ladea: -Math.PI / 2 * suave(ua) * 0.92, sy: 1, sx: 1, escala: 1, parpado: Math.min(1, ua * 1.4), mirar: [0, -0.2], inclina: 0 };
          e.y += 0.34 * suave(ua) * 0.95;          // de lado: el centro del cuerpo baja al radio
          // se despierta al llegar los demás
          const uw = tramo(tt, tLlegan - 0.12, tLlegan + 0.05);
          if (uw > 0) e.parpado = 1 - uw;
          if (uw > 0) e.mirar = [0.7, 0.2];
        }
      }
      // A, B, C: lo que hace cada quien con su caja (04) y la llegada (05)
      if (k < 3 && tt > tSal + 0.5) {
        if (tt > tCajas[k] + 0.3 && tt < tBandera) e.mirar = [[0, 0.9], [0.1, 0.8], [-0.6, -0.4]][k];
        if (k === 1 && tt > t.intenta && tt < t.o) e.ladea = 0.12 * Math.sin(tt * 26);         // B sacude la suya
        if (k === 2 && tt > t.intenta && tt < t.o) { e.ladea = 0.28; e.mirar = [0.6, 0.9]; }    // C la lee al revés
        // «o ni eso»: todos voltean a ver a la que duerme
        if (tt > t.o && tt < t.y) { e.rumbo = ISO.az + 0.6; e.mirar = [-0.8, -0.3]; }
        // festejo: brincan en su lugar
        if (tt > tFesta && tt < t.avanzaronF) { const u = tramo(tt, tFesta, tFesta + 0.32); e.y += Math.sin(Math.PI * u) * 0.38; e.sy = u < 1 ? 1.1 : aterriza(tt, tFesta + 0.32, 0.22); e.rumbo = ISO.az; e.parpado = 0.55; }
        // llegan junto a la dormida: se miran, sudor
        if (tt > tLlegan - 0.05) { e.rumbo = ISO.az + (k === 0 ? -0.9 : 0.5); e.mirar = k === 0 ? [-0.7, -0.4] : [0.8, -0.2]; e.sudor = clamp01((tt - tLlegan) / 0.18); }
        if (tt > tOtraLlega && k === 0) { e.sy = Math.max(0.18, aterriza(tt, tOtraLlega, 0.82, 0.6)); e.sx = 1 / Math.sqrt(e.sy); e.escala = tt > tOtraLlega + 0.06 && tt < t.normal - 0.3 ? 0 : 1; }
        if (tt > tOtraLlega && k > 0 && tt < t.normal) { const u = tramo(tt, tOtraLlega, tOtraLlega + 0.35); e.y += Math.sin(Math.PI * u) * 0.5; e.inclina = -0.35 * Math.sin(Math.PI * u); }
      }
      if (k === 3 && tt > tOtraLlega && tt < t.normal - 0.3) e.escala = 0;   // bajo la caja
      // 07: salen de debajo de la caja y miran hacia arriba (las rampas de las seis)
      const tSalen = E.tSalen;
      if (tt > tSalen && (k === 0 || k === 3)) {
        const c = esc.cima(1);
        const u = tramo(tt, tSalen + k * 0.03, tSalen + 0.4 + k * 0.03);
        e = { x: c.x + (k === 0 ? -0.15 : 0.25), y: c.y + Math.sin(Math.PI * u) * 0.45, z: c.z + (k === 0 ? -0.2 : 0.3), rumbo: ISO.az, sy: u < 1 ? 1 : aterriza(tt, tSalen + 0.4 + k * 0.03, 0.2), sx: 1, escala: u > 0 ? 1 : 0, ladea: 0, inclina: 0, parpado: 0, sudor: 0, mirar: [0, 0] };
      }
      if (tt > t.normal + 0.2) {
        e.mirar = [-0.5, 1]; e.rumbo = ISO.az - 0.35;
        e.sudor = tt > t.vas ? clamp01((tt - t.vas) / 0.2) : 0;
      }
      if (tt > tMan2 + 0.3) { e.mirar = [0.3, -0.6]; e.rumbo = ISO.az + 0.2; }
      if (tt > tZafa + 0.1) { e.mirar = [0.2 + 0.3 * Math.sin(tt * 2 + k), 0.9]; }
      e.visible = tt >= tCorte;
      p.poner({ inclina: 0, ladea: 0, sudor: 0, ...e });
    });
  }

  // ================= fondo vivo y cursor =================
  // humor por tramo: multitud (cielo + durazno) · bucle (cielo + lima) · 6 de 100 (lima) · tarde (durazno)
  ctx.paleta.push(
    { t: -1, base: "#F4F8FB", a: "#BFEAFB", b: "#FFD7C0", c: "#CFE1EE" },
    { t: t.presento, base: "#F2F8FB", a: "#B6E6F8", b: "#E2F6B8", c: "#C9DEEC" },
    { t: t.realidad, base: "#F5FAF0", a: "#DDF5B0", b: "#BDE7F7", c: "#D3E5EE" },
    { t: t.y4, base: "#FBF6F2", a: "#FFD3BA", b: "#C2E8F7", c: "#DCE6EE" },
  );
  ctx.marquesinas.push(
    { t0: -1, t1: t.pero + 0.2, texto: "IA ✦ IA ✦ IA ✦", color: COLOR.cieloHondo, op: 0.1, y: 560, tam: 320, vel: 120 },
    { t0: t.presento, t1: t.otra, texto: "BUCLE · BUCLE ·", color: COLOR.cieloHondo, op: 0.09, y: 600, tam: 300, vel: 80 },
    { t0: t.realidad, t1: t.y4, texto: "6 DE CADA 100 ·", color: COLOR.limaTinta, op: 0.08, y: 600, tam: 260, vel: 70 },
  );
  const P = (v3) => m.proyectar(v3);
  const esq = (x, y) => ({ x: x * (ctx.W / 1920), y: y * (ctx.H / 1080) });
  const cimaCaja = () => P(V3(P1.x, 1.0, P1.z));
  ctx.cursorClaves.push(
    { t: tLlega + 0.1, p: () => ({ x: cimaCaja().x + 260, y: cimaCaja().y + 120 }), oculto: true },
    { t: tAbre - 0.05, p: () => cimaCaja(), viaje: 0.5 },
    { t: tAbre + 0.02, p: () => cimaCaja(), clic: true },
    { t: tAbreMan - 0.02, p: () => P(V3(P1.x + 0.35, 1.5, P1.z + 0.2)), viaje: 0.35, clic: true },
    { t: tHojas[3], p: () => P(V3(P1.x + 0.9, 0.9, P1.z + 0.6)), viaje: 0.5 },
    { t: tArma0 - 0.12, p: () => P(V3(P1.x, 0.75, P1.z)), viaje: 0.4 },
    { t: tArma0 - 0.06, p: () => P(V3(P1.x, 0.75, P1.z)), clic: true },
    { t: tArma0 + 0.9, p: () => esq(1780, 980), viaje: 0.8 },
    { t: tArma0 + 1.0, p: () => esq(1780, 980), oculto: true },
    { t: tPin0 - 0.1, p: () => esq(1700, 900), oculto: true },
    { t: tPin0 + 0.35, p: () => { const q = P(V3(esc.P[esc.N].x, esc.P[esc.N].y + 0.8, esc.P[esc.N].z)); return { x: q.x + 40, y: q.y + 30 }; }, viaje: 0.6, clic: true },
    { t: tPin1 - 0.4, p: () => { const q = P(V3(esc.P[esc.N].x, esc.P[esc.N].y + 0.8, esc.P[esc.N].z)); return { x: q.x + 40, y: q.y + 30 }; } },
    { t: tPin1 + 0.3, p: () => esq(1700, 1000), viaje: 0.5 },
    { t: tPin1 + 0.4, p: () => esq(1700, 1000), oculto: true },
    { t: tAbre2 - 0.55, p: () => esq(1500, 950), oculto: true },
    { t: tAbre2 - 0.04, p: () => { const c = esc.cima(2); return P(V3(c.x + 0.4, c.y + 0.1, c.z + 0.35)); }, viaje: 0.45 },
    { t: tAbre2 + 0.02, p: () => { const c = esc.cima(2); return P(V3(c.x + 0.4, c.y + 0.1, c.z + 0.35)); }, clic: true },
    { t: tZafa + 0.6, p: () => esq(1820, 1020), viaje: 0.6 },
    { t: tZafa + 0.7, p: () => esq(1820, 1020), oculto: true },
  );

  // la multitud (01); el cierre la vuelve a llamar con el tiempo corrido («todo mundo te va a seguir hablando»)
  function multitud(tt) {
    const enC = tt < t.pero + 0.9;
    cuerpoG.visible = ojoB.visible = ojoN.visible = enC;
    globos.forEach((g) => (g.visible = enC));
    if (enC) {
      const q = m.camara.quaternion;
      gente.forEach((g, i) => {
        const uP = tramo(tt, g.tPop, g.tPop + 0.22);
        const uF = tramo(tt, g.tFuera, g.tFuera + 0.26);
        const vive = 1 - sale3(uF);
        const habla = uP > 0 ? 0.07 * Math.sin(tt * g.vel + g.fase) : 0;
        const sy = (1 + habla) * (uP > 0 && uP < 1 ? 1 - 0.18 * Math.sin(Math.PI * uP) : 1);
        const sx = 1 / Math.sqrt(sy);
        if (vive <= 0.001) { cuerpoG.setMatrixAt(i, cero); ojoB.setMatrixAt(2 * i, cero); ojoB.setMatrixAt(2 * i + 1, cero); ojoN.setMatrixAt(2 * i, cero); ojoN.setMatrixAt(2 * i + 1, cero); globos.forEach((gb) => gb.setMatrixAt(i, cero)); return; }
        dum.position.copy(g.pos); dum.rotation.set(0, g.rumbo + 0.25 * Math.sin(tt * 1.3 + g.fase), 0); dum.scale.set(sx * vive, sy * vive, sx * vive); dum.updateMatrix();
        mG.copy(dum.matrix);
        mE.makeTranslation(0, 0.51, 0); cuerpoG.setMatrixAt(i, mE.premultiply(mG));
        [-1, 1].forEach((lado, j) => {
          mE.makeTranslation(lado * 0.136, 0.632, 0.25).multiply(new THREE.Matrix4().makeScale(1, 1.18, 0.6)); ojoB.setMatrixAt(2 * i + j, mE.premultiply(mG));
          mE.makeTranslation(lado * 0.136, 0.632 + 0.02, 0.305).multiply(new THREE.Matrix4().makeScale(1, 1.12, 0.55)); ojoN.setMatrixAt(2 * i + j, mE.premultiply(mG));
        });
        // su globo: aparece en la ola, flota y se apaga en «Pero»
        const uG = tramo(tt, g.tPop, g.tPop + 0.28), uGf = tramo(tt, t.pero - 0.05 + g.azar * 0.18, t.pero + 0.13 + g.azar * 0.18);
        const eg = uG <= 0 || uGf >= 1 ? 0 : (uG < 1 ? 1 + 0.25 * Math.sin(Math.PI * uG) * (1 - uG) : 1) * Math.min(1, uG * 3) * (1 - uGf);
        globos.forEach((gb, k) => {
          if (k !== g.vari || eg <= 0.001) { gb.setMatrixAt(i, cero); return; }
          dum.position.copy(g.pos).add(V3(0, 1.02 * sy + 0.62 + 0.05 * Math.sin(tt * 3 + g.fase), 0)); dum.quaternion.copy(q); dum.scale.setScalar(eg); dum.updateMatrix();
          gb.setMatrixAt(i, dum.matrix); dum.rotation.set(0, 0, 0);
        });
      });
      cuerpoG.instanceMatrix.needsUpdate = ojoB.instanceMatrix.needsUpdate = ojoN.instanceMatrix.needsUpdate = true;
      globos.forEach((gb) => (gb.instanceMatrix.needsUpdate = true));
    }

  }

  function pintar(tt) {
    esc.g.visible = true; piso.visible = true;
    // ---------- cámara ----------
    let v = camB(tt);
    let dx = 0, dy = 0;
    for (const z of sacudidas) { const u = (tt - z.t) / z.dur; if (u < 0 || u > 1) continue; const a = z.amp * Math.pow(1 - u, 2); dx += a * Math.sin(tt * 97.3 + z.t * 13.1); dy += a * Math.cos(tt * 83.7 + z.t * 7.7); }
    m.ponerCamara({ x: v[0] + dx * derecha.x, y: v[1] + dy, z: v[2] + dx * derecha.z, az: v[3], el: v[4], alto: v[5] });

    multitud(tt);

    // ---------- 02: empresa, caja y manual ----------
    const enB = true;
    const uE = tramo(tt, tArma0 + 0.1, tArma0 + 0.55);
    empresa.poner({ x: BE.x, y: 0, z: BE.z, rumbo: 0.42, visible: enB && uE < 1, escala: 0.82 * (1 - sale3(uE) * 0.999), luces: 0.25 + 0.5 * tramo(tt, tPuerta - 0.2, tPuerta) });
    piso.material.opacity = 0.22 * (1 - tramo(tt, tArma0 + 0.2, tArma0 + 1.2));
    {
      const uc = tramo(tt, tCae, tLlega);
      const caja0 = V3(P1.x, 0, P1.z);
      const sq = aterriza(tt, tLlega, 0.3, 0.45);
      // la caja se vuelve el primer escalón: se encoge cuando sube el escalón 1
      const ud = tramo(tt, tArma0 - 0.05, tArma0 + 0.25);
      cajaIA.poner({ x: caja0.x, y: (1 - caer(uc)) * 7, z: caja0.z, rumbo: 0.42 + 0.35 * (1 - uc), sy: sq, sx: 1 / Math.sqrt(sq), abre: suave(tramo(tt, tAbre, tAbre + 0.32)) * (1 - suave(tramo(tt, tGuarda + 0.15, tGuarda + 0.35))), escala: 1 - sale3(ud) * 0.999, visible: enB && uc > 0 });
      // el manual sale de la caja, se abre y se hojea: en blanco
      const um = tramo(tt, tSaleMan, tSaleMan + 0.42), ug = tramo(tt, tGuarda, tGuarda + 0.3);
      const alto = mezcla(0.5, 1.55, sale3(um)) - 1.1 * suave(ug);
      man.poner({
        x: caja0.x, y: alto, z: caja0.z + 0.2, rumbo: 0.42, inclina: mezcla(0, 1.18, sale3(um)) * (1 - suave(ug)),
        abre: suave(tramo(tt, tAbreMan, tAbreMan + 0.3)) * (1 - suave(tramo(tt, tGuarda - 0.15, tGuarda + 0.05))),
        hojas: tHojas.map((h) => suave(tramo(tt, h, h + 0.3))),
        escala: um > 0 && ug < 1 ? 1 : 0, visible: enB,
      });
      // «?» sobre el equipo cuando ven que está en blanco
      const uq = tramo(tt, tHojas[3], tHojas[3] + 0.3), uq2 = tramo(tt, tGuarda - 0.1, tGuarda + 0.1);
      pregunta.visible = uq > 0 && uq2 < 1 && tt < tSuben;
      const pq = frentePuerta[1].clone().add(V3(0, 1.7 + 0.1 * Math.sin(tt * 4), 0));
      pregunta.position.copy(pq);
      pregunta.scale.setScalar(0.9 * sale3(uq) * (1 - uq2));
    }

    // ---------- 03: la escalera se arma alrededor ----------
    esc.pasos.forEach((p, i) => {
      const t0 = tArma0 + i * tArmaPaso;
      const u = tramo(tt, t0, t0 + 0.38);
      const k = u <= 0 ? 0.001 : u >= 1 ? 1 : asentar(u, 8);
      p.visible = enB && u > 0;
      p.scale.set(1, Math.max(0.001, k), 1);
      p.position.y = esc.P[i + 1].y - (esc.D / 2) * k;
    });

    // ---------- equipo ----------
    ponerEquipo(tt);

    // ---------- 04: calendario y cajas ----------
    const uCal = tramo(tt, t.cada - 0.15, t.cada + 0.2), uCalF = tramo(tt, t.o - 0.25, t.o);
    cal.g.visible = uCal > 0 && uCalF < 1;
    cal.g.scale.setScalar(1.55 * sale3(uCal) * (1 - uCalF));
    semanas.forEach((pg, k) => {
      const gira = k < 3 ? suave(tramo(tt, tCajas[k] - 0.05, tCajas[k] + 0.2)) : 0;
      pg.rotation.x = -Math.PI * 0.98 * gira;
      pg.visible = pg.rotation.x < Math.PI * 0.97;
      pg.position.z = 0.1 + (3 - k) * 0.004;
    });
    cajas.forEach((c, k) => {
      const portador = equipo[k];
      const est = portador.estado;
      const tLl = tCajas[k] + 0.32;
      const uc = tramo(tt, tCajas[k], tLl);
      const cabeza = V3(est.x, est.y + portador.alto * est.sy, est.z);
      let x = cabeza.x, y = cabeza.y + (1 - caer(uc)) * 6, z = cabeza.z, gx = 0, gz = 0, rumbo = est.rumbo;
      if (k === 0) { y -= 0.12; gz = 0.08 * Math.sin(tt * 7); }                                              // A: de sombrero
      if (k === 1 && tt > t.intenta && tt < t.o) { y += 0.35 + 0.08 * Math.abs(Math.sin(tt * 26)); gz = 0.5 * Math.sin(tt * 26); }   // B: la sacude
      else if (k === 1) y += 0.12;
      if (k === 2 && tt > t.intenta) { const f = V3(Math.sin(est.rumbo), 0, Math.cos(est.rumbo)).multiplyScalar(0.42); x += f.x; z += f.z; y -= 0.55; gz = Math.PI * suave(tramo(tt, t.intenta, t.intenta + 0.3)); }   // C: al revés
      else if (k === 2) y += 0.05;
      const sq = aterriza(tt, tLl, 0.25, 0.3);
      c.poner({ x, y, z, rumbo, giroX: gx, giroZ: gz, sy: sq, sx: 1, abre: 0, escala: uc > 0 && tt < tOtraLlega + 0.05 ? 1 : 0 });
      // el portador se aplasta cuando le cae
      if (uc >= 1 && tt < tLl + 0.35) portador.poner({ sy: est.sy * aterriza(tt, tLl, 0.22, 0.32) });
    });
    // zzz de la dormida
    zzz.forEach((z, k) => {
      const c = esc.cima(1);
      const per = 1.4, fase = ((tt - (tSuben + 1.2) + k * per / 3) % per + per) % per, u = fase / per;
      const activo = tt > tSuben + 1.2 && tt < tLlegan - 0.1;
      z.visible = activo;
      z.position.set(c.x + 0.3 + u * 0.45, c.y + 0.95 + u * 1.0, c.z + 0.3 + Math.sin(u * 6) * 0.06);
      z.material.opacity = Math.sin(Math.PI * u);
      z.scale.setScalar(0.2 + 0.32 * u);
    });
    // bandera: A la clava en el escalón 18
    {
      const c = esc.cima(18);
      const u = tramo(tt, tBandera, tBandera + 0.22);
      flag.g.visible = u > 0;
      flag.g.position.set(c.x + 0.4, c.y + (1 - sale3(u)) * 0.9, c.z - 0.2);
      flag.g.scale.set(1.7, 1.7 * aterriza(tt, tBandera + 0.22, 0.25, 0.3), 1.7);
      flag.g.rotation.y = ISO.az;
      flag.tela.rotation.y = 0.15 * Math.sin(tt * 5.5);
      flag.g.visible = u > 0 && tt < t.solo + 2;
    }
    // confeti del festejo
    confeti.forEach((q) => {
      const tc = tt - tFesta;
      q.visible = tc > 0 && tc < 1.3;
      if (!q.visible) return;
      const c = esc.cima(17);
      const d = q.userData;
      q.position.set(c.x + d.vx * tc, c.y + 1.2 + d.vy * tc - 4.9 * tc * tc, c.z + d.vz * tc);
      q.rotation.set(d.gx + tc * 8, 0, d.gz + tc * 6);
    });
    // la otra caja: cae sobre A y la dormida
    {
      const c = esc.cima(1);
      const u = tramo(tt, tOtraCae, tOtraLlega);
      const sq = aterriza(tt, tOtraLlega, 0.32, 0.5);
      // al salir de debajo, la caja se voltea y se va
      const uv = tramo(tt, t.normal - 0.35, t.normal + 0.15);
      otra.poner({ abre: 0, giroZ: 0, x: c.x + 0.05, y: c.y + (1 - caer(u)) * 9 + sale3(uv) * 0.4, z: c.z + 0.05, rumbo: ISO.az - 0.1, sy: sq, sx: 1 / Math.sqrt(sq), giroX: -1.4 * suave(uv), escala: u > 0 ? 1 - sale3(uv) : 0 });
    }

    // ---------- 06: las 99 y las seis ----------
    const u6 = tramo(tt, t.realidad - 0.1, t.seis);
    inst.visible = instP.visible = tt > t.realidad - 0.4 && tt < t.explicado + 0.2;
    const encoge = 1 - suave(tramo(tt, t.y4 - 0.15, t.normal + 0.25));   // las que no brillan se van: quedan la nuestra y las seis
    cel.forEach((c, ci) => {
      const lit = brillan.has(`${c.i},${c.j}`);
      const rk = [...brillan].indexOf(`${c.i},${c.j}`);
      const tl6 = tSeis + rk * E.pasoSeis;
      const ul = lit ? tramo(tt, tl6, tl6 + 0.25) : 0;
      for (let k = 1; k <= esc.N; k++) {
        if (encoge < 1 && !lit) { const p = esc.P[k]; mtx.makeTranslation(p.x + c.i * S, p.y - esc.D / 2, p.z + c.j * S); mtx.multiply(escalaM.makeScale(Math.max(0.001, encoge), Math.max(0.001, encoge), Math.max(0.001, encoge))); inst.setMatrixAt(ci * esc.N + k - 1, mtx); }
        if (lit) {
          const u = 0.5 - 0.5 * Math.cos((2 * Math.PI * k) / esc.N);
          colTmp.copy(colBase[0]).lerp(colBase[1], u).lerp(colLima, ul);
          inst.setColorAt(ci * esc.N + k - 1, colTmp);
        }
      }
      // sus pildoritas: dan vueltas sin fin; las de las seis suben por su rayo
      for (let k = 0; k < 3; k++) {
        const sp = (tt - 9) * 2.3 + c.i * 3.1 + c.j * 1.7 - k;
        const e = O.saltar(esc, sp, { alto: 0.3 });
        let x = e.x + c.i * S, y = e.y, z = e.z + c.j * S;
        if (lit && tt > tl6) { const top = esc.P[esc.N]; const ur = tramo(tt, tl6 + 0.15 + k * 0.12, tl6 + 2.6 + k * 0.12); x = top.x + c.i * S; z = top.z + c.j * S; y = top.y + 0.2 + ur * ur * 40; }
        mtx.makeTranslation(x, y + 0.51, z);
        if (encoge < 1 && !lit) mtx.multiply(escalaM.makeScale(Math.max(0.001, encoge), Math.max(0.001, encoge), Math.max(0.001, encoge)));
        instP.setMatrixAt(ci * 3 + k, mtx);
      }
    });
    inst.instanceColor.needsUpdate = true;
    if (encoge < 1) { inst.instanceMatrix.needsUpdate = true; instSucio = true; }
    else if (instSucio) {   // al volver atrás en el tiempo, regresan a su tamaño (cada cuadro es independiente)
      cel.forEach((c, ci) => { for (let k = 1; k <= esc.N; k++) { const p = esc.P[k]; mtx.makeTranslation(p.x + c.i * S, p.y - esc.D / 2, p.z + c.j * S); inst.setMatrixAt(ci * esc.N + k - 1, mtx); } });
      inst.instanceMatrix.needsUpdate = true; instSucio = false;
    }
    instP.instanceMatrix.needsUpdate = true;
    rayos.forEach((r) => {
      const tl6 = tSeis + r.k * E.pasoSeis;
      const u = tramo(tt, tl6, tl6 + 1.6);
      const top = esc.P[esc.N];
      const largo = 0.01 + 9 * (u * u * (3 - 2 * u));
      r.g.visible = u > 0 && tt < t.fin4 + 3;
      r.g.scale.set(1, largo, 1);
      r.g.position.set(top.x + r.c.i * S, top.y + largo / 2 + 0.05, top.z + r.c.j * S);
      r.g.material.emissiveIntensity = 0.35 + 0.4 * Math.exp(-3 * Math.max(0, tt - tl6));
    });

    // etiqueta: arriba del lazo propio, con su palito
    {
      const u = tramo(tt, tPin0, tPin0 + 0.3), uf = tramo(tt, tPin1 - 0.25, tPin1);
      const vis = u > 0 && uf < 1;
      const q = m.proyectar(V3(esc.P[esc.N].x, esc.P[esc.N].y + 0.8, esc.P[esc.N].z));
      const a = sale3(u) * (1 - uf);
      pin.style.opacity = vis ? String(a) : "0";
      pinPunta.style.opacity = vis ? String(a) : "0";
      const subida = 92 + (1 - a) * 18;
      pin.style.transform = `translate(${(q.x - 105).toFixed(1)}px, ${(q.y - subida - 50).toFixed(1)}px)`;
      pinPunta.style.transform = `translate(${(q.x - 1.5).toFixed(1)}px, ${(q.y - subida).toFixed(1)}px) scaleY(${(subida / 70).toFixed(3)})`;
    }

    // ---------- 07: el manual en blanco regresa; se zafa una hoja ----------
    {
      const c = esc.cima(2);
      const u = tramo(tt, tMan2, tMan2 + 0.32);
      const sq = aterriza(tt, tMan2 + 0.32, 0.25, 0.35);
      man2.poner({ x: c.x + 0.1, y: c.y + (1 - caer(u)) * 8 + 0.02, z: c.z + 0.35, rumbo: ISO.az - 0.5, inclina: -0.05, abre: suave(tramo(tt, tAbre2, tAbre2 + 0.3)), hojas: [0, 1, 2, 3, 4].map((k) => suave(tramo(tt, tAbre2 + 0.25 + k * 0.12, tAbre2 + 0.5 + k * 0.12))), escala: u > 0 ? sq : 0, visible: u > 0 });
      // la hoja suelta: sube, se mece y viene hacia la cámara hasta llenar el cuadro (blanco del reporte)
      const uz = tt - tZafa;
      hoja.g.visible = uz > 0;
      if (uz > 0) {
        const haciaCam = V3(Math.cos(ISO.el) * Math.sin(ISO.az), Math.sin(ISO.el), Math.cos(ISO.el) * Math.cos(ISO.az));
        const ua = tramo(tt, t.mientras - 0.5, t.mientras + 0.15);
        const p = V3(c.x + 0.4, c.y + 0.5 + Math.min(uz, 1.2) * 0.9 - Math.max(0, uz - 1.2) * 0.25, c.z + 0.5);
        p.x += 0.35 * Math.sin(uz * 2.6); p.z += 0.35 * Math.sin(uz * 2.6);
        p.addScaledVector(haciaCam, ua * ua * 30);
        hoja.g.position.copy(p);
        hoja.g.rotation.set(-Math.PI / 2 + 0.6 * Math.sin(uz * 2.6) + ua * (Math.PI / 2 - ISO.el + 0.0), ISO.az + 0.3 * Math.sin(uz * 1.9) * (1 - ua), 0.4 * Math.sin(uz * 2.6 + 1) * (1 - ua));
        hoja.g.scale.setScalar(1 + ua * ua * 14);
      }
    }
  }
  // fuera de su tramo, lo suyo en el DOM se apaga (los saltos de la línea de tiempo no pasan por pintar)
  function siempre(tt) { if (tt < t.mientras + 0.15) return; pin.style.opacity = "0"; pinPunta.style.opacity = "0"; }
  return { pintar, siempre, multitud, t, E, esc, equipo, empresa, cajas, otra, cajaIA, man, man2, inst, instP, cel, S, brillan, rayos, colBase, colLima, gente, cuerpoG, ojoB, ojoN, globos, XC, origen, BE, P1, flag, cal };
}
