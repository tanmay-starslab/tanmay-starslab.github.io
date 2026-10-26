/* COSMOS — a different sky and a different galaxy merger on every visit.

   Two layers, one seed.

   THE NIGHT SKY (#sky-canvas, under the contrast shade). Drawn once per load,
   not animated: a Milky Way band at a random angle with a bulge and dark dust
   lanes, a few emission nebulae along it, and a few thousand stars whose
   counts follow a magnitude law (faint ones vastly outnumber bright ones) and
   whose colours are black-body colours for a spread of temperatures. It
   replaces the single fixed photograph, which stays in the page as the
   no-script fallback.

   THE MERGER (#galaxy-canvas, above the shade). Two disk galaxies on a
   parabolic encounter, Toomre & Toomre style: each galaxy is a softened point
   mass carrying a disk of test stars, the cores attract each other, and the
   stars only feel the cores. That is enough to raise the tidal tails and the
   bridge real interacting pairs show. On its own a parabolic orbit flies
   apart after one pass; a drag between the cores stands in for dynamical
   friction against their dark haloes, so the pair falls back and merges
   (tuned so every case merges within 12-23 time units). Mass ratio, disk
   tilts and spins, pericentre, viewing angle and the moment we join the
   encounter are all drawn from the seed, so one visit may land on an
   Antennae-like pair and the next on two long Mice-like tails.

   Interactive: the view tilts toward the pointer, and clicking empty sky in
   the hero (or the caption's button) drops a dwarf galaxy in, which the pair
   shreds into a stream. When the pair has merged and settled, a new encounter
   fades in.

   ?seed=12345 reproduces a sky exactly. Reduced motion (OS setting or the
   page's toggle) gets the same random sky and one still frame of the merger. */
