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
      introHoldTimer = window.setTimeout(startIntroMove, 620);
      introCompleteTimer = window.setTimeout(completeIntro, 1400);
      bindIntroSkip();
    } else {
      introHoldTimer = window.setTimeout(startIntroMove, 650);
      introCompleteTimer = window.setTimeout(completeIntro, 1500);
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

  const canvas = document.getElementById("galaxy-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let stars = [];
  let dust = [];
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let frame = null;

  function makeStar() {
    const arm = Math.random() < 0.72;
    const angle = Math.random() * Math.PI * 2;
    const radius = arm ? Math.pow(Math.random(), 0.55) * Math.min(width, height) * 0.45 : Math.random() * Math.max(width, height);
    const cx = width * 0.62;
    const cy = height * 0.34;
    const spiral = angle + radius * 0.0022;
    const x = arm ? cx + Math.cos(spiral) * radius + (Math.random() - 0.5) * 110 : Math.random() * width;
    const y = arm ? cy + Math.sin(spiral) * radius * 0.55 + (Math.random() - 0.5) * 86 : Math.random() * height;
    const palette = ["#ffffff", "#dff8ff", "#7dd3fc", "#a78bfa", "#f5c2e7", "#93c5fd", "#f8d477"];

    return {
      x,
      y,
      ox: x,
      oy: y,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.16,
      r: Math.random() * 1.95 + 0.54,
      a: Math.random() * 0.66 + 0.26,
      twinkle: Math.random() * Math.PI * 2,
      color: palette[Math.floor(Math.random() * palette.length)],
      mass: Math.random() * 0.9 + 0.6
    };
  }

  function makeDust() {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.09,
      vy: (Math.random() - 0.5) * 0.066,
      r: Math.random() * 38 + 20,
      a: Math.random() * 0.04 + 0.014,
      hue: ["125, 211, 252", "167, 139, 250", "245, 194, 231", "147, 197, 253", "248, 212, 119"][Math.floor(Math.random() * 5)]
    };
  }

  function resizeCanvas() {
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * pixelRatio);
    canvas.height = Math.floor(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const baseCount = width < 700 ? 132 : 280;
    const densityCount = Math.floor((width * height) / 6200);
    const count = reduceMotion ? Math.min(95, densityCount) : Math.min(width < 700 ? 190 : 420, Math.max(baseCount, densityCount));
    const dustCount = reduceMotion ? 12 : (width < 700 ? 28 : 92);
    stars = Array.from({ length: count }, makeStar);
    dust = Array.from({ length: dustCount }, makeDust);
  }

  function drawOrbitalArcs() {
    if (width < 720) return;
    ctx.save();
    ctx.translate(width * 0.62, height * 0.34);
    ctx.rotate(-0.24);
    const rings = [
      [Math.min(width, height) * 0.23, 0.42, "125, 211, 252"],
      [Math.min(width, height) * 0.32, 0.48, "167, 139, 250"],
      [Math.min(width, height) * 0.43, 0.52, "245, 194, 231"]
    ];

    rings.forEach(([radius, squash, color], index) => {
      ctx.beginPath();
      ctx.ellipse(0, 0, radius, radius * squash, 0, Math.PI * (0.16 + index * 0.08), Math.PI * (1.38 + index * 0.13));
      ctx.strokeStyle = `rgba(${color}, ${0.08 - index * 0.012})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawCursorLens() {
    if (!pointer.active) return;
    const lens = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 190);
    lens.addColorStop(0, "rgba(255, 255, 255, 0.08)");
    lens.addColorStop(0.18, "rgba(125, 211, 252, 0.08)");
    lens.addColorStop(0.42, "rgba(167, 139, 250, 0.035)");
    lens.addColorStop(1, "rgba(3, 5, 11, 0)");
    ctx.fillStyle = lens;
    ctx.fillRect(pointer.x - 190, pointer.y - 190, 380, 380);
  }

  function drawDust() {
    dust.forEach((particle) => {
      if (!reduceMotion) {
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x < -particle.r) particle.x = width + particle.r;
        if (particle.x > width + particle.r) particle.x = -particle.r;
        if (particle.y < -particle.r) particle.y = height + particle.r;
        if (particle.y > height + particle.r) particle.y = -particle.r;
      }

      const gradient = ctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, particle.r);
      gradient.addColorStop(0, `rgba(${particle.hue}, ${particle.a})`);
      gradient.addColorStop(1, "rgba(3, 5, 11, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawFilaments() {
    if (reduceMotion || width < 720) return;
    const maxDistance = 128;
    for (let i = 0; i < stars.length; i += 2) {
      const a = stars[i];
      for (let j = i + 1; j < Math.min(stars.length, i + 16); j += 1) {
        const b = stars[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxDistance) {
          ctx.globalAlpha = (1 - dist / maxDistance) * 0.105;
          ctx.strokeStyle = j % 4 === 0 ? "#f5c2e7" : (j % 3 === 0 ? "#a78bfa" : "#7dd3fc");
          ctx.lineWidth = 0.78;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawGalaxy() {
    ctx.clearRect(0, 0, width, height);

    const gradient = ctx.createRadialGradient(width * 0.62, height * 0.34, 0, width * 0.62, height * 0.34, Math.max(width, height) * 0.55);
    gradient.addColorStop(0, "rgba(125, 211, 252, 0.11)");
    gradient.addColorStop(0.3, "rgba(167, 139, 250, 0.07)");
    gradient.addColorStop(1, "rgba(3, 5, 11, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    drawDust();
    drawOrbitalArcs();
    drawCursorLens();

    for (let i = 0; i < stars.length; i += 1) {
      const star = stars[i];
      const dx = star.x - pointer.x;
      const dy = star.y - pointer.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const influence = pointer.active ? Math.max(0, 1 - distance / 240) : 0;
      const push = influence * 1.75 * star.mass;

      if (!reduceMotion) {
        star.twinkle += 0.031;
        star.x += star.vx + (dx / Math.max(distance, 1)) * push;
        star.y += star.vy + (dy / Math.max(distance, 1)) * push;
        star.x += (star.ox - star.x) * 0.0075;
        star.y += (star.oy - star.y) * 0.0075;

        if (star.x < -20 || star.x > width + 20 || star.y < -20 || star.y > height + 20) {
          Object.assign(star, makeStar());
        }
      }

      const alpha = Math.min(1, star.a + influence * 0.74 + Math.sin(star.twinkle) * 0.09);
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r + influence * 1.48, 0, Math.PI * 2);
      ctx.fillStyle = influence > 0.05 ? (i % 5 === 0 ? "#f5c2e7" : "#dff8ff") : star.color;
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    drawFilaments();

    if (!reduceMotion && width > 720) {
      for (let i = 0; i < stars.length; i += 1) {
        const a = stars[i];
        if (Math.abs(a.x - pointer.x) > 180 || Math.abs(a.y - pointer.y) > 180) continue;
        for (let j = i + 1; j < Math.min(stars.length, i + 18); j += 1) {
          const b = stars[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 96) {
            ctx.globalAlpha = (1 - dist / 96) * 0.18;
            ctx.strokeStyle = j % 2 ? "#7dd3fc" : "#a78bfa";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    if (reduceMotion) {
      frame = 0;
      return;
    }
    frame = window.requestAnimationFrame(drawGalaxy);
  }

  // Turning prefers-reduced-motion back OFF used to leave the canvas frozen
  // until a resize, because nothing restarted the loop.
  window.__startGalaxy = function () {
    if (reduceMotion || frame) return;
    frame = window.requestAnimationFrame(drawGalaxy);
  };

  resizeCanvas();
  drawGalaxy();

  window.addEventListener("resize", () => {
    if (frame) {
      window.cancelAnimationFrame(frame);
    }
    resizeCanvas();
    drawGalaxy();
  }, { passive: true });
})();
