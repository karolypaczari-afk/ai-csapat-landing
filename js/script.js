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
     1b) NYELV  →  a <html lang> dönti el (HU a gyökéren, EN a /en/-en).
     A LÁTHATÓ statikus szöveg a HTML-ben van (index.html / en/index.html);
     itt csak a JS-ből renderelt vagy beírt szövegeknek kell kétnyelvűnek lenniük.
     Egyetlen forrás mindkét oldalnak: ez a fájl. → KÉTNYELVŰSÉG-SZINKRON:
     ha az egyik nyelv csapat-szövegén változtatsz, a másikat (…En mező) is vezesd át!
     ---------------------------------------------------------- */
  var LANG = (document.documentElement.getAttribute("lang") || "hu")
    .slice(0, 2).toLowerCase() === "en" ? "en" : "hu";
  var T = {
    hu: {
      specialist: function (n) { return n + " specialista"; },
      soon: "Hamarosan",
      muteOn: "Hang bekapcsolása",
      muteOff: "Hang kikapcsolása",
      pkgBasic: "Képzés",
      pkgPro: "Képzés + Konzultáció",
      workRole: "munka",
      viewWork: function (n) { return n + ". munka megtekintése"; }
    },
    en: {
      specialist: function (n) { return n + (n === 1 ? " specialist" : " specialists"); },
      soon: "Coming soon",
      muteOn: "Unmute",
      muteOff: "Mute",
      pkgBasic: "Training",
      pkgPro: "Training + Consultation",
      workRole: "work",
      viewWork: function (n) { return "View work " + n; }
    }
  }[LANG];

  /* ----------------------------------------------------------
     2) A CSAPAT - 25 specialista (élő GENmarketer-badge-ek)
     A WebP-bannerek a tudástár media-könyvtárából jönnek.
     status: "live" | "soon"
     A cat/role/benefit kétnyelvű (…/…En) — a render a LANG szerint választ.
     ---------------------------------------------------------- */
  var AVATAR_BASE = "https://tudastar.genmarketer.hu/wp-content/uploads/2026/05/";
  function av(slug) { return AVATAR_BASE + "avatar-" + slug + ".webp"; }

  var TEAM = [
    { cat: "Stratégia", catEn: "Strategy", color: "#7C3AED", members: [
      { code: "SHERLOCK", role: "a piackutató", roleEn: "the market researcher", slug: "genmarketer-icp-researcher", status: "live", benefit: "Pontosan megmondja, kik a vevőid és mi fáj nekik - hogy ne a sötétben lövöldözz.", benefitEn: "Pinpoints exactly who your buyers are and what hurts them - so you stop shooting in the dark." },
      { code: "TYRION", role: "a versenytárs-elemző", roleEn: "the competitor analyst", slug: "genmarketer-competitor-intel", status: "live", benefit: "Feltérképezi a versenytársaidat, hogy mindig egy lépéssel előttük járj.", benefitEn: "Maps out your competitors so you're always one step ahead." },
      { code: "JOHN", role: "a stratégiai partner", roleEn: "the strategic partner", slug: "genmarketer-billion-dollar-board", status: "live", benefit: "Végiggondolja veled a következő nagy lépésed - mintha lenne egy saját igazgatótanácsod.", benefitEn: "Thinks through your next big move with you - like having your own board of directors." },
      { code: "GANDALF", role: "az előfizetések szakértője", roleEn: "the membership expert", slug: "genmarketer-membership-expert", status: "live", benefit: "Felépíti neked a visszatérő bevételt, hogy ne kelljen minden hónapban nulláról indulnod.", benefitEn: "Builds your recurring revenue so you don't start from zero every month." }
    ]},
    { cat: "Landoló oldal", catEn: "Landing page", color: "#06B6D4", members: [
      { code: "CLARK", role: "a landoló oldal szakértő", roleEn: "the landing page expert", slug: "genmarketer-landing-page-expert", status: "live", benefit: "Megtervezi a landoló oldaladat, amelyik a látogatóidból tényleg vevőt csinál.", benefitEn: "Designs a landing page that actually turns your visitors into buyers." },
      { code: "MAXIMUS", role: "a landoló oldal építő", roleEn: "the landing page builder", slug: "genmarketer-landing-page-builder", status: "soon", benefit: "Kódba önti a kész landolódat - anélkül, hogy fejlesztőt kéne fizetned.", benefitEn: "Turns your finished landing page into code - without paying a developer." }
    ]},
    { cat: "Hirdetés", catEn: "Advertising", color: "#00D4FF", members: [
      { code: "DUMBLEDORE", role: "a hirdetéstervező", roleEn: "the ad planner", slug: "genmarketer-ad-planner", status: "live", benefit: "Kitalálja a kampányodat, amelyik megállítja a görgető ujjat a hírfolyamban.", benefitEn: "Comes up with the campaign that stops the scrolling thumb in the feed." },
      { code: "JORDAN", role: "a hirdetés-szövegíró", roleEn: "the ad copywriter", slug: "genmarketer-ad-copywriter", status: "live", benefit: "Megírja a hirdetésszövegeidet, amikre tényleg kattintanak - nem görgetnek tovább.", benefitEn: "Writes ad copy people actually click - instead of scrolling past." },
      { code: "PAM", role: "a kreatív designer", roleEn: "the creative designer", slug: "genmarketer-ad-creative-design", status: "live", benefit: "Megtervezi a hirdetési kreatívjaidat, amik kitűnnek a végtelen hírfolyamból.", benefitEn: "Designs ad creatives that stand out in the endless feed." },
      { code: "LUCIUS", role: "a Google Ads-hirdetéskezelő", roleEn: "the Google Ads manager", slug: "genmarketer-google-ads-expert", status: "live", benefit: "Beállítja és pörgeti a Google-hirdetéseidet, hogy ne égjen el feleslegesen a kereted.", benefitEn: "Sets up and runs your Google Ads so your budget doesn't burn for nothing." },
      { code: "NEO", role: "a Facebook Ads-szakértő", roleEn: "the Facebook Ads expert", slug: "genmarketer-facebook-ad-expert", status: "live", benefit: "Úgy kezeli a Meta-kampányaidat, hogy olcsóbb leadeket és több vásárlót hozzanak.", benefitEn: "Runs your Meta campaigns to bring cheaper leads and more buyers." }
    ]},
    { cat: "E-mail", catEn: "Email", color: "#FFC400", members: [
      { code: "FORREST", role: "az e-mail-szakértő", roleEn: "the email expert", slug: "genmarketer-email-marketing-expert", status: "live", benefit: "Megírja az e-mail-sorozataidat, amik eladnak helyetted - akkor is, amikor alszol.", benefitEn: "Writes your email sequences that sell for you - even while you sleep." }
    ]},
    { cat: "Design", catEn: "Design", color: "#9B6DFF", members: [
      { code: "MORPHEUS", role: "a Figma-tervező", roleEn: "the Figma designer", slug: "figma-use", status: "soon", benefit: "Profi dizájnt tervez neked Figmában, grafikus felvétele nélkül.", benefitEn: "Designs professional visuals in Figma - without hiring a graphic designer." },
      { code: "DOROTHY", role: "a Figma–kód híd", roleEn: "the Figma-to-code bridge", slug: "figma-developer-mcp", status: "live", benefit: "A dizájnodból működő kódot csinál - fejlesztő nélkül.", benefitEn: "Turns your design into working code - without a developer." },
      { code: "MIYAGI", role: "a Figma QA-ellenőr", roleEn: "the Figma QA reviewer", slug: "figma-qa", status: "soon", benefit: "Kiszúrja a dizájnod hibáit, mielőtt a vevőidnek szúrnának szemet.", benefitEn: "Catches the flaws in your design before your customers do." }
    ]},
    { cat: "Videó", catEn: "Video", color: "#400099", members: [
      { code: "Q", role: "a videós adatgyűjtő", roleEn: "the video data collector", slug: "yt-dlp", status: "live", benefit: "Összeszedi neked, mi működik a piacodon, hogy abból építkezz.", benefitEn: "Gathers what's working in your market so you can build on it." },
      { code: "TRUMAN", role: "az UGC-videó-producer", roleEn: "the UGC video producer", slug: "genmarketer-ugc-video", status: "live", benefit: "Elkészíti a hiteles UGC-videóidat, amik tényleg vásárlót hoznak.", benefitEn: "Creates authentic UGC videos that actually bring buyers." },
      { code: "TED", role: "a videós script-író", roleEn: "the video script writer", slug: "genmarketer-video-script-writer", status: "live", benefit: "Megírja a videóid forgatókönyvét, ami az első másodperctől fogva tartja a néződ.", benefitEn: "Writes your video scripts that hold viewers from the first second." },
      { code: "SARAH", role: "a videó-renderelő", roleEn: "the video renderer", slug: "seedance-multishot-prompter", status: "live", benefit: "Legenerálja a maximálisan konvertáló hirdetési videóidat - kamera, stáb és forgatás nélkül.", benefitEn: "Generates your high-converting ad videos - no camera, crew or shoot." },
      { code: "EDWARD", role: "a videóvágó", roleEn: "the video editor", slug: "genmarketer-video-editor", status: "soon", benefit: "Pörgős, figyelemmegtartó videóvá vágja a nyersanyagodat.", benefitEn: "Edits your raw footage into fast-paced, attention-holding video." }
    ]},
    { cat: "SEO", catEn: "SEO", color: "#00AACC", members: [
      { code: "COLUMBO", role: "a SEO-auditor", roleEn: "the SEO auditor", slug: "genmarketer-seo", status: "live", benefit: "Megmondja, miért nem talál meg a Google - és pontosan mit javíts az oldaladon.", benefitEn: "Tells you why Google can't find you - and exactly what to fix on your site." },
      { code: "INDIANA", role: "a kulcsszó-kutató", roleEn: "the keyword researcher", slug: "genmarketer-seo-research", status: "live", benefit: "Megtalálja neked a kulcsszavakat, amikre a vevőid tényleg rákeresnek.", benefitEn: "Finds the keywords your buyers actually search for." },
      { code: "MONICA", role: "a tartalom-optimalizáló", roleEn: "the content optimizer", slug: "genmarketer-seo-content", status: "live", benefit: "Úgy írja át a szövegeidet, hogy a Google is és az olvasóid is szeressék.", benefitEn: "Rewrites your content so both Google and your readers love it." },
      { code: "DOKI", role: "a technikai SEO-szakértő", roleEn: "the technical SEO expert", slug: "genmarketer-seo-technical", status: "live", benefit: "Kijavítja az oldalad technikai hibáit, amik hátráltatják a rangsorolásodat.", benefitEn: "Fixes the technical issues on your site that hold back your rankings." },
      { code: "KATNISS", role: "a helyi SEO-szakértő", roleEn: "the local SEO expert", slug: "genmarketer-seo-local", status: "live", benefit: "Felhozza a cégedet a helyi keresésben és a Google Térképen.", benefitEn: "Lifts your business in local search and on Google Maps." }
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
      var catLabel = LANG === "en" ? group.catEn : group.cat;
      html += '<div class="gm-cat gm-reveal" style="--cat:' + group.color + '">';
      html += '<div class="gm-cat__head">';
      html += '<span class="gm-cat__dot"></span>';
      html += '<h3 class="gm-cat__title">' + esc(catLabel) + '</h3>';
      html += '<span class="gm-cat__count">' + esc(T.specialist(group.members.length)) + "</span>";
      html += "</div>";
      html += '<div class="gm-cat__grid">';
      group.members.forEach(function (m, i) {
        var soon = m.status === "soon";
        var role = LANG === "en" ? m.roleEn : m.role;
        var benefit = LANG === "en" ? m.benefitEn : m.benefit;
        html += '<figure class="gm-card' + (soon ? " gm-card--soon" : "") + '" style="--i:' + i + '">';
        html += '<span class="gm-card__badge-wrap">';
        html += '<img class="gm-card__av" src="' + av(m.slug) + '" alt="' +
          esc(m.code + " - " + role) + '" loading="lazy" width="1484" height="236">';
        if (soon) html += '<span class="gm-card__soon">' + esc(T.soon) + '</span>';
        html += "</span>";
        html += '<figcaption class="gm-card__benefit">' + esc(benefit) + "</figcaption>";
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
    var label = pkg === "pro" ? T.pkgPro : T.pkgBasic;

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
      var checkoutKey = el.getAttribute("data-gm-checkout");

      // Checkout-gomboknál a valódi fizetési URL-t tegyük href-be (a CHECKOUT
      // marad az egyetlen cserehely), hogy a böngésző hover-előnézete és a
      // jobbklikk → "link másolása" is a helyes linket mutassa - ne "#"-et.
      if (checkoutKey && CHECKOUT[checkoutKey]) {
        el.setAttribute("href", CHECKOUT[checkoutKey]);
      }

      el.addEventListener("click", function (ev) {
        var pkg = el.getAttribute("data-gm-package") || "basic";
        var ctaId = el.getAttribute("data-gm-cta");

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
     6b) DEMO-VIDEÓK (.gm-video)
     --loop:  némított, akkor megy, amikor látszik (≥50%), kint áll;
              hang a .gm-video__mute kapcsolóval (user-gesture → engedett)
     --click: poszter + pulzáló play-gomb; kattintásra hang + controls + esemény
     Reduced motion: semmi sem indul magától, natív controls.
     ---------------------------------------------------------- */
  function wireVideos() {
    var figs = document.querySelectorAll(".gm-video");
    if (!figs.length) return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    Array.prototype.forEach.call(figs, function (fig) {
      var video = fig.querySelector("video");
      if (!video) return;
      var btn = fig.querySelector(".gm-video__play");

      if (reduce) {
        // Semmi automatikus mozgás: a látogató indít, natív vezérlőkkel (hang is ott).
        video.controls = true;
        if (btn) btn.remove();
        var mb = fig.querySelector(".gm-video__mute");
        if (mb) mb.remove();
        return;
      }

      if (fig.classList.contains("gm-video--loop") && "IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting && en.intersectionRatio >= 0.5) {
              video.play().catch(function () {});
            } else {
              video.pause();
            }
          });
        }, { threshold: [0, 0.5] });
        io.observe(video);
      }

      if (btn) {
        btn.addEventListener("click", function () {
          btn.remove();
          video.controls = true;
          video.muted = false; // user-gesture: mehet hanggal; a natív controls-on visszanémítható
          video.play().catch(function () {});
          try {
            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({
              event: "gm_video_play",
              video_id: video.getAttribute("data-gm-video") || null
            });
          } catch (e) {}
        });
      }

      var muteBtn = fig.querySelector(".gm-video__mute");
      if (muteBtn) {
        muteBtn.addEventListener("click", function () {
          video.muted = !video.muted;
          muteBtn.classList.toggle("is-on", !video.muted);
          muteBtn.setAttribute("aria-pressed", video.muted ? "false" : "true");
          muteBtn.setAttribute("aria-label", video.muted ? T.muteOn : T.muteOff);
          if (!video.muted && video.paused) video.play().catch(function () {});
        });
      }
    });
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
     7b) EREDMÉNY-LAPOZÓ (#bizonyitek, .gm-slider)
     Natív scroll-snap viszi a görgetést/swipe-ot; itt csak a
     nyilak, pöttyök, számláló és az aktív-állapot kerül rá.
     ---------------------------------------------------------- */
  function wireProofSlider() {
    var root = document.querySelector("[data-gm-slider]");
    if (!root) return;
    var track = root.querySelector("[data-gm-track]");
    var slides = track ? track.querySelectorAll(".gm-slide") : [];
    if (!track || !slides.length) return;
    var prev = root.querySelector("[data-gm-prev]");
    var next = root.querySelector("[data-gm-next]");
    var dotsWrap = root.querySelector("[data-gm-dots]");
    var count = root.querySelector("[data-gm-count]");
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var behavior = reduce ? "auto" : "smooth";
    var active = -1;
    var dots = [];

    Array.prototype.forEach.call(slides, function (slide, i) {
      slide.setAttribute("role", "group");
      slide.setAttribute("aria-roledescription", T.workRole);
      slide.setAttribute("aria-label", (i + 1) + " / " + slides.length);
      if (dotsWrap) {
        var dot = document.createElement("button");
        dot.type = "button";
        dot.className = "gm-slider__dot";
        dot.setAttribute("aria-label", T.viewWork(i + 1));
        dot.addEventListener("click", function () { goTo(i); });
        dotsWrap.appendChild(dot);
        dots.push(dot);
      }
    });

    function goTo(i) {
      // Végtelen lapozás: az utolsó után az első jön, az első előtt az utolsó.
      i = ((i % slides.length) + slides.length) % slides.length;
      var s = slides[i];
      track.scrollTo({
        left: s.offsetLeft - (track.clientWidth - s.offsetWidth) / 2,
        behavior: behavior
      });
    }

    function setActive(i) {
      if (i === active) return;
      active = i;
      Array.prototype.forEach.call(slides, function (s, k) {
        s.classList.toggle("is-active", k === i);
      });
      dots.forEach(function (d, k) { d.classList.toggle("is-active", k === i); });
      if (count) count.textContent = (i + 1) + " / " + slides.length;
    }

    var raf = null;
    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = null;
        var center = track.scrollLeft + track.clientWidth / 2;
        var best = 0, bestDist = Infinity;
        Array.prototype.forEach.call(slides, function (s, k) {
          var d = Math.abs(s.offsetLeft + s.offsetWidth / 2 - center);
          if (d < bestDist) { bestDist = d; best = k; }
        });
        setActive(best);
      });
    }

    track.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    if (prev) prev.addEventListener("click", function () { goTo(active - 1); });
    if (next) next.addEventListener("click", function () { goTo(active + 1); });
    track.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); goTo(active - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); goTo(active + 1); }
    });

    setActive(0);
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
    wireVideos();
    wireProofSlider();
    wireFaq();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
