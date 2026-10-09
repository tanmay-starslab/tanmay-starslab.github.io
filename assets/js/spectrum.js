/* THE SIGHTLINE — a live O VI absorption measurement.
   Canvas 2D, zero libraries, zero external assets. Progressive enhancement in
   the strict sense: the section's heading, its caption and both range inputs
   are real HTML that work with this file deleted. What this adds is the figure.

   Atomic data from VPFIT's atom.dat, rows flagged M03g (Morton 2003). The line
   profile is the Tepper-Garcia (2006) analytic Voigt-Hjerting approximation —
   the same one production absorption-line codes use, so it is a real
   measurement of a real profile, not a curve shaped to look like one. */
(function () {
  "use strict";

  var panel = document.getElementById("ovi-panel");
  if (!panel) return;
  var canvas = document.getElementById("ovi-canvas");
  var nInput = document.getElementById("ovi-logn");
  var bInput = document.getElementById("ovi-b");
  var readout = document.getElementById("ovi-readout");
  var live = document.getElementById("ovi-live");
  if (!canvas || !nInput || !bInput || !readout) return;

  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  /* ── physics ─────────────────────────────────────────────────────────── */

  var C_KMS = 299792.458;
  var L1 = { lam: 1031.9261, f: 0.13250, G: 4.149e8 };
  var L2 = { lam: 1037.6167, f: 0.06580, G: 4.076e8 };
  // Computed, not copied: the doublet separation IS the two wavelengths.
  var DV = C_KMS * (L2.lam - L1.lam) / L1.lam;          // 1653.2 km/s

  // Tepper-Garcia (2006) MNRAS 369, 2025; erratum 2007 MNRAS 382, 1375.
  function voigtH(a, x) {
    var x2 = x * x, h = Math.exp(-x2);
    // The 1/x^2 terms are singular at exactly x = 0, so a guard is needed.
    // The threshold is 1e-12, not 1e-6: at 1e-6 the guard fires on real grid
    // samples (the smallest |x| any shipped grid reaches is 2.8e-5) and
    // dropping the -2a/sqrt(pi) line-centre term there puts a step of 1.5e-4
    // in H at |x| = 1e-3. Sub-pixel in the drawn flux, but it is a
    // discontinuity in a profile, and no sample ever lands on a line centre
    // anyway — so the guard should catch the true singularity and nothing else.
    if (x2 < 1e-12) return h;
    var q = 1.5 / x2;
    return h - (a / (Math.sqrt(Math.PI) * x2)) *
      (h * h * (4 * x2 * x2 + 7 * x2 + 4 + q) - q - 1);
  }
  function damping(L, b) { return L.G * L.lam / (4 * Math.PI * b) * 1e-13; }
  function tau(L, N, b, dv) {
    // 1.4974e-15 = sqrt(pi) e^2 / (m_e c), in [Angstrom, cm^-2, km/s].
    // Sanity check anyone can run: Ly-alpha (f 0.41640, lam 1215.6701) at
    // N = 1e13, b = 20 gives tau_0 = 0.378996, which is a rest-frame
    // equivalent width of 47 mA (54.5 mA in the optically-thin limit).
    return 1.4974e-15 * L.f * L.lam * N / b * voigtH(damping(L, b), dv / b);
  }

  /* ── sampling grid ───────────────────────────────────────────────────── */

  var LAM_LO = 1029.4, LAM_HI = 1040.4;
  // R ~ 18000 is COS-like: FWHM 16.7 km/s.
  var LSF_FWHM = 16.7, LSF_SIGMA = LSF_FWHM / (2 * Math.sqrt(2 * Math.LN2));
  var SNR = 14;
  // HARD RULE: dispersion never finer than 1.5 km/s/px. A +/-400 km/s panel at
  // 4096 samples oversamples to 0.195 km/s/px, which blows the LSF kernel to
  // 293px and direct convolution to 1.3ms here — 6-8ms on a phone, during a
  // drag. Sampling is capped, and the display interpolates.
  var MIN_DISP = 1.5;

  var W = 0, H = 0, dpr = 1, lastDpr = 0;

  // One realisation of the exposure, on a wavelength grid that never changes.
  var NOISE_N = 2400, NOISE = new Float64Array(NOISE_N);
  var nSamp = 0, lam = null, model = null, conv = null, noise = null, kern = null;

  function gauss(rng) {           // Box-Muller, deterministic
    var u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  (function () {
    var rng = mulberry(20260925);
    for (var i = 0; i < NOISE_N; i++) NOISE[i] = gauss(rng);
  })();

  function buildGrid(widthPx) {
    var spanKms = C_KMS * (LAM_HI - LAM_LO) / L1.lam;
    var maxSamples = Math.floor(spanKms / MIN_DISP);
    nSamp = Math.max(240, Math.min(widthPx, maxSamples));
    lam = new Float64Array(nSamp);
    model = new Float64Array(nSamp);
    conv = new Float64Array(nSamp);
    noise = new Float64Array(nSamp);
    for (var i = 0; i < nSamp; i++) {
      lam[i] = LAM_LO + (LAM_HI - LAM_LO) * (i / (nSamp - 1));
      // The deviates come from a FIXED wavelength grid, interpolated onto
      // whatever grid this width produces. Drawing them in sample order from a
      // fixed seed keeps the sequence stable but not the realisation: at 1032
      // samples deviate 500 sits at 1034.7346 A and at 1031 samples it sits at
      // 1034.7398, so every one-pixel resize re-mapped all thousand of them and
      // the noise crawled during a window drag. A real exposure has one
      // realisation and it stays where it was measured.
      var t = (i / (nSamp - 1)) * (NOISE_N - 1);
      var k = Math.floor(t), frac = t - k;
      if (k >= NOISE_N - 1) { noise[i] = NOISE[NOISE_N - 1]; }
      else { noise[i] = NOISE[k] + (NOISE[k + 1] - NOISE[k]) * frac; }
    }
    var disp = spanKms / (nSamp - 1);
    var sigPx = LSF_SIGMA / disp;
    var rad = Math.max(1, Math.ceil(4 * sigPx));
    kern = new Float64Array(2 * rad + 1);
    var sum = 0;
    for (var k = -rad; k <= rad; k++) {
      var g = Math.exp(-0.5 * (k / sigPx) * (k / sigPx));
      kern[k + rad] = g; sum += g;
    }
    for (var m = 0; m < kern.length; m++) kern[m] /= sum;
    kern.rad = rad;
    return { disp: disp, sigPx: sigPx, kernel: kern.length };
  }

  function compute(N, b) {
    var i, v1, v2;
    for (i = 0; i < nSamp; i++) {
      v1 = C_KMS * (lam[i] - L1.lam) / L1.lam;
      v2 = C_KMS * (lam[i] - L2.lam) / L2.lam;
      model[i] = Math.exp(-(tau(L1, N, b, v1) + tau(L2, N, b, v2)));
    }
    var rad = kern.rad;
    for (i = 0; i < nSamp; i++) {
      var acc = 0, wsum = 0;
      for (var k = -rad; k <= rad; k++) {
        var j = i + k;
        if (j < 0 || j >= nSamp) continue;    // renormalise at the edges rather
        acc += model[j] * kern[k + rad];      // than wrapping or clamping, both
        wsum += kern[k + rad];                // of which invent absorption
      }
      conv[i] = acc / wsum;
    }
  }

  /* ── figure ──────────────────────────────────────────────────────────── */

  var cssVar = function (n, fb) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    return v || fb;
  };
  var INK, MUTED, DIM, ACCENT, ROSE, MONO;
  function readTokens() {
    INK = cssVar("--ink-text", "#f2f3f8");
    MUTED = cssVar("--ink-muted", "#b2b7c6");
    DIM = cssVar("--ink-dim", "#656974");
    ACCENT = cssVar("--a-cyan", "#8fd8e8");
    ROSE = cssVar("--a-halpha", "#f0b8b8");
    MONO = cssVar("--font-mono", "ui-monospace, Menlo, monospace");
  }

  var PAD = { l: 58, r: 16, t: 26, b: 40 };
  var FLUX_HI = 1.18;

  function xOf(l) { return PAD.l + (l - LAM_LO) / (LAM_HI - LAM_LO) * (W - PAD.l - PAD.r); }
  function yOf(f) { return PAD.t + (FLUX_HI - f) / FLUX_HI * (H - PAD.t - PAD.b); }

  function draw(N, b) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.font = "11px " + MONO;
    ctx.textBaseline = "middle";

    // frame
    ctx.strokeStyle = DIM; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD.l, PAD.t); ctx.lineTo(PAD.l, H - PAD.b); ctx.lineTo(W - PAD.r, H - PAD.b);
    ctx.stroke();

    // y ticks
    ctx.textAlign = "right"; ctx.fillStyle = MUTED;
    [0, 0.5, 1].forEach(function (f) {
      var y = yOf(f);
      ctx.globalAlpha = 0.45; ctx.beginPath();
      ctx.moveTo(PAD.l, y); ctx.lineTo(PAD.l - 4, y); ctx.stroke();
      if (f === 1 || f === 0) {                       // continuum and zero
        ctx.globalAlpha = f === 1 ? 0.34 : 0.2;
        ctx.setLineDash(f === 1 ? [3, 4] : [1, 5]);
        ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(W - PAD.r, y); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.globalAlpha = 0.9;
      ctx.fillText(f.toFixed(1), PAD.l - 8, y);
    });

    // x ticks
    ctx.textAlign = "center";
    for (var l = 1030; l <= 1040; l += 2) {
      var x = xOf(l);
      ctx.globalAlpha = 0.45; ctx.strokeStyle = DIM;
      ctx.beginPath(); ctx.moveTo(x, H - PAD.b); ctx.lineTo(x, H - PAD.b + 4); ctx.stroke();
      ctx.globalAlpha = 0.9; ctx.fillStyle = MUTED;
      ctx.fillText(String(l), x, H - PAD.b + 14);
    }
    ctx.globalAlpha = 0.75;
    ctx.fillText("rest wavelength  Å", (PAD.l + W - PAD.r) / 2, H - 8);
    ctx.save();
    ctx.translate(13, (PAD.t + H - PAD.b) / 2); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center"; ctx.fillText("normalised flux", 0, 0);
    ctx.restore();

    // line markers
    ctx.globalAlpha = 0.5; ctx.setLineDash([2, 4]);
    [[L1.lam, "λ1031.93"], [L2.lam, "λ1037.62"]].forEach(function (p, i) {
      var x = xOf(p[0]);
      ctx.strokeStyle = i ? ROSE : ACCENT;
      ctx.beginPath(); ctx.moveTo(x, PAD.t); ctx.lineTo(x, H - PAD.b); ctx.stroke();
      ctx.fillStyle = i ? ROSE : ACCENT; ctx.globalAlpha = 0.95;
      ctx.textAlign = "center";
      ctx.fillText("O VI " + p[1], x, PAD.t + 7);
      ctx.globalAlpha = 0.5;
    });
    ctx.setLineDash([]);

    // the exposure: model + frozen Poisson deviates scaled by sqrt(F)/SNR
    // Clipped to the plot box. The 0.02 noise floor is deliberate — it gives a
    // saturated core 3.3px of visible read noise instead of 7e-4px — but it
    // also takes the trace to -0.013 in flux, which is 4.3px BELOW the zero
    // axis and into the tick band, with nothing stopping it reaching the
    // labels at another setting.
    ctx.save();
    ctx.beginPath();
    ctx.rect(PAD.l, PAD.t, W - PAD.l - PAD.r, H - PAD.t - PAD.b);
    ctx.clip();
    ctx.globalAlpha = 0.85; ctx.strokeStyle = MUTED; ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = 0; i < nSamp; i++) {
      var f = conv[i] + noise[i] * Math.sqrt(Math.max(conv[i], 0.02)) / SNR;
      var x2 = xOf(lam[i]), y2 = yOf(f);
      if (i === 0) ctx.moveTo(x2, y2); else ctx.lineTo(x2, y2);
    }
    ctx.stroke();
    ctx.restore();

    // the model, over the data
    ctx.globalAlpha = 1; ctx.strokeStyle = ACCENT; ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (var j = 0; j < nSamp; j++) {
      var xm = xOf(lam[j]), ym = yOf(conv[j]);
      if (j === 0) ctx.moveTo(xm, ym); else ctx.lineTo(xm, ym);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /* ── state ───────────────────────────────────────────────────────────── */

  function depthAt(lamRest) {
    // Parabolic fit through the three samples bracketing line centre, on the
    // CONVOLVED profile — the depth a spectrograph records, not the intrinsic
    // optical depth.
    //
    // Taking the single nearest sample instead made the printed ratio a
    // function of the canvas width. The residual offset from line centre is up
    // to half a sample and moves INDEPENDENTLY for the two lines, so across
    // widths 300-2130 the ratio at log N 12.5 ranged 1.926-2.049 — thirteen
    // different two-decimal strings, some of them ABOVE the oscillator-strength
    // ceiling of 2.0027, which is physically impossible. Worse, at a fixed
    // log N 13.63 a three-device-pixel change in canvas width flipped the
    // caption between "saturating" and "unsaturated" while printing the same
    // 1.85:1 — and the live region announced the contradiction.
    var idx = Math.round((lamRest - LAM_LO) / (LAM_HI - LAM_LO) * (nSamp - 1));
    idx = Math.max(1, Math.min(nSamp - 2, idx));
    var y0 = conv[idx - 1], y1 = conv[idx], y2 = conv[idx + 1];
    var den = y0 - 2 * y1 + y2;
    // den <= 0 means the three samples are collinear or concave-down: no
    // interior minimum to interpolate, so the nearest sample IS the answer.
    if (den > 1e-12) {
      var d = 0.5 * (y0 - y2) / den;            // vertex offset, in samples
      if (d > -1 && d < 1) {
        var vertex = y1 - 0.25 * (y0 - y2) * d;
        return 1 - Math.max(0, Math.min(1, vertex));
      }
    }
    return 1 - y1;
  }

  function fmt(x, d) { return x.toFixed(d); }

  function caption(logN, b) {
    var d1 = depthAt(L1.lam), d2 = depthAt(L2.lam);
    var ratio = d2 > 1e-3 ? d1 / d2 : 1;
    // Branch on the value the reader is SHOWN, not on the full-precision one.
    // Otherwise the printed number and the word beside it are computed from
    // different quantities, and two panels can both read "1.85:1" while one
    // says unsaturated and the other saturating.
    ratio = Math.round(ratio * 100) / 100;
    var note;
    // "close to", not "at": f*lambda gives exactly 2.0026, but the measured
    // depth ratio is 1.98 at log N 12.5 and already 1.88 by 13.5. Printing
    // "1.86:1" directly beside the words "reads at 2:1" is the kind of small
    // overclaim this audience notices.
    if (ratio > 1.85) note = "unsaturated — the pair reads close to its oscillator-strength ratio of 2:1";
    else if (ratio > 1.25) note = "saturating — the stronger line is running out of depth to lose";
    else note = "saturated — both floors are on zero and the doublet reads 1:1";
    return "log N(O VI) = " + fmt(logN, 2) + " cm⁻², b = " + fmt(b, 0) +
      " km s⁻¹. Depth ratio " + fmt(ratio, 2) + ":1 — " + note + ".";
  }

  // publishCaption() does its OWN compute rather than reading whatever the last
  // drawn frame left in conv[]. Two bugs live in the shortcut. Writing the
  // caption straight from a `change` handler publishes the PREVIOUS slider
  // position's ratio, because conv[] is one compute behind. Deferring it into
  // the rAF instead fixes that but makes the accessible name depend on a frame
  // — and rAF does not run in a background tab, is throttled under load, and is
  // gated here by an IntersectionObserver. The live region is the label on a
  // figure; it must not be able to fall behind the control that drives it.
  // compute() is ~0.15 ms, and announcements are debounced, so this costs
  // nothing measurable.
  // The VISIBLE caption and the ANNOUNCEMENT are two different jobs with
  // opposite requirements, and making one DOM node do both forced them into
  // conflict. Measured on the old single-node version: 40 arrow presses in
  // 205ms produced 40 live-region mutations — 195 announcements a second,
  // three times the flood its own comment warned about — because `change`
  // fires per step during keyboard auto-repeat and published synchronously.
  // The mirror failure was just as bad: on an input-only stream the trailing
  // debounce reset on every tick and never fired at all, so the visible number
  // froze at 13.00 while the curve animated to 14.45 underneath it.
  //
  // So: the visible readout updates eagerly, every tick. The live region is a
  // separate visually-hidden node on a leading+trailing throttle, which fires
  // at most ~1.7 times a second and always fires last.
  function publishCaption() {
    if (nSamp <= 0) return;
    var lg = parseFloat(nInput.value), b = parseFloat(bInput.value);
    compute(Math.pow(10, lg), b);
    readout.textContent = caption(lg, b);
    if (rail) drawRail();
    announce();
  }

  var lastSpoken = 0, pendingCaption = 0;
  var SPEAK_MS = 600;
  function speak() {
    lastSpoken = Date.now();
    if (live) live.textContent = readout.textContent;
  }
  function announce() {
    if (!live) return;
    var wait = SPEAK_MS - (Date.now() - lastSpoken);
    window.clearTimeout(pendingCaption);
    if (wait <= 0) speak();
    else pendingCaption = window.setTimeout(speak, wait);
  }
  function announceNow() { publishCaption(); }

  var dirty = true, rafId = 0, visible = true;
  function schedule() {
    if (rafId || !visible) return;
    rafId = window.requestAnimationFrame(function () {
      rafId = 0;
      if (!dirty) return;
      dirty = false;
      var logN = parseFloat(nInput.value), b = parseFloat(bInput.value);
      compute(Math.pow(10, logN), b);
      draw(Math.pow(10, logN), b);
      // drawRail() also runs from publishCaption(), which is ungated. The rail
      // is position: fixed and visible at every scroll position, so gating it
      // on #ovi-panel's intersection meant that focusing a slider, scrolling
      // the panel away and pressing an arrow key left the rail showing a
      // profile that contradicted the sentence just announced. Measured: the
      // path data stayed byte-identical across a full sweep of both sliders.
      if (rail) drawRail();
    });
  }
  function invalidate() { dirty = true; schedule(); }

  function resize() {
    var r = canvas.getBoundingClientRect();
    if (r.width < 1) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(r.width), h = Math.round(r.height);
    var wantW = Math.round(w * dpr), wantH = Math.round(h * dpr);
    // Compare against the BACKING STORE, not against remembered CSS numbers.
    // The old gate was `w === W && h === H` and dpr took part in the transform
    // but in no invalidation decision. Above ~1430px the canvas box is pinned
    // by the container's max-width, so dragging the window from a Retina
    // display to a 1x one changes dpr 2 -> 1 with the CSS box unchanged: the
    // gate returned, the 2x buffer was kept, and the figure was drawn into its
    // own top-left quadrant and displayed stretched. Reading canvas.width also
    // repairs a buffer clobbered from outside, which the closure cannot see.
    if (canvas.width === wantW && canvas.height === wantH && w === W && h === H) return;
    W = w; H = h; lastDpr = dpr;
    canvas.width = wantW;
    canvas.height = wantH;
    PAD.l = W < 520 ? 44 : 58;
    buildGrid(canvas.width);
    readTokens();
    invalidate();
  }

  // aria-valuetext is set synchronously on every tick, NOT inside the frame.
  // A slider's value text is the slider's own state; routing it through rAF
  // means a screen reader can read back a value the control no longer has,
  // and rAF does not run at all in a background tab.
  function syncValueText() {
    nInput.setAttribute("aria-valuetext",
      "log N(O VI) = " + fmt(parseFloat(nInput.value), 2) + " per square centimetre");
    bInput.setAttribute("aria-valuetext",
      "Doppler b = " + fmt(parseFloat(bInput.value), 0) + " kilometres per second");
  }
  [nInput, bInput].forEach(function (el) {
    el.addEventListener("input", function () { syncValueText(); invalidate(); publishCaption(); });
    el.addEventListener("change", function () { syncValueText(); invalidate(); announceNow(); });
  });

  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);
  window.addEventListener("resize", resize, { passive: true });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { visible = e.isIntersecting; if (visible) schedule(); });
    }, { rootMargin: "200px" }).observe(panel);
  }

  // A 2D context can be lost too (Chrome does evict them). There is NO
  // preventDefault here, and that is the entire point: canvas-2D inverts the
  // WebGL idiom. Per the HTML spec the user agent restores a 2D context by
  // default and preventDefault() OPTS OUT of restoration — so the WebGL
  // muscle-memory version of this handler guaranteed permanent blankness and
  // was strictly worse than having no handler at all. The width/height
  // attributes survive a restore; only the bitmap is cleared, so redrawing is
  // the whole recovery.
  canvas.addEventListener("contextrestored", function () {
    W = H = 0; lastDpr = 0; resize(); invalidate();
  }, false);

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { readTokens(); invalidate(); });
  }

  /* ── the gutter continuum rail ───────────────────────────────────────── */
  /* The same measurement, 1px wide, running down the page margin. It is the
     foreshadowing, not the payoff: it carves the identical profile from the
     identical numbers, so when the reader reaches the panel they recognise it.
     Drawn by hand with stroke-dashoffset — DrawSVGPlugin is a Club GreenSock
     plugin and is not on the free CDN, so depending on it would be a silent
     no-op in production. */
  var rail = document.getElementById("ovi-rail");
  var railPath = rail && rail.querySelector("path");
  function drawRail() {
    if (!railPath) return;
    var box = rail.viewBox.baseVal, h = box.height, w = box.width;
    var d = "", n = 160;
    for (var i = 0; i < n; i++) {
      // vertical: wavelength runs down the page, flux deflects to the right
      var l = LAM_LO + (LAM_HI - LAM_LO) * (i / (n - 1));
      var idx = Math.round((l - LAM_LO) / (LAM_HI - LAM_LO) * (nSamp - 1));
      var f = conv[Math.max(0, Math.min(nSamp - 1, idx))];
      // f*w, not (1-f)*w: the continuum sits on the rail's right edge, against
      // the page content, and absorption pulls AWAY from the text. Mirrored the
      // other way the troughs point off into the margin and read as an
      // unrelated squiggle.
      var x = f * w, y = h * (i / (n - 1));
      d += (i ? "L" : "M") + x.toFixed(2) + " " + y.toFixed(2);
    }
    railPath.setAttribute("d", d);
    var len = railPath.getTotalLength();
    if (!railPath.dataset.drawn) {
      railPath.style.strokeDasharray = len;
      railPath.style.strokeDashoffset = len;
      railPath.getBoundingClientRect();           // force layout before transition
      railPath.style.transition = "stroke-dashoffset 900ms cubic-bezier(.22,1,.36,1)";
      railPath.style.strokeDashoffset = "0";
      railPath.dataset.drawn = "1";
      return;
    }
    // The dasharray is re-set on EVERY call, not just the first. Only the
    // draw-on animation is once-only. Path length is a function of conv[], so
    // freezing the dasharray at the initial slider values meant a single-value
    // dash of 591 units against a path that grows to 637 at log N 15.5 / b 15 —
    // and a single-value dasharray is dash L, gap L, so the last 46 units
    // (8.2% of the rail, 46 screen pixels) simply stopped being painted. The
    // same truncation appeared under prefers-reduced-motion, where the CSS
    // pins the offset but never touches the dasharray.
    railPath.style.strokeDasharray = len;
    railPath.style.strokeDashoffset = "0";
  }

  readTokens();
  resize();
  // The caption is also the figure's accessible name, so it must never describe
  // a state that has not been computed. conv[] is all zeros until the first
  // compute() runs inside the rAF, and a caption read from zeros announces a
  // saturated 1:1 doublet at EVERY column density — the one statement in the
  // whole panel a spectroscopist would catch instantly.
  syncValueText();
  publishCaption();
})();
