/* LANGUAGE PICKER AND ONE-TIME SUGGESTION.

   The picker is a <details> in the sidebar (tools/i18n/build.py writes it), so
   it opens and closes with the keyboard and works without this script. This
   script adds: Escape and outside clicks close it, a picked language is
   remembered, and, once, a small chip offering the visitor's own language
   (from navigator.languages) when the page is in another one. It never
   redirects: the chip is a link the visitor may follow or dismiss. */
(function () {
  "use strict";

  var KEY = "lang-choice";
  var picker = document.querySelector("[data-lang-picker]");
  if (!picker) return;
  var summary = picker.querySelector("summary");
  var links = Array.prototype.slice.call(picker.querySelectorAll("a[data-lang]"));
  var here = document.documentElement.getAttribute("lang") || "en";
  picker.addEventListener("toggle", function () {
    // Opening near the bottom of the scrollable sidebar must reveal all rows.
    if (picker.open) picker.scrollIntoView({ block: "nearest", inline: "nearest" });
  });

  function store(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* blocked storage */ } }
  function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }

  links.forEach(function (a) {
    // Switching language keeps the current section, including modified clicks.
    function keepSection() {
      a.setAttribute("href", a.getAttribute("href").split("#")[0] + (location.hash || ""));
    }
    keepSection();
    window.addEventListener("hashchange", keepSection);
    a.addEventListener("click", function () { keepSection(); store(a.getAttribute("data-lang")); });
  });

  picker.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && picker.open) {
      picker.open = false;
      summary.focus();
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && picker.open) {
      var i = links.indexOf(document.activeElement);
      var n = e.key === "ArrowDown" ? i + 1 : (i < 0 ? links.length - 1 : i - 1);
      links[(n + links.length) % links.length].focus();
      e.preventDefault();
    }
  });
  document.addEventListener("click", function (e) {
    if (picker.open && !picker.contains(e.target)) picker.open = false;
  });

  /* ---------- the one-time suggestion ---------- */
  // Offered once per browser: shown, followed, dismissed or ignored, it does not come back.
  var SEEN = "lang-suggested";
  try { if (stored() || localStorage.getItem(SEEN)) return; } catch (e) { return; }
  var codes = links.map(function (a) { return a.getAttribute("data-lang"); });
  function match(tag) {
    tag = String(tag || "").toLowerCase();
    if (!tag) return null;
    // Do not offer Simplified Chinese to an explicitly Traditional browser.
    if (/^zh(?:-|$)/.test(tag)) {
      if (/^zh-(?:hant|tw|hk|mo)(?:-|$)/.test(tag)) return null;
      return codes.indexOf("zh-Hans") >= 0 ? "zh-Hans" : null;
    }
    var base = tag.split("-")[0];
    return codes.indexOf(base) >= 0 ? base : null;
  }
  var prefs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language];
  var want = null;
  for (var i = 0; i < prefs.length && !want; i++) want = match(prefs[i]);
  if (!want || want === here) return;
  var target = links[codes.indexOf(want)];
  var text = target.getAttribute("data-suggest");
  if (!text) return;

  var chip = document.createElement("div");
  chip.className = "lang-suggest";
  chip.setAttribute("role", "region");
  chip.setAttribute("aria-label", target.textContent);
  chip.setAttribute("lang", want);
  chip.setAttribute("dir", target.getAttribute("dir") || "ltr");
  if (target.getAttribute("dir")) chip.setAttribute("dir", target.getAttribute("dir"));
  var go = document.createElement("a");
  go.href = target.getAttribute("href") + (location.hash || "");
  go.hreflang = want;
  go.innerHTML = '<i class="bi bi-translate" aria-hidden="true"></i>';
  go.appendChild(document.createTextNode(" " + text));
  go.addEventListener("click", function () { store(want); });
  var x = document.createElement("button");
  x.type = "button";
  x.setAttribute("aria-label", target.getAttribute("data-dismiss") || "Dismiss");
  x.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
  x.addEventListener("click", function () {
    store(here);
    chip.remove();
  });
  chip.appendChild(go);
  chip.appendChild(x);
  document.body.appendChild(chip);
  try { localStorage.setItem(SEEN, "1"); } catch (e) { /* blocked storage */ }
})();
