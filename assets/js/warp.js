/* WARP — scrolling is travel.

   A field of stars in depth, in front of the drawn sky. At rest it is not
   there at all: the sky holds still and so does this. Scroll and the page
   moves you through the field. Scrolling down flies forward, and the stars
   stream out from the middle of the screen as radial streaks; scrolling up
   flies backward, and they pour in toward it. A faster scroll means a faster
   flight and longer streaks, and a jump from the navigation is a full jump.
   When the scrolling stops the flight coasts down and the streaks fade out.

   After the "radiant lines" warp field on 23rd.dev; this is a separate
   implementation written for this page. Its colours are not a palette: each
   star gets a temperature, and the colour is the black-body colour of that
   temperature, the same as the sky behind it (cosmos.js).

   Cost is zero at rest. The loop runs only while the field is moving, and the
   canvas is cleared and left alone once it has stopped. Reduced motion (the OS
   setting or the page's own toggle, which reloads) skips the layer entirely:
   it exists only as a response to motion. */
(function () {
  "use strict";

  var root = document.documentElement;
  var rm = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (rm.matches || root.classList.contains("motion-off")) return;

  /* DEVICE BUDGET — see assets/js/perf-tier.js.

     This is a fixed, full-viewport canvas composited with
     mix-blend-mode: screen and repainted on every scrolled frame. A blend
     mode over the whole viewport is one of the most expensive things to
     rasterise in software, and it buys a decorative flight effect. On a
     client with no usable GPU it does not run at all — which is also what
     a reduced-motion reader already gets, two lines above.

     A capable machine is untouched; a merely weak one keeps it with fewer
     streaks, because the cost there is CPU and scales with N. */
  var perfTier = window.__perfTier || null;
  if (perfTier && perfTier.name === "minimal") return;

  var canvas = document.createElement("canvas");
  if (!canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.id = "warp-canvas";
  canvas.setAttribute("aria-hidden", "true");
  // Positioned inline as well as in the stylesheet, as #sky-canvas is: a
  // visitor with the old CSS cached would otherwise get it in the page flow.
  canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;mix-blend-mode:screen;";
  var merger = document.getElementById("galaxy-canvas");
  if (merger && merger.parentNode) merger.parentNode.insertBefore(canvas, merger);
  else document.body.appendChild(canvas);

  var COARSE = window.matchMedia("(pointer: coarse)").matches;
  // Sparse on purpose: a few hundred streaks read as flight; more read as noise
  // across the text.
  var N = (COARSE || window.innerWidth < 760) ? 150 : 260;
  if (perfTier && perfTier.name === "reduced") N = Math.min(N, 90);
  var DEPTH = 1000, NEAR = 8;
  var TRAVEL = DEPTH * 1.8;      // depth units per second at full warp
  var TRAIL = 0.035;             // a streak is where the star was this many seconds ago
  var V_FULL = 4000;             // scroll speed (px/s) that reaches full warp
  var RISE = 0.1, COAST = 0.55;  // time constants (s): quick to spin up, slow to coast down

  // Black-body colour at temperature T (K), sRGB. Same fit as cosmos.js.
  function blackbody(T) {
    var t = T / 100, r, g, b;
    if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; }
    else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); }
    if (t >= 66) b = 255; else if (t <= 19) b = 0; else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    function c(v) { return Math.max(0, Math.min(255, v)) | 0; }
    return "rgb(" + c(r) + ", " + c(g) + ", " + c(b) + ")";
  }

  // Each star is a point in a box whose far face just fills the screen, so a
  // star born on the far face is always born on screen, and a star flying out
  // of the near end leaves past the edge. Positions are in units of the far
  // face's half-size and scaled to the screen at draw time, so a resize needs
  // no reseeding.
  var sx = new Float32Array(N), sy = new Float32Array(N), sz = new Float32Array(N);
  var col = new Array(N);
  function place(i) {
    sx[i] = Math.random() * 2 - 1;
    sy[i] = Math.random() * 2 - 1;
    var u = Math.random();
    col[i] = blackbody(u < 0.5 ? 3400 + Math.random() * 2600 : u < 0.85 ? 6000 + Math.random() * 4000 : 10000 + Math.random() * 18000);
  }
  for (var i = 0; i < N; i++) { place(i); sz[i] = NEAR + Math.random() * (DEPTH - NEAR); }

  var W = 0, H = 0, dpr = 1, focal = 1, maxLen = 90;
  function layout() {
    W = window.innerWidth; H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, COARSE ? 1.5 : 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    focal = Math.max(W, H) / 2;
    // No streak longer than this: the nearest stars would otherwise draw lines
    // halfway across the screen, and those are what tire the eye.
    maxLen = Math.min(W, H) * 0.12;
  }

  function smooth(e0, e1, x) { var t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }

  var warp = 0, vel = 0, lastY = window.scrollY, prev = 0, rafId = 0, armed = false;

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var vis = smooth(0.02, 0.4, Math.abs(warp));
    if (vis < 0.003) return;
    var cx = W / 2, cy = H / 2;
    // The far face fills the screen: a star at (±1, ±1) on it sits on a corner.
    var hx = (W / 2) * DEPTH / focal, hy = (H / 2) * DEPTH / focal;
    var lag = warp * TRAVEL * TRAIL;
    ctx.lineCap = "round";
    for (var i = 0; i < N; i++) {
      var z = sz[i], tz = Math.max(NEAR * 0.5, Math.min(DEPTH, z + lag));
      var X = sx[i] * hx, Y = sy[i] * hy;
      var x1 = cx + X * focal / z, y1 = cy + Y * focal / z;
      var x0 = cx + X * focal / tz, y0 = cy + Y * focal / tz;
      var dx = x0 - x1, dy = y0 - y1, len = Math.sqrt(dx * dx + dy * dy);
      if (len > maxLen) { x0 = x1 + dx * maxLen / len; y0 = y1 + dy * maxLen / len; }
      if ((x0 < -20 && x1 < -20) || (x0 > W + 20 && x1 > W + 20) || (y0 < -20 && y1 < -20) || (y0 > H + 20 && y1 > H + 20)) continue;
      var near = 1 - z / DEPTH;
      // Fade in from the far face, so a star arriving there never pops.
      var a = vis * (0.12 + 0.43 * near * near) * Math.min(1, (DEPTH - z) / (DEPTH * 0.12));
      if (a < 0.01) continue;
      ctx.globalAlpha = a;
      ctx.strokeStyle = col[i];
      ctx.lineWidth = 0.5 + 0.6 * near * near;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    rafId = 0;
    var dt = prev ? Math.min((now - prev) / 1000, 0.05) : 1 / 60; prev = now;

    // Scroll speed, read from the page each frame and smoothed over a few, so
    // a wheel's notches and a touch fling read as one steady speed.
    var y = window.scrollY, dy = y - lastY; lastY = y;
    vel += (dy / dt - vel) * (1 - Math.exp(-dt / 0.08));

    // Signed: down is forward, up is backward, and a reversal passes through
    // a stop rather than flipping.
    var target = vel === 0 ? 0 : (vel > 0 ? 1 : -1) * Math.min(1, Math.pow(Math.abs(vel) / V_FULL, 0.7));
    var tau = Math.abs(target) > Math.abs(warp) && target * warp >= 0 ? RISE : COAST;
    warp += (target - warp) * (1 - Math.exp(-dt / tau));

    var step = warp * TRAVEL * dt;
    for (var i = 0; i < N; i++) {
      var z = sz[i] - step;
      if (z < NEAR) { z += DEPTH - NEAR; place(i); }
      else if (z > DEPTH) { z -= DEPTH - NEAR; place(i); }
      sz[i] = z;
    }
    draw();

    if (Math.abs(warp) < 0.002 && Math.abs(vel) < 4) {
      warp = 0; vel = 0; prev = 0;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    rafId = window.requestAnimationFrame(frame);
  }

  function start() { if (!rafId && armed && !document.hidden) rafId = window.requestAnimationFrame(frame); }

  layout();
  window.addEventListener("scroll", start, { passive: true });
  window.addEventListener("resize", function () { layout(); draw(); }, { passive: true });
  document.addEventListener("visibilitychange", function () {
    // Coming back to a tab should not read the whole time away as one scroll.
    if (document.hidden) { if (rafId) window.cancelAnimationFrame(rafId); rafId = 0; prev = 0; }
    lastY = window.scrollY;
  });
  // The browser restores the scroll position on a reload, and that jump is not
  // the visitor flying anywhere. Only scrolls after the page has settled count.
  function arm() { window.setTimeout(function () { lastY = window.scrollY; armed = true; }, 400); }
  if (document.readyState === "complete") arm(); else window.addEventListener("load", arm);
})();
