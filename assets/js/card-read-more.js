/* READ MORE ON LONG CARDS (phones only).

   On a 390 px screen the research and earlier-research cards are walls of
   text: one card can run past a full screen before its tags appear. Here each
   card's body paragraphs are gathered into one block that the CSS clamps to
   about three lines below 641 px, with a real button to open it again.

   Nothing is removed: the text stays in the DOM and in the accessibility tree
   (aria-controls points at it), the figure, caption and tags never clamp, and
   without this script the CSS clamp never applies because it is keyed on the
   html.cards-clamp class set below. Desktop and the research rail (>= 900 px)
   are untouched: the clamp lives inside a max-width: 640px query and the
   button is hidden outside it. */
(function () {
  "use strict";

  var cards = document.querySelectorAll("#research .research-card, #past-projects .project-card");
  if (!cards.length || !window.matchMedia) return;

  var phone = window.matchMedia("(max-width: 640px)");
  var items = [];

  Array.prototype.forEach.call(cards, function (card, i) {
    // The paragraphs sit in .project-body or .research-copy when the card has
    // a figure, otherwise straight in the card.
    var host = card.querySelector(".project-body, .research-copy") || card;
    var paras = Array.prototype.filter.call(host.children, function (el) {
      return el.tagName === "P";
    });
    if (!paras.length) return;

    var text = document.createElement("div");
    text.className = "card-more-text";
    text.id = "card-more-" + (i + 1);
    host.insertBefore(text, paras[0]);
    paras.forEach(function (p) { text.appendChild(p); });

    // Every button says "Read more"; the hidden tail tells a screen reader
    // which card it opens, so a list of buttons is not six identical names.
    var title = card.querySelector("h3");
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card-more-toggle";
    btn.setAttribute("aria-controls", text.id);
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML = '<span class="card-more-label">Read more</span>' +
      (title ? '<span class="visually-hidden">: ' + escapeHtml(title.textContent.trim()) + "</span>" : "") +
      '<i class="bi bi-chevron-down" aria-hidden="true"></i>';
    text.parentNode.insertBefore(btn, text.nextSibling);

    btn.addEventListener("click", function () {
      var open = btn.getAttribute("aria-expanded") !== "true";
      setOpen(text, btn, open);
      // Closing a long card from its bottom would leave the reader far below
      // it; bring the button back into view so they keep their place.
      if (!open) {
        var top = btn.getBoundingClientRect().top;
        if (top < 0 || top > window.innerHeight) {
          window.scrollBy(0, top - window.innerHeight * 0.4);
        }
      }
      refreshTriggers();
    });

    items.push({ text: text, btn: btn });
  });

  if (!items.length) return;
  document.documentElement.classList.add("cards-clamp");

  function setOpen(text, btn, open) {
    text.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.querySelector(".card-more-label").textContent = open ? "Read less" : "Read more";
  }

  // A card that would hide two lines or fewer is left whole: the button is
  // about as tall as what it saves, so it would only add a click. Measured with
  // the clamp on, so it reruns when fonts land or the width changes; open
  // cards are left alone.
  function measure() {
    if (!phone.matches) return;
    items.forEach(function (it) {
      if (it.text.classList.contains("is-open")) return;
      it.text.classList.remove("is-short");
      var line = parseFloat(getComputedStyle(it.text).lineHeight) || 26;
      var short = it.text.scrollHeight - it.text.clientHeight <= line * 2 + 2;
      it.text.classList.toggle("is-short", short);
      it.btn.hidden = short;
    });
  }

  // Page height changed under ScrollTrigger; let it recompute its positions.
  function refreshTriggers() {
    if (window.ScrollTrigger && typeof window.ScrollTrigger.refresh === "function") {
      window.ScrollTrigger.refresh();
    }
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  measure();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  window.addEventListener("load", measure);

  var t;
  window.addEventListener("resize", function () {
    clearTimeout(t);
    t = setTimeout(measure, 150);
  });
  var onChange = function () { measure(); refreshTriggers(); };
  if (phone.addEventListener) phone.addEventListener("change", onChange);
  else if (phone.addListener) phone.addListener(onChange);
})();