(function () {
  "use strict";

  var skyHost = document.getElementById("galaxy-canvas");
  if (!skyHost || !skyHost.getContext) return;
  var ctx = skyHost.getContext("2d");
  if (!ctx) return;

  var root = document.documentElement;
  var rmQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  function motionOff() { return rmQuery.matches || root.classList.contains("motion-off"); }

  // ---- seed --------------------------------------------------------------
  var seed = (function () {
    var m = /[?&]seed=(\d+)/.exec(window.location.search);
    if (m) return (+m[1]) >>> 0;
    if (window.crypto && window.crypto.getRandomValues) {
      var a = new Uint32Array(1); window.crypto.getRandomValues(a); return a[0];
    }
    return (Math.random() * 4294967296) >>> 0;
  })();
  window.__cosmosSeed = seed;

  function mulberry32(a) {
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function range(r, lo, hi) { return lo + (hi - lo) * r(); }

  // ---- shared helpers ----------------------------------------------------
  // Black-body colour of a star at temperature T (K), as sRGB 0-255.
  // Tanner Helland's fit; good to a few per cent over 1000-40000 K.
  function blackbody(T) {
    var t = T / 100, r, g, b;
    if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; }
    else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); }
    if (t >= 66) b = 255; else if (t <= 19) b = 0; else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    function c(v) { return Math.max(0, Math.min(255, v)) | 0; }
    return [c(r), c(g), c(b)];
  }

  // Value noise + fbm, seeded.
  function makeNoise(r) {
    var perm = new Uint8Array(512), vals = new Float32Array(256), i;
    for (i = 0; i < 256; i++) { perm[i] = i; vals[i] = r(); }
    for (i = 255; i > 0; i--) { var j = (r() * (i + 1)) | 0, s = perm[i]; perm[i] = perm[j]; perm[j] = s; }
    for (i = 0; i < 256; i++) perm[i + 256] = perm[i];
    function lat(x, y) { return vals[perm[(perm[x & 255] + y) & 511]]; }
    function noise(x, y) {
      var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      var a = lat(xi, yi), b = lat(xi + 1, yi), c = lat(xi, yi + 1), d = lat(xi + 1, yi + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    return function fbm(x, y, oct) {
      var s = 0, a = 0.5, n = 0;
      for (var k = 0; k < oct; k++) { s += a * noise(x, y); n += a; x = x * 2.03 + 17.1; y = y * 2.03 - 9.7; a *= 0.5; }
      return s / n;
    };
  }
  function smooth(e0, e1, x) { var t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }

  // =========================================================================
  // THE NIGHT SKY
  // =========================================================================
  var skyCanvas = document.createElement("canvas");
  skyCanvas.id = "sky-canvas";
  skyCanvas.setAttribute("aria-hidden", "true");
  // Positioned inline as well as in the stylesheet: a visitor with the old CSS
  // cached would otherwise get this canvas in the page flow, above the content.
  skyCanvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;";
  var photo = document.querySelector(".cosmic-image-bg");
  (photo && photo.parentNode ? photo.parentNode : document.body).insertBefore(skyCanvas, photo ? photo.nextSibling : skyHost);

  var skyParams = (function () {
    var r = mulberry32(seed ^ 0x51ED270B);
    return {
      angle: range(r, 0, Math.PI),
      px: range(r, 0.25, 0.75), py: range(r, 0.2, 0.8),
      width: range(r, 0.075, 0.13),
      bulgeAt: range(r, -0.32, 0.32),
      bulgeGain: range(r, 0.55, 1.15),
      warmth: range(r, 0.15, 0.55),
      starDensity: range(r, 0.75, 1.15),
      nebulae: 1 + ((r() * 3) | 0),
      noiseSeed: (r() * 4294967296) >>> 0,
      starSeed: (r() * 4294967296) >>> 0
    };
  })();

  function drawSky() {
    var W = window.innerWidth, H = window.innerHeight;
    if (!W || !H) return;
    var scale = Math.min(window.devicePixelRatio || 1, 1.5);
    skyCanvas.width = Math.round(W * scale);
    skyCanvas.height = Math.round(H * scale);
    var c = skyCanvas.getContext("2d", { alpha: false });
    c.fillStyle = "#000"; c.fillRect(0, 0, skyCanvas.width, skyCanvas.height);
    var p = skyParams, diag = Math.hypot(W, H);
    var ca = Math.cos(p.angle), sa = Math.sin(p.angle), Px = p.px * W, Py = p.py * H;
    var w = p.width * diag;
    var fbm = makeNoise(mulberry32(p.noiseSeed));

    // The band, at a quarter of the resolution and smoothed up: it is diffuse
    // light, and computing it per device pixel would cost 16x for nothing.
    var cell = 4, lw = Math.ceil(W / cell), lh = Math.ceil(H / cell);
    var low = document.createElement("canvas"); low.width = lw; low.height = lh;
    var lc = low.getContext("2d"), img = lc.createImageData(lw, lh), d = img.data;
    var cool = [150, 172, 230], warm = [255, 214, 168];
    for (var j = 0; j < lh; j++) {
      for (var i = 0; i < lw; i++) {
        var x = i * cell, y = j * cell, dx = x - Px, dy = y - Py;
        var perp = -dx * sa + dy * ca, along = dx * ca + dy * sa;
        var g = Math.exp(-(perp * perp) / (w * w));
        var B = 0, mix = 0;
        if (g > 0.004) {
          var n1 = fbm(along / (0.16 * diag) + 3.1, perp / (0.09 * diag) + 7.3, 5);
          var bs = (along / diag - p.bulgeAt) / 0.2;
          var bulge = Math.exp(-bs * bs) * Math.exp(-(perp * perp) / (2.4 * w * w));
          var lane = smooth(0.5, 0.72, fbm(along / (0.075 * diag) + 41.7, perp / (0.028 * diag) - 12.2, 4))
                   * Math.exp(-(perp * perp) / (0.36 * w * w));
          B = (g * (0.38 + 0.62 * n1 * n1 * 1.6) + p.bulgeGain * bulge) * (1 - 0.82 * lane);
          mix = Math.min(1, p.warmth * 0.6 + bulge * 0.9 + 0.25 * n1);
        }
        var k = (j * lw + i) * 4, L = Math.min(1, B) * 205;
        d[k] = (cool[0] + (warm[0] - cool[0]) * mix) * L / 255;
        d[k + 1] = (cool[1] + (warm[1] - cool[1]) * mix) * L / 255;
        d[k + 2] = (cool[2] + (warm[2] - cool[2]) * mix) * L / 255;
        d[k + 3] = 255;
      }
    }
    lc.putImageData(img, 0, 0);
    c.save();
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high";
    c.globalCompositeOperation = "lighter";
    c.drawImage(low, 0, 0, skyCanvas.width, skyCanvas.height);
    c.restore();

    c.save();
    c.scale(scale, scale);
    c.globalCompositeOperation = "lighter";

    // Emission nebulae sitting in the band: H-alpha rose or [O III] teal.
    var rn = mulberry32(p.starSeed ^ 0x2545F491);
    for (var q = 0; q < p.nebulae; q++) {
      var t = range(rn, -0.35, 0.35) * diag, off = range(rn, -0.6, 0.6) * w;
      var nx = Px + ca * t - sa * off, ny = Py + sa * t + ca * off;
      var rad = range(rn, 0.03, 0.07) * diag;
      var col = rn() < 0.65 ? "255, 92, 128" : "70, 205, 196";
      for (var b = 0; b < 4; b++) {
        var bx = nx + range(rn, -0.5, 0.5) * rad, by = ny + range(rn, -0.5, 0.5) * rad, br = rad * range(rn, 0.45, 1);
        var gr = c.createRadialGradient(bx, by, 0, bx, by, br);
        gr.addColorStop(0, "rgba(" + col + ", 0.075)");
        gr.addColorStop(1, "rgba(" + col + ", 0)");
        c.fillStyle = gr; c.fillRect(bx - br, by - br, br * 2, br * 2);
      }
    }

    // Stars. dN/dm ~ 10^(0.3 m) between m = -0.5 and 7, so the sky is mostly
    // faint stars and a handful of bright ones, as it is.
    var rs = mulberry32(p.starSeed);
    var count = Math.round(W * H / 470 * p.starDensity);
    var lo = Math.pow(10, 0.3 * -0.5), hi = Math.pow(10, 0.3 * 7);
    for (var s = 0, placed = 0; placed < count && s < count * 4; s++) {
      var sx = rs() * W, sy = rs() * H, ddx = sx - Px, ddy = sy - Py, pp = -ddx * sa + ddy * ca;
      if (rs() > 0.28 + 0.72 * Math.exp(-(pp * pp) / (1.6 * w * w))) continue;   // crowd toward the band
      placed++;
      var m = Math.log(lo + rs() * (hi - lo)) / Math.LN10 / 0.3;
      var flux = Math.pow(10, -0.4 * m);
      var u = rs(), T = u < 0.55 ? range(rs, 3300, 6000) : u < 0.88 ? range(rs, 6000, 10000) : range(rs, 10000, 28000);
      var rgb = blackbody(T);
      var a = Math.min(1, 0.16 + 1.25 * Math.pow(flux, 0.45));
      var rad2 = 0.42 + 1.5 * Math.pow(flux, 0.38);
      if (m < 1.6) {
        var hr = rad2 * 7, hg = c.createRadialGradient(sx, sy, 0, sx, sy, hr);
        hg.addColorStop(0, "rgba(" + rgb + ", " + (0.22 * a).toFixed(3) + ")");
        hg.addColorStop(1, "rgba(" + rgb + ", 0)");
        c.fillStyle = hg; c.fillRect(sx - hr, sy - hr, hr * 2, hr * 2);
      }
      c.fillStyle = "rgba(" + rgb + ", " + a.toFixed(3) + ")";
      if (rad2 < 0.8) c.fillRect(sx, sy, rad2 * 1.4, rad2 * 1.4);
      else { c.beginPath(); c.arc(sx, sy, rad2, 0, 6.2832); c.fill(); }
    }
    c.restore();
    root.classList.add("sky-ready");
  }

  // =========================================================================
  // THE MERGER
  // =========================================================================
  var COARSE = window.matchMedia("(pointer: coarse)").matches;
  var lowCore = (navigator.hardwareConcurrency || 8) <= 4;
  var MAIN_N = (COARSE || lowCore || window.innerWidth < 760) ? 1500 : 3600;
  var DWARF_N = (COARSE || lowCore) ? 140 : 260;
  var DWARF_SLOTS = 3;
  var TOTAL = MAIN_N + DWARF_N * DWARF_SLOTS;
  var EPS2 = 0.15 * 0.15, KAPPA = 0.25, SPEED = 0.34;

  var pos = new Float32Array(TOTAL * 3), vel = new Float32Array(TOTAL * 3);
  var grp = new Uint8Array(TOTAL);   // colour group
  var live = new Uint8Array(TOTAL);
  var cores = [];                    // {m, x,y,z, vx,vy,vz, on, kappa}
  for (var ci = 0; ci < 2 + DWARF_SLOTS; ci++) cores.push({ m: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, on: false, born: 0 });

  // Colour groups: old warm core light, white mid-disk, blue outer disk and
  // tails, and rose H II knots.
  var GROUPS = [
    { rgb: "255, 214, 170", a: 0.62, s: 1.35 },
    { rgb: "232, 236, 255", a: 0.55, s: 1.25 },
    { rgb: "158, 196, 255", a: 0.6, s: 1.3 },
    { rgb: "255, 140, 172", a: 0.75, s: 2.1 },
    { rgb: "120, 228, 222", a: 0.72, s: 1.45 }
  ];
  // Each star is a small soft dot of light (a radial falloff baked once per
  // colour), drawn additively: where stars crowd, the disk glows; where they
  // thin out into a tail, single stars still read.
  GROUPS.forEach(function (g) {
    var sp = document.createElement("canvas"); sp.width = sp.height = 16;
    var x = sp.getContext("2d"), rg = x.createRadialGradient(8, 8, 0, 8, 8, 8);
    rg.addColorStop(0, "rgba(" + g.rgb + ", " + g.a + ")");
    rg.addColorStop(0.35, "rgba(" + g.rgb + ", " + (g.a * 0.45).toFixed(3) + ")");
    rg.addColorStop(1, "rgba(" + g.rgb + ", 0)");
    x.fillStyle = rg; x.fillRect(0, 0, 16, 16);
    g.sprite = sp; g.d = g.s * 2.6; g.h = g.d / 2;
  });

  var encounter = null, simT = 0, mergedFor = 0, settledFor = 0, fade = 0, fadeDir = 1, nextDwarf = 0;
  var rng = mulberry32(seed ^ 0x9E3779B9);

  function orthoBasis(nx, ny, nz) {
    var ax = Math.abs(nx) < 0.9 ? 1 : 0, ay = ax ? 0 : 1, az = 0;
    var ux = ay * nz - az * ny, uy = az * nx - ax * nz, uz = ax * ny - ay * nx;
    var ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
    return [ux, uy, uz, ny * uz - nz * uy, nz * ux - nx * uz, nx * uy - ny * ux];
  }

  // A disk of `n` test stars around core `c`, spin axis (nx,ny,nz), radius R.
  function seedDisk(start, n, c, nx, ny, nz, R, palette, r) {
    var b = orthoBasis(nx, ny, nz), M = c.m;
    for (var k = 0; k < n; k++) {
      var idx = start + k;
      // Area-uniform beyond a small core: tails are made of outer-disk stars,
      // so the outer disk needs them (Toomre & Toomre used evenly filled rings).
      var rr = R * (0.12 + 0.88 * Math.sqrt(r()));
      var ph = r() * Math.PI * 2, cp = Math.cos(ph), sp = Math.sin(ph);
      var h = (r() - 0.5) * 0.04 * R;
      var px = rr * (cp * b[0] + sp * b[3]) + h * nx, py = rr * (cp * b[1] + sp * b[4]) + h * ny, pz = rr * (cp * b[2] + sp * b[5]) + h * nz;
      var vc = Math.sqrt(M * rr * rr / Math.pow(rr * rr + EPS2, 1.5));
      var disp = 0.06 * vc;
      pos[idx * 3] = c.x + px; pos[idx * 3 + 1] = c.y + py; pos[idx * 3 + 2] = c.z + pz;
      vel[idx * 3] = c.vx + vc * (-sp * b[0] + cp * b[3]) + (r() - 0.5) * disp;
      vel[idx * 3 + 1] = c.vy + vc * (-sp * b[1] + cp * b[4]) + (r() - 0.5) * disp;
      vel[idx * 3 + 2] = c.vz + vc * (-sp * b[2] + cp * b[5]) + (r() - 0.5) * disp;
      var f = rr / R;
      grp[idx] = r() < 0.035 && f > 0.25 ? 3 : palette[f < 0.28 ? 0 : f < 0.6 ? 1 : 2];
      live[idx] = 1;
    }
  }

  function diskAxis(r, prograde) {
    var inc = prograde ? range(r, 0, 1.05) : range(r, 2.1, Math.PI), node = range(r, 0, Math.PI * 2);
    return [Math.sin(inc) * Math.cos(node), Math.sin(inc) * Math.sin(node), Math.cos(inc)];
  }

  function newEncounter() {
    var r = rng;
    var q = range(r, 0.3, 1), rp = range(r, 0.9, 1.6), M = 1 + q;
    var pro1 = r() < 0.7, pro2 = r() < 0.6;
    // Start at true anomaly -2 rad on the parabola; Barker's equation gives the
    // time to pericentre, used to choose how far into the story we join it.
    var f0 = -2.0, h = Math.sqrt(2 * M * rp), r0 = 2 * rp / (1 + Math.cos(f0));
    var D = Math.tan(f0 / 2), tPeri = -Math.sqrt(2 * rp * rp * rp / M) * (D + D * D * D / 3);
    var relx = r0 * Math.cos(f0), rely = r0 * Math.sin(f0);
    var vr = (M / h) * Math.sin(f0), vt = h / r0;
    var rvx = vr * Math.cos(f0) - vt * Math.sin(f0), rvy = vr * Math.sin(f0) + vt * Math.cos(f0);
    cores.forEach(function (c) { c.on = false; c.m = 0; });
    var a = cores[0], b = cores[1];
    a.m = 1; a.x = -q / M * relx; a.y = -q / M * rely; a.z = 0; a.vx = -q / M * rvx; a.vy = -q / M * rvy; a.vz = 0; a.on = true; a.kappa = KAPPA;
    b.m = q; b.x = relx / M; b.y = rely / M; b.z = 0; b.vx = rvx / M; b.vy = rvy / M; b.vz = 0; b.on = true; b.kappa = KAPPA;
    live.fill(0);
    var n1 = Math.round(MAIN_N * 1 / (1 + Math.pow(q, 0.7))), n2 = MAIN_N - n1;
    var ax1 = diskAxis(r, pro1), ax2 = diskAxis(r, pro2);
    seedDisk(0, n1, a, ax1[0], ax1[1], ax1[2], 1.0, [0, 1, 2], r);
    seedDisk(n1, n2, b, ax2[0], ax2[1], ax2[2], Math.sqrt(q), [0, 1, 4], r);
    // The view: orbit plane tilted 25-70 degrees from face-on, any roll.
    var tilt = range(r, 0.44, 1.22);
    encounter = {
      q: q, rp: rp, pro1: pro1, pro2: pro2, tilt: tilt,
      yaw: range(r, -0.5, 0.5), pitch: tilt, roll: range(r, 0, Math.PI * 2),
      fx: range(r, 0.62, 0.78), fy: range(r, 0.13, 0.24),
      // From just before the first pass to well into the tails: the part of
      // the story worth arriving in. The rest still plays out while you stay.
      join: tPeri + range(r, -0.8, 6.5),
      count: (encounter ? encounter.count : 0) + 1
    };
    simT = 0; mergedFor = 0; settledFor = 0;
    advance(encounter.join, 0.03);
    caption();
  }

  // Leapfrog (kick-drift-kick). Cores feel each other, plus a drag on their
  // relative motion when close (the dynamical-friction stand-in); stars feel
  // the cores only.
  var acc = new Float32Array(TOTAL * 3);
  function coreForces() {
    var n = cores.length;
    for (var i = 0; i < n; i++) { var c = cores[i]; c.ax = 0; c.ay = 0; c.az = 0; }
    for (i = 0; i < n; i++) {
      var A = cores[i]; if (!A.on) continue;
      for (var j = i + 1; j < n; j++) {
        var B = cores[j]; if (!B.on) continue;
        var dx = B.x - A.x, dy = B.y - A.y, dz = B.z - A.z, d2 = dx * dx + dy * dy + dz * dz;
        var g = 1 / Math.pow(d2 + EPS2, 1.5), dist = Math.sqrt(d2);
        var k = Math.max(A.kappa, B.kappa) / (1 + Math.pow(dist / 1.2, 3)), Mt = A.m + B.m;
        var dvx = B.vx - A.vx, dvy = B.vy - A.vy, dvz = B.vz - A.vz;
        A.ax += B.m * dx * g + k * dvx * B.m / Mt; A.ay += B.m * dy * g + k * dvy * B.m / Mt; A.az += B.m * dz * g + k * dvz * B.m / Mt;
        B.ax -= A.m * dx * g + k * dvx * A.m / Mt; B.ay -= A.m * dy * g + k * dvy * A.m / Mt; B.az -= A.m * dz * g + k * dvz * A.m / Mt;
      }
    }
  }
  function starForces() {
    for (var idx = 0; idx < TOTAL; idx++) {
      if (!live[idx]) continue;
      var x = pos[idx * 3], y = pos[idx * 3 + 1], z = pos[idx * 3 + 2], ax = 0, ay = 0, az = 0;
      for (var i = 0; i < cores.length; i++) {
        var c = cores[i]; if (!c.on) continue;
        var dx = c.x - x, dy = c.y - y, dz = c.z - z, g = c.m / Math.pow(dx * dx + dy * dy + dz * dz + EPS2, 1.5);
        ax += dx * g; ay += dy * g; az += dz * g;
      }
      acc[idx * 3] = ax; acc[idx * 3 + 1] = ay; acc[idx * 3 + 2] = az;
    }
  }
  function kick(h) {
    for (var i = 0; i < cores.length; i++) { var c = cores[i]; if (!c.on) continue; c.vx += c.ax * h; c.vy += c.ay * h; c.vz += c.az * h; }
    for (var k = 0; k < TOTAL * 3; k++) vel[k] += acc[k] * h;
  }
  function drift(h) {
    for (var i = 0; i < cores.length; i++) { var c = cores[i]; if (!c.on) continue; c.x += c.vx * h; c.y += c.vy * h; c.z += c.vz * h; }
    for (var k = 0; k < TOTAL * 3; k++) pos[k] += vel[k] * h;
  }
  function step(dt) {
    coreForces(); starForces(); kick(dt / 2); drift(dt); coreForces(); starForces(); kick(dt / 2);
    simT += dt;
    var a = cores[0], b = cores[1], sep = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (sep < 0.25) mergedFor += dt; else mergedFor = 0;
    if (mergedFor > 3) settledFor += dt;
  }
  function advance(T, dt) { for (var t = 0; t < T; t += dt) step(Math.min(dt, T - t)); }

  // ---- drawing ------------------------------------------------------------
  var W = 0, H = 0, dpr = 1, S = 1, cx = 0, cy = 0, textBox = null, heroBottom = 0;
  var view = { yaw: 0, pitch: 0 }, aim = { yaw: 0, pitch: 0 };
  var copyEl = document.querySelector(".hero-copy"), heroEl = document.getElementById("home");
  var meteors = [], nextMeteor = 0;

  function layout() {
    W = window.innerWidth; H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, COARSE ? 1.5 : 2);
    skyHost.width = Math.round(W * dpr); skyHost.height = Math.round(H * dpr);
    skyHost.style.width = W + "px"; skyHost.style.height = H + "px";
    measure();
  }
  function measure() {
    var e = encounter || { fx: 0.66, fy: 0.3 };
    if (W >= 900) { cx = W * e.fx; cy = H * e.fy; S = Math.min(W, H) * 0.155; }
    else { cx = W * 0.6; cy = H * 0.1; S = Math.min(W, H) * 0.12; }
    if (copyEl) {
      var r = copyEl.getBoundingClientRect();
      textBox = { l: r.left - 24, t: r.top - 24, r: r.right + 24, b: r.bottom + 24 };
    }
    heroBottom = heroEl ? heroEl.getBoundingClientRect().bottom + window.scrollY : H;
  }

  var dwarfSprite = null, coreSprite = (function () {
    var s = document.createElement("canvas"); s.width = s.height = 64;
    var g = s.getContext("2d"), rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, "rgba(255, 236, 214, 0.9)"); rg.addColorStop(0.18, "rgba(255, 214, 170, 0.35)");
    rg.addColorStop(0.5, "rgba(255, 190, 150, 0.08)"); rg.addColorStop(1, "rgba(255, 190, 150, 0)");
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64); return s;
  })();

  function draw(alphaScale) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // A short exposure trail: fade what is there instead of clearing it.
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    if (!encounter) return;

    var cyw = Math.cos(view.yaw + encounter.yaw), syw = Math.sin(view.yaw + encounter.yaw);
    var cpt = Math.cos(view.pitch + encounter.pitch), spt = Math.sin(view.pitch + encounter.pitch);
    var crl = Math.cos(encounter.roll), srl = Math.sin(encounter.roll);
    // R = Rx(pitch) * Ry(yaw) * Rz(roll)
    var r00 = cyw * crl, r01 = -cyw * srl, r02 = syw;
    var r10 = spt * syw * crl + cpt * srl, r11 = -spt * syw * srl + cpt * crl, r12 = -spt * cyw;
    var r20 = -cpt * syw * crl + spt * srl, r21 = cpt * syw * srl + spt * crl, r22 = cpt * cyw;
    // Frame on the main pair's centre of mass.
    var a = cores[0], b = cores[1], Mt = a.m + b.m;
    var ox = (a.x * a.m + b.x * b.m) / Mt, oy = (a.y * a.m + b.y * b.m) / Mt, oz = (a.z * a.m + b.z * b.m) / Mt;
    var tb = textBox;
    ctx.globalAlpha = alphaScale;
    for (var gi = 0; gi < GROUPS.length; gi++) {
      var G = GROUPS[gi], spr = G.sprite, sd = G.d, sh = G.h;
      for (var idx = 0; idx < TOTAL; idx++) {
        if (!live[idx] || grp[idx] !== gi) continue;
        var x = pos[idx * 3] - ox, y = pos[idx * 3 + 1] - oy, z = pos[idx * 3 + 2] - oz;
        var X = r00 * x + r01 * y + r02 * z, Y = r10 * x + r11 * y + r12 * z, Z = r20 * x + r21 * y + r22 * z;
        var pr = 1 / (1 + Z * 0.05), sx = cx + S * X * pr, sy = cy - S * Y * pr;
        if (sx < -4 || sy < -4 || sx > W + 4 || sy > H + 4) continue;
        // Behind the hero's words the stars thin to a third, so the text never
        // sits on a bright knot.
        if (tb && sx > tb.l && sx < tb.r && sy > tb.t && sy < tb.b && idx % 3) continue;
        ctx.drawImage(spr, sx - sh, sy - sh, sd, sd);
      }
    }
    for (var i = 0; i < cores.length; i++) {
      var c = cores[i]; if (!c.on) continue;
      var x2 = c.x - ox, y2 = c.y - oy, z2 = c.z - oz;
      var X2 = r00 * x2 + r01 * y2 + r02 * z2, Y2 = r10 * x2 + r11 * y2 + r12 * z2;
      var R2 = S * 0.62 * Math.sqrt(c.m) + 8, px = cx + S * X2, py = cy - S * Y2;
      // A core behind the words is dimmed the way the stars there are thinned.
      ctx.globalAlpha = alphaScale * (tb && px > tb.l && px < tb.r && py > tb.t && py < tb.b ? 0.3 : 1);
      ctx.drawImage(coreSprite, px - R2, py - R2, R2 * 2, R2 * 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawMeteors(now) {
    if (!nextMeteor) nextMeteor = now + 6000 + Math.random() * 14000;
    if (now > nextMeteor) {
      var ang = (Math.random() < 0.5 ? 1 : -1) * (0.35 + Math.random() * 0.5);
      meteors.push({ x: Math.random() * W, y: Math.random() * H * 0.5, ang: ang, len: 120 + Math.random() * 160, t0: now, dur: 650 + Math.random() * 400 });
      nextMeteor = now + 12000 + Math.random() * 26000;
    }
    for (var i = meteors.length - 1; i >= 0; i--) {
      var m = meteors[i], u = (now - m.t0) / m.dur;
      if (u >= 1) { meteors.splice(i, 1); continue; }
      var dx = Math.sin(m.ang), dy = Math.cos(m.ang), hx = m.x + dx * m.len * u * 1.6, hy = m.y + dy * m.len * u * 1.6;
      var tx = hx - dx * m.len, ty = hy - dy * m.len, gr = ctx.createLinearGradient(hx, hy, tx, ty);
      var a = Math.sin(Math.PI * u) * 0.85;
      gr.addColorStop(0, "rgba(240, 246, 255, " + a.toFixed(3) + ")"); gr.addColorStop(1, "rgba(240, 246, 255, 0)");
      ctx.strokeStyle = gr; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
    }
  }

  // ---- interaction --------------------------------------------------------
  function dropDwarf(sx, sy) {
    if (!encounter) return;
    var slot = -1, oldest = Infinity;
    for (var i = 2; i < cores.length; i++) {
      if (!cores[i].on) { slot = i; break; }
      if (cores[i].born < oldest) { oldest = cores[i].born; slot = i; }
    }
    var c = cores[slot], r = Math.random;
    // Screen point -> the plane through the pair's centre facing the viewer.
    var X = (sx - cx) / S, Y = -(sy - cy) / S;
    var cyw = Math.cos(view.yaw + encounter.yaw), syw = Math.sin(view.yaw + encounter.yaw);
    var cpt = Math.cos(view.pitch + encounter.pitch), spt = Math.sin(view.pitch + encounter.pitch);
    var crl = Math.cos(encounter.roll), srl = Math.sin(encounter.roll);
    var r00 = cyw * crl, r01 = -cyw * srl, r02 = syw;
    var r10 = spt * syw * crl + cpt * srl, r11 = -spt * syw * srl + cpt * crl, r12 = -spt * cyw;
    var a = cores[0], b = cores[1], Mt = a.m + b.m;
    var ox = (a.x * a.m + b.x * b.m) / Mt, oy = (a.y * a.m + b.y * b.m) / Mt, oz = (a.z * a.m + b.z * b.m) / Mt;
    var wx = r00 * X + r10 * Y, wy = r01 * X + r11 * Y, wz = r02 * X + r12 * Y;   // R^T [X Y 0]
    var dist = Math.max(1.5, Math.hypot(wx, wy, wz));
    var k = Math.min(1, 6 / dist); wx *= k; wy *= k; wz *= k; dist = Math.hypot(wx, wy, wz);
    var vesc = Math.sqrt(2 * Mt / dist), inx = -wx / dist, iny = -wy / dist, inz = -wz / dist;
    var tx = iny * 0.3 - inz * 0.9, ty = inz * 0.2 - inx * 0.3, tz = inx * 0.9 - iny * 0.2, tl = Math.hypot(tx, ty, tz) || 1;
    c.m = range(r, 0.07, 0.14); c.on = true; c.kappa = 0.6; c.born = performance.now();
    c.x = ox + wx; c.y = oy + wy; c.z = oz + wz;
    c.vx = (inx * 0.55 + tx / tl * 0.45) * vesc * 0.8;
    c.vy = (iny * 0.55 + ty / tl * 0.45) * vesc * 0.8;
    c.vz = (inz * 0.55 + tz / tl * 0.45) * vesc * 0.8;
    var start = MAIN_N + (slot - 2) * DWARF_N;
    var ax = [r() - 0.5, r() - 0.5, r() - 0.5], al = Math.hypot(ax[0], ax[1], ax[2]) || 1;
    // Teal, so the visitor can follow their own dwarf being torn into a stream.
    seedDisk(start, DWARF_N, c, ax[0] / al, ax[1] / al, ax[2] / al, 0.38, [4, 4, 4], r);
    for (var j = 0; j < DWARF_N; j++) acc[(start + j) * 3] = acc[(start + j) * 3 + 1] = acc[(start + j) * 3 + 2] = 0;
    caption(true);
  }

  function isEmptySky(e) {
    if (!heroEl || e.button !== 0) return false;
    var t = e.target;
    if (t && t.closest && t.closest("a, button, input, textarea, select, label, summary, img, figure, p, h1, h2, h3, li, [role='button'], .site-header, .header-toggle")) return false;
    var sel = window.getSelection && window.getSelection();
    if (sel && !sel.isCollapsed) return false;
    return e.clientY + window.scrollY < heroBottom;
  }

  // ---- caption --------------------------------------------------------------
  var note = document.getElementById("sky-note");
  var noteText = note && note.querySelector("[data-sky-text]");
  var noteBtn = note && note.querySelector("button");
  function caption(dwarfAdded) {
    if (!noteText || !encounter) return;
    var e = encounter, ratio = (1 / e.q).toFixed(1).replace(/\.0$/, "");
    var spin = e.pro1 && e.pro2 ? "both disks spinning with the orbit"
      : !e.pro1 && !e.pro2 ? "both disks spinning against the orbit"
      : "one disk spinning against the orbit";
    var deg = Math.round(e.tilt * 180 / Math.PI);
    var s = "This visit's sky: a 1 : " + ratio + " galaxy merger, " + spin + ", seen " + deg + "° from face-on.";
    if (e.count > 1) s = "Encounter " + e.count + " of this visit: a 1 : " + ratio + " merger, " + spin + ", seen " + deg + "° from face-on.";
    if (frozen) s += " Motion is off, so it holds still.";
    else if (dwarfAdded) s += " A dwarf galaxy is falling in.";
    noteText.textContent = s;
    note.hidden = false;
    if (noteBtn) noteBtn.hidden = frozen;
  }

  // ---- loop -------------------------------------------------------------------
  var frozen = motionOff(), rafId = 0, prev = 0, shown = !document.hidden, times = [], governed = false;

  function frame(now) {
    rafId = 0;
    if (frozen || !shown) return;
    var dtMs = prev ? Math.min(now - prev, 50) : 16.7; prev = now;
    view.yaw += (aim.yaw - view.yaw) * 0.04; view.pitch += (aim.pitch - view.pitch) * 0.04;

    var simDt = dtMs / 1000 * SPEED;
    var sub = Math.ceil(simDt / 0.02);
    for (var i = 0; i < sub; i++) step(simDt / sub);

    // Merged and settled: fade the remnant out and bring in a new encounter.
    if (settledFor > 14 || simT > 70) fadeDir = -1;
    fade = Math.max(0, Math.min(1, fade + fadeDir * dtMs / 1600));
    if (fadeDir < 0 && fade === 0) { newEncounter(); fadeDir = 1; measure(); }

    var scrollFade = Math.max(0.22, 1 - window.scrollY / (H * 1.1));
    if (copyEl && (window.scrollY !== frame.lastY)) { frame.lastY = window.scrollY; measure(); }
    draw(fade * scrollFade);
    drawMeteors(now);

    // Frame-time governor, as in plate-field.js: if this is hurting the page,
    // halve the stars rather than drop frames.
    times.push(dtMs);
    if (times.length > 90) {
      times.shift();
      if (!governed) {
        var sorted = times.slice().sort(function (p, q) { return p - q; });
        if (sorted[45] > 24) { governed = true; for (var k = 1; k < MAIN_N; k += 2) live[k] = 0; }
      }
    }
    rafId = window.requestAnimationFrame(frame);
  }
  function start() { if (!rafId && !frozen && shown) { prev = 0; rafId = window.requestAnimationFrame(frame); } }

  window.__startGalaxy = function () { frozen = motionOff(); if (!frozen) start(); };

  function stillFrame() {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, skyHost.width, skyHost.height);
    fade = 1; for (var i = 0; i < 3; i++) draw(1);   // three passes so the trail fill does not dim it
  }

  // ---- boot ---------------------------------------------------------------------
  drawSky();
  layout();
  newEncounter();
  measure();
  if (frozen) { stillFrame(); }
  else { fade = 0; fadeDir = 1; start(); }

  var resizeTimer = 0;
  window.addEventListener("resize", function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () { drawSky(); layout(); if (frozen) stillFrame(); }, 180);
  }, { passive: true });

  window.addEventListener("pointermove", function (e) {
    if (frozen || COARSE) return;
    aim.yaw = (e.clientX / W - 0.5) * 0.5;
    aim.pitch = (e.clientY / H - 0.5) * 0.32;
  }, { passive: true });

  document.addEventListener("click", function (e) {
    if (frozen || !isEmptySky(e)) return;
    dropDwarf(e.clientX, e.clientY);
  });
  if (noteBtn) noteBtn.addEventListener("click", function () {
    if (frozen) return;
    var ang = Math.random() * Math.PI * 2;
    dropDwarf(cx + Math.cos(ang) * S * 4.5, cy + Math.sin(ang) * S * 3);
  });

  document.addEventListener("visibilitychange", function () {
    shown = !document.hidden;
    if (shown) start();
  });
  function onRM() { frozen = motionOff(); if (frozen) { stillFrame(); caption(); } else { start(); caption(); } }
  if (typeof rmQuery.addEventListener === "function") rmQuery.addEventListener("change", onRM);
  else if (typeof rmQuery.addListener === "function") rmQuery.addListener(onRM);
})();
