// Primer script de toda composición: fija Math.random con semilla antes de que cargue
// cualquier librería. postprocessing (SSAO, ruido) y three generan texturas de ruido con
// Math.random al construirse; sin esto, dos renders del mismo cuadro difieren en el moteado.
(function () {
  let a = 20261007 >>> 0;
  Math.random = function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();
