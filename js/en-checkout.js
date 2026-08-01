/**
 * English checkout — ai-csapat.genmarketer.hu/en/checkout/
 *
 * Sells the two MONTHLY plans and the one-off Training package. The Hungarian
 * funnel is untouched by any of this — it runs through WooCommerce and
 * CartFlows and never loads this file.
 *
 * TWO payment shapes behind one form (2026-08-01):
 *
 *   - subscription (planner, autopilot) → api/create-subscription.php, and the
 *     client secret belongs to the subscription's first INVOICE;
 *   - one-off (training)                → api/create-intent.php, and the client
 *     secret belongs to a bare PaymentIntent.
 *
 * Everything downstream of "give me a client secret" is identical, which is why
 * the two share this file instead of forking it. What is NOT identical, and is
 * therefore handled explicitly at every point: the endpoint, the id we carry
 * back (`subscription_id` vs `payment_intent_id`), the "then €X every month"
 * line — which must never be shown on a one-off — and the thank-you query
 * parameter, because api/payment-status.php resolves the two differently.
 *
 * Structure of the payment flow:
 *
 *   1. The customer's e-mail comes first, and nothing is created in Stripe
 *      before it. A subscription belongs to a Customer, and a Customer with no
 *      address cannot be sent a receipt or a cancellation link. The one-off
 *      could technically open its PaymentIntent earlier, but it goes through
 *      the same gate so there is one flow to reason about, not two.
 *   2. Leaving step 1 creates the subscription (or intent) and mounts two
 *      Stripe elements against it:
 *        - Express Checkout Element  — Apple Pay / Google Pay / Link
 *        - Payment Element           — card and the EU methods that can be
 *          charged again next month
 *      Nothing is billed until the customer confirms; an abandoned checkout
 *      leaves an incomplete subscription (or intent) that Stripe expires.
 *   3. Changing the plan re-prices in place where it can. Toggling the bump —
 *      and switching between a subscription and the one-off — changes the
 *      client secret, so the elements are torn down and rebuilt.
 *   4. Prices are never sent to the server. The browser asks for a plan; the
 *      server resolves it (a Stripe Price by lookup key for subscriptions, the
 *      GM_EN_PRICES table for the one-off) and that is the only thing that
 *      decides what is charged.
 */
