// Guion v2 (aprobado el 8-oct-2026): un cuerpo común y dos cierres. ~1:30 por versión.
// Base: el guion de captación de Alejandro (sesiones/00-antes-del-curso/video-captacion/guion.md),
// con la línea de «Soy Alejandro» en tercera persona y las cifras de la página (+40 empresas).
// La voz se graba en UNA sola toma que lee cuerpo → cierre A → cierre B (sin costuras de tono).
// Sin DOM: lo usan las composiciones y los scripts de Node.

export const SECCIONES = {
  cuerpo: [
    "Todo mundo habla de inteligencia artificial.",
    "Pero casi nadie te dice qué hacer con ella en tu empresa.",
    "Te presento el nuevo bucle tecnológico: cada semana sale una herramienta nueva, tu equipo intenta usarla a su manera, o ni eso, y cuando sienten que ya avanzaron… sale otra.",
    "La realidad es que solo 6 de cada 100 empresas realmente le están sacando provecho a la IA.",
    "Y es normal sentir que vas tarde: nadie te ha explicado cómo implementarla en tu negocio.",
    "Mientras tanto, tu equipo sigue haciendo reportes a mano, haciendo las mismas talachas repetitivas diariamente y aun así cada decisión… termina otra vez en tu escritorio.",
    "Entonces, sé honesto: ¿cuánto de tu empresa todavía depende de ti?",
    "Porque no te falta otra herramienta.",
    "Te falta un método.",
  ],
  platica: [
    "Por eso creamos esta plática gratuita y en vivo para dueños y directivos.",
    "Te contamos qué está pasando con la IA, qué hacen las empresas que sí la aprovechan, y cómo salir del bucle: todo en un mismo lugar, con Claude y un mismo método, para que tu equipo resuelva sin tener que esperarte.",
    "Lo respaldan VADAI y Total Coach, con más de cuarenta empresas mexicanas capacitadas.",
    "Porque todo mundo te va a seguir hablando de inteligencia artificial.",
    "Nosotros te enseñamos qué hacer con ella.",
    "Dale clic aquí abajo y aparta tu lugar.",
    "Esto es gratis.",
    "Lo caro es que sigan haciendo las cosas a mano.",
  ],
  curso: [
    "Por eso creamos Claude en tu Empresa: tu equipo aprende a usar la inteligencia artificial dentro del Excel, el Word y el correo que ya usa.",
    "Sin cambiar de programas, sin saber de tecnología y sin contratar a nadie nuevo.",
    "Todo en un mismo lugar, con un mismo método, para que tu equipo resuelva sin tener que esperarte.",
    "Lo respaldan VADAI y Total Coach, con más de cuarenta empresas mexicanas capacitadas.",
    "Porque todo mundo te va a seguir hablando de inteligencia artificial.",
    "Nosotros te enseñamos qué hacer con ella.",
    "Dale clic aquí abajo y capacita a tu equipo.",
    "Lo caro es que sigan haciendo las cosas a mano.",
  ],
};
export const ORDEN_TOMA = ["cuerpo", "platica", "curso"];
export const palabrasDe = (seccion) => SECCIONES[seccion].join(" ").split(/\s+/);

// Normalización para comparar con whisper: cifras, la marca y nombres que transcribe distinto.
const NUM = { 6: "seis", 100: "cien", 40: "cuarenta", 50: "cincuenta" };
const ALIAS = { cloud: "claude", clod: "claude", claud: "claude", baddai: "vadai", badai: "vadai", badday: "vadai", vaday: "vadai", ia: "ia" };
export const clave = (w) => {
  const x = w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ]/g, "");
  return NUM[x] || ALIAS[x] || x;
};
