/**
* Template Name: SnapFolio
* Template URL: https://bootstrapmade.com/snapfolio-bootstrap-portfolio-template/
* Author: BootstrapMade.com
* License: https://bootstrapmade.com/license/
* Custom astrophysics adaptation for Tanmay Singh.
*/

(function () {
  "use strict";

  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  // The page's own motion toggle is equivalent to the OS setting here. It is
  // read once, at load, because the toggle reloads the page when it changes —
  // there is no mid-session transition to handle for this flag.
  const motionOptOut = document.documentElement.classList.contains("motion-off");
  let reduceMotion = reduceMotionQuery.matches || motionOptOut;
  // Read once at load, this never noticed a visitor turning the setting on
  // mid-session. Reveal everything immediately if they do.
  function onReduceMotionChange(e) {
    // `|| motionOptOut`, not a bare assignment. Without it, a reader who turned
    // motion off on this page and then switched the OS setting from reduce to
    // no-preference would have the star field restarted underneath them — the
    // OS event would clear a flag it never set.
    reduceMotion = e.matches || motionOptOut;
    if (reduceMotion) {
      document.querySelectorAll(".reveal").forEach((n) => n.classList.add("is-visible"));
    } else if (typeof window.__startGalaxy === "function") {
      window.__startGalaxy();
    }
  }
  // Safari < 14 / iOS < 14 have addListener but not addEventListener here.
  // Calling the missing one threw and took the whole script with it.
  if (typeof reduceMotionQuery.addEventListener === "function") {
    reduceMotionQuery.addEventListener("change", onReduceMotionChange);
  } else if (typeof reduceMotionQuery.addListener === "function") {
    reduceMotionQuery.addListener(onReduceMotionChange);
  }
  const header = document.querySelector("#header");
  const headerToggleBtn = document.querySelector(".header-toggle");
  const navLinks = document.querySelectorAll("#navmenu a[href^='#']");
  const scrollTop = document.querySelector(".scroll-top");
  const year = document.querySelector("#year");
  const timeline = document.querySelector("[data-timeline]");
  const timelineItems = document.querySelectorAll(".timeline-item");
  const body = document.documentElement;
  const introEvents = ["click", "wheel", "keydown", "touchstart"];
  let introHoldTimer = null;
  let introCompleteTimer = null;
  let introSkipTimer = null;
  const introSkipOptions = { capture: true, passive: false };

  function bindIntroSkip() {
    introEvents.forEach((eventName) => window.addEventListener(eventName, skipIntro, introSkipOptions));
  }

  function unbindIntroSkip() {
    introEvents.forEach((eventName) => window.removeEventListener(eventName, skipIntro, true));
  }

  function completeIntro() {
    if (!body || !body.classList.contains("intro-active")) return;
    body.classList.remove("intro-active", "intro-hold", "intro-moving", "intro-skipped");
    body.classList.add("intro-complete");
    unbindIntroSkip();
  }

  function startIntroMove() {
    if (!body || !body.classList.contains("intro-active")) return;
    body.classList.remove("intro-hold");
    body.classList.add("intro-moving");
  }

  function skipIntro(event) {
    if (!body || !body.classList.contains("intro-active")) return;
    if (event) {
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
    }
    window.clearTimeout(introHoldTimer);
    window.clearTimeout(introCompleteTimer);
    window.clearTimeout(introSkipTimer);
    body.classList.remove("intro-hold");
    body.classList.add("intro-moving", "intro-skipped");
    introSkipTimer = window.setTimeout(completeIntro, window.innerWidth < 1200 ? 520 : 620);
  }

  if (body && body.classList.contains("intro-active")) {
    if (reduceMotion) {
      completeIntro();
    } else if (window.innerWidth < 1200) {
      introHoldTimer = window.setTimeout(startIntroMove, 460);
      introCompleteTimer = window.setTimeout(completeIntro, 1320);
      bindIntroSkip();
    } else {
      // 520 + 900 of travel. The old pair held 650 and ran 2000ms of transform,
      // which is a long time to keep a reader in front of a rectangle.
      introHoldTimer = window.setTimeout(startIntroMove, 520);
      introCompleteTimer = window.setTimeout(completeIntro, 1480);
      bindIntroSkip();
    }
  }

  if (year) {
    year.textContent = new Date().getFullYear();
  }

  const drawerQuery = window.matchMedia("(max-width: 1199px)");
  const headerPanel = document.querySelector(".header-container");

  // Below 1200px the drawer is hidden by transform alone, so its 9 nav links
  // and 4 social links stayed in the tab order while off-screen -- and the
  // focus ring went off-screen with them, so a keyboard user lost the
  // indicator entirely for 13 stops. WCAG 2.4.3 / 2.4.7.
  function syncDrawerInert(expanded) {
    if (!headerPanel) return;
    const collapsed = drawerQuery.matches && !expanded;
    if ("inert" in HTMLElement.prototype) {
      headerPanel.inert = collapsed;
    } else {
      headerPanel.setAttribute("aria-hidden", String(collapsed));
      headerPanel.querySelectorAll("a, button").forEach((el) => {
        if (collapsed) {
          el.setAttribute("tabindex", "-1");
        } else {
          el.removeAttribute("tabindex");
        }
      });
    }
  }

  function setHeaderExpanded(expanded) {
    if (!header || !headerToggleBtn) return;
    header.classList.toggle("header-show", expanded);
    headerToggleBtn.setAttribute("aria-expanded", String(expanded));
    // The label said "Open navigation" even while open.
    headerToggleBtn.setAttribute("aria-label", expanded ? "Close navigation" : "Open navigation");
    const icon = headerToggleBtn.querySelector("i");
    if (icon) {
      icon.classList.toggle("bi-list", !expanded);
      icon.classList.toggle("bi-x", expanded);
    }
    syncDrawerInert(expanded);
    if (!expanded && headerPanel && headerPanel.contains(document.activeElement)) {
      headerToggleBtn.focus();
    }
  }

  syncDrawerInert(header ? header.classList.contains("header-show") : false);
  if (typeof drawerQuery.addEventListener === "function") {
    drawerQuery.addEventListener("change", () => {
      syncDrawerInert(header ? header.classList.contains("header-show") : false);
    });
  }

  // Escape did not close the drawer.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && header && header.classList.contains("header-show")) {
      setHeaderExpanded(false);
    }
  });

  if (headerToggleBtn) {
    headerToggleBtn.addEventListener("click", () => {
      setHeaderExpanded(!header.classList.contains("header-show"));
    });
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      if (header && header.classList.contains("header-show")) {
        setHeaderExpanded(false);
      }
    });
  });

  function toggleScrollTop() {
    if (!scrollTop) return;
    scrollTop.classList.toggle("active", window.scrollY > 500);
  }

  if (scrollTop) {
    scrollTop.addEventListener("click", (event) => {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    });
  }

  // Measured against the VIEWPORT, not against offsetTop.
  //
  // offsetTop is a document-space number, and a pinned section does not have a
  // meaningful one: while ScrollTrigger pins #research it sets the section
  // `position: fixed` inside a .pin-spacer, so its offsetTop collapses toward 0
  // while its offsetHeight stays the unpinned value. Measured, that produced
  // two visible wrongs at once — the Research entry lit up while the reader was
  // still at the top of the page, and NOTHING was lit for the whole ~1100px the
  // reader actually spent inside Research.
  //
  // getBoundingClientRect is already viewport-relative, so it reports a pinned
  // section exactly where the reader sees it, and needs no knowledge of the pin
  // at all. ANCHOR is the same 220px line the old code used, just expressed in
  // the coordinate space that survives `position: fixed`.
  const ANCHOR = 220;
  function navmenuScrollspy() {
    let best = null, bestTop = -Infinity;
    navLinks.forEach((link) => {
      const section = document.querySelector(link.hash);
      if (!section) { link.classList.remove("active"); return; }
      const rect = section.getBoundingClientRect();
      // A pinned section and the one after it can both straddle the anchor for
      // a frame, so take the lowest section whose top is still above it rather
      // than lighting both.
      if (rect.top <= ANCHOR && rect.bottom > ANCHOR && rect.top > bestTop) {
        best = link; bestTop = rect.top;
      }
      link.classList.remove("active");
    });
    // Above the first section nothing is active, which is correct: the reader
    // is in the hero, and the hero's own entry claims it on its own terms.
    if (best) best.classList.add("active");
  }

  function updateTimelineFill() {
    if (!timeline) return;
    const rect = timeline.getBoundingClientRect();
    const viewportAnchor = window.innerHeight * 0.58;
    const total = rect.height - window.innerHeight * 0.18;
    const progress = Math.min(1, Math.max(0, (viewportAnchor - rect.top) / Math.max(total, 1)));
    timeline.style.setProperty("--timeline-progress", `${(progress * 100).toFixed(2)}%`);

    timelineItems.forEach((item) => {
      const itemRect = item.getBoundingClientRect();
      const active = itemRect.top < window.innerHeight * 0.62 && itemRect.bottom > window.innerHeight * 0.22;
      const past = itemRect.top < window.innerHeight * 0.48;
      item.classList.toggle("is-active", active);
      item.classList.toggle("is-past", past || active);
    });
  }

  window.addEventListener("load", () => {
    toggleScrollTop();
    navmenuScrollspy();
    updateTimelineFill();
  });

  document.addEventListener("scroll", () => {
    toggleScrollTop();
    navmenuScrollspy();
    updateTimelineFill();
  }, { passive: true });

  window.addEventListener("resize", updateTimelineFill, { passive: true });

  const revealItems = document.querySelectorAll(".reveal");

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    window.__revealReady = true;
  } else {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    revealItems.forEach((item) => revealObserver.observe(item));
    // Tells the inline watchdog the reveal system is live, so it leaves the
    // html.js-reveal gate armed.
    window.__revealReady = true;

    // syncRevealVisibility reads getBoundingClientRect on every .reveal node,
    // which forces synchronous layout. Unthrottled on scroll that ran once per
    // scroll event; now it runs at most once per frame, and the listeners
    // remove themselves as soon as every node is visible.
    let syncQueued = false;
    const pending = new Set(revealItems);
    function releaseSync() {
      document.removeEventListener("scroll", queueSync);
      window.removeEventListener("resize", queueSync);
      window.removeEventListener("load", queueSync);
    }
    function runSync() {
      syncQueued = false;
      pending.forEach((item) => {
        if (item.classList.contains("is-visible")) { pending.delete(item); return; }
        const rect = item.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.92 && rect.bottom > window.innerHeight * 0.04) {
          item.classList.add("is-visible");
          pending.delete(item);
        }
      });
      if (pending.size === 0) releaseSync();
    }
    function queueSync() {
      if (syncQueued) return;
      syncQueued = true;
      window.requestAnimationFrame(runSync);
    }
    window.addEventListener("load", queueSync);
    document.addEventListener("scroll", queueSync, { passive: true });
    window.addEventListener("resize", queueSync, { passive: true });
    window.setTimeout(queueSync, 120);
    window.setTimeout(queueSync, 600);
  }

  const root = document.documentElement;
  const pointer = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    active: false
  };

  // A high-polling-rate mouse fires pointermove far more often than the
  // compositor draws, and these four properties invalidate a five-layer
  // full-viewport vignette plus a blurred body::after. Batch to one frame.
  let pointerQueued = false;
  function flushPointer() {
    pointerQueued = false;
    const parallaxX = (pointer.x / window.innerWidth - 0.5) * 18;
    const parallaxY = (pointer.y / window.innerHeight - 0.5) * 18;
    root.style.setProperty("--cursor-x", `${pointer.x}px`);
    root.style.setProperty("--cursor-y", `${pointer.y}px`);
    root.style.setProperty("--parallax-x", parallaxX.toFixed(2));
    root.style.setProperty("--parallax-y", parallaxY.toFixed(2));
  }
  window.addEventListener("pointermove", (event) => {
    if (reduceMotion) return;   // otherwise parallax jitters with easing off
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
    if (pointerQueued) return;
    pointerQueued = true;
    window.requestAnimationFrame(flushPointer);
  }, { passive: true });

  document.documentElement.addEventListener("pointerleave", () => {
    pointer.active = false;
    pointerQueued = true;   // swallow any frame already queued
    window.requestAnimationFrame(() => { pointerQueued = false; });
    root.style.setProperty("--parallax-x", "0");
    root.style.setProperty("--parallax-y", "0");
  });

  if (!reduceMotion && window.matchMedia("(pointer: fine)").matches) {
    const tiltCards = document.querySelectorAll(".hero-portrait, .about-panel, .research-card, .project-card, .publication-card, .timeline-content, .teaching-panel, .personal-panel, .link-section, .contact-panel, .contact-tile, .fact-grid div, .glass-panel, .cosmic-card, .education-card, .personal-card, .link-card, .hover-lift");
    tiltCards.forEach((card) => {
      let cardQueued = false;
      let cardEvent = null;
      function flushCard() {
        cardQueued = false;
        if (!cardEvent) return;
        const rect = card.getBoundingClientRect();
        const x = (cardEvent.x - rect.left) / rect.width;
        const y = (cardEvent.y - rect.top) / rect.height;
        card.style.setProperty("--tilt-x", `${((x - 0.5) * 5).toFixed(2)}deg`);
        card.style.setProperty("--tilt-y", `${((0.5 - y) * 5).toFixed(2)}deg`);
        card.style.setProperty("--glow-x", `${(x * 100).toFixed(1)}%`);
        card.style.setProperty("--glow-y", `${(y * 100).toFixed(1)}%`);
      }
      card.addEventListener("pointermove", (event) => {
        cardEvent = { x: event.clientX, y: event.clientY };
        if (cardQueued) return;
        cardQueued = true;
        window.requestAnimationFrame(flushCard);
      }, { passive: true });

      card.addEventListener("pointerleave", () => {
        cardEvent = null;   // otherwise a queued frame re-tilts the card
        // removeProperty, not setProperty: an inline value beats every
        // selector permanently, so setting these back to a literal killed the
        // :focus-within glow after the first mouse hover. Removing them lets
        // the registered initial-value and the CSS rules apply again.
        card.style.removeProperty("--tilt-x");
        card.style.removeProperty("--tilt-y");
        card.style.removeProperty("--glow-x");
        card.style.removeProperty("--glow-y");
      });
    });
  }

  // The star canvas (#galaxy-canvas) used to be drawn here as a fixed spiral
  // of dots. It is cosmos.js now: a seeded night sky plus a live galaxy merger,
  // different on every visit. cosmos.js also defines window.__startGalaxy, which
  // onReduceMotionChange above still calls.
})();
