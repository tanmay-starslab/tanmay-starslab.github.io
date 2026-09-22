/* Three behaviours, and nothing else.
   No IntersectionObserver, no requestAnimationFrame, no scroll listener:
   nothing on this page is hidden until script runs. */
(function () {
  "use strict";

  var header = document.querySelector("#header");
  var toggle = document.querySelector(".header-toggle");
  if (header && toggle) {
    var setOpen = function (open) {
      header.classList.toggle("header-show", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    };
    toggle.addEventListener("click", function () {
      setOpen(!header.classList.contains("header-show"));
    });
    document.querySelectorAll("#navmenu a[href^='#']").forEach(function (a) {
      a.addEventListener("click", function () { setOpen(false); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && header.classList.contains("header-show")) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  var year = document.querySelector("#year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
