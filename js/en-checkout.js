/**
 * English checkout — ai-csapat.genmarketer.hu/en/checkout/
 *
 * Sells the two MONTHLY plans. The one-off packs this page used to sell moved
 * out when the English offer became a subscription, matching the Hungarian
 * root; what did not change is that the Hungarian funnel is untouched by any of
 * this — it runs through WooCommerce and CartFlows and never loads this file.
 *
 * Structure of the payment flow:
 *
 *   1. The customer's e-mail comes first, and nothing is created in Stripe
 *      before it. A subscription belongs to a Customer, and a Customer with no
 *      address cannot be sent a receipt or a cancellation link — so unlike the
 *      one-off flow, which could open a PaymentIntent on page load, this one
 *      waits until step 1 is done.
 *   2. Leaving step 1 creates an INCOMPLETE subscription and mounts two Stripe
 *      elements against its first invoice:
 *        - Express Checkout Element  — Apple Pay / Google Pay / Link
 *        - Payment Element           — card and the EU methods that can be
 *          charged again next month
 *      Nothing is billed until the customer confirms; an abandoned checkout
 *      leaves an incomplete subscription that Stripe expires by itself.
 *   3. Changing the plan re-prices the SAME subscription. Toggling the bump
 *      replaces it, because the bump is a line on the draft invoice rather than
 *      a subscription item and cannot be toggled in place.
 *   4. Prices are never sent to the server. The browser asks for a plan; the
 *      server resolves it to a Stripe Price by lookup key and that Price is the
 *      only thing that decides what recurs.
 */
