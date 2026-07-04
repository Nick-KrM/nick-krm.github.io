/* =========================================================
   Partials loader
   ========================================================= */
function loadPartial(id, path, callback) {
  const el = document.getElementById(id);
  if (!el) return;

  fetch(path)
    .then(r => r.text())
    .then(html => {
      el.innerHTML = html;
      if (typeof callback === "function") callback();
    });
}

/* =========================================================
   Smooth scroll — matches the menu's 0.4s cubic-bezier(0.4,0,0.2,1)
   ========================================================= */
function cubicBezier(p1x, p1y, p2x, p2y) {
  const cx = 3 * p1x, bx = 3 * (p2x - p1x) - cx, ax = 1 - cx - bx;
  const cy = 3 * p1y, by = 3 * (p2y - p1y) - cy, ay = 1 - cy - by;

  const sampleX = t => ((ax * t + bx) * t + cx) * t;
  const sampleY = t => ((ay * t + by) * t + cy) * t;
  const sampleDX = t => (3 * ax * t + 2 * bx) * t + cx;

  function solveX(x) {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const dx = sampleX(t) - x;
      if (Math.abs(dx) < 1e-4) return t;
      const d = sampleDX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= dx / d;
    }
    return t;
  }

  return x => sampleY(solveX(x));
}

const MENU_EASE = cubicBezier(0.4, 0, 0.2, 1);

let autoScrolling = false; // true while a programmatic scroll is running

function smoothScrollTo(targetY, duration = 400) {
  const startY = window.scrollY;
  const diff = targetY - startY;

  if (Math.abs(diff) < 1) {
    window.scrollTo(0, targetY);
    return;
  }

  autoScrolling = true;
  let startTime = null;
  function step(now) {
    if (startTime === null) startTime = now;
    const t = Math.min((now - startTime) / duration, 1);
    window.scrollTo(0, startY + diff * MENU_EASE(t));
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      autoScrolling = false;
    }
  }
  requestAnimationFrame(step);
}

/* =========================================================
   Navigation — smooth in-page scrolling + "Hjem → top"
   (delegated so it covers both header links and hero buttons)
   ========================================================= */
function setActiveNav(href) {
  const navLinks = document.querySelectorAll(".main-nav .nav-link");
  navLinks.forEach(l => l.classList.remove("is-active"));
  const match = document.querySelector(`.main-nav .nav-link[href="${href}"]`);
  if (match) match.classList.add("is-active");
}

function initNav() {
  const headerOffset = () =>
    (document.querySelector(".header")?.offsetHeight || 72) + 12;

  document.addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (!link) return;

    const href = link.getAttribute("href");
    if (!href) return;

    const path = window.location.pathname;
    const isHome = path === "/" || path.endsWith("/index.html") || path === "";

    // Resolve a homepage section hash from "#x" or "/#x"
    let hash = null;
    if (href.startsWith("#") && href.length > 1) hash = href;
    else if (href.startsWith("/#")) hash = href.slice(1);

    if (hash) {
      // On the homepage → smooth scroll to the section
      if (isHome) {
        const target = document.querySelector(hash);
        if (target) {
          e.preventDefault();
          const y = target.getBoundingClientRect().top + window.scrollY - headerOffset();
          smoothScrollTo(y, 400);
          setActiveNav(href);
        }
      }
      // Off the homepage → let the browser navigate to "/#x" (loads home + jumps)
      return;
    }

    // Home link: scroll to top only if we're already on the homepage
    if (href === "/" || href === "/index.html") {
      if (isHome) {
        e.preventDefault();
        smoothScrollTo(0, 400);
        setActiveNav("/");
      }
      return; // otherwise navigate home normally
    }
  });
}

/* =========================================================
   Scroll-spy — highlight the nav link of the section in view
   ========================================================= */
function initScrollSpy() {
  const links = Array.from(document.querySelectorAll(".main-nav .nav-link"));
  if (!links.length) return;

  // Map each link to its target section (Hjem → hero / top)
  const items = links.map(link => {
    const href = link.getAttribute("href");
    let target = null;
    if (href === "/" || href === "#" || href === "#top") {
      target = document.querySelector(".hero");
    } else {
      let hash = null;
      if (href && href.startsWith("#") && href.length > 1) hash = href;
      else if (href && href.startsWith("/#")) hash = href.slice(1);
      if (hash) target = document.querySelector(hash);
    }
    return target ? { link, target, visible: false } : null;
  }).filter(Boolean);

  if (!items.length) return;

  function setActive(link) {
    links.forEach(l => l.classList.remove("is-active"));
    if (link) link.classList.add("is-active");
  }

  // The active section is the one crossing a line just under the header.
  const lineY = () => (document.querySelector(".header")?.offsetHeight || 72) + 24;

  function update() {
    if (autoScrolling) return; // don't fight the click-driven highlight
    const line = lineY();
    let current = null;
    for (const it of items) {
      const rect = it.target.getBoundingClientRect();
      if (rect.top <= line && rect.bottom > line) {
        current = it; // section currently under the header line
      }
    }
    if (current) setActive(current.link);
  }

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
}

