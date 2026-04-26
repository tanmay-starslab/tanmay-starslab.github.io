/**
* Template Name: SnapFolio
* Template URL: https://bootstrapmade.com/snapfolio-bootstrap-portfolio-template/
* Author: BootstrapMade.com
* License: https://bootstrapmade.com/license/
* Custom astrophysics adaptation for Tanmay Singh.
*/

(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const header = document.querySelector("#header");
  const headerToggleBtn = document.querySelector(".header-toggle");
  const navLinks = document.querySelectorAll("#navmenu a[href^='#']");
  const scrollTop = document.querySelector(".scroll-top");
  const year = document.querySelector("#year");
  const timeline = document.querySelector("[data-timeline]");
  const timelineItems = document.querySelectorAll(".timeline-item");
  const body = document.body;
  const introEvents = ["click", "wheel", "keydown", "touchstart"];
  let introHoldTimer = null;
  let introCompleteTimer = null;
  let introSkipTimer = null;

  function completeIntro() {
    if (!body || !body.classList.contains("intro-active")) return;
    body.classList.remove("intro-active", "intro-hold", "intro-moving", "intro-skipped");
    body.classList.add("intro-complete");
    introEvents.forEach((eventName) => window.removeEventListener(eventName, skipIntro));
  }

  function startIntroMove() {
    if (!body || !body.classList.contains("intro-active")) return;
    body.classList.remove("intro-hold");
    body.classList.add("intro-moving");
  }

  function skipIntro() {
    if (!body || !body.classList.contains("intro-active")) return;
    window.clearTimeout(introHoldTimer);
    window.clearTimeout(introCompleteTimer);
    window.clearTimeout(introSkipTimer);
    body.classList.remove("intro-hold");
    body.classList.add("intro-moving", "intro-skipped");
    introSkipTimer = window.setTimeout(completeIntro, 620);
  }

  if (body && body.classList.contains("intro-active")) {
    if (reduceMotion) {
      completeIntro();
    } else if (window.innerWidth < 1200) {
      introHoldTimer = window.setTimeout(startIntroMove, 450);
      introCompleteTimer = window.setTimeout(completeIntro, 1150);
      introEvents.forEach((eventName) => window.addEventListener(eventName, skipIntro, { passive: true }));
    } else {
      introHoldTimer = window.setTimeout(startIntroMove, 2800);
      introCompleteTimer = window.setTimeout(completeIntro, 5000);
      introEvents.forEach((eventName) => window.addEventListener(eventName, skipIntro, { passive: true }));
    }
  }

  if (year) {
    year.textContent = new Date().getFullYear();
  }

  function setHeaderExpanded(expanded) {
    if (!header || !headerToggleBtn) return;
    header.classList.toggle("header-show", expanded);
    headerToggleBtn.setAttribute("aria-expanded", String(expanded));
    const icon = headerToggleBtn.querySelector("i");
    if (icon) {
      icon.classList.toggle("bi-list", !expanded);
      icon.classList.toggle("bi-x", expanded);
    }
  }

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

  function navmenuScrollspy() {
    const position = window.scrollY + 220;
    navLinks.forEach((link) => {
      const section = document.querySelector(link.hash);
      if (!section) return;
      const active = position >= section.offsetTop && position < section.offsetTop + section.offsetHeight;
      link.classList.toggle("active", active);
    });
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
  function syncRevealVisibility() {
    revealItems.forEach((item) => {
      const rect = item.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.92 && rect.bottom > window.innerHeight * 0.04) {
        item.classList.add("is-visible");
      }
    });
  }

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
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
    window.addEventListener("load", syncRevealVisibility);
    document.addEventListener("scroll", syncRevealVisibility, { passive: true });
    window.addEventListener("resize", syncRevealVisibility, { passive: true });
    window.setTimeout(syncRevealVisibility, 120);
    window.setTimeout(syncRevealVisibility, 600);
  }

  const root = document.documentElement;
  const pointer = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    active: false
  };

  window.addEventListener("pointermove", (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
    const parallaxX = (event.clientX / window.innerWidth - 0.5) * 18;
    const parallaxY = (event.clientY / window.innerHeight - 0.5) * 18;
    root.style.setProperty("--cursor-x", `${event.clientX}px`);
    root.style.setProperty("--cursor-y", `${event.clientY}px`);
    root.style.setProperty("--parallax-x", parallaxX.toFixed(2));
    root.style.setProperty("--parallax-y", parallaxY.toFixed(2));
  }, { passive: true });

  window.addEventListener("pointerleave", () => {
    pointer.active = false;
    root.style.setProperty("--parallax-x", "0");
    root.style.setProperty("--parallax-y", "0");
  });

  if (!reduceMotion && window.matchMedia("(pointer: fine)").matches) {
    const tiltCards = document.querySelectorAll(".hero-portrait, .about-panel, .research-card, .project-card, .publication-card, .timeline-content, .teaching-panel, .personal-panel, .link-section, .contact-panel, .contact-tile, .fact-grid div, .glass-panel, .cosmic-card, .education-card, .personal-card, .link-card, .hover-lift");
    tiltCards.forEach((card) => {
      card.addEventListener("pointermove", (event) => {
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        card.style.setProperty("--tilt-x", `${((x - 0.5) * 5).toFixed(2)}deg`);
        card.style.setProperty("--tilt-y", `${((0.5 - y) * 5).toFixed(2)}deg`);
        card.style.setProperty("--glow-x", `${(x * 100).toFixed(1)}%`);
        card.style.setProperty("--glow-y", `${(y * 100).toFixed(1)}%`);
      }, { passive: true });

      card.addEventListener("pointerleave", () => {
        card.style.setProperty("--tilt-x", "0deg");
        card.style.setProperty("--tilt-y", "0deg");
        card.style.setProperty("--glow-x", "50%");
        card.style.setProperty("--glow-y", "0%");
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

    if (!reduceMotion) {
      frame = window.requestAnimationFrame(drawGalaxy);
    }
  }

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
