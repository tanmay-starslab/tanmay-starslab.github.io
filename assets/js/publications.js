/* Publications: a "Cite" button that copies each paper's BibTeX, and a phone-
   only "Show all publications" toggle. Everything here is progressive: the
   Cite buttons and the toggle ship with `hidden`, so a page without scripting
   shows every card and no button that would do nothing. */
(function () {
  "use strict";
  /* Translated pages pass their strings in as window.I18N (tools/i18n/build.py); English is the fallback. */
  var tr = function (k, s) { var d = window.I18N; return (d && typeof d[k] === "string" && d[k]) || s; };

  const section = document.getElementById("publications");
  if (!section) return;

  /* ---------- Cite: copy BibTeX ---------- */
  const status = section.querySelector("[data-cite-status]");

  // navigator.clipboard needs a secure context and can be refused; the
  // textarea + execCommand path still works in older and embedded browsers.
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
    }
    return legacyCopy(text);
  }

  function legacyCopy(text) {
    return new Promise((resolve, reject) => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      ta.remove();
      ok ? resolve() : reject(new Error("copy failed"));
    });
  }

  section.querySelectorAll("[data-cite]").forEach((btn) => {
    const card = btn.closest(".publication-card");
    const tpl = card && card.querySelector("template[data-bibtex]");
    if (!tpl) return;
    // template.content.textContent decodes entities, so what lands on the
    // clipboard is the BibTeX exactly as written.
    const bibtex = tpl.content.textContent.trim();
    const label = btn.querySelector("[data-cite-label]");
    const title = card.querySelector("h3");
    btn.setAttribute("aria-label", tr("js.cite_for", "Copy BibTeX for {title}").replace("{title}", title ? title.textContent.trim() : tr("js.this_paper", "this paper")));
    btn.hidden = false;

    let timer = 0;
    btn.addEventListener("click", () => {
      copyText(bibtex).then(() => {
        label.textContent = tr("js.copied", "Copied");
        btn.classList.add("is-copied");
        // Clear first so the same message is announced again on a repeat copy.
        if (status) { status.textContent = ""; status.textContent = tr("js.bibtex_copied", "BibTeX copied to clipboard"); }
      }, () => {
        label.textContent = tr("js.copy_failed", "Copy failed");
        if (status) status.textContent = tr("js.bibtex_failed", "Could not copy BibTeX");
      });
      clearTimeout(timer);
      timer = setTimeout(() => {
        label.textContent = tr("js.cite", "Cite");
        btn.classList.remove("is-copied");
      }, 2000);
    });
  });

  /* ---------- Phones: first three, then "Show all" ---------- */
  const list = document.getElementById("publication-list");
  const more = section.querySelector(".publication-more");
  if (!list || !more) return;

  const cards = list.querySelectorAll(".publication-card");
  const VISIBLE = 3;
  if (cards.length <= VISIBLE) return;

  // The CSS only collapses inside the phone media query, so the class can stay
  // on at every width; resizing to desktop simply shows everything.
  const phone = window.matchMedia("(max-width: 640px)");
  function setExpanded(expanded) {
    list.classList.toggle("is-collapsed", !expanded);
    more.setAttribute("aria-expanded", String(expanded));
    more.textContent = expanded ? tr("js.pubs_fewer", "Show fewer publications") : tr("js.pubs_all", "Show all publications");
    // Cards that were display:none never crossed the reveal observer, so mark
    // them visible now rather than leave them at opacity 0 until a scroll.
    if (expanded) cards.forEach((c) => c.classList.add("is-visible"));
    // Height changed, so pinned/scrubbed triggers further down must re-measure.
    // Only when it really changed: at desktop widths the CSS ignores the class.
    if (window.ScrollTrigger && phone.matches) window.ScrollTrigger.refresh();
  }

  more.hidden = false;
  setExpanded(false);

  more.addEventListener("click", () => {
    const expand = more.getAttribute("aria-expanded") !== "true";
    setExpanded(expand);
    if (expand) {
      // Move focus to the first revealed card's first link, so keyboard and
      // screen-reader users land on the new content.
      const first = cards[VISIBLE].querySelector("a, button");
      if (first) first.focus({ preventScroll: false });
    } else {
      more.scrollIntoView({ block: "nearest" });
    }
  });
})();
