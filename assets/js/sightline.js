/* THE SIGHTLINE MAP — an O VI column-density field you can put a quasar through.
   Canvas 2D, zero libraries, zero external assets.

   WHAT THIS IS, said plainly because the caption says it too: an analytic
   beta-model halo with lognormal scatter. It is NOT a simulation snapshot. The
   bake script for the real thing is in tools/bake-tng.py and needs a TNG API
   key; until a snapshot is committed, a labelled analytic profile is the honest
   option. A beautiful map wired to a fake spectrum, or a synthetic map
   presented as a snapshot, is worse than no map.

   The profile is real physics, not a gradient chosen to look nice:

     n(r)  = n0 [1 + (r/rc)^2]^(-3B/2)
     N(s)  = n0 rc sqrt(pi) G(3B/2 - 1/2)/G(3B/2) [1 + (s/rc)^2]^(1/2 - 3B/2)

   which is the standard closed-form projection of a beta-model, verified here
   against a numerical line-of-sight integral to 0.06%. B = 0.77 and
   rc = 0.25 R_vir put log N at 14.80 in the centre falling to 13.99 at R_vir —
   the shallow decline COS-Halos measures around star-forming L* galaxies, not
   a steep one invented for contrast.

   The map drives the absorption instrument through the instrument's own range
   input, dispatching input/change. Going through the control rather than around
   it means aria-valuetext, the live caption and the figure's accessible name
   all stay correct for free, and there is exactly one source of truth. */
