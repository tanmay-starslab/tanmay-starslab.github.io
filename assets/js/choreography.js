/* CHOREOGRAPHY — the scroll narrative.
   Pure progressive enhancement. If the GSAP CDN is blocked, this returns
   immediately and the page behaves exactly as it does today: every heading
   fully visible, every card in place, scrolling normal. Nothing here is
   load-bearing for content. */
(function () {
  "use strict";

  if (!window.gsap || !window.ScrollTrigger) return;

  var reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  // The page's own motion toggle counts as reduced motion: without this the
  // pinned rail and every scrub timeline keep running for a reader who turned
  // motion off, which is the most visible half of the page's movement.
  if (reduceQuery.matches ||
      document.documentElement.classList.contains("motion-off")) return;

  var g = window.gsap;
  g.registerPlugin(window.ScrollTrigger);
  if (window.SplitText) g.registerPlugin(window.SplitText);

  g.config({ nullTargetWarn: false });
  // limitCallbacks cuts callback churn; ignoreMobileResize avoids the iOS
  // URL-bar refresh storm that otherwise re-measures every trigger on scroll.
  window.ScrollTrigger.config({ limitCallbacks: true, ignoreMobileResize: true });

  // 120Hz ProMotion would double GPU work for no perceptual gain here.
  g.ticker.fps(60);

  // The camera. One plain object that both the scroll timelines and the GL
  // render loop read. ScrollTrigger is NEVER called from inside a rAF.
  var cam = { depth: 0, zoom: 1, spread: 1, warmth: 0.62, exposure: 1, trail: 0 };
  window.__cam = cam;

  var mm = g.matchMedia();

  /* ── Beat 1: the vault opens ───────────────────────────────────────────
     NOT pinned. A pin of 1.25 viewports measured out as a full dead screen
     between the hero and #about — the reader scrolls and nothing is there,
     which is the precise failure the brief calls feeling trapped. The same
     camera move reads just as well tied to ordinary scroll, and the page
     keeps its momentum. */
  mm.add("(min-width: 900px) and (prefers-reduced-motion: no-preference)", function () {
    var home = document.querySelector("#home");
    if (!home) return;
    var tl = g.timeline({
      scrollTrigger: {
        trigger: "#home",
        start: "top top",
        end: "bottom top",
        scrub: 0.8,
        invalidateOnRefresh: true
      }
    });
    tl.to(cam, { zoom: 1.28, exposure: 0.62, warmth: 0.9, ease: "none" }, 0)
      .to(".hero-copy", { yPercent: -10, opacity: 0.55, ease: "none" }, 0)
      .to(".hero-portrait", { yPercent: -16, scale: 1.05, ease: "none" }, 0);
    return function () { g.set([".hero-copy", ".hero-portrait"], { clearProps: "all" }); };
  });

  /* ── Beat 3: the page-long flight ─────────────────────────────────────
     getVelocity gives directional cues that scrub alone cannot. Flick down
     hard and the field streaks; stop and it settles. That single behaviour is
     the difference between a page that has animations and one that has mass. */
  g.timeline({
    scrollTrigger: {
      trigger: document.documentElement,
      start: 0,
      end: "max",
      scrub: 1.0,
      invalidateOnRefresh: true,
      onUpdate: function (self) {
        cam.trail = Math.min(Math.abs(self.getVelocity()) / 2400, 1);
      }
    }
  })
    .to(cam, { depth: 1200, zoom: 1.9, warmth: 1, ease: "none" }, 0)
    .to(cam, { spread: 2.4, ease: "power1.in" }, 0);

  /* ── Beat 4: plate rise ───────────────────────────────────────────────
     gsap.from renders its start state immediately, so a masked line parked at
     yPercent 118 inside overflow:clip IS invisible text. Three guards:
     the CSS never pre-hides a source heading, every split is wrapped in
     try/catch with a clearProps on throw, and a watchdog clears any line still
     parked after 3s. A blocked CDN therefore degrades to plain, fully visible,
     correctly styled headings. */
  function riseHeadings() {
    if (!window.SplitText) return;
    var targets = document.querySelectorAll("[data-split]");
    if (!targets.length) return;
    targets.forEach(function (el) {
      var split = null;
      try {
        split = new window.SplitText(el, {
          type: "lines",
          linesClass: "split-line",
          aria: "auto"
        });
        g.from(split.lines, {
          yPercent: 118,
          rotateZ: 2.5,
          duration: 1.05,
          stagger: 0.075,
          ease: "power3.out",
          scrollTrigger: {
            trigger: el,
            start: "top 82%",
            toggleActions: "play none none reverse"
          }
        });
      } catch (e) {
        if (split && split.lines) g.set(split.lines, { clearProps: "transform" });
      }
    });
    // Watchdog, mirroring the reveal failsafe already in the page.
    window.setTimeout(function () {
      document.querySelectorAll(".split-line").forEach(function (l) {
        var t = window.getComputedStyle(l).transform;
        if (t && t !== "none") {
          var m = t.match(/matrix.*\((.+)\)/);
          if (m) {
            var v = m[1].split(", ").map(Number);
            var ty = v.length === 6 ? v[5] : v[13];
            if (Math.abs(ty) > 2) g.set(l, { clearProps: "transform" });
          }
        }
      });
    }, 3000);
  }

  /* ── Beat 5: the card catalogue ───────────────────────────────────────
     #research travels sideways while the page scrolls down. matchMedia gates it
     at 900px and on reduced-motion, and the revert function puts every inline
     style back — so the narrow, printed and reduced-motion pages are the
     original vertical stack and not a stack wearing a dead transform.

     KEYBOARD, stated precisely rather than reassuringly. Right now NO research
     card contains a focusable element — measured, all four report zero — so:
       - a sighted keyboard user reaches every card by scrolling, which is what
         drives the rail, so nothing is unreachable;
       - a screen reader reads all four from the DOM regardless of the
         transform, since nothing here is hidden or aria-hidden;
       - and the focusin handler below therefore never fires today.
     It stays because these cards are about to gain links (figures, papers), and
     the day they do, the rail breaks in a way that is invisible to testing: it
     moves by TRANSFORM, so a panel focused off-screen is, as far as the browser
     is concerned, already in view — the native scroll-into-view does nothing
     and the focused card stays invisible with the focus ring off-screen.
     Converting the panel's offset into a page scroll position is the only thing
     that works. It is a guard, not a feature, and this comment is the only
     thing stopping it being read as one. */
  mm.add("(min-width: 900px) and (prefers-reduced-motion: no-preference)", function () {
    var rail = document.querySelector("#research .research-grid");
    var section = document.querySelector("#research");
    if (!rail || !section) return;
    var panels = g.utils.toArray("#research .research-card");
    if (panels.length < 2) return;

    // Travel is MEASURED, not derived from the panel count. The usual recipe
    // is xPercent: -100 * (n - 1), which is only correct when each panel is
    // exactly one viewport wide. Here four 520px cards in a 1400px viewport
    // gave 1560px of tween against 844px of pinned scroll: the rail ran off
    // the left edge well before the pin released and the reader spent the last
    // third of the section looking at nothing.
    // The rail does not start at x = 0 on screen — it starts at the container's
    // left inset, which is 322px in a 1400px viewport. Leaving that out left the
    // last card's right edge 242px off-screen at the end of the pin: the reader
    // scrolls the whole section and never sees the end of the last card.
    var travel = function () {
      var inset = rail.parentNode ? rail.parentNode.getBoundingClientRect().left : 0;
      return Math.max(0, rail.scrollWidth + inset - window.innerWidth + 40);
    };

    // One transform on the rail, not four on the cards: a single promoted
    // layer, and it leaves the cards' own transform property free for the
    // hover tilt.
    var railTween = g.to(rail, {
      x: function () { return -travel(); },
      ease: "none",
      scrollTrigger: {
        trigger: section,
        pin: true,
        scrub: 1,
        // end is a FUNCTION so invalidateOnRefresh can re-measure after a
        // resize or a late font load; a number captured at setup time pins for
        // the wrong distance the moment anything reflows.
        end: function () { return "+=" + travel(); },
        invalidateOnRefresh: true,
        anticipatePin: 1
      }
    });

    function focusRecovery(e) {
      var panel = e.target.closest(".research-card");
      if (!panel) return;
      var st = railTween.scrollTrigger;
      if (panels.indexOf(panel) < 0 || !st) return;
      // Progress comes from the panel's own offset, so it stays correct with
      // unequal panel widths and with the featured card sized differently.
      var t = travel();
      var p = t > 0 ? Math.min(1, Math.max(0, panel.offsetLeft / t)) : 0;
      window.scrollTo({ top: st.start + p * (st.end - st.start), behavior: "auto" });
    }
    rail.addEventListener("focusin", focusRecovery);

    return function () {
      rail.removeEventListener("focusin", focusRecovery);
      g.set(rail, { clearProps: "all" });
      g.set(panels, { clearProps: "all" });
    };
  });

  /* ── Research cards arrive off a 3D floor ─────────────────────────────── */
  mm.add("(min-width: 900px) and (prefers-reduced-motion: no-preference)", function () {
    // #research is excluded here: above 900px those cards belong to the rail,
    // and two tweens writing `transform` on one element is how a card ends up
    // parked at rotateX(-18deg) forever.
    var cards = g.utils.toArray("#past-projects .project-card");
    if (!cards.length) return;
    g.from(cards, {
      rotateX: -18,
      y: 60,
      opacity: 0,
      transformOrigin: "50% 100% -80px",
      duration: 0.9,
      stagger: 0.08,
      ease: "power3.out",
      scrollTrigger: { trigger: cards[0], start: "top 86%", once: true }
    });
    return function () { g.set(cards, { clearProps: "all" }); };
  });

  // Every start/end would otherwise be computed against unloaded fonts and
  // images, so both of these matter.
  window.addEventListener("load", function () { window.ScrollTrigger.refresh(); });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      window.ScrollTrigger.refresh();
      riseHeadings();
    });
  } else {
    riseHeadings();
  }

  // Reduced motion can be switched on mid-session: tear everything down and
  // restore the static page.
  var onRM = function (e) {
    if (!e.matches) return;
    window.ScrollTrigger.getAll().forEach(function (t) { t.kill(); });
    g.globalTimeline.clear();
    g.set("[data-split] .split-line, .hero-copy, .hero-portrait, .research-card, .project-card",
      { clearProps: "all" });
  };
  if (typeof reduceQuery.addEventListener === "function") reduceQuery.addEventListener("change", onRM);
  else if (typeof reduceQuery.addListener === "function") reduceQuery.addListener(onRM);
})();
