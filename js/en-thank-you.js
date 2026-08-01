/**
 * Thank-you page for the English checkout.
 *
 * Arrivals come with one of two references:
 *   - ?subscription=sub_…   the monthly plans (Planner, Autopilot)
 *   - ?payment_intent=pi_…  the one-off Training package, and the historic packs
 *     whose receipts and bank-redirect returns still carry that form
 *
 * Either way the truth comes from our own endpoint, not from the query string.
 * A "processing" payment is a real and normal outcome for bank-redirect
 * methods, and telling someone it failed when it is merely slow is the worst
 * thing this page could do — so that case gets its own message.
 */
(function () {
  'use strict';

  var API = '/api/payment-status.php';
  var GA4_ID = 'G-1EV18K1256';
  var POLL_MS = 3000;
  var POLL_LIMIT = 10; // ~30 seconds, then we stop and let the email take over

  function $(id) { return document.getElementById(id); }

  function money(cents, currency) {
    var symbol = currency === 'EUR' ? '€' : (currency + ' ');
    return symbol + (cents / 100).toFixed(0);
  }

  function param(name) {
    try { return new URLSearchParams(window.location.search).get(name) || ''; }
    catch (e) { return ''; }
  }

  function trackPurchase(data) {
    // Fired once per page load. The authoritative purchase record is the
    // WooCommerce order created by the webhook; this is the browser-side
    // signal for ads platforms, deduplicated by the PaymentIntent id.
    var payload = {
      transaction_id: data.reference,
      value: data.amount / 100,
      currency: data.currency,
      items: [{
        item_id: 'gm-en-' + (data.plan || 'unknown'),
        item_name: data.plan_label,
        price: data.amount / 100,
        quantity: 1
      }]
    };
    try { if (typeof window.gtag === 'function') window.gtag('event', 'purchase', Object.assign({ send_to: GA4_ID }, payload)); } catch (e) {}
    try { window.dataLayer = window.dataLayer || []; window.dataLayer.push(Object.assign({ event: 'purchase' }, payload)); } catch (e) {}
    try {
      if (typeof window.fbq === 'function') {
        window.fbq('track', 'Purchase', { value: data.amount / 100, currency: data.currency }, { eventID: data.reference });
      }
    } catch (e) {}
  }

  function showSuccess(data) {
    $('ty-pending').classList.remove('is-visible');
    $('ty-success').hidden = false;

    $('ty-plan').textContent = data.plan_label + (data.bump ? ' + extra consultation hour' : '');
    $('ty-amount').textContent = money(data.amount, data.currency);
    $('ty-total').textContent = money(data.amount, data.currency);
    $('ty-ref').textContent = 'Reference: ' + data.reference;

    // What recurs, spelled out on the receipt as well as at the pay button.
    // The amount charged today includes the one-off bump, so without this line
    // a customer who added it would reasonably expect €108 every month.
    var rec = $('ty-recurring');
    if (rec && data.kind === 'subscription' && data.recurring) {
      rec.textContent = 'Renews at ' + money(data.recurring, data.currency)
        + ' a month until you cancel. The extra consultation hour, if you added one, was charged once.';
      rec.hidden = false;
    }

    // Only mention the consultation to people who actually bought one.
    if (data.plan === 'consultation' || data.bump) {
      $('ty-consult').hidden = false;
    }

    trackPurchase(data);
  }

  function showPending() {
    $('ty-pending').classList.add('is-visible');
    $('ty-success').hidden = false;
  }

  function showError(message) {
    var box = $('ty-error');
    box.textContent = message;
    box.classList.add('is-visible');
  }

  function poll(query, attempt) {
    fetch(API + '?' + query)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.error) {
          showError('We could not look up that payment. If you were charged, email info@genmarketer.hu with your reference and we will sort it out straight away.');
          return;
        }

        // A subscription reports its own lifecycle rather than a payment
        // status: `active` is the success case, and `incomplete` means the
        // first invoice has not been paid — the same "still in the air" state
        // that `processing` describes on a one-off payment.
        if (data.status === 'succeeded' || data.status === 'active' || data.status === 'trialing') {
          showSuccess(data);
          return;
        }

        if (data.status === 'processing' || data.status === 'requires_action' || data.status === 'incomplete') {
          showPending();
          if (attempt < POLL_LIMIT) {
            window.setTimeout(function () { poll(query, attempt + 1); }, POLL_MS);
          }
          return;
        }

        // requires_payment_method means the attempt failed and nothing was
        // taken — say so plainly rather than leaving them guessing.
        showError('That payment did not go through, and you have not been charged. You can try again on the checkout page.');
      })
      .catch(function () {
        showError('We could not reach our server to confirm the payment. If you were charged, you will still receive your access by email — nothing is lost.');
      });
  }

  function init() {
    var subId = param('subscription');
    var piId = param('payment_intent');

    if (!subId && !piId) {
      // Someone opened the page directly. Not an error worth alarming them
      // about — just point them somewhere useful.
      showError('There is no payment to show here. If you have just subscribed, check your email for your access details.');
      return;
    }

    poll(
      subId ? 'subscription=' + encodeURIComponent(subId) : 'payment_intent=' + encodeURIComponent(piId),
      0
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
