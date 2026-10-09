/* PLATE FIELD — the volumetric hero.
   WebGL2, zero libraries, one attributeless triangle. Falls back silently to
   the existing canvas-2D starfield if anything at all goes wrong: no WebGL2,
   a shader that will not compile, context loss twice, reduced motion, or a
   frame-time governor trip.

   Nothing on the page depends on this running. The 2D canvas stays in the DOM
   and stays visible until this reports a successful first frame.

   Compositing: the canvas is OPAQUE (alpha: false) and is screened over the
   layers beneath it in CSS, exactly like the two backdrop canvases it sits
   between. Emission is additive light, so screen is the physically correct
   operator and — unlike source-over with a partial alpha — it can never
   subtract light from the star photograph underneath. */
(function () {
  "use strict";

  var rm = window.matchMedia("(prefers-reduced-motion: reduce)");
  // The page's own motion toggle counts as reduced motion. Checking only the
  // media query would leave the most expensive thing on the page running for a
  // reader who explicitly switched motion off.
  function motionOff() {
    return rm.matches || document.documentElement.classList.contains("motion-off");
  }
  if (motionOff()) return;

  var host = document.getElementById("galaxy-canvas");
  if (!host || !host.parentNode) return;

  var canvas = document.createElement("canvas");
  canvas.id = "plate-field";
  canvas.setAttribute("aria-hidden", "true");
  host.parentNode.insertBefore(canvas, host);

  // powerPreference: 'default', never 'high-performance' — the latter can force
  // the discrete GPU on older Intel MacBooks, which is a battery disaster for
  // something purely decorative.
  // alpha: false — see the compositing note above. With no alpha channel there
  // is no premultiply question, no blend-func to get wrong, and no way for this
  // layer to darken its backdrop.
  var gl = canvas.getContext("webgl2", {
    alpha: false, antialias: false,
    depth: false, stencil: false, powerPreference: "default"
  });
  if (!gl) { canvas.remove(); return; }
  // Deliberately NOT setting drawingBufferColorSpace to display-p3: the rest of
  // the page is authored in sRGB oklch(), and reinterpreting these sRGB
  // constants as P3 primaries would shift every hue away from --h-cyan.

  var COARSE = window.matchMedia("(pointer: coarse)").matches;
  var lowCore = (navigator.hardwareConcurrency || 8) <= 4;
  var tier = COARSE || lowCore ? 1 : 2;
  var dpr = Math.min(window.devicePixelRatio || 1, COARSE ? 1.25 : 1.5);

  var VERT = "#version 300 es\n" +
    "void main(){\n" +
    // (0,0) (2,0) (0,2) -> clip (-1,-1) (3,-1) (-1,3): one primitive, so there
    // is no diagonal seam where two quad-triangles would meet. The fragment
    // stage reads gl_FragCoord, so no varying is needed.
    "  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));\n" +
    "  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);\n" +
    "}\n";

  var FRAG = "#version 300 es\n" +
    "precision highp float;\n" +
    // GLSL ES 3.00 defaults fragment `int` to mediump = ±2^15 guaranteed. At
    // 60fps a mediump uFrame overflows in ~9 minutes and the temporal dither
    // rotation dies, bringing raymarch banding back — on exactly the Adreno and
    // Mali parts that honour mediump literally. Desktop drivers hide this.
    "precision highp int;\n" +
    "out vec4 outColor;\n" +
    "uniform vec2  uRes;\n" +
    "uniform float uTime;\n" +
    "uniform int   uFrame;\n" +
    "uniform int   uSteps;\n" +
    "uniform int   uOct;\n" +
    "uniform vec2  uPointer;\n" +
    "uniform float uExposure;\n" +
    "uniform float uWarmth;\n" +
    // The scroll camera. See the JS side for why these arrive as uniforms
    // rather than being baked in.
    "uniform float uZoom;\n" +
    "uniform float uDepth;\n" +
    "uniform float uTrail;\n" +

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
    // NORMALISED sum. Without the 1/(1-2^-oct) the FBM range depends on the
    // octave count, so a governor tier drop would not just coarsen the field,
    // it would visibly thin it against the fixed 0.42 threshold below.
    "float fbm(vec3 p,int oct){ float a=0.5,s=0.0,n=0.0;\n" +
    "  for(int i=0;i<6;i++){ if(i>=oct) break; s+=a*vnoise(p); n+=a; p=M*p*2.03; a*=0.5; }\n" +
    "  return n > 0.0 ? s/n : 0.0; }\n" +

    "float density(vec3 p,float t,int oct){\n" +
    // domain warp -> filaments rather than blobs
    // fbm is now normalised, so these constants live on a fixed [0,1] scale and
    // a governor tier drop no longer thins the nebula (it did: -13% mean
    // brightness and -32% on the darkest pixels, purely from the range shift).
    //
    // The 0.63 threshold is the number that makes this a nebula instead of a
    // wash. At the old 0.448, 85% of every ray's steps emitted and the frame
    // had NO dark sky at all -- measured, not guessed: the darkest pixel in a
    // 256,000-pixel readback was 32/255 and the mean was 65/255. Screened over
    // the star photograph that lifted the entire viewport and flattened the
    // stars into haze. At 0.63 with the emission scaled back up by 3.2 to keep
    // the same peak density, 26% of the frame is true black sky, the 95th
    // percentile is 76/255 and the mean is 28/255. Filaments, and space between
    // them.
    "  vec3 q = p + 0.5156*vec3(fbm(p+vec3(0,0,t*0.015),3), fbm(p+5.2,3), fbm(p+9.1,3));\n" +
    "  float d = fbm(q*1.15,oct) - 0.63;\n" +
    "  d *= smoothstep(2.6,0.7,length(p.xy));\n" +
    "  return max(d,0.0)*3.2; }\n" +

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
    // i>=6, not the bare fallthrough: at t == 1.0 exactly, int(7.0) == 7 and
    // fract(7.0) == 0, which would return c6 and put a 57-byte discontinuity at
    // the top of the ramp.
    "  return mix(c6,c7,min(f + float(i - 6),1.0)); }\n" +

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
    // The trail. Successive samples along the ray are sheared along y, so a
    // fast scroll smears the field in the direction of travel and a stopped
    // one does not. It is a shear on an existing loop rather than a second
    // pass, so it costs one multiply-add per step and nothing else.
    "    pos.y += uTrail * float(i) * 0.016;\n" +
    "    float d = density(pos,time,oct);\n" +
    "    if (d > 0.002){\n" +
    "      vec3 emis = mix(OIII_TEAL, HA_ROSE, smoothstep(0.0,0.7,d));\n" +
    // d*1.9, not d*0.62: at 0.62 the input never exceeded 0.43 across the whole
    // frame, so c5/c6/c7 — the bright top of magma — were unreachable and we
    // were paying for eight control points to use four of them.
    // Both numbers were wrong against the real density distribution, which tops
    // out near 0.70, not 1.4: the old magma input never exceeded 0.43 (so the
    // top three control points were unreachable) and the old smoothstep gate
    // gave magma a peak weight of 0.049 — the colormap was paid for and never
    // seen. Rescaled to the measured range.
    "      emis = mix(emis, magma(clamp(d*1.45,0.0,1.0)), uWarmth*smoothstep(0.30,0.66,d));\n" +
    "      col += emis * d * dt * exp(-tau);\n" +   // dust in front extinguishes
    "      tau += d * dt * 0.85;\n" +
    "    }\n" +
    // No tau early-out: measured max tau over a full frame is 0.88, so a
    // `tau > 4.0` break was unreachable dead code pretending to be an
    // optimisation. Every ray runs all `steps` steps, by design.
    "    t += dt;\n" +
    "  }\n" +
    "  return col; }\n" +

    "void main(){\n" +
    "  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;\n" +
    // guide-star lens: a gentle deflection toward the pointer, the only thing
    // here that reacts to input.
    "  vec2 dl = uv - uPointer;\n" +
    "  float r2 = dot(dl,dl) + 0.06;\n" +
    "  uv -= dl * (0.018 / r2);\n" +
    "  vec3 ro = vec3(0.0,0.0,-2.2 + uDepth);\n" +
    "  vec3 rd = normalize(vec3(uv / uZoom, 1.25));\n" +
    "  vec3 c  = nebula(ro, rd, uTime, uSteps, uOct);\n" +
    // Beer-Lambert accumulation is UNBOUNDED: without tonemapping, dense
    // regions clip to white and destroy body-text contrast over the hero.
    "  c = (1.0 - exp(-c * uExposure)) * 0.52;\n" +
    // Interleaved gradient noise at one 8-bit level — the second half of the
    // banding fix, with the grain layer. Not an ordered/Bayer dither.
    "  float dith = ign(gl_FragCoord.xy) / 255.0;\n" +
    // Opaque. Screened in CSS, so black is transparent and light only ever adds.
    "  outColor = vec4(c + dith, 1.0);\n" +
    "}\n";

  function compile(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      if (window.console) console.warn("plate-field:", gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  var UNIFORMS =
    ["uRes","uTime","uFrame","uSteps","uOct","uPointer","uExposure","uWarmth",
     "uZoom","uDepth","uTrail"];
  var prog = null, U = {};
  function build() {
    var vs = compile(gl.VERTEX_SHADER, VERT);
    var fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { if (vs) gl.deleteShader(vs); if (fs) gl.deleteShader(fs); return false; }
    var p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    // Detach and delete regardless: the program keeps its own reference until
    // it is itself deleted, so this is the standard no-leak sequence.
    gl.detachShader(p, vs); gl.detachShader(p, fs);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      if (window.console) console.warn("plate-field:", gl.getProgramInfoLog(p));
      gl.deleteProgram(p);
      return false;
    }
    if (prog) gl.deleteProgram(prog);
    prog = p;
    U = {};
    UNIFORMS.forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    return true;
  }
  if (!build()) { canvas.remove(); return; }

  var MAXPX = COARSE ? 0.50e6 : 1.60e6;
  var lastW = 0, lastH = 0;
  function resize() {
    var cw = window.innerWidth, ch = window.innerHeight;
    if (cw < 1 || ch < 1) return;
    // iOS Safari changes innerHeight as the URL bar collapses DURING a scroll.
    // Without this equality gate that reallocates the whole drawing buffer
    // mid-gesture, which is the one thing guaranteed to drop frames.
    if (cw === lastW && ch === lastH) return;
    lastW = cw; lastH = ch;
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
  var ro = null;
  if ("ResizeObserver" in window) {
    ro = new ResizeObserver(resize);
    ro.observe(document.documentElement);
  }
  window.addEventListener("resize", resize, { passive: true });
  resize();

  var pointer = { x: 0, y: 0 };
  function onPointer(e) {
    pointer.x = (e.clientX / window.innerWidth - 0.5) * 1.1;
    pointer.y = -(e.clientY / window.innerHeight - 0.5) * 1.1;
  }
  window.addEventListener("pointermove", onPointer, { passive: true });

  var STEPS = { 2: 40, 1: 28 };
  var OCT = { 2: 4, 1: 3 };

  // Three independent reasons the loop may not be running, kept as three flags.
  // Collapsing them is how an IntersectionObserver pause gets silently undone
  // by a tab switch: `running` means "not disabled", `visible` means "the hero
  // is on screen", `shown` means "the tab is foreground". start() needs all
  // three, and every resume path re-checks all three instead of just one.
  var running = true, visible = true, shown = !document.hidden;
  var dead = false;
  var frame = 0, rafId = 0, prevNow = 0, elapsed = 0, warmMs = 1200;
  var times = [], governed = false;
  var firstFrameDone = false;
  var WINDOW = 20, TRIP_MS = 28;

  function render(now) {
    rafId = 0;
    if (!running || !visible || !shown) return;
    // Accumulate a CLAMPED delta rather than (now - started). uTime then never
    // jumps across a pause, a tab switch or a context restore — the filaments
    // are exactly where the reader left them — and a long hide cannot warp the
    // field forward by five minutes either.
    elapsed += prevNow ? Math.min(now - prevNow, 50) : 16.7;

    gl.useProgram(prog);
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uTime, elapsed * 0.001);
    gl.uniform1i(U.uFrame, frame % 64);
    gl.uniform1i(U.uSteps, STEPS[tier]);
    gl.uniform1i(U.uOct, OCT[tier]);
    gl.uniform2f(U.uPointer, pointer.x, pointer.y);
    // THE SCROLL CAMERA, read here and nowhere else.
    //
    // choreography.js builds a plain `cam` object, tweens it from its scroll
    // timelines, and publishes it as window.__cam. Until now nothing read it:
    // the object was written every frame by three tweens and a getVelocity
    // callback, and this loop used hardcoded constants. The comment over there
    // claimed "both the scroll timelines and the GL render loop read" it, which
    // made a dead global look load-bearing and meant the velocity trail — the
    // one behaviour that makes the field feel like it has mass — did not exist.
    //
    // It is read defensively on every frame rather than captured once, because
    // choreography.js returns early with no camera at all when GSAP is blocked,
    // when the viewport is narrow, or when motion is switched off. Absent a
    // camera these are exactly the constants that shipped before.
    var cam = window.__cam;
    var camZoom = 1, camDepth = 0, camTrail = 0;
    var camExposure = 3.6, camWarmth = 0.62;
    if (cam) {
      camExposure = 3.6 * (typeof cam.exposure === "number" ? cam.exposure : 1);
      camWarmth = typeof cam.warmth === "number" ? cam.warmth : 0.62;
      camZoom = typeof cam.zoom === "number" ? Math.max(0.5, cam.zoom) : 1;
      // cam.depth runs to 1200 across the whole document, which is a page-scroll
      // number, not a scene-scale one. The field lives in roughly unit space and
      // the hero only occupies the first stretch of that range, so it is scaled
      // to a fraction of a unit and clamped.
      camDepth = Math.min(0.8, (cam.depth || 0) * 0.0006);
      camTrail = Math.min(1, Math.max(0, cam.trail || 0));
    }
    gl.uniform1f(U.uExposure, camExposure);
    gl.uniform1f(U.uWarmth, camWarmth);
    gl.uniform1f(U.uZoom, camZoom);
    gl.uniform1f(U.uDepth, camDepth);
    gl.uniform1f(U.uTrail, camTrail);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);   // no buffers, no attributes, no blending

    frame++;

    // Reveal only on a draw that actually landed. `drawArrays` on a lost
    // context silently no-ops, and adding gl-ready then would dim the 2D
    // starfield to 0.34 behind a blank canvas — a hero DARKER than having no
    // WebGL at all, which is the exact inversion the CSS is designed to avoid.
    if (!firstFrameDone && !gl.isContextLost()) {
      firstFrameDone = true;
      document.documentElement.classList.add("gl-ready");
    }

    // FRAME-TIME GOVERNOR.
    //
    // It measures the interval BETWEEN presented frames, not the duration of
    // this callback. Self-timing the callback measures nothing: the uniform
    // uploads and drawArrays return in ~0.00ms and all the GPU work is
    // asynchronous. Measured on a canvas doing 272ms of real GPU work per
    // frame, self-timing reported a 5.4ms median while the page rendered at
    // 4fps — blind to the only failure this exists to catch. now - prevNow
    // reported 240ms and trips correctly.
    //
    // Re-arms after a tier drop, so tier 2 -> tier 1 -> off is reachable. A
    // one-shot `governed` flag made the final give-up unreachable on any
    // machine that started at tier 2, i.e. every desktop.
    if (!governed && prevNow && elapsed > warmMs) {
      times.push(now - prevNow);
      if (times.length >= WINDOW) {
        var sorted = times.slice().sort(function (a, b) { return a - b; });
        var med = sorted[sorted.length >> 1];
        times.length = 0;
        if (med > TRIP_MS) {
          if (tier > 1) { tier = 1; warmMs = elapsed + 800; }
          else { governed = true; giveUp(); return; }
        }
      }
    }
    prevNow = now;
    rafId = window.requestAnimationFrame(render);
  }

  function start() {
    if (!running || !visible || !shown || dead || rafId) return;
    rafId = window.requestAnimationFrame(render);
  }
  function pause() {
    if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; }
    prevNow = 0;
    times.length = 0;
  }
  function hide() {
    document.documentElement.classList.remove("gl-ready");
    // MUST be reset, or a later context restore restarts the shader at full
    // cost behind a canvas pinned at opacity 0 — permanently invisible GPU burn,
    // strictly worse than not recovering at all.
    firstFrameDone = false;
  }
  function giveUp() {
    if (dead) return;
    dead = true;
    running = false;
    pause();
    hide();
    window.removeEventListener("resize", resize);
    window.removeEventListener("pointermove", onPointer);
    if (ro) { ro.disconnect(); ro = null; }
    if (io) { io.disconnect(); io = null; }
    if (prog) { gl.deleteProgram(prog); prog = null; }
    canvas.remove();
    // Removing the node does NOT free the drawing buffer; the closure still
    // holds gl. This is the only way to hand ~2MB of VRAM back.
    var ext = gl.getExtension("WEBGL_lose_context");
    if (ext) { try { ext.loseContext(); } catch (e) { /* already gone */ } }
  }

  // rAF throttles in background tabs but does not always stop.
  document.addEventListener("visibilitychange", function () {
    shown = !document.hidden;
    if (!shown) { pause(); return; }
    start();
  });

  // Stop entirely once the hero has scrolled away.
  var io = null;
  if ("IntersectionObserver" in window) {
    var heroEl = document.querySelector(".hero") || document.body;
    io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        visible = e.isIntersecting;
        if (visible) start(); else pause();
      });
    }, { rootMargin: "120px" });
    io.observe(heroEl);
  }

  var losses = 0;
  canvas.addEventListener("webglcontextlost", function (e) {
    if (dead) return;
    // Without preventDefault the context is never restorable.
    e.preventDefault();
    losses++;
    pause();
    hide();
    // Drop the handle without deleting: the program belonged to a context
    // generation that no longer exists, and gl.deleteProgram on it raises
    // INVALID_OPERATION ("object does not belong to this context") on the
    // rebuild. Observed in the console, not theorised.
    prog = null; U = {};
    if (losses >= 2) { giveUp(); }
  }, false);

  canvas.addEventListener("webglcontextrestored", function () {
    if (dead || losses >= 2) return;
    // Reduced motion may have been switched on while the context was gone.
    if (motionOff()) { giveUp(); return; }
    if (!build()) { giveUp(); return; }
    lastW = lastH = 0;
    resize();
    running = true;
    start();
  }, false);

  // Reduced motion can be switched on mid-session. One-way on purpose: someone
  // who asked for less motion does not want it to come back by itself.
  var onRM = function (e) { if (e.matches) giveUp(); };
  if (typeof rm.addEventListener === "function") rm.addEventListener("change", onRM);
  else if (typeof rm.addListener === "function") rm.addListener(onRM);

  start();
})();
