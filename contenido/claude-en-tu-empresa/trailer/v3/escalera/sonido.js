// Propuesta 3 · efectos de sonido de «La escalera infinita». Mismo formato que v2/cues.js:
// { f: efecto (scripts/v2-mezcla.mjs), t: instante, db: nivel relativo, ancla: "inicio" | "pico", tono: semitonos }.
// La apertura sale de eventos.js (los mismos números que la animación); el medio y el cierre se anclan a
// las mismas palabras que usan medio.js y cierre.js (ver sus tablas «t»): si una cambia, cambian las dos.
import { eventos, PASOS } from "./eventos.js";

export function sfxEscalera(T) {
  const E = eventos(T), t = E.t;
  const platica = T.version === "platica";
  const S = [];
  const sfx = (f, tt, db = 0, o = {}) => S.push({ f, t: +tt.toFixed(3), db, ancla: o.ancla || "inicio", tono: o.tono || 0, recorte: o.recorte || 0, dur: o.dur || 0 });
  const w = (i, p, n = 1) => T.w(i, p, n);
  const ini = (i, k) => T.porFrase[i][k].start;

  // ================= apertura =================
  // 01 · la multitud: murmullo de fondo y los globos «IA» que revientan en ola
  sfx("multitud", 0, -14, { dur: t.pero + 0.1 });
  sfx("murmullo", 0.2, -15, { dur: t.pero - 0.2 });
  for (let k = 0; k < 14; k++) sfx("pop", 0.08 + k * 0.15 + (k % 3) * 0.02, -15 + (k < 3 ? 3 : 0), { tono: [0, 3, 5, 7, 10, 12, 15][k % 7] });
  sfx("whoosh3", t.artificial + 0.1, -12, { ancla: "pico" });                // la cámara sube
  for (let k = 0; k < 4; k++) sfx("pop", t.pero + k * 0.05, -13, { tono: 12 - k * 3 });   // «Pero»: se apagan
  sfx("whoosh2", E.tLlega + 0.05, -9, { ancla: "pico" });                    // la picada a la puerta
  // 02 · la caja IA cae a la puerta; el manual en blanco
  sfx("thock", E.tLlega, -2);
  sfx("clic", E.tAbre + 0.02, -6);                                           // el cursor da clic: se abre
  sfx("blip", E.tSaleMan + 0.1, -13, { tono: 5 });
  sfx("golpePapel", E.tAbreMan + 0.05, -12);
  E.tHojas.forEach((h, k) => sfx("golpePapel", h + 0.12, -19 + k * 0.5, { tono: 3 + k }));
  sfx("ping2", E.tHojas[3] + 0.05, -14);
  [0, 1, 2, 3].forEach((k) => sfx("pop", E.tPuerta + k * 0.09 + 0.45, -18, { tono: 7 + k * 2 }));
  // 03 · clic, la escalera se arma y «cierra»
  sfx("clic", E.tArma0 - 0.06, -5);
  for (let i = 0; i < PASOS; i += 2) sfx("pop", E.tArma0 + i * E.tArmaPaso + 0.08, -17, { tono: Math.round((i / PASOS) * 12) });
  sfx("whoosh2", E.tCierra - 0.25, -14, { ancla: "pico" });
  sfx("clic", E.tCierra, -4);
  sfx("brillo1", E.tCierra + 0.02, -9);
  // 04 · pasos, el calendario y una caja por semana
  E.hops.slice(1).forEach(([h], k) => sfx("tick", h + 0.24, -23, { tono: k % 2 ? 7 : 0 }));
  E.tCajas.forEach((c, k) => { sfx("golpePapel", c - 0.05, -15, { tono: 2 }); sfx("thock", c + 0.32, -7, { tono: 5 + k * 2 }); });
  sfx("giro", t.intenta + 0.05, -19);
  sfx("blip", t.o + 0.15, -14, { tono: -5 });
  // 05 · bandera, festejo, «uy», OTRA
  sfx("thock", E.tBandera + 0.2, -9, { tono: 8 });
  sfx("brillo2", E.tFesta, -10);
  sfx("ping1", E.tLlegan + 0.02, -12, { tono: -3 });
  sfx("swell2", t.otra - 0.85, -14);
  sfx("impacto2", t.otra - 0.05, -2, { ancla: "pico" });                    // tarjeta de golpe OTRA.
  sfx("arcilla", E.tOtraLlega + 0.03, -9);
  // 06 · las 100; las seis
  sfx("whoosh3", t.realidad + 0.35, -8, { ancla: "pico" });
  for (let k = 0; k < 6; k++) sfx("campanita", E.tSeis + k * E.pasoSeis, -9, { tono: [0, 2, 4, 7, 9, 12][k] });
  sfx("riser", E.tSeis + 0.1, -17);
  sfx("clic", E.tPin0 + 0.35, -10);                                          // el cursor señala «tu empresa»
  // 07 · VAS TARDE; el manual vuelve; la hoja vuela a cámara
  sfx("whoosh1", t.y4 + 0.3, -12, { ancla: "pico" });
  sfx("impacto1", t.vas - 0.05, -2, { ancla: "pico" });                      // tarjeta de golpe VAS TARDE
  sfx("thock", E.tMan2 + 0.32, -6, { tono: 2 });
  sfx("clic", E.tAbre2 + 0.02, -8);
  [0, 1, 2].forEach((k) => sfx("golpePapel", E.tAbre2 + 0.32 + k * 0.12, -19, { tono: 4 + k }));
  sfx("whoosh3", E.tZafa + 0.4, -16, { ancla: "pico" });
  sfx("swell2", t.mientras - 0.9, -15);

  // ================= medio =================
  const m = {
    mientras: w(5, "Mientras"), equipo: w(5, "equipo"), manoF: T.wFin(5, "mano,"), haciendo2: w(5, "haciendo", 2), diariamenteF: T.wFin(5, "diariamente"),
    decision: w(5, "decisión…"), termina: w(5, "termina"), escritorio: w(5, "escritorio."),
    entonces: w(6, "Entonces,"), cuanto: w(6, "¿cuánto"), de2: w(6, "de", 2), ti: w(6, "ti?"),
    falta: w(7, "falta"), otra2: w(7, "otra"), metodo: w(8, "método."),
  };
  sfx("whoosh3", m.mientras + 0.1, -12, { ancla: "pico" });
  sfx("teclado", m.equipo, -17, { dur: m.manoF - m.equipo });
  for (let k = 0; k < 8; k++) sfx("tick", m.equipo - 0.1 + (k + 0.6) * 0.34 + 0.2, -19, { tono: [0, 4, 7, 12][k % 4] });
  sfx("reloj", m.haciendo2, -11, { dur: 3.3 });
  for (let k = 0; k < 3; k++) { sfx("whoosh1", m.haciendo2 + k * 1.1 + 0.5, -16, { ancla: "pico" }); for (let j = 0; j < 8; j++) sfx("tick", m.haciendo2 + k * 1.1 + (j + 0.6) * 0.12, -22, { tono: 12 }); }
  sfx("contador", m.haciendo2 + 3.3, -9, { dur: m.diariamenteF + 0.2 - m.haciendo2 - 3.3 });
  for (let k = 0; k < 7; k++) sfx("pop", m.decision - 0.15 + k * 0.07 * 2, -13, { tono: 3 + k });
  sfx("giro", m.termina - 0.3, -13);
  for (let k = 0; k < 6; k++) sfx("pop", m.escritorio - 0.2 + k * 0.13, -11, { tono: -5 + (k % 3) });
  sfx("arcilla", m.escritorio + 0.25, -11);
  sfx("impacto1", m.entonces, -6, { ancla: "pico" });                       // se apaga la luz
  sfx("latido", m.cuanto - 0.2, -10, { dur: m.ti - m.cuanto + 0.6 });
  sfx("riser", m.cuanto - 0.1, -16);
  sfx("impacto2", m.de2 - 0.05, -2, { ancla: "pico" });                     // ¿DE TI?
  sfx("whoosh1", m.otra2 + 0.38, -9, { ancla: "pico" });                    // el cursor avienta la caja
  sfx("thock", m.otra2 + 0.4, -4, { tono: 3 });
  sfx("thock", m.otra2 + 0.95, -9, { tono: -2 });
  sfx("swell2", m.metodo - 0.85, -10);
  sfx("impacto1", m.metodo - 0.05, -1, { ancla: "pico" });                  // MÉTODO.
  sfx("brillo1", m.metodo + 0.02, -7);
  sfx("vidrio1", m.metodo + 0.5, -12);                                       // los hilos se cortan
  for (let k = 0; k < 4; k++) sfx("campanita", m.metodo + 0.8 + k * 0.12, -12, { tono: [0, 4, 7, 12][k] });

  // ================= cierre =================
  const off = platica ? 16 : 29;
  const c = {
    desde: T.w(9, "Por") - 0.25,
    salir: ini(10, off + 2), bucle: ini(10, off + 4), todo: ini(10, off + 5), claude: ini(10, off + 11), metodo: ini(10, off + 15), para: ini(10, off + 16),
    lo: ini(11, 0), vadai: ini(11, 2), total: ini(11, 4), cientos: ini(11, 7), porque: ini(12, 0), nosotros: ini(13, 0),
    dale: ini(14, 0), clic: ini(14, 1), aqui: ini(14, 2), cta: ini(14, 5), f15: ini(15, 0), loCaro: ini(16, 0), caro: ini(16, 1), fin16: T.f(16).fin,
  };
  c.tarjeta = c.fin16 + 0.25;
  sfx("whoosh2", c.desde + 0.45, -10, { ancla: "pico" });
  if (platica) {
    [ini(9, 10), ini(9, 11) + 0.1, ini(9, 12)].forEach((x, k) => sfx("pop", x, -11, { tono: 4 + k * 3 }));
    for (let k = 0; k < 10; k++) sfx("pop", ini(10, 1) + k * 0.11, -17, { tono: [0, 5, 7, 12, 3][k % 5] });
    for (let k = 0; k < 6; k++) sfx("campanita", ini(10, 8) + 0.75 + k * 0.05, -14, { tono: [0, 2, 4, 7, 9, 12][k] });
  } else {
    [ini(9, 11), ini(9, 12), ini(9, 13)].forEach((x, k) => sfx("thock", x, -7, { tono: 4 + k * 3 }));   // paso a paso
    [ini(10, 2), ini(10, 7), ini(10, 14), ini(10, 24)].forEach((x, k) => { sfx("blip", x, -12, { tono: k * 2 }); sfx("ping1", x + 0.45, -14, { tono: k * 2 }); });
  }
  sfx("whoosh3", c.salir - 0.15, -6, { ancla: "pico" });                    // atravesamos la ventana
  sfx("brillo2", c.salir + 0.05, -8);
  sfx("riser", c.bucle, -12);
  sfx("pop", c.todo, -8);
  for (let k = 0; k < 4; k++) sfx("thock", c.todo + 0.55 + k * 0.17 + 0.2, -11, { tono: 2 + k * 2 });
  sfx("brillo1", c.claude - 0.05, -8);
  sfx("clic", c.metodo, -8);
  for (let k = 0; k < 6; k++) { sfx("pop", c.para + 0.6 + k * 0.14, -16, { tono: 5 }); sfx("ping1", c.para + 0.8 + k * 0.14, -18, { tono: 7 }); }
  sfx("whoosh1", c.lo + 0.15, -12, { ancla: "pico" });
  sfx("clic", c.vadai, -11); sfx("clic", c.total, -11);
  sfx("whoosh3", c.cientos, -9, { ancla: "pico" });
  for (let k = 0; k < 8; k++) sfx("campanita", c.cientos + 0.2 + k * 0.17, -14, { tono: [0, 2, 4, 5, 7, 9, 11, 12][k] });
  sfx("multitud", c.porque, -15, { dur: 3.0 });
  for (let k = 0; k < 8; k++) sfx("pop", c.porque + 0.1 + k * 0.2, -16, { tono: [0, 3, 5, 7][k % 4] });
  sfx("thock", c.nosotros + 0.35, -5);
  [0, 1, 2].forEach((k) => sfx(k % 2 ? "plumon3" : "plumon1", c.nosotros + 0.4 + k * 0.55, -13));
  sfx("whoosh1", c.dale, -12, { ancla: "pico" });
  sfx("pop", c.clic, -8, { tono: 5 });
  sfx("clic", c.cta, -2);
  sfx("sello", c.cta + 0.12, -4);
  if (platica) { sfx("impacto2", ini(15, 2) - 0.05, -2, { ancla: "pico" }); sfx("brillo2", ini(15, 2), -9); }
  else { sfx("golpePapel", c.f15, -8); sfx("sello", ini(15, 6) + 0.05, -4); }
  sfx("impacto1", c.loCaro - 0.05, -3, { ancla: "pico" });
  for (let k = 0; k < 14; k++) sfx("pop", c.loCaro + k * 0.13 + 0.42, -14, { tono: -7 + (k % 4) });
  for (let k = 0; k < 5; k++) sfx("thock", c.caro + 0.35 + k * 0.4, -7, { tono: -3 });
  sfx("swell1", c.tarjeta - 0.4, -9);
  sfx("brillo1", c.tarjeta + 0.05, -6);
  return S;
}
