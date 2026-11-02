/* ============================================================
   Az AI csapatod : MISSION CONTROL showcase · agent-adatmodell
   Kétnyelvű (HU + …En). A metrics/currentTask SZIMULÁLT telemetria.
   role/benefit a Tudástár 2.0 csapattag-áttekintéséből (2026-11-01).

   NÉVTÉR (2026-07-31, „AI-team V2"):
   - `code` = ASCII azonosító : fájlnév (avatars/badges), VIZ-kulcs,
     data-agent attribútum. SOSEM ékezetes.
   - `name` = megjelenített név, ékezetekkel (ATHÉNÉ, MIDÁSZ, LUMIÈRE…).

   2026-11-01 (Tibor): a névsor a Tudástár 2.0 „Csapattagok áttekintése"
   blokkját követi: 38 tag, 9 csoport. Új tagok: IDENTITAS, VALOR, INCRESCO,
   PARCITAS (a korábbi KOLTSEGOR kártya), BREVIA (a korábbi TIKTOK kártya),
   ARGUSZ, FAMA, OVIDIUS, ACCESSUS, ETALON, PURITAS; GUTENBERG visszatért a
   saját skilljével (genmarketer-ai-videokeszito). GULLIVER kikerült (nincs
   önálló skillje). A HU és az EN modell ugyanaz a 38 tag.
   ============================================================ */
