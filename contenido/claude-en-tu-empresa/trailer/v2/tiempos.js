// v2 · reloj de palabras por versión. Las anclas se buscan DENTRO de su frase (ERRORES: en la v1,
// «EL» de «EL ARCHIVO» se ancló al primer «el» del guion y salió 3 s antes, encimado).
//   const T = await tiempos("platica");  T.f(3)            → {inicio, fin} de la frase 3
//   T.w(3, "seis")  → inicio de esa palabra dentro de la frase 3 (n = qué aparición en la frase)
import { SECCIONES, clave } from "./guion.js";

export const DURACION = 94.0;           // voz 90.7 s (Camila, toma G) + tarjeta final; la canción acaba en 93.55
export const MUSICA_RETRASO = 0;        // n5-editada.wav ya trae el desfase: su compás 23 cae en «método» (51.95 s)
export const BPM = 99.81, PULSO = 60 / 99.81, COMPAS = 4 * 60 / 99.81;
export const GOLPE = 51.949;            // primer tiempo fuerte de la sección grande (compás 23 de n5), en tiempo de video
export const beat = (t) => +(GOLPE + Math.round((t - GOLPE) / PULSO) * PULSO).toFixed(3);

export async function tiempos(version) {
  const { PALABRAS } = await import(`./vo-${version}.js`);
  const frases = [...SECCIONES.cuerpo, ...SECCIONES[version]];
  const porFrase = [];
  let k = 0;
  for (const f of frases) { const n = f.split(/\s+/).length; porFrase.push(PALABRAS.slice(k, k + n)); k += n; }
  if (k !== PALABRAS.length) throw new Error(`tiempos(${version}): ${PALABRAS.length} palabras de voz contra ${k} del guion`);
  const CUERPO = SECCIONES.cuerpo.length;
  return {
    version, frases, porFrase, CUERPO,
    f: (i) => ({ inicio: porFrase[i][0].start, fin: porFrase[i].at(-1).end }),
    w(i, texto, n = 1) {
      const c = clave(texto); let m = 0;
      for (const p of porFrase[i]) if (clave(p.text) === c && ++m === n) return p.start;
      throw new Error(`tiempos: «${texto}» (#${n}) no está en la frase ${i}: «${frases[i]}»`);
    },
    wFin(i, texto, n = 1) {
      const c = clave(texto); let m = 0;
      for (const p of porFrase[i]) if (clave(p.text) === c && ++m === n) return p.end;
      throw new Error(`tiempos: «${texto}» (#${n}) no está en la frase ${i}`);
    },
  };
}
