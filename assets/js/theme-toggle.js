/* THE THEME SWITCH. Three themes:
     light     warm paper (light-theme.css)
     dark      near-black, neutral (dark-theme.css); the default on a dark device
     midnight  the original navy/violet night page (the token set in snapfolio-astro.css)
   The theme is set before first paint by the inline head script (the
   visitor's stored choice, else their system setting: light -> Light,
   dark -> Dark). This button steps through Light -> Dark -> Midnight -> Light,
   remembers the choice, and tells the sky scripts, which only draw at night:
   in light mode the night sky, the galaxy merger and the warp are light drawn
   on black and have no place on paper, so they stop and hide.
   Until the visitor chooses, the page keeps following the system setting.
   A "dark" stored before Midnight existed now means the new Dark theme. */
(function () {
  "use strict";
  /* Translated pages pass their strings in as window.I18N (tools/i18n/build.py); English is the fallback. */
  var tr = function (k, s) { var d = window.I18N; return (d && typeof d[k] === "string" && d[k]) || s; };

  var THEMES = ["dark", "light", "midnight"];   // owner 2026-11-16: the order the button cycles
  var ICONS = { light: "bi bi-sun", dark: "bi bi-moon", midnight: "bi bi-moon-stars" };
  function name(t) {
    if (t === "light") return tr("js.theme_name_light", "Light");
    if (t === "midnight") return tr("js.theme_name_midnight", "Midnight");
    return tr("js.theme_name_dark", "Dark");
  }
  function fill(s, map) { return s.replace(/\{(\w+)\}/g, function (m, k) { return k in map ? map[k] : m; }); }

  var root = document.documentElement;
  var buttons = document.querySelectorAll(".theme-toggle");
  var sys = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;

  function valid(t) { return THEMES.indexOf(t) >= 0; }
  function stored() {
    try { var t = localStorage.getItem("theme"); return valid(t) ? t : null; }
    catch (e) { return null; }
  }
  function current() { var t = root.getAttribute("data-theme"); return valid(t) ? t : "dark"; }
  function nextOf(t) { return THEMES[(THEMES.indexOf(t) + 1) % THEMES.length]; }

  function paint() {
    var t = current(), n = nextOf(t);
    buttons.forEach(function (b) {
      // The visible label names the theme in use; the accessible name adds
      // what pressing does, so a screen reader hears both the state and the action.
      var icon = b.querySelector("i"), label = b.querySelector("span");
      var shown = fill(tr("js.theme_current", "Theme: {name}"), { name: name(t) });
      var full = fill(tr("js.theme_button", "Theme: {current}. Switch to {next}."), { current: name(t), next: name(n) });
      if (icon) icon.className = ICONS[t];
      if (label) label.textContent = shown;
      b.setAttribute("aria-label", full);
      b.setAttribute("title", full);
      b.setAttribute("data-theme-current", t);
    });
  }

  function apply(theme) {
    root.setAttribute("data-theme", theme);
    paint();
    window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: theme } }));
  }

  paint();

  // A native <button>: Enter and Space press it, so the cycle is keyboard
  // accessible without extra key handling.
  buttons.forEach(function (b) {
    b.addEventListener("click", function () {
      var next = nextOf(current());
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
    if (e.key === "theme" && valid(e.newValue)) apply(e.newValue);
  });
})();
