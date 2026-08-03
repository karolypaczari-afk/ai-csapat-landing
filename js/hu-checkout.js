/**
 * Magyar pénztár — ai-csapat.genmarketer.hu/checkout/
 *
 * A fizetési folyamat felépítése:
 *
 *   1. Betöltéskor a saját endpointunktól kérünk egy PaymentIntentet. Az küldi
 *      vissza a client secretet és a publishable kulcsot, tehát ebben a fájlban
 *      nincs Stripe-kulcs, és egy kulcsrotáció nem igényel frontend-deployt.
 *   2. Két Stripe-elem mountolódik ugyanarra az intentre:
 *        - Express Checkout Element  — Apple Pay / Google Pay / Link gombok
 *        - Payment Element           — kártya
 *      A Stripe elrejti a walleteket a Payment Elementből, ha mindkettő jelen
 *      van, így a vevő sosem látja kétszer az Apple Payt.
 *   3. A csomagváltás és a bump ugyanazt az intentet FRISSÍTI, nem újat csinál.
 *      Egy fizetési kísérlet = egy intent — ettől lesz értelme a webhook
 *      idempotenciájának.
 *   4. Árat soha nem küldünk a szervernek. A böngésző csomagot kér; hogy az
 *      mennyibe kerül, azt a szerver dönti el.
 *
 * ── Előnézeti mód ───────────────────────────────────────────────────────────
 * Amíg a pénztár nincs élesítve, a szerver 409-cel válaszol a
 * `checkout_not_open` kóddal. Ilyenkor NEM hibát mutatunk: az oldal teljesen
 * végigböngészhető marad, csak a fizetés helyén áll egy előnézeti sáv. Így a
 * kész pénztár élesben megnézhető anélkül, hogy bárki fizetni tudna.
 */