(function () {
  'use strict';

  var API = '/api/create-subscription.php';
  var RETURN_URL = 'https://ai-csapat.genmarketer.hu/en/thank-you/';
  var GA4_ID = 'G-1EV18K1256';

  // Monthly, in euros. Mirrors api/_lib.php GM_EN_SUBSCRIPTION_PLANS — the
  // server checks these against the live Stripe Price and refuses to sell if
  // they disagree, so a drift here fails loudly instead of mispricing.
  var PRICES = { planner: 29, autopilot: 59 };
  var BUMP_PRICE = 79;
  var PLAN_LABEL = { planner: 'Planner', autopilot: 'Autopilot' };

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
    plan: 'planner',
    bump: false,
    subscriptionId: '',
    clientSecret: '',
    stripe: null,
    elements: null,
    paymentElement: null,
    expressElement: null,
    busy: false,
    starting: false,
    updateSeq: 0,
    step: 1,
    paymentMounted: false
  };

  var el = {};

  // ── Helpers ───────────────────────────────────────────────────────────────

  function $(id) { return document.getElementById(id); }

  function money(v) { return '€' + v; }

  /** What the customer pays TODAY: the first month, plus the one-off bump. */
  function total() {
    return PRICES[state.plan] + (state.bump ? BUMP_PRICE : 0);
  }

  /** What recurs every month after that. The bump is charged once and never again. */
  function recurring() {
    return PRICES[state.plan];
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
    el.submitText.textContent = busy ? 'Processing…' : payLabel();
  }

  /**
   * The button says what is actually about to happen.
   *
   * "Subscribe" rather than "Pay", and the amount charged today rather than the
   * monthly rate, because those differ whenever the bump is ticked — a button
   * reading "Pay €29" that takes €108 is the kind of surprise that produces
   * chargebacks rather than customers.
   */
  function payLabel() {
    return 'Subscribe — ' + money(total()) + ' today';
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
    el.sumPlanPrice.textContent = money(PRICES[state.plan]) + '/mo';
    el.sumBumpLine.classList.toggle('is-hidden', !state.bump);
    if (el.sumCouponLine) el.sumCouponLine.classList.add('is-hidden');
    el.sumTotal.textContent = money(total());

    // The recurring line is not decoration. Card network rules require the
    // amount, the frequency and how to cancel to be visible at the point of
    // authorisation, and the bump makes today's charge differ from the monthly
    // one — exactly the case the rule exists for.
    if (el.sumRecurring) {
      el.sumRecurring.textContent =
        'Then ' + money(recurring()) + ' every month until you cancel. Cancel any time — no notice period.';
    }
    if (!state.busy) el.submitText.textContent = payLabel();
  }

  // ── Subscription ──────────────────────────────────────────────────────────

  function requestSubscription() {
    var body = Object.assign(
      {
        plan: state.plan,
        bump: state.bump,
        subscription_id: state.subscriptionId
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
        if (!res.ok) throw new Error((json && json.error && json.error.message) || 'The subscription could not be started.');
        return json;
      });
    });
  }

  /**
   * Re-prices after a plan or bump change, and re-mounts if Stripe handed back
   * a different invoice.
   *
   * Guarded by a sequence number: a customer can toggle faster than the network
   * responds, and an out-of-order reply would leave the elements showing a
   * stale amount. Toggling the bump makes the server replace the subscription
   * altogether, so the client secret can genuinely change under us — carrying
   * on with the old one would confirm a payment against an invoice that no
   * longer exists.
   */
  function syncAmount() {
    if (!state.elements) return;
    var seq = ++state.updateSeq;
    requestSubscription()
      .then(function (data) {
        if (seq !== state.updateSeq) return;
        state.subscriptionId = data.subscription_id || state.subscriptionId;
        if (data.client_secret && data.client_secret !== state.clientSecret) {
          remountStripe(data);
          return null;
        }
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

  /**
   * Tears the elements down and rebuilds them against a new invoice.
   *
   * Needed because toggling the bump replaces the subscription server-side.
   * Stripe Elements are bound to one client secret for their lifetime; there is
   * no "point this at a different invoice" call, so the honest move is a full
   * rebuild rather than hoping fetchUpdates() papers over it.
   */
  function remountStripe(data) {
    try {
      if (state.paymentElement) state.paymentElement.unmount();
      if (state.expressElement) state.expressElement.unmount();
    } catch (e) { /* an already-unmounted element is not a problem */ }
    state.paymentElement = null;
    state.expressElement = null;
    state.paymentMounted = false;
    mountStripe(data);
    if (state.step === 3) mountPaymentElement();
  }

  function mountStripe(data) {
    state.stripe = window.Stripe(data.publishable_key);
    state.clientSecret = data.client_secret;
    state.subscriptionId = data.subscription_id;

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

  function mountPaymentElement() {
    if (!state.elements || state.paymentMounted) return;
    state.paymentElement = state.elements.create('payment', {
      layout: { type: 'tabs', defaultCollapsed: false },
      // Wallets live in the Express element on step 2; repeating them here
      // would show the customer the same button twice.
      wallets: { applePay: 'never', googlePay: 'never' },
      fields: { billingDetails: { address: 'never', name: 'never', email: 'never' } }
    });
    state.paymentElement.mount('#co-payment');
    state.paymentMounted = true;
  }

  /**
   * Creates the subscription the first time we have an e-mail, then mounts.
   *
   * Returns a promise so the caller can decide whether to wait. Step
   * progression deliberately does not: a customer who typed their address
   * should move to the next screen even if Stripe is slow, and the payment
   * button stays disabled until the elements are actually ready.
   */
  function ensureSubscription() {
    if (state.elements || state.starting) return Promise.resolve(null);
    state.starting = true;
    return requestSubscription()
      .then(function (data) {
        state.starting = false;
        mountStripe(data);
        el.submit.disabled = false;
        return data;
      })
      .catch(function (err) {
        state.starting = false;
        showError(
          err.message ||
          'We could not start the checkout. Please reload the page, or email info@genmarketer.hu and we will set your subscription up manually.'
        );
        throw err;
      });
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

    // Write the wallet's details onto the subscription, then confirm.
    requestSubscription()
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
    // No redirect happened, so the first invoice was paid here. The order, the
    // WooCommerce subscription and the course access are all created by the
    // invoice.paid webhook; this page just moves the customer along.
    window.location.href = RETURN_URL + (state.subscriptionId ? '?subscription=' + encodeURIComponent(state.subscriptionId) : '');
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

    // Push the final form values onto the subscription before confirming. This
    // matters more here than on the one-off path: renewal invoices a year from
    // now inherit the subscription's metadata, and it is the only place the
    // customer's details still exist at that point.
    requestSubscription()
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
    if (n === 3) mountPaymentElement();

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
        // The e-mail is known once step 1 is valid, so this is the earliest
        // moment a Stripe Customer — and therefore a subscription — can exist.
        // Nothing is billed by it; the customer still has to confirm.
        if (!state.elements) {
          ensureSubscription().catch(function () { /* the error is already on screen */ });
        } else {
          // Later steps only refresh the details already on the subscription.
          requestSubscription().catch(function () { /* never block progress on this */ });
        }
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
  // Removed with the move to subscriptions, along with its markup.
  //
  // The old field validated a WooCommerce coupon and subtracted the discount
  // from a one-off PaymentIntent. Neither half survives here: a subscription is
  // billed against a Stripe Price, and a discount on it has to be a Stripe
  // coupon or promotion code so that Stripe knows whether it applies once or
  // every month. Leaving a field that quietly discounted only the first charge
  // would have been worse than not having one.
  //
  // Nothing customer-visible was lost — the block was already `hidden` on the
  // one-off checkout. When discounts are wanted here, the way in is
  // `discounts[0][promotion_code]` on api/create-subscription.php.

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
    el.sumRecurring = $('co-sum-recurring');
    el.steps = $('co-steps');
    el.stepsCount = $('co-steps-count');

    fillCountries();
    wireSteps();
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

    // Stays disabled until the subscription exists and the elements are
    // mounted, which cannot happen before step 1 gives us an e-mail address.
    el.submit.disabled = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
