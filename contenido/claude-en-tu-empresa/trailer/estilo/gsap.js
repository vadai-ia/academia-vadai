// Segundo script de toda composición, justo después de gsap.min.js.
// force3D:false → GSAP escribe transformaciones 2D y Chrome nunca promueve esos nodos a capa
// de composición. Una capa se rasteriza una vez y luego solo se desplaza, así que el suavizado
// del texto dependería de lo que ese worker pintó antes (0b, 7-oct-2026). Sin capas, cada cuadro
// se pinta completo y sale igual sin importar cuántos workers haya.
gsap.config({ force3D: false });
