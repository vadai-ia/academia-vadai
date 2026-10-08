// v2 · 3D · tarjeta final (DOM sobre el mundo): degradado héroe con soplos de nube, la flecha lima en
// «clic» (lo único lima del cuadro), una frase a la vez y el cierre con título, CTA, flecha y logos.
import { $, titular, entrar, salir, ventana, pop, CHISPA_SVG } from "../../estilo/ui.js";
import { airear } from "./texto.js";

export function montar(ctx) {
  const { tl, raiz, C, T, V } = ctx;
  const q = (h, v) => (V ? v : h);
  const platica = T.version === "platica";
  const w = (i, p, n) => T.w(i, p, n);
  const tLente = ctx.final.tLente;
  const c = $("div", "capa final-v2", raiz);
  ventana(tl, c, tLente, 999);
  $("div", "final-fondo", c);
  // la chispa que cruzó la lente se vuelve el destello que abre el degradado
  const destello = $("div", "destello", c);
  tl.fromTo(destello, { opacity: 1 }, { opacity: 0, duration: 0.5, ease: "power2.out" }, tLente);
  const frase = (lineas, anclas, fin, cls = "tit-final") => {
    const t = airear(titular(c, lineas, `tit ${cls}`));
    t.palabras.forEach((p, i) => entrar(tl, p, anclas[i], { escalon: 0, y: 100 }));
    if (fin != null) salir(tl, t.palabras, fin, { dy: -60, dur: 0.28 });
    return t;
  };
  // flecha lima: aparece en «clic» y late
  const fl = $("div", "flecha-v2", c);
  fl.innerHTML = `<svg viewBox="0 0 120 150" aria-hidden="true"><path d="M60 10v118M18 84l42 46 42-46" fill="none" stroke="#0A1A2F" stroke-width="30" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 6)"/><path d="M60 10v118M18 84l42 46 42-46" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  tl.fromTo(fl, { opacity: 0, scale: 0.3, y: -60 }, { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: "back.out(2.6)" }, C.clic);
  tl.to(fl, { y: 14, duration: 0.32, ease: "sine.inOut", yoyo: true, repeat: 15 }, C.clic + 0.5);
  const iD = platica ? 14 : 15;
  if (platica) {
    frase(["Aparta tu lugar"], [C.cta, w(14, "tu"), w(14, "lugar.")], w(15, "esto") - 0.25);
    frase(["Esto es gratis."], [w(15, "esto"), w(15, "es"), C.gratis], C.caro - 0.3);
  } else {
    frase(q(["Capacita a tu equipo"], ["Capacita a", "tu equipo"]), [C.cta, w(15, "a"), w(15, "tu"), w(15, "equipo.")], C.caro - 0.3);
  }
  frase(q(["Lo caro es que sigan", "haciendo las cosas a mano."], ["Lo caro es", "que sigan", "haciendo", "las cosas", "a mano."]),
    ["lo", "caro", "es", "que", "sigan", "haciendo", "las", "cosas", "a", "mano."].map((x) => w(16, x)), C.fin + 0.15, "tit-final chica-f");
  // cierre: título, CTA, logos
  const tF = C.fin + 0.3;
  const tit = $("div", "titulo titulo-final", c);
  if (platica) {
    const l1 = $("span", "tit-linea", tit), l2 = $("span", "tit-linea", tit);
    const ws = [...["Plática", "gratuita"].map((x) => { const m = $("span", "mascara", l1); const y = $("span", "palabra", m, x); l1.appendChild(document.createTextNode(" ")); return y; }),
      ...["y", "en", "vivo"].map((x) => { const m = $("span", "mascara", l2); const y = $("span", "palabra", m, x); l2.appendChild(document.createTextNode(" ")); return y; })];
    ws.forEach((x, i) => entrar(tl, x, tF + i * 0.06, { escalon: 0 }));
    const ast = $("div", "ast-final", c); ast.innerHTML = CHISPA_SVG("chispa-svg g");
    tl.fromTo(ast, { scale: 3, rotation: -60, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 0.7, ease: "back.out(1.6)" }, tF);
  } else {
    const l1 = $("span", "tit-linea", tit);
    const mC = $("span", "mascara", l1);
    const claude = $("span", "claude palabra", mC);
    const barra = $("span", "barra", claude);
    claude.appendChild(document.createTextNode("Claude"));
    const ast = $("span", "palabra", l1); ast.innerHTML = CHISPA_SVG();
    const l2 = $("span", "tit-linea", tit);
    const ws = ["en", "tu", "Empresa"].map((x) => { const m = $("span", "mascara", l2); const y = $("span", "palabra", m, x); l2.appendChild(document.createTextNode(" ")); return y; });
    entrar(tl, claude, tF, { y: 105 });
    tl.fromTo(barra, { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: "expo.out" }, tF + 0.15);
    tl.fromTo(ast, { scale: 1.8, rotation: -120, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 0.6, ease: "back.out(1.7)" }, tF + 0.05);
    ws.forEach((x, i) => entrar(tl, x, tF + 0.12 + i * 0.06, { escalon: 0 }));
  }
  const cta = $("div", "cta-final", c, platica ? "Aparta tu lugar" : "Capacita a tu equipo");
  tl.fromTo(cta, { opacity: 0, y: 20, filter: "blur(8px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.5, ease: "expo.out" }, tF + 0.4);
  tl.to(fl, { top: q(700, 1330) + "px", duration: 0.01 }, tF);
  const placa = $("div", "placa-logos placa-final", c);
  placa.innerHTML = `<img src="./assets/marca/vadai-horizontal-recorte.png" class="logo-vadai" alt="VADAI"><span class="sep"></span><img src="./assets/marca/totalcoach-recorte.png" class="logo-tc" alt="Total Coach">`;
  pop(tl, placa, tF + 0.6, { desde: 0.85, y: 16 });
}
