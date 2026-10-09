// v2 · hoja de cues ÚNICA: los momentos del relato, anclados a palabras. La usan la versión 3D, la 2D
// y la mezcla (cada efecto de sonido cae en el mismo instante que su evento visual). Sin DOM.
//   cues(T, estilo) → { C, S }   estilo: "3d" | "2d" (algunos efectos son de una sola versión)

// las herramientas que aparecen en cada tramo del bucle (v2/logos.js); Claude llega con «sale otra»
export const OLEADAS = [
  ["googlegemini", "meta", "perplexity", "mistralai"],
  ["deepseek", "githubcopilot", "huggingface", "ollama"],
  ["notion", "cursor"],
  ["qwen", "elevenlabs", "suno", "claude"],
];
export const PASO_LOGO = 0.13;   // separación entre logos de una misma oleada

export function cues(T, estilo = "3d") {
  const C = {};
  const v = T.version;
  // ---------------- cuerpo común ----------------
  // 01 · gancho
  C.enciende = 0.55;
  C.ia = T.w(0, "inteligencia");
  C.pregunta = T.w(1, "qué");
  C.empresa = T.w(1, "empresa.");
  C.pase01 = T.f(2).inicio;
  // 02 · el bucle
  C.bucle = T.w(2, "bucle");
  C.L = [T.w(2, "sale", 1), T.w(2, "usarla"), T.w(2, "sale", 2)];
  C.niEso = T.w(2, "o");
  C.avanzaron = T.w(2, "avanzaron…");
  C.oleadas = [C.L[0], C.L[1], C.niEso, C.L[2]];
  // 03 · seis de cada cien
  C.colapso = T.f(3).inicio - 0.25;
  C.realidad = T.w(3, "realidad");
  C.seis = T.w(3, "6");
  C.cien = T.w(3, "100");
  C.provecho = T.w(3, "provecho");
  // 04 · vas tarde
  C.normal = T.f(4).inicio;
  C.tarde = T.w(4, "tarde:");
  C.nadie = T.w(4, "nadie");
  C.ha = T.w(4, "ha");
  // 05 · el escritorio se llena
  C.mientras = T.f(5).inicio;
  C.reportes = T.w(5, "reportes");
  C.mano = T.w(5, "mano,");
  C.mismas = T.w(5, "mismas");
  C.talachas = T.w(5, "talachas");
  C.diariamente = T.w(5, "diariamente");
  C.decision = T.w(5, "decisión…");
  C.termina = T.w(5, "termina");
  C.escritorio = T.w(5, "escritorio.");
  C.avisos = [0, 1, 2, 3, 4, 5].map((k) => +(C.decision + 0.05 + k * 0.17 - k * k * 0.008).toFixed(3));
  // 06 · sé honesto
  C.honesto = T.f(6).inicio;
  C.cuanto = T.w(6, "¿cuánto");
  C.depende = T.w(6, "depende");
  C.ti = T.wFin(6, "ti?");
  // 07 · el giro
  C.porque = T.f(7).inicio;
  C.herramienta = T.w(7, "herramienta.");
  C.falta = T.f(8).inicio;
  C.metodo = T.w(8, "método.");
  C.golpe = T.golpe;
  C.ramal = T.f(9).inicio;
  // ---------------- cierres ----------------
  // 11-oct: los dos cierres tienen la misma estructura (ocho frases); cambian el 9, el 10, el 14 y el 15
  const iR = 11, iP = iR + 1, iN = iR + 2, iD = iR + 3;
  C.respaldan = T.f(iR).inicio;
  C.vadai = T.w(iR, "VADAI");
  C.total = T.w(iR, "Total");
  C.cuarenta = T.w(iR, "cientos");
  C.capacitadas = T.w(iR, "capacitadas");
  C.porque2 = T.f(iP).inicio;
  C.ia2 = T.w(iP, "inteligencia");
  C.nosotros = T.f(iN).inicio;
  C.ensenamos = T.w(iN, "enseñamos");
  C.ella = T.w(iN, "ella.");
  C.dale = T.f(iD).inicio;
  C.clic = T.w(iD, "clic");
  C.abajo = T.w(iD, "abajo");
  C.caro = T.f(16).inicio;
  C.mano2 = T.w(16, "mano.");
  C.fin = T.f(16).fin;
  C.tarjeta = C.fin + 0.8;                     // entra la tarjeta final (deja leer «A MANO.»)
  // 10 · lo que aprendes: misma escena en los dos (Claude al centro, la gráfica, la ciudad, el vidrio)
  C.contamos = T.f(10).inicio;
  C.todo = T.w(10, "todo");
  C.lugar = T.w(10, "lugar,");
  C.claude = T.w(10, "Claude");
  C.metodo2 = T.w(10, "método,");
  C.equipo2 = T.w(10, "equipo");
  C.resuelva = T.w(10, "resuelva");
  C.esperarte = T.w(10, "esperarte.");
  // qué aparición de cada palabra corta lleva «todo en un mismo lugar, con Claude y…, para que tu equipo…»
  const n = v === "platica" ? { en: 1, y: 2, que: 4, tu: 1 } : { en: 3, y: 3, que: 2, tu: 4 };   // «qué» cuenta como «que» (clave sin acentos)
  C.lugar1 = [C.todo, T.w(10, "en", n.en), T.w(10, "un", 1), T.w(10, "mismo", 1), C.lugar];
  C.lugar2 = [T.w(10, "con", 2), C.claude, T.w(10, "y", n.y), T.w(10, "un", 2), T.w(10, "mismo", 2), C.metodo2];
  C.lugar3 = [T.w(10, "que", n.que), T.w(10, "tu", n.tu), C.equipo2, C.resuelva, T.w(10, "sin"), C.esperarte];
  C.truena = T.w(10, "bucle:") + 0.13;
  if (v === "platica") {
    C.platica = T.w(9, "plática");
    C.vivo = T.w(9, "vivo");
    C.duenos = T.w(9, "dueños");
    C.b = [T.w(10, "qué", 1), T.w(10, "qué", 2), T.w(10, "cómo")];   // las tres cosas que te contamos
    C.grafica = C.b[0];
    C.ciudad = C.b[1];
    C.aro = C.b[2];
    C.cta = T.w(14, "aparta");
    C.gratis = T.w(15, "gratis.");
    C.etiqueta = T.w(15, "esto") - 0.2;
  } else {
    // 9 · «Por eso creamos Claude en tu Empresa: el curso donde aprendes, paso a paso…»
    C.claude9 = T.w(9, "Claude", 1);
    C.empresaT = T.w(9, "Empresa:");
    C.curso = T.w(9, "curso");
    C.paso = [T.w(9, "paso", 1), T.w(9, "a", 1), T.w(9, "paso", 2)];
    C.trabajando = T.w(9, "trabajando");
    // 10 · cinco cosas: hablarle a la IA, en qué punto está, cualquier herramienta, conectarla, salir
    C.b = [T.w(10, "hablarle"), T.w(10, "cómo", 1), T.w(10, "cómo", 3)];
    C.punto = T.w(10, "punto");
    C.grafica = T.w(10, "en", 1);
    C.ciudad = T.w(10, "cómo", 2);
    C.aro = C.b[2];
    C.cta = T.w(14, "inscribe");
    C.gratis = T.w(15, "semana.");             // «SEMANA 1» se estampa en el calendario
    C.etiqueta = T.w(15, "los") - 0.2;
  }
  C.centro = C.contamos + 0.25;
  // las herramientas entran una por una; en el curso, con «cualquier herramienta de tu día a día»
  const h0 = v === "platica" ? C.centro + 0.3 : T.w(10, "cualquier") - 0.6, pasoH = v === "platica" ? 0.36 : 0.22;
  C.herr = Array.from({ length: 11 }, (_, k) => +(h0 + k * pasoH).toFixed(3));
  C.infinito = T.w(iR, "capacitadas") + 0.2;
  C.mundo = C.porque2 + 0.3;
  C.rojo = C.caro - 0.18;

  // ---------- 10-oct · Ronda E de Alejandro (2D) ----------
  // las excursiones de la chispa a los costados del bucle (personas corriendo, buscando, estresadas)
  C.excA = T.w(2, "tu") - 0.6;                 // sale a la izquierda: rueda de hámster + alguien estresado
  C.excAvuelve = C.niEso - 0.3;
  C.excB = T.wFin(2, "eso,") + 0.1;            // sale a la derecha: alguien que busca con su lupa
  C.excBvuelve = C.avanzaron + 0.1;
  C.glitches = [C.L[1] + 0.12, C.niEso, C.avanzaron + 0.45, C.L[2]];
  C.empresas = T.w(3, "empresas");
  // 04: el reloj de «vas tarde», el pizarrón y el maestro de «nadie te ha explicado», el foco que no prende
  C.reloj = C.tarde - 0.1;
  C.vuelve04 = C.tarde + 0.75;
  C.pizarron = C.nadie + 0.07;
  C.como = T.w(4, "cómo");
  C.maestro = C.como + 0.1;
  C.foco = T.w(4, "implementarla") + 0.36;
  // 06: los signos que abruman, alguien que huye; los chats que el director tiene que aprobar
  C.signos = T.w(6, "sé") + 0.1;
  C.huye = C.signos + 0.15;
  C.traga = C.cuanto - 0.5;                    // el punto «tú» se traga los signos
  C.chats = [0, 1, 2, 3].map((k) => +(C.cuanto + 0.25 + k * 0.62).toFixed(3));

  // ---------- efectos de sonido ----------
  // f: archivo (scripts/v2-mezcla.mjs) · t: instante del evento · db: nivel relativo (0 = presente,
  // −10 = de fondo) · ancla: qué parte del efecto cae en t ("inicio" o "pico") · tono: semitonos
  const S = [];
  const sfx = (f, t, db = 0, o = {}) => { if (!o.solo || o.solo === estilo) S.push({ f, t: +t.toFixed(3), db, ancla: o.ancla || "inicio", tono: o.tono || 0, recorte: o.recorte || 0, dur: o.dur || 0 }); };
  // 01
  sfx("pulso", C.enciende, -1);
  sfx("murmullo", 0.62, -9, { dur: 2.2 });                           // «todo mundo habla»
  sfx("whoosh3", 1.9, -9, { ancla: "pico", solo: "3d" });            // titulares que cruzan la lente
  sfx("plumon1", C.ia, -10, { solo: "2d" });
  sfx("plumon3", C.empresa + 0.02, -6, { solo: "2d" });              // la barra que subraya EMPRESA
  sfx("whoosh2", C.pase01, -3, { ancla: "pico" });                   // la chispa cruza la lente / la barra se vuelve el bucle
  // 02 · cada oleada de herramientas: un blip por logo, más agudo en cada oleada
  const ESCALA = [0, 2, 4, 7, 9, 12, 14, 16];
  C.oleadas.forEach((t0, k) => OLEADAS[k].forEach((id, j) => sfx(id === "claude" ? "brillo2" : "blip", t0 + j * PASO_LOGO, id === "claude" ? -4 : -7, { tono: ESCALA[(j + k * 2) % ESCALA.length] })));
  C.L.forEach((t) => sfx("pop", t, -6, { solo: "2d" }));             // las flechas del ciclo
  sfx("glitch2", C.niEso, -8);                                       // «o ni eso»
  sfx("giro", C.avanzaron - 0.2, -10);                               // el bucle se acelera
  sfx("glitch1", C.L[2] - 0.08, -9);                                 // «sale otra»: sacudida
  if (estilo === "2d") {
    // las excursiones: la chispa sale silbando, dibuja con plumón; la rueda gira con pasos
    [C.excA, C.excB].forEach((t) => sfx("whoosh3", t + 0.15, -13, { ancla: "pico" }));
    sfx("plumon3", C.excA + 0.32, -12);
    sfx("pasos", C.excA + 0.7, -14, { dur: 2.4 });
    sfx("plumon1", C.excA + 1.25, -13);
    sfx("plumon3", C.excB + 0.32, -12);
    [0.95, 1.12, 1.29].forEach((d, k) => sfx("pop", C.excB + d, -12, { tono: 5 + k * 2 }));   // los «?» del que busca
    sfx("glitch1", C.glitches[0], -13);
    sfx("glitch2", C.glitches[2], -12);
  }
  sfx("swell2", C.colapso - 1.2, -6, { recorte: 1.8 });
  sfx("impacto2", C.colapso + 0.55, -4);                             // implosión
  // 03
  sfx("hielo", C.realidad, -8);
  for (let k = 0; k < 6; k++) sfx("tick", C.seis + 0.05 + k * 0.09, -6, { tono: k });
  sfx("brillo2", C.provecho + 0.1, -10);
  // 04
  sfx("whoosh1", C.normal - 0.05, -10, { ancla: "pico" });           // los demás caen
  sfx("whoosh3", C.tarde + 0.35, -10, { ancla: "pico" });            // los seis se adelantan
  sfx("whoosh1", C.vuelve04, -12, { ancla: "pico", solo: "2d" });    // la chispa regresa
  if (estilo === "2d") {
    sfx("reloj", C.reloj, -11, { dur: 3.6 });                         // el reloj de «vas tarde»
    sfx("plumon1", C.pizarron + 0.05, -11);                           // el pizarrón
    sfx("plumon3", C.como - 0.3, -10);                                // el «?» en el pizarrón
    sfx("plumon1", C.maestro + 0.05, -13);
    sfx("foco", C.foco + 0.45, -8);                                   // el foco que no prende
  }
  // 05
  sfx("whoosh2", C.mientras, -5, { ancla: "pico" });
  sfx("teclado", C.reportes - 0.1, -4, { dur: 2.6 });
  for (let k = 0; k < 5; k++) sfx("marcador", C.talachas + k * 0.2, -8, { tono: k % 2 ? 0 : 2 });
  C.avisos.forEach((t, k) => sfx(k % 2 ? "ping2" : "ping1", t, k % 2 ? -4 : -8, { tono: k }));
  sfx("golpePapel", C.escritorio + 0.05, 0, { ancla: "pico" });
  // 06
  if (estilo === "2d") {
    // los signos que abruman: pops cada vez más seguidos y agudos; alguien huye corriendo
    for (let k = 0; k < 14; k++) sfx("pop", +(C.signos + (C.traga - 0.4 - C.signos) * Math.pow(k / 14, 0.55)).toFixed(3), -12 + k * 0.3, { tono: k });
    sfx("pasos", C.huye, -9, { dur: 1.5 });
    sfx("whoosh1", C.traga + 0.25, -8, { ancla: "pico" });           // el punto se los traga
    sfx("impacto1", C.cuanto, -10);                                  // la pregunta cae de golpe
    sfx("chats", C.chats[0] - 0.05, -14, { dur: 3.0 });
    C.chats.forEach((t, k) => { sfx(k % 2 ? "ping2" : "ping1", t, -9, { tono: k }); sfx("blip", t + 0.36, -14, { tono: 7 + k }); });
  }
  sfx("latido", C.cuanto - 0.1, -3);
  // 07 · 08
  sfx("glitch2", C.herramienta, -5);
  sfx("riser", C.metodo - 0.04, -4, { ancla: "pico" });
  sfx("impacto2", C.metodo, 0);
  sfx("impacto1", C.metodo, -9);
  sfx("whoosh1", C.ramal - 0.35, -5, { ancla: "pico" });             // el retroceso que abre el mundo
  // cierres
  if (v === "platica") {
    sfx("brillo1", C.platica, -8);
    sfx("pulso", C.vivo, -8);                                        // el punto «en vivo»
    sfx("pop", C.duenos, -6);
  } else {
    sfx("brillo2", C.claude9, -5);                                   // la chispa aterriza como asterisco
    C.paso.forEach((t, k) => sfx("pop", t, -7, { tono: 2 + k * 3 })); // cada escalón del paso a paso
    sfx("plumon3", C.paso[0] - 0.1, -11);
  }
  C.b.forEach((t, k) => { sfx("whoosh3", t - 0.05, -12, { ancla: "pico" }); if (k < 2 || estilo !== "2d") sfx("pop", t, -6, { tono: k * 2 }); });
  if (estilo === "2d") {
    sfx("brillo2", C.centro, -6);                                    // Claude en el centro
    C.herr.forEach((t, k) => sfx("blip", t, -10, { tono: ESCALA[k % ESCALA.length] }));
    sfx("plumon3", C.grafica + 0.05, -11);
    sfx("plumon1", C.ciudad + 0.05, -11);
    for (let k = 0; k < 6; k++) sfx("pop", C.ciudad + 0.9 + k * 0.12, -11, { tono: 4 + k });
    sfx("plumon3", C.aro + 0.05, -10);
    sfx("vidrio1", C.truena, -2, { ancla: "pico" });                 // el bucle truena como vidrio
    sfx("vidrio2", C.truena + 0.12, -9);
    sfx("impacto2", C.truena, -9);
  }
  for (let k = 0; k < 6; k++) sfx("blip", C.todo + k * 0.09, -9, { tono: 12 - k * 2 });  // todo entra a un mismo lugar
  if (v === "platica") sfx("brillo2", C.claude, -5);
  sfx("llave1", C.metodo2, -2);
  sfx("campanita", C.resuelva + 0.2, -8);
  sfx("whoosh2", C.respaldan - 0.1, -8, { ancla: "pico" });
  sfx("pop", C.vadai, -4);
  sfx("pop", C.total, -4, { tono: 3 });
  sfx("contador", C.cuarenta, -3);
  if (estilo === "2d") {
    sfx("plumon3", C.respaldan + 0.1, -12);                          // la chispa rodea la placa
    sfx("brillo1", C.respaldan + 1.7, -12);                          // el brillo que cruza la placa
    sfx("multitud", C.cuarenta + 0.2, -16, { dur: 3.0 });            // las empresas que no paran de llegar
    sfx("riser", C.infinito + 0.55, -12, { ancla: "pico" });
    sfx("brillo2", C.infinito + 0.6, -6);                            // el infinito
    sfx("plumon3", C.mundo + 0.1, -12);                              // el planeta
    sfx("plumon1", C.mundo + 0.88, -13);                             // las barras
    sfx("plumon1", C.mundo + 1.62, -13);                             // la gráfica
    for (let k = 0; k < 7; k++) sfx("pop", C.mundo + 0.7 + k * 0.16, -13, { tono: k * 2 });   // los globos de diálogo
  }
  sfx("murmullo", C.porque2, -11, { dur: 3.2 });
  sfx("whoosh3", C.ia2, -10, { ancla: "pico" });
  sfx("brillo1", C.ella, -6);
  sfx("clic", C.clic, 0, { ancla: "pico" });
  sfx("pop", C.cta, -4);
  sfx("campanita", C.gratis, -9);
  if (estilo === "2d") {
    sfx("plumon3", C.etiqueta + 0.05, -10);                          // la etiqueta
    sfx("sello", C.gratis, -3, { ancla: "pico" });                   // GRATIS / SEMANA 1 se estampa
    sfx("whoosh2", C.rojo, -8, { ancla: "pico" });                   // el telón navy
    sfx("monedas", C.caro + 0.05, -6);                               // lo caro
    sfx("impacto1", C.caro, -12);
    sfx("brillo1", C.mano2, -9);                                     // la chispa cae en MANO
  }
  sfx("swell1", C.caro + 0.3, -12);
  sfx("brillo2", C.tarjeta - 0.15, -8);
  // ---------- Propuesta 3 «La interfaz viva» (v3): los efectos de sus elementos (12-oct) ----------
  // voz y música iguales; los efectos comunes de arriba se quedan (oleadas, glitch, golpe de MÉTODO…)
  if (estilo === "v3") {
    sfx("gota", C.enciende - 0.04, -3);                                // la gota cae sobre la pantalla
    for (let k = 0; k < 6; k++) sfx("pop", 0.75 + k * 0.32, -9, { tono: [0, 3, 5, 7, 10, 12][k] });   // los globos de chat
    sfx("pop", 2.3, -8, { tono: 9 });                                  // +12 notificaciones
    sfx("sticker", C.pregunta - 0.15, -6, { ancla: "pico" });          // la tarjeta de la pregunta
    C.oleadas.forEach((t0, k) => sfx("sticker", t0 + 0.27, -7, { ancla: "pico", tono: k }));   // NEW! / ¡OTRA!
    sfx("whoosh1", C.colapso + 0.5, -8, { ancla: "pico" });            // la página baja al 6 de 100
    for (let k = 0; k < 6; k++) sfx("arcilla", C.colapso + 0.45 + k * 0.07, -14, { tono: k * 2 });   // las píldoras de arcilla
    for (let k = 0; k < 5; k++) sfx("tick", C.normal + 0.4 + k * 0.32, -15, { tono: 12 });          // la barra de carga
    sfx("pop", C.como - 0.1, -8, { tono: 5 });                         // el «?» que nadie llena
    sfx("whoosh1", C.ha + 0.2, -11, { ancla: "pico" });                // la gota regresa a ti
  }
  return { C, S };
}
