// Propuesta 3 · la hoja de eventos: cada cosa que pasa en pantalla, en segundos, anclada a las palabras
// de la voz. La leen la animación (apertura.js, en el navegador) y la mezcla (sonido.js, en Node): un
// golpe de sticker y su sonido salen del mismo número. Sin DOM.
export const PASOS = 20;   // escalones de la Penrose (2·(3+7))

export function eventos(T) {
  const w = (i, p, n = 1) => T.w(i, p, n);
  const wf = (i, p, n = 1) => T.wFin(i, p, n);
  const t = {
    todo: w(0, "Todo"), habla: w(0, "habla"), inteligencia: w(0, "inteligencia"), artificial: w(0, "artificial."), fin0: wf(0, "artificial."),
    pero: w(1, "Pero"), casi: w(1, "casi"), nadie: w(1, "nadie"), dice: w(1, "dice"), que: w(1, "qué"), hacer: w(1, "hacer"), ella: w(1, "ella"), empresa: w(1, "empresa."), fin1: wf(1, "empresa."),
    presento: w(2, "presento"), bucle: w(2, "bucle"), tecno: w(2, "tecnológico:"), tecnoF: wf(2, "tecnológico:"),
    cada: w(2, "cada"), semana: w(2, "semana"), sale: w(2, "sale"), herramienta: w(2, "herramienta"), nueva: w(2, "nueva,"),
    equipo: w(2, "equipo"), intenta: w(2, "intenta"), usarla: w(2, "usarla"), manera: w(2, "manera,"), o: w(2, "o"), eso: w(2, "eso,"),
    y: w(2, "y"), sienten: w(2, "sienten"), ya: w(2, "ya"), avanzaron: w(2, "avanzaron…"), avanzaronF: wf(2, "avanzaron…"), sale2: w(2, "sale", 2), otra: w(2, "otra."), otraF: wf(2, "otra."),
    realidad: w(3, "realidad"), solo: w(3, "solo"), seis: w(3, "6"), cien: w(3, "100"), empresas: w(3, "empresas"), realmente: w(3, "realmente"), provecho: w(3, "provecho"), ia3: w(3, "IA."), fin3: wf(3, "IA."),
    y4: w(4, "Y"), normal: w(4, "normal"), vas: w(4, "vas"), tarde: w(4, "tarde:"), nadie4: w(4, "nadie"), explicado: w(4, "explicado"), como: w(4, "cómo"), negocio: w(4, "negocio."), fin4: wf(4, "negocio."),
    mientras: w(5, "Mientras"),
  };
  const E = { t };
  // 01 · objetos y stickers; el sticker gigante en la cámara
  E.tObj = [0, 1, 2, 3, 4].map((k) => k * 0.07);
  E.tSt = [t.habla - 0.02, t.habla + 0.27, t.inteligencia, t.inteligencia + 0.32, t.artificial];
  E.tCorte = 0;   // un solo plano: de la multitud a la puerta sin corte
  // 02 · la caja IA y el manual en blanco
  E.tCae = t.casi - 0.18; E.tLlega = t.nadie + 0.02;
  E.tAbre = t.dice; E.tSaleMan = t.que - 0.05; E.tAbreMan = t.hacer + 0.02;
  E.tHojas = [0, 1, 2, 3, 4].map((k) => E.tAbreMan + 0.32 + k * 0.24);
  E.tGuarda = t.presento - 0.02;
  E.tPuerta = t.ella - 0.15;
  // 03 · la escalera se arma y la cámara la «cierra»
  E.tArma0 = t.presento + 0.18; E.tArmaPaso = (t.tecno + 0.2 - E.tArma0) / PASOS;
  E.tCierra = t.tecno + 0.32; E.tSuben = t.bucle;
  // 04 · una caja por semana
  E.tCajas = [t.sale - 0.08, t.herramienta + 0.1, t.nueva + 0.12];
  // saltos de la que va al frente: [instante, escalón al que llega]; cada salto dura 0.26 s
  const hops = [[0, 4]];
  let s = 4;
  const add = (t0, paso, n) => { for (let k = 0; k < n; k++) hops.push([t0 + k * paso, s + k + 1]); s += n; };
  add(t.cada + 0.02, 0.3, 7);          // 4 → 11 mientras caen las cajas
  add(t.intenta, 0.42, 5);             // 11 → 16 «a su manera»
  add(t.sienten - 0.1, 0.3, 2);        // 16 → 18: ahí clavan la bandera
  add(t.avanzaronF + 0.02, 0.19, 3);   // 18 → 21: el escalón de la dormida
  E.hops = hops;
  // 05 · bandera, festejo, llegada junto a la dormida, la otra caja
  E.tBandera = t.ya + 0.02; E.tFesta = t.avanzaron + 0.05;
  E.tLlegan = t.avanzaronF + 0.02 + 2 * 0.19 + 0.26;
  E.tOtraCae = t.otra - 0.22; E.tOtraLlega = t.otra + 0.06;
  // 06 · las seis
  E.tSeis = t.seis - 0.04; E.pasoSeis = 0.11;
  E.tPin0 = t.seis + 0.55; E.tPin1 = t.normal + 0.05;
  // 07 · el manual vuelve; la hoja se zafa
  E.tSalen = t.normal - 0.3;
  E.tMan2 = t.nadie4 - 0.25; E.tAbre2 = t.explicado; E.tZafa = t.como - 0.08;
  return E;
}
