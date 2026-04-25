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

  window.addEventListener("load", () => {
    toggleScrollTop();
    navmenuScrollspy();
  });
  document.addEventListener("scroll", () => {
    toggleScrollTop();
    navmenuScrollspy();
  }, { passive: true });

  const revealItems = document.querySelectorAll(".reveal");
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
  }

  const canvas = document.getElementById("starfield");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let stars = [];
  let animationFrame = null;

  function resize() {
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * pixelRatio);
    canvas.height = Math.floor(window.innerHeight * pixelRatio);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;

    const count = Math.min(180, Math.floor((window.innerWidth * window.innerHeight) / 9000));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.4 + 0.2,
      a: Math.random() * 0.65 + 0.15,
      v: Math.random() * 0.18 + 0.03
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const star of stars) {
      ctx.globalAlpha = star.a;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      if (!reduceMotion) {
        star.y += star.v * (window.devicePixelRatio || 1);
        if (star.y > canvas.height) {
          star.y = 0;
          star.x = Math.random() * canvas.width;
        }
      }
    }
    ctx.globalAlpha = 1;

    if (!reduceMotion) {
      animationFrame = window.requestAnimationFrame(draw);
    }
  }

  resize();
  draw();

  window.addEventListener("resize", () => {
    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame);
    }
    resize();
    draw();
  }, { passive: true });
})();
