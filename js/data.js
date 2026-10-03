/* ============================================================
   Az AI csapatod — MISSION CONTROL showcase · agent-adatmodell
   Kétnyelvű (HU + …En). A metrics/currentTask SZIMULÁLT telemetria.
   role/benefit a prod-ból portolva.

   NÉVTÉR (2026-07-31, „AI-team V2"):
   - `code` = ASCII azonosító — fájlnév (avatars/badges), VIZ-kulcs,
     data-agent attribútum. SOSEM ékezetes.
   - `name` = megjelenített név, ékezetekkel (ATHÉNÉ, MIDÁSZ, LUMIÈRE…).
   Mind a 28 specialista 1:1 megfeleltetéssel váltott nevet; VECTOR a
   korábbi OPTIMUS (`genmarketer-ad-resize`).
   ============================================================ */
(function () {
  "use strict";
  var AV = "/assets/img/avatars/", BG = "/assets/img/badges/", PF = "/assets/img/proof/";

  /* ── A landolón HIRDETETT számok (2026-08-03, Károly döntése) ────────────────
     Ez DEKLARÁLT marketing-tény, NEM az alábbi tömbből származtatott szám.
     2026-08-01-ig a `tests/roster-counts.mjs` a próza minden létszám-állítását a
     `status !== "soon"` ágensek darabszámához kötötte, tehát a landoló csak azt
     mondhatta, amennyi éppen élesben volt (27). Károly ezt a kötést kivetette:
     a csapat 28 fős, és a landoló ezt hirdeti akkor is, ha egy tag kártyáján még
     „Hamarosan" badge áll — az egyes tagok állapota a kártyán látszik, nem a
     fejlécszámban. A gépi kapu MEGMARADT, csak a mércéje változott: minden
     látható szám EHHEZ a két értékhez méretik, tehát két egymásnak ellentmondó
     szám továbbra sem élhet egy oldalon (ez volt az eredeti baj: 25 / 27 / 28).
     ⚠️ Egyetlen hely: aki átírja, itt írja át — a HTML-prózát is vele együtt,
     különben a kapu megbukik. */
  window.GM_LANDING_FACTS = { team: 28, areas: 10 };

  window.GM_TEAM = [
    { cat: "Vezetés és stratégia", catEn: "Leadership & strategy", color: "#F5A623", members: [
      { code: "ATLASZ", name: "ATLASZ", role: "a csapatvezető", roleEn: "the team lead", slug: "genmarketer-team", status: "live",
        benefit: "Egyszer megismeri a vállalkozásodat, és onnantól minden feladatra a megfelelő szakértőt hívja be – neked csak vele kell beszélned.",
        benefitEn: "Gets to know your business once, then brings in the right specialist for every task – you only ever talk to one.",
        currentTask: "a megfelelő specialistát hívja be…", currentTaskEn: "Bringing in the right specialist…",
        metrics: [{ label: "specialista", labelEn: "specialist", target: 20 }, { label: "kampányterv", labelEn: "campaign plan", target: 6 }],
        proof: BG + "ATLASZ.webp", spec: { pipeline: "profil → irányítás → forgatókönyv", cadence: "mindig elöl", scheduler: "készen áll" },
        specEn: { pipeline: "profile → routing → playbook", cadence: "always first", scheduler: "ready" } },
      { code: "ATHENE", name: "ATHÉNÉ", role: "a stratégiai partner", roleEn: "the strategic partner", slug: "genmarketer-billion-dollar-board", status: "live",
        benefit: "Végiggondolja veled a következő nagy lépésed – mintha lenne egy saját igazgatótanácsod.",
        benefitEn: "Thinks through your next big move with you – like having your own board of directors.",
        currentTask: "a következő nagy lépésed gondolja végig…", currentTaskEn: "Thinking through your next big move…",
        metrics: [{ label: "forgatókönyv", labelEn: "scenario", target: 3 }, { label: "döntés", labelEn: "decision", target: 7 }],
        proof: BG + "ATHENE.webp", spec: { pipeline: "helyzet → opciók → döntés", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "situation → options → decision", cadence: "on demand", scheduler: "ready" } },
      { code: "SUN-TZU", name: "SUN TZU", role: "a versenytárs-elemző", roleEn: "the competitor analyst", slug: "genmarketer-competitor-intel", status: "live",
        benefit: "Feltérképezi a versenytársaidat, hogy mindig egy lépéssel előttük járj.",
        benefitEn: "Maps out your competitors so you're always one step ahead.",
        currentTask: "3 versenytárs aktív hirdetéseit térképezi…", currentTaskEn: "Mapping 3 competitors' live ads…",
        metrics: [{ label: "versenytárs", labelEn: "competitor", target: 11 }, { label: "aktív hirdetés", labelEn: "live ad", target: 38 }],
        proof: PF + "proof-versenytars.webp", spec: { pipeline: "felderítés → hirdetés-figyelés → rés", cadence: "heti", scheduler: "folyamatos" },
        specEn: { pipeline: "recon → ad-watch → gap", cadence: "weekly", scheduler: "continuous" } },
      { code: "SHERLOCK", name: "SHERLOCK", role: "a piackutató", roleEn: "the market researcher", slug: "genmarketer-icp-researcher", status: "live",
        benefit: "Pontosan megmondja, kik a vevőid és mi fáj nekik – hogy ne a sötétben lövöldözz.",
        benefitEn: "Pinpoints exactly who your buyers are and what hurts them – so you stop shooting in the dark.",
        currentTask: "ICP-profilt épít a célpiacodról…", currentTaskEn: "Building an ICP profile of your market…",
        metrics: [{ label: "vevői avatar", labelEn: "buyer persona", target: 6 }, { label: "fájó pont", labelEn: "pain point", target: 42 }],
        proof: null, spec: { pipeline: "kutatás → avatar → üzenet", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "research → persona → message", cadence: "on demand", scheduler: "ready" } }
    ]},
    { cat: "Hirdetés", catEn: "Advertising", color: "#00D4FF", members: [
      { code: "KEPLER", name: "KEPLER", role: "a hirdetéstervező", roleEn: "the ad planner", slug: "genmarketer-ad-planner", status: "live",
        benefit: "Kitalálja a kampányodat, amelyik megállítja a görgető ujjat a hírfolyamban.",
        benefitEn: "Comes up with the campaign that stops the scrolling thumb in the feed.",
        currentTask: "12 kampányötletet generál…", currentTaskEn: "Generating 12 campaign ideas…",
        metrics: [{ label: "kampányötlet", labelEn: "campaign idea", target: 12 }, { label: "szög", labelEn: "angle", target: 5 }],
        proof: PF + "uc-kreativ.webp", spec: { pipeline: "felismerés → szög → koncepció", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "insight → angle → concept", cadence: "on demand", scheduler: "ready" } },
      { code: "CYRANO", name: "CYRANO", role: "a hirdetés-szövegíró", roleEn: "the ad copywriter", slug: "genmarketer-ad-copywriter", status: "live",
        benefit: "Megírja a hirdetésszövegeidet, amikre tényleg kattintanak – nem görgetnek tovább.",
        benefitEn: "Writes ad copy people actually click – instead of scrolling past.",
        currentTask: "3 hook-variánst ír a hirdetésedhez…", currentTaskEn: "Writing 3 hook variants for your ad…",
        metrics: [{ label: "főcím", labelEn: "headline", target: 47 }, { label: "CTR", labelEn: "CTR", target: 34, suffix: "%↑" }],
        proof: null, spec: { pipeline: "horog → törzs → CTA", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "hook → body → CTA", cadence: "on demand", scheduler: "ready" } },
      { code: "AURORA", name: "AURORA", role: "a Facebook Ads-szakértő", roleEn: "the Facebook Ads expert", slug: "genmarketer-facebook-ad-expert", status: "live",
        benefit: "Úgy kezeli a Meta-kampányaidat, hogy olcsóbb leadeket és több vásárlót hozzanak.",
        benefitEn: "Runs your Meta campaigns to bring cheaper leads and more buyers.",
        currentTask: "Meta-célzást finomhangol…", currentTaskEn: "Fine-tuning Meta targeting…",
        metrics: [{ label: "érdeklődő", labelEn: "lead", target: 212 }, { label: "CPL", labelEn: "CPL", target: 29, suffix: "%↓" }],
        proof: BG + "AURORA.webp", spec: { pipeline: "célzás → kreatív → skálázás", cadence: "napi", scheduler: "folyamatos" },
        specEn: { pipeline: "targeting → creative → scale", cadence: "daily", scheduler: "continuous" } },
      { code: "APOLLON", name: "APOLLÓN", role: "a Google Ads-hirdetéskezelő", roleEn: "the Google Ads manager", slug: "genmarketer-google-ads-expert", status: "live",
        benefit: "Beállítja és pörgeti a Google-hirdetéseidet, hogy ne égjen el feleslegesen a kereted.",
        benefitEn: "Sets up and runs your Google Ads so your budget doesn't burn for nothing.",
        currentTask: "a Google-kereted újraosztja…", currentTaskEn: "Reallocating your Google budget…",
        metrics: [{ label: "keret védve", labelEn: "budget saved", target: 31, suffix: "%" }, { label: "CPA", labelEn: "CPA", target: 22, suffix: "%↓" }],
        proof: PF + "proof-kampany-riport.webp", spec: { pipeline: "struktúra → licit → riport", cadence: "napi", scheduler: "folyamatos" },
        specEn: { pipeline: "structure → bid → report", cadence: "daily", scheduler: "continuous" } }
    ]},
    { cat: "Landoló oldal", catEn: "Landing page", color: "#06B6D4", members: [
      { code: "MIDASZ", name: "MIDÁSZ", role: "a landolóoldal-szakértő", roleEn: "the landing page expert", slug: "genmarketer-landing-page-expert", status: "live",
        benefit: "Megtervezi a landoló oldaladat, amelyik a látogatóidból tényleg vevőt csinál.",
        benefitEn: "Designs a landing page that actually turns your visitors into buyers.",
        currentTask: "a landolód szekcióit hangolja…", currentTaskEn: "Tuning your landing page sections…",
        metrics: [{ label: "szekció", labelEn: "section", target: 9 }, { label: "konverzió", labelEn: "conversion", target: 34, suffix: "%↑" }],
        proof: PF + "proof-landing.webp", spec: { pipeline: "vázlat → szöveg → szekciók", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "outline → copy → sections", cadence: "on demand", scheduler: "ready" } },
      { code: "ROBINSON", name: "ROBINSON", role: "a landolóoldal-építő", roleEn: "the landing page builder", slug: "genmarketer-web-builder", status: "live",
        benefit: "Kódba önti a kész landolódat – anélkül, hogy fejlesztőt kéne fizetned.",
        benefitEn: "Turns your finished landing page into code – without paying a developer.",
        currentTask: "a szekciókat kóddá építi és leteszteli…", currentTaskEn: "Building your sections into code and testing them…",
        metrics: [{ label: "komponens", labelEn: "component", target: 24 }, { label: "QA-teszt", labelEn: "QA check", target: 7 }],
        proof: null, spec: { pipeline: "dizájn → kód → publikálás", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "design → code → publish", cadence: "on demand", scheduler: "ready" } }
    ]},
    { cat: "Design és Figma", catEn: "Design & Figma", color: "#9B6DFF", members: [
      { code: "LEONARDO", name: "LEONARDO", role: "a kreatív designer", roleEn: "the creative designer", slug: "genmarketer-ad-creative-design", status: "live",
        benefit: "Megtervezi a hirdetési kreatívjaidat, amik kitűnnek a végtelen hírfolyamból.",
        benefitEn: "Designs ad creatives that stand out in the endless feed.",
        currentTask: "kreatívokat tervez a hírfolyamba…", currentTaskEn: "Designing creatives for the feed…",
        metrics: [{ label: "kreatív", labelEn: "creative", target: 18 }, { label: "görgetésállító", labelEn: "stop-scroll", target: 27, suffix: "%↑" }],
        proof: PF + "proof-social.webp", spec: { pipeline: "koncepció → vizuál → variáns", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "concept → visual → variant", cadence: "on demand", scheduler: "ready" } },
      { code: "MATISSE", name: "MATISSE", role: "a Figma-tervező", roleEn: "the Figma designer", slug: "genmarketer-figma-builder", status: "live",
        benefit: "Profi dizájnt tervez neked Figmában, grafikus felvétele nélkül.",
        benefitEn: "Designs professional visuals in Figma – without hiring a graphic designer.",
        currentTask: "drótvázat tervez Figmában…", currentTaskEn: "Designing a wireframe in Figma…",
        metrics: [{ label: "rajztábla", labelEn: "artboard", target: 12 }, { label: "brand-egységes", labelEn: "on-brand", target: 100, suffix: "%" }],
        proof: PF + "proof-stilus-guide.webp", spec: { pipeline: "feladatkiírás → dizájn → átadás", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "brief → design → handoff", cadence: "on demand", scheduler: "ready" } },
      { code: "NEXUS", name: "NEXUS", role: "a Figma–kód híd", roleEn: "the Figma-to-code bridge", slug: "figma-developer-mcp", status: "live",
        benefit: "A dizájnodból működő kódot csinál – fejlesztő nélkül.",
        benefitEn: "Turns your design into working code – without a developer.",
        currentTask: "a Figma-dizájnt kóddá alakítja…", currentTaskEn: "Turning Figma design into code…",
        metrics: [{ label: "komponens", labelEn: "component", target: 24 }, { label: "kód kész", labelEn: "code done", target: 100, suffix: "%" }],
        proof: null, spec: { pipeline: "Figma → komponens → kód", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "Figma → component → code", cadence: "on demand", scheduler: "ready" } },
      { code: "SENTRY", name: "SENTRY", role: "a Figma QA-ellenőr", roleEn: "the Figma QA reviewer", slug: "genmarketer-figma-qa", status: "live",
        benefit: "Kiszúrja a dizájnod hibáit, mielőtt a vevőidnek szúrnának szemet.",
        benefitEn: "Catches the flaws in your design before your customers do.",
        currentTask: "átnézi a dizájn hibáit…", currentTaskEn: "Reviewing the design for flaws…",
        metrics: [{ label: "ellenőrzés", labelEn: "check", target: 18 }, { label: "hibátlan", labelEn: "flawless", target: 100, suffix: "%" }],
        proof: null, spec: { pipeline: "audit → jelölés → javítás", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "audit → flag → fix", cadence: "on demand", scheduler: "ready" } },
      { code: "VECTOR", name: "VECTOR", role: "a képátméretező", roleEn: "the image resizer", slug: "genmarketer-ad-resize", status: "live",
        benefit: "Egy kész hirdetésből platformkész 1:1, 4:5, 9:16, 16:9 és 2:3 változatokat készít, levágás és széthúzás nélkül.",
        benefitEn: "Turns one finished ad into platform-ready 1:1, 4:5, 9:16, 16:9 and 2:3 versions without crude cropping or stretching.",
        currentTask: "a kreatívodat több képarányra tördeli…", currentTaskEn: "Reflowing your creative into multiple aspect ratios…",
        metrics: [{ label: "képarány", labelEn: "aspect ratio", target: 5 }, { label: "szöveg-QA", labelEn: "text QA", target: 100, suffix: "%" }],
        proof: BG + "VECTOR.webp", spec: { pipeline: "forráskép → újratördelés → betű-QA", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "source image → reflow → text QA", cadence: "on demand", scheduler: "ready" } }
    ]},
    { cat: "Videó", catEn: "Video", color: "#400099", members: [
      { code: "GULLIVER", name: "GULLIVER", role: "a videós adatgyűjtő", roleEn: "the video data collector", slug: "yt-dlp", status: "live",
        benefit: "Összeszedi neked, mi működik a piacodon, hogy abból építkezz.",
        benefitEn: "Gathers what's working in your market so you can build on it.",
        currentTask: "a piac nyerő videóit gyűjti…", currentTaskEn: "Collecting your market's winning videos…",
        metrics: [{ label: "videó", labelEn: "video", target: 312 }, { label: "felismerés", labelEn: "insight", target: 740 }],
        proof: null, spec: { pipeline: "gyűjtés → átirat → minta", cadence: "igény szerint", scheduler: "folyamatos" },
        specEn: { pipeline: "collect → transcript → pattern", cadence: "on demand", scheduler: "continuous" } },
      { code: "SEHEREZADE", name: "SEHEREZÁDÉ", role: "a videós forgatókönyvíró", roleEn: "the video script writer", slug: "genmarketer-video-script-writer", status: "live",
        benefit: "Megírja a videóid forgatókönyvét, ami az első másodperctől fogva tartja a néződ.",
        benefitEn: "Writes your video scripts that hold viewers from the first second.",
        currentTask: "az első 3 másodpercet írja…", currentTaskEn: "Writing the first 3 seconds…",
        metrics: [{ label: "horog", labelEn: "hook", target: 15 }, { label: "megtartás", labelEn: "retention", target: 38, suffix: "%↑" }],
        proof: BG + "SEHEREZADE.webp", spec: { pipeline: "horog → ív → CTA", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "hook → arc → CTA", cadence: "on demand", scheduler: "ready" } },
      { code: "LUMIERE", name: "LUMIÈRE", role: "az UGC videó-producer", roleEn: "the UGC video producer", slug: "genmarketer-ugc-video", status: "live",
        benefit: "Elkészíti a hiteles UGC-videóidat, amik tényleg vásárlót hoznak.",
        benefitEn: "Creates authentic UGC videos that actually bring buyers.",
        currentTask: "UGC-forgatókönyvet vesz fel…", currentTaskEn: "Recording a UGC script…",
        metrics: [{ label: "UGC videó", labelEn: "UGC video", target: 9 }, { label: "hitelesség", labelEn: "authenticity", target: 92, suffix: "%" }],
        proof: BG + "LUMIERE.webp", spec: { pipeline: "forgatókönyv → felvétel → vágás", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "script → shoot → edit", cadence: "on demand", scheduler: "ready" } },
      { code: "KRONOSZ", name: "KRONOSZ", role: "a videóvágó", roleEn: "the video editor", slug: "genmarketer-videovago", status: "live",
        benefit: "Pörgős, figyelemmegtartó videóvá vágja a nyersanyagodat.",
        benefitEn: "Edits your raw footage into fast-paced, attention-holding video.",
        currentTask: "nyersanyagból kész videót vág…", currentTaskEn: "Editing footage into a finished video…",
        metrics: [{ label: "vágás", labelEn: "cut", target: 9 }, { label: "kész MP4", labelEn: "final MP4", target: 100, suffix: "%" }],
        proof: null, spec: { pipeline: "nyersanyag → vágás → exportálás", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "footage → cut → export", cadence: "on demand", scheduler: "ready" } },
      { code: "GUTENBERG", name: "GUTENBERG", role: "a videó-renderelő", roleEn: "the video renderer", slug: "seedance-multishot-prompter", status: "live",
        benefit: "Legenerálja a maximálisan konvertáló hirdetési videóidat – kamera, stáb és forgatás nélkül.",
        benefitEn: "Generates your high-converting ad videos – no camera, crew or shoot.",
        currentTask: "hirdetési videót renderel…", currentTaskEn: "Rendering an ad video…",
        metrics: [{ label: "renderelés", labelEn: "render", target: 6 }, { label: "stáb nélkül", labelEn: "no crew", target: 100, suffix: "%" }],
        proof: PF + "uc-video.webp", spec: { pipeline: "prompt → jelenet → renderelés", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "prompt → shot → render", cadence: "on demand", scheduler: "ready" } }
    ]},
    { cat: "SEO", catEn: "SEO", color: "#00AACC", members: [
      { code: "KOLUMBUSZ", name: "KOLUMBUSZ", role: "a kulcsszó-kutató", roleEn: "the keyword researcher", slug: "genmarketer-seo-research", status: "live",
        benefit: "Megtalálja neked a kulcsszavakat, amikre a vevőid tényleg rákeresnek.",
        benefitEn: "Finds the keywords your buyers actually search for.",
        currentTask: "kulcsszó-térképet rajzol…", currentTaskEn: "Drawing a keyword map…",
        metrics: [{ label: "kulcsszó", labelEn: "keyword", target: 148 }, { label: "szándék", labelEn: "intent", target: 9 }],
        proof: null, spec: { pipeline: "kutatás → szándék → térkép", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "research → intent → map", cadence: "on demand", scheduler: "ready" } },
      { code: "PARETO", name: "PARETO", role: "a tartalom-optimalizáló", roleEn: "the content optimizer", slug: "genmarketer-seo-content", status: "live",
        benefit: "Úgy írja át a szövegeidet, hogy a Google is és az olvasóid is szeressék.",
        benefitEn: "Rewrites your content so both Google and your readers love it.",
        currentTask: "a szöveget Google-re hangolja…", currentTaskEn: "Tuning your copy for Google…",
        metrics: [{ label: "szöveg", labelEn: "copy", target: 12 }, { label: "SEO-pont", labelEn: "SEO score", target: 94 }],
        proof: null, spec: { pipeline: "vázlat → írás → optimalizálás", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "outline → write → optimize", cadence: "on demand", scheduler: "ready" } },
      { code: "MERIDIAN", name: "MERIDIAN", role: "a technikai SEO-szakértő", roleEn: "the technical SEO expert", slug: "genmarketer-seo-technical", status: "live",
        benefit: "Kijavítja az oldalad technikai hibáit, amik hátráltatják a rangsorolásodat.",
        benefitEn: "Fixes the technical issues on your site that hold back your rankings.",
        currentTask: "a Core Web Vitals-t javítja…", currentTaskEn: "Fixing your Core Web Vitals…",
        metrics: [{ label: "javított hiba", labelEn: "fixed issue", target: 31 }, { label: "CWV", labelEn: "CWV", target: 98 }],
        proof: null, spec: { pipeline: "audit → javítás → mérés", cadence: "igény szerint", scheduler: "folyamatos" },
        specEn: { pipeline: "audit → fix → measure", cadence: "on demand", scheduler: "continuous" } },
      { code: "VERITAS", name: "VERITAS", role: "a SEO-auditor", roleEn: "the SEO auditor", slug: "genmarketer-seo", status: "live",
        benefit: "Megmondja, miért nem talál meg a Google – és pontosan mit javíts az oldaladon.",
        benefitEn: "Tells you why Google can't find you – and exactly what to fix on your site.",
        currentTask: "az oldalad SEO-hibáit auditálja…", currentTaskEn: "Auditing your site's SEO issues…",
        metrics: [{ label: "hiba", labelEn: "issue", target: 23 }, { label: "javítás", labelEn: "fix", target: 18 }],
        proof: null, spec: { pipeline: "bejárás → audit → teendők", cadence: "heti", scheduler: "folyamatos" },
        specEn: { pipeline: "crawl → audit → actions", cadence: "weekly", scheduler: "continuous" } },
      { code: "ARTEMISZ", name: "ARTEMISZ", role: "a helyi SEO-szakértő", roleEn: "the local SEO expert", slug: "genmarketer-seo-local", status: "live",
        benefit: "Felhozza a cégedet a helyi keresésben és a Google Térképen.",
        benefitEn: "Lifts your business in local search and on Google Maps.",
        currentTask: "a Google Térképen emel feljebb…", currentTaskEn: "Lifting you on Google Maps…",
        metrics: [{ label: "helyi találat", labelEn: "local result", target: 27, suffix: "%↑" }, { label: "térkép-hely", labelEn: "map spot", target: 3 }],
        proof: null, spec: { pipeline: "GBP → idézet → értékelés", cadence: "heti", scheduler: "folyamatos" },
        specEn: { pipeline: "GBP → citation → review", cadence: "weekly", scheduler: "continuous" } }
    ]},
    { cat: "Ügyfélkapcsolat és bevétel", catEn: "Customer & revenue", color: "#0A66C2", members: [
      { code: "HERMESZ", name: "HERMÉSZ", role: "az e-mail-szakértő", roleEn: "the email expert", slug: "genmarketer-email-marketing-expert", status: "live",
        benefit: "Megírja az e-mail-sorozataidat, amik eladnak helyetted – akkor is, amikor alszol.",
        benefitEn: "Writes your email sequences that sell for you – even while you sleep.",
        currentTask: "e-mail-sorozatot fűz össze…", currentTaskEn: "Assembling an email sequence…",
        metrics: [{ label: "e-mail", labelEn: "email", target: 8 }, { label: "megnyitás", labelEn: "open rate", target: 41, suffix: "%" }],
        proof: PF + "proof-email-riport.webp", spec: { pipeline: "tárgysor → szekvencia → ütemezés", cadence: "automata", scheduler: "folyamatos" },
        specEn: { pipeline: "subject → sequence → schedule", cadence: "automated", scheduler: "continuous" } },
      { code: "PERPETUUM", name: "PERPETUUM", role: "az előfizetés-szakértő", roleEn: "the membership expert", slug: "genmarketer-membership-expert", status: "live",
        benefit: "Felépíti neked a visszatérő bevételt, hogy ne kelljen minden hónapban nulláról indulnod.",
        benefitEn: "Builds your recurring revenue so you don't start from zero every month.",
        currentTask: "visszatérő bevételi modellt tervez…", currentTaskEn: "Designing your recurring-revenue model…",
        metrics: [{ label: "havi bevétel", labelEn: "monthly rev.", target: 24, suffix: "%↑" }, { label: "lemorzsolódás", labelEn: "churn", target: 8, suffix: "%↓" }],
        proof: null, spec: { pipeline: "ajánlat → tagság → megtartás", cadence: "havi", scheduler: "folyamatos" },
        specEn: { pipeline: "offer → membership → retention", cadence: "monthly", scheduler: "continuous" } },
      { code: "FIGARO", name: "FIGARO", role: "a LinkedIn-specialista", roleEn: "the LinkedIn specialist", slug: "genmarketer-linkedin-expert", status: "live",
        benefit: "Felépíti a LinkedIn-jelenléted és ügyfeleket hoz – a profiltól a posztokon át a kapcsolatfelvételig.",
        benefitEn: "Builds your LinkedIn presence and brings clients – from profile to posts to outreach.",
        currentTask: "a LinkedIn-profilodat írja újra…", currentTaskEn: "Rewriting your LinkedIn profile…",
        metrics: [{ label: "poszt-ötlet", labelEn: "post idea", target: 12 }, { label: "elérés", labelEn: "reach", target: 41, suffix: "%↑" }],
        proof: BG + "FIGARO.webp", spec: { pipeline: "profil → tartalom → megkeresés", cadence: "heti", scheduler: "folyamatos" },
        specEn: { pipeline: "profile → content → outreach", cadence: "weekly", scheduler: "continuous" } }
    ]}
  ];

  window.GM_AGENTS = window.GM_TEAM.reduce(function (acc, g) {
    g.members.forEach(function (m) { acc.push(Object.assign({ cat: g.cat, catEn: g.catEn, color: g.color }, m)); });
    return acc;
  }, []);

  /* 2026-08-31: tíz terület — a Munkaállomás-blokk (#use-casek) fülrendje az irányadó.
     Az első terület az elsődleges (kártyaszín), a többi a szűrőben jeleníti meg a tagot.
     A hozzárendelés 1:1 a munkaállomás-fülek csapatsoraival. */
  var GM_AREA_COLORS = { "Meta Ads": "#00D4FF", "Google Ads": "#FFC400", "Email": "#0A66C2", "SEO": "#00AACC", "Weboldal": "#06B6D4", "Social": "#E1306C", "Design": "#9B6DFF", "Videó": "#400099", "Versenytárs": "#7C3AED", "Stratégia": "#F5A623" };
  var GM_AREA_EN = { "Meta Ads": "Meta Ads", "Google Ads": "Google Ads", "Email": "Email", "SEO": "SEO", "Weboldal": "Website", "Social": "Social", "Design": "Design", "Videó": "Video", "Versenytárs": "Competitors", "Stratégia": "Strategy" };
  var GM_AREAS10 = {
    "ATLASZ": ["Stratégia"], "ATHENE": ["Stratégia"], "PERPETUUM": ["Stratégia"],
    "SHERLOCK": ["Stratégia", "Versenytárs"], "SUN-TZU": ["Versenytárs"],
    "AURORA": ["Meta Ads"], "KEPLER": ["Meta Ads"], "CYRANO": ["Meta Ads", "Google Ads"],
    "APOLLON": ["Google Ads"],
    "HERMESZ": ["Email"],
    "KOLUMBUSZ": ["SEO", "Google Ads"], "PARETO": ["SEO", "Social"], "MERIDIAN": ["SEO", "Versenytárs"], "VERITAS": ["SEO"], "ARTEMISZ": ["SEO"],
    "MIDASZ": ["Weboldal"], "ROBINSON": ["Weboldal"], "NEXUS": ["Weboldal"], "SENTRY": ["Weboldal"],
    "MATISSE": ["Design", "Weboldal"], "LEONARDO": ["Design", "Meta Ads", "Social"], "VECTOR": ["Design"],
    "FIGARO": ["Social"],
    "SEHEREZADE": ["Videó"], "GULLIVER": ["Videó", "Versenytárs"], "LUMIERE": ["Videó"], "KRONOSZ": ["Videó"], "GUTENBERG": ["Videó"]
  };
  /* ---- Szakember-adatlap (2026-10-02): „Miben segít?" + „Milyen tudás van mögötte?" ----
     A számok a skill SAJÁT forrásából jönnek (_dev/skill-hub-build/src/<slug>/SKILL.md,
     README, experts/ és transcripts/ mappák) — nem becslés. Az összegük adja a proofbar
     „150+ szakértő" számát (159). Ahol a skill módszertanra / saját adatodra épül, nem
     videókorpuszra, ott `basis` áll szakértőszám helyett — szándékosan nem találunk ki számot.
     experts + sources → „X szakértő Y anyagából táplálkozik"; basis → saját mondat. */
  var GM_PROFILE = {
    "ATLASZ": { basis: "A teljes, 28 fős csapat tudását fogja össze", help: ["Pár kérdésből megismeri a cégedet, és elmenti az üzleti profilodat", "Minden kérést a megfelelő szakemberhez irányít", "Az első napon kész anyagot és 14 napos tervet ad"], topics: ["üzleti profil", "feladat-elosztás", "14 napos indulási terv", "a csapat összehangolása"] },
    "ATHENE": { experts: 9, sources: "tudásából (Hormozi, Brunson, Godin és társaik)", help: ["Átnézi az ajánlatodat és az árazásodat", "Stratégiai kérdésben több nézőpontból ad tanácsot", "Rangsorolja, mibe érdemes először energiát tenni"], topics: ["ajánlatépítés", "árazás és pozicionálás", "értékesítési tölcsér", "növekedési stratégia"] },
    "SHERLOCK": { experts: 12, sources: "236 videójából", help: ["Megrajzolja az ideális vevőd profilját", "Kigyűjti a vevőid valódi fájdalmait és szavait", "Vevőperszónákat és üzenet-irányokat ad"], topics: ["ideális vevőprofil (ICP)", "vevőperszónák", "vevői hang (VOC) kutatás", "Jobs-to-be-Done elemzés"] },
    "SUN-TZU": { basis: "Nyilvános adatforrásokra épül (Meta hirdetéstár, weboldalak, vélemények)", help: ["Feltérképezi a versenytársaidat és a futó hirdetéseiket", "Figyeli az áraikat és a weboldaluk változásait", "A rájuk írt panaszokból pozicionálási ötletet ad"], topics: ["versenytárs-hirdetések", "ár- és weboldal-figyelés", "vélemény-bányászat", "heti versenytárs-jelentés"] },
    "KEPLER": { experts: 14, sources: "131 anyagából", help: ["Változatos hirdetési koncepciókat talál ki", "Szögeket, formátumokat és hookokat párosít", "Tesztelhető mini briefeket ad a kreatívokhoz"], topics: ["tudatossági szintek", "48 hirdetésformátum", "hookok és szögek", "kreatív tesztelés"] },
    "CYRANO": { experts: 17, sources: "250+ videójából", help: ["Hirdetésszövegeket ír Metára, Google-re, LinkedInre", "Több hangnemben és hosszban, tesztelhető készletben", "Elemzi és javítja a meglévő szövegeidet"], topics: ["hookok és főcímek", "platformspecifikus szöveg", "meggyőzési keretek", "AI-szagtalan magyar szöveg"] },
    "AURORA": { experts: 6, sources: "370 videójából", help: ["Átvilágítja a Meta-hirdetési fiókodat", "Megmondja, mi viszi a pénzt és mit cserélj", "A bekötött fiókodban kampányt is épít"], topics: ["kampánystruktúra", "Advantage+ és Andromeda", "kreatív stratégia", "büdzsé és skálázás"] },
    "APOLLON": { experts: 8, sources: "117 videójából", help: ["Átvilágítja a Google Ads-fiókodat", "Kampánystruktúrát és ajánlati stratégiát tervez", "A bekötött fiókodban kampányt épít és optimalizál"], topics: ["Search és Performance Max", "kulcsszóstratégia", "ajánlattételi stratégia", "konverziómérés"] },
    "MIDASZ": { experts: 11, sources: "1100+ anyagából", help: ["Szekciónként megtervezi a landolóoldaladat", "Kész szöveget ír: headline, ajánlat, bizonyíték, CTA", "Átvilágítja a meglévő oldalad konverzióját"], topics: ["konverzióoptimalizálás (CRO)", "ajánlat és értékajánlat", "headline és CTA", "A/B tesztelés"] },
    "ROBINSON": { basis: "Bevált build-, ellenőrzési és visszaállítási folyamatra épül", help: ["A kész tervből működő oldalt épít", "Kiválasztja a neked megfelelő technikát (HTML, Elementor, saját)", "Élesítés előtt végigellenőrzi az oldalt"], topics: ["oldalépítés", "technikaválasztás", "minőségellenőrzés", "biztonságos élesítés"] },
    "LEONARDO": { experts: 8, sources: "280+ anyagából", help: ["Hirdetési kreatívokat tervez és véleményez", "Egy termékképből sok hirdetésváltozatot gyárt", "Megmondja, miért nem állítja meg a görgetést egy kép"], topics: ["vizuális hierarchia", "görgetésmegállító design", "platformspecifikus kreatív", "márkaarculat"] },
    "MATISSE": { basis: "A Figma hivatalos eszközeire és a márkád üzleti profiljára épül", help: ["Figmában wireframe-et és kész designt készít", "Hirdetés- és social makettet tervez", "Gyorsan kiolvas és összefoglal meglévő Figma-fájlokat"], topics: ["landolóoldal-wireframe", "hirdetésmakett", "design system", "márkakonzisztencia"] },
    "NEXUS": { basis: "A Figma hivatalos fejlesztői kapcsolatára épül", help: ["A Figma-tervből működő kódot készít", "Átveszi a pontos méreteket, színeket, betűket", "Előkészíti az oldalt a fejlesztéshez"], topics: ["Figma → kód", "pixelpontos átvétel", "komponensek", "reszponzív elrendezés"] },
    "SENTRY": { basis: "A leggyakoribb, AI okozta Figma-hibák ellenőrzőlistájára épül", help: ["Átnézi a kész Figma-designt", "Kijavítja az elcsúszott elrendezést és a levágott szöveget", "Ellenőrzi a magyar ékezeteket"], topics: ["auto-layout hibák", "túlcsordulás és levágás", "igazítás", "ékezethelyesség"] },
    "VECTOR": { basis: "A platformok hivatalos méret- és biztonsági zónáira épül", help: ["Egy kész hirdetést minden képarányra újratördel", "Megtartja a szöveget betűre, ékezettel", "Figyel a Stories, Reels és TikTok biztonsági zónáira"], topics: ["1:1, 4:5, 9:16, 16:9", "platform-safe-zone", "szöveg-pontosság", "méretvariánsok"] },
    "GULLIVER": { basis: "Bevált videóletöltő és leiratozó eszközökre épül", help: ["Letölti és leiratozza a videókat", "Versenytárs-videókat bont elemezhető anyaggá", "Előkészíti a forrást a script- és vágómunkához"], topics: ["videóletöltés", "leiratozás", "forráselemzés", "versenytárs-videók"] },
    "SEHEREZADE": { experts: 20, sources: "129 videójából", help: ["Rövid videó- és hirdetésscripteket ír", "Hookokat generál és értékel", "Egy meglévő videóból sablont fejt vissza a termékedre"], topics: ["Reels, TikTok, Shorts", "hookok és megtartás", "UGC-scriptek", "kreatív tesztelés"] },
    "LUMIERE": { basis: "Bevált UGC-formulára és vezető videómodellekre épül", help: ["UGC-stílusú termékvideót készít", "AI-influencer karakterlapot és képeket gyárt", "Termék-a-kézben képeket készít hirdetéshez"], topics: ["UGC termékvideó", "AI-influencer", "termékbemutató", "videómodellek"] },
    "KRONOSZ": { basis: "Beszélgetés-vezérelt vágási folyamatra épül", help: ["Nyersanyagból kész MP4-et vág", "Feliratot éget, és animációkat tesz rá", "Színkorrekciót és ritmust ad a videónak"], topics: ["vágás szóhatáron", "égetett felirat", "motion graphics", "színkorrekció"] },
    "GUTENBERG": { basis: "Vezető AI-videómodellek promptolási módszerére épül", help: ["Többjelenetes AI-videót tervez", "Pontos, jelenetenkénti promptokat ír", "Képből mozgó videót készít"], topics: ["többjelenetes videó", "jelenetpromptok", "képből videó", "akciójelenetek"] },
    "KOLUMBUSZ": { basis: "A saját Search Console-adataidra és a keresési találatok elemzésére épül", help: ["Kulcsszó- és keresési szándék-kutatást végez", "Megmutatja, hol előznek meg a versenytársak", "Tartalomtervet ad a kutatásból"], topics: ["kulcsszókutatás", "keresési szándék", "versenytárs-rések", "AI-keresők (GEO)"] },
    "PARETO": { basis: "A saját Search Console-adataidra és a Google irányelveire épül", help: ["Rangsorolásra kész cikket ír", "Frissíti és pontozza a meglévő tartalmaidat", "Google-re és AI-keresőkre is optimalizál"], topics: ["SEO-cikkírás", "tartalomfrissítés", "tartalom-pontozás", "GEO-optimalizálás"] },
    "MERIDIAN": { basis: "A Google irányelveire és a saját méréseidre épül", help: ["Technikai SEO-auditot végez", "Strukturált adatot (schema) és llms.txt-t készít", "Átnézi a sebességet és a belső linkelést"], topics: ["schema markup", "Core Web Vitals", "belső linkelés", "AI-botok kezelése"] },
    "VERITAS": { basis: "A saját Search Console-adataidra és a Google irányelveire épül", help: ["Oldalanként teljes SEO-auditot végez", "Ellenőrzi a szakértői hitelességet (E-E-A-T)", "Megmutatja a tartalmi réseket"], topics: ["on-page SEO", "E-E-A-T", "AI-láthatóság", "tartalmi rések"] },
    "ARTEMISZ": { basis: "A Google Cégprofil és a helyi keresés irányelveire épül", help: ["Optimalizálja a Google Cégprofilodat", "Helyi kulcsszókutatást végez", "Véleménygyűjtési stratégiát ad"], topics: ["Google Cégprofil", "helyi kulcsszavak", "NAP-egyezés", "vélemény-stratégia"] },
    "HERMESZ": { experts: 21, sources: "100+ anyagából", help: ["E-mail-stratégiát és levélsorozatot tervez", "AI-szagtalan, eladó leveleket ír", "A bekötött MailerLite-fiókodban fel is építi a sorozatot"], topics: ["üdvözlő és nurture-sorozat", "tárgysorok", "kézbesíthetőség", "automatizálás"] },
    "PERPETUUM": { basis: "Stu McLaren és társai 128 videójából táplálkozik", help: ["Előfizetéses vagy tagsági modellt tervez", "Csökkenti a lemorzsolódást", "Onboardingot és tartalomütemet ad"], topics: ["előfizetéses árazás", "lemorzsolódás (churn)", "tag-onboarding", "közösségépítés"] },
    "FIGARO": { experts: 31, sources: "520 videójából", help: ["Optimalizálja a LinkedIn-profilodat", "Posztokat ír a te hangodon", "Tartalom- és megkeresési stratégiát ad"], topics: ["profiloptimalizálás", "személyes márka", "hookok és formátumok", "LinkedIn-algoritmus"] }
  };
  window.GM_AGENTS.forEach(function (a) {
    if (GM_PROFILE[a.code]) a.profile = GM_PROFILE[a.code];
    var areas = GM_AREAS10[a.code];
    if (!areas) return;
    a.cats = areas;
    a.cat = areas[0];
    a.catEn = GM_AREA_EN[areas[0]];
    a.color = GM_AREA_COLORS[areas[0]];
  });
})();
