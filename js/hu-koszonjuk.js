/**
 * Köszönőoldal a magyar pénztárhoz.
 *
 * A vevő kétféleképp érkezhet ide:
 *   - kártya / wallet: mi irányítottuk át sikeres megerősítés után,
 *     ?payment_intent=… paraméterrel
 *   - bankos átirányítás: a Stripe hozta vissza a bank után,
 *     ?payment_intent=… és ?redirect_status=… paraméterrel
 *
 * Az igazság mindkét esetben a saját endpointunkból jön, nem a query
 * stringből. A „processing" állapot valós és normális kimenet; azt mondani
 * valakinek, hogy elbukott, miközben csak lassú, a legrosszabb, amit ez az
 * oldal tehetne — ezért annak saját üzenete van.
 */
(function () {
  'use strict';

  var API = '/api/hu-payment-status.php';
  var GA4_ID = 'G-1EV18K1256';
  var POLL_MS = 3000;
  var POLL_LIMIT = 10; // ~30 másodperc, utána az e-mail veszi át

  function $(id) { return document.getElementById(id); }

  /** „69 990 Ft" — fillérből forintra, nem törhető szóközzel. */
  function money(cents, currency) {
    var ft = Math.round(cents / 100);
    var grouped = String(ft).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return currency === 'HUF' ? grouped + ' Ft' : grouped + ' ' + currency;
  }

  function param(name) {
    try { return new URLSearchParams(window.location.search).get(name) || ''; }
    catch (e) { return ''; }
  }

  function trackPurchase(data) {
    // Oldalbetöltésenként egyszer sül el. A mérvadó vásárlási rekord a webhook
    // által létrehozott WooCommerce-rendelés; ez a böngészőoldali jel a
    // hirdetési platformoknak, a PaymentIntent azonosítójával deduplikálva.
    var payload = {
      transaction_id: data.reference,
      value: data.amount / 100,
      currency: data.currency,
      items: [{
        item_id: 'gm-hu-' + (data.plan || 'unknown'),
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

    $('ty-plan').textContent = data.plan_label + (data.bump ? ' + extra konzultációs óra' : '');
    $('ty-amount').textContent = money(data.amount, data.currency);
    $('ty-total').textContent = money(data.amount, data.currency);
    $('ty-ref').textContent = 'Azonosító: ' + data.reference;

    // A konzultációt csak annak említjük, aki tényleg vett egyet.
    if (data.plan === 'konzultacio' || data.bump) {
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

  function poll(piId, attempt) {
    fetch(API + '?payment_intent=' + encodeURIComponent(piId))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.error) {
          showError('Nem sikerült lekérdeznünk ezt a fizetést. Ha megterheltek, írj az info@genmarketer.hu címre az azonosítóval, és azonnal rendezzük.');
          return;
        }

        if (data.status === 'succeeded') {
          showSuccess(data);
          return;
        }

        if (data.status === 'processing' || data.status === 'requires_action') {
          showPending();
          if (attempt < POLL_LIMIT) {
            window.setTimeout(function () { poll(piId, attempt + 1); }, POLL_MS);
          }
          return;
        }

        // A requires_payment_method azt jelenti, hogy a kísérlet elbukott, és
        // nem vontunk le semmit — mondjuk ki nyíltan, ne találgasson.
        showError('Ez a fizetés nem ment át, és nem terheltünk meg. A pénztár oldalán újra megpróbálhatod.');
      })
      .catch(function () {
        showError('Nem értük el a szerverünket a fizetés megerősítéséhez. Ha megterheltek, a hozzáférésed így is megérkezik e-mailben — semmi nem veszett el.');
      });
  }

  function init() {
    var piId = param('payment_intent');

    if (!piId) {
      // Valaki közvetlenül nyitotta meg az oldalt. Ez nem olyan hiba, amivel
      // riogatni kell — inkább mutassunk hasznos irányt.
      showError('Itt most nincs megjeleníthető fizetés. Ha épp vásároltál, a belépési adataidat e-mailben találod.');
      return;
    }

    poll(piId, 0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
