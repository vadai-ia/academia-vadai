// Propuesta 3 · «La escalera infinita» — el cierre (≈53–94 s). Plática y curso comparten la estructura:
//  14 Plática en vivo / Claude en tu Empresa · la red lima se pliega en una videollamada en vivo (plática) o en el
//                                   título del curso con su escalera paso a paso (curso)
//  15 Qué pasa con la IA… / los temas ......... la pantalla compartida enseña la multitud y las seis (plática);
//                                   los capítulos del manual (curso)
//  16 Salir del bucle .............. de vuelta en la Penrose: el escalón del equipo se vuelve lima y sube, como las seis
//  17 Todo en un mismo lugar ....... lo de toda la historia (calendario, cajas, manual, canicas) cae en una sola tarjeta
//  18 Tu equipo resuelve ........... el tobogán otra vez: ahora el equipo atrapa las decisiones; tu escritorio, vacío
//  19 Respaldo ...................... VADAI y Total Coach; las 100 escaleras se encienden en ola
//  20 Todo mundo te va a seguir… .... vuelve la multitud que forma «IA»
//  21 Nosotros te enseñamos qué hacer  el manual en blanco por fin se escribe solo
//  22 CTA · GRATIS / primera semana · el cursor (ahora la manita) da clic
//  23 Lo caro … a mano .............. navy y rojo; las canicas llueven otra vez sobre el escritorio
//  24 Tarjeta final
import * as THREE from "three";
import { COLOR, ISO, pista, tramo, clamp01, mezcla, azar, brillo, arcilla, texturaTexto, rrect } from "./mundo.js";
import * as O from "./objetos.js";
import { linea, golpe, etiqueta } from "./texto.js";

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const sale3 = (u) => 1 - Math.pow(1 - u, 3);
const suave = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const caer = (u) => u * u;
const aterriza = (t, t0, f = 0.28, d = 0.38) => { const u = tramo(t, t0, t0 + d); if (u <= 0 || u >= 1) return 1; return 1 - f * Math.exp(-5 * u) * Math.cos(9 * u); };
const ROJO = "#C4342C";

export const DESDE = (T) => T.w(9, "Por") - 0.25;

// píldora en CSS (avatares de la videollamada, tarjeta final)
function avatar(color, tam = 80) {
  const d = document.createElement("div");
  Object.assign(d.style, { position: "relative", width: `${tam * 0.68}px`, height: `${tam}px`, borderRadius: `${tam}px`, background: `radial-gradient(70% 55% at 35% 25%, rgba(255,255,255,.75), transparent 60%), ${color}`, boxShadow: `inset -${tam * 0.08}px -${tam * 0.1}px ${tam * 0.18}px rgba(10,26,47,.18), 0 ${tam * 0.08}px ${tam * 0.16}px rgba(10,26,47,.18)` });
  for (const lado of [-1, 1]) {
    const o = document.createElement("div");
    Object.assign(o.style, { position: "absolute", top: `${tam * 0.3}px`, left: `${tam * 0.34 + lado * tam * 0.13 - tam * 0.1}px`, width: `${tam * 0.2}px`, height: `${tam * 0.23}px`, borderRadius: "50%", background: "#fff" });
    const p = document.createElement("div");
    Object.assign(p.style, { position: "absolute", top: `${tam * 0.06}px`, left: `${tam * 0.05}px`, width: `${tam * 0.12}px`, height: `${tam * 0.13}px`, borderRadius: "50%", background: COLOR.tinta });
    o.appendChild(p); d.appendChild(o);
  }
  return d;
}
const div = (padre, estilo = {}, html = "") => { const d = document.createElement("div"); Object.assign(d.style, { position: "absolute", ...estilo }); if (html) d.innerHTML = html; padre.appendChild(d); return d; };