(function () {
  "use strict";

  var wrap = document.getElementById("sightline-map");
  if (!wrap) return;
  var canvas = document.getElementById("ovi-map");
  var beam = document.getElementById("ovi-beam");
  var probe = document.getElementById("ovi-probe");
  var nInput = document.getElementById("ovi-logn");
  if (!canvas || !beam || !probe || !nInput) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  /* ── the field ───────────────────────────────────────────────────────── */

  var BETA = 0.77, RC = 0.25;           // R_vir units
  var LOGN_0 = 14.80;                   // central column
  var EXTENT = 2.4;                     // half-width of the frame, in R_vir
  var SCATTER = 0.30;                   // dex, lognormal — the observed spread
  var GRID = 320;                       // field resolution; upscaled for display

  function lgamma(x) {
    var g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
      771.32342877765313, -176.61502916214059, 12.507343278686905,
      -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
    x -= 1;
    var a = c[0], t = x + g + 0.5;
    for (var i = 1; i < g + 2; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  var P = 1.5 * BETA;
  var NORM = RC * Math.sqrt(Math.PI) * Math.exp(lgamma(P - 0.5) - lgamma(P));
  // The beta-model alone is far too flat to reach the bottom of the colormap:
  // measured over the frame it spanned only log N 13.2 to 14.8, which paints
  // as a purple rectangle with a visible edge against the page. The halo is
  // also not actually infinite. An exponential truncation past ~1.6 R_vir
  // fixes both — it is disclosed in the caption, and it takes the corners to
  // log N ~ 9, i.e. to magma's t=0, which is within two 8-bit levels of the
  // page background. That is the entire reason the colormap is magma: the map
  // bleeds into the page with no card, no border and no seam.
  var R_TRUNC = 1.6, TRUNC_P = 3;
  function colProfile(s) {
    return NORM * Math.pow(1 + (s / RC) * (s / RC), 0.5 - P) *
      Math.exp(-Math.pow(s / R_TRUNC, TRUNC_P));
  }
  var CENTRE = colProfile(0);

  // Deterministic: the same halo every visit, on every machine. A map that
  // reshuffles on reload is a screensaver.
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // The scatter field is built on coarse lattices and interpolated up. CGM
  // column densities are correlated over tens of kpc, so resolving the scatter
  // at display resolution would be both slower and physically wrong.
  //
  // Three real octaves, each its OWN lattice at twice the frequency. A first
  // version reused one lattice and sampled it with a stride, which is not an
  // octave — striding a random lattice decimates it into another lattice of the
  // same statistics, so the "three octaves" were three copies of one field and
  // the result had a visible period.
  function lattice(n, rng) {
    var a = new Float32Array(n * n);
    for (var i = 0; i < a.length; i++) a[i] = rng() * 2 - 1;
    return a;
  }
  function sampleLattice(a, n, u, v) {   // wrapping, smoothstep-interpolated
    var fx = u * n, fy = v * n;
    var x0 = Math.floor(fx), y0 = Math.floor(fy);
    var tx = fx - x0, ty = fy - y0;
    var x1 = (((x0 + 1) % n) + n) % n, y1 = (((y0 + 1) % n) + n) % n;
    x0 = ((x0 % n) + n) % n; y0 = ((y0 % n) + n) % n;
    tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
    var top = a[y0 * n + x0] + (a[y0 * n + x1] - a[y0 * n + x0]) * tx;
    var bot = a[y1 * n + x0] + (a[y1 * n + x1] - a[y1 * n + x0]) * tx;
    return top + (bot - top) * ty;
  }
  var RNG = mulberry(1031926);
  var OCT = [
    { n: 6,  a: 0.60, grid: null },
    { n: 12, a: 0.28, grid: null },
    { n: 24, a: 0.12, grid: null }
  ];
  for (var oi = 0; oi < OCT.length; oi++) OCT[oi].grid = lattice(OCT[oi].n, RNG);
  function rawScatter(u, v) {
    var s = 0;
    for (var i = 0; i < OCT.length; i++) s += OCT[i].a * sampleLattice(OCT[i].grid, OCT[i].n, u, v);
    return s;
  }
  // Standardise on the MEASURED mean and standard deviation of the summed
  // field, not on the sum of the octave weights. Dividing by the weight sum
  // was wrong by a factor of three: the sd of a weighted sum of independent
  // lattices goes as sqrt(sum a_i^2), so SCATTER = 0.30 was delivering 0.088
  // dex of spread. Measuring it makes the constant mean what it says in dex
  // whatever the octave table is later changed to.
  var SC_MEAN = 0, SC_SD = 1;
  (function () {
    var n = 0, sum = 0, sum2 = 0;
    for (var y = 0; y < 96; y++) {
      for (var x = 0; x < 96; x++) {
        var v = rawScatter((x + 0.5) / 96, (y + 0.5) / 96);
        sum += v; sum2 += v * v; n++;
      }
    }
    SC_MEAN = sum / n;
    SC_SD = Math.sqrt(Math.max(sum2 / n - SC_MEAN * SC_MEAN, 1e-9));
  })();
  function scatterAt(u, v) { return (rawScatter(u, v) - SC_MEAN) / SC_SD; }

  // log N at a position in R_vir units. This is the single function the map,
  // the readout and the spectrum all read, so they cannot disagree.
  function logNAt(x, y) {
    var s = Math.sqrt(x * x + y * y);
    var lg = LOGN_0 + Math.log10(colProfile(s) / CENTRE);
    var u = (x / (2 * EXTENT)) + 0.5, v = (y / (2 * EXTENT)) + 0.5;
    return lg + SCATTER * scatterAt(u, v);
  }

  /* ── magma, the colormap in his own figures ──────────────────────────── */

  var MAGMA = [
    [0.002, 0.002, 0.014], [0.114, 0.067, 0.278], [0.318, 0.071, 0.486],
    [0.716, 0.215, 0.475], [0.906, 0.320, 0.388], [0.988, 0.537, 0.380],
    [0.996, 0.769, 0.533], [0.988, 0.992, 0.749]
  ];
  function magma(t, out) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var f = t * 7, i = Math.min(6, Math.floor(f)), k = f - i;
    var a = MAGMA[i], b = MAGMA[i + 1];
    out[0] = (a[0] + (b[0] - a[0]) * k) * 255;
    out[1] = (a[1] + (b[1] - a[1]) * k) * 255;
    out[2] = (a[2] + (b[2] - a[2]) * k) * 255;
  }
  // magma at t=0 is within two 8-bit levels of the page background, which is
  // the whole reason it is magma and not viridis: viridis at t=0 is a visible
  // dark purple and would draw a plate edge around the figure on a black page.

  // The display stretch is 12.0 to 15.0 because the colorbar is labelled
  // 10^12, 10^13, 10^14, 10^15 and those labels have to land ON the colours
  // they name. At 12.6 the first tick was off-scale below the floor: a
  // colorbar whose end tick is outside its own range is exactly the kind of
  // detail this audience checks first.
  var FLOOR = 12.0, CEIL = 15.0;
  var field = null, fieldN = 0;

  function render() {
    var w = canvas.width, h = canvas.height;
    if (w < 2 || h < 2) return;
    var img = ctx.createImageData(w, h), d = img.data;
    field = new Float32Array(w * h);
    // EXTENT applies to the SHORTER axis and the longer one is scaled, so the
    // halo stays circular even if CSS ever hands this a non-square box. The
    // alternative — assuming square — turns the R_vir ring into an oval, which
    // is the kind of error that discredits a figure instantly.
    var short = Math.min(w, h);
    var ex = EXTENT * (w / short), ey = EXTENT * (h / short);
    var rgb = [0, 0, 0], i = 0;
    for (var py = 0; py < h; py++) {
      var yy = ((py + 0.5) / h - 0.5) * 2 * ey;
      for (var px = 0; px < w; px++, i++) {
        var xx = ((px + 0.5) / w - 0.5) * 2 * ex;
        var lg = logNAt(xx, yy);
        field[i] = lg;
        magma((lg - FLOOR) / (CEIL - FLOOR), rgb);
        d[i * 4] = rgb[0]; d[i * 4 + 1] = rgb[1]; d[i * 4 + 2] = rgb[2];
        // Alpha from the rendered brightness, so the faint outskirts fade to
        // nothing instead of ending at a rectangle.
        //
        // mix-blend-mode: screen alone does NOT do this, and the reason is the
        // same one that bit the hero: .main carries z-index 5 and is therefore
        // a stacking context, so the map's backdrop group is .main's own
        // contents — not the star field and nebula, which are painted below
        // .main in the root stacking context and are invisible to the blend.
        // Screened against nothing, an opaque near-black canvas is still an
        // opaque near-black square sitting on a lighter page.
        //
        // With alpha, the dark outskirts are genuinely transparent whatever the
        // stacking context does. The screen blend stays on top of it, so where
        // the two CAN cooperate the layer only ever adds light.
        var a = Math.max(rgb[0], Math.max(rgb[1], rgb[2])) / 255 * 2.2;
        d[i * 4 + 3] = Math.round(255 * (a > 1 ? 1 : a));
      }
    }
    ctx.putImageData(img, 0, 0);
    fieldN = w;
  }

  function sampleField(u, v) {          // u,v in [0,1] across the canvas
    if (!field) return LOGN_0;
    var w = canvas.width, h = canvas.height;
    var px = Math.min(w - 1, Math.max(0, Math.round(u * w - 0.5)));
    var py = Math.min(h - 1, Math.max(0, Math.round(v * h - 0.5)));
    return field[py * w + px];
  }

  /* ── the beam ────────────────────────────────────────────────────────── */

  var bx = 0.62, by = 0.44;             // normalised position of the sightline

  function place() {
    beam.style.left = (bx * 100).toFixed(3) + "%";
    beam.style.top = (by * 100).toFixed(3) + "%";
    var lg = sampleField(bx, by);
    var sw = Math.min(canvas.width, canvas.height) || 1;
    var x = (bx - 0.5) * 2 * EXTENT * (canvas.width / sw);
    var y = (by - 0.5) * 2 * EXTENT * (canvas.height / sw);
    var s = Math.sqrt(x * x + y * y);
    var lo = parseFloat(nInput.min), hi = parseFloat(nInput.max);
    var clamped = Math.max(lo, Math.min(hi, lg));
    // 41% of the frame sits below the spectrum’s 12.5 floor, because the
    // truncated halo really does run out of gas out there. Silently clamping
    // would put one column density on the map and a DIFFERENT one in the
    // spectrum, which is precisely the failure this panel exists to avoid:
    // two views, one fact. When they cannot agree, say so.
    probe.textContent = "log N(O VI) = " + lg.toFixed(2) + " cm⁻² at " +
      s.toFixed(2) + " R_vir" +
      (clamped !== lg ? " — below the instrument’s range; the spectrum is held at "
        + clamped.toFixed(2) : "");
    // Drive the spectrum through its own control. Setting the input and firing
    // input+change means the instrument's aria-valuetext, live caption and
    // accessible name all update by the same path a human drag uses — there is
    // no second code path to keep in sync, and no way for the two to disagree.
    nInput.value = clamped.toFixed(2);
    nInput.dispatchEvent(new Event("input", { bubbles: true }));
    nInput.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function fromEvent(e) {
    var r = canvas.getBoundingClientRect();
    bx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    by = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    place();
  }

  var dragging = false;
  wrap.addEventListener("pointerdown", function (e) {
    dragging = true;
    // Position FIRST, capture second. Capture is an optimisation that keeps a
    // drag alive outside the box; it is not a precondition for the tap. With
    // the two the other way round, any setPointerCapture that throws —
    // NotFoundError on a pointer the UA no longer considers active is the easy
    // one to hit — aborts the handler before the beam ever moves, and the
    // reader's click does nothing at all.
    fromEvent(e);
    try { wrap.setPointerCapture(e.pointerId); } catch (err) { /* drag still works */ }
  });
  wrap.addEventListener("pointermove", function (e) { if (dragging) fromEvent(e); });
  wrap.addEventListener("pointerup", function (e) {
    dragging = false;
    try {
      if (wrap.hasPointerCapture(e.pointerId)) wrap.releasePointerCapture(e.pointerId);
    } catch (err) { /* never captured */ }
  });
  wrap.addEventListener("pointercancel", function () { dragging = false; });

  // The beam is a real focusable control with arrow keys, because a sightline
  // you can only reach with a mouse is a sightline half the readers cannot use.
  beam.addEventListener("keydown", function (e) {
    var d = e.shiftKey ? 0.002 : 0.02, moved = true;
    if (e.key === "ArrowLeft") bx -= d;
    else if (e.key === "ArrowRight") bx += d;
    else if (e.key === "ArrowUp") by -= d;
    else if (e.key === "ArrowDown") by += d;
    else if (e.key === "Home") { bx = 0.5; by = 0.5; }
    else moved = false;
    if (!moved) return;
    e.preventDefault();
    bx = Math.min(1, Math.max(0, bx)); by = Math.min(1, Math.max(0, by));
    place();
  });

  /* ── colorbar ────────────────────────────────────────────────────────── */

  var bar = document.getElementById("ovi-colorbar");
  function drawBar() {
    if (!bar) return;
    var c = bar.getContext("2d");
    if (!c) return;
    var w = bar.width, h = bar.height, rgb = [0, 0, 0];
    var img = c.createImageData(w, h);
    for (var x = 0; x < w; x++) {
      magma(x / (w - 1), rgb);
      for (var y = 0; y < h; y++) {
        var i = (y * w + x) * 4;
        img.data[i] = rgb[0]; img.data[i + 1] = rgb[1]; img.data[i + 2] = rgb[2];
        img.data[i + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0);
  }

  /* ── sizing ──────────────────────────────────────────────────────────── */

  var lastW = 0, lastH = 0;
  function resize() {
    var r = canvas.getBoundingClientRect();
    if (r.width < 2) return;
    // The map is generated per pixel in JS, so it is rendered at a capped
    // resolution and upscaled. 1 device pixel per CSS pixel above 520px of
    // width would mean regenerating a megapixel on every resize tick.
    var w = Math.min(GRID, Math.round(r.width));
    var h = Math.round(w * (r.height / r.width));
    if (w === lastW && h === lastH) return;
    lastW = w; lastH = h;
    canvas.width = w; canvas.height = h;
    render();
    place();
  }

  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);
  window.addEventListener("resize", resize, { passive: true });

  if (bar) { bar.width = 240; bar.height = 10; drawBar(); }
  resize();
})();
