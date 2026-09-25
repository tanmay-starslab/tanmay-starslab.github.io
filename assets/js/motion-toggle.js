/* THE MOTION TOGGLE.
   prefers-reduced-motion is an operating-system setting. Plenty of people want
   a calmer version of one page without changing it for their whole machine,
   and plenty of others are on a machine they do not administer. This is that
   control, and it is the only motion switch on the page that a reader can
   actually find.

   It RELOADS rather than tearing down live, and that is deliberate. Three
   independent systems own motion here — the WebGL field, the GSAP
   choreography, and the CSS transitions — each with its own teardown path, its
   own idea of what "off" means, and in one case a deliberately one-way switch.
   Unwinding all three in place would leave a state none of them is tested in,
   and the failure mode is a half-stopped page for the reader least able to
   tolerate one. A reload costs a moment and produces exactly the page the
   setting describes. Scroll position is restored by the browser. */
(function () {
  "use strict";

  var btn = document.getElementById("motion-toggle");
  if (!btn) return;

  var STORE = "motion";
  function stored() {
    try { return window.localStorage ? localStorage.getItem(STORE) : null; }
    catch (e) { return null; }
  }
  function store(v) {
    try { if (window.localStorage) localStorage.setItem(STORE, v); }
    catch (e) { /* blocked storage: the toggle still works for this page view */ }
  }

  var osReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var off = document.documentElement.classList.contains("motion-off");

  function paint() {
    btn.setAttribute("aria-pressed", off ? "true" : "false");
    // When the OS already asks for reduced motion the page is calm regardless,
    // so say so rather than offering a switch that appears to do nothing.
    if (osReduced && !off) {
      btn.setAttribute("title", "Your system already asks for reduced motion.");
    } else {
      btn.removeAttribute("title");
    }
  }
  paint();

  if ("scrollRestoration" in window.history) window.history.scrollRestoration = "auto";

  btn.addEventListener("click", function () {
    off = !off;
    store(off ? "off" : "on");
    // Apply the class first so that if the reload is blocked or slow, the CSS
    // half of the change has already landed.
    document.documentElement.classList.toggle("motion-off", off);
    paint();
    window.location.reload();
  });

  // Storage is shared across tabs; a reader who toggles in one should not find
  // the other disagreeing when they switch back to it.
  window.addEventListener("storage", function (e) {
    if (e.key !== STORE) return;
    off = stored() === "off";
    document.documentElement.classList.toggle("motion-off", off);
    paint();
  });
})();
