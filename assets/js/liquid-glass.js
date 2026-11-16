/* Liquid glass for the desktop sidebar and the page's buttons (styles: assets/css/liquid-glass.css).
 *
 * The sidebar drop borrows the phone pill's physics (assets/js/liquid-nav.js): two spring bodies on the drop's top
 * edge, a stiff lead (k 210, c 25) and a soft tail (k 72, c 13) that follows the same target 70 ms later. The drop
 * spans both bodies, so it stretches along its travel and gathers up behind; it narrows with speed, and a third,
 * lightly damped "jelly" spring kicked by the lead's deceleration gives the soft wobble as it settles. It is one DOM
 * element (no WebGL context: the page already runs WebGL sky and nebula). The active item comes from the existing
 * scrollspy in snapfolio-astro.js (the .active class on #navmenu links), plus the clicked item at once on a click.
 * The specular highlight leans towards the pointer while it is over the nav.
 *
 * Buttons and chips (.lg-gloss): pointer-following highlight through --gx / --gy, a press squish and a ripple from the
 * press point (from the centre for a keyboard press).
 * Reduced motion (prefers-reduced-motion or html.motion-off): the drop jumps, nothing squishes, ripples or follows.
 */
(function () {
  "use strict";
  var root = document.documentElement;
  var mqReduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : {matches: false};
  var reduced = function () { return mqReduce.matches || root.classList.contains("motion-off"); };
  var now = function () { return performance.now() / 1000; };

  /* ================================================================== glossy controls */
  var GLOSS = [".header-container .motion-toggle", ".social-links a", ".btn", ".hero-links a", ".card-button", ".chip-link", "#navmenu a"].join(",");
  function tagGloss(scope) {
    Array.prototype.forEach.call((scope || document).querySelectorAll(GLOSS), function (el) { el.classList.add("lg-gloss"); });
  }
  tagGloss();
  var glossOf = function (t) { return t && t.closest ? t.closest(".lg-gloss") : null; };
  var squishes = function (el) { return !el.closest("#navmenu"); };   /* nav links ripple but do not squish */

  var pend = null, pendX = 0, pendY = 0, glossRaf = 0;
  document.addEventListener("pointermove", function (ev) {
    if (ev.pointerType === "touch" || reduced()) return;
    var el = glossOf(ev.target); if (!el) return;
    pend = el; pendX = ev.clientX; pendY = ev.clientY;
    if (!glossRaf) glossRaf = requestAnimationFrame(function () {
      glossRaf = 0; if (!pend) return;
      var r = pend.getBoundingClientRect();
      pend.style.setProperty("--gx", (pendX - r.left).toFixed(1) + "px");
      pend.style.setProperty("--gy", (pendY - r.top).toFixed(1) + "px");
    });
  }, {passive: true});

  function ripple(el, x, y) {
    if (reduced()) return;
    var r = el.getBoundingClientRect();
    var dx = Math.max(x, r.width - x), dy = Math.max(y, r.height - y), s = 2 * Math.sqrt(dx * dx + dy * dy);
    var sp = document.createElement("span");
    sp.className = "lg-ripple"; sp.setAttribute("aria-hidden", "true");
    sp.style.setProperty("--rx", x.toFixed(1) + "px"); sp.style.setProperty("--ry", y.toFixed(1) + "px"); sp.style.setProperty("--rs", s.toFixed(1) + "px");
    el.appendChild(sp);
    var done = function () { if (sp.parentNode) sp.parentNode.removeChild(sp); };
    sp.addEventListener("animationend", done); setTimeout(done, 1200);
  }
  var pressed = null;
  function release() {
    var el = pressed; pressed = null; if (!el) return;
    el.classList.remove("lg-press");
    if (reduced() || !squishes(el)) return;
    el.classList.remove("lg-release"); void el.offsetWidth; el.classList.add("lg-release");
  }
  document.addEventListener("pointerdown", function (ev) {
    if (ev.button !== 0) return;
    var el = glossOf(ev.target); if (!el) return;
    var r = el.getBoundingClientRect();
    ripple(el, ev.clientX - r.left, ev.clientY - r.top);
    if (reduced() || !squishes(el)) return;
    pressed = el; el.classList.remove("lg-release"); el.classList.add("lg-press");
  }, {passive: true});
  ["pointerup", "pointercancel", "dragstart"].forEach(function (t) { document.addEventListener(t, release, {passive: true}); });
  document.addEventListener("pointerout", function (ev) { if (pressed && ev.target === pressed && !pressed.contains(ev.relatedTarget)) release(); }, {passive: true});
  document.addEventListener("animationend", function (ev) { if (ev.animationName === "lg-release") ev.target.classList.remove("lg-release"); });
  /* keyboard press (Enter / Space fire a click with detail 0): ripple from the centre */
  document.addEventListener("click", function (ev) {
    if (ev.detail !== 0) return;
    var el = glossOf(ev.target); if (!el) return;
    ripple(el, el.offsetWidth / 2, el.offsetHeight / 2);
  }, true);

  /* ================================================================== the sidebar drop */
  var nav = document.getElementById("navmenu");
  var list = nav && nav.querySelector("ul");
  if (!list) return;
  var links = Array.prototype.slice.call(list.querySelectorAll("a"));
  if (!links.length) return;
  var mqDesk = window.matchMedia ? window.matchMedia("(min-width: 1200px)") : {matches: true};

  var drop = document.createElement("span");
  drop.className = "lg-drop"; drop.setAttribute("aria-hidden", "true");
  list.insertBefore(drop, list.firstChild);
  nav.classList.add("lg-ready");

  var LEAD = {k: 210, c: 25}, TAIL = {k: 72, c: 13}, JELLY = {k: 230, c: 7}, TAIL_DELAY = 0.07;
  var lead = {x: 0, v: 0}, tail = {x: 0, v: 0}, hb = {x: 44, v: 0}, jelly = {x: 0, v: 0};
  var target = 0, prevTarget = 0, targetH = 44, targetT = -1, active = -1, shown = false, placed = false;
  var lockIdx = -1, lockUntil = 0, raf = 0, last = 0, visible = true;
  var hi = {x: 0.28, y: 0.22, tx: 0.28, ty: 0.22};   /* highlight position as fractions of the drop */

  function geom(i) {
    var lr = list.getBoundingClientRect(), r = links[i].getBoundingClientRect();
    return {top: r.top - lr.top, h: r.height};
  }
  function current() {
    for (var i = 0; i < links.length; i++) if (links[i].classList.contains("active")) return i;
    return -1;
  }
  function setActive(i, instant) {
    if (i === active && !instant) return;
    active = i;
    if (i < 0) { shown = false; drop.classList.remove("lg-on"); return; }
    if (!mqDesk.matches) return;
    var g = geom(i);
    if (instant || reduced() || !placed || !shown) {
      lead.x = tail.x = target = prevTarget = g.top; lead.v = tail.v = 0; hb.x = targetH = g.h; hb.v = 0; jelly.x = jelly.v = 0;
      placed = true; render();
    } else {
      prevTarget = target; target = g.top; targetH = g.h; targetT = now();
    }
    shown = true; drop.classList.add("lg-on");
    wake();
  }
  function remeasure() {
    if (active < 0 || !mqDesk.matches) return;
    var g = geom(active); target = g.top; targetH = g.h;
    if (reduced() || (Math.abs(lead.v) < 1 && Math.abs(tail.v) < 1)) { lead.x = tail.x = prevTarget = target; hb.x = targetH; render(); }
    wake();
  }

  function spring(b, to, s, dt, f) { var a = s.k * (to - b.x) - s.c * b.v + (f || 0); b.v += a * dt; b.x += b.v * dt; return a; }
  function step(dt) {
    var tailTo = (now() - targetT < TAIL_DELAY) ? prevTarget : target, n = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / n;
    for (var s = 0; s < n; s++) {
      var v0 = lead.v, acc = spring(lead, target, LEAD, h);
      spring(tail, tailTo, TAIL, h); spring(hb, targetH, LEAD, h);
      /* deceleration along the travel squashes the drop, then it rebounds: the settle wobble */
      var decel = v0 !== 0 ? -acc * (v0 > 0 ? 1 : -1) : 0;
      spring(jelly, 0, JELLY, h, decel > 0 && Math.abs(v0) > 60 ? -decel * 0.0016 : 0);
      jelly.x = Math.max(-0.09, Math.min(0.09, jelly.x));
    }
    hi.x += (hi.tx - hi.x) * Math.min(1, dt * 9); hi.y += (hi.ty - hi.y) * Math.min(1, dt * 9);
  }
  function render() {
    var top = Math.min(lead.x, tail.x), span = Math.abs(lead.x - tail.x), sp = Math.abs(lead.v);
    var sx = 1 - Math.min(0.07, sp / 9000) - jelly.x * 0.5, sy = 1 + jelly.x;
    drop.style.height = (hb.x + span).toFixed(2) + "px";
    drop.style.transform = "translate3d(0," + top.toFixed(2) + "px,0) scale(" + sx.toFixed(4) + "," + sy.toFixed(4) + ")";
    drop.style.setProperty("--dx", (hi.x * 100).toFixed(1) + "%");
    drop.style.setProperty("--dy", (hi.y * 100).toFixed(1) + "%");
  }
  function busy() {
    return Math.abs(target - lead.x) > 0.05 || Math.abs(lead.v) > 0.5 || Math.abs(target - tail.x) > 0.05 || Math.abs(tail.v) > 0.5 ||
      Math.abs(targetH - hb.x) > 0.05 || Math.abs(jelly.x) > 0.0005 || Math.abs(jelly.v) > 0.005 ||
      Math.abs(hi.tx - hi.x) > 0.002 || Math.abs(hi.ty - hi.y) > 0.002;
  }
  function frame() {
    raf = 0;
    if (!visible || !mqDesk.matches) { last = 0; return; }
    /* up to 0.25 s per frame (sub-stepped at 240 Hz), so a slow machine sees the same timing, not slow motion */
    var t = now(), dt = Math.min(0.25, last ? t - last : 1 / 60); last = t;
    if (reduced()) { lead.x = tail.x = target; lead.v = tail.v = 0; hb.x = targetH; jelly.x = jelly.v = 0; hi.x = hi.tx; hi.y = hi.ty; }
    else step(dt);
    render();
    if (busy() && !reduced()) raf = requestAnimationFrame(frame); else last = 0;
  }
  function wake() { if (!raf && visible && mqDesk.matches) { last = 0; raf = requestAnimationFrame(frame); } }

  /* the existing scrollspy toggles .active on every scroll event: batch to one read per frame */
  var syncQueued = false;
  function sync() {
    syncQueued = false;
    var i = current();
    if (now() < lockUntil && i !== lockIdx) return;   /* a click's jump passes other sections: hold the clicked item */
    setActive(i);
  }
  new MutationObserver(function () { if (!syncQueued) { syncQueued = true; requestAnimationFrame(sync); } })
    .observe(list, {subtree: true, attributes: true, attributeFilter: ["class"]});
  links.forEach(function (a, i) {
    a.addEventListener("click", function () {
      if ((a.getAttribute("href") || "").charAt(0) !== "#") return;
      lockIdx = i; lockUntil = now() + 0.9; setActive(i);
      setTimeout(sync, 950);
    });
  });

  /* highlight leans towards the pointer while it is over the nav */
  list.addEventListener("pointermove", function (ev) {
    if (reduced() || ev.pointerType === "touch") return;
    var r = drop.getBoundingClientRect(); if (!r.height) return;
    hi.tx = Math.max(0.1, Math.min(0.9, (ev.clientX - r.left) / r.width));
    hi.ty = Math.max(0.12, Math.min(0.88, (ev.clientY - r.top) / r.height));
    wake();
  }, {passive: true});
  list.addEventListener("pointerleave", function () { hi.tx = 0.28; hi.ty = 0.22; wake(); });

  if ("ResizeObserver" in window) new ResizeObserver(remeasure).observe(list);
  else window.addEventListener("resize", remeasure);
  var onDesk = function () { if (mqDesk.matches) { placed = false; setActive(current() >= 0 ? current() : active, true); } };
  if (mqDesk.addEventListener) mqDesk.addEventListener("change", onDesk);
  if (mqReduce.addEventListener) mqReduce.addEventListener("change", function () { setActive(active, true); });
  document.addEventListener("visibilitychange", function () { visible = !document.hidden; if (visible) wake(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
  window.addEventListener("load", function () { setActive(current(), true); });

  setActive(current(), true);
  nav.liquidGlass = {state: function () { return {active: active, shown: shown, lead: lead.x, tail: tail.x, target: target, h: hb.x, jelly: jelly.x}; }};
})();
