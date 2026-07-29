/**
 * English checkout — ai-csapat.genmarketer.hu/en/checkout/
 *
 * Structure of the payment flow:
 *
 *   1. On load we ask our own endpoint for a PaymentIntent. It replies with a
 *      client secret and the publishable key, so no Stripe key is hardcoded in
 *      this file and rotating one needs no redeploy of the front end.
 *   2. Two Stripe elements are mounted against that intent:
 *        - Express Checkout Element  — Apple Pay / Google Pay / Link buttons
 *        - Payment Element           — card and EU local methods
 *      Stripe hides wallets from the Payment Element when both are present, so
 *      the customer never sees Apple Pay twice.
 *   3. Changing the plan or ticking the bump UPDATES the same intent rather
 *      than creating a new one. One payment attempt, one intent — which is
 *      what makes the webhook's idempotency meaningful.
 *   4. Prices are never sent to the server. The browser asks for a plan; the
 *      server decides what that costs.
 */
(function () {
  'use strict';

  var API = '/api/create-intent.php';
  var RETURN_URL = 'https://ai-csapat.genmarketer.hu/en/thank-you/';
  var GA4_ID = 'G-1EV18K1256';

  var PRICES = { training: 189, consultation: 289 };
  var BUMP_PRICE = 79;
  var PLAN_LABEL = { training: 'The team', consultation: 'The team + consultation' };

  // The EU, because that is where we are set up to sell. Sorted by name so the
  // list reads naturally rather than by country code.
  var COUNTRIES = [
    ['AT', 'Austria'], ['BE', 'Belgium'], ['BG', 'Bulgaria'], ['HR', 'Croatia'],
    ['CY', 'Cyprus'], ['CZ', 'Czechia'], ['DK', 'Denmark'], ['EE', 'Estonia'],
    ['FI', 'Finland'], ['FR', 'France'], ['DE', 'Germany'], ['GR', 'Greece'],
    ['HU', 'Hungary'], ['IE', 'Ireland'], ['IT', 'Italy'], ['LV', 'Latvia'],
    ['LT', 'Lithuania'], ['LU', 'Luxembourg'], ['MT', 'Malta'], ['NL', 'Netherlands'],
    ['PL', 'Poland'], ['PT', 'Portugal'], ['RO', 'Romania'], ['SK', 'Slovakia'],
    ['SI', 'Slovenia'], ['ES', 'Spain'], ['SE', 'Sweden']
  ];

  // Stable for this visit, so capturing the email twice updates one recovery
  // row instead of leaving a trail of duplicates.
  function sessionId() {
    try {
      var k = 'gm_en_sid';
      var v = window.sessionStorage.getItem(k);
      if (!v) {
        v = 'en-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
        window.sessionStorage.setItem(k, v);
      }
      return v;
    } catch (e) {
      return 'en-' + Date.now().toString(36);
    }
  }

  /**
   * Hands the email to the cart-abandonment table the moment we have it.
   * Fire-and-forget: this must never delay or block the checkout.
   */
  function captureLead() {
    var email = String(el.form.elements.email.value || '').trim();
    if (!email) return;
    try {
      fetch('/api/capture-lead.php', {
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
    plan: 'training',
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
    coupon: null
  };

  var el = {};

  // ── Helpers ───────────────────────────────────────────────────────────────

  function $(id) { return document.getElementById(id); }

  function money(v) { return '€' + v; }

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
   * Carries campaign parameters from the landing page into the payment, where
   * they end up on the WooCommerce order. Without this, every English order
   * would show up as "Unknown" in analytics — a server-created order has no
   * browser session for WooCommerce's native attribution to read.
   */
  function attribution() {
    var out = {};
    try {
      var qs = new URLSearchParams(window.location.search);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid'].forEach(function (k) {
        var v = qs.get(k);
        if (v) out[k] = v;
      });
      // Fall back to what the landing page stored, since the checkout is a
      // separate navigation and the parameters are usually gone by now.
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
    } catch (e) { /* attribution is best-effort; never block a payment for it */ }
    return out;
  }

  function cookie(name) {
    var m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return m ? m.pop() : '';
  }

  function track(event, extra) {
    var payload = Object.assign({
      currency: 'EUR',
      value: total(),
      items: [{ item_id: 'gm-en-' + state.plan, item_name: PLAN_LABEL[state.plan], price: total(), quantity: 1 }]
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
    el.submitText.textContent = busy ? 'Processing…' : 'Pay ' + money(total());
  }

  // ── Validation ────────────────────────────────────────────────────────────

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
      message = 'This field is required.';
    } else if (name === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      message = 'Please check this email address.';
    }

    wrap.classList.toggle('is-error', !silent && !!message);
    wrap.classList.toggle('is-valid', !message && !!value);
    wrap.querySelector('[data-err]').textContent = silent ? '' : message;
    return !message;
  }

  function validateAll() {
    var ok = true;
    REQUIRED.forEach(function (name) { if (!validateField(name)) ok = false; });
    return ok;
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  function renderSummary() {
    el.sumPlan.textContent = PLAN_LABEL[state.plan];
    el.sumPlanPrice.textContent = money(PRICES[state.plan]);
    el.sumBumpLine.classList.toggle('is-hidden', !state.bump);
    el.sumCouponLine.classList.toggle('is-hidden', !state.coupon);
    if (state.coupon) {
      el.sumCouponLabel.textContent = 'Discount (' + state.coupon.code + ')';
      el.sumCouponVal.textContent = '–' + money(discount());
    }
    el.sumTotal.textContent = money(total());
    if (!state.busy) el.submitText.textContent = 'Pay ' + money(total());
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
        if (!res.ok) throw new Error((json && json.error && json.error.message) || 'Payment could not be started.');
        return json;
      });
    });
  }

  /**
   * Re-prices the existing intent after a plan or bump change.
   *
   * Guarded by a sequence number: a customer can toggle faster than the
   * network responds, and an out-of-order reply would otherwise leave the
   * elements showing a stale amount.
   */
  function syncAmount() {
    if (!state.elements) return;
    var seq = ++state.updateSeq;
    requestIntent()
      .then(function (data) {
        if (seq !== state.updateSeq) return;
        state.paymentIntentId = data.payment_intent_id || state.paymentIntentId;
        return state.elements.fetchUpdates();
      })
      .catch(function (err) {
        if (seq !== state.updateSeq) return;
        showError(err.message || 'We could not update your order. Please reload and try again.');
      });
  }

  // ── Stripe setup ──────────────────────────────────────────────────────────

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

    // Only reveal the divider when a wallet is actually available. Showing
    // "or pay by card" above an empty box looks broken.
    state.expressElement.on('ready', function (event) {
      var available = event && event.availablePaymentMethods;
      var hasWallet = available && Object.keys(available).some(function (k) { return available[k]; });
      el.or.hidden = !hasWallet;
      if (!hasWallet) el.express.style.display = 'none';
    });

    state.expressElement.on('click', function (event) {
      // Wallets can supply these, which is the whole point: on a phone the
      // customer taps once and never fills in the form.
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

    // --- Payment Element (card + EU local methods) --------------------------
    // Mounted lazily when step 3 first opens: Stripe measures its container
    // on mount, and a hidden container has no width, which produces a
    // collapsed or mis-laid-out card field.
    track('begin_checkout');
  }

  // ── Confirmation ──────────────────────────────────────────────────────────

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
   * Wallet payment. The customer never touched our form, so the name, email
   * and address come from the wallet — we push them onto the intent BEFORE
   * confirming, otherwise the order would arrive with no customer details.
   */
  function handleExpressConfirm(event) {
    clearError();
    // A wallet payment skips the form entirely — there is no step to return to.


    var details = event.billingDetails || {};
    var address = details.address || {};
    var nameParts = String(details.name || '').trim().split(/\s+/);

    var form = el.form.elements;
    if (details.email && !form.email.value) form.email.value = details.email;
    if (nameParts.length && !form.first_name.value) form.first_name.value = nameParts[0];
    if (nameParts.length > 1 && !form.last_name.value) form.last_name.value = nameParts.slice(1).join(' ');
    if (address.country && !form.country.value) form.country.value = address.country;
    if (address.city && !form.city.value) form.city.value = address.city;
    if (address.postal_code && !form.postcode.value) form.postcode.value = address.postal_code;
    if (address.line1 && !form.address.value) form.address.value = address.line1;

    track('add_payment_info', { payment_type: event.expressPaymentType || 'wallet' });

    // Write the wallet's details onto the intent, then confirm.
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
        showError(err.message || 'The payment could not be completed. Please try again.');
      });
  }

  function handleConfirmResult(result) {
    if (result && result.error) {
      setBusy(false);
      // card_error and validation_error are the customer's to fix and carry a
      // usable message; anything else is ours and gets a generic one.
      var e = result.error;
      showError(
        (e.type === 'card_error' || e.type === 'validation_error') && e.message
          ? e.message
          : 'Something went wrong while taking the payment. You have not been charged — please try again.'
      );
      return;
    }
    // No redirect happened, so the payment succeeded here. The order itself is
    // created by the webhook; this page just moves the customer along.
    var pi = result && result.paymentIntent;
    var url = RETURN_URL + (pi ? '?payment_intent=' + encodeURIComponent(pi.id) : '');
    window.location.href = url;
  }

  function handleSubmit(ev) {
    ev.preventDefault();
    if (state.busy) return;
    clearError();

    if (!validateAll()) {
      var firstBad = el.form.querySelector('.is-error input, .is-error select');
      if (firstBad) { firstBad.focus(); firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      return;
    }

    setBusy(true);
    track('add_payment_info', { payment_type: 'card' });

    // Push the final form values onto the intent before confirming, so the
    // webhook receives whatever the customer typed last.
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
        showError(err.message || 'The payment could not be completed. Please try again.');
      });
  }


  // ── Steps ─────────────────────────────────────────────────────────────────
  //
  // Splitting one long form into three short ones is the single biggest lever
  // available here: fewer fields on screen means fewer places to stall, and
  // capturing the email first means an abandoned checkout is still a contact
  // we can follow up.

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
    // Spelling the position out in words is a documented lift on multi-step
    // forms: the visual bar alone leaves people guessing how much is left.
    if (el.stepsCount) el.stepsCount.textContent = 'Step ' + n + ' of 3';

    // Stripe measures the container when the element mounts, so a hidden
    // container yields a collapsed card field. Mount on first reveal instead.
    if (n === 3 && state.elements && !state.paymentMounted) {
      state.paymentElement = state.elements.create('payment', {
        layout: { type: 'tabs', defaultCollapsed: false },
        // Wallets live in the Express element on step 1; repeating them here
        // would show the customer the same button twice.
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
        // Push what we have onto the PaymentIntent as we go. If the customer
        // leaves after step 1, their email is already attached to the intent
        // rather than lost with the tab.
        requestIntent().catch(function () { /* never block progress on this */ });
        captureLead();
        goToStep(Number(btn.getAttribute('data-next')));
      });
    });

    Array.prototype.forEach.call(el.form.querySelectorAll('[data-back]'), function (btn) {
      btn.addEventListener('click', function () {
        goToStep(Number(btn.getAttribute('data-back')));
      });
    });

    // Enter in a step-1/2 field should advance, not submit a half-filled form.
    el.form.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' || state.step === 3) return;
      var tag = (ev.target.tagName || '').toLowerCase();
      if (tag !== 'input' && tag !== 'select') return;
      ev.preventDefault();
      var next = el.form.querySelector('[data-step="' + state.step + '"] [data-next]');
      if (next) next.click();
    });
  }


  // ── Coupon ────────────────────────────────────────────────────────────────
  //
  // The code is checked by WordPress against the real WooCommerce coupon and
  // the discount comes back from the server. Nothing here decides a price.

  function applyCoupon() {
    var input = $('co-coupon');
    var msg = $('co-coupon-msg');
    var btn = $('co-coupon-apply');
    var code = String(input.value || '').trim();

    msg.textContent = '';
    msg.className = 'co-coupon__msg';
    if (!code) return;

    btn.disabled = true;
    btn.textContent = 'Checking…';

    state.coupon = { code: code, discount_cent: 0 };
    requestIntent()
      .then(function (data) {
        var c = data.coupon || {};
        if (c.valid) {
          state.coupon = { code: c.code || code, discount_cent: c.discount_cent || 0 };
          msg.textContent = (c.label ? c.label + ' applied.' : 'Coupon applied.');
          msg.className = 'co-coupon__msg is-ok';
          input.disabled = true;
          btn.textContent = 'Applied';
        } else {
          state.coupon = null;
          msg.textContent = c.reason || 'That code is not valid.';
          msg.className = 'co-coupon__msg is-bad';
          btn.disabled = false;
          btn.textContent = 'Apply';
        }
        renderSummary();
        return state.elements ? state.elements.fetchUpdates() : null;
      })
      .catch(function () {
        state.coupon = null;
        msg.textContent = 'We could not check that code. Please try again.';
        msg.className = 'co-coupon__msg is-bad';
        btn.disabled = false;
        btn.textContent = 'Apply';
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

  // ── Wiring ────────────────────────────────────────────────────────────────

  function fillCountries() {
    var select = el.form.elements.country;
    COUNTRIES.forEach(function (pair) {
      var option = document.createElement('option');
      option.value = pair[0];
      option.textContent = pair[1];
      select.appendChild(option);
    });
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
        items: [{ item_id: 'gm-en-bump', item_name: 'Extra consultation hour', price: BUMP_PRICE, quantity: 1 }]
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

    // A plan may be pre-selected from the landing page's pricing cards.
    try {
      var wanted = new URLSearchParams(window.location.search).get('plan');
      if (wanted && PRICES[wanted]) {
        var label = el.form.querySelector('.co-plan[data-plan="' + wanted + '"]');
        if (label) label.click();
      }
    } catch (e) {}

    el.form.addEventListener('submit', handleSubmit);

    // Last chance to keep the address if they close the tab mid-checkout.
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
        showError(
          err.message ||
          'We could not start the checkout. Please reload the page, or email info@genmarketer.hu and we will take your order manually.'
        );
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