(function () {
  'use strict';

  var SUBSCRIPTION_API = '/api/create-subscription.php';
  var ONE_OFF_API = '/api/create-intent.php';
  var RETURN_URL = 'https://ai-csapat.genmarketer.hu/en/thank-you/';
  var GA4_ID = 'G-1EV18K1256';

  // In euros. The monthly two mirror api/_lib.php GM_EN_SUBSCRIPTION_PLANS and
  // `training` mirrors GM_EN_PRICES — the server checks its own numbers against
  // the live Stripe Price and refuses to sell if they disagree, so a drift here
  // fails loudly instead of mispricing.
  var PRICES = { planner: 29, autopilot: 59, training: 189 };
  var BUMP_PRICE = 79;
  var PLAN_LABEL = { planner: 'Planner', autopilot: 'Autopilot', training: 'Training' };

  // The plans that RECUR. Everything not in here is a single payment — stated
  // as an allow-list rather than a `plan === 'training'` check, so adding a
  // second one-off pack later cannot silently inherit the monthly wording.
  var RECURRING = { planner: true, autopilot: true };
  function isOneOff() { return !RECURRING[state.plan]; }

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
    paymentIntentId: '',
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

  /** What the customer pays TODAY: the first month (or the whole one-off), plus the bump. */
  function total() {
    return PRICES[state.plan] + (state.bump ? BUMP_PRICE : 0);
  }

  /** What recurs every month after that. Zero on the one-off — nothing recurs. */
  function recurring() {
    return isOneOff() ? 0 : PRICES[state.plan];
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
   *
   * On the one-off the word "Subscribe" would be a plain untruth, and "today"
   * would imply there is a tomorrow instalment. Both are dropped.
   */
  function payLabel() {
    return isOneOff()
      ? 'Pay ' + money(total()) + ' — one-off'
      : 'Subscribe — ' + money(total()) + ' today';
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
    var once = isOneOff();
    el.sumPlan.textContent = PLAN_LABEL[state.plan];
    el.sumPlanPrice.textContent = money(PRICES[state.plan]) + (once ? '' : '/mo');
    el.sumBumpLine.classList.toggle('is-hidden', !state.bump);
    if (el.sumCouponLine) el.sumCouponLine.classList.add('is-hidden');
    el.sumTotal.textContent = money(total());
    if (el.sumTotalNote) el.sumTotalNote.textContent = once ? 'one-off' : 'first month';

    // The recurring line is not decoration. Card network rules require the
    // amount, the frequency and how to cancel to be visible at the point of
    // authorisation, and the bump makes today's charge differ from the monthly
    // one — exactly the case the rule exists for.
    //
    // On the one-off there is nothing recurring to disclose, and leaving a
    // "then €189 every month" line under a single payment would be the exact
    // opposite of the disclosure the rule is for. The line states the truth of
    // this purchase instead of being hidden, so the box is never empty.
    if (el.sumRecurring) {
      el.sumRecurring.textContent = once
        ? 'One single payment. Nothing recurring, no subscription, nothing to cancel.'
        : 'Then ' + money(recurring()) + ' every month until you cancel. Cancel any time — no notice period.';
    }

    // Two of the trust bullets only hold for one of the two shapes.
    if (el.trust) {
      Array.prototype.forEach.call(el.trust.querySelectorAll('[data-mode]'), function (li) {
        li.hidden = li.getAttribute('data-mode') !== (once ? 'once' : 'sub');
      });
    }
    if (!state.busy) el.submitText.textContent = payLabel();
  }

  // ── Payment (subscription or one-off) ─────────────────────────────────────

  /**
   * Asks the server for a client secret for the CURRENT plan.
   *
   * The endpoint and the id we carry back differ per shape, and both responses
   * are normalised here so nothing downstream has to know which one it got.
   * The amount is deliberately not in the request: the server derives it from
   * the plan slug alone.
   */
  function requestPayment() {
    var once = isOneOff();
    var body = Object.assign(
      once
        ? { plan: state.plan, bump: state.bump, payment_intent_id: state.paymentIntentId }
        : { plan: state.plan, bump: state.bump, subscription_id: state.subscriptionId },
      readForm(),
      attribution()
    );
    return fetch(once ? ONE_OFF_API : SUBSCRIPTION_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().then(function (json) {
        if (!res.ok) {
          throw new Error((json && json.error && json.error.message) ||
            (once ? 'The payment could not be started.' : 'The subscription could not be started.'));
        }
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
   * longer exists. Switching between a subscription and the one-off changes it
   * for the same reason: a different Stripe object entirely.
   */
  function syncAmount() {
    if (!state.elements) return;
    var seq = ++state.updateSeq;
    requestPayment()
      .then(function (data) {
        if (seq !== state.updateSeq) return;
        state.subscriptionId = data.subscription_id || state.subscriptionId;
        state.paymentIntentId = data.payment_intent_id || state.paymentIntentId;
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
    // Exactly one of these comes back per shape; keeping the other as-is would
    // send the thank-you page looking for a subscription that does not exist.
    state.subscriptionId = data.subscription_id || '';
    state.paymentIntentId = data.payment_intent_id || '';

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
   * Creates the subscription (or the one-off intent) the first time we have an
   * e-mail, then mounts.
   *
   * Returns a promise so the caller can decide whether to wait. Step
   * progression deliberately does not: a customer who typed their address
   * should move to the next screen even if Stripe is slow, and the payment
   * button stays disabled until the elements are actually ready.
   */
  function ensurePayment() {
    if (state.elements || state.starting) return Promise.resolve(null);
    state.starting = true;
    return requestPayment()
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
          'We could not start the checkout. Please reload the page, or email info@genmarketer.hu and we will set your order up manually.'
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

    // Write the wallet's details onto the subscription (or intent), then confirm.
    requestPayment()
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
    // No redirect happened, so the payment completed here. The order and the
    // access are created by the webhook (`invoice.paid` for a subscription,
    // `payment_intent.succeeded` for a one-off); this page just moves the
    // customer along.
    //
    // The parameter name is not cosmetic: api/payment-status.php looks up a
    // subscription for `?subscription=` and a PaymentIntent for
    // `?payment_intent=`. Sending the wrong one gives the customer a 404 on a
    // payment that actually went through.
    var ref = isOneOff()
      ? (state.paymentIntentId ? '?payment_intent=' + encodeURIComponent(state.paymentIntentId) : '')
      : (state.subscriptionId ? '?subscription=' + encodeURIComponent(state.subscriptionId) : '');
    window.location.href = RETURN_URL + ref;
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

    // Push the final form values onto the subscription (or intent) before
    // confirming. This matters most on the subscription: renewal invoices a
    // year from now inherit its metadata, and that is the only place the
    // customer's details still exist at that point.
    requestPayment()
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
          ensurePayment().catch(function () { /* the error is already on screen */ });
        } else {
          // Later steps only refresh the details already on the subscription.
          requestPayment().catch(function () { /* never block progress on this */ });
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
    el.sumTotalNote = $('co-sum-total-note');
    el.sumRecurring = $('co-sum-recurring');
    el.trust = $('co-trust');
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