(function () {
  "use strict";
  var AV = "/assets/img/avatars/", PF = "/assets/img/proof/", VD = "/assets/video/", DM = "/assets/demo/";
  /* `proof` = VALÓS minta-kimenet a szakember-adatlap „Így néz ki, amit kapsz” zónájába
     (2026-10-05, Károly). Ahol van, a munkaállomás saját animációja vagy videója a minta
     (.mp4 → loopoló videó, .html → animált demó, kép → kép). A név-badge SOHA nem minta;
     ahol nincs illő anyag, `null` → a zóna nem jelenik meg. A relevanciát gépi kapu őrzi:
     tests/proof-relevance.mjs (a minta annak a munkaállomás-fülnek a sajátja, ahol a tag
     a csapatban van, vagy kimondott kivétel). `proofRatio` = nem 1070:720-as demó aránya. */

  /* ── A landolón HIRDETETT számok ────────────────────────────────────────────
     Ez DEKLARÁLT marketing-tény, NEM az alábbi tömbből származtatott szám.
     2026-08-03 (Károly): a hirdetett csapatlétszám üzleti döntés; a gépi kapu
     (tests/roster-counts.mjs) minden látható számot EHHEZ a két értékhez mér, tehát
     két egymásnak ellentmondó szám nem élhet egy oldalon.
     2026-11-01 (Tibor): 38 csapattag, a Tudástár 2.0 áttekintése szerint; a 10 terület
     a Munkaállomás-blokk (#use-casek) fülrendje, az a szűrő is a csapatrácson.
     ⚠️ Egyetlen hely: aki átírja, itt írja át : a HTML-prózát is vele együtt,
     különben a kapu megbukik. */
  window.GM_LANDING_FACTS = { team: 38, areas: 10 };

  window.GM_TEAM = [
    { cat: "Vezetés és stratégia", catEn: "Leadership & strategy", color: "#F5A623", members: [
      { code: "ATLASZ", name: "ATLASZ", role: "a csapatvezető", roleEn: "the team lead", slug: "genmarketer-team", status: "live",
        benefit: "Egyszer megismeri a vállalkozásodat, és onnantól minden feladatra a megfelelő szakértőt hívja be – neked csak vele kell beszélned. Ő a karmester: megérti a célodat, kiválasztja a szakembereket, és a lépéseket egyetlen végigvihető forgatókönyvbe rendezi.",
        benefitEn: "Gets to know your business once, then brings in the right specialist for every task – you only ever talk to one. It understands your goal, picks the specialists and turns the steps into a single playbook.",
        currentTask: "a megfelelő specialistát hívja be…", currentTaskEn: "Bringing in the right specialist…",
        metrics: [{ label: "specialista", labelEn: "specialist", target: 20 }, { label: "kampányterv", labelEn: "campaign plan", target: 6 }],
        proof: DM + "genmarketer-soparna-chat.html", proofRatio: "1092 / 672", spec: { pipeline: "profil → irányítás → forgatókönyv", cadence: "mindig elöl", scheduler: "készen áll" },
        specEn: { pipeline: "profile → routing → playbook", cadence: "always first", scheduler: "ready" } },
      { code: "ATHENE", name: "ATHÉNÉ", role: "a stratégiai partner", roleEn: "the strategic partner", slug: "genmarketer-billion-dollar-board", status: "live",
        benefit: "Végiggondolja veled a következő nagy lépésed – mintha lenne egy saját igazgatótanácsod. Kilenc üzleti legenda tudása egy asztalnál: kérdezel, és a kérdéshez illő szakértő hangján kapsz választ, magyarul, a saját helyzetedre szabva.",
        benefitEn: "Thinks through your next big move with you – like having your own board of directors. Nine business legends at one table, answering in the voice that fits your question.",
        currentTask: "a következő nagy lépésed gondolja végig…", currentTaskEn: "Thinking through your next big move…",
        metrics: [{ label: "forgatókönyv", labelEn: "scenario", target: 3 }, { label: "döntés", labelEn: "decision", target: 7 }],
        proof: DM + "genmarketer-kerekasztal.html", spec: { pipeline: "helyzet → opciók → döntés", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "situation → options → decision", cadence: "on demand", scheduler: "ready" } },
      { code: "SUN-TZU", name: "SUN TZU", role: "a versenytárs-elemző", roleEn: "the competitor analyst", slug: "genmarketer-competitor-intel", status: "live",
        benefit: "Feltérképezi a versenytársaidat, hogy mindig egy lépéssel előttük járj. Megadod a konkurenseidet (vagy felderíti őket helyetted), és tiszta képet kapsz arról, mi történik a piacodon: nem nyers adatot zúdít rád, hanem azt mutatja, mi fontos és miért.",
        benefitEn: "Maps out your competitors so you're always one step ahead. Name them (or let it find them) and get a clear picture of your market: what matters and why, not raw data.",
        currentTask: "3 versenytárs aktív hirdetéseit térképezi…", currentTaskEn: "Mapping 3 competitors' live ads…",
        metrics: [{ label: "versenytárs", labelEn: "competitor", target: 11 }, { label: "aktív hirdetés", labelEn: "live ad", target: 38 }],
        proof: VD + "konkurencia-audit-scroll.mp4", spec: { pipeline: "felderítés → hirdetés-figyelés → rés", cadence: "heti", scheduler: "folyamatos" },
        specEn: { pipeline: "recon → ad-watch → gap", cadence: "weekly", scheduler: "continuous" } },
      { code: "SHERLOCK", name: "SHERLOCK", role: "a piackutató", roleEn: "the market researcher", slug: "genmarketer-icp-researcher", status: "live",
        benefit: "Pontosan megmondja, kik a vevőid és mi fáj nekik – hogy ne a sötétben lövöldözz. Megírja az ICP-det, validálja a personákat, megtalálja a vásárlói nyelvet, és odaadja a marketing-irányokat, amiből másnap kampányt tudsz indítani.",
        benefitEn: "Pinpoints exactly who your buyers are and what hurts them – so you stop shooting in the dark. Writes your ICP, validates personas, finds the buyers' language and hands over campaign-ready directions.",
        currentTask: "ICP-profilt épít a célpiacodról…", currentTaskEn: "Building an ICP profile of your market…",
        metrics: [{ label: "vevői avatar", labelEn: "buyer persona", target: 6 }, { label: "fájó pont", labelEn: "pain point", target: 42 }],
        proof: DM + "genmarketer-vevoprofil.html", spec: { pipeline: "kutatás → avatar → üzenet", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "research → persona → message", cadence: "on demand", scheduler: "ready" } },
      { code: "IDENTITAS", name: "IDENTITAS", role: "a márkastratéga", roleEn: "the brand strategist", slug: "genmarketer-brand-guide", status: "live",
        benefit: "Rendet tesz a márkád körül: összegyűjti a valódi történeteidet, megfogalmazza, miben vagy más, és kiméri a márkahangodat, amit onnantól minden szöveg követ. A kampányoknak így közös alapjuk van, és a hirdetés, az e-mail és a weboldal ugyanazon a hangon szól.",
        benefitEn: "Puts your brand in order: collects your real stories, states what makes you different and measures your brand voice, which every text then follows.",
        currentTask: "a márkahangodat méri ki…", currentTaskEn: "Measuring your brand voice…",
        metrics: [{ label: "márkasztori", labelEn: "brand story", target: 12 }, { label: "hangdimenzió", labelEn: "voice dimension", target: 8 }],
        proof: null, spec: { pipeline: "sztoribank → pozicionálás → hangprofil", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "story bank → positioning → voice profile", cadence: "on demand", scheduler: "ready" } },
      { code: "VALOR", name: "VALOR", role: "az ajánlat-építő", roleEn: "the offer builder", slug: "genmarketer-offer-builder", status: "live",
        benefit: "Olyan ajánlatot rak össze, amire könnyű igent mondani: világos kimenet, értékelemek, betartható garancia és bizonyítékhoz kötött ár. Ha egy audit után ügyfélnek kell ajánlatot írnod, azt is ő fogalmazza meg döntésre kész formában.",
        benefitEn: "Builds an offer that is easy to say yes to: clear outcome, value stack, a guarantee you can keep and a price tied to evidence. Also writes decision-ready client proposals after an audit.",
        currentTask: "az ajánlatod értékelemeit rakja össze…", currentTaskEn: "Assembling your offer's value stack…",
        metrics: [{ label: "értékelem", labelEn: "value item", target: 7 }, { label: "ajánlatváltozat", labelEn: "offer variant", target: 3 }],
        proof: null, spec: { pipeline: "ajánlat → értékelemek → ajánlatdokumentum", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "offer → value stack → proposal", cadence: "on demand", scheduler: "ready" } },
      { code: "INCRESCO", name: "INCRESCO", role: "a növekedési elemző", roleEn: "the growth analyst", slug: "genmarketer-growth-analyst", status: "live",
        benefit: "Megmondja, mi történik a számaidban, és mit csinálj vele. Hetente vezetői riportban összefoglalja a lényeget, ha valami leesett, kinyomozza az okát, ha pedig szivárog a tölcsér, megmutatja, hol veszíted a legtöbb vevőt.",
        benefitEn: "Tells you what is happening in your numbers and what to do about it: a weekly executive report, root-cause work when a KPI drops, and funnel diagnosis when buyers leak out.",
        currentTask: "a heti vezetői riportot írja…", currentTaskEn: "Writing the weekly executive report…",
        metrics: [{ label: "lelet", labelEn: "finding", target: 5 }, { label: "prioritás", labelEn: "priority", target: 3 }],
        proof: null, spec: { pipeline: "adat → lelet → prioritás", cadence: "heti", scheduler: "folyamatos" },
        specEn: { pipeline: "data → finding → priority", cadence: "weekly", scheduler: "continuous" } },
      { code: "PARCITAS", name: "PARCITAS", role: "az AI-költségőr", roleEn: "the AI cost guardian", slug: "genmarketer-ai-koltsegor", status: "live",
        benefit: "Figyel rá, hogy az AI-munka ne kerüljön többe, mint amennyit hoz. Felméri, hol folyik el a keret és az idő a munkafolyamataidban, és úgy javasol spórolást, hogy a minőség ne romoljon csendben.",
        benefitEn: "Makes sure your AI work never costs more than it brings in: measures where budget and time leak in your workflows and proposes savings without silently lowering quality.",
        currentTask: "a kiinduló AI-költséget méri…", currentTaskEn: "Measuring the baseline AI cost…",
        metrics: [{ label: "mérési alap", labelEn: "baseline", target: 1 }, { label: "pazarlás", labelEn: "waste found", target: 3 }],
        proof: null, spec: { pipeline: "mérés → pazarlás → kísérlet", cadence: "igény szerint", scheduler: "igény szerint" },
        specEn: { pipeline: "measure → waste → experiment", cadence: "on demand", scheduler: "on demand" } }
    ]},
    { cat: "Hirdetés", catEn: "Advertising", color: "#00D4FF", members: [
      { code: "KEPLER", name: "KEPLER", role: "a hirdetéstervező", roleEn: "the ad planner", slug: "genmarketer-ad-planner", status: "live",
        benefit: "Kitalálja a kampányodat, amelyik megállítja a görgető ujjat a hírfolyamban. Nem szöveget ír, hanem koncepciókat: 10–20 különböző hirdetés-ötletet, mindegyik egy mini brief (tudatossági szint × formátum × szög), hogy a Meta algoritmusa több célzási jellel dolgozzon.",
        benefitEn: "Comes up with the campaign that stops the scrolling thumb in the feed: 10–20 distinct ad concepts, each a mini brief (awareness level × format × angle), so Meta's algorithm gets more targeting signals.",
        currentTask: "12 kampányötletet generál…", currentTaskEn: "Generating 12 campaign ideas…",
        metrics: [{ label: "kampányötlet", labelEn: "campaign idea", target: 12 }, { label: "szög", labelEn: "angle", target: 5 }],
        proof: DM + "genmarketer-otletgenerator.html", spec: { pipeline: "felismerés → szög → koncepció", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "insight → angle → concept", cadence: "on demand", scheduler: "ready" } },
      { code: "CYRANO", name: "CYRANO", role: "a hirdetés-szövegíró", roleEn: "the ad copywriter", slug: "genmarketer-ad-copywriter", status: "live",
        benefit: "Megírja a hirdetésszövegeidet, amikre tényleg kattintanak – nem görgetnek tovább. Bármilyen platformra, bármilyen tudatossági szintre, három verzióban, magyar nyelvőrrel és jelentéshű szerkesztéssel: a brief tényeit, az árat, a határidőt és a bizonyítékot nem írja át.",
        benefitEn: "Writes ad copy people actually click – instead of scrolling past. Any platform, any awareness level, three versions, with a Hungarian language guard; it never rewrites the brief's facts, price, deadline or proof.",
        currentTask: "3 hook-variánst ír a hirdetésedhez…", currentTaskEn: "Writing 3 hook variants for your ad…",
        metrics: [{ label: "főcím", labelEn: "headline", target: 47 }, { label: "CTR", labelEn: "CTR", target: 34, suffix: "%↑" }],
        proof: DM + "genmarketer-szovegkeszlet.html", spec: { pipeline: "horog → törzs → CTA", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "hook → body → CTA", cadence: "on demand", scheduler: "ready" } },
      { code: "AURORA", name: "AURORA", role: "a Facebook Ads-szakértő", roleEn: "the Facebook Ads expert", slug: "genmarketer-facebook-ad-expert", status: "live",
        benefit: "Úgy kezeli a Meta-kampányaidat, hogy olcsóbb leadeket és több vásárlót hozzanak. Nem prompt, hanem strukturált tudásbázis: úgy olvas belőle, mintha egy tapasztalt hirdetéskezelő ülne melletted. A Meta Ads connectorral a saját fiókodból dolgozik.",
        benefitEn: "Runs your Meta campaigns to bring cheaper leads and more buyers. Not a prompt but a structured knowledge base, and with the Meta Ads connector it works from your own account.",
        currentTask: "Meta-célzást finomhangol…", currentTaskEn: "Fine-tuning Meta targeting…",
        metrics: [{ label: "érdeklődő", labelEn: "lead", target: 212 }, { label: "CPL", labelEn: "CPL", target: 29, suffix: "%↓" }],
        proof: VD + "fb-ads-riport-scroll.mp4", spec: { pipeline: "célzás → kreatív → skálázás", cadence: "napi", scheduler: "folyamatos" },
        specEn: { pipeline: "targeting → creative → scale", cadence: "daily", scheduler: "continuous" } },
      { code: "APOLLON", name: "APOLLÓN", role: "a Google Ads-hirdetéskezelő", roleEn: "the Google Ads manager", slug: "genmarketer-google-ads-expert", status: "live",
        benefit: "Beállítja és pörgeti a Google-hirdetéseidet, hogy ne égjen el feleslegesen a kereted. Performance Max, AI Max for Search, Smart Bidding a 2025–2026-os valósághoz szabva; a Google Ads connectorral a saját fiókodat elemzi.",
        benefitEn: "Sets up and runs your Google Ads so your budget doesn't burn for nothing: Performance Max, AI Max for Search and Smart Bidding as they work in 2025–2026, analysing your own account through the Google Ads connector.",
        currentTask: "a Google-kereted újraosztja…", currentTaskEn: "Reallocating your Google budget…",
        metrics: [{ label: "keret védve", labelEn: "budget saved", target: 31, suffix: "%" }, { label: "CPA", labelEn: "CPA", target: 22, suffix: "%↓" }],
        proof: VD + "gads-riport-scroll.mp4", spec: { pipeline: "struktúra → licit → riport", cadence: "napi", scheduler: "folyamatos" },
        specEn: { pipeline: "structure → bid → report", cadence: "daily", scheduler: "continuous" } },
      { code: "BREVIA", name: "BREVIA", role: "a TikTok-szakértő", roleEn: "the TikTok Ads expert", slug: "genmarketer-tiktok-ads-expert", status: "live",
        benefit: "TikTokra szabja a hirdetéseidet: mérési feltételekhez kötött kampánytervet, tesztelhető kreatívötleteket és világos „megállunk vagy folytatjuk” szabályokat ad, hogy ne vaktában költs.",
        benefitEn: "Tailors your ads to TikTok: a campaign plan tied to measurement, testable creative ideas and clear stop-or-continue rules, so you never spend blind.",
        currentTask: "TikTok-kreatívtesztet tervez…", currentTaskEn: "Planning a TikTok creative test…",
        metrics: [{ label: "kreatívteszt", labelEn: "creative test", target: 4 }, { label: "döntési szabály", labelEn: "decision rule", target: 3 }],
        proof: null, spec: { pipeline: "mérés → kreatívteszt → skálázás", cadence: "igény szerint", scheduler: "igény szerint" },
        specEn: { pipeline: "measurement → creative test → scale", cadence: "on demand", scheduler: "on demand" } }
    ]},
    { cat: "Landoló és web", catEn: "Landing page & web", color: "#06B6D4", members: [
      { code: "MIDASZ", name: "MIDÁSZ", role: "a landolóoldal-szakértő", roleEn: "the landing page expert", slug: "genmarketer-landing-page-expert", status: "live",
        benefit: "Megtervezi a landoló oldaladat, amelyik a látogatóidból tényleg vevőt csinál. Landoló oldal és konverzió-optimalizálási tanácsadó: 11 nemzetközi szakértő tudása több mint ezer videóból, magyar-első szállítással.",
        benefitEn: "Designs a landing page that actually turns your visitors into buyers: landing page and CRO advisor built from 11 international experts and over a thousand videos.",
        currentTask: "a landolód szekcióit hangolja…", currentTaskEn: "Tuning your landing page sections…",
        metrics: [{ label: "szekció", labelEn: "section", target: 9 }, { label: "konverzió", labelEn: "conversion", target: 34, suffix: "%↑" }],
        proof: DM + "genmarketer-landolo-epito.html", spec: { pipeline: "vázlat → szöveg → szekciók", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "outline → copy → sections", cadence: "on demand", scheduler: "ready" } },
      { code: "ARGUSZ", name: "ARGUSZ", role: "a webdesign-igazgató", roleEn: "the web design director", slug: "genmarketer-webdesign-director", status: "live",
        benefit: "Árgus szemekkel nézi a kész tervet, mielőtt a vevőid elé kerül: megmondja, mitől hat AI-generáltnak az oldalad, és saját arcot ad neki – nem a jól ismert lila gradienses, három üvegkártyás sablont. A vizuális minőség őre: nem szöveget ír és nem épít, hanem tervez, kritizál és dönt-előkészít.",
        benefitEn: "Reviews the finished design before your customers see it: tells you what makes a page look AI-generated and gives it a face of its own. Guardian of visual quality: plans, critiques and prepares decisions.",
        currentTask: "a design-variánsokat bírálja el…", currentTaskEn: "Reviewing the design variants…",
        metrics: [{ label: "variáns", labelEn: "variant", target: 3 }, { label: "design-lelet", labelEn: "design finding", target: 14 }],
        proof: null, spec: { pipeline: "referencia → variánsok → design-audit", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "reference → variants → design audit", cadence: "on demand", scheduler: "ready" } },
      { code: "ROBINSON", name: "ROBINSON", role: "a landolóoldal-építő", roleEn: "the landing page builder", slug: "genmarketer-web-builder", status: "live",
        benefit: "Kódba önti a kész landolódat – anélkül, hogy fejlesztőt kéne fizetned. MIDÁSZ tervéből és ARGUSZ design-jegyzékéből építési tervet és kész oldalt készít, kiadás előtti ellenőrzőlistával.",
        benefitEn: "Turns your finished landing page into code – without paying a developer. From MIDÁSZ's plan and ARGUSZ's design notes it builds the page with a pre-release checklist.",
        currentTask: "a szekciókat kóddá építi és leteszteli…", currentTaskEn: "Building your sections into code and testing them…",
        metrics: [{ label: "komponens", labelEn: "component", target: 24 }, { label: "QA-teszt", labelEn: "QA check", target: 7 }],
        proof: PF + "lumore-preview.webp", spec: { pipeline: "dizájn → kód → publikálás", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "design → code → publish", cadence: "on demand", scheduler: "ready" } }
    ]},
    { cat: "Design és Figma", catEn: "Design & Figma", color: "#9B6DFF", members: [
      { code: "LEONARDO", name: "LEONARDO", role: "a kreatív designer", roleEn: "the creative designer", slug: "genmarketer-ad-creative-design", status: "live",
        benefit: "Megtervezi a hirdetési kreatívjaidat, amik kitűnnek a végtelen hírfolyamból. Két módban dolgozik: kritizál (meglévő kreatív, vizuális hierarchia, stop-scroll) és gyárt (termékfotóból és márkaoldalból több statikus hirdetésváltozat 1:1, 4:5 és 9:16 arányban, a Kreatív-render connectorral).",
        benefitEn: "Designs ad creatives that stand out in the endless feed. Two modes: critique (existing creative, hierarchy, stop-scroll) and production (several static ad variants from a product photo, in 1:1, 4:5 and 9:16, through the creative-render connector).",
        currentTask: "kreatívokat tervez a hírfolyamba…", currentTaskEn: "Designing creatives for the feed…",
        metrics: [{ label: "kreatív", labelEn: "creative", target: 18 }, { label: "görgetésállító", labelEn: "stop-scroll", target: 27, suffix: "%↑" }],
        proof: DM + "genmarketer-koncepciok.html", spec: { pipeline: "koncepció → vizuál → variáns", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "concept → visual → variant", cadence: "on demand", scheduler: "ready" } },
      { code: "MATISSE", name: "MATISSE", role: "a Figma-tervező", roleEn: "the Figma designer", slug: "genmarketer-figma-builder", status: "live",
        benefit: "Profi dizájnt tervez neked Figmában, grafikus felvétele nélkül. Beolvas bármilyen Figma-fájlt, és felépíti vagy szerkeszti a marketing-anyagokat: landoló wireframe, hirdetés-makett, social sablon, funnel-ábra, design system. Mindig a saját márkaszíneiddel és ékezet-pontos magyar szöveggel; a kész munkát SENTRY ellenőrzi.",
        benefitEn: "Designs professional visuals in Figma – without hiring a graphic designer: landing wireframes, ad mockups, social templates, funnel diagrams and design systems, in your brand colours, checked by SENTRY.",
        currentTask: "drótvázat tervez Figmában…", currentTaskEn: "Designing a wireframe in Figma…",
        metrics: [{ label: "rajztábla", labelEn: "artboard", target: 12 }, { label: "brand-egységes", labelEn: "on-brand", target: 100, suffix: "%" }],
        proof: DM + "genmarketer-figma-carousel.html", spec: { pipeline: "feladatkiírás → dizájn → átadás", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "brief → design → handoff", cadence: "on demand", scheduler: "ready" } },
      { code: "NEXUS", name: "NEXUS", role: "a Figma–kód híd", roleEn: "the Figma-to-code bridge", slug: "genmarketer-figma-kod-hid", status: "live",
        benefit: "A dizájnodból működő kódot csinál – fejlesztő nélkül. Egy wireframe-ből (Figma-vázlat, képernyőfotó, kézi skicc, szöveges layout vagy HTML) kész, kidolgozott designt épít: Figma-makettet és letisztult HTML/CSS-kódot, fejlesztőnek átadható design-tokenekkel. Minden döntést UX/UI-szabály alapján hoz, és kerüli az AI-szagú sablont.",
        benefitEn: "Turns your design into working code – without a developer. From a wireframe (Figma sketch, screenshot, hand drawing or HTML) it builds a finished design: a Figma mockup plus clean HTML/CSS with design tokens.",
        currentTask: "a Figma-dizájnt kóddá alakítja…", currentTaskEn: "Turning Figma design into code…",
        metrics: [{ label: "komponens", labelEn: "component", target: 24 }, { label: "kód kész", labelEn: "code done", target: 100, suffix: "%" }],
        proof: DM + "genmarketer-figma-scroll.html", spec: { pipeline: "Figma → komponens → kód", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "Figma → component → code", cadence: "on demand", scheduler: "ready" } },
      { code: "SENTRY", name: "SENTRY", role: "a Figma QA-ellenőr", roleEn: "the Figma QA reviewer", slug: "genmarketer-figma-qa", status: "live",
        benefit: "Kiszúrja a dizájnod hibáit, mielőtt a vevőidnek szúrnának szemet. A csapat záró minőségkapuja: átnézi a frissen épült vagy módosított Figma-designt, kijavítja a gyakori, AI okozta hibákat, és magyar PASS / JAVÍTVA / FAIL jelentést ad node-szintű hivatkozással. Nem épít, nem tervez újra: ellenőriz és javít.",
        benefitEn: "Catches the flaws in your design before your customers do: the team's final quality gate for Figma work, fixing common AI-made errors and reporting PASS / FIXED / FAIL per node.",
        currentTask: "átnézi a dizájn hibáit…", currentTaskEn: "Reviewing the design for flaws…",
        metrics: [{ label: "ellenőrzés", labelEn: "check", target: 18 }, { label: "hibátlan", labelEn: "flawless", target: 100, suffix: "%" }],
        proof: null, spec: { pipeline: "audit → jelölés → javítás", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "audit → flag → fix", cadence: "on demand", scheduler: "ready" } },
      { code: "VECTOR", name: "VECTOR", role: "a képátméretező", roleEn: "the image resizer", slug: "genmarketer-ad-resize", status: "live",
        benefit: "Egy kész hirdetésből platformkész 1:1, 4:5, 9:16, 16:9 és 2:3 változatokat készít, levágás és széthúzás nélkül. A forrásképet elemekre bontja, és az új képarányhoz újrarendezi a hátteret, a fő témát, a szövegblokkokat és a logót; a szöveget betűre ugyanúgy viszi át.",
        benefitEn: "Turns one finished ad into platform-ready 1:1, 4:5, 9:16, 16:9 and 2:3 versions without crude cropping or stretching, re-laying out background, subject, text blocks and logo for each ratio.",
        currentTask: "a kreatívodat több képarányra tördeli…", currentTaskEn: "Reflowing your creative into multiple aspect ratios…",
        metrics: [{ label: "képarány", labelEn: "aspect ratio", target: 5 }, { label: "szöveg-QA", labelEn: "text QA", target: 100, suffix: "%" }],
        proof: PF + "meret-adaptacio.webp", spec: { pipeline: "forráskép → újratördelés → betű-QA", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "source image → reflow → text QA", cadence: "on demand", scheduler: "ready" } }
    ]},
    { cat: "Videó", catEn: "Video", color: "#400099", members: [
      { code: "SEHEREZADE", name: "SEHEREZÁDÉ", role: "a videós forgatókönyvíró", roleEn: "the video script writer", slug: "genmarketer-video-script-writer", status: "live",
        benefit: "Megírja a videóid forgatókönyvét, ami az első másodperctől fogva tartja a néződ. Forgatható scriptek a horogtól a CTA-ig: Reels, TikTok, Shorts, YouTube, hirdetés és VSL; 20 szakértő tudása, 96 keretrendszer, 300+ horog-példa 22 iparágból.",
        benefitEn: "Writes video scripts that hold viewers from the first second: Reels, TikTok, Shorts, YouTube, ads and VSLs, from 20 experts, 96 frameworks and 300+ hook examples across 22 industries.",
        currentTask: "az első 3 másodpercet írja…", currentTaskEn: "Writing the first 3 seconds…",
        metrics: [{ label: "horog", labelEn: "hook", target: 15 }, { label: "megtartás", labelEn: "retention", target: 38, suffix: "%↑" }],
        proof: DM + "genmarketer-storyboard.html", spec: { pipeline: "horog → ív → CTA", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "hook → arc → CTA", cadence: "on demand", scheduler: "ready" } },
      { code: "LUMIERE", name: "LUMIÈRE", role: "az UGC videó-producer", roleEn: "the UGC video producer", slug: "genmarketer-ugc-video", status: "live",
        benefit: "Elkészíti a hiteles UGC-videóidat, amik tényleg vásárlót hoznak. Nem tanácsot ad: egy briefből ténylegesen legenerálja a selfie-stílusú termékvideót, az AI-influencert vagy a hirdetés-klónt, lépésről lépésre, három kötelező ellenőrzéssel (kredit, dialógus, kép).",
        benefitEn: "Creates authentic UGC videos that actually bring buyers: from a brief it generates the selfie-style product video, AI influencer or ad clone, with three mandatory checks (credits, dialogue, image).",
        currentTask: "UGC-forgatókönyvet vesz fel…", currentTaskEn: "Recording a UGC script…",
        metrics: [{ label: "UGC videó", labelEn: "UGC video", target: 9 }, { label: "hitelesség", labelEn: "authenticity", target: 92, suffix: "%" }],
        proof: VD + "demo-ugc.mp4", spec: { pipeline: "forgatókönyv → felvétel → vágás", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "script → shoot → edit", cadence: "on demand", scheduler: "ready" } },
      { code: "KRONOSZ", name: "KRONOSZ", role: "a videóvágó", roleEn: "the video editor", slug: "genmarketer-videovago", status: "live",
        benefit: "Pörgős, figyelemmegtartó videóvá vágja a nyersanyagodat. Beszélgetés-vezérelt vágó: leiratoz, szóhatáron vág, feliratot éget, színez, overlay-eket tesz rá; előbb kérdez és jóváhagyat, aztán vág és önellenőriz, a végén kész MP4-et ad.",
        benefitEn: "Edits your raw footage into fast-paced, attention-holding video: transcribes, cuts on word boundaries, burns captions, grades colour and adds overlays, then delivers a finished MP4.",
        currentTask: "nyersanyagból kész videót vág…", currentTaskEn: "Editing footage into a finished video…",
        metrics: [{ label: "vágás", labelEn: "cut", target: 9 }, { label: "kész MP4", labelEn: "final MP4", target: 100, suffix: "%" }],
        proof: VD + "demo-kreativ.mp4", spec: { pipeline: "nyersanyag → vágás → exportálás", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "footage → cut → export", cadence: "on demand", scheduler: "ready" } },
      { code: "GUTENBERG", name: "GUTENBERG", role: "az AI-videókészítő", roleEn: "the AI video maker", slug: "genmarketer-ai-videokeszito", status: "live",
        benefit: "Kitalálja, megtervezi és legenerálja a több jelenetes AI-videódat, kamera, stáb és forgatás nélkül. Egy briefből vagy SEHEREZÁDÉ forgatókönyvéből reklámrendezőként dolgozik: narratív ív, snitt-terv, irány-folytonosság, átmenetek; maga építi a referenciákat, angol promptot ír, magyar narrációval adja át, és ha van hol, rendereli is.",
        benefitEn: "Plans and generates your multi-scene AI video – no camera, crew or shoot. From a brief or SEHEREZÁDÉ's script it directs like an ad director: narrative arc, shot plan, continuity, transitions, references and the final render.",
        currentTask: "hirdetési videót renderel…", currentTaskEn: "Rendering an ad video…",
        metrics: [{ label: "jelenet", labelEn: "scene", target: 3 }, { label: "stáb nélkül", labelEn: "no crew", target: 100, suffix: "%" }],
        proof: null, spec: { pipeline: "ötlet → jelenetterv → renderelés", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "idea → shot plan → render", cadence: "on demand", scheduler: "ready" } }
    ]},
    { cat: "SEO", catEn: "SEO", color: "#00AACC", members: [
      { code: "KOLUMBUSZ", name: "KOLUMBUSZ", role: "a kulcsszó-kutató", roleEn: "the keyword researcher", slug: "genmarketer-seo-research", status: "live",
        benefit: "Megtalálja neked a kulcsszavakat, amikre a vevőid tényleg rákeresnek. A tartalom-pipeline kiindulópontja: keresési szándék, SERP-elemzés, entitás-térkép, kulcsszó-stratégia és AI-láthatósági audit; a kimenete közvetlenül PARETO bemenete. A Search Console connectorral a saját adataidból indul.",
        benefitEn: "Finds the keywords your buyers actually search for: search intent, SERP analysis, entity map, keyword strategy and AI-visibility audit, starting from your own Search Console data.",
        currentTask: "kulcsszó-térképet rajzol…", currentTaskEn: "Drawing a keyword map…",
        metrics: [{ label: "kulcsszó", labelEn: "keyword", target: 148 }, { label: "szándék", labelEn: "intent", target: 9 }],
        proof: DM + "genmarketer-kulcsszo-terkep.html", spec: { pipeline: "kutatás → szándék → térkép", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "research → intent → map", cadence: "on demand", scheduler: "ready" } },
      { code: "PARETO", name: "PARETO", role: "a tartalom-optimalizáló", roleEn: "the content optimizer", slug: "genmarketer-seo-content", status: "live",
        benefit: "Úgy írja át a szövegeidet, hogy a Google is és az olvasóid is szeressék. A kutatásból publikálás-kész cikket ír, ami a Google-re és az AI-platformokra egyaránt optimalizált; a teljes tartalmi életciklust viszi: vázlat, írás, frissítés, pontozás.",
        benefitEn: "Rewrites your content so both Google and your readers love it: publication-ready articles optimised for Google and AI platforms, through the whole content lifecycle.",
        currentTask: "a szöveget Google-re hangolja…", currentTaskEn: "Tuning your copy for Google…",
        metrics: [{ label: "szöveg", labelEn: "copy", target: 12 }, { label: "SEO-pont", labelEn: "SEO score", target: 94 }],
        proof: DM + "genmarketer-seo-cikk.html", spec: { pipeline: "vázlat → írás → optimalizálás", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "outline → write → optimize", cadence: "on demand", scheduler: "ready" } },
      { code: "MERIDIAN", name: "MERIDIAN", role: "a technikai SEO-szakértő", roleEn: "the technical SEO expert", slug: "genmarketer-seo-technical", status: "live",
        benefit: "Kijavítja az oldalad technikai hibáit, amik hátráltatják a rangsorolásodat. Oldalszintű technikai audit és AI-készültség: JSON-LD schema, llms.txt, AI-bot szabályok, Core Web Vitals és sitemap, generátorokkal. A Search Console és a Clarity connectorból mért adatokat használ, és külön jelzi, mi mért és mi becsült.",
        benefitEn: "Fixes the technical issues on your site that hold back your rankings: site-level technical audit and AI readiness (schema, llms.txt, bot rules, Core Web Vitals, sitemap), using measured Search Console and Clarity data.",
        currentTask: "a Core Web Vitals-t javítja…", currentTaskEn: "Fixing your Core Web Vitals…",
        metrics: [{ label: "javított hiba", labelEn: "fixed issue", target: 31 }, { label: "CWV", labelEn: "CWV", target: 98 }],
        proof: DM + "genmarketer-technikai-audit.html", spec: { pipeline: "audit → javítás → mérés", cadence: "igény szerint", scheduler: "folyamatos" },
        specEn: { pipeline: "audit → fix → measure", cadence: "on demand", scheduler: "continuous" } },
      { code: "VERITAS", name: "VERITAS", role: "a SEO-auditor", roleEn: "the SEO auditor", slug: "genmarketer-seo", status: "live",
        benefit: "Megmondja, miért nem talál meg a Google – és pontosan mit javíts az oldaladon. Oldalszintű SEO-audit a 2026-os valóságra: a klasszikus on-page elemzés mellett az AI-láthatóságot (GEO) is pontozza. Kettős Health Score: SEO /85 + AI-láthatóság /15.",
        benefitEn: "Tells you why Google can't find you – and exactly what to fix on your site: a page-level SEO audit for 2026 that also scores AI visibility (GEO).",
        currentTask: "az oldalad SEO-hibáit auditálja…", currentTaskEn: "Auditing your site's SEO issues…",
        metrics: [{ label: "hiba", labelEn: "issue", target: 23 }, { label: "javítás", labelEn: "fix", target: 18 }],
        proof: DM + "genmarketer-seo-strategia.html", spec: { pipeline: "bejárás → audit → teendők", cadence: "heti", scheduler: "folyamatos" },
        specEn: { pipeline: "crawl → audit → actions", cadence: "weekly", scheduler: "continuous" } },
      { code: "ARTEMISZ", name: "ARTEMISZ", role: "a helyi SEO-szakértő", roleEn: "the local SEO expert", slug: "genmarketer-seo-local", status: "live",
        benefit: "Felhozza a cégedet a helyi keresésben és a Google Térképen. Google Cégprofil, NAP-konzisztencia, értékelés-stratégia és helyi kulcsszavak, magyar piacra szabva: Budapest 23 kerületével és magyar forrásokkal (Arany Oldalak, Startlap, e-cégjegyzék, doklist.hu, szallas.hu…).",
        benefitEn: "Lifts your business in local search and on Google Maps: Business Profile, NAP consistency, review strategy and local keywords, tailored to the Hungarian market.",
        currentTask: "a Google Térképen emel feljebb…", currentTaskEn: "Lifting you on Google Maps…",
        metrics: [{ label: "helyi találat", labelEn: "local result", target: 27, suffix: "%↑" }, { label: "térkép-hely", labelEn: "map spot", target: 3 }],
        proof: null, spec: { pipeline: "GBP → idézet → értékelés", cadence: "heti", scheduler: "folyamatos" },
        specEn: { pipeline: "GBP → citation → review", cadence: "weekly", scheduler: "continuous" } }
    ]},
    { cat: "Social media", catEn: "Social media", color: "#E1306C", members: [
      { code: "FIGARO", name: "FIGARO", role: "a LinkedIn-specialista", roleEn: "the LinkedIn specialist", slug: "genmarketer-linkedin-expert", status: "live",
        benefit: "Felépíti a LinkedIn-jelenléted és ügyfeleket hoz – a profiltól a posztokon át a kapcsolatfelvételig. Stratégiai és operatív tanácsadó 31 szakértő tudásából, valódi elérés-adatokon (Richard van der Blom algoritmus-riportja), beépített fiókbiztonsági korlátokkal.",
        benefitEn: "Builds your LinkedIn presence and brings clients – from profile to posts to outreach, drawing on 31 experts and real reach data, with built-in account-safety limits.",
        currentTask: "a LinkedIn-profilodat írja újra…", currentTaskEn: "Rewriting your LinkedIn profile…",
        metrics: [{ label: "poszt-ötlet", labelEn: "post idea", target: 12 }, { label: "elérés", labelEn: "reach", target: 41, suffix: "%↑" }],
        proof: DM + "genmarketer-linkedin-muhely.html", spec: { pipeline: "profil → tartalom → megkeresés", cadence: "heti", scheduler: "folyamatos" },
        specEn: { pipeline: "profile → content → outreach", cadence: "weekly", scheduler: "continuous" } },
      { code: "FAMA", name: "FAMA", role: "a social-tervező", roleEn: "the social planner", slug: "genmarketer-social-content", status: "live",
        benefit: "Rendszert visz az organikus posztolásba: tartalompilléreket, havi naptárt és kész posztvázakat ad, kitalált sikersztorik és hamis sürgetés nélkül, hogy a jelenléted rendszeres legyen és az ajánlatodhoz vezessen.",
        benefitEn: "Brings system to organic posting: content pillars, a monthly calendar and ready post skeletons, without invented success stories or fake urgency.",
        currentTask: "a havi tartalomnaptárat rakja össze…", currentTaskEn: "Building the monthly content calendar…",
        metrics: [{ label: "pillér", labelEn: "pillar", target: 4 }, { label: "posztváz", labelEn: "post skeleton", target: 20 }],
        proof: null, spec: { pipeline: "pillérek → naptár → poszt", cadence: "havi", scheduler: "folyamatos" },
        specEn: { pipeline: "pillars → calendar → post", cadence: "monthly", scheduler: "continuous" } },
      { code: "OVIDIUS", name: "OVIDIUS", role: "a tartalom-újrahasznosító", roleEn: "the content repurposer", slug: "genmarketer-content-repurposer", status: "live",
        benefit: "Egy jó anyagból sokat csinál: a webináriumodból, podcastodból vagy blogcikkedből hírlevél-, poszt-, blog- és rövidvideó-piszkozatokat készít, a forrás tényeinek pontos megtartásával.",
        benefitEn: "Makes many pieces from one good one: newsletter, post, blog and short-video drafts from your webinar, podcast or article, keeping the source facts intact.",
        currentTask: "egy webináriumból tartalmi atomokat bont…", currentTaskEn: "Breaking a webinar into content atoms…",
        metrics: [{ label: "tartalmi atom", labelEn: "content atom", target: 18 }, { label: "csatorna", labelEn: "channel", target: 5 }],
        proof: null, spec: { pipeline: "alapanyag → tartalmi atomok → csatornacsomag", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "source → content atoms → channel pack", cadence: "on demand", scheduler: "ready" } }
    ]},
    { cat: "Ügyfélkapcsolat és bevétel", catEn: "Customer & revenue", color: "#0A66C2", members: [
      { code: "HERMESZ", name: "HERMÉSZ", role: "az e-mail-szakértő", roleEn: "the email expert", slug: "genmarketer-email-marketing-expert", status: "live",
        benefit: "Megírja az e-mail-sorozataidat, amik eladnak helyetted – akkor is, amikor alszol. E-mail-írás, sorozat-tervezés, elemzés és stratégia 21 szakértő tudásából, három különleges modullal: jelentéshű szerkesztés, saját írásstílus betanítása, magyar nyelvi pontosság. A MailerLite vagy a SalesAutopilot connectorral a fiókodban is dolgozik.",
        benefitEn: "Writes your email sequences that sell for you – even while you sleep: writing, sequence design, analysis and strategy from 21 experts, working inside your MailerLite or SalesAutopilot account through the connector.",
        currentTask: "e-mail-sorozatot fűz össze…", currentTaskEn: "Assembling an email sequence…",
        metrics: [{ label: "e-mail", labelEn: "email", target: 8 }, { label: "megnyitás", labelEn: "open rate", target: 41, suffix: "%" }],
        proof: DM + "genmarketer-mailerlite-chat.html", spec: { pipeline: "tárgysor → szekvencia → ütemezés", cadence: "automata", scheduler: "folyamatos" },
        specEn: { pipeline: "subject → sequence → schedule", cadence: "automated", scheduler: "continuous" } },
      { code: "PERPETUUM", name: "PERPETUUM", role: "az előfizetés-szakértő", roleEn: "the membership expert", slug: "genmarketer-membership-expert", status: "live",
        benefit: "Felépíti neked a visszatérő bevételt, hogy ne kelljen minden hónapban nulláról indulnod. Stratégiai tanácsadó tagsági, előfizetéses és visszatérő bevételű modellekhez: 128 videó szintézise Stu McLaren és 40+ vendégszakértő tudásából.",
        benefitEn: "Builds your recurring revenue so you don't start from zero every month: strategic advisor for membership and subscription models, synthesised from 128 videos by Stu McLaren and 40+ guest experts.",
        currentTask: "visszatérő bevételi modellt tervez…", currentTaskEn: "Designing your recurring-revenue model…",
        metrics: [{ label: "havi bevétel", labelEn: "monthly rev.", target: 24, suffix: "%↑" }, { label: "lemorzsolódás", labelEn: "churn", target: 8, suffix: "%↓" }],
        proof: DM + "genmarketer-elofizetes.html", spec: { pipeline: "ajánlat → tagság → megtartás", cadence: "havi", scheduler: "folyamatos" },
        specEn: { pipeline: "offer → membership → retention", cadence: "monthly", scheduler: "continuous" } },
      { code: "ACCESSUS", name: "ACCESSUS", role: "a leadgyűjtő specialista", roleEn: "the lead generation specialist", slug: "genmarketer-lead-magnet-context", status: "live",
        benefit: "Megtervezi, hogyan gyűjts érdeklődőket: csalit (lead magnetet), webináriumot vagy kihívást, és az egész launch menetrendjét a regisztrációtól az ajánlat zárásáig. Az ő kontextusából a hirdetés, a landoló és az e-mail ugyanazt ígéri.",
        benefitEn: "Plans how you collect leads: the lead magnet, webinar or challenge, and the whole launch schedule from registration to closing the offer, so ads, landing page and emails promise the same thing.",
        currentTask: "a csali és a launch menetrendjét tervezi…", currentTaskEn: "Planning the lead magnet and launch schedule…",
        metrics: [{ label: "csali", labelEn: "lead magnet", target: 1 }, { label: "launch-lépés", labelEn: "launch step", target: 7 }],
        proof: null, spec: { pipeline: "csali → naptár → utánkövetés", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "lead magnet → calendar → follow-up", cadence: "on demand", scheduler: "ready" } }
    ]},
    { cat: "Mérés és minőség", catEn: "Measurement & quality", color: "#2BE38B", members: [
      { code: "ETALON", name: "ETALON", role: "a mérési rendszerőr", roleEn: "the measurement guardian", slug: "genmarketer-conversion-tracking-engine", status: "live",
        benefit: "Mielőtt a számok alapján döntesz, megnézi, hogy a mérésed egyáltalán igazat mond-e: GA4, Google Tag Manager, Consent Mode és Meta Conversions API, eseményről eseményre. Ha a Meta és a GA4 mást mutat, kideríti, miért.",
        benefitEn: "Before you decide on the numbers, checks whether your measurement tells the truth: GA4, Google Tag Manager, Consent Mode and Meta Conversions API, event by event.",
        currentTask: "az eseménytérképedet ellenőrzi…", currentTaskEn: "Checking your event map…",
        metrics: [{ label: "esemény", labelEn: "event", target: 14 }, { label: "mérési hiba", labelEn: "tracking issue", target: 3 }],
        proof: null, spec: { pipeline: "eseménytérkép → kockázat → javítás", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "event map → risk → fix", cadence: "on demand", scheduler: "ready" } },
      { code: "PURITAS", name: "PURITAS", role: "a magyar szövegellenőr", roleEn: "the Hungarian copy editor", slug: "genmarketer-hu-copy-qa", status: "live",
        benefit: "Publikálás előtt átnézi a magyar szövegeidet: helyesírás, központozás, tegezés vagy magázás, anglicizmusok, természetesség. Úgy javít, hogy a számok, az ajánlat feltételei és a linkek érintetlenek maradjanak.",
        benefitEn: "Reviews your Hungarian copy before publishing: spelling, punctuation, formal or informal address, anglicisms and natural flow, leaving numbers, offer terms and links untouched.",
        currentTask: "a kiadás előtti szöveget ellenőrzi…", currentTaskEn: "Checking copy before release…",
        metrics: [{ label: "javítás", labelEn: "fix", target: 11 }, { label: "tény érintetlen", labelEn: "facts intact", target: 100, suffix: "%" }],
        proof: null, spec: { pipeline: "audit → javítás → kiadás", cadence: "igény szerint", scheduler: "készen áll" },
        specEn: { pipeline: "audit → fix → release", cadence: "on demand", scheduler: "ready" } }
    ]}
  ];

  window.GM_AGENTS = window.GM_TEAM.reduce(function (acc, g) {
    g.members.forEach(function (m) { acc.push(Object.assign({ cat: g.cat, catEn: g.catEn, color: g.color }, m)); });
    return acc;
  }, []);

  /* 2026-08-31: tíz terület : a Munkaállomás-blokk (#use-casek) fülrendje az irányadó.
     Az első terület az elsődleges (kártyaszín), a többi a szűrőben jeleníti meg a tagot.
     A hozzárendelés 1:1 a munkaállomás-fülek csapatsoraival. */
  var GM_AREA_COLORS = { "Meta Ads": "#00D4FF", "Google Ads": "#FFC400", "Email": "#0A66C2", "SEO": "#00AACC", "Weboldal": "#06B6D4", "Social": "#E1306C", "Design": "#9B6DFF", "Videó": "#400099", "Versenytárs": "#7C3AED", "Stratégia": "#F5A623" };
  var GM_AREA_EN = { "Meta Ads": "Meta Ads", "Google Ads": "Google Ads", "Email": "Email", "SEO": "SEO", "Weboldal": "Website", "Social": "Social", "Design": "Design", "Videó": "Video", "Versenytárs": "Competitors", "Stratégia": "Strategy" };
  var GM_AREAS10 = {
    "ATLASZ": ["Stratégia"], "ATHENE": ["Stratégia"], "PERPETUUM": ["Stratégia"],
    "SHERLOCK": ["Stratégia", "Versenytárs"], "SUN-TZU": ["Versenytárs"],
    "IDENTITAS": ["Stratégia", "Social"], "VALOR": ["Stratégia"], "INCRESCO": ["Stratégia", "Meta Ads", "Google Ads"], "PARCITAS": ["Stratégia"],
    "AURORA": ["Meta Ads"], "KEPLER": ["Meta Ads"], "CYRANO": ["Meta Ads", "Google Ads"],
    "APOLLON": ["Google Ads"], "BREVIA": ["Social", "Meta Ads"],
    "HERMESZ": ["Email"], "ACCESSUS": ["Email", "Stratégia"],
    "KOLUMBUSZ": ["SEO", "Google Ads"], "PARETO": ["SEO", "Social"], "MERIDIAN": ["SEO", "Versenytárs"], "VERITAS": ["SEO"], "ARTEMISZ": ["SEO"],
    "MIDASZ": ["Weboldal"], "ARGUSZ": ["Weboldal", "Design"], "ROBINSON": ["Weboldal"], "NEXUS": ["Weboldal"], "SENTRY": ["Weboldal"],
    "MATISSE": ["Design", "Weboldal"], "LEONARDO": ["Design", "Meta Ads", "Social"], "VECTOR": ["Design"],
    "FIGARO": ["Social"], "FAMA": ["Social"], "OVIDIUS": ["Social", "Email"],
    "SEHEREZADE": ["Videó"], "LUMIERE": ["Videó"], "KRONOSZ": ["Videó"], "GUTENBERG": ["Videó"],
    "ETALON": ["Meta Ads", "Google Ads", "Weboldal"], "PURITAS": ["Email", "Weboldal", "Social"]
  };
  /* ---- Szakember-adatlap (2026-10-02): „Miben segít?" + „Milyen tudás van mögötte?" ----
     A számok a skill SAJÁT forrásából jönnek (_dev/skill-hub-build/src/<slug>/SKILL.md,
     README, experts/ és transcripts/ mappák), illetve a Tudástár 2.0 csapattag-oldalainak
     „Kiktől tanult" blokkjából (2026-11-01). Ahol a skill módszertanra / saját adatodra épül,
     nem videókorpuszra, ott `basis` áll szakértőszám helyett : szándékosan nem találunk ki számot.
     experts + sources → „X szakértő Y anyagából táplálkozik"; basis → saját mondat. */
  var GM_PROFILE = {
    "ATLASZ": { basis: "A teljes, 38 fős csapat tudását fogja össze", help: ["Pár kérdésből megismeri a cégedet, és elmenti az üzleti profilodat", "Minden kérést a megfelelő szakemberhez irányít", "Az első napon kész anyagot és 14 napos tervet ad"], topics: ["üzleti profil", "feladat-elosztás", "14 napos indulási terv", "a csapat összehangolása"] },
    "ATHENE": { experts: 9, sources: "tudásából (Hormozi, Brunson, Godin és társaik)", help: ["Átnézi az ajánlatodat és az árazásodat", "Stratégiai kérdésben több nézőpontból ad tanácsot", "Rangsorolja, mibe érdemes először energiát tenni"], topics: ["ajánlatépítés", "árazás és pozicionálás", "értékesítési tölcsér", "növekedési stratégia"] },
    "SHERLOCK": { experts: 12, sources: "236 videójából", help: ["Megrajzolja az ideális vevőd profilját", "Kigyűjti a vevőid valódi fájdalmait és szavait", "Vevőperszónákat és üzenet-irányokat ad"], topics: ["ideális vevőprofil (ICP)", "vevőperszónák", "vevői hang (VOC) kutatás", "Jobs-to-be-Done elemzés"] },
    "SUN-TZU": { basis: "Nyilvános adatforrásokra épül (Meta hirdetéstár, weboldalak, vélemények)", help: ["Feltérképezi a versenytársaidat és a futó hirdetéseiket", "Figyeli az áraikat és a weboldaluk változásait", "A rájuk írt panaszokból pozicionálási ötletet ad"], topics: ["versenytárs-hirdetések", "ár- és weboldal-figyelés", "vélemény-bányászat", "heti versenytárs-jelentés"] },
    "IDENTITAS": { basis: "Kizárólag a te valós anyagaidból (szövegek, interjúk, vélemények) épít márkakeretet", help: ["Forrásjelölt sztoribankot készít a szétszórt anyagaidból", "Pozicionáló mondatot és 3–7 megkülönböztető érvet ad", "Nyolcdimenziós márkahang-profilt mér a meglévő szövegeidből"], topics: ["sztoribank és alapítói történet", "pozicionálás és brand-USP", "márkahang-profil", "szótár és tiltólista"] },
    "VALOR": { basis: "Az ajánlatépítés és az ügyfélajánlat-írás saját, bizonyítékhoz kötött munkafolyamatára épül", help: ["Egy mondatban kimondja, kinek és milyen kimenetet adsz", "Értékelemeket, bónuszt és betartható garanciát rak az ajánlat mellé", "Audit-leletekből döntésre kész ügyfélajánlatot ír"], topics: ["értékelemek és értékegyenlet", "árazási logika", "garancia és kockázatcsökkentés", "ajánlatdokumentum"] },
    "INCRESCO": { basis: "A mért tényt mindig elválasztja a feltételezéstől, és minden javaslatot bizonyítékhoz köt", help: ["Heti vezetői riportot ír KPI-táblával és három következő lépéssel", "Kinyomozza, miért esett egy mutató", "Lépésenként megmutatja, hol szivárog a tölcsér"], topics: ["vezetői KPI-riport", "KPI-anomália és mérési műtermék", "tölcsérdiagnózis", "gazdaságossági elővizsgálat"] },
    "PARCITAS": { basis: "A Claude és a ChatGPT napi marketinges használatából leszűrt költség-optimalizálásra épül", help: ["Kiinduló mérést ad egy ismétlődő AI-folyamatról", "Megtalálja a három legnagyobb pazarlást", "Minőségi kapuhoz kötött modellválasztást javasol"], topics: ["AI-költség mérése", "kontextus karcsúsítása", "modellválasztás", "munkamenet-helyreállítás"] },
    "KEPLER": { experts: 14, sources: "131 anyagából", help: ["Változatos hirdetési koncepciókat talál ki", "Szögeket, formátumokat és hookokat párosít", "Tesztelhető mini briefeket ad a kreatívokhoz"], topics: ["tudatossági szintek", "48 hirdetésformátum", "hookok és szögek", "kreatív tesztelés"] },
    "CYRANO": { experts: 17, sources: "250+ videójából", help: ["Hirdetésszövegeket ír Metára, Google-re, LinkedInre", "Több hangnemben és hosszban, tesztelhető készletben", "Elemzi és javítja a meglévő szövegeidet"], topics: ["hookok és főcímek", "platformspecifikus szöveg", "meggyőzési keretek", "AI-szagtalan magyar szöveg"] },
    "AURORA": { experts: 6, sources: "370 videójából", help: ["Átvilágítja a Meta-hirdetési fiókodat", "Megmondja, mi viszi a pénzt és mit cserélj", "A bekötött fiókodban kampányt is épít"], topics: ["kampánystruktúra", "Advantage+ és Andromeda", "kreatív stratégia", "büdzsé és skálázás"] },
    "APOLLON": { experts: 8, sources: "117 videójából", help: ["Átvilágítja a Google Ads-fiókodat", "Kampánystruktúrát és ajánlati stratégiát tervez", "A bekötött fiókodban kampányt épít és optimalizál"], topics: ["Search és Performance Max", "kulcsszóstratégia", "ajánlattételi stratégia", "konverziómérés"] },
    "BREVIA": { basis: "A TikTok hirdetési rendszerének aktuális működésére és a mérés-először elvre épül", help: ["Kampánybriefet ír egyetlen optimalizálási eseménnyel és megállási szabállyal", "Költés előtt ellenőrzi a Pixel és az Events API mérését", "9:16-os kreatívteszt-kártyákat és Spark Ads ellenőrzőlistát ad"], topics: ["TikTok kampányarchitektúra", "Pixel és Events API", "Smart+ és Spark Ads", "kreatívteszt és skálázás"] },
    "MIDASZ": { experts: 11, sources: "1100+ anyagából", help: ["Szekciónként megtervezi a landolóoldaladat", "Kész szöveget ír: headline, ajánlat, bizonyíték, CTA", "Átvilágítja a meglévő oldalad konverzióját"], topics: ["konverzióoptimalizálás (CRO)", "ajánlat és értékajánlat", "headline és CTA", "A/B tesztelés"] },
    "ARGUSZ": { experts: 3, sources: "265 videójából (Flux Academy, DesignCourse, Refactoring UI)", help: ["Publikálás előtt rangsorolt design-hibalistát ad", "Megmondja, mitől hat AI-generáltnak az oldalad", "2–3 eltérő vizuális irányt tervez, amiből választasz"], topics: ["vizuális hierarchia és tipográfia", "szín és kontraszt", "landoló-szekciók dramaturgiája", "átadó-jegyzék a kivitelezőnek"] },
    "ROBINSON": { basis: "Bevált build-, ellenőrzési és visszaállítási folyamatra épül", help: ["A kész tervből működő oldalt épít", "Kiválasztja a neked megfelelő technikát (HTML, Elementor, saját)", "Élesítés előtt végigellenőrzi az oldalt"], topics: ["oldalépítés", "technikaválasztás", "minőségellenőrzés", "biztonságos élesítés"] },
    "LEONARDO": { experts: 8, sources: "280+ anyagából", help: ["Hirdetési kreatívokat tervez és véleményez", "Egy termékképből sok hirdetésváltozatot gyárt", "Megmondja, miért nem állítja meg a görgetést egy kép"], topics: ["vizuális hierarchia", "görgetésmegállító design", "platformspecifikus kreatív", "márkaarculat"] },
    "MATISSE": { basis: "A Figma hivatalos eszközeire és a márkád üzleti profiljára épül", help: ["Figmában wireframe-et és kész designt készít", "Hirdetés- és social makettet tervez", "Gyorsan kiolvas és összefoglal meglévő Figma-fájlokat"], topics: ["landolóoldal-wireframe", "hirdetésmakett", "design system", "márkakonzisztencia"] },
    "NEXUS": { basis: "A Figma hivatalos fejlesztői kapcsolatára épül", help: ["A Figma-tervből működő kódot készít", "Átveszi a pontos méreteket, színeket, betűket", "Előkészíti az oldalt a fejlesztéshez"], topics: ["Figma → kód", "pixelpontos átvétel", "komponensek", "reszponzív elrendezés"] },
    "SENTRY": { basis: "A leggyakoribb, AI okozta Figma-hibák ellenőrzőlistájára épül", help: ["Átnézi a kész Figma-designt", "Kijavítja az elcsúszott elrendezést és a levágott szöveget", "Ellenőrzi a magyar ékezeteket"], topics: ["auto-layout hibák", "túlcsordulás és levágás", "igazítás", "ékezethelyesség"] },
    "VECTOR": { basis: "A platformok hivatalos méret- és biztonsági zónáira épül", help: ["Egy kész hirdetést minden képarányra újratördel", "Megtartja a szöveget betűre, ékezettel", "Figyel a Stories, Reels és TikTok biztonsági zónáira"], topics: ["1:1, 4:5, 9:16, 16:9", "platform-safe-zone", "szöveg-pontosság", "méretvariánsok"] },
    "SEHEREZADE": { experts: 20, sources: "129 videójából", help: ["Rövid videó- és hirdetésscripteket ír", "Hookokat generál és értékel", "Egy meglévő videóból sablont fejt vissza a termékedre"], topics: ["Reels, TikTok, Shorts", "hookok és megtartás", "UGC-scriptek", "kreatív tesztelés"] },
    "LUMIERE": { basis: "Bevált UGC-formulára és vezető videómodellekre épül", help: ["UGC-stílusú termékvideót készít", "AI-influencer karakterlapot és képeket gyárt", "Termék-a-kézben képeket készít hirdetéshez"], topics: ["UGC termékvideó", "AI-influencer", "termékbemutató", "videómodellek"] },
    "KRONOSZ": { basis: "Beszélgetés-vezérelt vágási folyamatra épül", help: ["Nyersanyagból kész MP4-et vág", "Feliratot éget, és animációkat tesz rá", "Színkorrekciót és ritmust ad a videónak"], topics: ["vágás szóhatáron", "égetett felirat", "motion graphics", "színkorrekció"] },
    "GUTENBERG": { basis: "Vezető AI-videómodellek (Seedance, Kling) promptolási módszerére és reklámrendezői receptre épül", help: ["Többjelenetes termékvideót és márkafilmet tervez", "Jelenetenként referenciát és pontos promptot ír", "Költségkapuval renderel: előbb olcsó vázlat, jóváhagyás után végleges"], topics: ["többjelenetes videó", "jelenetterv és folytonosság", "képből videó", "renderelés jóváhagyással"] },
    "KOLUMBUSZ": { basis: "A saját Search Console-adataidra és a keresési találatok elemzésére épül", help: ["Kulcsszó- és keresési szándék-kutatást végez", "Megmutatja, hol előznek meg a versenytársak", "Tartalomtervet ad a kutatásból"], topics: ["kulcsszókutatás", "keresési szándék", "versenytárs-rések", "AI-keresők (GEO)"] },
    "PARETO": { basis: "A saját Search Console-adataidra és a Google irányelveire épül", help: ["Rangsorolásra kész cikket ír", "Frissíti és pontozza a meglévő tartalmaidat", "Google-re és AI-keresőkre is optimalizál"], topics: ["SEO-cikkírás", "tartalomfrissítés", "tartalom-pontozás", "GEO-optimalizálás"] },
    "MERIDIAN": { basis: "A Google irányelveire és a saját méréseidre épül", help: ["Technikai SEO-auditot végez", "Strukturált adatot (schema) és llms.txt-t készít", "Átnézi a sebességet és a belső linkelést"], topics: ["schema markup", "Core Web Vitals", "belső linkelés", "AI-botok kezelése"] },
    "VERITAS": { basis: "A saját Search Console-adataidra és a Google irányelveire épül", help: ["Oldalanként teljes SEO-auditot végez", "Ellenőrzi a szakértői hitelességet (E-E-A-T)", "Megmutatja a tartalmi réseket"], topics: ["on-page SEO", "E-E-A-T", "AI-láthatóság", "tartalmi rések"] },
    "ARTEMISZ": { basis: "A Google Cégprofil és a helyi keresés irányelveire épül", help: ["Optimalizálja a Google Cégprofilodat", "Helyi kulcsszókutatást végez", "Véleménygyűjtési stratégiát ad"], topics: ["Google Cégprofil", "helyi kulcsszavak", "NAP-egyezés", "vélemény-stratégia"] },
    "FIGARO": { experts: 31, sources: "520 videójából", help: ["Optimalizálja a LinkedIn-profilodat", "Posztokat ír a te hangodon", "Tartalom- és megkeresési stratégiát ad"], topics: ["profiloptimalizálás", "személyes márka", "hookok és formátumok", "LinkedIn-algoritmus"] },
    "FAMA": { basis: "Az organikus tartalomtervezés saját rendszerére épül, bizonyítékhoz kötött posztokkal", help: ["3–5 tartalompillért köt az ajánlatodhoz", "Heti vagy havi naptárt ad fenntartható ritmussal", "Platformonként posztvázat ír horoggal, törzzsel, CTA-val"], topics: ["tartalompillérek", "social naptár", "formátummix és CTA-arány", "bizonyíték- és sürgetési kapuk"] },
    "OVIDIUS": { basis: "Egyetlen ellenőrzött alapanyagból rendszerezetten készít több csatornára anyagot", help: ["Webináriumból kulcsállításokat és idézeteket térképez", "Podcastból social- és e-mail-piszkozatot készít", "Blogcikkből posztot és rövidvideó-vázlatot ír"], topics: ["pillértartalom", "leirat-ellenőrzés", "tartalmi atomok", "csatorna-leképezés"] },
    "HERMESZ": { experts: 21, sources: "100+ anyagából", help: ["E-mail-stratégiát és levélsorozatot tervez", "AI-szagtalan, eladó leveleket ír", "A bekötött MailerLite-fiókodban fel is építi a sorozatot"], topics: ["üdvözlő és nurture-sorozat", "tárgysorok", "kézbesíthetőség", "automatizálás"] },
    "PERPETUUM": { basis: "Stu McLaren és 40+ vendégszakértő 128 videójából táplálkozik", help: ["Előfizetéses vagy tagsági modellt tervez", "Csökkenti a lemorzsolódást", "Onboardingot és tartalomütemet ad"], topics: ["előfizetéses árazás", "lemorzsolódás (churn)", "tag-onboarding", "közösségépítés"] },
    "ACCESSUS": { basis: "A lead magnetek és a webinár-launchok tervezésének saját sablonrendszerére épül", help: ["Kimondja a csali ígéretét, célcsoportját és hídját a fő termékhez", "Dátumozott launch-menetrendet ad a regisztrációtól a zárásig", "Launch-diagnózist ad, ha kevés a megjelenés vagy a bevétel"], topics: ["lead magnet és csali-kontextus", "hétfázisú launch-naptár", "regisztráció és megjelenés", "e-mail-szekvencia-terv"] },
    "ETALON": { basis: "A magyar webshopplatformok (WooCommerce, UNAS, Shoprenter) mérési receptjeire épül", help: ["Eseménytérképet és kockázatlistát ad a mérésedről", "Kivizsgálja, miért tér el a Meta és a GA4", "Prioritásos javítási listát ad a fejlesztődnek"], topics: ["GA4 kulcsesemények és GTM", "Consent Mode v2", "Meta CAPI és deduplikáció", "platformreceptek"] },
    "PURITAS": { basis: "A magyar nyelvhelyesség és a marketingszöveg-minőség szabályaira épül", help: ["Publikálás előtt leletlistát ad súlyossággal", "Javított teljes szöveget ad a védett tények megőrzésével", "Kiszűri a tükörfordításokat és az anglicizmusokat"], topics: ["helyesírás és központozás", "magyar tipográfia", "tegezés vagy magázás", "márkahangra igazítás"] }
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
