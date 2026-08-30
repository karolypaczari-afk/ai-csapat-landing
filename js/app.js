/* ============================================================
   Az AI csapatod — MISSION CONTROL showcase · vezérlés
   GSAP + ScrollTrigger + Flip (global), Three.js hero (dyn import),
   ágens-kártyák, adat-viz, spec-sheet modal, tracking.
   ============================================================ */
(function () {
  "use strict";

  // A három GSAP-fájl 2026-08-05 óta LUSTÁN töltődik (ld. loadGsap lent), ezért ezek
  // a változók induláskor még undefined-ok, és a betöltés után kapnak értéket. Minden
  // használati helyük igazságkapun megy át (`if (gsap && ST)`, `Flip ? … : null`), így
  // az oldal akkor is teljes értékű, ha a vendor-fájl sosem érkezik meg.
  var gsap = window.gsap, ST = window.ScrollTrigger, Flip = window.Flip;
  var REDUCE = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var TEAM = window.GM_TEAM || [], AGENTS = window.GM_AGENTS || [];
  // A látható létszám a DEKLARÁLT landoló-tényből jön (js/data.js →
  // `window.GM_LANDING_FACTS`), nem az ágens-tömbből számolva. 2026-08-03 óta a
  // hirdetett csapatlétszám üzleti döntés, nem az élesített skillek darabszáma —
  // az egyes tagok állapota a kártyájukon látszik. A bedrótozott szám továbbra
  // sem szabad: a kapu (tests/roster-counts.mjs) a prózát EHHEZ az értékhez méri.
  var FACTS = window.GM_LANDING_FACTS || {};
  var TEAM_COUNT = FACTS.team || AGENTS.length;
  var AV = "/assets/img/avatars/";
  // Nyelv: a <html lang> dönti el (HU a gyökéren, EN a /en/-en).
  var EN = (document.documentElement.getAttribute("lang") || "hu").slice(0, 2).toLowerCase() === "en";
  function tr(hu, en) { return EN ? en : hu; }

  /* ---- Tracking (portolva a prod script.js-ből) ---- */
  // Mindkét nyelv árul előfizetést (2026-07-31 óta), de KÜLÖN pénztáron — és ez a
  // szétválasztás a vezérlő tervezési elv, nem kényelmi kérdés:
  //   HU → a tudástár WooCommerce/CartFlows pénztára, forintban (1992/1993);
  //   EN → a vip.genmarketer.eu saját EUR-os WooCommerce/CartFlows pénztára.
  // A két bolt külön WordPress/Woo környezet, ezért a termék-, variáció- és
  // pénznem-igazság nem keverhető közöttük.
  //
  // MINDKÉT nyelv 2026-08-27 óta KÉT ajánlatot visz: Standard/Planner és Pro/Autopilot,
  // mindkettő havi vagy 6 havi számlázással. Az EGYSZERI díjas csomag (HU „Skillpakk",
  // EN „Training") ekkor kivezetésre került — a Woo-termékek draftba mentek, és a
  // landolóról minden hivatkozása eltűnt.
  var CHECKOUT = EN ? {
    planner:   "https://vip.genmarketer.eu/checkout/?add-to-cart=45&variation_id=46&attribute_billing-period=Monthly",
    autopilot: "https://vip.genmarketer.eu/checkout/?add-to-cart=48&variation_id=49&attribute_billing-period=Monthly"
  } : {
    // 2026-08-03 óta az 1992/1993 `variable-subscription`: EGY termék kezeli a havi
    // ÉS az éves ciklust (Károly döntése; a két külön éves terméket, a 2320/2321-et
    // ő maga vezette ki). A ciklus VARIÁCIÓ, ezért a link nem lehet csupasz: a
    // `?add-to-cart=1992` variáció NÉLKÜL semmit nem tesz a kosárba (élőben mérve) —
    // a Woo a terméklapra irányít. A markup a HAVI variációt viseli, az évest a
    // ciklusváltó írja rá (`data-yearly-href`).
    //   1992 → 2342 Havi 9 990 Ft/hó · 2343 Éves 99 900 Ft/év
    //   1993 → 2344 Havi 19 990 Ft/hó · 2345 Éves 199 900 Ft/év
    // Az attribútum-SLUG ékezet nélküli (a WP `sanitize_title()`-je transzliterál),
    // az ÉRTÉK viszont ékezetes, ezért URL-kódolva megy. Rossz slug nem 404-et adna,
    // hanem némán a HAVI (alapértelmezett) variációt tenné a kosárba.
    //
    // ☠️ 2026-08-08 — A RÉGI `?add-to-cart=<szülő>&variation_id=<v>` FORMA ELDOBTA A
    //    KAMPÁNY-PARAMÉTEREKET. Nem a variációs termék hibája, és nem a WooCommerce-é
    //    (`woocommerce_cart_redirect_after_add = no`): az 1992/1993 terméken rajta van a
    //    `cartflows_redirect_flow_id` meta, ezért a CartFlows a
    //    `woocommerce_add_to_cart_redirect` szűrőn (prio 99) `get_permalink()`-ből ÚJ
    //    URL-t épít — és egyetlen eredeti query paramétert sem visz át. Mérve:
    //    `?add-to-cart=1992&variation_id=2342` → 302 → `/penztar/` query NÉLKÜL, míg
    //    a CartFlows-meta NÉLKÜLI termék `?add-to-cart=` → 200. Vagyis TERMÉK-BEÁLLÍTÁS, nem
    //    terméktípus-viselkedés.
    //
    //    Következmény: a WooCommerce rendelés-attribúciója (sourcebuster, URL-ből
    //    dolgozik) a hirdetésből érkező vevőt is `referral`-nak látta — 7 rendelésből
    //    5-öt. (A Meta `fbc`-jét ez NEM érintette: az a `.genmarketer.hu`-scope-os
    //    sütiben él, és élő szondával igazoltan átér a pénztár-aldomainre.)
    //
    //    A CartFlows NATÍV formája (`?wcf-add-to-cart=<VARIÁCIÓ-ID>`) meg sem hívja a Woo
    //    add-to-cart handlerét → nincs redirect, a paraméterek megmaradnak. A variáció
    //    SAJÁT ID-jét kell megadni, nem a szülőét. Mind a négy variáció élesben igazolva:
    //    200 + a HELYES ár a kosárban (2342→9 990/hó · 2343→39 960/6 hó · 2344→19 990/hó · 2345→79 960/6 hó).
    //
    planner:   "https://tudastar.genmarketer.hu/penztar/?wcf-add-to-cart=2342&wcf-qty=1",
    autopilot: "https://tudastar.genmarketer.hu/penztar/?wcf-add-to-cart=2344&wcf-qty=1"
  };
  var GA4_ID = "G-1EV18K1256";
  var ADS_ADD_TO_CART_SEND_TO = "AW-18242534961/ygdLCJ_J6sccELH82_pD";
  var PRICE = EN ? { planner: 29, autopilot: 59 } : { planner: 9990, autopilot: 19990 };
  var CURRENCY = EN ? "EUR" : "HUF";
  /* ── KI A TULAJDONOSA A TÖLCSÉR-ESEMÉNYNEK: a landoló vagy a pénztár? ─────────
   *
   * Mindkét nyelv pénztára WooCommerce + PixelYourSite Pro, és a pénztár MAGA is
   * tüzeli a kosár- és pénztár-eseményt. Ha a landoló is tüzelné, a platform KÉT
   * eseményt látna egyetlen vevői szándékra — és a dedup elvileg sem foghatna, mert
   * az `event_id`-ket más rendszer generálja.
   *
   * ☠️ DE EZT PLATFORMONKÉNT KELL ELDÖNTENI, NEM EGYBEN. 2026-08-07-én élőben mérve
   * a `wp_pys_options` visszaolvasásával: a tudástár PYS-e a Metát (browser + CAPI)
   * ÉS a GA4-et küldi — a **`pys_google_ads`** blokkjában viszont a `conversion_id`
   * és a `conversion_label` ÜRES, és egyetlen `AW-` azonosító sincs benne. Vagyis a
   * Google Ads add-to-cart konverziónak a landoló az EGYETLEN forrása. Egy közös
   * boolean tehát a duplikációval együtt a teljes Ads-mérést is kikapcsolta volna.
   *
   * A `meta`/`ga4` a pénztáré (ott browser+szerver párban, közös dedup-kulccsal megy,
   * tehát ERŐSEBB jel), az `ads` a landolóé, amíg a pénztár nem küldi.
   * A tábla mellé gépi kapu áll: `tests/funnel-ownership.mjs`. */
  var DOWNSTREAM_OWNS = EN
    ? { meta: true, ga4: true, ads: true }
    : { meta: true, ga4: true, ads: false };
  // Csomagcímke és GA4 `item_id`. Az `item_id` szándékosan UGYANAZ, mint az
  // aicsapat.genmarketer.hu előfizetéses landolón (`ai-csapatod-elofizetes-<pkg>`):
  // ugyanaz a Woo-termék (1992/1993), tehát a termék-szintű riport ne hasadjon
  // ketté landolónként. A két landoló szétválasztása a `content_group` /
  // `source` dimenzión megy — ez a bevált minta, nem az item_id csonkítása.
  //
  // Az EN `item_id` szándékosan KÜLÖN marad a magyartól (`-en-` taggel): más a
  // Woo-termék (2197/2198 vs. 1992/1993), más a pénznem és más a fizetési út,
  // tehát egy közös azonosító két különböző terméket olvasztana egy sorba.
  var PKG = EN ? {
    planner:   { label: "Planner subscription",   itemId: "ai-csapatod-en-elofizetes-planner" },
    autopilot: { label: "Autopilot subscription", itemId: "ai-csapatod-en-elofizetes-autopilot" }
  } : {
    planner:   { label: "Standard előfizetés",   itemId: "ai-csapatod-elofizetes-planner" },
    autopilot: { label: "Pro előfizetés", itemId: "ai-csapatod-elofizetes-autopilot" }
  };
  var PKG_DEFAULT = "planner";
  var ATTR_COOKIE = "gm_ads_attrib";
  var META_EXT_COOKIE = "gm_meta_ext_id";
  var ATTR_KEYS = ["gclid", "gbraid", "wbraid", "fbclid", "msclkid", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
  function isLocal() { return location.hostname === "localhost" || location.hostname === "127.0.0.1"; }
  // A süti-scope-ot a REGISZTRÁLHATÓ domainre kell emelni, különben a landolón írt
  // `_fbc` / `_fbp` / `gm_meta_ext_id` host-only marad, és a pénztár-aldomain NEM látja.
  // A `.eu`-n ez élesben azt jelentette, hogy a hirdetés-kattintás `fbclid`-je a
  // landolón rekedt, és a `vip.genmarketer.eu`-n történő vásárlás elvesztette a
  // kattintás-attribúciót — miközben az oldal hibátlanul működött (néma hiba).
  // A `.hu` ág szándékosan bájtra változatlan: a magyar út stabil, nem nyúlunk hozzá.
  function cookieDomain() {
    if (/\.genmarketer\.hu$/i.test(location.hostname)) return ";domain=.genmarketer.hu";
    if (/(^|\.)genmarketer\.eu$/i.test(location.hostname)) return ";domain=.genmarketer.eu";
    return "";
  }
  function secureFlag() { return location.protocol === "https:" ? ";Secure" : ""; }
  function readCookie(name) {
    var m = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/[.$?*|{}()[\]\\/+^]/g, "\\$&") + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : "";
  }
  function writeCookie(name, value, days) {
    var maxAge = Math.max(1, days || 90) * 86400;
    document.cookie = name + "=" + encodeURIComponent(value) + ";path=/;max-age=" + maxAge + ";SameSite=Lax" + cookieDomain() + secureFlag();
  }
  function uid() {
    return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + "-" + Math.random().toString(36).slice(2);
  }
  /* ☠️ 2026-08-08 — a `creation_time` MÁSODPERCBEN ment, a Meta MILLISZEKUNDUMOT ír elő.
   *
   * A specifikáció: `fb.<subdomain_index>.<creation_time>.<fbclid>`, ahol a creation_time
   * „the UNIX time since epoch **in milliseconds**" — a doksi példája 13 jegyű
   * (`fb.1.1554763741205.…`). A kódunk `Math.floor(Date.now()/1000)`-rel 10 jegyűt írt.
   *
   * Miért nem kozmetika: a Meta a `_fbc`-ből olvassa ki a kattintás IDEJÉT az attribúciós
   * ablakhoz. Egy másodperc-alapú bélyeg ezredére kisebb, azaz 1970 közelére esik —
   * vagyis pont az a mező romlik el, ami a kattintást a konverzióhoz kötné. Ez a 2026-08-08-i
   * audit fő leletének (a Meta 7 rendelésből 1-et attribuált) egyik valószínű társ-oka.
   *
   * A tesztek VAKON voltak rá: a `tests/meta-pixel.mjs` csak az `^fb\.1\.` prefixet és az
   * fbclid meglétét nézte, a bélyeg nagyságrendjét soha — ugyanaz a minta, mint
   * [[reference_landing_test_asserted_the_tracking_defect]]. A javítással együtt megy a kapu.
   *
   * A ROMLOTT sütit migráljuk: a doksi szerint a `_fbc`-t csak akkor szabad újraírni, ha
   * nincs cookie VAGY az URL fbclid-je eltér a tároltól — de egy hibás formátumú bélyeg
   * rosszabb, mint egy reset, ezért azt is javítjuk. Jól formált sütit nem bántunk. */
  var FB_COOKIE_RE = /^fb\.\d+\.(\d+)\.(.+)$/;
  function fbCookieMalformed(value) {
    var m = FB_COOKIE_RE.exec(String(value || ""));
    return !m || String(m[1]).length < 13; // < 13 jegy = másodperc-alapú, romlott
  }
  function fbCookieClickId(value) {
    var m = FB_COOKIE_RE.exec(String(value || ""));
    return m ? m[2] : "";
  }
  function ensureMetaCookies() {
    var now = Date.now(), qs = new URLSearchParams(location.search); // MILLISZEKUNDUM
    var externalId = readCookie(META_EXT_COOKIE);
    if (!externalId) {
      externalId = "gm_" + uid();
      writeCookie(META_EXT_COOKIE, externalId, 390);
    }
    var fbp = readCookie("_fbp");
    if (!fbp) {
      fbp = "fb.1." + now + "." + Math.floor(Math.random() * 10000000000);
      writeCookie("_fbp", fbp, 390);
    } else if (fbCookieMalformed(fbp)) {
      // A véletlen utótagot MEGTARTJUK — csak a hibás bélyeget javítjuk, hogy a
      // böngésző-azonosító a lehető legkevesebbet mozduljon.
      fbp = "fb.1." + now + "." + (fbCookieClickId(fbp) || Math.floor(Math.random() * 10000000000));
      writeCookie("_fbp", fbp, 390);
    }
    var fbc = readCookie("_fbc"), fbclid = qs.get("fbclid");
    // Doksi: csak akkor írjuk, ha nincs süti, VAGY az URL fbclid-je eltér a tároltól.
    // Plusz: a romlott (másodperc-alapú) bélyeget akkor is javítjuk, ha nincs új fbclid.
    if (fbclid && (!fbc || fbCookieClickId(fbc) !== fbclid || fbCookieMalformed(fbc))) {
      fbc = "fb.1." + now + "." + fbclid;
      writeCookie("_fbc", fbc, 90);
    } else if (fbc && fbCookieMalformed(fbc)) {
      fbc = "fb.1." + now + "." + fbCookieClickId(fbc);
      writeCookie("_fbc", fbc, 90);
    }
    return { fbp: fbp, fbc: fbc, externalId: externalId };
  }
  function eventId(name, pkg) {
    return ["gm", name, pkg || "unknown", Date.now(), Math.random().toString(36).slice(2, 10)].join("-");
  }
  // A Meta `content_ids` SZÁNDÉKOSAN eltér a GA4 `item_id`-tól.
  //
  // 2026-08-07, élesben mérve: a tudástár pénztárán a PixelYourSite a Woo VARIÁCIÓ-ID-t
  // küldi (`content_ids: ["2342"]`), a landoló viszont a saját slugját
  // (`ai-csapatod-elofizetes-planner`). Ugyanaz a vevő, ugyanaz a termék — a Metának
  // KÉT KÜLÖNBÖZŐ termék. Ezért sem a tartalom-alapú közönség, sem a dinamikus hirdetés
  // nem tud a landoló jeléről a pénztár jelére illeszkedni.
  //
  // A GA4 `item_id`-hoz NEM nyúlunk: az a riport-folytonosságot hordozza (a 872 sora
  // hetek óta `ai-csapatod-basic`), és egy csere két sorra hasítaná ugyanazt a terméket.
  // A kettő két külön rendszer kulcsa — a Metáé a Woo-ID, a GA4-é a beszédes slug.
  var META_CONTENT_ID = EN
    ? { planner: "46", autopilot: "49" }
    : { planner: "2342", autopilot: "2344" };
  // A GOMBON ÁLLÓ href az igazság, nem a konstans: a ciklusváltó átírja (havi 2342 →
  // éves 2343), és a kosárba is az kerül — ugyanaz az elv, mint a `checkoutTarget`-nél.
  // A konstans csak ott kell, ahol nincs pénztár-href (anchor-CTA, `ViewContent`);
  // ilyenkor a HAVI variáció a helyes alapértelmezés, mert a markup is azt viseli.
  /* ☠️ A KONVERZIÓS ÉRTÉK a VARIÁCIÓ-ból jön, nem a csomag fix havidíjából.
   *
   * 2026-08-27-ig a `track()` a `PRICE[pkg]`-t küldte — vagyis MINDIG a havi árat,
   * akkor is, ha a vevő 6 havit vagy több férőhelyet tett a kosárba. Mérve: egy
   * Pro / 6 havi / 5 fős vásárlás 19 990-et jelentett 191 800 helyett — 9,6-szeres
   * ALULMÉRÉS. Ez nem kozmetika: a Meta és a Google EZEN az értéken licitál, tehát
   * az alulmért érték rosszabb ajánlatot és torz ROAS-t okoz.
   *
   * A kulcs a variáció-ID, mert az a CTA élő `href`-jében amúgy is ott van — a
   * `metaContentId` már ma is onnan olvassa a `content_id`-t. Egy forrás, egy kulcs.
   *
   * NEM a látható árszövegből számolunk: a „Ft/6 hó" egység maga is tartalmaz
   * számjegyet, és a nyers számjegy-szűrés pont ezen bukott el ma egy kapuban.
   *
   * Gépi kapu: tests/tracking-value.mjs — a markupban deklarált variáció↔ár párokat
   * veti össze ezzel a térképpel, fail-closed. Ha egy ár változik és ez nem, PIROS. */
  var VALUE_BY_VARIATION = EN ? { "46": 29, "47": 116, "49": 59, "50": 236, "337": 44, "338": 176, "339": 55, "340": 220, "341": 64, "342": 256, "343": 69, "344": 276, "345": 89, "346": 356, "347": 111, "348": 444, "349": 129, "350": 516, "351": 139, "352": 556 }
                              : { "2342": 9990, "2343": 39960, "2344": 19990, "2345": 79960, "3494": 14980, "3495": 59920, "3496": 18970, "3497": 75880, "3498": 21960, "3499": 87840, "3500": 23950, "3501": 95800, "3502": 29980, "3503": 119920, "3504": 37970, "3505": 151880, "3506": 43960, "3507": 175840, "3508": 47950, "3509": 191800 };
  function offerValue(pkg, el) {
    try {
      var href = el && el.getAttribute && el.getAttribute("href");
      if (href) {
        var q = new URL(href, location.href).searchParams;
        var v = q.get("wcf-add-to-cart") || q.get("variation_id") || q.get("add-to-cart");
        if (v && VALUE_BY_VARIATION[v] != null) return VALUE_BY_VARIATION[v];
      }
    } catch (e) {}
    // Tartalék: a csomag havi ára. Rosszabb, mint a pontos érték, de nulla
    // sosem lehet — egy 0 értékű konverzió a licitnek azt mondaná, hogy semmit sem ér.
    return PRICE[pkg] || 0;
  }
  function metaContentId(pkg, el) {
    try {
      var href = el && el.getAttribute && el.getAttribute("href");
      if (href) {
        var q = new URL(href, location.href).searchParams;
        var v = q.get("variation_id") || q.get("add-to-cart");
        if (v) return String(v);
      }
    } catch (e) {}
    return META_CONTENT_ID[pkg] || META_CONTENT_ID[PKG_DEFAULT];
  }
  function metaPayload(item, value, metaCookies, contentId) {
    var cid = contentId || item.item_id;
    return {
      content_name: item.item_name,
      content_category: item.item_category,
      content_ids: [cid],
      content_type: "product",
      contents: [{ id: cid, quantity: 1, item_price: value }],
      num_items: 1,
      value: value,
      currency: CURRENCY,
      action_source: "website",
      event_source_url: location.href,
      language: (document.documentElement.lang || "hu").slice(0, 2).toLowerCase(),
      external_id: metaCookies.externalId || undefined,
      fbp: metaCookies.fbp || undefined,
      fbc: metaCookies.fbc || undefined
    };
  }
  function readStoredAttribution() {
    var raw = readCookie(ATTR_COOKIE);
    if (!raw && window.localStorage) {
      try { raw = localStorage.getItem(ATTR_COOKIE) || ""; } catch (e) {}
    }
    if (!raw) return {};
    try { return JSON.parse(raw) || {}; } catch (e) { return {}; }
  }
  function writeStoredAttribution(value) {
    var json = JSON.stringify(value || {});
    writeCookie(ATTR_COOKIE, json, 90);
    if (window.localStorage) {
      try { localStorage.setItem(ATTR_COOKIE, json); } catch (e) {}
    }
  }
  function ensureAdAttribution() {
    var qs = new URLSearchParams(location.search), current = readStoredAttribution(), incoming = {}, hasClickId = false;
    ATTR_KEYS.forEach(function (k) {
      var v = qs.get(k);
      if (v) {
        incoming[k] = v;
        if (/^(gclid|gbraid|wbraid|fbclid|msclkid)$/.test(k)) hasClickId = true;
      }
    });
    var out = Object.assign({}, current);
    if (Object.keys(incoming).length) {
      out = hasClickId ? Object.assign({}, incoming) : Object.assign({}, current, incoming);
      out.first_seen = out.first_seen || new Date().toISOString();
      out.last_seen = new Date().toISOString();
      out.landing_page = location.pathname + location.search;
      out.referrer = document.referrer || out.referrer || "";
      writeStoredAttribution(out);
    }
    ["gclid", "gbraid", "wbraid", "msclkid"].forEach(function (k) {
      if (out[k]) writeCookie("gm_" + k, out[k], 90);
    });
    return normalizeAttribution(out);
  }
  // Attribúció-helyreállítás a landolásnál.
  //
  // Mérési előzmény (2026-07-27 lifetime audit): a tudástár-checkouton 308 session
  // `ai-csapat-landing / (not set)` forrással landolt, és ezek vitték a GA4 vásárlások
  // 40%-át (230 967 Ft) — vagyis a legértékesebb konverziók csatorna nélkül maradtak.
  //
  // Két külön ok van, és mindkettőt itt lehet a leghamarabb elkapni:
  //   1. Kattintásazonosító (fbclid) érkezik UTM nélkül → nincs mit továbbadni a
  //      checkoutra, ezért a medium `(not set)` lesz.
  //   2. A `utm_source` a **célt** nevezi meg (a landing saját címkéjét), nem a
  //      forgalom forrását. A GA4 Paid Social szabálya felismert social forrásra
  //      illeszkedik, ezért az ilyen session Paid Other csoportba esik.
  //
  // Ez a függvény csak akkor pótol, ha az érték hiányzik vagy önmagát nevezi meg —
  // valódi, kézzel címkézett kampány-UTM-et soha nem ír felül.
  var CLICK_ID_SOURCE = {
    fbclid: { utm_source: "meta", utm_medium: "paid_social" },
    gclid: { utm_source: "google", utm_medium: "cpc" },
    gbraid: { utm_source: "google", utm_medium: "cpc" },
    wbraid: { utm_source: "google", utm_medium: "cpc" },
    msclkid: { utm_source: "bing", utm_medium: "cpc" }
  };
  // A landing saját címkéi: ezek célt jelölnek, nem forrást, ezért felülírhatók.
  var SELF_DESCRIBING_SOURCE = /^(ai-csapat-landing|ai-csapat|landing|genmarketer(\.hu)?)$/i;
  function normalizeAttribution(attrib) {
    var out = Object.assign({}, attrib || {});
    var derived = null;
    for (var key in CLICK_ID_SOURCE) {
      if (Object.prototype.hasOwnProperty.call(CLICK_ID_SOURCE, key) && out[key]) { derived = CLICK_ID_SOURCE[key]; break; }
    }
    if (!derived) return out;
    var changed = false;
    if (!out.utm_source || SELF_DESCRIBING_SOURCE.test(String(out.utm_source))) {
      // A felülírt eredetit megőrizzük, hogy a riportban visszakereshető maradjon.
      if (out.utm_source && !out.gm_source_original) out.gm_source_original = out.utm_source;
      out.utm_source = derived.utm_source;
      changed = true;
    }
    if (!out.utm_medium) { out.utm_medium = derived.utm_medium; changed = true; }
    if (changed) {
      out.gm_attrib_normalized = "1";
      writeStoredAttribution(out);
    }
    return out;
  }
  function track(pkg, ctaId, isCheckout, el) {
    var meta = PKG[pkg] || PKG[PKG_DEFAULT];
    var value = offerValue(pkg, el), label = meta.label;
    var itemId = meta.itemId, cartEid = eventId("add_to_cart", pkg), eid = eventId("initiate_checkout", pkg);
    var contentId = metaContentId(pkg, el);
    var metaCookies = ensureMetaCookies();
    var adAttrib = ensureAdAttribution();
    // A landoló saját forrás-címkéje custom dimensionként megy — hogy a lead- és
    // vásárlásforrás eseményszinten is bontható legyen (2026-07-27 audit: 62 érintett
    // form/purchase esemény volt forrás nélkül).
    //
    // ☠️ 2026-08-08: a kulcs `source` volt, és ez FELÜLÍRTA a GA4 valódi forgalmi
    //    forrását. A `source`/`medium`/`campaign`/`term`/`content` a GA4-nek FOGLALT
    //    név (manual traffic source) — custom dimensionnek tilos. Mérve: a landoló
    //    munkameneteinek `sessionSource`-a 653-ban `ai-csapat-landing`, 4-ben `meta`,
    //    miközben a `utm_medium`/`campaign`/`content` helyesen átjött, és a kontroll
    //    host (genmarketer.hu, nincs rajta ilyen kulcs) normálisan attribuál.
    //    A prefix ezért nem stílus-kérdés: ez a védelem maga.
    adAttrib = Object.assign({ gm_source: adAttrib.utm_source || "ai-csapat-landing" }, adAttrib);
    var item = { item_id: itemId, item_name: "Az AI csapatod - " + label, item_brand: "GENmarketer", item_category: "AI marketing training", price: value, quantity: 1 };
    if (isCheckout) {
      try { window.dataLayer = window.dataLayer || []; window.dataLayer.push(Object.assign({ event: "gm_add_to_cart", event_id: cartEid, cta_id: ctaId || null, package: pkg, item_id: itemId, item_name: item.item_name, value: value, currency: CURRENCY }, adAttrib)); } catch (e) {}
      if (!DOWNSTREAM_OWNS.ga4) {
        try { if (typeof window.gtag === "function") window.gtag("event", "add_to_cart", Object.assign({ send_to: GA4_ID, event_id: cartEid, currency: CURRENCY, value: value, cta_type: ctaId || "checkout", items: [item] }, adAttrib)); } catch (e) {}
      }
      // A Google Ads konverzió KÜLÖN ágon dől el: a tudástár PYS-ében nincs Ads
      // conversion ID, tehát a magyar ágon ez az EGYETLEN forrás. Ha ezt a
      // Meta/GA4 kapcsolóval együtt némítanánk, a teljes Ads-mérés eltűnne.
      if (!DOWNSTREAM_OWNS.ads) {
        try { if (typeof window.gtag === "function") window.gtag("event", "conversion", Object.assign({ send_to: ADS_ADD_TO_CART_SEND_TO, event_id: cartEid, currency: CURRENCY, value: value, cta_type: ctaId || "checkout" }, adAttrib)); } catch (e) {}
      }
      if (!DOWNSTREAM_OWNS.meta) {
        try { if (typeof window.fbq === "function") window.fbq("track", "AddToCart", metaPayload(item, value, metaCookies, contentId), { eventID: cartEid }); } catch (e) {}
      }
    }
    try { window.dataLayer = window.dataLayer || []; window.dataLayer.push(Object.assign({ event: "gm_cta_click", event_id: eid, cta_id: ctaId || null, package: pkg, item_id: itemId, item_name: item.item_name, value: value, currency: CURRENCY }, adAttrib)); } catch (e) {}
    // ☠️ 2026-08-07, élesben mérve: a 18 CTA-ból 12 CSAK a `#arazas`-ra görget
    // (`hero`, `header`, `sticky`, `modal`, 8× `usecase-*`) — és mindegyik
    // `InitiateCheckout`-ot + `begin_checkout`-ot tüzelt. „Görgess az árakhoz" ≠
    // „megkezdtem a fizetést": a látogató el sem hagyta a landolót.
    //
    // Ez nem riport-szépséghiba. Az aktív adset `custom_event_type` értéke
    // `INITIATED_CHECKOUT` (10 000 Ft/nap), tehát a Meta PONTOSAN erre a jelre
    // optimalizált — és a jel nagyobb része görgetés volt. A számok, amikből ez
    // kiderült: Meta 08-01→08-07 `add_to_cart` 43 vs. `initiate_checkout` 105;
    // GA4 ugyanebben a szeletben `CartFlows_checkout` 111 vs. `begin_checkout` 445.
    //
    // A CRO-jel NEM vész el: a görgető CTA-k ugyanazt a `gm_cta_click` eseményt
    // kapják, amit az angol ág már használ — csak nem szabványos ecommerce néven,
    // tehát nem hígítja a tölcsér-riportot és nem tanítja félre az optimalizálót.
    //
    // 2026-08-07, második kör: a magyar ágon a PÉNZTÁR is tüzeli ugyanezt
    // (`woo_initiate_checkout` → Meta `InitiateCheckout` + GA4 `begin_checkout`,
    // saját PYS-GUID-dal), tehát a valódi pénztár-CTA is duplázott. Innentől a
    // pénztár az igazság-forrás, és a landoló MINDEN CTA-ra a `gm_cta_click`-et
    // küldi — a CRO-mérés így teljes marad, tölcsér-torzítás nélkül.
    if (isCheckout && !DOWNSTREAM_OWNS.ga4) {
      try { if (typeof window.gtag === "function") window.gtag("event", "begin_checkout", Object.assign({ send_to: GA4_ID, event_id: eid, currency: CURRENCY, value: value, cta_type: ctaId || "cta", items: [item] }, adAttrib)); } catch (e) {}
    } else {
      try { if (typeof window.gtag === "function") window.gtag("event", "gm_cta_click", Object.assign({ send_to: GA4_ID, event_id: eid, currency: CURRENCY, value: value, cta_type: ctaId || "cta", package: pkg }, adAttrib)); } catch (e) {}
    }
    if (isCheckout && !DOWNSTREAM_OWNS.meta) {
      try { if (typeof window.fbq === "function") window.fbq("track", "InitiateCheckout", metaPayload(item, value, metaCookies, contentId), { eventID: eid }); } catch (e) {}
    }
  }
  // A landoló URL marketing-paramjait átvisszük a tudástár-checkoutra, hogy a
  // vásárlás-session NE (direct)-ként attribútálódjon (cross-subdomain attribúció).
  function withAttribution(url) {
    try {
      var inq = new URLSearchParams(location.search);
      var metaCookies = ensureMetaCookies();
      var adAttrib = ensureAdAttribution();
      var out = new URL(url, location.href);
      // A VIP CartFlows natív variation-linkje megőrzi a teljes query stringet.
      // A Woo szülő+variation formája előbb tiszta /checkout/ URL-re irányított,
      // és a redirect során a Woo/PYS forrásolvasó már (direct)/(none) értéket látott.
      // A magyar pénztár is ezt a natív formát használja; a VIP-en élőben mérve
      // ugyanígy a helyes terméket teszi kosárba, redirect nélkül.
      if (EN && out.hostname === "vip.genmarketer.eu" && out.pathname === "/checkout/" && out.searchParams.get("variation_id")) {
        var variationId = out.searchParams.get("variation_id");
        out.searchParams.delete("add-to-cart");
        out.searchParams.delete("variation_id");
        out.searchParams.delete("attribute_billing-period");
        out.searchParams.delete("attribute_seats");
        out.searchParams.set("wcf-add-to-cart", variationId);
        out.searchParams.set("wcf-qty", "1");
      }
      ATTR_KEYS.forEach(function (k) {
        // A normalizált tárolt érték az erősebb: az `ensureAdAttribution` már
        // beolvasztotta az aktuális URL paramjait ÉS helyreállította a hiányzó vagy
        // önmagát megnevező source/medium értéket. A nyers URL-paramot előnyben
        // részesíteni visszahozná a `(not set)` mediumot a checkoutra.
        var v = adAttrib[k] || inq.get(k);
        if (v && !out.searchParams.has(k)) out.searchParams.set(k, v);
      });
      if (metaCookies.fbp && !out.searchParams.has("fbp")) out.searchParams.set("fbp", metaCookies.fbp);
      if (metaCookies.fbc && !out.searchParams.has("fbc")) out.searchParams.set("fbc", metaCookies.fbc);
      if (metaCookies.externalId && !out.searchParams.has("external_id")) out.searchParams.set("external_id", metaCookies.externalId);
      return out.toString();
    } catch (e) { return url; }
  }
  /* A kattintás CÉLJA a GOMBON ÁLLÓ href, nem a `CHECKOUT` konstans.
   *
   * ☠️ 2026-08-03, élesben mérve: a `wireCtas` kattintáskor `ev.preventDefault()`-tal
   * a beépített `CHECKOUT[key]`-re navigált, és ezzel ELDOBTA azt a hrefet, amit az
   * oldal futásidőben írt rá. A havi↔éves ciklusváltó pontosan ezt teszi → a vevő az
   * ÉVES gombot látta (a hover-URL is az éves variációt mutatta), a kosárba mégis a
   * HAVI került. A hiba osztálya: KÉT igazság-forrás ugyanarra a célra, és a néma
   * vesztes az volt, amelyiket a vevő látta.
   *
   * A `href` mostantól nyer — de FAIL-CLOSED: csak akkor hisszük el, ha ugyanarra az
   * originre ÉS ugyanarra az útvonalra megy, mint a beépített cél (tehát csak a query
   * térhet el, mint a ciklusváltónál). Minden más esetben a beépített cél marad, így
   * egy elrontott vagy idegen href nem tudja elvinni a vevőt máshova.
   *
   * A `withAttribution` idempotens (csak hiányzó paramot ír), ezért ha semmi nem írja
   * át a hrefet, a viselkedés bájtra a régi. */
  function checkoutTarget(el, key) {
    var built = CHECKOUT[key];
    var live = el.getAttribute("href");
    if (!live) return withAttribution(built);
    try {
      var a = new URL(live, location.href), b = new URL(built, location.href);
      if (a.origin !== b.origin || a.pathname !== b.pathname) return withAttribution(built);
      return withAttribution(live);
    } catch (e) { return withAttribution(built); }
  }
  /* ── Havi ↔ hosszabb számlázási ciklus ─────────────────────────────────────
   *
   * EGY implementáció mindkét nyelvre, és MINDEN ciklus-függő értéket a MARKUP
   * DEKLARÁL — a script nem következtet, nem számol és nem alakít sztringet.
   *
   * ⚠️ A `yearly` KULCS, nem állítás (2026-08-27). A magyar landolón a hosszabb
   * ciklus azóta 6 HÓNAP (négy havidíj), az angolon még 12 hónap. A kulcs azért
   * marad `yearly`, mert a script úgysem tud róla semmit: a felirat, az ár és a
   * kosárlink is a markupból jön. Átnevezni csak MINDKÉT nyelven, a tesztekkel
   * és a telemetria-dimenzióval együtt szabad — a `gm_cycle_switch` eddigi
   * sorai különben elszakadnának az utánuk jövőktől.
   *
   * ☠️ Miért nem sztring-átalakítás (az első, angol változat így indult):
   *  1. az árformátum nyelvfüggő. A `/(\d+)/` első találata a magyar
   *     „9 990 Ft/hó"-ban a **9**, tehát a csere „99 990"-et gyártana — néma,
   *     tízszeres tévedés a fő pénzúton;
   *  2. az egységcímke is nyelvfüggő (`/month` vs. `Ft/hó`);
   *  3. a GOMB FELIRATA is árat hordoz, és arról külön meg kell emlékezni.
   * Deklarált értékkel mindhárom eltűnik: ami a kártyán áll, azt a markup mondja ki.
   *
   * FAIL-CLOSED: ha egy CTA-ból hiányzik a `data-yearly-href`, a kapcsoló NEM
   * kapcsol. Éves árat hirdetni havi kosárral rosszabb, mint nem kapcsolni.
   *
   * A havi értékeket az ELSŐ kapcsoláskor jegyezzük meg, nem betöltéskor: addigra a
   * `wireCtas` már ráírta a hrefre a marketing-attribúciót, és azt az éves ágnak is
   * meg kell tartania. */
  /* Létszám-tengely (2026-08-11). Ugyanaz az elv, mint a ciklusváltónál: minden
   * értéket a MARKUP deklarál (`data-seat-offer` a CTA-n, `data-seat-price` az
   * áron), a script nem számol és nem alakít sztringet — a per-férőhelyes ár
   * NEM lineáris, tehát bármilyen számolás néma tévedést gyártana.
   * Csak ott jelenik meg, ahol a markup kéri: a magyar landolón nincs
   * `[data-gm-seats]`, ezért ott ez a teljes ág holt kód marad. */
  function seatEntry(el, key, n) {
    var raw = el.dataset[key];
    if (!raw) return null;
    if (!el._gmSeat) { try { el._gmSeat = JSON.parse(raw); } catch (e) { el._gmSeat = {}; } }
    var hit = el._gmSeat[n];
    return hit && hit.monthly && hit.yearly ? hit : null;
  }
  function wireBillingCycle() {
    var box = document.querySelector("[data-gm-cycle]");
    if (!box) return;
    var links = [], amounts = [];
    document.querySelectorAll("a[data-gm-checkout][data-yearly-href]").forEach(function (a) { links.push(a); });
    document.querySelectorAll("[data-gm-price][data-yearly]").forEach(function (x) { amounts.push(x); });
    if (!links.length) return;

    /* FAIL-CLOSED a létszámra is: ha akár EGY ajánlott férőhelyhez hiányzik a
     * deklaráció bármelyik CTA-n vagy áron, a választót ELTÁVOLÍTJUK. Egy
     * vezérlő, ami néha rossz kosarat nyit, rosszabb, mint a hiánya. */
    var seatBox = document.querySelector("[data-gm-seats]");
    var seats = "1";
    if (seatBox) {
      var offered = [];
      seatBox.querySelectorAll("button[data-seats]").forEach(function (b) { offered.push(b.dataset.seats); });
      var complete = offered.length > 1 && offered.every(function (n) {
        if (n === "1") return true;
        return links.every(function (a) { return !!seatEntry(a, "seatOffer", n); })
            && amounts.every(function (x) { return !!seatEntry(x, "seatPrice", n); });
      });
      if (!complete) { if (seatBox.parentNode) seatBox.parentNode.removeChild(seatBox); seatBox = null; }
    }

    function apply(cycle) {
      var yearly = cycle === "yearly";
      links.forEach(function (a) {
        // A megjegyzés MINDIG az első: ekkor a DOM még az 1 fős értéket tartja,
        // és a `wireCtas` attribúciója már rajta van.
        if (!a.dataset.monthlyHref) a.dataset.monthlyHref = a.getAttribute("href");
        if (!a.dataset.monthlyLabel) a.dataset.monthlyLabel = a.innerHTML;
        var pick = seats !== "1" ? seatEntry(a, "seatOffer", seats) : null;
        pick = pick ? pick[cycle] : null;
        // A markupban deklarált ciklus-/seat-cél csak az ajánlat paramétereit
        // tartalmazza. Minden újraválasztás után vissza kell tenni a landing
        // attribúcióját is; különben a kapcsoló ledobja az UTM-et, click ID-ket
        // és a Meta match kulcsait még a pénztárba lépés előtt.
        var target = pick ? pick.href : (yearly ? a.dataset.yearlyHref : a.dataset.monthlyHref);
        a.setAttribute("href", withAttribution(target));
        var label = pick ? pick.label : (yearly ? a.dataset.yearlyLabel : a.dataset.monthlyLabel);
        if (label) a.innerHTML = label;
      });
      amounts.forEach(function (x) {
        if (!x.dataset.monthly) x.dataset.monthly = x.innerHTML;
        var sp = seats !== "1" ? seatEntry(x, "seatPrice", seats) : null;
        x.innerHTML = sp ? sp[cycle] : (yearly ? x.dataset.yearly : x.dataset.monthly);
      });
      box.querySelectorAll("button[data-cycle]").forEach(function (b) {
        var on = b.dataset.cycle === cycle;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      box.setAttribute("data-gm-cycle", cycle);
    }

    box.addEventListener("click", function (ev) {
      var b = ev.target.closest("button[data-cycle]");
      if (!b) return;
      apply(b.dataset.cycle);
      // MIÉRT MÉRJÜK: az éves ág két hónapnyi kedvezményt ad, és a kapcsoló a
      // legolcsóbb árbevétel-emelő elemünk — de eddig semmi nem mondta meg,
      // hányan nyúlnak hozzá egyáltalán. A `begin_checkout` már a kapcsolás
      // UTÁNI hrefet viszi, tehát a szándékot nem, csak az eredményt látjuk.
      // Metára NEM megy: a ciklusválasztás elemzési kérdés (mennyien akarnak
      // éveset), nem közönség — a szándékot a `PricingReached` már lefedi.
      signal("gm_cycle_switch", { billing_cycle: b.dataset.cycle }, { clarityKey: "billing_cycle", clarityValue: b.dataset.cycle });
    });

    if (seatBox) {
      seatBox.addEventListener("click", function (ev) {
        var b = ev.target.closest("button[data-seats]");
        if (!b) return;
        seats = b.dataset.seats;
        seatBox.querySelectorAll("button[data-seats]").forEach(function (x) {
          var on = x.dataset.seats === seats;
          x.classList.toggle("is-on", on);
          x.setAttribute("aria-pressed", on ? "true" : "false");
        });
        seatBox.setAttribute("data-gm-seats", seats);
        apply(box.getAttribute("data-gm-cycle") || "monthly");
        // MIÉRT MÉRJÜK: a férőhely a legnagyobb kosárérték-emelő, és eddig
        // semmi nem mondta meg, hányan gondolkodnak egynél több licencben.
        signal("gm_seats_switch", { seats: seats }, { clarityKey: "seats", clarityValue: seats });
      });
    }
  }
  function wireCtas() {
    document.querySelectorAll("[data-gm-cta]").forEach(function (el) {
      var key = el.getAttribute("data-gm-checkout");
      if (key && CHECKOUT[key]) el.setAttribute("href", withAttribution(CHECKOUT[key]));
      el.addEventListener("click", function (ev) {
        track(el.getAttribute("data-gm-package") || PKG_DEFAULT, el.getAttribute("data-gm-cta"), !!(key && CHECKOUT[key]), el);
        if (key && CHECKOUT[key]) { ev.preventDefault(); window.location.href = checkoutTarget(el, key); }
      });
    });
  }

  // Per-ágens SZEREP-SPECIFIKUS animáció + sebesség — minden szakember a saját
  // munkáját idéző vizuált kapja (mind egyedi). A drawerek: js/dashboards.js.
  // ⚠️ ÚJ specialista felvételekor IDE is kell egy [drawer, sebesség] sor (relevánssal),
  //    különben a kártya a semleges fallbackra esik — a gépi kapu: tests/viz-coverage.mjs (test:all).
  /* A kulcs a data.js `code` mezője (ASCII). A drawer-nevek a dashboards.js DRAW mapjéből. */
  var VIZ = {
    SHERLOCK: ["scan", 1.0],   "SUN-TZU": ["versus", 1.0], ATHENE: ["tree", 0.9],  PERPETUUM: ["loop", 1.0],
    MIDASZ: ["wireframe", 1.0], ROBINSON: ["build", 1.0],
    KEPLER: ["funnel", 1.0], CYRANO: ["typead", 1.1], LEONARDO: ["swatch", 1.0], VECTOR: ["reflow", 1.0], APOLLON: ["gauge", 0.95], AURORA: ["reticle", 1.0],
    HERMESZ: ["mailseq", 1.0],
    FIGARO: ["network", 1.0],
    ATLASZ: ["orchestrate", 0.9],
    MATISSE: ["artboards", 1.0], NEXUS: ["code", 1.1], SENTRY: ["inspect", 1.0],
    GULLIVER: ["ingest", 1.0], LUMIERE: ["filmstrip", 1.1], SEHEREZADE: ["script", 1.0], GUTENBERG: ["render", 1.0], KRONOSZ: ["timeline", 1.0],
    VERITAS: ["audit", 0.9], KOLUMBUSZ: ["keywords", 1.0], PARETO: ["score", 0.95], MERIDIAN: ["diagnostics", 1.0], ARTEMISZ: ["mappin", 1.0]
  };
  function vizOf(code, fb) { return (VIZ[code] && VIZ[code][0]) || fb; }
  function speedOf(code) { return (VIZ[code] && VIZ[code][1]) || 1; }

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmtNum(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }

  /* ---- „Egy hétköznapi reggel" — animált, méretstabil munkanapló ---- */
  var MORNING_FEED = [
    { time: "07:12", agent: "SUN-TZU", hu: "Átnézett 4 versenytársat és 38 futó hirdetést. Megvan, mi működik.", en: "Reviewed 4 competitors and 38 live ads. You can see what is working.", chipHu: "Kész ✓", chipEn: "Done ✓" },
    { time: "07:26", agent: "AURORA", hu: "Leállított 3 hirdetést, amely 94 000 Ft-ot költött vásárlás nélkül.", en: "Paused 3 ads that spent 94,000 Ft without producing a purchase.", chipHu: "Éles ✓", chipEn: "Applied ✓" },
    { time: "07:41", agent: "CYRANO", hu: "9 hirdetésszöveg elkészült három különböző megközelítéssel.", en: "9 ad-copy variants are ready across three different approaches.", chipHu: "Átnézésre vár", chipEn: "Ready to review", wait: true },
    { time: "07:55", agent: "HERMESZ", hu: "A háromrészes kosárelhagyó levélsorozat időzítésre kész.", en: "The three-part abandoned-cart email sequence is ready to schedule.", chipHu: "Jóváhagyásra vár", chipEn: "Awaiting approval", wait: true },
    { time: "08:08", agent: "GULLIVER", hu: "A heti riport megmutatja, melyik csatorna hozta a bevétel 71%-át.", en: "The weekly report shows which channel produced 71% of revenue.", chipHu: "Kész ✓", chipEn: "Done ✓" }
  ];

  function feedAgentName(code) {
    for (var i = 0; i < AGENTS.length; i++) if (AGENTS[i].code === code) return AGENTS[i].name;
    return code === "SUN-TZU" ? "SUN TZU" : code;
  }

  function wireMorningFeed() {
    var host = document.querySelector("[data-gm-feed]");
    if (!host || !MORNING_FEED.length) return;
    var list = host.querySelector("[data-gm-feed-list]");
    var count = host.querySelector("[data-gm-feed-count]");
    var bar = host.querySelector("[data-gm-feed-progress]");
    if (!list) return;

    list.innerHTML = MORNING_FEED.map(function (row, i) {
      return '<li class="gm-feed__row' + (i === 0 ? " is-on" : "") + '" data-i="' + i + '">' +
        '<time datetime="' + esc(row.time) + '">' + esc(row.time) + '</time>' +
        '<img src="' + AV + esc(row.agent) + '.webp" width="34" height="34" alt="' + esc(feedAgentName(row.agent)) + '" loading="eager" decoding="async">' +
        '<span><b>' + esc(feedAgentName(row.agent)) + '</b><small>' + esc(EN ? row.en : row.hu) + '</small></span>' +
        '<i class="' + (row.wait ? "is-waiting" : "") + '">' + esc(EN ? row.chipEn : row.chipHu) + '</i></li>';
    }).join("");

    var items = list.querySelectorAll(".gm-feed__row");
    var shown = 1, timer = null;
    var windowSize = Math.max(1, Number(host.getAttribute("data-gm-feed-window")) || 3);

    function sizeWindow() {
      var width = list.getBoundingClientRect().width;
      if (!width) return;
      var max = 0;
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var old = { display: item.style.display, position: item.style.position, visibility: item.style.visibility, width: item.style.width, blockSize: item.style.blockSize };
        item.style.display = "grid";
        item.style.position = "absolute";
        item.style.visibility = "hidden";
        item.style.width = width + "px";
        item.style.blockSize = "auto";
        max = Math.max(max, item.getBoundingClientRect().height);
        item.style.display = old.display;
        item.style.position = old.position;
        item.style.visibility = old.visibility;
        item.style.width = old.width;
        item.style.blockSize = old.blockSize;
      }
      var gap = parseFloat(getComputedStyle(list).rowGap) || 0;
      max = Math.ceil(max);
      list.style.setProperty("--gm-feed-row-h", max + "px");
      list.style.setProperty("--gm-feed-window-h", Math.ceil(max * windowSize + gap * (windowSize - 1)) + "px");
    }

    function render() {
      var from = Math.max(0, shown - windowSize);
      for (var i = 0; i < items.length; i++) {
        var on = i < shown && i >= from;
        items[i].classList.toggle("is-on", on);
        items[i].style.display = on ? "" : "none";
      }
      if (count) count.textContent = shown + " / " + MORNING_FEED.length;
      if (bar) bar.style.width = Math.round((shown / MORNING_FEED.length) * 100) + "%";
      host.setAttribute("data-gm-feed-shown", String(shown));
    }

    function tick() { shown = shown >= MORNING_FEED.length ? 1 : shown + 1; render(); }
    function start() {
      sizeWindow();
      render();
      if (REDUCE) { shown = MORNING_FEED.length; render(); return; }
      if (timer) clearInterval(timer);
      timer = setInterval(function () { if (!document.hidden) tick(); }, 2100);
    }

    host.addEventListener("gm-feed-tick", tick);
    var resizeTimer = null;
    window.addEventListener("resize", function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { sizeWindow(); render(); }, 120);
    });
    sizeWindow();
    render();

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { if (entry.isIntersecting) { start(); io.disconnect(); } });
      }, { threshold: 0.25 });
      io.observe(host);
    } else {
      start();
    }
  }

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
      // A magyar oldalon a státusz-badge is magyarul szól — a látogató magyar,
      // a „NOMINAL"/„STANDBY" neki üres zaj. Az angol oldalon marad az eredeti.
      var statusCls = soon ? "soon" : "live", statusTxt = soon ? tr("HAMAROSAN", "STANDBY") : tr("AKTÍV", "NOMINAL");
      var role = EN ? a.roleEn : a.role, task = EN ? a.currentTaskEn : a.currentTask;
      var label = a.name || a.code;   // megjelenítendő (ékezetes) név; a.code marad az ASCII fájl-/adatkulcs
      html += '<button type="button" class="gm-agent' + (soon ? " is-soon" : "") + '" data-code="' + esc(a.code) + '" data-cat="' + esc(a.cat) + '" style="--c:' + esc(a.color) + '">';
      html += '<span class="gm-agent__top">';
      html += '<span class="gm-agent__av"><img src="' + AV + esc(a.code) + '.webp" alt="' + esc(label + " – " + role) + '" loading="lazy" width="60" height="60"></span>';
      html += '<span class="gm-agent__meta"><span class="gm-agent__code">' + esc(label) + ' <span class="gm-status gm-status--' + statusCls + '">' + statusTxt + '</span></span>';
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

  /* ---- A munkaköri blokk szakember-kártyái ----
     Ugyanazt az adatlapot nyitják, mint a teljes csapatrács. A data-code-ot az
     avatar kanonikus ASCII fájlnevéből képezzük, így a látható ékezetes név és
     az AGENTS adatkulcsa nem tud szétcsúszni. */
  function wireRoleReliefPeople() {
    document.querySelectorAll("#munkakorok .gm-relief-person").forEach(function (card) {
      var img = card.querySelector("img");
      var code = img ? (img.getAttribute("src") || "").split("/").pop().replace(/\.webp$/i, "") : "";
      if (!code || !AGENTS.some(function (agent) { return agent.code === code; })) return;
      var label = card.querySelector("b");
      card.setAttribute("data-code", code);
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-haspopup", "dialog");
      card.setAttribute("aria-label", (label ? label.textContent : code) + " szakember részleteinek megnyitása");
      card.addEventListener("click", function () { openModal(code); });
      card.addEventListener("keydown", function (event) {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openModal(code);
      });
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
  var specialistOpens = 0;
  function openModal(code) {
    lastFocus = document.activeElement;
    var a = AGENTS.filter(function (x) { return x.code === code; })[0]; if (!a || !modal) return;
    // MIÉRT MÉRJÜK: a csapatrács a landoló legtöbbet nyitogatott felülete, és a
    // termékfejlesztésnek is ez a legjobb inputja — melyik szakember érdekli
    // ténylegesen a vevőt a vásárlás ELŐTT. Ma erről nulla adatunk van.
    // Metára CSAK az ELSŐ nyitás megy látogatónként: a kártyákat sorban szokás
    // végignézni, tehát a 6. megnyitás már nem új szándék, csak böngészés.
    specialistOpens += 1;
    signal("gm_specialist_open", {
      specialist_code: a.code, specialist_name: a.name || a.code, specialist_open_order: specialistOpens
    }, {
      meta: specialistOpens === 1 ? "SpecialistOpen" : null,
      clarityKey: "specialist_open", clarityValue: a.code
    });
    var panel = modal.querySelector(".gm-modal__panel");
    panel.style.setProperty("--c", a.color);
    modal.querySelector(".gm-modal__av img").src = AV + a.code + ".webp";
    var role = EN ? a.roleEn : a.role;
    modal.querySelector(".gm-modal__title h3").textContent = a.name || a.code;
    modal.querySelector(".gm-modal__title p").textContent = role;
    var soon = a.status === "soon";
    var spec = (EN ? a.specEn : a.spec) || {};
    var rows = "";
    rows += '<dt>' + tr("Státusz", "Status") + '</dt><dd class="is-accent">' + (soon ? tr("HAMAROSAN", "STANDBY · soon") : tr("AKTÍV", "NOMINAL · active")) + '</dd>';
    rows += '<dt>' + tr("Aktuális feladat", "Current task") + '</dt><dd>' + esc(EN ? a.currentTaskEn : a.currentTask) + '</dd>';
    rows += '<dt>' + tr("Folyamat", "Pipeline") + '</dt><dd>' + esc(spec.pipeline || "–") + '</dd>';
    rows += '<dt>' + tr("Ütem", "Cadence") + '</dt><dd>' + esc(spec.cadence || "–") + '</dd>';
    rows += '<dt>' + tr("Ütemező", "Scheduler") + '</dt><dd>' + esc(spec.scheduler || "–") + '</dd>';
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
  // Reveal-effekt ELTÁVOLÍTVA (lassúnak érződött): a blokkok azonnal láthatóak.
  // Az .is-in-t mégis hozzáadjuk, mert a .gm-dash__bars (riport-oszlopok) CSS-e arra épül.
  // 2026-08-05: ez KIVÁLT a gsap-ágból — nem függhet egy lustán töltődő vendor-fájltól,
  // különben a riport-oszlopok addig összecsuklott állapotban állnának.
  function applyRevealState() {
    document.querySelectorAll(".gm-reveal").forEach(function (el) { el.classList.add("is-in"); });
  }

  function wireScrollAnims() {
    if (!gsap || !ST || REDUCE) return;
    gsap.registerPlugin(ST, Flip);
    document.documentElement.classList.add("gm-anim-ready");

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
  /* ---- Viselkedés-jelzés: GA4 + Meta + Clarity + dataLayer ----
   * KÖZÖS jelzőfüggvény a nem-konverziós eseményekhez. Négy csatorna, mindegyik
   * más munkára — és szándékosan NEM mind a négyre megy minden jel:
   *
   * · **dataLayer** — mindig. Ez a nyers csatorna: a GTM-ből bárhova
   *   továbbköthető később anélkül, hogy a landolóhoz hozzá kellene nyúlni.
   * · **GA4** (`gtag('event', …)` `send_to`-val) — mindig. Egyedi esemény, NEM
   *   kulcsesemény: az elemzés helye, de a konverziós riportot nem hígítja.
   *   Az Ads-optimalizálásba sem szól bele, mert `conversion`-t nem küldünk.
   * · **Meta Pixel** (`trackCustom`) — CSAK a hirdetési szempontból értékes,
   *   ALACSONY darabszámú jelekre (`meta` mező). Ez a szűrés nem óvatosság,
   *   hanem üzemtan: a szekció-nézettség látogatónként ~12-szer sülne el, és
   *   egy ilyen mennyiségű egyedi esemény a Meta-oldalon zaj, nem célközönség.
   *   Amit átadunk, abból viszont VALÓDI remarketing-közönség épül: „megnyitotta
   *   az árazási kifogást, de nem vásárolt".
   * · **Clarity-címke** — a FELVÉTELT teszi szűrhetővé: „mutasd azokat, akik a
   *   »költhet a pénzemből« kérdést nyitották meg". Ebből kiderül, mi állította
   *   meg őket; a puszta darabszámból nem.
   *
   * Nem lassíthat: nincs új script-betöltés, nincs `scroll`-figyelő, minden
   * listener passzív vagy IntersectionObserver, és egyik hívásra sem VÁRUNK —
   * ha egy címke nincs betöltve, a jel némán kimarad (`typeof` őr + try/catch).
   */
  function signal(event, data, opt) {
    opt = opt || {};
    var payload = {};
    for (var k in data) if (Object.prototype.hasOwnProperty.call(data, k)) payload[k] = data[k];

    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(Object.assign({ event: event }, payload));
    } catch (e) {}

    try {
      if (typeof window.gtag === "function") {
        window.gtag("event", event, Object.assign({ send_to: GA4_ID }, payload));
      }
    } catch (e) {}

    if (opt.meta) {
      try { if (typeof window.fbq === "function") window.fbq("trackCustom", opt.meta, payload); } catch (e) {}
    }
    if (opt.clarityKey) {
      try { if (typeof window.clarity === "function") window.clarity("set", opt.clarityKey, String(opt.clarityValue)); } catch (e) {}
    }
  }


  /* ── Menedzselt szint: érdeklődés-űrlap ────────────────────────────────────
   *
   * Az űrlap JS NÉLKÜL is működik: sima POST a végpontra, ami 302-vel viszi
   * tovább a látogatót. A JS csak annyit tesz hozzá, hogy a lap nem ugrik el —
   * a visszajelzés az űrlap HELYÉN jelenik meg —, és hogy mérünk.
   *
   * FAIL-OPEN a vevő felé: ha a fetch elhasal (hálózat, CORS, bármi), NEM
   * nyelünk el semmit — engedjük a natív beküldést, hogy a vevő útja akkor is
   * végigmenjen, ha a mi rétegünk hibázik.
   */
  function wireManagedForm() {
    var form = document.getElementById("gm-managed-form");
    if (!form) return;
    var err = document.getElementById("gm-managed-err");
    var started = false;

    form.addEventListener("input", function () {
      if (started) return;
      started = true;
      signal("gm_managed_start", { form: "managed-interest" });
    });

    // A szekció LÁTHATÓSÁGA, nem a DOM-beli léte: a lap alján ülő blokkot a
    // látogatók nagy része sosem éri el, és ezt tudni kell a konverzió mellé.
    var section = document.getElementById("managed");
    if (section && "IntersectionObserver" in window) {
      var seen = false;
      var io2 = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting || seen) return;
          seen = true;
          io2.disconnect();
          signal("gm_managed_view", { section: "managed" }, { meta: "ManagedTierViewed" });
        });
      }, { threshold: 0.35 });
      io2.observe(section);
    }

    form.addEventListener("submit", function (ev) {
      if (!form.reportValidity()) { ev.preventDefault(); return; }
      ev.preventDefault();
      var btn = form.querySelector("button[type=submit]");
      if (btn) { btn.disabled = true; }
      if (err) { err.hidden = true; }

      fetch(form.getAttribute("action"), {
        method: "POST",
        body: new FormData(form),
        headers: { "Accept": "application/json", "X-Requested-With": "fetch" },
        credentials: "same-origin"
      }).then(function (r) {
        return r.json().catch(function () { return { ok: r.ok }; });
      }).then(function (data) {
        if (!data || !data.ok) throw new Error((data && data.error) || "failed");
        signal("gm_managed_submit", { form: "managed-interest" }, { meta: "Lead" });
        var done = document.createElement("div");
        done.className = "gm-form__done";
        done.setAttribute("role", "status");
        var h = document.createElement("h3");
        h.textContent = form.dataset.doneTitle || "Köszönjük – megkaptuk.";
        var pEl = document.createElement("p");
        pEl.textContent = form.dataset.doneText || "";
        done.appendChild(h);
        done.appendChild(pEl);
        if (data.booking_url) {
          var a = document.createElement("a");
          a.className = "gm-btn gm-btn--gold";
          a.href = data.booking_url;
          a.target = "_blank";
          a.rel = "noopener";
          a.setAttribute("data-gm-cta", "managed-booking");
          a.textContent = form.dataset.doneCta || "Időpontot foglalok";
          done.appendChild(a);
        }
        form.parentNode.replaceChild(done, form);
      }).catch(function () {
        // A mi hibánk nem a vevő hibája: visszaadjuk a gombot, és kimondjuk,
        // mi történt — nem hagyjuk néma, letiltott gombbal állni.
        if (btn) { btn.disabled = false; }
        if (err) {
          err.textContent = form.dataset.errText || "Nem sikerült elküldeni. Kérlek, próbáld újra.";
          err.hidden = false;
        }
      });
    });
  }

  function wireFaq() {
    var items = document.querySelectorAll(".gm-faq__item");
    var opened = 0;
    items.forEach(function (item) {
      item.addEventListener("toggle", function () {
        if (!item.open) return;
        items.forEach(function (o) { if (o !== item) o.open = false; });
        // MIÉRT MÉRJÜK: a GYIK a fizetés előtti utolsó kifogás-felület, és eddig
        // NÉMA volt — nem tudtuk, melyik kérdés állítja meg a vevőt, tehát a
        // következő copy-kör találgatásból dolgozott volna. A `faq_id` STABIL
        // azonosító (content/faq.*.json), nem a kérdés szövege: egy fogalmazási
        // javítás nem esik szét a riportban két külön sorra.
        opened += 1;
        var q = item.querySelector("summary");
        var id = item.getAttribute("data-faq-id") || "?";
        // Metára IS megy: egy megnyitott GYIK-tétel kimondott kifogás, tehát a
        // legpontosabb remarketing-jelünk a vásárlás előtti pillanatból — az
        // „árazást nézte" közönségre más hirdetés való, mint a „biztonságot".
        signal("gm_faq_open", {
          faq_id: id,
          faq_category: item.getAttribute("data-faq-cat") || null,
          faq_question: q ? (q.textContent || "").trim() : null,
          faq_open_order: opened
        }, { meta: "FAQOpen", clarityKey: "faq_open", clarityValue: id });
      });
    });
  }

  /* ---- Szekció-láthatóság: meddig jutott el a látogató ----
   * Ez váltja ki a klasszikus 25/50/75/100%-os görgetés-mérést, és többet mond
   * nála: a százalék az oldal HOSSZÁTÓL függ (egy szekció betoldásától
   * elcsúszik minden korábbi adat), a szekció-azonosító viszont ugyanaz marad.
   * Így megválaszolható a landoló legfontosabb kérdése: hányan érnek el
   * egyáltalán az árazásig — és melyik szekció előtt fordulnak vissza.
   *
   * Egy megfigyelő, szekciónként EGY jel, találat után azonnal `unobserve`:
   * a fő szálon mérhetetlen a költsége.
   *
   * ☠️ MIÉRT SÁV (`rootMargin`) ÉS NEM KÜSZÖB (`threshold`) — mérve, nem elméletben.
   * Az első változat `threshold: 0.35`-tel indult, ami egy rövid szekción helyes.
   * Csakhogy az `IntersectionRatio` a CÉLELEM területéhez viszonyít, a landoló
   * szekciói pedig sokszorosan magasabbak a képernyőnél: `use-casek` 11 351 px,
   * `gyik` 6 606 px, `arazas` 4 958 px. Egy 800 px-es ablakban az `arazas` 35%-a
   * 1 735 px — SOHA nem fér bele, tehát a jel sosem sült volna el. Pont a
   * legfontosabb szekciókról maradtunk volna némák, miközben a rövid `hero`-ra
   * működik: a mérés „félig jó" lett volna, ami rosszabb a nyilvánvalóan rossznál.
   * A sávos megoldás magasság-független: a szekció akkor számít megnézettnek, ha
   * belelóg a képernyő középső 50%-ába. */
  function wireSectionViews() {
    var secs = document.querySelectorAll("section[id]");
    if (!secs.length || !("IntersectionObserver" in window)) return;
    var seen = 0;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        seen += 1;
        signal("gm_section_view", { section_id: e.target.id, section_order: seen });
        // Metára CSAK az árazás megy, és látogatónként egyszer: ez az egyetlen
        // szekció, ami önmagában szándékot jelent. „Eljutott az árazásig, de nem
        // vásárolt" — ebből épül a legerősebb remarketing-közönségünk. A többi
        // 11 szekció-nézet a Meta-oldalon csak zaj lenne (ld. a `signal` fejét).
        if (e.target.id === "arazas") {
          try { if (typeof window.fbq === "function") window.fbq("trackCustom", "PricingReached", { section_order: seen }); } catch (err) {}
          try { if (typeof window.clarity === "function") window.clarity("set", "reached_pricing", "1"); } catch (err) {}
        }
      });
    }, { rootMargin: "-25% 0px -25% 0px", threshold: 0 });
    secs.forEach(function (s) { io.observe(s); });
  }

  /* ---- Oldaltérkép-menü (fejléc) ---- */
  // A nyitás/zárás NATÍV (<details>), tehát JS nélkül is teljes értékű. Itt csak a
  // két hiányzó zárási mód kerül rá — kívülre kattintás és Escape —, plusz a
  // kifelé mutató kattintás mérése.
  //
  // Miért mérjük: a menü szándékosan diszkrét, mert egy landolón minden kifelé
  // mutató link a CTA konkurenciája. Ha ez a döntés rossz, azt látni akarjuk —
  // e nélkül a „nem tereli el a figyelmet" hiedelem marad, nem állítás. A jel
  // TARTALOMMENTES dataLayer-push (nincs gtag/fbq hívás): a menü nem tölcsér-esemény,
  // és nem szabad, hogy beleszóljon a konverziós riportba.
  function wireHeaderMenu() {
    var menu = document.getElementById("gm-menu");
    if (!menu) return;
    document.addEventListener("click", function (ev) {
      if (menu.open && !menu.contains(ev.target)) menu.open = false;
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key !== "Escape" || !menu.open) return;
      menu.open = false;
      var btn = menu.querySelector("summary");
      if (btn) btn.focus();
    });
    menu.querySelectorAll(".gm-menu__link").forEach(function (a) {
      a.addEventListener("click", function () {
        try {
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({ event: "gm_nav_click", nav_target: a.getAttribute("href"), nav_label: (a.textContent || "").trim() });
        } catch (e) {}
        // A `target="_blank"` óta ez az oldal NEM navigál el, tehát a panel nyitva
        // maradna a látogató mögött — és nyitva is fogadná, amikor visszavált erre
        // a fülre. Bezárjuk, de a fókuszt NEM mozgatjuk: az új lap veszi át.
        menu.open = false;
      });
    });
  }

  /* ---- Demó-videók (.gm-video): --loop in-view, --click poszteres ---- */
  // A `preload="none"` a POSZTERT nem tartja vissza: azt a böngésző azonnal lehúzza,
  // amint a <video> layoutba kerül. Mérve 2026-08-05-én: 5 hajtás alatti poszter
  // 191 KB-ot töltött a kritikus ablakban, még az app.js lefutása előtt. Ezért a
  // `poster` a HTML-ben `data-poster`, és csak a viewport közelében kerül a helyére.
  function wireLazyPosters() {
    var vids = document.querySelectorAll("video[data-poster]");
    if (!vids.length) return;
    function apply(v) {
      var p = v.getAttribute("data-poster");
      if (!p) return;
      v.setAttribute("poster", p);
      v.removeAttribute("data-poster");
    }
    function applyAllIn(root) {
      var list = root.querySelectorAll ? root.querySelectorAll("video[data-poster]") : [];
      for (var i = 0; i < list.length; i++) apply(list[i]);
      if (root.tagName === "VIDEO") apply(root);
    }
    // Nincs IntersectionObserver (régi böngésző) → mindet betesszük. Ott a lassú,
    // de HELYES viselkedés a cél; a poszter nélküli fekete doboz hiba lenne.
    if (!("IntersectionObserver" in window)) {
      for (var i = 0; i < vids.length; i++) apply(vids[i]);
      return;
    }
    // ⚠️ NEM magát a <video>-t figyeljük, hanem a legközelebbi, a normál layoutban látható
    // ŐSÉT (karusszel vagy médiakeret). A videók egy része karusszel-lapon ül; az inaktív lap
    // `visibility:hidden; opacity:0`. Ha laponként figyelnénk, a látogató a lapozás
    // PILLANATÁBAN kezdené tölteni a posztert → üres/fekete doboz villanna fel. Így viszont
    // amikor a karusszel beér a képbe, az alatta lévő ÖSSZES poszter a helyére kerül —
    // lapozáskor nincs villanás, a kritikus betöltési ablakot pedig ugyanúgy elkerüljük.
    var anchors = [], map = [];
    for (var j = 0; j < vids.length; j++) {
      var a = vids[j].closest(".gm-carousel") || vids[j].closest(".gm-uc__media") || vids[j].parentElement || vids[j];
      var k = anchors.indexOf(a);
      if (k === -1) { anchors.push(a); map.push([vids[j]]); } else { map[k].push(vids[j]); }
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        applyAllIn(en.target);
        io.unobserve(en.target);
      });
    }, { rootMargin: "300px 0px" });
    for (var m = 0; m < anchors.length; m++) io.observe(anchors[m]);
  }

  // Régi eszköz / mért adatkapcsolat: a hurok-videók 0,7–3,0 MB-osak. A `saveData`
  // és a 2g/3g `effectiveType` mellett NEM indítjuk őket maguktól — a lejátszógomb
  // marad, tehát semmi nem vész el, csak a látogató dönt róla.
  function autoplayAllowed() {
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!c) return true;
    if (c.saveData) return false;
    var t = c.effectiveType || "";
    return !(t === "slow-2g" || t === "2g" || t === "3g");
  }

  function wireVideos() {
    var figs = document.querySelectorAll(".gm-video"); if (!figs.length) return;
    var mayAutoplay = autoplayAllowed();
    figs.forEach(function (fig) {
      var video = fig.querySelector("video"); if (!video) return;
      var btn = fig.querySelector(".gm-video__play");
      if (REDUCE) { video.controls = true; if (btn) btn.remove(); var mb0 = fig.querySelector(".gm-video__mute"); if (mb0) mb0.remove(); return; }
      if (mayAutoplay && fig.classList.contains("gm-video--loop") && "IntersectionObserver" in window) {
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
          muteBtn.setAttribute("aria-label", video.muted
            ? tr("Hang bekapcsolása", "Turn sound on")
            : tr("Hang kikapcsolása", "Mute sound"));
          if (!video.muted && video.paused) video.play().catch(function () {});
        });
      }
    });
  }

  /* ---- Carousel (.gm-carousel): egy elem egyszerre, nyilak + csík-pillek ---- */
  function wireCarousels() {
    var roots = document.querySelectorAll("[data-gm-carousel]");
    if (!roots.length) return;
    Array.prototype.forEach.call(roots, function (root) {
      var track = root.querySelector("[data-gm-track]");
      if (!track) return;
      var slides = Array.prototype.slice.call(track.querySelectorAll("[data-gm-slide]"));
      if (slides.length < 1) return;
      var prev = root.querySelector("[data-gm-prev]");
      var next = root.querySelector("[data-gm-next]");
      var pillsWrap = root.querySelector("[data-gm-pills]");
      var pills = [];
      var active = -1;
      var WRAP = true;

      if (slides.length < 2) {
        if (prev) prev.style.display = "none";
        if (next) next.style.display = "none";
        if (pillsWrap) pillsWrap.style.display = "none";
      }

      if (pillsWrap && slides.length > 1) {
        pillsWrap.innerHTML = "";
        slides.forEach(function (s, i) {
          var pill = document.createElement("button");
          pill.type = "button";
          pill.className = "gm-carousel__pill";
          pill.setAttribute("aria-label", tr((i + 1) + ". dia megjelenítése", "Show slide " + (i + 1)));
          if (s.id) pill.setAttribute("aria-controls", s.id);
          pill.addEventListener("click", function () { goTo(i); });
          pillsWrap.appendChild(pill);
          pills.push(pill);
        });
      }

      function pauseVideoIn(slide) {
        if (!slide) return;
        var v = slide.querySelector("video");
        if (v && !v.paused) { try { v.pause(); } catch (e) {} }
      }
      function playVideoIn(slide) {
        if (!slide) return;
        var v = slide.querySelector("video");
        if (v && v.muted) { try { var p = v.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {} }
      }

      function setActive(i) {
        if (i === active) return;
        active = i;
        slides.forEach(function (s, k) {
          var on = k === i;
          s.classList.toggle("is-active", on);
          s.setAttribute("aria-hidden", on ? "false" : "true");
          if (!on) pauseVideoIn(s); // minden nem-aktív dia videója álljon meg (több videós carouselnél is)
        });
        pills.forEach(function (p, k) {
          var on = k === i;
          p.classList.toggle("is-active", on);
          p.setAttribute("aria-current", on ? "true" : "false");
        });
        playVideoIn(slides[i]);
        if (!WRAP) {
          if (prev) prev.disabled = (i === 0);
          if (next) next.disabled = (i === slides.length - 1);
        }
      }

      function goTo(i) {
        if (WRAP) i = ((i % slides.length) + slides.length) % slides.length;
        else i = Math.max(0, Math.min(i, slides.length - 1));
        setActive(i);
      }

      if (prev) prev.addEventListener("click", function () { goTo(active - 1); });
      if (next) next.addEventListener("click", function () { goTo(active + 1); });

      root.addEventListener("keydown", function (e) {
        if (slides.length < 2) return;
        if (e.key === "ArrowLeft") { e.preventDefault(); goTo(active - 1); }
        else if (e.key === "ArrowRight") { e.preventDefault(); goTo(active + 1); }
      });

      var sx = null, sy = null;
      root.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
      root.addEventListener("touchend", function (e) {
        if (sx === null) return;
        var dx = e.changedTouches[0].clientX - sx;
        var dy = e.changedTouches[0].clientY - sy;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) goTo(active + (dx < 0 ? 1 : -1));
        sx = null; sy = null;
      }, { passive: true });

      var startIdx = 0;
      for (var k = 0; k < slides.length; k++) {
        if (slides[k].classList.contains("is-active")) { startIdx = k; break; }
      }
      setActive(startIdx);
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
  // A dinamikus `import()` SZINTAKTIKAI hiba minden 2018 előtti motorban (Chrome <63,
  // Safari <11.1, régi Android-stock/UC böngésző). Szó szerint a fájlban hagyva az EGÉSZ
  // app.js parse-olhatatlan lett volna ott — vagyis nem a 3D-hero esett volna ki, hanem
  // a teljes oldal-logika: ágens-kártyák, CTA-mérés, GYIK, szűrő, minden. A `new Function`
  // a parse-t FUTÁSIDŐRE tolja, ahol a hiba elkapható; ami nem tudja, az egyszerűen nem
  // kapja meg a 3D-hátteret. (Az csak ≥1024 px + `pointer:fine` mellett futna amúgy is.)
  var dynImport = null;
  try { dynImport = new Function("u", "return import(u);"); } catch (e) { dynImport = null; }

  function maybeHero() {
    if (!dynImport) return;
    var wide = window.matchMedia("(min-width: 1024px)").matches;
    var fine = window.matchMedia("(pointer: fine)").matches;
    if (!wide || !fine || REDUCE) return;
    var canvas = document.getElementById("gm-hero-canvas"); if (!canvas) return;
    try { var probe = document.createElement("canvas"); var gl = probe.getContext("webgl") || probe.getContext("experimental-webgl"); if (!gl) return; } catch (e) { return; }
    document.documentElement.classList.add("gm-webgl");
    document.querySelector(".gm-lp").classList.add("gm-webgl");
    try {
      // ABSZOLÚT útvonal kell: a `new Function` törzse globális kontextusban fut, ott a
      // relatív `./hero3d.js` a DOKUMENTUMHOZ képest oldódna fel (→ `/hero3d.js`, 404).
      dynImport("/js/hero3d.js").then(function (mod) {
        window.__gmHero = mod.initHero({ canvas: canvas, agents: AGENTS, avBase: AV, en: EN });
      })["catch"](function (e) { console.warn("hero3d nem indult:", e); });
    } catch (e) { console.warn("hero3d nem indult:", e); }
  }

  /* ---- Boot ----
     2026-08-05: a boot-réteg MÉRT-EN 1070–1790 ms-ig (medián 1430) tartotta magát a
     tartalom előtt, + 600 ms fade — és mivel `position:fixed; inset:0` átlátszatlan
     réteg volt `pointer-events` korlátozás nélkül, addig a CTA-ra KATTINTANI SEM lehetett.
     Ez tiszta, mesterséges késleltetés volt: a haladás-sáv nem mért semmit, csak
     `Math.random()`-mal telt. Mostantól a sáv CSS-animációval fut VALÓDI betöltés alatt
     (parse → DOMContentLoaded), és amint a JS elindul, a réteg azonnal megy le. A
     `pointer-events: none` a hud.css-ben már a kiindulási állapotban rajta van. */
  function boot() {
    var b = document.getElementById("gm-boot");
    if (!b) return;
    var log = b.querySelector(".gm-boot__log"), fill = b.querySelector(".gm-boot__fill");
    if (log) log.textContent = EN ? "mission control ready." : "parancsnoki pult kész.";
    if (fill) fill.style.width = "100%";
    b.classList.add("is-done");
    setTimeout(function () { b.style.display = "none"; }, 400);
  }

  /* ---- GSAP: lusta betöltés (2026-08-05) ----
     A három vendor-fájl 53 KB brotli / ~180 KB parse-olandó JS volt a KRITIKUS úton,
     miközben pontosan két dolgot szolgál ki: a hero-parallaxot és a csapat-szűrő
     átrendezését. Régi, lassú CPU-n a parse-idő a legdrágább tétel, ezért a betöltés
     az első paint utánra csúszik. Ha valamelyik fájl nem érkezik meg, az oldal
     hiánytalanul működik — csak animáció nélkül, ugyanazon az ágon, mint reduced-motion mellett. */
  function loadScript(src, cb) {
    var s = document.createElement("script");
    s.src = src;
    s.async = false; // dinamikus scripteknél ez tartja a beszúrási sorrendet: a pluginok a core UTÁN futnak
    s.onload = function () { cb(); };
    s.onerror = function () { cb(); };
    document.head.appendChild(s);
  }
  function loadGsap(done) {
    if (REDUCE || !window.Promise) { done(); return; }
    var files = ["gsap.min.js", "ScrollTrigger.min.js", "Flip.min.js"], left = files.length;
    function step() {
      if (--left > 0) return;
      gsap = window.gsap; ST = window.ScrollTrigger; Flip = window.Flip;
      done();
    }
    for (var i = 0; i < files.length; i++) loadScript("/js/vendor/" + files[i], step);
  }
  function whenIdle(fn) {
    if (window.requestIdleCallback) window.requestIdleCallback(fn, { timeout: 2000 });
    else setTimeout(fn, 200);
  }

  // A landolón eddig CSAK `PageView` tüzelt. A `ViewContent` az a jel, amiből a Meta
  // termék-érdeklődést tud építeni (remarketing-közönség, DPA), és nélküle a tölcsér
  // első valódi foka hiányzott. A pénztár-aldomain ezt NEM pótolja: oda csak az jut el,
  // aki már kattintott, tehát pont az érdeklődő-réteg veszett el.
  // 2026-08-07 óta MINDKÉT nyelven fut. A korábbi „a magyar landoló mérése stabil,
  // nem nyúlunk hozzá" indoklás óvatosságnak látszott, valójában rést hagyott: a magyar
  // oldal ~3900 látogatójából a Meta 20 nap alatt 8 `view_content`-et látott, és az a 8
  // is a PÉNZTÁRRÓL jött. Vagyis a tölcsér első foka a fizetős forgalmunk fő oldalán
  // egyáltalán nem létezett — nem volt miből érdeklődő-remarketing közönséget építeni,
  // és a kosárelhagyó-közönségnek sem volt előzménye.
  function trackViewContent() {
    try {
      var metaCookies = ensureMetaCookies();
      var adAttrib = ensureAdAttribution();
      // A Metának a Woo-ID kell (ld. `META_CONTENT_ID`), és lehetőleg az ÉLŐ árazás-CTA
      // hrefjéből, hogy a ciklusváltó utáni állapotot vigye — különben a `ViewContent`
      // havi variációt hirdetne egy éves nézetben.
      var ids = Object.keys(PKG).map(function (k) {
        return metaContentId(k, document.querySelector('[data-gm-cta="pricing-' + k + '"]'));
      });
      var value = PRICE[PKG_DEFAULT] || 0;
      var items = Object.keys(PKG).map(function (k) {
        return { item_id: PKG[k].itemId, item_name: "Az AI csapatod - " + PKG[k].label, item_brand: "GENmarketer", item_category: "AI marketing training", price: PRICE[k] || 0, quantity: 1 };
      });
      var eid = eventId("view_content", PKG_DEFAULT);
      // 2026-08-07: a landoló EGYETLEN Meta tölcsér-eseménye a `ViewContent` lett
      // (a kosár- és pénztár-eseményt a pénztár PYS-e küldi, browser+CAPI párban),
      // ezért ez a jel kapja a maximumot, amit egy szerver nélküli oldal adhat:
      // `contents` tömb per csomag (a Dynamic Ads ezt kéri, nem csak a `content_ids`-t),
      // `num_items`, és a teljes első-fél azonosító-hármas (external_id/fbp/fbc).
      var contents = Object.keys(PKG).map(function (k, i) {
        return { id: ids[i], quantity: 1, item_price: PRICE[k] || 0 };
      });
      if (typeof window.fbq === "function") {
        window.fbq("track", "ViewContent", {
          content_name: document.title,
          content_category: "AI marketing training",
          content_ids: ids,
          content_type: "product",
          contents: contents,
          num_items: contents.length,
          value: value,
          currency: CURRENCY,
          action_source: "website",
          event_source_url: location.href,
          language: (document.documentElement.lang || "en").slice(0, 2).toLowerCase(),
          external_id: metaCookies.externalId || undefined,
          fbp: metaCookies.fbp || undefined,
          fbc: metaCookies.fbc || undefined
        }, { eventID: eid });
      }
      if (typeof window.gtag === "function") {
        window.gtag("event", "view_item", Object.assign({ send_to: GA4_ID, event_id: eid, currency: CURRENCY, value: value, items: items }, adAttrib));
      }
    } catch (e) {}
  }

  /* ---- Munkaállomás ([data-gm-ws]): use-case fülek + lépés → „A munka állása" panel ---- */
  function wireWorkstation() {
    var host = document.querySelector("[data-gm-ws]");
    if (!host) return;
    var tabs = host.querySelectorAll("[data-ws-tab]");
    var panels = host.querySelectorAll("[data-ws-panel]");
    // fülsor: egérrel is húzható vízszintes görgetés (érintésen a natív pan él tovább)
    var tabbar = host.querySelector(".gm-ws__tabs");
    if (tabbar) {
      var dragOn = false, dragMoved = 0, dragX = 0, dragL = 0;
      tabbar.addEventListener("pointerdown", function (e) {
        if (e.pointerType !== "mouse") return;
        dragOn = true; dragMoved = 0; dragX = e.clientX; dragL = tabbar.scrollLeft;
      });
      window.addEventListener("pointermove", function (e) {
        if (!dragOn) return;
        var dx = e.clientX - dragX;
        dragMoved = Math.max(dragMoved, Math.abs(dx));
        tabbar.scrollLeft = dragL - dx;
      });
      window.addEventListener("pointerup", function () { dragOn = false; });
      tabbar.addEventListener("click", function (e) {
        if (dragMoved > 6) { e.stopPropagation(); e.preventDefault(); }
      }, true);
    }
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var key = tab.getAttribute("data-ws-tab");
        tab.scrollIntoView({ block: "nearest", inline: "nearest" });
        tabs.forEach(function (t) { t.setAttribute("aria-selected", t === tab ? "true" : "false"); });
        panels.forEach(function (p) {
          var on = p.getAttribute("data-ws-panel") === key;
          p.classList.toggle("is-active", on);
          if (on) p.removeAttribute("hidden"); else p.setAttribute("hidden", "");
        });
        try { window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event: "gm_ws_tab", ws_tab: key }); } catch (e) {}
      });
    });
    panels.forEach(function (panel) {
      var steps = panel.querySelectorAll("[data-ws-step]");
      var works = panel.querySelectorAll("[data-ws-work]");
      // mobil nézethez: a lépés címét bemásoljuk a panel tetejére (CSS csak ≤640px-en mutatja)
      works.forEach(function (w) {
        if (w.querySelector(".gm-ws__mtitle")) return;
        var btn = panel.querySelector('[data-ws-step="' + w.getAttribute("data-ws-work") + '"]');
        var t = btn && btn.querySelector(".gm-ws__stitle");
        if (t) {
          var d = document.createElement("div");
          d.className = "gm-ws__mtitle";
          d.innerHTML = t.innerHTML;
          w.insertBefore(d, w.firstChild);
        }
      });
      steps.forEach(function (step) {
        step.addEventListener("click", function () {
          var idx = step.getAttribute("data-ws-step");
          steps.forEach(function (s) { s.classList.toggle("is-active", s === step); });
          works.forEach(function (w) {
            var on = w.getAttribute("data-ws-work") === idx;
            w.classList.toggle("is-active", on);
            if (on) {
              // rejtett panelben álló videó poszterét a megnyitáskor hidratáljuk
              var v = w.querySelector("video[data-poster]:not([poster])");
              if (v) v.setAttribute("poster", v.getAttribute("data-poster"));
              // mobilon/tableten gördüljünk a panelhez — de csak ha tényleg kilóg a képernyőről
              if (window.innerWidth < 900) requestAnimationFrame(function () {
                var r = w.getBoundingClientRect();
                if (r.top > window.innerHeight * 0.6 || r.bottom < 120 || r.top < 0) {
                  w.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              });
            }
          });
        });
      });
    });
  }

  function init() {
    // 1) Minden, ami a tartalom HASZNÁLHATÓSÁGÁHOZ kell — azonnal, vendor-függés nélkül.
    boot();
    applyRevealState();
    renderAgents();
    wireRoleReliefPeople();
    wireWorkstation();
    wireFilters();
    wireCtas();
    wireBillingCycle();
    wireManagedForm();
    trackViewContent();
    wireProofbar();
    wireMorningFeed();
    wireSmoothScroll();
    wireScrollState();
    wireFaq();
    wireSectionViews();
    wireHeaderMenu();
    wireLazyPosters();
    wireVideos();
    wireCarousels();
    wireProofSlider();
    wireLightbox();

    // 2) Ami CSAK dísz — az első paint után, üresjáratban. Ha sosem fut le, az oldal ép.
    whenIdle(function () {
      loadGsap(function () {
        wireScrollAnims();
        maybeHero();
      });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
