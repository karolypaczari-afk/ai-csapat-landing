/* ============================================================
   Az AI csapatod - landing page interakció + tracking
   IIFE, nincs globális névszennyezés. Elementor-barát.
   ============================================================ */
(function () {
  "use strict";

  /* ----------------------------------------------------------
     1) CHECKOUT-URL-EK  →  EGYETLEN CSEREHELY TIBORNAK
     Cseréld le az alábbi két URL-t az éles fizetési linkekre
     (LearnDash / Stripe / WooCommerce checkout).
     ---------------------------------------------------------- */
  var CHECKOUT = {
    basic: "https://tudastar.genmarketer.hu/checkout/?add-to-cart=872",  // Az AI csapatod – Képzés · 69 990 Ft (termék #872)
    pro:   "https://tudastar.genmarketer.hu/checkout/?add-to-cart=873"   // Az AI csapatod – Képzés + Konzultáció · 119 990 Ft (termék #873)
  };
  var PRICE = { basic: 69990, pro: 119990 };
  var CURRENCY = "HUF";

  /* ----------------------------------------------------------
     2) A CSAPAT - 25 specialista (élő GENmarketer-badge-ek)
     A WebP-bannerek a tudástár media-könyvtárából jönnek.
     status: "live" | "soon"
     ---------------------------------------------------------- */
  var AVATAR_BASE = "https://tudastar.genmarketer.hu/wp-content/uploads/2026/05/";
  function av(slug) { return AVATAR_BASE + "avatar-" + slug + ".webp"; }

  var TEAM = [
    { cat: "Stratégia", color: "#7C3AED", members: [
      { code: "SHERLOCK", role: "a piackutató", slug: "genmarketer-icp-researcher", status: "live", benefit: "Pontosan megmondja, kik a vevőid és mi fáj nekik - hogy ne a sötétben lövöldözz." },
      { code: "TYRION", role: "a versenytárs-elemző", slug: "genmarketer-competitor-intel", status: "live", benefit: "Feltérképezi a versenytársaidat, hogy mindig egy lépéssel előttük járj." },
      { code: "JOHN", role: "a stratégiai partner", slug: "genmarketer-billion-dollar-board", status: "live", benefit: "Végiggondolja veled a következő nagy lépésed - mintha lenne egy saját igazgatótanácsod." },
      { code: "GANDALF", role: "az előfizetések szakértője", slug: "genmarketer-membership-expert", status: "live", benefit: "Felépíti neked a visszatérő bevételt, hogy ne kelljen minden hónapban nulláról indulnod." }
    ]},
    { cat: "Landoló oldal", color: "#06B6D4", members: [
      { code: "CLARK", role: "a landoló oldal szakértő", slug: "genmarketer-landing-page-expert", status: "live", benefit: "Megtervezi a landoló oldaladat, amelyik a látogatóidból tényleg vevőt csinál." },
      { code: "MAXIMUS", role: "a landoló oldal építő", slug: "genmarketer-landing-page-builder", status: "soon", benefit: "Kódba önti a kész landolódat - anélkül, hogy fejlesztőt kéne fizetned." }
    ]},
    { cat: "Hirdetés", color: "#00D4FF", members: [
      { code: "DUMBLEDORE", role: "a hirdetéstervező", slug: "genmarketer-ad-planner", status: "live", benefit: "Kitalálja a kampányodat, amelyik megállítja a görgető ujjat a hírfolyamban." },
      { code: "JORDAN", role: "a hirdetés-szövegíró", slug: "genmarketer-ad-copywriter", status: "live", benefit: "Megírja a hirdetésszövegeidet, amikre tényleg kattintanak - nem görgetnek tovább." },
      { code: "PAM", role: "a kreatív designer", slug: "genmarketer-ad-creative-design", status: "live", benefit: "Megtervezi a hirdetési kreatívjaidat, amik kitűnnek a végtelen hírfolyamból." },
      { code: "LUCIUS", role: "a Google Ads-hirdetéskezelő", slug: "genmarketer-google-ads-expert", status: "live", benefit: "Beállítja és pörgeti a Google-hirdetéseidet, hogy ne égjen el feleslegesen a kereted." },
      { code: "NEO", role: "a Facebook Ads-szakértő", slug: "genmarketer-facebook-ad-expert", status: "live", benefit: "Úgy kezeli a Meta-kampányaidat, hogy olcsóbb leadeket és több vásárlót hozzanak." }
    ]},
    { cat: "E-mail", color: "#FFC400", members: [
      { code: "FORREST", role: "az e-mail-szakértő", slug: "genmarketer-email-marketing-expert", status: "live", benefit: "Megírja az e-mail-sorozataidat, amik eladnak helyetted - akkor is, amikor alszol." }
    ]},
    { cat: "Design", color: "#9B6DFF", members: [
      { code: "MORPHEUS", role: "a Figma-tervező", slug: "figma-use", status: "soon", benefit: "Profi dizájnt tervez neked Figmában, grafikus felvétele nélkül." },
      { code: "DOROTHY", role: "a Figma–kód híd", slug: "figma-developer-mcp", status: "live", benefit: "A dizájnodból működő kódot csinál - fejlesztő nélkül." },
      { code: "MIYAGI", role: "a Figma QA-ellenőr", slug: "figma-qa", status: "soon", benefit: "Kiszúrja a dizájnod hibáit, mielőtt a vevőidnek szúrnának szemet." }
    ]},
    { cat: "Videó", color: "#400099", members: [
      { code: "Q", role: "a videós adatgyűjtő", slug: "yt-dlp", status: "live", benefit: "Összeszedi neked, mi működik a piacodon, hogy abból építkezz." },
      { code: "TRUMAN", role: "az UGC-videó-producer", slug: "genmarketer-ugc-video", status: "live", benefit: "Elkészíti a hiteles UGC-videóidat, amik tényleg vásárlót hoznak." },
      { code: "TED", role: "a videós script-író", slug: "genmarketer-video-script-writer", status: "live", benefit: "Megírja a videóid forgatókönyvét, ami az első másodperctől fogva tartja a néződ." },
      { code: "SARAH", role: "a videó-renderelő", slug: "seedance-multishot-prompter", status: "live", benefit: "Legenerálja a maximálisan konvertáló hirdetési videóidat - kamera, stáb és forgatás nélkül." },
      { code: "EDWARD", role: "a videóvágó", slug: "genmarketer-video-editor", status: "soon", benefit: "Pörgős, figyelemmegtartó videóvá vágja a nyersanyagodat." }
    ]},
    { cat: "SEO", color: "#00AACC", members: [
      { code: "COLUMBO", role: "a SEO-auditor", slug: "genmarketer-seo", status: "live", benefit: "Megmondja, miért nem talál meg a Google - és pontosan mit javíts az oldaladon." },
      { code: "INDIANA", role: "a kulcsszó-kutató", slug: "genmarketer-seo-research", status: "live", benefit: "Megtalálja neked a kulcsszavakat, amikre a vevőid tényleg rákeresnek." },
      { code: "MONICA", role: "a tartalom-optimalizáló", slug: "genmarketer-seo-content", status: "live", benefit: "Úgy írja át a szövegeidet, hogy a Google is és az olvasóid is szeressék." },
      { code: "DOKI", role: "a technikai SEO-szakértő", slug: "genmarketer-seo-technical", status: "live", benefit: "Kijavítja az oldalad technikai hibáit, amik hátráltatják a rangsorolásodat." },
      { code: "KATNISS", role: "a helyi SEO-szakértő", slug: "genmarketer-seo-local", status: "live", benefit: "Felhozza a cégedet a helyi keresésben és a Google Térképen." }
    ]}
  ];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function renderTeam() {
    var host = document.getElementById("gm-team");
    if (!host) return;
    var html = "";
    TEAM.forEach(function (group) {
      var live = 0;
      group.members.forEach(function (m) { if (m.status === "live") live++; });
      html += '<div class="gm-cat gm-reveal" style="--cat:' + group.color + '">';
      html += '<div class="gm-cat__head">';
      html += '<span class="gm-cat__dot"></span>';
      html += '<h3 class="gm-cat__title">' + esc(group.cat) + '</h3>';
      html += '<span class="gm-cat__count">' + group.members.length + " specialista</span>";
      html += "</div>";
      html += '<div class="gm-cat__grid">';
      group.members.forEach(function (m, i) {
        var soon = m.status === "soon";
        html += '<figure class="gm-card' + (soon ? " gm-card--soon" : "") + '" style="--i:' + i + '">';
        html += '<span class="gm-card__badge-wrap">';
        html += '<img class="gm-card__av" src="' + av(m.slug) + '" alt="' +
          esc(m.code + " - " + m.role) + '" loading="lazy" width="1484" height="236">';
        if (soon) html += '<span class="gm-card__soon">Hamarosan</span>';
        html += "</span>";
        html += '<figcaption class="gm-card__benefit">' + esc(m.benefit) + "</figcaption>";
        html += "</figure>";
      });
      html += "</div></div>";
    });
    host.innerHTML = html;
  }

  /* ----------------------------------------------------------
     2b) COUNT-UP - a proofbar számai felpörögnek, amikor láthatóvá
     válnak. A vezető számot animálja, a suffixet (+, " év") megtartja.
     ---------------------------------------------------------- */
  function wireCountUp() {
    var nums = document.querySelectorAll(".gm-proofbar__item strong");
    if (!nums.length) return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function animate(el) {
      var raw = el.textContent;
      var m = raw.match(/^(\D*)(\d[\d\s]*)(.*)$/);
      if (!m) return;
      var pre = m[1];
      var target = parseInt(m[2].replace(/\s/g, ""), 10);
      var suf = m[3];
      if (!isFinite(target) || target <= 0 || reduce) return;
      var dur = 1100, start = null;
      function fmt(n) {
        return pre + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + suf;
      }
      function step(ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(Math.round(target * eased));
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = raw;
      }
      requestAnimationFrame(step);
    }

    if (!("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { animate(en.target); io.unobserve(en.target); }
      });
    }, { threshold: 0.6 });
    Array.prototype.forEach.call(nums, function (el) { io.observe(el); });
  }

  /* ----------------------------------------------------------
     3) TRACKING - CTA-event push (dataLayer / Meta Pixel / gtag)
     Mind try/catch-elve: ha nincs bekötve a Pixel/gtag, nem dob.
     ---------------------------------------------------------- */
  function track(pkg, ctaId) {
    var value = PRICE[pkg] || 0;
    var label = pkg === "pro" ? "Képzés + Konzultáció" : "Képzés";

    // GTM / GA4 dataLayer
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: "gm_cta_click",
        cta_id: ctaId || null,
        package: pkg,
        item_name: "Az AI csapatod - " + label,
        value: value,
        currency: CURRENCY
      });
    } catch (e) {}

    // GA4 közvetlen (ha gtag van)
    try {
      if (typeof window.gtag === "function") {
        window.gtag("event", "begin_checkout", {
          currency: CURRENCY,
          value: value,
          items: [{ item_id: "ai-csapatod-" + pkg, item_name: "Az AI csapatod - " + label, price: value, quantity: 1 }]
        });
      }
    } catch (e) {}

    // Meta Pixel
    try {
      if (typeof window.fbq === "function") {
        window.fbq("track", "InitiateCheckout", {
          content_name: "Az AI csapatod - " + label,
          content_ids: ["ai-csapatod-" + pkg],
          value: value,
          currency: CURRENCY
        });
      }
    } catch (e) {}
  }

  function wireCtas() {
    var nodes = document.querySelectorAll("[data-gm-cta]");
    Array.prototype.forEach.call(nodes, function (el) {
      el.addEventListener("click", function (ev) {
        var pkg = el.getAttribute("data-gm-package") || "basic";
        var ctaId = el.getAttribute("data-gm-cta");
        var checkoutKey = el.getAttribute("data-gm-checkout");

        track(pkg, ctaId);

        // Ha checkout-gomb (nem belső horgony), irányítsuk a fizetésre.
        if (checkoutKey && CHECKOUT[checkoutKey]) {
          ev.preventDefault();
          window.location.href = CHECKOUT[checkoutKey];
        }
        // A horgony-CTA-k (href="#...") a böngésző sima-görgetésével mennek.
      });
    });
  }

  /* ----------------------------------------------------------
     4) Sima görgetés a horgony-linkekre
     ---------------------------------------------------------- */
  function wireSmoothScroll() {
    document.querySelectorAll('.gm-lp a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (ev) {
        var id = a.getAttribute("href");
        if (id.length < 2) return;
        var target = document.querySelector(id);
        if (!target) return;
        ev.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        history.replaceState(null, "", id);
      });
    });
  }

  /* ----------------------------------------------------------
     5) Sticky header árnyék + sticky mobil CTA megjelenítés
     ---------------------------------------------------------- */
  function wireScrollState() {
    var header = document.getElementById("gm-header");
    var sticky = document.getElementById("gm-sticky-cta");
    var hero = document.getElementById("hero");
    var pricing = document.getElementById("arazas");

    function onScroll() {
      var y = window.pageYOffset || document.documentElement.scrollTop;
      if (header) header.classList.toggle("is-stuck", y > 24);

      if (sticky && hero) {
        var heroBottom = hero.offsetTop + hero.offsetHeight;
        var pastHero = y > heroBottom - 120;
        // Rejtsd el, ha az árazás már képernyőn van (ott úgyis ott a gomb)
        var atPricing = pricing && pricing.getBoundingClientRect().top < window.innerHeight * 0.9 &&
                        pricing.getBoundingClientRect().bottom > 0;
        sticky.classList.toggle("is-visible", pastHero && !atPricing);
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ----------------------------------------------------------
     6) Scroll-reveal (IntersectionObserver)
     ---------------------------------------------------------- */
  function wireReveal() {
    var els = document.querySelectorAll(".gm-reveal");
    if (!("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(els, function (el) { el.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("is-in");
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    Array.prototype.forEach.call(els, function (el) { io.observe(el); });
  }

  /* ----------------------------------------------------------
     7) GYIK - egyszerre csak egy nyitva (accordion-érzet)
     ---------------------------------------------------------- */
  function wireFaq() {
    var items = document.querySelectorAll(".gm-faq__item");
    Array.prototype.forEach.call(items, function (item) {
      item.addEventListener("toggle", function () {
        if (!item.open) return;
        Array.prototype.forEach.call(items, function (other) {
          if (other !== item) other.open = false;
        });
      });
    });
  }

  /* ----------------------------------------------------------
     Init
     ---------------------------------------------------------- */
  function init() {
    renderTeam();
    wireCountUp();
    wireCtas();
    wireSmoothScroll();
    wireScrollState();
    wireReveal();
    wireFaq();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
