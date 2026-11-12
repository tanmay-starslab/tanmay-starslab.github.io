/* THE THEME TOGGLE.
   The theme is set before first paint by the inline head script (the
   visitor's stored choice, else their system setting). This button flips it,
   remembers the choice, and tells the sky scripts, which only draw at night:
   in light mode the night sky, the galaxy merger and the warp are light drawn
   on black and have no place on paper, so they stop and hide.
   Until the visitor chooses, the page keeps following the system setting. */
(function () {
  "use strict";

  var root = document.documentElement;
  var buttons = document.querySelectorAll(".theme-toggle");
  var sys = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;

  function stored() {
    try { var t = localStorage.getItem("theme"); return t === "light" || t === "dark" ? t : null; }
    catch (e) { return null; }
  }

  function paint() {
    var light = root.getAttribute("data-theme") === "light";
    buttons.forEach(function (b) {
      // The label says what the button DOES. Because the label itself flips,
      // the button carries no aria-pressed: "Dark mode, pressed" in light mode
      // announced the opposite of what the page was showing.
      var icon = b.querySelector("i"), label = b.querySelector("span");
      if (icon) icon.className = light ? "bi bi-moon-stars" : "bi bi-sun";
      if (label) label.textContent = light ? "Dark mode" : "Light mode";
    });
  }

  function apply(theme) {
    root.setAttribute("data-theme", theme);
    paint();
    window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: theme } }));
  }

  paint();

  buttons.forEach(function (b) {
    b.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      try { localStorage.setItem("theme", next); } catch (e) { /* choice lasts this page view */ }
      apply(next);
    });
  });

  if (sys) {
    var follow = function (e) { if (!stored()) apply(e.matches ? "light" : "dark"); };
    if (typeof sys.addEventListener === "function") sys.addEventListener("change", follow);
    else if (typeof sys.addListener === "function") sys.addListener(follow);
  }

  // Another tab changed it: follow along.
  window.addEventListener("storage", function (e) {
    if (e.key === "theme" && (e.newValue === "light" || e.newValue === "dark")) apply(e.newValue);
  });
})();
