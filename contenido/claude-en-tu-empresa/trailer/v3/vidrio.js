// v3 · «La interfaz viva»: aurora (gradient mesh) + vidrio líquido de cualquier forma, en WebGL2.
// Las formas de vidrio se dibujan cada cuadro como máscara (canvas 2D a media resolución: la gota con la
// forma exacta de la chispa de Claude, MÉTODO, el ∞, ventanas…); dos pasadas de desenfoque dan su
// «altura», su gradiente es la normal, y la aurora se refracta a través de ellas con brillo especular.
// Sin estado: todo sale de t (redondeado al cuadro: determinismo entre workers).
export function crearVidrio(canvas, W, H, { escala = 1 } = {}) {
  const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
  if (!gl) throw new Error("vidrio: sin WebGL2");
  const w = Math.round(W * escala), h = Math.round(H * escala);
  const mascara = document.createElement("canvas"); mascara.width = w; mascara.height = h;
  const m2d = mascara.getContext("2d");

  const VS = `#version 300 es
  in vec2 p; out vec2 uv; void main(){ uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0., 1.); }`;
  const BLUR = `#version 300 es
  precision highp float; in vec2 uv; out vec4 o; uniform sampler2D tx; uniform vec2 dir;
  void main(){ float s = 0.; float k[9] = float[](0.028,0.067,0.124,0.179,0.204,0.179,0.124,0.067,0.028);
    for (int i = 0; i < 9; i++) s += texture(tx, uv + dir * float(i - 4)).r * k[i]; o = vec4(s, s, s, 1.); }`;
  const FINAL = `#version 300 es
  precision highp float; in vec2 uv; out vec4 o;
  uniform sampler2D masc, alto; uniform float t, grano, luz; uniform vec2 res, px;
  uniform vec3 c0, c1, c2, c3, c4, c5; uniform vec4 p1, p2, p3, p4;   // aurora: colores y focos (xy, radio, fuerza)
  uniform float tinte, realce; uniform vec3 colorVidrio;
  vec3 aurora(vec2 q){
    vec3 c = c0;
    vec4 P[4] = vec4[](p1, p2, p3, p4); vec3 K[4] = vec3[](c1, c2, c3, c4);
    for (int i = 0; i < 4; i++) { vec2 d = (q - P[i].xy) * vec2(res.x/res.y, 1.); c = mix(c, K[i], P[i].w * exp(-dot(d,d) / (P[i].z*P[i].z))); }
    float v = sin(q.x * 6.0 + t * 0.35 + sin(q.y * 4.0 - t * 0.27) * 1.6) * sin(q.y * 3.0 + t * 0.21);
    c = mix(c, c5, 0.10 * smoothstep(0.2, 1.0, v));                                  // velo que ondula
    return c;
  }
  void main(){
    vec2 q = vec2(uv.x, 1. - uv.y);
    float m = texture(masc, uv).r;
    float a = texture(alto, uv).r;
    vec3 c = aurora(q);
    if (m > 0.01) {
      vec2 g = vec2(texture(alto, uv + vec2(px.x, 0.)).r - texture(alto, uv - vec2(px.x, 0.)).r,
                    texture(alto, uv + vec2(0., px.y)).r - texture(alto, uv - vec2(0., px.y)).r);
      vec3 n = normalize(vec3(-g * 9., 1.));
      vec2 off = vec2(n.x, -n.y) * 0.075 * (1.0 - a * 0.55);                        // refracción (más en los cantos)
      vec3 r = vec3(aurora(q + off * 1.06).r, aurora(q + off).g, aurora(q + off * 0.94).b);   // dispersión cromática
      r = mix(r, colorVidrio, tinte) * (1.04 + 0.10 * a) + realce * (0.55 + 0.45 * a) * colorVidrio;   // el vidrio se lee más claro que el fondo
      vec3 L = normalize(vec3(-0.5, 0.7, 0.6));
      float spec = pow(max(dot(reflect(-L, n), vec3(0., 0., 1.)), 0.), 18.) * luz;
      float fres = pow(1. - n.z, 2.0);
      float borde = smoothstep(0.75, 0.05, a) * m;                                 // la línea de luz del canto
      vec3 vid = r + spec * 0.85 + fres * 0.22 + borde * 0.18;
      c = mix(c, vid, smoothstep(0.02, 0.5, m));
    } else {
      c *= 1. - 0.22 * smoothstep(0., 0.6, texture(alto, uv + vec2(-0.006, 0.010)).r);   // sombra suave del vidrio
    }
    float gr = fract(sin(dot(floor(q * res) + grano, vec2(12.9898, 78.233))) * 43758.5453);
    c += (gr - 0.5) * 0.03;
    o = vec4(c, 1.);
  }`;
  const prog = (fs) => {
    const sh = (tipo, src) => { const s = gl.createShader(tipo); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error("vidrio: " + gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("vidrio: " + gl.getProgramInfoLog(p));
    return p;
  };
  const pBlur = prog(BLUR), pFinal = prog(FINAL);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const atributo = (p) => { const l = gl.getAttribLocation(p, "p"); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0); };
  const textura = () => { const tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); return tx; };
  const tMasc = textura(), tA = textura(), tB = textura();
  const fbo = (tx) => { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tx, 0); return f; };
  const fA = fbo(tA), fB = fbo(tB);
  const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);

  return {
    mascara: m2d, w, h, escala,
    // aurora: { fondo, focos: [{ x, y, r, f, color }] ×4, velo } en coordenadas 0–1 de pantalla
    pintar(t, { aurora, desenfoque = 2.2, luz = 1, tinte = 0.12, realce = 0, colorVidrio = "#EAF4FA" }) {
      t = Math.round(t * 60) / 60;
      gl.bindTexture(gl.TEXTURE_2D, tMasc);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, mascara);
      gl.viewport(0, 0, w, h);
      gl.useProgram(pBlur); atributo(pBlur);
      const uD = gl.getUniformLocation(pBlur, "dir"), uT = gl.getUniformLocation(pBlur, "tx");
      let fuente = tMasc;
      for (let k = 0; k < 2; k++) {   // dos rondas H+V: altura suave y redonda
        gl.bindFramebuffer(gl.FRAMEBUFFER, fA); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fuente); gl.uniform1i(uT, 0); gl.uniform2f(uD, desenfoque / w, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fB); gl.bindTexture(gl.TEXTURE_2D, tA); gl.uniform2f(uD, 0, desenfoque / h); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        fuente = tB;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      gl.useProgram(pFinal); atributo(pFinal);
      const U = (n) => gl.getUniformLocation(pFinal, n);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tMasc); gl.uniform1i(U("masc"), 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tB); gl.uniform1i(U("alto"), 1);
      gl.uniform1f(U("t"), t); gl.uniform1f(U("grano"), Math.floor(t * 30) % 997); gl.uniform1f(U("luz"), luz);
      gl.uniform2f(U("res"), W, H); gl.uniform2f(U("px"), 1.5 / w, 1.5 / h);
      gl.uniform3fv(U("c0"), hex(aurora.fondo)); gl.uniform3fv(U("c5"), hex(aurora.velo));
      aurora.focos.forEach((f, i) => { gl.uniform3fv(U(`c${i + 1}`), hex(f.color)); gl.uniform4f(U(`p${i + 1}`), f.x, f.y, f.r, f.f); });
      gl.uniform1f(U("tinte"), tinte); gl.uniform1f(U("realce"), realce); gl.uniform3fv(U("colorVidrio"), hex(colorVidrio));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
  };
}
