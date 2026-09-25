/* PLATE FIELD — the volumetric hero.
   WebGL2, zero libraries, one attributeless triangle. Falls back silently to
   the existing canvas-2D starfield if anything at all goes wrong: no WebGL2,
   context loss twice, reduced motion, or a frame-time governor trip.

   Nothing on the page depends on this running. The 2D canvas stays in the DOM
   and stays visible until this reports a successful first frame. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  var host = document.getElementById("galaxy-canvas");
  if (!host || !host.parentNode) return;

  var canvas = document.createElement("canvas");
  canvas.id = "plate-field";
  canvas.setAttribute("aria-hidden", "true");
  host.parentNode.insertBefore(canvas, host);

  // powerPreference: 'default', never 'high-performance' — the latter can force
  // the discrete GPU on older Intel MacBooks, which is a battery disaster for
  // something purely decorative.
  var gl = canvas.getContext("webgl2", {
    alpha: true, premultipliedAlpha: false, antialias: false,
    depth: false, stencil: false, powerPreference: "default"
  });
  if (!gl) { canvas.remove(); return; }
  if ("drawingBufferColorSpace" in gl) {
    try { gl.drawingBufferColorSpace = "display-p3"; } catch (e) { /* older impl */ }
  }

  var COARSE = window.matchMedia("(pointer: coarse)").matches;
  var lowCore = (navigator.hardwareConcurrency || 8) <= 4;
  var tier = COARSE || lowCore ? 1 : 2;
  var dpr = Math.min(window.devicePixelRatio || 1, COARSE ? 1.25 : 1.5);

  var VERT = "#version 300 es\n" +
    "out vec2 vUv;\n" +
    "void main(){\n" +
    // (0,0) (2,0) (0,2) -> clip (-1,-1) (3,-1) (-1,3): one primitive, so there
    // is no diagonal seam where two quad-triangles would meet.
    "  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));\n" +
    "  vUv = p;\n" +
    "  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);\n" +
    "}\n";

  var FRAG = "#version 300 es\n" +
    "precision highp float;\n" +
    "in vec2 vUv;\n" +
    "out vec4 outColor;\n" +
    "uniform vec2  uRes;\n" +
    "uniform float uTime;\n" +
    "uniform int   uFrame;\n" +
    "uniform int   uSteps;\n" +
    "uniform int   uOct;\n" +
    "uniform vec2  uPointer;\n" +
    "uniform float uExposure;\n" +
    "uniform float uWarmth;\n" +

    // sin-free hash: sin-based hashes visibly break on some Adreno and Mali parts.
    "vec3 hash33(vec3 p){ p = fract(p*vec3(0.1031,0.1030,0.0973));\n" +
    "  p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx)*p.zyx); }\n" +

    "float vnoise(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);\n" +
    "  return mix(mix(mix(hash33(i).x,hash33(i+vec3(1,0,0)).x,f.x),\n" +
    "                 mix(hash33(i+vec3(0,1,0)).x,hash33(i+vec3(1,1,0)).x,f.x),f.y),\n" +
    "             mix(mix(hash33(i+vec3(0,0,1)).x,hash33(i+vec3(1,0,1)).x,f.x),\n" +
    "                 mix(hash33(i+vec3(0,1,1)).x,hash33(i+vec3(1,1,1)).x,f.x),f.y),f.z); }\n" +

    // iq's rotation: decorrelates octaves so the FBM has no axis-aligned grid smell.
    "const mat3 M = mat3(0.00,0.80,0.60, -0.80,0.36,-0.48, -0.60,-0.48,0.64);\n" +
    "float fbm(vec3 p,int oct){ float a=0.5,s=0.0;\n" +
    "  for(int i=0;i<6;i++){ if(i>=oct) break; s+=a*vnoise(p); p=M*p*2.03; a*=0.5; } return s; }\n" +

    "float density(vec3 p,float t,int oct){\n" +
    // domain warp -> filaments rather than blobs
    "  vec3 q = p + 0.55*vec3(fbm(p+vec3(0,0,t*0.015),3), fbm(p+5.2,3), fbm(p+9.1,3));\n" +
    "  float d = fbm(q*1.15,oct) - 0.42;\n" +
    "  d *= smoothstep(2.6,0.7,length(p.xy));\n" +
    "  return max(d,0.0)*1.8; }\n" +

    // Jimenez interleaved gradient noise + golden-ratio temporal rotation:
    // turns raymarch banding into film grain. 40 jittered steps look like ~75.
    "float ign(vec2 p){ return fract(52.9829189*fract(dot(p,vec2(0.06711056,0.00583715)))); }\n" +

    // magma, the colormap in his own TNG figures
    "vec3 magma(float t){\n" +
    "  vec3 c0=vec3(0.002,0.002,0.014), c1=vec3(0.114,0.067,0.278);\n" +
    "  vec3 c2=vec3(0.318,0.071,0.486), c3=vec3(0.716,0.215,0.475);\n" +
    "  vec3 c4=vec3(0.906,0.320,0.388), c5=vec3(0.988,0.537,0.380);\n" +
    "  vec3 c6=vec3(0.996,0.769,0.533), c7=vec3(0.988,0.992,0.749);\n" +
    "  t=clamp(t,0.0,1.0)*7.0; float f=fract(t); int i=int(t);\n" +
    "  if(i==0) return mix(c0,c1,f); if(i==1) return mix(c1,c2,f);\n" +
    "  if(i==2) return mix(c2,c3,f); if(i==3) return mix(c3,c4,f);\n" +
    "  if(i==4) return mix(c4,c5,f); if(i==5) return mix(c5,c6,f);\n" +
    "  return mix(c6,c7,f); }\n" +

    // Hubble HOO narrowband false colour, not the generic Shadertoy
    // cyan-violet-magenta ramp a faculty reader has seen a hundred times.
    "const vec3 OIII_TEAL = vec3(0.243,0.769,0.741);\n" +
    "const vec3 HA_ROSE   = vec3(0.886,0.404,0.486);\n" +

    "vec3 nebula(vec3 ro, vec3 rd, float time, int steps, int oct){\n" +
    "  float dt = 2.6/float(steps);\n" +
    "  float t  = 0.30 + ign(gl_FragCoord.xy + 5.588238*float(uFrame % 64))*dt;\n" +
    "  float tau = 0.0; vec3 col = vec3(0.0);\n" +
    // constant loop bound + `if break`: a uniform bound fails to compile on
    // some older drivers.
    "  for (int i=0;i<64;i++){ if(i>=steps) break;\n" +
    "    vec3 pos = ro + rd*t;\n" +
    "    float d = density(pos,time,oct);\n" +
    "    if (d > 0.002){\n" +
    "      vec3 emis = mix(OIII_TEAL, HA_ROSE, smoothstep(0.0,0.7,d));\n" +
    "      emis = mix(emis, magma(clamp(d*0.62,0.0,1.0)), uWarmth*smoothstep(0.55,1.4,d));\n" +
    "      col += emis * d * dt * exp(-tau);\n" +   // dust in front extinguishes
    "      tau += d * dt * 0.85;\n" +
    "    }\n" +
    "    t += dt; if (tau > 4.0) break;\n" +        // early-out once opaque
    "  }\n" +
    "  return col; }\n" +

    "void main(){\n" +
    "  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;\n" +
    // guide-star lens: a gentle deflection toward the pointer, the only thing
    // here that reacts to input.
    "  vec2 dl = uv - uPointer;\n" +
    "  float r2 = dot(dl,dl) + 0.06;\n" +
    "  uv -= dl * (0.018 / r2);\n" +
    "  vec3 ro = vec3(0.0,0.0,-2.2);\n" +
    "  vec3 rd = normalize(vec3(uv, 1.25));\n" +
    "  vec3 c  = nebula(ro, rd, uTime, uSteps, uOct);\n" +
    // Beer-Lambert accumulation is UNBOUNDED: without tonemapping, dense
    // regions clip to white and destroy body-text contrast over the hero.
    "  c = (1.0 - exp(-c * uExposure)) * 0.52;\n" +
    // 8x8 ordered dither — the second half of the banding fix, with the grain layer.
    "  float dith = ign(gl_FragCoord.xy) / 255.0;\n" +
    "  outColor = vec4(c + dith, clamp(max(max(c.r,c.g),c.b)*2.6, 0.0, 0.92));\n" +
    "}\n";

  function compile(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      if (window.console) console.warn("plate-field:", gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  }

  var prog = null;
  function build() {
    var vs = compile(gl.VERTEX_SHADER, VERT);
    var fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;
    var p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      if (window.console) console.warn("plate-field:", gl.getProgramInfoLog(p));
      return false;
    }
    prog = p;
    return true;
  }
  if (!build()) { canvas.remove(); return; }

  var U = {};
  ["uRes","uTime","uFrame","uSteps","uOct","uPointer","uExposure","uWarmth"]
    .forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

  var MAXPX = COARSE ? 0.50e6 : 1.60e6;
  function resize() {
    var cw = window.innerWidth, ch = window.innerHeight;
    if (cw < 1 || ch < 1) return;
    var want = cw * ch * dpr * dpr;
    // 0.72x render-and-upscale is invisible on a soft nebula and needs no FBO.
    var s = Math.min(0.72, Math.sqrt(MAXPX / want));
    canvas.width = Math.max(1, Math.round(cw * dpr * s));
    canvas.height = Math.max(1, Math.round(ch * dpr * s));
    canvas.style.width = cw + "px";
    canvas.style.height = ch + "px";
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  // A window-resize listener alone cannot save you: a 0x0 init in a background
  // tab, a bfcache restore or a display:none ancestor never fires one, and the
  // canvas stays black forever with no error.
  if ("ResizeObserver" in window) {
    new ResizeObserver(resize).observe(document.documentElement);
  }
  window.addEventListener("resize", resize, { passive: true });
  resize();

  var pointer = { x: 0, y: 0 };
  window.addEventListener("pointermove", function (e) {
    pointer.x = (e.clientX / window.innerWidth - 0.5) * 1.1;
    pointer.y = -(e.clientY / window.innerHeight - 0.5) * 1.1;
  }, { passive: true });

  var STEPS = { 2: 40, 1: 28 };
  var OCT = { 2: 4, 1: 3 };
  var running = true, frame = 0, rafId = 0, started = 0;
  var times = [], governed = false;
  var firstFrameDone = false;

  function render(now) {
    rafId = 0;
    if (!running) return;
    if (!started) started = now;
    var t0 = now;

    gl.useProgram(prog);
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uTime, (now - started) * 0.001);
    gl.uniform1i(U.uFrame, frame);
    gl.uniform1i(U.uSteps, STEPS[tier]);
    gl.uniform1i(U.uOct, OCT[tier]);
    gl.uniform2f(U.uPointer, pointer.x, pointer.y);
    gl.uniform1f(U.uExposure, 2.6);
    gl.uniform1f(U.uWarmth, 0.62);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, 3);   // no buffers, no attributes

    frame++;

    if (!firstFrameDone) {
      firstFrameDone = true;
      document.documentElement.classList.add("gl-ready");
    }

    // One-way frame-time governor. After a 2s warmup, if the median frame
    // exceeds ~22ms, drop one tier permanently for this session — silent, and
    // it cannot oscillate.
    if (!governed && now - started > 2000) {
      times.push(performance.now() - t0);
      if (times.length >= 40) {
        times.sort(function (a, b) { return a - b; });
        var med = times[times.length >> 1];
        if (med > 22) {
          if (tier > 1) { tier = 1; }
          else { stop(); document.documentElement.classList.remove("gl-ready"); }
        }
        governed = true;
        times = [];
      }
    }
    rafId = window.requestAnimationFrame(render);
  }

  function start() {
    if (!running || rafId) return;
    rafId = window.requestAnimationFrame(render);
  }
  function stop() {
    running = false;
    if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; }
  }

  // rAF throttles in background tabs but does not always stop.
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; } }
    else if (running) { started = 0; start(); }
  });

  // Stop entirely once the hero has scrolled away.
  if ("IntersectionObserver" in window) {
    var hero = document.querySelector(".hero") || document.body;
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { if (running) start(); }
        else if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; }
      });
    }, { rootMargin: "120px" }).observe(hero);
  }

  var losses = 0;
  canvas.addEventListener("webglcontextlost", function (e) {
    // Without preventDefault the context is never restorable.
    e.preventDefault();
    losses++;
    if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; }
    document.documentElement.classList.remove("gl-ready");
    if (losses >= 2) { running = false; canvas.remove(); }
  }, false);

  canvas.addEventListener("webglcontextrestored", function () {
    if (losses >= 2) return;
    if (!build()) { canvas.remove(); return; }
    ["uRes","uTime","uFrame","uSteps","uOct","uPointer","uExposure","uWarmth"]
      .forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    resize();
    running = true; started = 0; start();
  }, false);

  // Reduced motion can be switched on mid-session.
  var rm = window.matchMedia("(prefers-reduced-motion: reduce)");
  var onRM = function (e) {
    if (e.matches) { stop(); document.documentElement.classList.remove("gl-ready"); }
  };
  if (typeof rm.addEventListener === "function") rm.addEventListener("change", onRM);
  else if (typeof rm.addListener === "function") rm.addListener(onRM);

  start();
})();
