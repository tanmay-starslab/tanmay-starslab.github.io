/* Google Analytics 4. One file, loaded by every page, so the measurement ID
   lives in exactly one place.

   Page views, scroll depth, outbound links and file downloads (the CV PDF)
   come from GA4's Enhanced Measurement, switched on in the GA web stream, and
   need nothing here. What this file adds is the part GA cannot see on a
   one-page site: which sections a visitor actually reached, and when they
   clicked an email link (mailto: is not an outbound link to GA). */
(function () {
  var MEASUREMENT_ID = "G-T5GEVQ26FG";

  // Nothing is sent until a real ID is set, and nothing is sent from a local
  // preview, so testing the site never shows up as visitors.
  if (!/^G-[A-Z0-9]+$/.test(MEASUREMENT_ID) || MEASUREMENT_ID === "G-XXXXXXXXXX") return;
  if (location.hostname !== "tanmay-starslab.github.io") return;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", MEASUREMENT_ID);

  var tag = document.createElement("script");
  tag.async = true;
  tag.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(MEASUREMENT_ID);
  document.head.appendChild(tag);

  function sectionOf(node) {
    var section = node.closest && node.closest("section[id]");
    return section ? section.id : "header";
  }

  document.addEventListener("click", function (event) {
    var link = event.target.closest && event.target.closest('a[href^="mailto:"]');
    if (!link) return;
    gtag("event", "contact_click", { link_location: sectionOf(link) });
  });

  // A section counts as viewed once its top crosses the middle of the
  // viewport, once per page load. Reported as section_view with the
  // section's id, e.g. "research" or "publications".
  function watchSections() {
    if (!("IntersectionObserver" in window)) return;
    var seen = {};
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var id = entry.target.id;
        if (!entry.isIntersecting || seen[id]) return;
        seen[id] = true;
        observer.unobserve(entry.target);
        gtag("event", "section_view", { section: id });
      });
    }, { rootMargin: "0px 0px -50% 0px" });
    document.querySelectorAll("section[id]").forEach(function (section) {
      observer.observe(section);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watchSections);
  } else {
    watchSections();
  }
})();