export function montar(ctx) {
  const { m, T, tl, raiz, ap, md, W, H } = ctx;
  const platica = ctx.cierre === "platica";
  const esc0 = m.escena;
  const pal = (i, k = 0, n = 99) => T.porFrase[i].slice(k, k + n).map((p) => p.start);
  const ini = (i, k) => T.porFrase[i][k].start, fin = (i, k) => T.porFrase[i][k].end;
  const desde = DESDE(T);
  const off = platica ? 16 : 29;           // en la frase 10, dónde empieza «y cómo salir del bucle»
  const t = {
    f9: ini(9, 0), f9fin: T.f(9).fin,
    f10: ini(10, 0), salir: ini(10, off + 2), bucle: ini(10, off + 4), bucleF: fin(10, off + 4),
    todo: ini(10, off + 5), lugar: ini(10, off + 9), con: ini(10, off + 10), claude: ini(10, off + 11), metodo: ini(10, off + 15), metodoF: fin(10, off + 15),
    para: ini(10, off + 16), equipo: ini(10, off + 19), resuelva: ini(10, off + 20), esperarte: ini(10, off + 24), f10fin: T.f(10).fin,
    lo: ini(11, 0), vadai: ini(11, 2), coach: ini(11, 5), cientos: ini(11, 7), capacitadas: ini(11, 11), f11fin: T.f(11).fin,
    porque: ini(12, 0), todo12: ini(12, 1), artificial: ini(12, 10), f12fin: T.f(12).fin,
    nosotros: ini(13, 0), que13: ini(13, 3), hacer13: ini(13, 4), f13fin: T.f(13).fin,
    dale: ini(14, 0), clic: ini(14, 1), aqui: ini(14, 2), abajo: ini(14, 3), cta: ini(14, platica ? 5 : 5), f14fin: T.f(14).fin,
    f15: ini(15, 0), f15fin: T.f(15).fin,
    loCaro: ini(16, 0), caro: ini(16, 1), mano: ini(16, 9), f16fin: T.f(16).fin,
  };
  t.tarjeta = t.f16fin + 0.25;
  const DUR = T.duracion;
  ctx.tiemposCierre = t;

  // ================= textos =================
  const L = (partes, anclas, fin, op = {}) => { const l = linea(tl, raiz, { partes, anclas, ...op, ...(ctx.V ? ctx.textoV(op) : {}) }); ctx.textos.push({ l, fin }); return l; };
  const G = (q, op) => golpe(tl, q, { ...op, W: ctx.W, H: ctx.H, tam: ctx.V ? op.tam * 0.52 : op.tam });
  if (platica) {
    L([["Por eso creamos esta"], ["plática gratuita", "lima"], ["y"], ["en vivo", "acento"]], pal(9, 0, 9), ini(9, 9) - 0.08, { tam: 60 });
    L([["para"], ["dueños y directivos.", "cielo"]], pal(9, 9, 4), t.f10 - 0.15, { tam: 60 });
    L([["Te contamos"], ["qué está pasando", "acento"], ["con la IA,"]], pal(10, 0, 8), ini(10, 8) - 0.08, { tam: 58 });
    L([["qué hacen las empresas que"], ["sí la aprovechan,", "lima"]], pal(10, 8, 8), ini(10, 16) - 0.08, { tam: 58 });
  } else {
    L([["Por eso creamos"], ["Claude en tu Empresa:", "fuerte"]], pal(9, 0, 7), ini(9, 7) - 0.08, { tam: 62 });
    L([["el curso donde aprendes,"], ["paso a paso,", "lima"]], pal(9, 7, 7), ini(9, 14) - 0.08, { tam: 60 });
    L([["a tener a"], ["Claude", "acento"], ["trabajando en tu empresa.", "cielo"]], pal(9, 14, 8), t.f10 - 0.12, { tam: 60 });
    L([["Aprendes a"], ["hablarle a la IA,", "cielo"]], pal(10, 0, 6), ini(10, 6) - 0.08, { tam: 60 });
    L([["en qué punto"], ["está hoy,", "acento"]], pal(10, 6, 5), ini(10, 11) - 0.08, { tam: 60 });
    L([["cómo usarla en"], ["cualquier herramienta", "lima"], ["de tu día a día,"]], pal(10, 11, 10), ini(10, 21) - 0.08, { tam: 58 });
    L([["cómo conectarla con"], ["tu información y tu correo,", "durazno"]], pal(10, 21, 8), ini(10, 29) - 0.08, { tam: 58 });
  }
  L([["y cómo"], ["salir del bucle:", "fuerte"]], pal(10, off, 5), t.todo - 0.1, { tam: 64 });
  L([["todo en"], ["un mismo lugar,", "cielo"]], pal(10, off + 5, 5), t.con - 0.08, { tam: 62 });
  L([["con"], ["Claude", "acento"], ["y"], ["un mismo método,", "lima"]], pal(10, off + 10, 6), t.para - 0.1, { tam: 62 });
  L([["para que tu equipo"], ["resuelva", "fuerte"], ["sin tener que"], ["esperarte.", "acento"]], pal(10, off + 16, 9), t.lo - 0.15, { tam: 60 });
  L([["Lo respaldan"], ["VADAI y Total Coach,", "fuerte"]], pal(11, 0, 6), ini(11, 6) - 0.08, { tam: 62 });
  L([["con"], ["cientos", "fuerte"], ["de empresas mexicanas"], ["capacitadas", "lima"], ["en el uso de IA."]], pal(11, 6, 11), t.porque - 0.15, { tam: 56 });
  L([["Porque"], ["todo mundo", "fuerte"], ["te va a seguir hablando de"], ["inteligencia artificial.", "acento"]], pal(12), t.nosotros - 0.15, { tam: 56 });
  L([["Nosotros te enseñamos"], ["qué hacer", "lima"], ["con ella."]], pal(13), t.dale - 0.12, { tam: 66 });
  if (platica) L([["Dale"], ["clic", "fuerte"], ["aquí abajo", "acento"], ["y aparta tu lugar."]], pal(14), t.f15 - 0.06, { tam: 64 });
  else L([["Dale"], ["clic", "fuerte"], ["aquí abajo", "acento"], ["e inscribe a tu equipo."]], pal(14), t.f15 - 0.06, { tam: 64 });
  if (platica) G(ctx.golpes, { t: ini(15, 2), dur: 0.52, texto: "GRATIS.", fondo: COLOR.azul, color: "#FFFFFF", tam: 380 });
  else L([["Los resultados se ven desde"], ["la primera semana.", "lima"]], pal(15), t.loCaro - 0.12, { tam: 62 });
  L([["Lo caro", "rojo"], ["es que sigan haciendo las cosas", "blanco"], ["a mano.", "acentoBlanco"]], pal(16), t.tarjeta - 0.05, { tam: 70, y: 110, tamAcento: 1.45 });

  // ================= DOM: videollamada (plática) / título y manual (curso) =================
  const SU = 0.66;
  const ui = ctx.V ? div(ctx.ui, { left: "0", top: "0", width: "1920px", height: "1080px", transformOrigin: "0 0", transform: `translate(${(540 - 960 * SU).toFixed(1)}px, ${(1000 - 540 * SU).toFixed(1)}px) scale(${SU})` }) : ctx.ui;
  const uiPt = (x, y) => (ctx.V ? { x: 540 + (x - 960) * SU, y: 1000 + (y - 540) * SU } : { x, y });
  const V = div(ui, { left: "340px", top: "220px", width: "1240px", height: "740px", background: "#FFFFFF", borderRadius: "30px", boxShadow: "0 40px 90px rgba(10,26,47,.28)", overflow: "hidden", opacity: "0", transformOrigin: "50% 50%" });
  const barra = div(V, { left: "0", top: "0", width: "100%", height: "70px", background: "#F2F6F9", borderBottom: "2px solid #E1E9EF" });
  ["#FF8A80", "#FFD27A", "#C6F24E"].forEach((c, k) => div(barra, { left: `${28 + k * 30}px`, top: "26px", width: "16px", height: "16px", borderRadius: "50%", background: c }));
  div(barra, { left: "130px", top: "18px", fontFamily: "Inter", fontWeight: 700, fontSize: "26px", color: COLOR.navy, whiteSpace: "nowrap" }, platica ? "Plática gratuita y en vivo" : "Claude en tu Empresa");
  const enVivo = div(barra, { right: "26px", top: "14px", height: "42px", padding: "0 18px 0 46px", borderRadius: "999px", background: COLOR.lima, fontFamily: "Inter", fontWeight: 800, fontSize: "22px", lineHeight: "42px", color: COLOR.navy, letterSpacing: ".06em", opacity: platica ? "1" : "0" }, "EN VIVO");
  const punto = div(enVivo, { left: "18px", top: "13px", width: "16px", height: "16px", borderRadius: "50%", background: COLOR.navy });
  const pantalla = div(V, { left: "28px", top: "96px", width: "820px", height: "616px", borderRadius: "22px", background: COLOR.navy, overflow: "hidden" });
  const lateral = [0, 1, 2].map((k) => {
    const c = div(V, { left: "872px", top: `${96 + k * 210}px`, width: "340px", height: "194px", borderRadius: "20px", background: ["#E6F6FC", "#F3FBE2", "#FFF0E6"][k], overflow: "hidden", opacity: "0" });
    const a = avatar([COLOR.azul, COLOR.lima, COLOR.durazno][k], 110); Object.assign(a.style, { position: "absolute", left: "128px", top: "34px" }); c.appendChild(a);
    div(c, { left: "14px", bottom: "12px", padding: "4px 12px", borderRadius: "10px", background: "rgba(10,26,47,.82)", color: "#fff", fontFamily: "Inter", fontWeight: 700, fontSize: "19px" }, platica ? ["dueño", "directivo", "dueño"][k] : ["paso", "a", "paso"][k]);
    return c;
  });
  // en la pantalla compartida: la chispa (anfitrión), luego la multitud, luego las seis
  const chispaP = div(pantalla, { left: "335px", top: "200px", width: "150px", height: "150px", color: COLOR.durazno, filter: "drop-shadow(0 0 30px rgba(255,180,137,.6))" }, ctx.CHISPA_SVG);
  const multi = div(pantalla, { left: "0", top: "0", width: "820px", height: "616px", opacity: "0" });
  const rg = azar(7), globosD = [];
  for (let k = 0; k < 34; k++) {
    const g = div(multi, { left: `${40 + rg() * 690}px`, top: `${60 + rg() * 470}px`, padding: "8px 16px", borderRadius: "18px", background: ["#fff", COLOR.lima, COLOR.cieloClaro][k % 3], fontFamily: "Inter", fontWeight: 900, fontSize: `${22 + rg() * 18}px`, color: COLOR.navy, opacity: "0" }, ["IA", "¡IA!", "IA?"][k % 3]);
    globosD.push(g);
  }
  const barras = div(pantalla, { left: "60px", top: "80px", width: "700px", height: "460px", opacity: "0" });
  const barrasD = [];
  for (let k = 0; k < 20; k++) { const lit = [2, 6, 9, 12, 15, 18].includes(k); const b = div(barras, { left: `${k * 35}px`, bottom: "0", width: "24px", height: "60px", borderRadius: "8px", background: lit ? COLOR.lima : "#2A4A6E", transformOrigin: "50% 100%" }); barrasD.push({ b, lit }); }
  // curso: capítulos del manual
  const capitulos = [];
  if (!platica) {
    const temas = ["hablarle a la IA", "en qué punto está hoy", "cualquier herramienta", "tu información y tu correo"];
    temas.forEach((txt, k) => {
      const r = div(pantalla, { left: "60px", top: `${90 + k * 120}px`, width: "700px", height: "96px", borderRadius: "18px", background: "#13304F", opacity: "0" });
      div(r, { left: "24px", top: "24px", width: "48px", height: "48px", borderRadius: "50%", background: [COLOR.cieloClaro, COLOR.durazno, COLOR.lima, COLOR.azul][k], color: COLOR.navy, fontFamily: "Inter", fontWeight: 900, fontSize: "26px", lineHeight: "48px", textAlign: "center" }, String(k + 1));
      div(r, { left: "96px", top: "26px", fontFamily: "Inter", fontWeight: 700, fontSize: "34px", color: "#fff", whiteSpace: "nowrap" }, txt);
      const ok = div(r, { right: "26px", top: "24px", width: "48px", height: "48px", borderRadius: "50%", background: COLOR.lima, color: COLOR.navy, fontFamily: "Inter", fontWeight: 900, fontSize: "30px", lineHeight: "48px", textAlign: "center", opacity: "0" }, "✓");
      capitulos.push({ r, ok });
    });
  }
  // curso: escalera paso a paso en la pantalla
  const pasosD = [];
  if (!platica) for (let k = 0; k < 3; k++) pasosD.push(div(pantalla, { left: `${180 + k * 160}px`, top: `${400 - k * 110}px`, width: "160px", height: `${120 + k * 110}px`, borderRadius: "14px 14px 0 0", background: COLOR.lima, opacity: "0", transformOrigin: "50% 100%" }));
  const pildoraPaso = platica ? null : (() => { const a = avatar(COLOR.durazno, 90); Object.assign(a.style, { position: "absolute", left: "0", top: "0", opacity: "0" }); pantalla.appendChild(a); return a; })();

  // tiempos de la ventana
  const tV0 = desde + 0.15, tV1 = t.salir - 0.3;   // entra · se atraviesa (zoom) hacia la escalera
  tl.fromTo(V, { opacity: 0, scale: 0.2, y: 120, filter: "blur(10px)" }, { opacity: 1, scale: 1, y: 0, filter: "blur(0px)", duration: 0.6, ease: "power3.out", immediateRender: true }, tV0);
  tl.to(V, { scale: 5.5, opacity: 0, filter: "blur(14px)", duration: 0.45, ease: "power3.in" }, tV1);
  if (platica) {
    lateral.forEach((c, k) => tl.fromTo(c, { opacity: 0, y: 30, scale: 0.8 }, { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: "power3.out", immediateRender: true }, [ini(9, 10), ini(9, 11) + 0.1, ini(9, 12)][k]));
    tl.to(chispaP, { opacity: 0, scale: 0.6, duration: 0.25 }, ini(10, 0) + 0.2);
    tl.to(multi, { opacity: 1, duration: 0.01 }, ini(10, 1));
    globosD.forEach((g, k) => tl.fromTo(g, { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.22, ease: "power3.out", immediateRender: true }, ini(10, 1) + k * 0.035));
    tl.to(multi, { opacity: 0, duration: 0.2 }, ini(10, 8) - 0.05);
    tl.to(barras, { opacity: 1, duration: 0.2 }, ini(10, 8));
    barrasD.forEach(({ b, lit }, k) => tl.fromTo(b, { scaleY: 0.2 }, { scaleY: lit ? 7.4 : 1 + (k % 4) * 0.25, duration: lit ? 0.7 : 0.4, ease: "power3.out", immediateRender: true }, ini(10, 8) + 0.1 + (lit ? 0.6 : k * 0.02)));
  } else {
    tl.to(chispaP, { left: "60px", top: "40px", scale: 0.5, duration: 0.5, ease: "power3.inOut" }, ini(9, 7));
    pasosD.forEach((p, k) => tl.fromTo(p, { opacity: 0, scaleY: 0 }, { opacity: 1, scaleY: 1, duration: 0.35, ease: "power3.out", immediateRender: true }, [ini(9, 11), ini(9, 12), ini(9, 13)][k]));
    lateral.forEach((c, k) => tl.fromTo(c, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out", immediateRender: true }, [ini(9, 11), ini(9, 12), ini(9, 13)][k]));
    tl.to([...pasosD], { opacity: 0, duration: 0.25 }, ini(10, 0) - 0.15);
    tl.to(chispaP, { opacity: 0, duration: 0.2 }, ini(10, 0) - 0.15);
    capitulos.forEach((c, k) => { const tk = [ini(10, 2), ini(10, 7), ini(10, 14), ini(10, 24)][k]; tl.fromTo(c.r, { opacity: 0, x: -60 }, { opacity: 1, x: 0, duration: 0.35, ease: "power3.out", immediateRender: true }, tk); tl.fromTo(c.ok, { opacity: 0, scale: 2 }, { opacity: 1, scale: 1, duration: 0.25, ease: "power3.out", immediateRender: true }, tk + 0.45); });
  }
  if (platica) { tl.fromTo(punto, { opacity: 1 }, { opacity: 0.25, duration: 0.45, repeat: 15, yoyo: true, ease: "sine.inOut" }, tV0 + 0.4); }

  // ================= «todo en un mismo lugar»: una tarjeta con la chispa =================
  const lugar = div(ui, { left: "560px", top: "300px", width: "800px", height: "560px", background: "#FFFFFF", borderRadius: "34px", boxShadow: "0 40px 90px rgba(10,26,47,.25)", opacity: "0" });
  const chispaL = div(lugar, { left: "325px", top: "70px", width: "150px", height: "150px", color: COLOR.durazno, filter: "drop-shadow(0 0 26px rgba(255,180,137,.6))" }, ctx.CHISPA_SVG);
  const fichas = [["calendario", COLOR.cieloClaro], ["herramientas", COLOR.durazno], ["manual", COLOR.lima], ["decisiones", COLOR.azul]].map(([_, c], k) => {
    const f = div(lugar, { left: `${70 + k * 170}px`, top: "300px", width: "150px", height: "150px", borderRadius: "28px", background: c, opacity: "0", boxShadow: "inset 0 -8px 0 rgba(10,26,47,.12)" });
    const ic = ["▦", "■", "▤", "●"][k];
    div(f, { left: "0", top: "0", width: "150px", height: "150px", fontFamily: "Inter", fontWeight: 900, fontSize: "70px", color: COLOR.navy, textAlign: "center", lineHeight: "150px" }, ic);
    return f;
  });
  const metodoChip = div(lugar, { left: "250px", top: "478px", width: "300px", height: "54px", borderRadius: "999px", background: COLOR.lima, fontFamily: "Inter", fontWeight: 900, fontSize: "26px", letterSpacing: ".08em", color: COLOR.navy, textAlign: "center", lineHeight: "54px", opacity: "0" }, "UN MISMO MÉTODO");
  tl.fromTo(lugar, { opacity: 0, scale: 0.6, y: 60 }, { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: "power3.out", immediateRender: true }, t.todo - 0.05);
  fichas.forEach((f, k) => tl.fromTo(f, { opacity: 0, scale: 0.2, rotation: -20 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.35, ease: "power3.out", immediateRender: true }, t.todo + 0.55 + k * 0.17));
  tl.fromTo(chispaL, { rotation: 0, scale: 0.6 }, { rotation: 360, scale: 1, duration: 0.8, ease: "power3.out", immediateRender: true }, t.claude - 0.1);
  tl.fromTo(metodoChip, { opacity: 0, scaleX: 0.2 }, { opacity: 1, scaleX: 1, duration: 0.4, ease: "power3.out", immediateRender: true }, t.metodo - 0.05);
  tl.to(lugar, { opacity: 0, scale: 0.85, y: -80, filter: "blur(10px)", duration: 0.3, ease: "power2.in" }, t.para - 0.15);

  // ================= respaldo: la placa de logos (sin alterar los logos) =================
  const placa = div(ui, { left: "410px", top: "380px", width: "1100px", height: "280px", background: "#FFFFFF", borderRadius: "40px", boxShadow: "0 40px 90px rgba(10,26,47,.22)", opacity: "0" });
  const hV = 104, wV = (3839 / 1302) * hV, hT = 88, wT = (1110 / 252) * hT;
  const xL = (1100 - (wV + 90 + wT)) / 2;
  const imgV = div(placa, { left: `${xL}px`, top: `${(280 - hV) / 2}px`, width: `${wV}px`, height: `${hV}px` }, `<img src="./assets/marca/vadai-horizontal-recorte.png" width="${wV.toFixed(0)}" height="${hV}" style="display:block">`);
  div(placa, { left: `${xL + wV + 44}px`, top: "100px", width: "3px", height: "80px", background: "#DCE6EE" });
  const imgT = div(placa, { left: `${xL + wV + 90}px`, top: `${(280 - hT) / 2}px`, width: `${wT}px`, height: `${hT}px` }, `<img src="./assets/marca/totalcoach-recorte.png" width="${wT.toFixed(0)}" height="${hT}" style="display:block">`);
  tl.fromTo(placa, { opacity: 0, y: 80, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "power3.out", immediateRender: true }, t.lo + 0.05);
  tl.fromTo(imgV, { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.4, ease: "power3.out", immediateRender: true }, t.vadai - 0.05);
  tl.fromTo(imgT, { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: 0.4, ease: "power3.out", immediateRender: true }, ini(11, 4) - 0.05);
  tl.to(placa, { y: 370, scale: 0.55, duration: 0.6, ease: "power3.inOut" }, t.cientos - 0.25);
  tl.to(placa, { opacity: 0, duration: 0.3 }, t.porque - 0.3);
  const pinCientos = etiqueta(ui, "cientos de empresas mexicanas", { tam: 26 });

  // ================= CTA =================
  const cta = div(ui, { left: "0", top: "0", width: `${W}px`, height: `${H}px`, opacity: "0" });
  const boleto = div(cta, { left: "560px", top: "250px", width: "800px", height: "300px", background: "#FFFFFF", borderRadius: "30px", boxShadow: "0 36px 80px rgba(10,26,47,.25)", overflow: "hidden" });
  div(boleto, { left: "0", top: "0", width: "26px", height: "300px", background: COLOR.lima });
  div(boleto, { left: "70px", top: "52px", fontFamily: "Inter", fontWeight: 800, fontSize: "26px", letterSpacing: ".12em", color: COLOR.cieloHondo }, platica ? "PLÁTICA GRATUITA" : "CLAUDE EN TU EMPRESA");
  div(boleto, { left: "70px", top: "98px", fontFamily: "Inter", fontWeight: 900, fontSize: "76px", letterSpacing: "-0.03em", color: COLOR.navy, whiteSpace: "nowrap" }, platica ? "TU LUGAR" : "TU EQUIPO");
  div(boleto, { left: "70px", top: "196px", fontFamily: "Instrument Serif", fontStyle: "italic", fontSize: "48px", color: COLOR.cieloHondo, whiteSpace: "nowrap" }, platica ? "y en vivo" : "paso a paso");
  const sello = div(boleto, { right: "60px", top: "70px", width: "160px", height: "160px", borderRadius: "50%", border: `8px solid ${COLOR.lima}`, color: COLOR.navy, fontFamily: "Inter", fontWeight: 900, fontSize: "70px", lineHeight: "144px", textAlign: "center", background: "#F5FCE2", opacity: "0" }, "✓");
  const boton = div(cta, { left: "560px", top: "610px", width: "800px", height: "150px", borderRadius: "999px", background: COLOR.lima, fontFamily: "Inter", fontWeight: 900, fontSize: "60px", letterSpacing: "-0.01em", color: COLOR.navy, textAlign: "center", lineHeight: "150px", boxShadow: "0 18px 0 #8FB52A, 0 30px 60px rgba(10,26,47,.25)", whiteSpace: "nowrap" }, platica ? "APARTA TU LUGAR" : "INSCRIBE A TU EQUIPO");
  const flecha = div(cta, { left: "925px", top: "800px", width: "70px", height: "90px" }, `<svg viewBox="0 0 70 90" width="70" height="90"><path d="M35 6 V70 M10 48 L35 76 L60 48" fill="none" stroke="${COLOR.navy}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
  tl.fromTo(cta, { opacity: 0 }, { opacity: 1, duration: 0.01, immediateRender: true }, t.dale - 0.05);
  tl.fromTo(boleto, { opacity: 0, y: -60, rotation: -4 }, { opacity: 1, y: 0, rotation: 0, duration: 0.5, ease: "power3.out", immediateRender: true }, t.dale - 0.05);
  tl.fromTo(boton, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.42, ease: "power3.out", immediateRender: true }, t.clic - 0.05);
  tl.fromTo(flecha, { opacity: 0, y: -30 }, { opacity: 1, y: 0, duration: 0.3, ease: "power3.out", immediateRender: true }, t.aqui - 0.05);
  tl.to(flecha, { y: 22, duration: 0.32, ease: "sine.inOut", repeat: 5, yoyo: true }, t.aqui + 0.3);
  // el clic: el botón se hunde, el boleto recibe su sello
  tl.to(boton, { y: 14, boxShadow: "0 4px 0 #8FB52A, 0 14px 30px rgba(10,26,47,.25)", duration: 0.08, ease: "power2.in" }, t.cta - 0.02);
  tl.to(boton, { y: 0, boxShadow: "0 18px 0 #8FB52A, 0 30px 60px rgba(10,26,47,.25)", duration: 0.2, ease: "power3.out" }, t.cta + 0.08);
  tl.fromTo(sello, { opacity: 0, scale: 2.4, rotation: -30 }, { opacity: 1, scale: 1, rotation: -8, duration: 0.24, ease: "power4.in", immediateRender: true }, t.cta + 0.1);
  tl.to(cta, { opacity: 0, duration: 0.01 }, platica ? t.loCaro - 0.06 : t.f15 - 0.1);   // en la plática, GRATIS la tapa y al salir sigue ahí
  // curso: la primera semana (el calendario del bucle, ahora con palomita)
  const semana = div(ui, { left: "760px", top: "300px", width: "400px", height: "440px", background: "#FFFFFF", borderRadius: "30px", boxShadow: "0 36px 80px rgba(10,26,47,.25)", overflow: "hidden", opacity: "0" });
  div(semana, { left: "0", top: "0", width: "400px", height: "90px", background: COLOR.cieloHondo });
  div(semana, { left: "0", top: "120px", width: "400px", textAlign: "center", fontFamily: "Inter", fontWeight: 700, fontSize: "40px", color: COLOR.gris }, "SEMANA");
  div(semana, { left: "0", top: "170px", width: "400px", textAlign: "center", fontFamily: "Inter", fontWeight: 900, fontSize: "200px", color: COLOR.navy, lineHeight: "220px" }, "1");
  const okS = div(semana, { left: "250px", top: "250px", width: "130px", height: "130px", borderRadius: "50%", background: COLOR.lima, color: COLOR.navy, fontFamily: "Inter", fontWeight: 900, fontSize: "80px", lineHeight: "130px", textAlign: "center", opacity: "0" }, "✓");
  if (!platica) {
    tl.fromTo(semana, { opacity: 0, rotationX: -80, y: -80 }, { opacity: 1, rotationX: 0, y: 0, duration: 0.5, ease: "power3.out", immediateRender: true }, t.f15);
    tl.fromTo(okS, { opacity: 0, scale: 2.5, rotation: -40 }, { opacity: 1, scale: 1, rotation: -10, duration: 0.25, ease: "power4.in", immediateRender: true }, ini(15, 6) + 0.05);
    tl.to(semana, { opacity: 0, duration: 0.01 }, t.loCaro - 0.08);
  }

  // ================= tarjeta final =================
  const tf = div(ctx.ui, { left: "0", top: "0", width: `${W}px`, height: `${H}px`, opacity: "0", background: "linear-gradient(135deg, #4FC6EE 0%, #00A0DB 48%, #006E96 100%)", overflow: "hidden" });
  const yF = (h, v) => (ctx.V ? v : h);
  const rayosF = div(tf, { left: `${W / 2 - 1400}px`, top: `${yF(300, 700) - 1400}px`, width: "2800px", height: "2800px" }, `<svg viewBox="-1400 -1400 2800 2800" width="2800" height="2800">${Array.from({ length: 24 }, (_, k) => { const a = (k / 24) * Math.PI * 2; return `<path d="M${(Math.cos(a) * 160).toFixed(1)},${(Math.sin(a) * 160).toFixed(1)} L${(Math.cos(a) * 1400).toFixed(1)},${(Math.sin(a) * 1400).toFixed(1)}" stroke="#fff" stroke-opacity=".14" stroke-width="${k % 2 ? 2 : 6}" stroke-linecap="round"/>`; }).join("")}</svg>`);
  const chispaF = div(tf, { left: `${W / 2 - 60}px`, top: `${yF(70, 330)}px`, width: "120px", height: "120px", color: COLOR.durazno, filter: "drop-shadow(0 0 30px rgba(255,180,137,.8))" }, ctx.CHISPA_SVG);
  const tituloF = div(tf, { left: "0", top: `${yF(230, 500)}px`, width: `${W}px`, textAlign: "center", fontFamily: "Inter", fontWeight: 900, fontSize: `${yF(130, 112)}px`, letterSpacing: "-0.04em", lineHeight: 0.98, color: COLOR.navy }, platica ? (ctx.V ? "PLÁTICA<br>GRATUITA<br>Y EN VIVO" : "PLÁTICA GRATUITA<br>Y EN VIVO") : (ctx.V ? "CLAUDE<br>EN TU<br>EMPRESA" : "CLAUDE<br>EN TU EMPRESA"));
  const ctaF = div(tf, { left: `${W / 2 - 380}px`, top: `${yF(560, 900)}px`, width: "760px", height: "130px", borderRadius: "999px", background: COLOR.lima, textAlign: "center", lineHeight: "130px", fontFamily: "Inter", fontWeight: 900, fontSize: "56px", color: COLOR.navy, boxShadow: "0 16px 0 #8FB52A", whiteSpace: "nowrap" }, platica ? "APARTA TU LUGAR" : "INSCRIBE A TU EQUIPO");
  const placaF = div(tf, { left: `${W / 2 - 360}px`, top: `${yF(800, 1120)}px`, width: "720px", height: "130px", borderRadius: "999px", background: "#FFFFFF" });
  const k2 = 0.62, xl2 = (720 - (wV + 90 + wT) * k2) / 2;
  div(placaF, { left: `${xl2}px`, top: `${(130 - hV * k2) / 2}px` }, `<img src="./assets/marca/vadai-horizontal-recorte.png" width="${(wV * k2).toFixed(0)}" height="${(hV * k2).toFixed(0)}" style="display:block">`);
  div(placaF, { left: `${xl2 + (wV + 45) * k2}px`, top: "40px", width: "2px", height: "50px", background: "#DCE6EE" });
  div(placaF, { left: `${xl2 + (wV + 90) * k2}px`, top: `${(130 - hT * k2) / 2}px` }, `<img src="./assets/marca/totalcoach-recorte.png" width="${(wT * k2).toFixed(0)}" height="${(hT * k2).toFixed(0)}" style="display:block">`);
  const avs = [COLOR.durazno, COLOR.azul, COLOR.lima, COLOR.cieloClaro].map((c, k) => { const a = avatar(c, 120); Object.assign(a.style, { position: "absolute", left: `${ctx.V ? [250, 400, 590, 740][k] : [150, 270, 1570, 1690][k]}px`, top: `${yF(800, 1300)}px` }); tf.appendChild(a); return a; });
  tl.fromTo(tf, { opacity: 0, clipPath: "circle(0% at 50% 50%)" }, { opacity: 1, clipPath: "circle(75% at 50% 50%)", duration: 0.55, ease: "power3.inOut", immediateRender: true }, t.tarjeta - 0.25);
  tl.fromTo(tituloF, { opacity: 0, y: 40, filter: "blur(10px)", letterSpacing: "0.04em" }, { opacity: 1, y: 0, filter: "blur(0px)", letterSpacing: "-0.04em", duration: 0.6, ease: "power3.out", immediateRender: true }, t.tarjeta + 0.05);
  tl.fromTo(ctaF, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.45, ease: "power3.out", immediateRender: true }, t.tarjeta + 0.35);
  tl.fromTo(placaF, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", immediateRender: true }, t.tarjeta + 0.55);
  avs.forEach((a, k) => { tl.fromTo(a, { opacity: 0, y: 200 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", immediateRender: true }, t.tarjeta + 0.6 + k * 0.08); tl.to(a, { y: -26, duration: 0.3, ease: "sine.inOut", repeat: 5, yoyo: true }, t.tarjeta + 1.2 + k * 0.12); });

  // ================= 3D propio del cierre =================
  // la plataforma lima del equipo (el escalón que se vuelve rayo, como las seis)
  const plat = new THREE.Mesh(O.geoEscalon(1, 1), brillo(COLOR.lima, { rugosidad: 0.3, emisivo: COLOR.lima }));
  plat.castShadow = true; plat.receiveShadow = true; esc0.add(plat);
  // el libro que se escribe solo
  const libro = new THREE.Group(); esc0.add(libro);
  const tapa = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 1.75), brillo(COLOR.cieloHondo, { rugosidad: 0.4 })); tapa.castShadow = true; libro.add(tapa);
  const lienzos = [0, 1].map(() => { const c = document.createElement("canvas"); c.width = 640; c.height = 860; return c; });
  const txs = lienzos.map((c) => { const x = new THREE.CanvasTexture(c); x.colorSpace = THREE.SRGBColorSpace; x.anisotropy = 8; return x; });
  const paginas = txs.map((tx, k) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.22, 1.64), new THREE.MeshPhysicalMaterial({ map: tx, roughness: 0.8 })); p.rotation.x = -Math.PI / 2; p.position.set(k ? 0.64 : -0.64, 0.05, 0); p.receiveShadow = true; libro.add(p); return p; });
  const rLib = azar(2024);
  const trazos = [0, 1].map(() => Array.from({ length: 11 }, (_, k) => ({ y: 120 + k * 64, l: 0.45 + rLib() * 0.5, ok: rLib() > 0.6 })));
  function escribir(tt) {
    const u = tramo(tt, t.nosotros + 0.25, t.f13fin + 0.6);
    lienzos.forEach((c, k) => {
      const g = c.getContext("2d");
      g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, 640, 860);
      g.strokeStyle = "#E6EEF4"; g.lineWidth = 3;
      for (let y = 120; y < 820; y += 64) { g.beginPath(); g.moveTo(50, y + 18); g.lineTo(590, y + 18); g.stroke(); }
      const tr = trazos[k];
      tr.forEach((r, i) => {
        const ui0 = (k * tr.length + i) / (tr.length * 2), ui1 = ui0 + 1 / (tr.length * 2);
        const p = clamp01((u - ui0) / (ui1 - ui0));
        if (p <= 0) return;
        g.strokeStyle = COLOR.navy; g.lineWidth = 9; g.lineCap = "round"; g.beginPath();
        const x0 = 70, x1 = 70 + 500 * r.l * p;
        for (let x = x0; x <= x1; x += 6) { const yy = r.y + 6 * Math.sin(x * 0.09 + i) ; if (x === x0) g.moveTo(x, yy); else g.lineTo(x, yy); }
        g.stroke();
        if (r.ok && p >= 1) { g.strokeStyle = "#7DB800"; g.lineWidth = 11; g.beginPath(); g.moveTo(560, r.y - 2); g.lineTo(574, r.y + 12); g.lineTo(600, r.y - 18); g.stroke(); }
      });
      // en la página derecha, un diagrama: tres cajas que se conectan (el método)
      if (k === 1 && u > 0.55) {
        const q = clamp01((u - 0.55) / 0.35);
        g.fillStyle = "#C6F24E"; g.strokeStyle = COLOR.navy; g.lineWidth = 6;
        [[120, 640], [320, 560], [500, 660]].forEach(([x, y], j) => { if (q > j * 0.3) { rrect(g, x - 50, y - 36, 100, 72, 16); g.fill(); g.stroke(); } });
        if (q > 0.7) { g.beginPath(); g.moveTo(170, 630); g.lineTo(270, 580); g.moveTo(370, 580); g.lineTo(450, 640); g.stroke(); }
      }
    });
    txs.forEach((x) => (x.needsUpdate = true));
  }
  // la taza (su escritorio, ya vacío) y su vapor
  const taza = O.taza(COLOR.durazno); esc0.add(taza.g);
  const vapor = [0, 1, 2].map(() => { const s = O.letra("~", { tam: 0.5, color: "#9FB3C2", fuente: '900 200px "Inter"' }); s.material.opacity = 0.7; esc0.add(s); return s; });
  const palomitas = md.canicas.map(() => { const s = O.letra("✓", { tam: 0.45, color: "#5E8F00", fuente: '900 190px "Inter"' }); esc0.add(s); return s; });

  // ================= fondo por tramo =================
  ctx.paleta.push(
    { t: desde, base: "#F1F8FC", a: "#C3EAF9", b: "#E3F7B9", c: "#D4E5EE", cruce: 0.4 },
    { t: t.salir - 0.2, base: "#F2FAE8", a: "#DCF5A8", b: "#BFE8F8", c: "#D3E4EE" },
    { t: t.para - 0.1, base: "#FBF7F2", a: "#FFDCC6", b: "#CDEBF7", c: "#DDE7EE" },
    { t: t.lo, base: "#F1F8FC", a: "#BFE8F8", b: "#D6F2B0", c: "#D1E3EE" },
    { t: t.porque - 0.1, base: "#F4F8FB", a: "#BFEAFB", b: "#FFD7C0", c: "#CFE1EE" },
    { t: t.dale - 0.1, base: "#F3FAE6", a: "#D8F59E", b: "#B9E7F8", c: "#D2E4EE" },
    { t: t.loCaro - 0.05, base: "#0C2137", a: "#5A1A20", b: "#0A1A2F", c: "#06111F", reticula: 0.1, cruce: 0.12 },
  );
  ctx.marquesinas.push(
    { t0: desde, t1: t.salir - 0.3, texto: platica ? "EN VIVO · EN VIVO ·" : "PASO A PASO · PASO A PASO ·", color: COLOR.cieloHondo, op: 0.08, y: 590, tam: 280, vel: 70 },
    { t0: t.todo - 0.1, t1: t.para, texto: "UN MISMO LUGAR · UN MISMO MÉTODO ·", color: COLOR.limaTinta, op: 0.07, y: 590, tam: 220, vel: 90 },
    { t0: t.porque - 0.1, t1: t.nosotros, texto: "IA ✦ IA ✦ IA ✦", color: COLOR.cieloHondo, op: 0.1, y: 560, tam: 320, vel: 140 },
    { t0: t.loCaro, t1: t.tarjeta, texto: "A MANO · A MANO · A MANO ·", color: "#FF8A80", op: 0.08, y: 600, tam: 280, vel: 110 },
  );

  // ================= cursor: vuelve para el CTA; en «a mano» es la manita =================
  ctx.cursorClaves.push(
    { t: t.dale - 0.25, p: () => uiPt(1500, 980), oculto: true },
    { t: t.clic + 0.05, p: () => uiPt(1210, 700), viaje: 0.4, forma: "mano" },
    { t: t.aqui + 0.1, p: () => uiPt(1060, 820), viaje: 0.3, forma: "mano" },
    { t: t.cta - 0.06, p: () => uiPt(990, 680), viaje: 0.3, forma: "mano" },
    { t: t.cta, p: () => uiPt(990, 680), clic: true, forma: "mano" },
    { t: t.f15 - 0.2, p: () => uiPt(1100, 760), forma: "mano" },
    { t: t.f15 - 0.1, p: () => uiPt(1100, 760), oculto: true, forma: "mano" },
    // «a mano»: la manita golpea el escritorio una y otra vez
    { t: t.loCaro - 0.1, p: () => manoEsc(0), oculto: true, forma: "mano" },
    { t: t.caro, p: () => manoEsc(0), forma: "mano", viaje: 0.2 },
    ...[0, 1, 2, 3, 4].map((k) => ({ t: t.caro + 0.35 + k * 0.4, p: () => manoEsc(k + 1), forma: "mano", clic: true, viaje: 0.18 })),
    { t: t.tarjeta - 0.3, p: () => manoEsc(6), forma: "mano", oculto: true },
  );
  const manoEsc = (k) => { const q = m.proyectar(V3(md.DK.x, md.FY + md.deskAlto + 0.2, md.DK.z)); return { x: q.x + [0, -60, 50, -30, 70, -10, 0][k], y: q.y - 30 + (k % 2) * 16 }; };

  // ================= cámara =================
  const RD = V3(Math.cos(ISO.az), 0, -Math.sin(ISO.az));
  const esc = ap.esc, P1 = ap.P1;
  const iso = (p, alto, dy = 0) => [p.x, p.y + dy, p.z, ISO.az, ISO.el, alto];
  const focoL = V3(P1.x, P1.y, P1.z);
  const deskV = V3(md.DK.x, md.FY + 1.2, md.DK.z);
  const XCv = ap.XC.clone();
  const cam = pista([
    { t: desde, v: [md.PB.x + 1.0, md.FY + 2.5, md.PB.z + 0.4, ISO.az, ISO.el, 10.0] },
    { t: t.salir - 0.1, v: [md.PB.x + 1.0, md.FY + 2.7, md.PB.z + 0.4, ISO.az, ISO.el, 9.0], e: "power1.inOut" },
    { t: t.salir - 0.09, v: iso(focoL, 6.4, 0.5) },
    { t: t.bucleF, v: iso(focoL, 6.0, 1.4), e: "power2.inOut" },
    { t: t.todo, v: iso(focoL, 6.6, 6.0), e: "power2.in" },
    { t: t.para - 0.12, v: iso(focoL, 7.0, 14.0), e: "power1.inOut" },
    { t: t.para - 0.11, v: iso(deskV.clone().addScaledVector(RD, 1.2).add(V3(0, 1.6, 0)), 8.6) },
    { t: t.lo - 0.1, v: iso(deskV.clone().addScaledVector(RD, 1.0).add(V3(0, 1.4, 0)), 8.0), e: "power1.inOut" },
    { t: t.cientos - 0.3, v: iso(deskV.clone().add(V3(0, 1.4, 0)), 7.6), e: "power1.inOut" },
    { t: t.cientos + 0.3, v: [0, 15, 0, ISO.az, ISO.el, 90], e: "power3.inOut" },
    { t: t.porque - 0.11, v: [0, 15, 0, ISO.az, ISO.el, 80], e: "power1.inOut" },
    { t: t.porque - 0.1, v: [XCv.x, 0, XCv.z, ISO.az, 0.9, 14] },
    { t: t.artificial + 0.2, v: [XCv.x - 1.1, 0, XCv.z - 1.1, ISO.az, 1.5, 28], e: "power2.inOut" },
    { t: t.nosotros + 0.1, v: [XCv.x - 1.1, 0, XCv.z - 1.1, ISO.az, 1.5, 29], e: "power1.inOut" },
    { t: t.que13 + 0.1, v: [XCv.x, 0.4, XCv.z, ISO.az, 1.05, 4.6], e: "power3.inOut" },
    { t: t.dale, v: [XCv.x, 0.4, XCv.z, ISO.az, 1.05, 4.3], e: "power1.inOut" },
    { t: t.loCaro - 0.06, v: [XCv.x, 0.4, XCv.z, ISO.az, 1.05, 4.0], e: "power1.inOut" },
    { t: t.loCaro - 0.05, v: iso(deskV.clone().add(V3(0, 0.6, 0)), 6.2) },
    { t: t.tarjeta, v: iso(deskV.clone().add(V3(0, 0.6, 0)), 5.4), e: "power1.inOut" },
    { t: DUR, v: iso(deskV.clone().add(V3(0, 0.6, 0)), 5.2) },
  ]);
  ctx.particulas = ((prev) => (tt) => (tt >= desde ? (tt > t.loCaro - 0.1 && tt < t.tarjeta ? 0.4 : 1) : prev ? prev(tt) : 1))(ctx.particulas);
  const gl = document.getElementById("gl");

  // ================= por cuadro =================
  const [A, B, Cc, D] = ap.equipo;
  const DT = t.todo12 - ap.t.todo;        // la multitud vuelve con el tiempo corrido
  function pintar(tt) {
    const v = cam(tt);
    // al subir la plataforma, la cámara sube con ella (queda detrás de la tarjeta «un mismo lugar»)
    if (tt >= t.bucleF && tt < t.para - 0.11) { const sube = suave(tramo(tt, t.bucle, t.todo + 0.8)); v[1] = P1.y + sube * 13 + 0.6 + (1 - sube) * 0.8; }
    m.ponerCamara({ x: v[0], y: v[1], z: v[2], az: v[3], el: v[4], alto: v[5] });
    const rojo = tt > t.loCaro - 0.05 && tt < t.tarjeta;
    m.luz(rojo ? 0.45 : 1);
    // desenfoque de foco detrás de las tarjetas (videollamada, lugar, CTA)
    const blurV = (tt > desde && tt < t.salir - 0.3) ? 6 * sale3(tramo(tt, desde, desde + 0.6)) : 0;
    const blurC = tt > t.dale - 0.1 && tt < t.loCaro - 0.06 ? 7 * sale3(tramo(tt, t.dale - 0.1, t.dale + 0.4)) : 0;
    const blurL = tt > t.todo && tt < t.para - 0.12 ? 5 * sale3(tramo(tt, t.todo, t.todo + 0.4)) : 0;
    const bl = Math.max(blurV, blurC, blurL);
    gl.style.filter = bl > 0.05 ? `blur(${bl.toFixed(2)}px)` : "none";

    // ---- 14–15: detrás de la ventana sigue la escena del método (red y equipo en el piso) ----
    if (tt < t.salir - 0.09) {
      ap.empresa.poner({ x: md.PB.x, y: md.FY, z: md.PB.z, rumbo: ISO.az, visible: true, escala: 1, sx: 1, sy: 1, luces: 0.6 });
      [A, B, Cc, D].forEach((p, k) => { const c = md.cuelga[k]; p.poner({ x: c.x, y: md.FY + Math.abs(Math.sin(tt * 3 + k)) * 0.15, z: c.z, rumbo: ISO.az + (k - 1.5) * 0.25, visible: true, escala: 1, ladea: 0, inclina: 0, parpado: 0.5, mirar: [0, 0.3], sudor: 0, sy: 1, sx: 1 }); });
      md.pisoO.visible = true;
    }
    // ---- 16: salir del bucle — el escalón del equipo se vuelve lima y sube ----
    const enLazo = tt >= t.salir - 0.09 && tt < t.para - 0.11;
    if (enLazo) {
      esc.g.visible = true;
      esc.pasos.forEach((p, i) => { p.visible = true; p.scale.set(1, 1, 1); p.position.y = esc.P[i + 1].y - esc.D / 2; });
      const sube = suave(tramo(tt, t.bucle, t.todo + 0.8));
      const y0 = P1.y + sube * 13;
      plat.visible = true;
      const lima = sale3(tramo(tt, t.salir - 0.1, t.salir + 0.2));
      plat.scale.set(1.02, 0.4 + lima * 0.2, 1.02);
      plat.position.set(P1.x, y0 - 0.3 * (0.4 + lima * 0.2) + 0.02, P1.z);
      plat.material.emissiveIntensity = 0.25 + 0.5 * lima;
      esc.pasos[0].visible = sube < 0.02;
      [A, B, Cc, D].forEach((p, k) => {
        const off = [V3(-0.28, 0, -0.25), V3(0.25, 0, -0.25), V3(-0.25, 0, 0.25), V3(0.27, 0, 0.27)][k];
        const salto = tramo(tt, t.salir + k * 0.06, t.salir + 0.4 + k * 0.06);
        const enP = salto >= 1;
        const desdeP = esc.cima([20, 19, 2, 3][k]);
        const aP = V3(P1.x + off.x, y0 + 0.12 * (0.4 + lima * 0.2) * 0 + 0.1, P1.z + off.z);
        const pos = enP ? aP : desdeP.clone().lerp(aP, suave(salto));
        if (!enP) pos.y += Math.sin(Math.PI * salto) * 0.8;
        p.poner({ x: pos.x, y: pos.y, z: pos.z, rumbo: ISO.az, visible: true, escala: 1, ladea: 0, inclina: 0, parpado: enP ? 0.55 : 0, mirar: [0, 0.6], sudor: 0, sy: enP ? aterriza(tt, t.salir + 0.4 + k * 0.06, 0.25) : 1, sx: 1 });
      });
    } else plat.visible = false;
    // ---- 17: todo en un mismo lugar — lo de la historia vuela hacia la tarjeta ----
    const enLugar = tt > t.todo - 0.1 && tt < t.para - 0.11;
    if (enLugar) {
      const cam3 = m.camara; const R = V3().setFromMatrixColumn(cam3.matrixWorld, 0), U = V3().setFromMatrixColumn(cam3.matrixWorld, 1);
      const al = m.vista.altoReal || m.vista.alto, an = al * (m.ancho / m.alto);
      const centro = V3(m.vista.x, m.vista.y, m.vista.z);
      const objs = [ap.cal.g, ap.cajas[0].g, ap.cajas[1].g, ap.cajas[2].g, ap.man.g];
      const desdeS = [[-0.62, 0.3], [0.62, 0.28], [-0.58, -0.32], [0.6, -0.3], [0, -0.55]];
      objs.forEach((o, k) => {
        const u = suave(tramo(tt, t.todo + 0.1 + k * 0.17, t.todo + 0.6 + k * 0.17));
        const sx = desdeS[k][0] * (1 - u), sy = desdeS[k][1] * (1 - u);
        o.visible = u < 0.98;
        o.position.copy(centro).addScaledVector(R, sx * an).addScaledVector(U, sy * al).add(V3(0, 0, 0));
        o.scale.setScalar((k === 4 ? 2.4 : k === 0 ? 2.2 : 2.6) * (1 - 0.7 * u));
        o.rotation.set(0.3 * (1 - u), ISO.az + tt * 1.5 * (1 - u), 0);
      });
      ap.man.poner({ abre: 0, escala: 1, visible: true, x: ap.man.g.position.x, y: ap.man.g.position.y, z: ap.man.g.position.z, inclina: 1.1, rumbo: ISO.az });
      ap.man.g.visible = suave(tramo(tt, t.todo + 0.78, t.todo + 1.28)) < 0.98;
    }
    // ---- 18: tu equipo resuelve: el tobogán, otra vez; ahora atrapan las decisiones ----
    const enEsc = (tt >= t.para - 0.11 && tt < t.cientos + 0.05) || rojo;
    if (enEsc) {
      md.escritorio.visible = md.pisoO.visible = md.rieles.visible = true;
      const tR0 = t.para + 0.1;
      const atrapa = md.ruta[2].clone().lerp(md.ruta[3], 0.5);
      [A, B, Cc, D].forEach((p, k) => {
        const q = [md.ruta[1].clone().lerp(md.ruta[2], 0.5), atrapa, md.ruta[3].clone().lerp(md.ruta[4], 0.4), md.ruta[2].clone().lerp(md.ruta[3], 0.15)][k].clone().add(V3(0, -0.24, 0)).addScaledVector(V3(1, 0, 1).normalize(), 0.62);
        p.poner({ x: q.x, y: q.y + Math.abs(Math.sin(tt * 4 + k)) * 0.18, z: q.z, rumbo: ISO.az - 0.6, visible: !rojo, escala: 1, ladea: 0, inclina: 0, parpado: 0.5, mirar: [-0.6, 0.2], sudor: 0, sy: 1, sx: 1 });
      });
      md.canicas.forEach((c, i) => {
        // plática/curso: ruedan y el equipo las atrapa (palomita); en «lo caro» llueven otra vez al escritorio
        const tR = rojo ? t.loCaro + i * 0.13 : tR0 + i * 0.14;
        const s = Math.max(0, 2.4 * (tt - tR) + 5.5 * Math.pow(Math.max(0, tt - tR), 2));
        const total = md.ruta.slice(1).reduce((a, p, j) => a + p.distanceTo(md.ruta[j]), 0);
        const corte = rojo ? total : total * [0.28, 0.55, 0.85, 0.42][i % 4];
        const vis = tt > tR;
        c.g.visible = c.q.visible = vis && (rojo || s < corte);
        const pk = palomitas[i];
        pk.visible = !rojo && vis && s >= corte && tt < t.cientos;
        let pos;
        if (rojo) { const ul = tramo(tt, tR, tR + 0.42); pos = c.pila.clone().add(V3(0, (1 - ul * ul) * 7, 0)); if (ul >= 1) pos.y += Math.abs(Math.sin((tt - tR - 0.42) * 9)) * 0.08 * Math.exp(-(tt - tR - 0.42) * 4); c.g.visible = c.q.visible = tt > tR; }
        else { let r = Math.min(s, corte), j = 1; for (; j < md.ruta.length; j++) { const l = md.ruta[j].distanceTo(md.ruta[j - 1]); if (r <= l) break; r -= l; } j = Math.min(j, md.ruta.length - 1); pos = md.ruta[j - 1].clone().lerp(md.ruta[j], r / md.ruta[j].distanceTo(md.ruta[j - 1])); }
        c.g.position.copy(pos); c.q.position.copy(pos).add(V3(0, 0.36, 0));
        if (pk.visible) { const u = tramo(tt, tR + 0.2, tR + 0.6); pk.position.copy(pos).add(V3(0, 0.5 + u * 0.6, 0)); pk.material.opacity = 1 - u * 0.3; pk.scale.setScalar(0.45 * sale3(clamp01(u * 3))); }
      });
      // la taza: el escritorio vacío (en «lo caro», la taza no está: está lleno de canicas)
      taza.g.visible = !rojo;
      const qT = V3(md.DK.x, md.FY + md.deskAlto + 0.1, md.DK.z).addScaledVector(RD, -0.7);
      taza.g.position.copy(qT); taza.g.rotation.y = ISO.az + 0.5; taza.g.scale.setScalar(1.1);
      vapor.forEach((s, k) => { const u = (((tt * 0.8 + k / 3) % 1) + 1) % 1; s.visible = !rojo; s.position.copy(qT).add(V3(0.05 * Math.sin(u * 6 + k), 0.8 + u * 0.9, 0)); s.material.opacity = 0.6 * Math.sin(Math.PI * u); s.scale.setScalar(0.35 + u * 0.25); });
      // «lo caro»: la manita, el equipo de nuevo a mano
    }
    // ---- 19: las 100 escaleras se encienden en ola ----
    const enGrid = tt >= t.cientos - 0.3 && tt < t.porque - 0.1;
    if (enGrid) {
      esc.g.visible = true;
      esc.pasos.forEach((p, i) => { p.visible = true; p.scale.set(1, 1, 1); p.position.y = esc.P[i + 1].y - esc.D / 2; });
      ap.inst.visible = ap.instP.visible = true;
      const col = new THREE.Color(), mtx = new THREE.Matrix4();
      ap.cel.forEach((c, ci) => {
        const ola = t.cientos + 0.1 + (c.i + c.j + 10) * 0.07;
        const u = tramo(tt, ola, ola + 0.3);
        for (let k = 1; k <= esc.N; k++) {
          const uu = 0.5 - 0.5 * Math.cos((2 * Math.PI * k) / esc.N);
          col.copy(ap.colBase[0]).lerp(ap.colBase[1], uu).lerp(ap.colLima, u);
          ap.inst.setColorAt(ci * esc.N + k - 1, col);
          const p = esc.P[k]; mtx.makeTranslation(p.x + c.i * ap.S, p.y - esc.D / 2, p.z + c.j * ap.S); ap.inst.setMatrixAt(ci * esc.N + k - 1, mtx);
        }
        for (let k = 0; k < 3; k++) {
          const e = O.saltar(esc, (tt - 9) * 2.3 + c.i * 3.1 + c.j * 1.7 - k, { alto: 0.3 });
          const top = esc.P[esc.N];
          const ur = tramo(tt, ola + 0.2 + k * 0.1, ola + 2.2 + k * 0.1);
          const x = u > 0.5 ? top.x + c.i * ap.S : e.x + c.i * ap.S, z = u > 0.5 ? top.z + c.j * ap.S : e.z + c.j * ap.S, y = u > 0.5 ? top.y + 0.2 + ur * ur * 40 : e.y;
          mtx.makeTranslation(x, y + 0.51, z); ap.instP.setMatrixAt(ci * 3 + k, mtx);
        }
      });
      ap.inst.instanceColor.needsUpdate = true; ap.inst.instanceMatrix.needsUpdate = true; ap.instP.instanceMatrix.needsUpdate = true;
      // la nuestra también
      esc.pasos.forEach((p) => { p.material.emissive = p.material.emissive || new THREE.Color(); });
      ap.rayos.forEach((r) => (r.g.visible = false));
      const q = m.proyectar(V3(esc.P[esc.N].x, esc.P[esc.N].y + 1, esc.P[esc.N].z));
      const up = tramo(tt, t.cientos + 0.4, t.cientos + 0.7) * (1 - tramo(tt, t.porque - 0.4, t.porque - 0.15));
      pinCientos.style.opacity = String(up); pinCientos.style.transform = `translate(${(q.x - 230).toFixed(1)}px, ${(q.y - 120).toFixed(1)}px)`;
    } else pinCientos.style.opacity = "0";
    // ---- 20: vuelve la multitud ----
    const enMult = tt >= t.porque - 0.1 && tt < t.loCaro - 0.05;
    if (enMult) {
      ap.multitud(tt - DT);
      ap.empresa.poner({ x: ap.BE.x, y: 0, z: ap.BE.z, rumbo: 0.42, visible: true, escala: 0.82, sx: 1, sy: 1, luces: 0.5 });
      // ---- 21: el manual por fin se escribe solo ----
      const ul = tramo(tt, t.nosotros - 0.1, t.nosotros + 0.35);
      libro.visible = ul > 0;
      const centroL = XCv.clone();
      libro.position.set(centroL.x, (1 - sale3(ul)) * 6 + 0.06, centroL.z);
      libro.rotation.set(0, ISO.az + 0.0, 0);
      libro.scale.setScalar(aterriza(tt, t.nosotros + 0.35, 0.2, 0.4));
      if (libro.visible) escribir(tt);
    } else libro.visible = false;
  }
  function siempre(tt) {
    if (tt >= desde) return;
    plat.visible = false; libro.visible = false; taza.g.visible = false;
    vapor.forEach((s) => (s.visible = false)); palomitas.forEach((s) => (s.visible = false));
    pinCientos.style.opacity = "0";
    gl.style.filter = "none";
  }
  return { pintar, siempre, t };
}
