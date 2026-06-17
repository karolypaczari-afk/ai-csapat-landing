/* ============================================================
   Az AI csapatod — MISSION CONTROL showcase · vezérlés
   GSAP + ScrollTrigger + Flip (global), Three.js hero (dyn import),
   ágens-kártyák, adat-viz, spec-sheet modal, tracking.
   ============================================================ */
(function () {
  "use strict";

  var gsap = window.gsap, ST = window.ScrollTrigger, Flip = window.Flip;
  var REDUCE = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var TEAM = window.GM_TEAM || [], AGENTS = window.GM_AGENTS || [];
  var AV = "/assets/img/avatars/";
  // Nyelv: a <html lang> dönti el (HU a gyökéren, EN a /en/-en).
  var EN = (document.documentElement.getAttribute("lang") || "hu").slice(0, 2).toLowerCase() === "en";
  function tr(hu, en) { return EN ? en : hu; }

  /* ---- Tracking (portolva a prod script.js-ből) ---- */
  var CHECKOUT = {
    basic: "https://tudastar.genmarketer.hu/checkout/?add-to-cart=872",
    pro:   "https://tudastar.genmarketer.hu/checkout/?add-to-cart=873"
  };
  var PRICE = { basic: 69990, pro: 119990 }, CURRENCY = "HUF";
  function track(pkg, ctaId) {
    var value = PRICE[pkg] || 0, label = pkg === "pro" ? "Képzés + Konzultáció" : "Képzés";
    try { window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event: "gm_cta_click", cta_id: ctaId || null, package: pkg, item_name: "Az AI csapatod - " + label, value: value, currency: CURRENCY }); } catch (e) {}
    try { if (typeof window.gtag === "function") window.gtag("event", "begin_checkout", { currency: CURRENCY, value: value, cta_type: ctaId || "cta", items: [{ item_id: "ai-csapatod-" + pkg, item_name: "Az AI csapatod - " + label, price: value, quantity: 1 }] }); } catch (e) {}
    try { if (typeof window.fbq === "function") window.fbq("track", "InitiateCheckout", { content_name: "Az AI csapatod - " + label, value: value, currency: CURRENCY }); } catch (e) {}
  }
  // A landoló URL marketing-paramjait átvisszük a tudástár-checkoutra, hogy a
  // vásárlás-session NE (direct)-ként attribútálódjon (cross-subdomain attribúció).
  function withAttribution(url) {
    try {
      var inq = new URLSearchParams(location.search);
      var keep = ["gclid", "gbraid", "wbraid", "fbclid", "msclkid", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
      var out = new URL(url, location.href);
      keep.forEach(function (k) { var v = inq.get(k); if (v && !out.searchParams.has(k)) out.searchParams.set(k, v); });
      return out.toString();
    } catch (e) { return url; }
  }
  function wireCtas() {
    document.querySelectorAll("[data-gm-cta]").forEach(function (el) {
      var key = el.getAttribute("data-gm-checkout");
      if (key && CHECKOUT[key]) el.setAttribute("href", withAttribution(CHECKOUT[key]));
      el.addEventListener("click", function (ev) {
        track(el.getAttribute("data-gm-package") || "basic", el.getAttribute("data-gm-cta"));
        if (key && CHECKOUT[key]) { ev.preventDefault(); window.location.href = withAttribution(CHECKOUT[key]); }
      });
    });
  }

  // Per-ágens SZEREP-SPECIFIKUS animáció + sebesség — minden szakember a saját
  // munkáját idéző vizuált kapja (mind egyedi). A drawerek: js/dashboards.js.
  // ⚠️ ÚJ specialista felvételekor IDE is kell egy [drawer, sebesség] sor (relevánssal),
  //    különben a kártya a semleges fallbackra esik — a gépi kapu: tests/viz-coverage.mjs (test:all).
  var VIZ = {
    SHERLOCK: ["scan", 1.0],   TYRION: ["versus", 1.0], JOHN: ["tree", 0.9],    GANDALF: ["loop", 1.0],
    CLARK: ["wireframe", 1.0], MAXIMUS: ["build", 1.0],
    DUMBLEDORE: ["funnel", 1.0], JORDAN: ["typead", 1.1], PAM: ["swatch", 1.0], LUCIUS: ["gauge", 0.95], NEO: ["reticle", 1.0],
    FORREST: ["mailseq", 1.0],
    JERRY: ["network", 1.0],
    JARVIS: ["orchestrate", 0.9],
    MORPHEUS: ["artboards", 1.0], DOROTHY: ["code", 1.1], MIYAGI: ["inspect", 1.0],
    Q: ["ingest", 1.0], TRUMAN: ["filmstrip", 1.1], TED: ["script", 1.0], SARAH: ["render", 1.0], EDWARD: ["timeline", 1.0],
    COLUMBO: ["audit", 0.9], INDIANA: ["keywords", 1.0], MONICA: ["score", 0.95], DOKI: ["diagnostics", 1.0], KATNISS: ["mappin", 1.0]
  };
  function vizOf(code, fb) { return (VIZ[code] && VIZ[code][0]) || fb; }
  function speedOf(code) { return (VIZ[code] && VIZ[code][1]) || 1; }

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmtNum(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }

  /* ---- Count-up ---- */
  function countUp(el, target, suffix) {
    if (REDUCE || !isFinite(target) || target <= 0) { el.textContent = fmtNum(target) + (suffix || ""); return; }
    var dur = 1100, start = null;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmtNum(Math.round(target * e)) + (suffix || "");
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function wireProofbar() {
    document.querySelectorAll(".gm-proofbar__item strong").forEach(function (el) {
      var raw = el.textContent, m = raw.match(/^(\D*)(\d[\d\s]*)(.*)$/); if (!m) return;
      var target = parseInt(m[2].replace(/\s/g, ""), 10), pre = m[1], suf = m[3];
      var done = false;
      function go() { if (done) return; done = true; if (REDUCE) return;
        var s = null; function st(ts){ if(s===null)s=ts; var p=Math.min((ts-s)/1100,1),e=1-Math.pow(1-p,3); el.textContent=pre+fmtNum(Math.round(target*e))+suf; if(p<1)requestAnimationFrame(st); else el.textContent=raw; } requestAnimationFrame(st); }
      if (!("IntersectionObserver" in window)) return;
      var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { go(); io.disconnect(); } }); }, { threshold: 0.6 });
      io.observe(el);
    });
  }

  /* ---- Mission Control kártyák ---- */
  function renderAgents() {
    var host = document.getElementById("gm-mc-grid"); if (!host) return;
    var html = "";
    AGENTS.forEach(function (a, i) {
      var soon = a.status === "soon";
      var statusCls = soon ? "soon" : "live", statusTxt = soon ? "STANDBY" : "NOMINAL";
      var role = EN ? a.roleEn : a.role, task = EN ? a.currentTaskEn : a.currentTask;
      html += '<button type="button" class="gm-agent' + (soon ? " is-soon" : "") + '" data-code="' + esc(a.code) + '" data-cat="' + esc(a.cat) + '" style="--c:' + esc(a.color) + '">';
      html += '<span class="gm-agent__top">';
      html += '<span class="gm-agent__av"><img src="' + AV + esc(a.code) + '.webp" alt="' + esc(a.code + " – " + role) + '" loading="lazy" width="60" height="60"></span>';
      html += '<span class="gm-agent__meta"><span class="gm-agent__code">' + esc(a.code) + ' <span class="gm-status gm-status--' + statusCls + '">' + statusTxt + '</span></span>';
      html += '<span class="gm-agent__role">' + esc(role) + '</span></span>';
      html += '</span>';
      html += '<canvas class="gm-agent__viz" data-viz="' + esc(vizOf(a.code, a.vizType)) + '" aria-hidden="true"></canvas>';
      html += '<span class="gm-agent__task"><span class="gm-caret">▸</span><span>' + esc(task) + '</span></span>';
      html += '<span class="gm-agent__metrics">';
      (a.metrics || []).slice(0, 2).forEach(function (mt) {
        html += '<span class="gm-agent__metric"><b data-target="' + mt.target + '" data-suffix="' + esc(mt.suffix || "") + '">0</b><span>' + esc(EN ? (mt.labelEn || mt.label) : mt.label) + '</span></span>';
      });
      html += '</span>';
      html += '<span class="gm-agent__open">SPEC ▸</span>';
      html += '</button>';
    });
    host.innerHTML = html;

    // viz mount + metric count-up (lazy, amikor látszik)
    host.querySelectorAll(".gm-agent").forEach(function (card, i) {
      var cv = card.querySelector(".gm-agent__viz");
      var a = AGENTS[i];
      if (cv && window.GM_Dashboards) window.GM_Dashboards.mount(cv, cv.getAttribute("data-viz"), a.color, i, speedOf(a.code));
    });
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (!en.isIntersecting) return;
          en.target.querySelectorAll("b[data-target]").forEach(function (b) {
            countUp(b, parseInt(b.getAttribute("data-target"), 10), b.getAttribute("data-suffix"));
          });
          io.unobserve(en.target);
        });
      }, { threshold: 0.4 });
      host.querySelectorAll(".gm-agent").forEach(function (c) { io.observe(c); });
    }

    host.querySelectorAll(".gm-agent").forEach(function (card) {
      card.addEventListener("click", function () { openModal(card.getAttribute("data-code")); });
    });
  }

  /* ---- Filter chipek (Flip) ---- */
  function wireFilters() {
    var chips = document.querySelectorAll(".gm-chip"); if (!chips.length) return;
    var cards = Array.prototype.slice.call(document.querySelectorAll(".gm-agent"));
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        chips.forEach(function (c) { c.classList.remove("is-active"); });
        chip.classList.add("is-active");
        var cat = chip.getAttribute("data-cat");
        var state = (Flip && !REDUCE) ? Flip.getState(cards) : null;
        cards.forEach(function (c) {
          var show = cat === "all" || c.getAttribute("data-cat") === cat;
          c.style.display = show ? "" : "none";
        });
        if (state) Flip.from(state, { duration: 0.5, ease: "power2.out", scale: true, absolute: true, onEnter: function (els) { return gsap.fromTo(els, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.4 }); }, onLeave: function (els) { return gsap.to(els, { opacity: 0, scale: 0.8, duration: 0.3 }); } });
      });
    });
  }

  /* ---- Spec-sheet modal ---- */
  var modal = document.getElementById("gm-modal");
  var lastFocus = null;
  function openModal(code) {
    lastFocus = document.activeElement;
    var a = AGENTS.filter(function (x) { return x.code === code; })[0]; if (!a || !modal) return;
    var panel = modal.querySelector(".gm-modal__panel");
    panel.style.setProperty("--c", a.color);
    modal.querySelector(".gm-modal__av img").src = AV + a.code + ".webp";
    var role = EN ? a.roleEn : a.role;
    modal.querySelector(".gm-modal__title h3").textContent = a.code;
    modal.querySelector(".gm-modal__title p").textContent = role;
    var soon = a.status === "soon";
    var spec = (EN ? a.specEn : a.spec) || {};
    var rows = "";
    rows += '<dt>' + tr("Státusz", "Status") + '</dt><dd class="is-accent">' + (soon ? tr("STANDBY · hamarosan", "STANDBY · soon") : tr("NOMINAL · aktív", "NOMINAL · active")) + '</dd>';
    rows += '<dt>' + tr("Aktuális feladat", "Current task") + '</dt><dd>' + esc(EN ? a.currentTaskEn : a.currentTask) + '</dd>';
    rows += '<dt>' + tr("Folyamat", "Pipeline") + '</dt><dd>' + esc(spec.pipeline || "—") + '</dd>';
    rows += '<dt>' + tr("Ütem", "Cadence") + '</dt><dd>' + esc(spec.cadence || "—") + '</dd>';
    rows += '<dt>' + tr("Ütemező", "Scheduler") + '</dt><dd>' + esc(spec.scheduler || "—") + '</dd>';
    modal.querySelector(".gm-spec").innerHTML = rows;
    modal.querySelector(".gm-modal__benefit").textContent = EN ? a.benefitEn : a.benefit;

    var proofWrap = modal.querySelector(".gm-modal__proofzone");
    if (a.proof) {
      proofWrap.innerHTML = '<div class="gm-modal__prooflabel">' + tr("Így néz ki, amit kapsz", "Here's what you get") + '</div><img class="gm-modal__proof" src="' + esc(a.proof) + '" alt="' + esc(a.code + (EN ? " sample output" : " minta-kimenet")) + '" loading="lazy">';
    } else {
      proofWrap.innerHTML = '<div class="gm-modal__prooflabel">' + tr("Mit csinál a gyakorlatban", "What it does in practice") + '</div><div class="gm-modal__placeholder">' + esc(role.charAt(0).toUpperCase() + role.slice(1)) + tr(" – éles mintát a képzésben kapsz.", " – you get a live sample in the course.") + '</div>';
    }
    modal.classList.add("is-open");
    document.body.style.overflow = "hidden";
    if (gsap && !REDUCE) gsap.fromTo(panel, { y: 30, opacity: 0, scale: 0.97 }, { y: 0, opacity: 1, scale: 1, duration: 0.4, ease: "power3.out" });
    modal.querySelector(".gm-modal__close").focus();
  }
  function closeModal() {
    if (!modal) return;
    modal.classList.remove("is-open"); document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  if (modal) {
    modal.querySelector(".gm-modal__close").addEventListener("click", closeModal);
    modal.querySelector(".gm-modal__backdrop").addEventListener("click", closeModal);
    // belső linkre kattintva (CTA) zárjon, hogy a horgony-görgetés látszódjon
    modal.querySelectorAll(".gm-modal__cta a").forEach(function (a) { a.addEventListener("click", closeModal); });
    document.addEventListener("keydown", function (e) {
      if (!modal.classList.contains("is-open")) return;
      if (e.key === "Escape") { closeModal(); return; }
      if (e.key === "Tab") { // egyszerű fókusz-csapda
        var f = modal.querySelectorAll('a[href], button:not([disabled])');
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ---- GSAP scroll-animációk ---- */
  function wireScrollAnims() {
    if (!gsap || !ST || REDUCE) { document.querySelectorAll(".gm-reveal").forEach(function (el) { el.classList.add("is-in"); }); return; }
    gsap.registerPlugin(ST, Flip);
    document.documentElement.classList.add("gm-anim-ready");

    gsap.utils.toArray(".gm-reveal").forEach(function (el) {
      gsap.fromTo(el, { y: 28, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: "power2.out",
        // .is-in is hozzáadjuk, mert a .gm-dash__bars (riport-oszlopok) CSS-e arra épül
        scrollTrigger: { trigger: el, start: "top 88%", onEnter: function () { el.classList.add("is-in"); } } });
    });

    // hero copy parallax + 3D scroll-átadás
    var hero = document.getElementById("hero");
    if (hero) {
      gsap.to(".gm-hero__copy", { yPercent: -18, opacity: 0.2, ease: "none",
        scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } });
      ST.create({ trigger: hero, start: "top top", end: "bottom top", scrub: true,
        onUpdate: function (self) { if (window.__gmHero) window.__gmHero.setScroll(self.progress); } });
    }

    // orchestration lépések — pin/scrub effekt ELTÁVOLÍTVA (folytonos, hagyományos görgetés).
    // A lépések alapból teljesen láthatóak (index.html: nincs rajtuk opacity:.25).
  }

  /* ---- Sticky header + mobil CTA ---- */
  function wireScrollState() {
    var header = document.getElementById("gm-header"), sticky = document.getElementById("gm-sticky-cta"),
        hero = document.getElementById("hero"), pricing = document.getElementById("arazas");
    function onScroll() {
      var y = window.pageYOffset || 0;
      if (header) header.classList.toggle("is-stuck", y > 24);
      if (sticky && hero) {
        var pastHero = y > hero.offsetTop + hero.offsetHeight - 160;
        var atPricing = pricing && pricing.getBoundingClientRect().top < window.innerHeight * 0.9 && pricing.getBoundingClientRect().bottom > 0;
        sticky.classList.toggle("is-visible", pastHero && !atPricing);
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  }
  function wireSmoothScroll() {
    document.querySelectorAll('.gm-lp a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (ev) {
        var id = a.getAttribute("href"); if (id.length < 2) return;
        var t = document.querySelector(id); if (!t) return;
        ev.preventDefault(); t.scrollIntoView({ behavior: REDUCE ? "auto" : "smooth", block: "start" }); history.replaceState(null, "", id);
      });
    });
  }
  function wireFaq() {
    var items = document.querySelectorAll(".gm-faq__item");
    items.forEach(function (item) { item.addEventListener("toggle", function () { if (!item.open) return; items.forEach(function (o) { if (o !== item) o.open = false; }); }); });
  }

  /* ---- Demó-videók (.gm-video): --loop in-view, --click poszteres ---- */
  function wireVideos() {
    var figs = document.querySelectorAll(".gm-video"); if (!figs.length) return;
    figs.forEach(function (fig) {
      var video = fig.querySelector("video"); if (!video) return;
      var btn = fig.querySelector(".gm-video__play");
      if (REDUCE) { video.controls = true; if (btn) btn.remove(); var mb0 = fig.querySelector(".gm-video__mute"); if (mb0) mb0.remove(); return; }
      if (fig.classList.contains("gm-video--loop") && "IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting && en.intersectionRatio >= 0.5) video.play().catch(function () {}); else video.pause(); }); }, { threshold: [0, 0.5] });
        io.observe(video);
      }
      if (btn) {
        btn.addEventListener("click", function () {
          btn.remove(); video.controls = true; video.muted = false; video.play().catch(function () {});
          try { window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event: "gm_video_play", video_id: video.getAttribute("data-gm-video") || null }); } catch (e) {}
        });
      }
      var muteBtn = fig.querySelector(".gm-video__mute");
      if (muteBtn) {
        muteBtn.addEventListener("click", function () {
          video.muted = !video.muted;
          muteBtn.classList.toggle("is-on", !video.muted);
          muteBtn.setAttribute("aria-pressed", video.muted ? "false" : "true");
          muteBtn.setAttribute("aria-label", video.muted ? "Hang bekapcsolása" : "Hang kikapcsolása");
          if (!video.muted && video.paused) video.play().catch(function () {});
        });
      }
    });
  }

  /* ---- Eredmény-lapozó (#bizonyitek) ---- */
  function wireProofSlider() {
    var root = document.querySelector("[data-gm-slider]"); if (!root) return;
    var track = root.querySelector("[data-gm-track]");
    var slides = track ? track.querySelectorAll(".gm-slide") : [];
    if (!track || !slides.length) return;
    var prev = root.querySelector("[data-gm-prev]"), next = root.querySelector("[data-gm-next]");
    var dotsWrap = root.querySelector("[data-gm-dots]"), count = root.querySelector("[data-gm-count]");
    var behavior = REDUCE ? "auto" : "smooth", active = -1, dots = [];
    Array.prototype.forEach.call(slides, function (slide, i) {
      slide.setAttribute("role", "group"); slide.setAttribute("aria-roledescription", "munka");
      slide.setAttribute("aria-label", (i + 1) + " / " + slides.length);
      if (dotsWrap) { var dot = document.createElement("button"); dot.type = "button"; dot.className = "gm-slider__dot";
        dot.setAttribute("aria-label", (i + 1) + ". munka megtekintése");
        dot.addEventListener("click", function () { goTo(i); }); dotsWrap.appendChild(dot); dots.push(dot); }
    });
    function goTo(i) { i = ((i % slides.length) + slides.length) % slides.length; var s = slides[i];
      track.scrollTo({ left: s.offsetLeft - (track.clientWidth - s.offsetWidth) / 2, behavior: behavior }); }
    function setActive(i) { if (i === active) return; active = i;
      Array.prototype.forEach.call(slides, function (s, k) { s.classList.toggle("is-active", k === i); });
      dots.forEach(function (d, k) { d.classList.toggle("is-active", k === i); });
      if (count) count.textContent = (i + 1) + " / " + slides.length; }
    var raf = null;
    function onScroll() { if (raf) return; raf = requestAnimationFrame(function () { raf = null;
      var center = track.scrollLeft + track.clientWidth / 2, best = 0, bestDist = Infinity;
      Array.prototype.forEach.call(slides, function (s, k) { var d = Math.abs(s.offsetLeft + s.offsetWidth / 2 - center); if (d < bestDist) { bestDist = d; best = k; } });
      setActive(best); }); }
    track.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    if (prev) prev.addEventListener("click", function () { goTo(active - 1); });
    if (next) next.addEventListener("click", function () { goTo(active + 1); });
    track.addEventListener("keydown", function (e) { if (e.key === "ArrowLeft") { e.preventDefault(); goTo(active - 1); } if (e.key === "ArrowRight") { e.preventDefault(); goTo(active + 1); } });
    setActive(0);
  }

  /* ---- Lightbox (proof nagyítás) ---- */
  function wireLightbox() {
    var lb = document.getElementById("gm-lightbox"); if (!lb) return;
    var img = lb.querySelector("img"), cap = lb.querySelector(".gm-lightbox__cap"), lbLast = null;
    function open(src, alt, caption) { lbLast = document.activeElement; img.src = src; img.alt = alt || ""; cap.textContent = caption || "";
      lb.classList.add("is-open"); document.body.style.overflow = "hidden"; lb.querySelector(".gm-lightbox__close").focus(); }
    function close() { lb.classList.remove("is-open"); document.body.style.overflow = ""; img.src = ""; if (lbLast && lbLast.focus) lbLast.focus(); }
    document.querySelectorAll("[data-gm-zoom]").forEach(function (im) {
      function trigger() { var fig = im.closest(".gm-slide"); var c = fig ? fig.querySelector(".gm-slide__cap") : null; open(im.src, im.alt, c ? c.textContent : ""); }
      im.addEventListener("click", trigger);
      var zb = im.parentNode.querySelector(".gm-slide__zoom"); if (zb) zb.addEventListener("click", trigger);
    });
    lb.querySelector(".gm-lightbox__close").addEventListener("click", close);
    lb.addEventListener("click", function (e) { if (e.target === lb) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && lb.classList.contains("is-open")) close(); });
  }

  /* ---- WebGL hero (csak desktop) ---- */
  function maybeHero() {
    var wide = window.matchMedia("(min-width: 1024px)").matches;
    var fine = window.matchMedia("(pointer: fine)").matches;
    if (!wide || !fine || REDUCE) return;
    var canvas = document.getElementById("gm-hero-canvas"); if (!canvas) return;
    try { var probe = document.createElement("canvas"); var gl = probe.getContext("webgl") || probe.getContext("experimental-webgl"); if (!gl) return; } catch (e) { return; }
    document.documentElement.classList.add("gm-webgl");
    document.querySelector(".gm-lp").classList.add("gm-webgl");
    import("./hero3d.js").then(function (mod) {
      window.__gmHero = mod.initHero({ canvas: canvas, agents: AGENTS, avBase: AV, en: EN });
    }).catch(function (e) { console.warn("hero3d nem indult:", e); });
  }

  /* ---- Boot ---- */
  function boot() {
    var b = document.getElementById("gm-boot");
    var fill = b && b.querySelector(".gm-boot__fill"), log = b && b.querySelector(".gm-boot__log");
    var lines = EN ? ["booting system…", "loading 25 specialists…", "connecting telemetry…", "mission control ready."]
                   : ["rendszer indítása…", "25 szakember betöltése…", "telemetria csatlakoztatása…", "parancsnoki pult kész."];
    function done() { if (!b) return; b.classList.add("is-done"); setTimeout(function () { b.style.display = "none"; }, 700); }
    if (!b || REDUCE) { done(); return; }
    var p = 0, li = 0;
    var iv = setInterval(function () {
      p = Math.min(p + 12 + Math.random() * 16, 100);
      if (fill) fill.style.width = p + "%";
      if (log && li < lines.length && p > li * 25) { log.textContent = lines[li]; li++; }
      if (p >= 100) { clearInterval(iv); if (log) log.textContent = lines[lines.length - 1]; setTimeout(done, 350); }
    }, 180);
  }

  function init() {
    boot();
    renderAgents();
    wireFilters();
    wireCtas();
    wireProofbar();
    wireSmoothScroll();
    wireScrollState();
    wireFaq();
    wireVideos();
    wireProofSlider();
    wireLightbox();
    wireScrollAnims();
    maybeHero();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
