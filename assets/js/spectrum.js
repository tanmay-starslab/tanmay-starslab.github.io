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
    // The 1/x^2 terms diverge at line centre. This guard is the whole
    // difference between a profile and a NaN down the middle of the figure.
    if (x2 < 1e-6) return h;
    var q = 1.5 / x2;
    return h - (a / (Math.sqrt(Math.PI) * x2)) *
      (h * h * (4 * x2 * x2 + 7 * x2 + 4 + q) - q - 1);
  }
  function damping(L, b) { return L.G * L.lam / (4 * Math.PI * b) * 1e-13; }
  function tau(L, N, b, dv) {
    // 1.4974e-15 = sqrt(pi) e^2 / (m_e c), in [Angstrom, cm^-2, km/s].
    // Sanity check anyone can run: Ly-alpha (f 0.41640, lam 1215.6701) at
    // N = 1e13, b = 20 gives tau_0 = 0.3790, the right answer for a ~65 mA line.
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

  var W = 0, H = 0, dpr = 1;
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

  function buildGrid(widthPx) {
    var spanKms = C_KMS * (LAM_HI - LAM_LO) / L1.lam;
    var maxSamples = Math.floor(spanKms / MIN_DISP);
    nSamp = Math.max(240, Math.min(widthPx, maxSamples));
    lam = new Float64Array(nSamp);
    model = new Float64Array(nSamp);
    conv = new Float64Array(nSamp);
    noise = new Float64Array(nSamp);
    var rng = mulberry(20260925);
    for (var i = 0; i < nSamp; i++) {
      lam[i] = LAM_LO + (LAM_HI - LAM_LO) * (i / (nSamp - 1));
      // Frozen unit deviates. Regenerating these per frame would make the
      // noise shimmer while the reader drags, which reads as decoration; a
      // real exposure has one realisation and it stays put.
      noise[i] = gauss(rng);
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
    ctx.globalAlpha = 0.85; ctx.strokeStyle = MUTED; ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = 0; i < nSamp; i++) {
      var f = conv[i] + noise[i] * Math.sqrt(Math.max(conv[i], 0.02)) / SNR;
      var x2 = xOf(lam[i]), y2 = yOf(f);
      if (i === 0) ctx.moveTo(x2, y2); else ctx.lineTo(x2, y2);
    }
    ctx.stroke();

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
    // nearest sample to line centre, on the CONVOLVED profile — the depth a
    // spectrograph would record, not the intrinsic optical depth.
    var idx = Math.round((lamRest - LAM_LO) / (LAM_HI - LAM_LO) * (nSamp - 1));
    idx = Math.max(0, Math.min(nSamp - 1, idx));
    return 1 - conv[idx];
  }

  function fmt(x, d) { return x.toFixed(d); }

  function caption(logN, b) {
    var d1 = depthAt(L1.lam), d2 = depthAt(L2.lam);
    var ratio = d2 > 1e-3 ? d1 / d2 : 1;
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
  function publishCaption() {
    if (nSamp <= 0) return;
    var lg = parseFloat(nInput.value), b = parseFloat(bInput.value);
    compute(Math.pow(10, lg), b);
    var text = caption(lg, b);
    readout.textContent = text;
    canvas.setAttribute("aria-label", "Synthetic O VI doublet absorption spectrum. " + text);
  }

  var pendingCaption = 0;
  function announce() {
    window.clearTimeout(pendingCaption);
    // Debounced, and fired immediately on `change` (thumb release). Announcing
    // every `input` tick floods a screen reader with ~60 interruptions a
    // second, which is worse than no live region at all.
    pendingCaption = window.setTimeout(publishCaption, 400);
  }
  function announceNow() {
    window.clearTimeout(pendingCaption);
    publishCaption();
  }

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
      if (rail) drawRail();
    });
  }
  function invalidate() { dirty = true; schedule(); }

  function resize() {
    var r = canvas.getBoundingClientRect();
    if (r.width < 1) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(r.width), h = Math.round(r.height);
    if (w === W && h === H) return;
    W = w; H = h;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
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
    el.addEventListener("input", function () { syncValueText(); invalidate(); announce(); });
    el.addEventListener("change", function () { syncValueText(); invalidate(); announceNow(); });
  });

  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);
  window.addEventListener("resize", resize, { passive: true });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { visible = e.isIntersecting; if (visible) schedule(); });
    }, { rootMargin: "200px" }).observe(panel);
  }

  // A 2D context can be lost too (Chrome does evict them), and the recovery is
  // a full rebuild: the backing store comes back cleared and undersized.
  canvas.addEventListener("contextlost", function (e) { e.preventDefault(); }, false);
  canvas.addEventListener("contextrestored", function () {
    W = H = 0; resize(); invalidate();
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
    if (!railPath.dataset.drawn) {
      var len = railPath.getTotalLength();
      railPath.style.strokeDasharray = len;
      railPath.style.strokeDashoffset = len;
      railPath.getBoundingClientRect();           // force layout before transition
      railPath.style.transition = "stroke-dashoffset 900ms cubic-bezier(.22,1,.36,1)";
      railPath.style.strokeDashoffset = "0";
      railPath.dataset.drawn = "1";
    }
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