/* =========================================================
   Mark the current page in the nav (for separate pages like /om-oss/)
   ========================================================= */
function highlightCurrentPage() {
  const path = window.location.pathname.replace(/index\.html$/, "");
  const isHome = path === "/" || path === "";
  const navLinks = document.querySelectorAll(".main-nav .nav-link");

  navLinks.forEach(l => {
    const href = l.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("/#")) return; // section links → scroll-spy
    if (href === "/") {
      l.classList.toggle("is-active", isHome);
    } else {
      l.classList.toggle("is-active", !isHome && path.startsWith(href));
    }
  });
}

/* =========================================================
   Burger menu
   ========================================================= */
function initBurger() {
  const burger = document.querySelector(".burger");
  const nav = document.querySelector(".main-nav ul");
  const links = nav ? nav.querySelectorAll("a") : [];

  if (!burger || !nav) return;

  function lockScroll(lock) {
    document.documentElement.style.overflow = lock ? "hidden" : "";
    document.body.style.overflow = lock ? "hidden" : "";
  }

  function closeMenu() {
    burger.setAttribute("aria-expanded", "false");
    burger.classList.remove("is-active");
    nav.classList.remove("is-open");
    lockScroll(false);
  }

  burger.addEventListener("click", () => {
    const isOpen = burger.getAttribute("aria-expanded") === "true";
    burger.setAttribute("aria-expanded", String(!isOpen));
    burger.classList.toggle("is-active");
    nav.classList.toggle("is-open");
    lockScroll(!isOpen);
  });

  links.forEach(link => link.addEventListener("click", closeMenu));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
}

/* =========================================================
   Before / After — reusable comparison slider ("shutter")
   Works with mouse, touch (Pointer Events) and keyboard.
   Any element matching [data-ba] on the page is initialised.
   ========================================================= */
function initBeforeAfter() {
  const sliders = document.querySelectorAll("[data-ba]");

  sliders.forEach(slider => {
    const range = slider.querySelector(".ba-range");
    const start = parseFloat(slider.dataset.baStart);
    let pos = Number.isFinite(start) ? start : 50;
    let dragging = false;

    function apply(p) {
      pos = Math.max(0, Math.min(100, p));
      slider.style.setProperty("--pos", pos + "%");
      if (range) {
        range.setAttribute("aria-valuenow", Math.round(pos));
        range.setAttribute("aria-valuetext", Math.round(100 - pos) + " % etter synlig");
      }
    }

    function posFromX(clientX) {
      const r = slider.getBoundingClientRect();
      return ((clientX - r.left) / r.width) * 100;
    }

    apply(pos);

    slider.addEventListener("pointerdown", (e) => {
      dragging = true;
      slider.classList.add("is-dragging");
      if (slider.setPointerCapture) {
        try { slider.setPointerCapture(e.pointerId); } catch (_) {}
      }
      apply(posFromX(e.clientX));
      e.preventDefault();
    });

    slider.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      apply(posFromX(e.clientX));
    });

    function endDrag() {
      dragging = false;
      slider.classList.remove("is-dragging");
    }
    slider.addEventListener("pointerup", endDrag);
    slider.addEventListener("pointercancel", endDrag);

    if (range) {
      range.addEventListener("keydown", (e) => {
        let d = 0;
        if (e.key === "ArrowLeft") d = -2;
        else if (e.key === "ArrowRight") d = 2;
        else if (e.key === "Home") { apply(0); e.preventDefault(); return; }
        else if (e.key === "End") { apply(100); e.preventDefault(); return; }
        if (d) { apply(pos + d); e.preventDefault(); }
      });
    }
  });
}

/* =========================================================
   Boot
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initBeforeAfter();
  loadPartial("site-header", "/partials/header.html", () => {
    initBurger();
    initScrollSpy();
    highlightCurrentPage();
  });
  loadPartial("site-footer", "/partials/footer.html", () => {
    const y = document.getElementById("footer-year");
    if (y) y.textContent = new Date().getFullYear();
  });
});
