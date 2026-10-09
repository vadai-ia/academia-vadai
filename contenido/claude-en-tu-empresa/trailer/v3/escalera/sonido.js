// Propuesta 3 · efectos de sonido de «La escalera infinita». Mismo formato que v2/cues.js:
// { f: efecto (scripts/v2-mezcla.mjs), t: instante, db: nivel relativo, ancla: "inicio" | "pico", tono: semitonos }.
// Cada efecto nace de un evento de eventos.js: si la animación se mueve, el sonido se mueve con ella.
import { eventos, PASOS } from "./eventos.js";

export function sfxEscalera(T) {
  const E = eventos(T), t = E.t;
  const S = [];
  const sfx = (f, tt, db = 0, o = {}) => S.push({ f, t: +tt.toFixed(3), db, ancla: o.ancla || "inicio", tono: o.tono || 0, recorte: o.recorte || 0, dur: o.dur || 0 });

  // 01 · los objetos caen (pop suave, subiendo) y les estampan el sticker
  E.tObj.forEach((t0, k) => sfx("pop", t0 + 0.3, -15, { tono: [0, 2, 4, 5, 7][k] }));
  E.tSt.forEach((t0, k) => sfx("sticker", t0, -5, { ancla: "pico", tono: [0, 2, 3, 5, 7][k] }));
  sfx("sticker", E.tLente + 0.16, 0, { ancla: "pico", tono: -5 });            // el sticker en la cámara
  sfx("impacto1", E.tLente + 0.16, -13, { ancla: "pico" });
  sfx("whoosh3", E.tDespega + 0.2, -9, { ancla: "pico" });                   // se despega

  // 02 · la caja IA cae a la puerta; el manual en blanco
  sfx("whoosh1", E.tLlega - 0.02, -17, { ancla: "pico" });
  sfx("thock", E.tLlega, -2);
  sfx("clic", E.tAbre + 0.05, -11);                                          // las solapas
  sfx("blip", E.tSaleMan + 0.1, -13, { tono: 5 });
  sfx("golpePapel", E.tAbreMan + 0.05, -12);                                 // la tapa
  E.tHojas.forEach((h, k) => sfx("golpePapel", h + 0.12, -19 + k * 0.5, { tono: 3 + k }));
  sfx("ping2", E.tHojas[3] + 0.05, -14);                                     // «?»
  E.tObj.slice(0, 4).forEach((_, k) => sfx("pop", E.tPuerta + k * 0.09 + 0.45, -18, { tono: 7 + k * 2 }));   // salen por la puerta

  // 03 · la escalera se arma escalón por escalón y «cierra» al llegar a la isométrica
  for (let i = 0; i < PASOS; i += 2) sfx("pop", E.tArma0 + i * E.tArmaPaso + 0.08, -17, { tono: Math.round((i / PASOS) * 12) });
  sfx("whoosh2", E.tCierra - 0.25, -14, { ancla: "pico" });
  sfx("clic", E.tCierra, -4);
  sfx("brillo1", E.tCierra + 0.02, -9);
  [0, 1, 2, 3].forEach((k) => sfx("blip", E.tSuben + k * 0.08 + 0.5, -18, { tono: 4 - k }));   // aterrizan en sus escalones

  // 04 · pasos (suaves), la hoja del calendario y una caja por semana
  E.hops.slice(1).forEach(([h], k) => sfx("tick", h + 0.24, -23, { tono: k % 2 ? 7 : 0 }));
  E.tCajas.forEach((c, k) => {
    sfx("golpePapel", c - 0.05, -15, { tono: 2 });
    sfx("whoosh1", c + 0.3, -20, { ancla: "pico" });
    sfx("thock", c + 0.32, -7, { tono: 5 + k * 2 });
  });
  sfx("giro", t.intenta + 0.05, -19);                                        // la sacuden
  sfx("blip", t.o + 0.15, -14, { tono: -5 });                                // «o ni eso»: voltean a ver a la dormida

  // 05 · bandera, festejo, «uy», la otra caja
  sfx("thock", E.tBandera + 0.2, -9, { tono: 8 });
  sfx("brillo2", E.tFesta, -10);
  sfx("ping1", E.tLlegan + 0.02, -12, { tono: -3 });
  sfx("whoosh2", E.tOtraLlega - 0.02, -7, { ancla: "pico" });
  sfx("impacto2", E.tOtraLlega, -2, { ancla: "pico" });
  sfx("arcilla", E.tOtraLlega + 0.03, -8);

  // 06 · zoom out a las 100; las seis se encienden (campanitas subiendo) y salen disparadas
  sfx("whoosh3", t.realidad + 0.35, -8, { ancla: "pico" });
  sfx("swell1", t.realidad + 0.1, -16);
  for (let k = 0; k < 6; k++) sfx("campanita", E.tSeis + k * E.pasoSeis, -9, { tono: [0, 2, 4, 7, 9, 12][k] });
  sfx("riser", E.tSeis + 0.1, -17);
  sfx("blip", E.tPin0 + 0.05, -12, { tono: 2 });                              // etiqueta «tu empresa»

  // 07 · zoom in; salen de la caja; el manual vuelve; la hoja se zafa y vuela a la cámara
  sfx("whoosh1", t.y4 + 0.3, -12, { ancla: "pico" });
  sfx("pop", E.tSalen + 0.4, -14, { tono: 3 });
  sfx("whoosh1", t.explicado - 0.1, -15, { ancla: "pico" });
  sfx("thock", E.tMan2 + 0.32, -6, { tono: 2 });
  sfx("golpePapel", E.tAbre2 + 0.05, -12);
  [0, 1, 2].forEach((k) => sfx("golpePapel", E.tAbre2 + 0.32 + k * 0.12, -19, { tono: 4 + k }));
  sfx("whoosh3", E.tZafa + 0.4, -16, { ancla: "pico" });
  sfx("swell2", t.mientras - 0.9, -15);
  return S;
}
