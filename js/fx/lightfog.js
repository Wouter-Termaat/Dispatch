// Dispatch light + smoke layer (one WebGL pass, rendered at half resolution, blended with mix-blend-mode: screen).
// Smoke = domain-warped fBm noise that flows slowly sideways: coherent, never random particles.
// The smoke is only really visible where light hits it (beams and light pools), which gives the beams depth.
//
// const fx = createLightFog(canvas, {
//   fogH: .42,              // fog band height (0..1 from the bottom)
//   fog: 1,                 // fog density multiplier
//   beams: [{ x, y, a, w, i, sway, speed }],  // origin x/y (0..1, y=0 is bottom), angle a in rad (0 = straight up, PI = straight down), half-width w (rad), intensity i
//   pool: [x, y], poolI,    // warm light pool, flickers like a candle (door glow)
//   pool2: [x, y], pool2I,  // second, steady pool
// });
// fx.set({ beams: [...] })  // change on the fly (e.g. brighten the beam on the chosen card)
// Respect prefers-reduced-motion: renders one still frame.

const FRAG = `precision mediump float;
uniform vec2 res;uniform float t;uniform float fogH;uniform float fogAmt;uniform vec3 tint;uniform vec3 haze;
uniform vec4 beams[4];uniform float beamI[4];uniform int nb;uniform vec2 pool;uniform float poolI;uniform vec2 pool2;uniform float pool2I;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<5;i++){v+=a*n(p);p=m*p;a*=.5;}return v;}
void main(){vec2 uv=gl_FragCoord.xy/res;float asp=res.x/res.y;vec2 q=vec2(uv.x*asp,uv.y);
 vec2 dr=vec2(t*.022,-t*.004);
 vec2 w=vec2(fbm(q*1.4+dr),fbm(q*1.4-dr*.7+vec2(5.2,1.3)));
 float s=fbm(q*vec2(1.6,2.6)+w*1.6+dr*1.4);
 float band=smoothstep(fogH,0.,uv.y);
 float smoke=smoothstep(.38,.82,s)*band*fogAmt+smoothstep(.5,.9,s)*.10*fogAmt;
 float lit=0.;
 for(int i=0;i<4;i++){if(i>=nb)break;vec4 b=beams[i];vec2 o=vec2(b.x*asp,b.y);vec2 d=q-o;float ang=atan(d.x,d.y)-b.z;
  float c=smoothstep(b.w,b.w*.3,abs(ang))*smoothstep(0.,.18,length(d));lit+=c*beamI[i]*(.45+.55*smoothstep(1.6,0.,length(d)));}
 float p1=poolI*smoothstep(.6,0.,length((q-vec2(pool.x*asp,pool.y))*vec2(1.,2.2)));
 float p2=pool2I*smoothstep(.45,0.,length((q-vec2(pool2.x*asp,pool2.y))*vec2(1.,1.6)));
 float glow=lit*(.035+smoke*1.3)+(p1+p2)*(.10+smoke*1.1);
 vec3 col=haze*smoke*.35+tint*glow;gl_FragColor=vec4(col,clamp(max(col.r,max(col.g,col.b)),0.,1.));}`;

export function createLightFog(canvas, opts = {}) {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true, antialias: false });
  if (!gl) { canvas.style.display = 'none'; return { set() {}, stop() {}, o: opts }; }
  const sh = (ty, src) => { const s = gl.createShader(ty); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(pr); gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const L = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(L); gl.vertexAttribPointer(L, 2, gl.FLOAT, false, 0, 0);
  const U = x => gl.getUniformLocation(pr, x);
  const o = Object.assign({ fogH: .45, fog: 1, tint: [1, .75, .45], haze: [.5, .38, .6], beams: [], pool: [.5, 0], poolI: 0, pool2: [.5, .5], pool2I: 0, scale: .5 }, opts);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const t0 = performance.now(); let raf = 0, vis = true, stopped = false;
  function rs() { const r = canvas.getBoundingClientRect(); const k = Math.min(devicePixelRatio || 1, 2) * o.scale; canvas.width = Math.max(2, r.width * k | 0); canvas.height = Math.max(2, r.height * k | 0); gl.viewport(0, 0, canvas.width, canvas.height); }
  function fr(now) {
    const t = reduce ? 30 : (now - t0) / 1000;
    gl.uniform2f(U('res'), canvas.width, canvas.height); gl.uniform1f(U('t'), t); gl.uniform1f(U('fogH'), o.fogH); gl.uniform1f(U('fogAmt'), o.fog);
    gl.uniform3fv(U('tint'), o.tint); gl.uniform3fv(U('haze'), o.haze);
    const a = new Float32Array(16), bi = new Float32Array(4);
    o.beams.slice(0, 4).forEach((b, i) => { const sw = b.sway ? Math.sin(t * (b.speed || .12) + i * 1.9) * b.sway : 0; a.set([b.x, b.y, b.a + sw, b.w], i * 4); bi[i] = b.i; });
    gl.uniform4fv(U('beams'), a); gl.uniform1fv(U('beamI'), bi); gl.uniform1i(U('nb'), Math.min(4, o.beams.length));
    const fl = 1 + .08 * Math.sin(t * 7.3) * Math.sin(t * 2.1);
    gl.uniform2f(U('pool'), o.pool[0], o.pool[1]); gl.uniform1f(U('poolI'), o.poolI * fl); gl.uniform2f(U('pool2'), o.pool2[0], o.pool2[1]); gl.uniform1f(U('pool2I'), o.pool2I);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (!reduce && vis && !stopped) raf = requestAnimationFrame(fr);
  }
  const ro = new ResizeObserver(() => { rs(); if (reduce) fr(0); }); ro.observe(canvas); rs();
  const io = new IntersectionObserver(e => { const v = e[0].isIntersecting; if (v && !vis && !stopped) { vis = true; raf = requestAnimationFrame(fr); } else vis = v; }); io.observe(canvas);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimationFrame(raf); else if (vis && !stopped && !reduce) raf = requestAnimationFrame(fr); });
  raf = requestAnimationFrame(fr);
  return { o, set(p) { Object.assign(o, p); if (reduce) fr(0); }, stop() { stopped = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); } };
}
