/* Liquid navbar effect adapted from Nimbus UI Liquid Navbar (Waterline) by guglielmogiannattasio.it
 *
 * Plain-JS port (no React, no build step) of the floating glass pill nav used on phones and narrow screens.
 * The active "drop" is two spring bodies: a stiff lead (k 210, c 25) and a soft tail (k 72, c 13) that follows the
 * same target 70 ms later, so the drop stretches towards a new item and gathers up behind it, squashing vertically
 * with speed. Long jumps shed three small droplets that trail the body and merge back; a ripple ring spreads when
 * the drop settles; the pointer raises a small meniscus bump; slow ambient waves move the surface.
 * It is drawn by one small WebGL fragment shader on a canvas just bigger than the pill (smooth-unioned capsule SDFs,
 * a height field from lens shapes, waves, ripple and meniscus, normals by finite differences, two specular lights,
 * Fresnel iridescence, soft caustics, a contact shadow). Rendering pauses when the nav is hidden or the tab is in the
 * background. prefers-reduced-motion: no ambient motion, no droplets or ripples, instant moves. Without WebGL, or
 * after a lost context, a plain CSS drop (.ln-drop) takes over.
 */
(function () {
  "use strict";
  var nav = document.getElementById("liquid-nav");
  if (!nav) return;
  var pill = nav.querySelector(".ln-pill");
  var items = Array.prototype.slice.call(nav.querySelectorAll(".ln-item"));
  var canvas = nav.querySelector(".ln-canvas");
  var cssDrop = nav.querySelector(".ln-drop");
  if (!pill || !items.length) return;

  var M = 14;                      /* canvas margin around the pill (CSS px), matches .ln-canvas inset */
  var LEAD = {k: 210, c: 25}, TAIL = {k: 72, c: 13}, TAIL_DELAY = 0.07;
  var mqReduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : {matches: false};
  var root = document.documentElement;
  /* the OS setting or the site's own motion toggle (html.motion-off) */
  var reduced = function () { return mqReduce.matches || root.classList.contains("motion-off"); };
  /* software rasterisers (html[data-gpu=software], perf-tier.js): the page holds still, so no ambient waves either */
  var calm = function () { return reduced() || root.getAttribute("data-gpu") === "software"; };
  var now = function () { return performance.now() / 1000; };

  /* ------------------------------------------------------------------ state */
  var active = 0, lockUntil = 0, lockIdx = -1;
  var lead = {x: 0, v: 0}, tail = {x: 0, v: 0}, target = 0, prevTarget = 0, targetT = -1;
  var drops = [], split = false, ripple = null, moved = false, maxSpeed = 0;
  var cursor = {x: 0, y: 0, a: 0, ta: 0};
  var geo = {w: 0, h: 0, itemW: 0, centers: [], cy: 0, rad: 0};
  var gl = null, prog = null, U = {}, raf = 0, last = 0, visible = true, inView = true, lastAmbient = 0;
  var tint = {c: [1, 1, 1], a: 0.2, hi: [1, 1, 1], dark: 0};

  /* ------------------------------------------------------------------ geometry */
  /* one label size for all items, shrunk (to 80 % at most) until the longest translation fits */
  function fitLabels() {
    nav.style.removeProperty("--ln-fs");
    var k = 1;
    items.forEach(function (it) { var sp = it.querySelector("span"); if (sp && sp.scrollWidth > sp.clientWidth) k = Math.min(k, sp.clientWidth / sp.scrollWidth); });
    if (k < 1) nav.style.setProperty("--ln-fs", (Math.max(0.8, k * 0.98) * 10.5).toFixed(2) + "px");
  }
  function measure() {
    if (pill.offsetWidth) fitLabels();
    var pr = pill.getBoundingClientRect();
    geo.w = pr.width; geo.h = pr.height;
    geo.centers = items.map(function (it) { var r = it.getBoundingClientRect(); return r.left - pr.left + r.width / 2 + M; });
    geo.itemW = items[0].getBoundingClientRect().width;
    geo.cy = M + geo.h / 2;
    geo.rad = Math.max(8, geo.h / 2 - 6);
    if (gl) {
      var dpr = Math.min(window.devicePixelRatio || 1, 2), W = Math.round((geo.w + 2 * M) * dpr), H = Math.round((geo.h + 2 * M) * dpr);
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      gl.viewport(0, 0, W, H);
    }
    placeCssDrop(false);
  }

  /* ------------------------------------------------------------------ selection */
  function setActive(i, opts) {
    opts = opts || {};
    if (i < 0 || i >= items.length) return;
    var prev = active; active = i;
    items.forEach(function (it, k) {
      if (k === i) it.setAttribute("aria-current", "location"); else it.removeAttribute("aria-current");
      it.tabIndex = k === i ? 0 : -1;
    });
    if (!geo.centers.length) measure();
    var tx = geo.centers[i];
    if (opts.instant || reduced() || !targetT) {
      lead.x = tail.x = target = prevTarget = tx; lead.v = tail.v = 0; drops = []; split = false; ripple = null; moved = false;
    } else if (tx !== target) {
      prevTarget = target; target = tx; targetT = now(); moved = true; maxSpeed = 0;
      var dist = Math.abs(tx - lead.x);
      if (dist > 1.5 * geo.itemW) spawnDroplets();
      if (prev !== i) popIcon(items[i]);
    }
    placeCssDrop(!opts.instant);
    wake();
  }

  /* Long jumps: the neck between the bodies thins and breaks into three droplets strung along the gap, which shrink
     back into the drop as the tail catches up. */
  function spawnDroplets() { split = !reduced(); }
  function popIcon(it) {
    if (reduced()) return;
    var ic = it.querySelector(".ln-icon"); if (!ic) return;
    ic.classList.remove("ln-pop", "ln-hop"); void ic.offsetWidth;
    ic.classList.add(it.dataset.anim === "hop" ? "ln-hop" : "ln-pop");
  }

  /* CSS fallback drop: left/right edges with the same two springs sampled into linear() (see liquid-nav.css). */
  var cssCur = -1;
  function placeCssDrop(animate) {
    if (!cssDrop || !geo.centers.length) return;
    var l = geo.centers[active] - M - geo.itemW / 2, r = geo.w - (l + geo.itemW);
    if (animate && cssCur >= 0 && cssCur !== active) nav.dataset.dir = geo.centers[active] > geo.centers[cssCur] ? "r" : "l";
    nav.classList.toggle("ln-ready", !!animate || nav.classList.contains("ln-ready"));
    cssDrop.style.setProperty("--dl", l + "px"); cssDrop.style.setProperty("--dr", r + "px");
    cssCur = active;
  }

  /* ------------------------------------------------------------------ physics */
  function spring(b, to, s, dt) { b.v += (s.k * (to - b.x) - s.c * b.v) * dt; b.x += b.v * dt; }
  function step(dt) {
    var t = now(), tailTo = (t - targetT < TAIL_DELAY) ? prevTarget : target, n = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / n;
    for (var s = 0; s < n; s++) {
      spring(lead, target, LEAD, h); spring(tail, tailTo, TAIL, h);
    }
    maxSpeed = Math.max(maxSpeed, Math.abs(lead.v));
    var gap = Math.abs(lead.x - tail.x), w = geo.itemW, F = [0.27, 0.5, 0.73], R = [0.30, 0.38, 0.30];
    var g = split ? Math.min(1, Math.max(0, (gap - 0.9 * w) / (0.8 * w))) : 0;
    drops = g > 0.01 ? F.map(function (f, j) { return {x: tail.x + (lead.x - tail.x) * f, r: R[j] * geo.rad * Math.sqrt(g), phase: j * 2.1}; }) : [];
    if (split && gap < 2 && Math.abs(tail.v) < 30) split = false;
    if (moved && maxSpeed > 250 && Math.abs(target - lead.x) < 1.5 && Math.abs(lead.v) < 40 && !reduced()) {
      ripple = {x: target, t0: t}; moved = false;
    }
    if (ripple && t - ripple.t0 > 1.2) ripple = null;
    cursor.a += (cursor.ta - cursor.a) * Math.min(1, dt * 10);
  }
  function busy() {
    return Math.abs(target - lead.x) > 0.05 || Math.abs(lead.v) > 0.5 || Math.abs(target - tail.x) > 0.05 || Math.abs(tail.v) > 0.5 ||
      drops.length || split || ripple || Math.abs(cursor.a - cursor.ta) > 0.01;
  }

  /* ------------------------------------------------------------------ WebGL */
  var VERT = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
  var FRAG = [
    "precision mediump float;",
    "uniform vec2 uRes;uniform float uDpr;uniform vec4 uPill;",
    "uniform vec3 uLead;uniform vec3 uTail;uniform float uRad;uniform float uSq;uniform float uCy;",
    "uniform vec4 uDrop[3];uniform vec4 uRip;uniform vec3 uCur;uniform float uTime;uniform float uAmb;",
    "uniform vec3 uTint;uniform float uTintA;uniform vec3 uHi;uniform float uDark;",
    "float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}",
    "float cap(vec2 p,vec3 c){vec2 q=vec2(p.x,uCy+(p.y-uCy)/uSq);float hl=c.z;vec2 a=vec2(c.x-hl,uCy),b=vec2(c.x+hl,uCy);",
    "  vec2 pa=q-a,ba=b-a;float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-4),0.,1.);return (length(pa-ba*h)-uRad)*min(uSq,1.);}",
    "uniform float uNeck;",
    "float body(vec2 p){float d=smin(cap(p,uLead),cap(p,uTail),12.);",
    "  if(uNeck>.5){float x0=min(uLead.x,uTail.x),x1=max(uLead.x,uTail.x);vec2 q=vec2(p.x,uCy+(p.y-uCy)/uSq);float t=clamp((q.x-x0)/max(x1-x0,1.),0.,1.);",
    "    float r=uNeck*(.55+.45*pow(abs(2.*t-1.),2.));float e=length(vec2(q.x-clamp(q.x,x0,x1),q.y-uCy))-r;d=smin(d,e,10.);}",
    "  for(int i=0;i<3;i++){if(uDrop[i].z>.05){float e=length(p-uDrop[i].xy)-uDrop[i].z;d=smin(d,e,9.);}}return d;}",
    "float pillD(vec2 p){vec2 c=uPill.xy+uPill.zw*.5;float r=uPill.w*.5;vec2 q=abs(p-c)-(uPill.zw*.5-vec2(r));return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}",
    "float field(vec2 p,out float d){d=body(p);float ins=clamp(-d/uRad,0.,1.);float h=uRad*.8*sqrt(ins);",
    "  float w=sin(p.x*.085+uTime*1.25)*.6+sin(p.x*.047-p.y*.12-uTime*.85)*.4;h+=uAmb*w*smoothstep(0.,5.,-d);",
    "  if(uRip.w>0.){float rr=length(p-uRip.xy);h+=uRip.w*exp(-pow((rr-uRip.z)/5.,2.))*1.6;}",
    "  vec2 dc=p-uCur.xy;h+=uCur.z*3.5*exp(-dot(dc,dc)/392.);return h;}",
    "void main(){vec2 p=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y)/uDpr;",
    "  float pd=pillD(p);float inPill=1.-smoothstep(-.5,.5,pd);",
    "  float d,dx,dy;float h=field(p,d);float hx=field(p+vec2(1.,0.),dx)-field(p-vec2(1.,0.),dy);float hy=field(p+vec2(0.,1.),dx)-field(p-vec2(0.,1.),dy);",
    "  vec3 n=normalize(vec3(-hx*.5,-hy*.5,1.));",
    "  vec3 L1=normalize(vec3(-.45,-.8,.9)),L2=normalize(vec3(.6,.75,.55)),V=vec3(0.,0.,1.);",
    "  float s1=pow(max(dot(n,normalize(L1+V)),0.),48.)*(.62-.3*uDark),s2=pow(max(dot(n,normalize(L2+V)),0.),22.)*(.3-.12*uDark);",
    "  float fr=pow(1.-clamp(n.z,0.,1.),2.2);",
    "  vec3 ir=.5+.5*cos(6.2831*(vec3(0.,.33,.67)+fr*1.3+p.x*.0025+uTime*.03));",
    "  float cz=sin(p.x*.2+h*.55+uTime*1.1)*sin(p.y*.31-h*.45-uTime*.8);float cs=smoothstep(.55,1.,cz)*.14;",
    "  float aD=1.-smoothstep(-.8,.8,d);",
    "  float sh=(1.-smoothstep(-3.,8.,body(p-vec2(0.,3.))))*(1.-aD)*inPill*(.16+.14*uDark);",
    "  vec3 col=uTint*(.8+.2*n.z)+ir*fr*.55+uHi*(s1+s2)+uHi*cs;",
    "  float a=clamp(uTintA*(.7+.3*(1.-n.z))+fr*.35+(s1+s2)*.6+cs*.6,0.,1.)*aD;",
    "  float gs=(s1+s2)*inPill*(1.-aD)*.55;",          /* glass highlights where ripple / meniscus bend the glass */
    "  vec4 o=vec4(0.,0.,0.,sh);",
    "  o=vec4(uHi*gs,gs)+o*(1.-gs);",
    "  o=vec4(col*a,a)+o*(1.-a);",
    "  gl_FragColor=o*inPill+vec4(0.,0.,0.,sh)*(1.-inPill)*0.;}"
  ].join("\n");

  function initGL() {
    if (!canvas || nav.dataset.webgl === "off") return false;
    try { gl = canvas.getContext("webgl", {premultipliedAlpha: true, alpha: true, antialias: false, depth: false, stencil: false, powerPreference: "low-power"}); } catch (e) { gl = null; }
    if (!gl) return false;
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (e) { if (window.console) console.warn("liquid nav: shader failed, using the CSS drop", e); gl = null; return false; }
    gl.useProgram(prog);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "a"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ["uNeck", "uRes", "uDpr", "uPill", "uLead", "uTail", "uRad", "uSq", "uCy", "uDrop", "uRip", "uCur", "uTime", "uAmb", "uTint", "uTintA", "uHi", "uDark"]
      .forEach(function (k) { U[k] = gl.getUniformLocation(prog, k); });
    gl.clearColor(0, 0, 0, 0);
    nav.classList.add("ln-gl"); nav.classList.remove("ln-nogl");
    return true;
  }

  function readTint() {
    var cs = getComputedStyle(nav);
    function rgb(name, dflt) {
      var v = cs.getPropertyValue(name).trim(); if (!v) return dflt;
      var m = v.match(/[\d.]+/g); return m && m.length >= 3 ? [m[0] / 255, m[1] / 255, m[2] / 255] : dflt;
    }
    tint.c = rgb("--ln-water", [0.85, 0.9, 1]); tint.hi = rgb("--ln-spec", [1, 1, 1]);
    tint.a = parseFloat(cs.getPropertyValue("--ln-water-a")) || 0.22;
    tint.dark = parseFloat(cs.getPropertyValue("--ln-dark")) || 0;
    wake();
  }

  function draw(t) {
    if (!gl) return;
    var dpr = canvas.width / (geo.w + 2 * M), sp = Math.abs(lead.v), sq = 1 - Math.min(0.2, sp / 3200);
    var hl = Math.max(0, geo.itemW / 2 - geo.rad - 3), stretch = Math.min(6, sp / 400);
    gl.uniform2f(U.uRes, canvas.width, canvas.height); gl.uniform1f(U.uDpr, dpr);
    gl.uniform4f(U.uPill, M, M, geo.w, geo.h);
    gl.uniform3f(U.uLead, lead.x, geo.cy, hl + stretch); gl.uniform3f(U.uTail, tail.x, geo.cy, hl * 0.9);
    var gap = Math.abs(lead.x - tail.x), neck = gap < 2 ? 0 : geo.rad * Math.max(0, 1 - gap / (1.6 * geo.itemW));
    gl.uniform1f(U.uNeck, neck); gl.uniform1f(U.uRad, geo.rad); gl.uniform1f(U.uSq, sq); gl.uniform1f(U.uCy, geo.cy);
    var da = new Float32Array(12);
    for (var j = 0; j < 3; j++) { var d = drops[j]; if (d) { da[j * 4] = d.x; da[j * 4 + 1] = geo.cy + Math.sin(t * 9 + d.phase) * 2.5; da[j * 4 + 2] = d.r; } }
    gl.uniform4fv(U.uDrop, da);
    if (ripple) { var a = t - ripple.t0; gl.uniform4f(U.uRip, ripple.x, geo.cy, 10 + a * 70, Math.exp(-a * 3.2)); } else gl.uniform4f(U.uRip, 0, 0, 0, 0);
    gl.uniform3f(U.uCur, cursor.x, cursor.y, cursor.a);
    gl.uniform1f(U.uTime, calm() ? 0 : t % 1000); gl.uniform1f(U.uAmb, calm() ? 0 : 0.9);
    gl.uniform3fv(U.uTint, tint.c); gl.uniform1f(U.uTintA, tint.a); gl.uniform3fv(U.uHi, tint.hi); gl.uniform1f(U.uDark, tint.dark);
    gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function frame() {
    raf = 0;
    if (!visible || !inView) return;
    var t = now(), dt = Math.min(1 / 30, last ? t - last : 1 / 60); last = t;
    if (reduced()) { lead.x = tail.x = target; lead.v = tail.v = 0; drops = []; split = false; ripple = null; cursor.a = cursor.ta; }
    else step(dt);
    var moving = busy(), ambient = gl && !calm();
    if (gl && (moving || !ambient || t - lastAmbient > 1 / 30)) { draw(t); lastAmbient = t; }   /* ambient-only frames at 30 fps */
    if (moving || ambient) raf = requestAnimationFrame(frame); else last = 0;
  }
  function wake() { if (!raf && visible && inView) { last = 0; raf = requestAnimationFrame(frame); } }

  /* ------------------------------------------------------------------ events */
  function scrollToItem(i) {
    var id = (items[i].getAttribute("href") || "").slice(1), el = id && document.getElementById(id);
    lockIdx = i; lockUntil = now() + 1.4;
    setActive(i);
    if (el) {
      el.scrollIntoView({behavior: reduced() ? "auto" : "smooth", block: "start"});
      try { history.replaceState(null, "", "#" + id); } catch (e) { /* file:// or sandbox */ }
    }
  }
  items.forEach(function (it, i) {
    it.addEventListener("click", function (ev) { ev.preventDefault(); scrollToItem(i); });
    it.addEventListener("keydown", function (ev) {
      var rtl = getComputedStyle(nav).direction === "rtl", n = items.length, j = null;
      if (ev.key === "ArrowRight") j = i + (rtl ? -1 : 1);
      else if (ev.key === "ArrowLeft") j = i + (rtl ? 1 : -1);
      else if (ev.key === "Home") j = 0; else if (ev.key === "End") j = n - 1;
      if (j === null) return;
      ev.preventDefault(); j = (j + n) % n; items[j].focus(); scrollToItem(j);
    });
  });
  pill.addEventListener("pointermove", function (ev) {
    var r = pill.getBoundingClientRect(); cursor.x = ev.clientX - r.left + M; cursor.y = ev.clientY - r.top + M; cursor.ta = 1; wake();
  });
  pill.addEventListener("pointerleave", function () { cursor.ta = 0; wake(); });

  /* section in view -> drop. Sections that have no item of their own map to the item before them. */
  var map = {}, ids = items.map(function (it) { return (it.getAttribute("href") || "").slice(1); });
  var sections = Array.prototype.slice.call(document.querySelectorAll("main section[id]"));
  var cur = -1;
  sections.forEach(function (s) { var k = ids.indexOf(s.id); if (k >= 0) cur = k; map[s.id] = Math.max(0, cur); });
  if ("IntersectionObserver" in window && sections.length) {
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) {
        if (!e.isIntersecting) return;
        var k = map[e.target.id]; if (k == null) return;
        if (now() < lockUntil && k !== lockIdx) return;   /* a tap's smooth scroll passes other sections: keep the drop on the tapped item */
        if (k !== active) setActive(k);
      });
    }, {rootMargin: "-45% 0px -54% 0px"});
    sections.forEach(function (s) { io.observe(s); });
  }
  window.addEventListener("scrollend", function () { lockUntil = 0; });

  /* pause when hidden: off-screen (display:none on desktop counts) or a background tab */
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (ents) { inView = ents[ents.length - 1].isIntersecting; if (inView) { measure(); wake(); } }).observe(pill);
  }
  document.addEventListener("visibilitychange", function () { visible = !document.hidden; if (visible) wake(); });
  if ("ResizeObserver" in window) new ResizeObserver(function () { var a = active; measure(); setActive(a, {instant: true}); }).observe(pill);
  else window.addEventListener("resize", function () { measure(); setActive(active, {instant: true}); });
  if (mqReduce.addEventListener) mqReduce.addEventListener("change", function () { setActive(active, {instant: true}); });
  new MutationObserver(readTint).observe(document.documentElement, {attributes: true, attributeFilter: ["data-theme", "class", "data-gpu"]});
  if (window.matchMedia) { var mqDark = window.matchMedia("(prefers-color-scheme: dark)"); if (mqDark.addEventListener) mqDark.addEventListener("change", readTint); }

  if (canvas) {
    canvas.addEventListener("webglcontextlost", function (ev) { ev.preventDefault(); gl = null; nav.classList.remove("ln-gl"); nav.classList.add("ln-nogl"); });
    canvas.addEventListener("webglcontextrestored", function () { if (initGL()) { measure(); readTint(); wake(); } });
  }

  /* ------------------------------------------------------------------ start */
  if (!initGL()) nav.classList.add("ln-nogl");
  measure(); readTint();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measure(); setActive(active, {instant: true}); });
  var start = ids.indexOf((location.hash || "").slice(1)); if (start < 0 && map[(location.hash || "").slice(1)] != null) start = map[location.hash.slice(1)];
  targetT = 0; setActive(Math.max(0, start), {instant: true}); targetT = -1;
  requestAnimationFrame(function () { nav.classList.add("ln-ready"); });
  nav.liquidNav = {setActive: setActive, state: function () { return {active: active, lead: lead.x, tail: tail.x, target: target, drops: drops.length, ripple: !!ripple, gl: !!gl}; }};
})();