(function () {
  'use strict';

  var API = '/api/hu-create-intent.php';
  var LEAD_API = '/api/hu-capture-lead.php';
  var RETURN_URL = 'https://ai-csapat.genmarketer.hu/koszonjuk/';
  var GA4_ID = 'G-1EV18K1256';

  // Forintban. A szerver fillérben dolgozik (×100) — itt csak megjelenítünk.
  var PRICES = { kepzes: 34990, konzultacio: 119990 };
  var BUMP_PRICE = 29990;
  var PLAN_LABEL = {
    kepzes: 'Az AI csapatod – Képzés',
    konzultacio: 'Az AI csapatod – Képzés + Konzultáció'
  };

  // Magyar vevőknek: HU elöl, utána a többi EU-tagállam magyar névvel,
  // ábécésorrendben — a határon túli magyar vevő is megtalálja magát.
  var COUNTRIES = [
    ['HU', 'Magyarország'],
    ['AT', 'Ausztria'], ['BE', 'Belgium'], ['BG', 'Bulgária'], ['CY', 'Ciprus'],
    ['CZ', 'Csehország'], ['DK', 'Dánia'], ['EE', 'Észtország'], ['FI', 'Finnország'],
    ['FR', 'Franciaország'], ['GR', 'Görögország'], ['NL', 'Hollandia'], ['HR', 'Horvátország'],
    ['IE', 'Írország'], ['PL', 'Lengyelország'], ['LV', 'Lettország'], ['LT', 'Litvánia'],
    ['LU', 'Luxemburg'], ['MT', 'Málta'], ['DE', 'Németország'], ['IT', 'Olaszország'],
    ['PT', 'Portugália'], ['RO', 'Románia'], ['ES', 'Spanyolország'], ['SE', 'Svédország'],
    ['SK', 'Szlovákia'], ['SI', 'Szlovénia']
  ];

  /** Erre a látogatásra állandó, hogy az e-mail kétszeri elkapása EGY sort frissítsen. */
  function sessionId() {
    try {
      var k = 'gm_hu_sid';
      var v = window.sessionStorage.getItem(k);
      if (!v) {
        v = 'hu-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
        window.sessionStorage.setItem(k, v);
      }
      return v;
    } catch (e) {
      return 'hu-' + Date.now().toString(36);
    }
  }

  /**
   * Átadja az e-mailt a kosárelhagyó táblának, amint megvan.
   * Elküldjük és elfelejtjük: ez soha nem késleltetheti és nem blokkolhatja a pénztárat.
   */
  function captureLead() {
    var email = String(el.form.elements.email.value || '').trim();
    if (!email) return;
    try {
      fetch(LEAD_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          email: email,
          session_id: sessionId(),
          plan: state.plan,
          bump: state.bump,
          first_name: String(el.form.elements.first_name.value || '').trim()
        })
      }).catch(function () {});
    } catch (e) {}
  }

  var state = {
    plan: 'kepzes',
    bump: false,
    paymentIntentId: '',
    clientSecret: '',
    stripe: null,
    elements: null,
    paymentElement: null,
    expressElement: null,
    busy: false,
    updateSeq: 0,
    step: 1,
    paymentMounted: false,
    coupon: null,
    preview: false
  };

  var el = {};

  // ── Segédek ───────────────────────────────────────────────────────────────

  function $(id) { return document.getElementById(id); }

  /** „69 990 Ft" — nem törhető szóközzel, ahogy a magyar helyesírás kívánja. */
  function money(v) {
    return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Ft';
  }

  function subtotal() {
    return PRICES[state.plan] + (state.bump ? BUMP_PRICE : 0);
  }

  function discount() {
    return state.coupon ? Math.round(state.coupon.discount_cent / 100) : 0;
  }

  function total() {
    return Math.max(1, subtotal() - discount());
  }

  function readForm() {
    var data = {};
    ['email', 'first_name', 'last_name', 'country', 'city', 'postcode', 'address', 'company', 'vat_number']
      .forEach(function (name) {
        var node = el.form.elements[name];
        if (node) data[name] = String(node.value || '').trim();
      });
    return data;
  }

  /**
   * Átviszi a kampányparamétereket a landolóról a fizetésbe, ahonnan a
   * WooCommerce-rendelésre kerülnek. Enélkül minden ilyen rendelés „Unknown"
   * lenne az analitikában — egy szerver-oldalon létrehozott rendelésnek nincs
   * böngésző-munkamenete, amiből a WooCommerce natív attribúciója olvasna.
   */
  function attribution() {
    var out = {};
    try {
      var qs = new URLSearchParams(window.location.search);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid'].forEach(function (k) {
        var v = qs.get(k);
        if (v) out[k] = v;
      });
      // Kiegészítés abból, amit a landoló eltárolt: a pénztár külön navigáció,
      // a paraméterek addigra általában eltűnnek.
      ['utm_source', 'utm_medium', 'utm_campaign', 'gclid'].forEach(function (k) {
        if (!out[k]) {
          var stored = window.localStorage.getItem('gm_' + k);
          if (stored) out[k] = stored;
        }
      });
      var fbc = cookie('_fbc'); if (fbc) out.fbc = fbc;
      var fbp = cookie('_fbp'); if (fbp) out.fbp = fbp;
      var ga = cookie('_ga');
      if (ga) {
        var parts = ga.split('.');
        if (parts.length >= 4) out.ga_client_id = parts[2] + '.' + parts[3];
      }
    } catch (e) { /* az attribúció legjobb szándékú; fizetést sosem blokkol */ }
    return out;
  }

  function cookie(name) {
    var m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return m ? m.pop() : '';
  }

  function track(event, extra) {
    var payload = Object.assign({
      currency: 'HUF',
      value: total(),
      items: [{ item_id: 'gm-hu-' + state.plan, item_name: PLAN_LABEL[state.plan], price: total(), quantity: 1 }]
    }, extra || {});
    try { if (typeof window.gtag === 'function') window.gtag('event', event, Object.assign({ send_to: GA4_ID }, payload)); } catch (e) {}
    try { window.dataLayer = window.dataLayer || []; window.dataLayer.push(Object.assign({ event: event }, payload)); } catch (e) {}
  }

  function showError(message) {
    el.error.textContent = message;
    el.error.classList.add('is-visible');
    el.error.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function clearError() {
    el.error.textContent = '';
    el.error.classList.remove('is-visible');
  }

  function setBusy(busy) {
    state.busy = busy;
    el.submit.disabled = busy;
    el.submit.classList.toggle('is-busy', busy);
    el.submitText.textContent = busy ? 'Feldolgozás…' : 'Megrendelem – ' + money(total());
  }

  /**
   * Előnézeti mód: a pénztár még nincs élesítve.
   *
   * Az oldal minden más része működik (csomagváltás, összegzés, kupon-mező
   * kivételével minden), csak fizetni nem lehet — mert a szerver el sem
   * indítja a fizetést. A sáv szándékosan feltűnő: ez egy belső előnézet.
   */
  function enterPreview() {
    state.preview = true;
    if (el.preview) el.preview.hidden = false;
    if (el.express) el.express.style.display = 'none';
    if (el.or) el.or.hidden = true;
    el.submit.disabled = true;
    el.submitText.textContent = 'A pénztár még nem indult el';
    var couponBtn = $('co-coupon-apply');
    if (couponBtn) couponBtn.disabled = true;
    var couponInput = $('co-coupon');
    if (couponInput) couponInput.disabled = true;
  }

  // ── Validálás ─────────────────────────────────────────────────────────────

  var REQUIRED = ['email', 'first_name', 'last_name', 'country', 'postcode', 'city', 'address'];

  function fieldWrap(name) {
    return el.form.querySelector('[data-field="' + name + '"]');
  }

  function validateField(name, silent) {
    var wrap = fieldWrap(name);
    if (!wrap) return true;
    var input = wrap.querySelector('input, select');
    var value = String(input.value || '').trim();
    var message = '';

    if (REQUIRED.indexOf(name) !== -1 && !value) {
      message = 'Ezt a mezőt töltsd ki.';
    } else if (name === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      message = 'Nézd meg még egyszer ezt az e-mail címet.';
    } else if (name === 'postcode' && value && String(el.form.elements.country.value) === 'HU' && !/^\d{4}$/.test(value)) {
      message = 'A magyar irányítószám négy számjegy.';
    } else if (name === 'vat_number' && value && String(el.form.elements.country.value) === 'HU'
               && !/^\d{8}-?\d-?\d{2}$/.test(value.replace(/\s/g, ''))) {
      message = 'A magyar adószám 11 számjegy (pl. 12345678-1-42).';
    }

    wrap.classList.toggle('is-error', !silent && !!message);
    wrap.classList.toggle('is-valid', !message && !!value);
    wrap.querySelector('[data-err]').textContent = silent ? '' : message;
    return !message;
  }

  function validateAll() {
    var ok = true;
    REQUIRED.forEach(function (name) { if (!validateField(name)) ok = false; });
    // Az adószám nem kötelező, de ha ki van töltve, legyen helyes.
    if (String(el.form.elements.vat_number.value || '').trim() && !validateField('vat_number')) ok = false;
    return ok;
  }

  // ── Összegzés ─────────────────────────────────────────────────────────────

  function renderSummary() {
    el.sumPlan.textContent = PLAN_LABEL[state.plan];
    el.sumPlanPrice.textContent = money(PRICES[state.plan]);
    el.sumBumpLine.classList.toggle('is-hidden', !state.bump);
    el.sumCouponLine.classList.toggle('is-hidden', !state.coupon);
    if (state.coupon) {
      el.sumCouponLabel.textContent = 'Kedvezmény (' + state.coupon.code + ')';
      el.sumCouponVal.textContent = '–' + money(discount());
    }
    el.sumTotal.textContent = money(total());
    if (!state.busy && !state.preview) el.submitText.textContent = 'Megrendelem – ' + money(total());
  }

  // ── PaymentIntent ─────────────────────────────────────────────────────────

  function requestIntent() {
    var body = Object.assign(
      {
        plan: state.plan,
        bump: state.bump,
        payment_intent_id: state.paymentIntentId,
        coupon: state.coupon ? state.coupon.code : ''
      },
      readForm(),
      attribution()
    );
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().then(function (json) {
        if (!res.ok) {
          var err = new Error((json && json.error && json.error.message) || 'A fizetést nem sikerült elindítani.');
          err.code = json && json.error && json.error.code;
          throw err;
        }
        return json;
      });
    });
  }

  /**
   * Újraárazza a meglévő intentet csomag- vagy bump-váltás után.
   *
   * Sorszámmal védve: a vevő gyorsabban kattintgat, mint ahogy a hálózat
   * válaszol, és egy sorrenden kívül érkező válasz elavult összeget hagyna
   * az elemeken.
   */
  function syncAmount() {
    if (!state.elements || state.preview) return;
    var seq = ++state.updateSeq;
    requestIntent()
      .then(function (data) {
        if (seq !== state.updateSeq) return;
        state.paymentIntentId = data.payment_intent_id || state.paymentIntentId;
        return state.elements.fetchUpdates();
      })
      .catch(function (err) {
        if (seq !== state.updateSeq) return;
        showError(err.message || 'A rendelést nem sikerült frissíteni. Töltsd újra az oldalt.');
      });
  }

  // ── Stripe ────────────────────────────────────────────────────────────────

  function appearance() {
    return {
      theme: 'stripe',
      variables: {
        colorPrimary: '#7C3AED',
        colorText: '#1A1A2E',
        colorDanger: '#C0392B',
        fontFamily: 'Inter, system-ui, sans-serif',
        borderRadius: '10px',
        spacingUnit: '4px'
      }
    };
  }

  function mountStripe(data) {
    state.stripe = window.Stripe(data.publishable_key);
    state.clientSecret = data.client_secret;
    state.paymentIntentId = data.payment_intent_id;

    state.elements = state.stripe.elements({
      clientSecret: state.clientSecret,
      appearance: appearance()
    });

    // --- Express Checkout (Apple Pay / Google Pay / Link) -------------------
    state.expressElement = state.elements.create('expressCheckout', {
      buttonTheme: { applePay: 'black', googlePay: 'black' },
      buttonHeight: 48,
      layout: { maxColumns: 2, overflow: 'never' }
    });

    // Az elválasztó csak akkor látszódjon, ha tényleg van elérhető wallet.
    // Egy üres doboz fölött a „vagy fizess kártyával" töröttnek néz ki.
    state.expressElement.on('ready', function (event) {
      var available = event && event.availablePaymentMethods;
      var hasWallet = available && Object.keys(available).some(function (k) { return available[k]; });
      el.or.hidden = !hasWallet;
      if (!hasWallet) el.express.style.display = 'none';
    });

    state.expressElement.on('click', function (event) {
      // A walletek ezeket adni tudják, és pont ez a lényeg: telefonon a vevő
      // egyszer koppint, és soha nem tölt ki űrlapot.
      event.resolve({
        emailRequired: true,
        billingAddressRequired: true,
        phoneNumberRequired: false,
        business: { name: 'GENmarketer' }
      });
    });

    state.expressElement.on('confirm', function (event) {
      handleExpressConfirm(event);
    });

    state.expressElement.mount('#co-express');

    // --- Payment Element (kártya) ------------------------------------------
    // Lustán mountoljuk, amikor a 3. lépés először megnyílik: a Stripe mountkor
    // méri a konténert, és egy rejtett konténernek nincs szélessége — abból
    // összecsuklott kártyamező lesz.
    track('begin_checkout');
  }

  // ── Megerősítés ───────────────────────────────────────────────────────────

  function billingDetailsFromForm() {
    var f = readForm();
    return {
      name: (f.first_name + ' ' + f.last_name).trim(),
      email: f.email,
      address: {
        line1: f.address,
        city: f.city,
        postal_code: f.postcode,
        country: f.country
      }
    };
  }

  /**
   * Wallet-fizetés. A vevő hozzá sem ért az űrlapunkhoz, tehát a név, az e-mail
   * és a cím a walletből jön — ezeket a megerősítés ELŐTT tesszük rá az
   * intentre, különben a rendelés vevőadatok nélkül érkezne.
   */
  function handleExpressConfirm(event) {
    clearError();

    var details = event.billingDetails || {};
    var address = details.address || {};
    var nameParts = String(details.name || '').trim().split(/\s+/);

    var form = el.form.elements;
    if (details.email && !form.email.value) form.email.value = details.email;
    // Magyar névsorrend: a wallet „Kovács János"-t ad, ahol az ELSŐ tag a
    // vezetéknév. Angolul fordítva. A wallet nem mondja meg, melyik szokás
    // szerint tárolták, ezért a magyar funnelben a magyar sorrendet vesszük —
    // és a vevő a 2. lépésen bármikor javíthatja.
    if (nameParts.length > 1) {
      if (!form.last_name.value) form.last_name.value = nameParts[0];
      if (!form.first_name.value) form.first_name.value = nameParts.slice(1).join(' ');
    } else if (nameParts.length === 1 && !form.first_name.value) {
      form.first_name.value = nameParts[0];
    }
    if (address.country && !form.country.value) form.country.value = address.country;
    if (address.city && !form.city.value) form.city.value = address.city;
    if (address.postal_code && !form.postcode.value) form.postcode.value = address.postal_code;
    if (address.line1 && !form.address.value) form.address.value = address.line1;

    track('add_payment_info', { payment_type: event.expressPaymentType || 'wallet' });

    requestIntent()
      .then(function () {
        return state.stripe.confirmPayment({
          elements: state.elements,
          clientSecret: state.clientSecret,
          confirmParams: { return_url: RETURN_URL },
          redirect: 'if_required'
        });
      })
      .then(function (result) {
        handleConfirmResult(result);
      })
      .catch(function (err) {
        showError(err.message || 'A fizetést nem sikerült befejezni. Kérlek, próbáld újra.');
      });
  }

  function handleConfirmResult(result) {
    if (result && result.error) {
      setBusy(false);
      // A card_error és a validation_error a vevőé, és használható üzenetet
      // hoz; minden más a miénk, és általános üzenetet kap.
      var e = result.error;
      showError(
        (e.type === 'card_error' || e.type === 'validation_error') && e.message
          ? e.message
          : 'Valami hiba történt a fizetés közben. Nem terheltünk meg — kérlek, próbáld újra.'
      );
      return;
    }
    // Nem volt átirányítás, tehát a fizetés itt sikerült. Magát a rendelést a
    // webhook hozza létre; ez az oldal csak továbbküldi a vevőt.
    var pi = result && result.paymentIntent;
    window.location.href = RETURN_URL + (pi ? '?payment_intent=' + encodeURIComponent(pi.id) : '');
  }

  function handleSubmit(ev) {
    ev.preventDefault();
    if (state.busy || state.preview) return;
    clearError();

    if (!validateAll()) {
      var firstBad = el.form.querySelector('.is-error input, .is-error select');
      if (firstBad) { firstBad.focus(); firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      return;
    }

    setBusy(true);
    track('add_payment_info', { payment_type: 'card' });

    requestIntent()
      .then(function () {
        return state.stripe.confirmPayment({
          elements: state.elements,
          clientSecret: state.clientSecret,
          confirmParams: {
            return_url: RETURN_URL,
            payment_method_data: { billing_details: billingDetailsFromForm() }
          },
          redirect: 'if_required'
        });
      })
      .then(handleConfirmResult)
      .catch(function (err) {
        setBusy(false);
        showError(err.message || 'A fizetést nem sikerült befejezni. Kérlek, próbáld újra.');
      });
  }

  // ── Lépések ───────────────────────────────────────────────────────────────

  var STEP_FIELDS = {
    1: ['email'],
    2: ['first_name', 'last_name', 'country', 'postcode', 'city', 'address'],
    3: []
  };

  function goToStep(n) {
    state.step = n;
    Array.prototype.forEach.call(el.form.querySelectorAll('[data-step]'), function (pane) {
      pane.hidden = Number(pane.getAttribute('data-step')) !== n;
    });
    Array.prototype.forEach.call(el.steps.children, function (item, i) {
      item.classList.toggle('is-current', i + 1 === n);
      item.classList.toggle('is-done', i + 1 < n);
    });
    if (el.stepsCount) el.stepsCount.textContent = n + '. lépés a 3-ból';

    if (n === 3 && state.elements && !state.paymentMounted) {
      state.paymentElement = state.elements.create('payment', {
        layout: { type: 'tabs', defaultCollapsed: false },
        // A walletek az 1. lépés Express elemében élnek; itt megismételve a
        // vevő kétszer látná ugyanazt a gombot.
        wallets: { applePay: 'never', googlePay: 'never' },
        fields: { billingDetails: { address: 'never', name: 'never', email: 'never' } }
      });
      state.paymentElement.mount('#co-payment');
      state.paymentMounted = true;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    track('checkout_progress', { checkout_step: n });
  }

  function validateStep(n) {
    var ok = true;
    (STEP_FIELDS[n] || []).forEach(function (name) { if (!validateField(name)) ok = false; });
    return ok;
  }

  function wireSteps() {
    Array.prototype.forEach.call(el.form.querySelectorAll('[data-next]'), function (btn) {
      btn.addEventListener('click', function () {
        var from = Number(btn.getAttribute('data-next')) - 1;
        if (!validateStep(from)) {
          var bad = el.form.querySelector('[data-step="' + from + '"] .is-error input, [data-step="' + from + '"] .is-error select');
          if (bad) { bad.focus(); bad.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
          return;
        }
        // Amink van, azt menet közben rátesszük a PaymentIntentre. Ha a vevő az
        // 1. lépés után elmegy, az e-maile már az intenten van, nem a füllel
        // együtt veszett el.
        if (!state.preview) requestIntent().catch(function () { /* haladást sosem blokkol */ });
        captureLead();
        goToStep(Number(btn.getAttribute('data-next')));
      });
    });

    Array.prototype.forEach.call(el.form.querySelectorAll('[data-back]'), function (btn) {
      btn.addEventListener('click', function () {
        goToStep(Number(btn.getAttribute('data-back')));
      });
    });

    // Az 1–2. lépésen az Enter továbbvigyen, ne küldjön be egy féligkész űrlapot.
    el.form.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' || state.step === 3) return;
      var tag = (ev.target.tagName || '').toLowerCase();
      if (tag !== 'input' && tag !== 'select') return;
      ev.preventDefault();
      var next = el.form.querySelector('[data-step="' + state.step + '"] [data-next]');
      if (next) next.click();
    });
  }

  // ── Kupon ─────────────────────────────────────────────────────────────────

  function applyCoupon() {
    var input = $('co-coupon');
    var msg = $('co-coupon-msg');
    var btn = $('co-coupon-apply');
    var code = String(input.value || '').trim();

    msg.textContent = '';
    msg.className = 'co-coupon__msg';
    if (!code) return;

    btn.disabled = true;
    btn.textContent = 'Ellenőrzés…';

    state.coupon = { code: code, discount_cent: 0 };
    requestIntent()
      .then(function (data) {
        var c = data.coupon || {};
        if (c.valid) {
          state.coupon = { code: c.code || code, discount_cent: c.discount_cent || 0 };
          msg.textContent = c.label ? c.label + ' beváltva.' : 'A kupon beváltva.';
          msg.className = 'co-coupon__msg is-ok';
          input.disabled = true;
          btn.textContent = 'Beváltva';
        } else {
          state.coupon = null;
          msg.textContent = c.reason || 'Ez a kód nem érvényes.';
          msg.className = 'co-coupon__msg is-bad';
          btn.disabled = false;
          btn.textContent = 'Beváltom';
        }
        renderSummary();
        return state.elements ? state.elements.fetchUpdates() : null;
      })
      .catch(function () {
        state.coupon = null;
        msg.textContent = 'Nem sikerült ellenőrizni ezt a kódot. Kérlek, próbáld újra.';
        msg.className = 'co-coupon__msg is-bad';
        btn.disabled = false;
        btn.textContent = 'Beváltom';
        renderSummary();
      });
  }

  function wireCoupon() {
    var btn = $('co-coupon-apply');
    if (!btn) return;
    btn.addEventListener('click', applyCoupon);
    $('co-coupon').addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); applyCoupon(); }
    });
  }

  // ── Bekötés ───────────────────────────────────────────────────────────────

  function fillCountries() {
    var select = el.form.elements.country;
    COUNTRIES.forEach(function (pair) {
      var option = document.createElement('option');
      option.value = pair[0];
      option.textContent = pair[1];
      select.appendChild(option);
    });
    // A magyar funnel magyar vevőknek szól — ne kelljen kiválasztani a
    // magától értetődőt.
    select.value = 'HU';
  }

  function wirePlans() {
    Array.prototype.forEach.call(el.form.querySelectorAll('.co-plan'), function (label) {
      label.addEventListener('click', function () {
        var plan = label.getAttribute('data-plan');
        if (plan === state.plan) return;
        state.plan = plan;
        label.querySelector('input').checked = true;
        Array.prototype.forEach.call(el.form.querySelectorAll('.co-plan'), function (other) {
          other.classList.toggle('is-active', other === label);
        });
        renderSummary();
        syncAmount();
        track('select_item');
      });
    });
  }

  function wireBump() {
    el.bump.addEventListener('change', function () {
      state.bump = el.bump.checked;
      renderSummary();
      syncAmount();
      track(state.bump ? 'add_to_cart' : 'remove_from_cart', {
        items: [{ item_id: 'gm-hu-bump', item_name: 'Extra konzultációs óra', price: BUMP_PRICE, quantity: 1 }]
      });
    });
  }

  function wireValidation() {
    REQUIRED.concat(['company', 'vat_number']).forEach(function (name) {
      var wrap = fieldWrap(name);
      if (!wrap) return;
      var input = wrap.querySelector('input, select');
      input.addEventListener('blur', function () { validateField(name); });
      input.addEventListener('input', function () {
        if (wrap.classList.contains('is-error')) validateField(name);
      });
    });
  }

  function init() {
    el.form = $('co-form');
    if (!el.form) return;

    el.express = $('co-express');
    el.or = $('co-or');
    el.bump = $('co-bump');
    el.submit = $('co-submit');
    el.submitText = $('co-submit-text');
    el.error = $('co-error');
    el.preview = $('co-preview');
    el.sumPlan = $('co-sum-plan');
    el.sumPlanPrice = $('co-sum-plan-price');
    el.sumBumpLine = $('co-sum-bump-line');
    el.sumTotal = $('co-sum-total');
    el.steps = $('co-steps');
    el.stepsCount = $('co-steps-count');
    el.sumCouponLine = $('co-sum-coupon-line');
    el.sumCouponLabel = $('co-sum-coupon-label');
    el.sumCouponVal = $('co-sum-coupon-val');

    fillCountries();
    wireSteps();
    wireCoupon();
    wirePlans();
    wireBump();
    wireValidation();
    renderSummary();

    // A csomag előre kiválasztható a landoló ártáblájából.
    try {
      var wanted = new URLSearchParams(window.location.search).get('csomag')
        || new URLSearchParams(window.location.search).get('plan');
      if (wanted && PRICES[wanted]) {
        var label = el.form.querySelector('.co-plan[data-plan="' + wanted + '"]');
        if (label) label.click();
      }
    } catch (e) {}

    el.form.addEventListener('submit', handleSubmit);

    // Utolsó esély a cím megőrzésére, ha félúton bezárja a fület.
    window.addEventListener('pagehide', function () {
      if (state.step > 1) captureLead();
    });

    el.submit.disabled = true;
    requestIntent()
      .then(function (data) {
        mountStripe(data);
        el.submit.disabled = false;
      })
      .catch(function (err) {
        // A „még nem indult el" NEM hiba: ez a normál, élesítés előtti állapot.
        if (err && err.code === 'checkout_not_open') {
          enterPreview();
          return;
        }
        showError(
          err.message ||
          'A pénztárat nem sikerült elindítani. Töltsd újra az oldalt, vagy írj az info@genmarketer.hu címre, és kézzel felvesszük a rendelésed.'
        );
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
