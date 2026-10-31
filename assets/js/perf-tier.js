/*
  PERFORMANCE TIER — decided once, before any animation loop starts.

  Why this exists, measured rather than guessed. On a software rasteriser
  (no usable GPU: SwiftShader, llvmpipe, Mesa offscreen, Microsoft Basic
  Render Driver) the volumetric raymarch in plate-field.js renders at
  0.4fps even with an UNTHROTTLED cpu. It is not CPU-bound, so no amount of
  cores saves it: the shader is simply too expensive without hardware.
  plate-field's own frame-time governor does eventually notice and switch
  off, but it reacts in proportion to how slow the machine is — on a 1.2fps
  client it needs well over a minute — so the reader sits through the jank
  the governor exists to prevent. The fix is to not start at all where we
  can know in advance that it cannot work.

  The second loop, the canvas-2D starfield in snapfolio-astro.js, is
  CPU-bound and does scale: ~420 stars, ~10,000 neighbour-distance checks
  and ~500 arc fills per frame, plus a full-viewport radial gradient
  reallocated every frame. That one is tiered down rather than switched off.

  Measured on the same 6x-throttled, 2-core, 2GB profile:
    both loops, as shipped ............  1.2fps   TBT 21.5s
    starfield only (no raymarch) ......  8.6fps   TBT  5.6s
    neither loop ...................... 59.9fps   TBT  0.8s

  That last row was first read as "the styling is innocent". It is not: the
  run that produced it was a prefers-reduced-motion run, which silences the
  seven infinite CSS animations as WELL as both loops, so the loops were
  credited with the whole difference. Re-measured one variable at a time,
  with both loops already tiered down:
    CSS animations on ................  8.6fps
    CSS animations off ............... 59.9fps
    backdrop-filter off, anims on ....  8.6fps   (so the glass is innocent)
  The animations are a rasterisation cost, cumulative across all seven
  rather than owned by any one of them, and they are handled in CSS — see
  the data-gpu="software" block in snapfolio-astro.css. Nothing about the
  static styling is touched: the glass, grain and gradients all stay.

  A capable client is left EXACTLY as it was. This only ever subtracts work
  from machines that have been shown to be unable to do it.
*/
(function () {
  "use strict";

  var reasons = [];

  function num(v) { return typeof v === "number" && isFinite(v) ? v : 0; }

  // --- what GPU, if any? ------------------------------------------------
  // WEBGL_debug_renderer_info is the only honest way to find out, and it is
  // not universally available: Firefox hides it under
  // privacy.resistFingerprinting and some privacy builds strip it. Absence
  // is therefore NOT treated as "software" — that would needlessly strip the
  // field from capable Firefox readers. Absence falls through to the
  // frame-time governor, which still runs and is now quick to react.
  var softwareGL = false;
  var glKnown = false;
  var rendererName = "";
  try {
    var probe = document.createElement("canvas");
    probe.width = probe.height = 1;
    var pgl = probe.getContext("webgl2") || probe.getContext("webgl");
    if (!pgl) {
      // No WebGL at all. plate-field already handles this by removing its
      // canvas, but recording it keeps the starfield's tiering honest: it
      // becomes the only background layer and must stay affordable.
      softwareGL = true;
      glKnown = true;
      reasons.push("no-webgl");
    } else {
      var dbg = pgl.getExtension("WEBGL_debug_renderer_info");
      if (dbg) {
        rendererName = String(pgl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || "");
        glKnown = true;
        // Chrome reports software ANGLE as e.g.
        //   "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)) ...)"
        // so substring matching is the right shape here, not equality.
        if (/swiftshader|llvmpipe|softpipe|basic render|basic display|mesa offscreen|software rasterizer|\bsoftware\b/i.test(rendererName)) {
          softwareGL = true;
          reasons.push("software-renderer");
        }
      }
      var lose = pgl.getExtension("WEBGL_lose_context");
      if (lose) lose.loseContext();
    }
  } catch (e) {
    // A throwing probe tells us nothing about the GPU; leave it to the governor.
  }

  // --- how much machine? ------------------------------------------------
  var cores = num(navigator.hardwareConcurrency);
  // deviceMemory is the spec name; Chrome ships it as deviceMemory too, but
  // some builds only expose the older nonstandard spelling. Read both.
  var mem = num(navigator.deviceMemory) || num(navigator.deviceMemoryGB);
  var saveData = !!(navigator.connection && navigator.connection.saveData);

  if (cores && cores <= 2) reasons.push("cores<=2");
  else if (cores && cores <= 4) reasons.push("cores<=4");
  if (mem && mem <= 2) reasons.push("mem<=2gb");
  else if (mem && mem <= 4) reasons.push("mem<=4gb");
  if (saveData) reasons.push("save-data");

  var veryWeak = (cores && cores <= 2) || (mem && mem <= 2) || saveData;
  var weak = veryWeak || (cores && cores <= 4) || (mem && mem <= 4);

  // --- the decision -----------------------------------------------------
  // `gl` gates the raymarch only. It is allowed unless we positively know
  // the renderer is software: a weak CPU with a real GPU runs the shader
  // fine, because the shader does not run on the CPU.
  var name = softwareGL || veryWeak ? "minimal" : (weak ? "reduced" : "full");

  var tier = {
    name: name,
    // May the volumetric raymarch run at all?
    gl: !softwareGL,
    // Canvas-2D starfield budget.
    stars: name === "minimal" ? 70 : (name === "reduced" ? 160 : null), // null = unchanged
    // The two O(n*k) neighbour-linking passes — the most expensive part of
    // the starfield and the first thing to go.
    links: name === "full",
    // Fewer pixels is the cheapest win available on a weak client.
    maxDpr: name === "full" ? 2 : 1,
    // Should the starfield police its own frame time?
    governStarfield: name !== "full",
    softwareGL: softwareGL,
    glKnown: glKnown,
    renderer: rendererName,
    cores: cores || null,
    memory: mem || null,
    reasons: reasons
  };

  window.__perfTier = tier;

  // A hook for the page and for measurement: lets CSS and a probe see the
  // decision without re-deriving it.
  try {
    document.documentElement.setAttribute("data-perf-tier", name);
    // Separate from the tier on purpose. The tier mixes CPU and memory, but
    // the continuous CSS animations are a RASTERISATION cost: a 2-core
    // machine with a real GPU composites them fine, and should keep them.
    // Only a positively-identified software rasteriser loses them, so this
    // attribute is set only when the renderer is actually known.
    if (glKnown) {
      document.documentElement.setAttribute("data-gpu", softwareGL ? "software" : "hardware");
    }
  } catch (e) {}
})();
