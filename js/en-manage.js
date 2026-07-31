/**
 * Subscription self-service — ai-csapat.genmarketer.hu/en/manage/
 *
 * Two states, decided entirely by the query string:
 *
 *   - no signature  → ask for an e-mail address and have the server send a
 *     signed link. The response is identical whether or not that address
 *     subscribes, so this page cannot be used to find out who our customers are.
 *   - signature     → exchange it for a Stripe billing portal session.
 *
 * The signature is HMACed server-side with a secret this file has never seen,
 * so nothing here can mint one. All this code does is carry it back.
 */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function param(name) {
    try { return new URLSearchParams(window.location.search).get(name) || ''; }
    catch (e) { return ''; }
  }

  function showError(message) {
    var box = $('mg-error');
    if (!box) return;
    box.textContent = message;
    box.classList.add('is-visible');
  }

  function busy(button, label, on, idleText) {
    button.disabled = on;
    button.classList.toggle('is-busy', on);
    label.textContent = on ? 'Working…' : idleText;
  }

  // ── Ask for a link ────────────────────────────────────────────────────────

  function wireRequest() {
    var button = $('mg-send');
    var label = $('mg-send-text');
    var input = $('mg-email');
    if (!button || !input) return;

    function send() {
      var email = String(input.value || '').trim();
      var wrap = input.closest('.co-field');
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        wrap.classList.add('is-error');
        wrap.querySelector('[data-err]').textContent = 'Please check this email address.';
        input.focus();
        return;
      }
      wrap.classList.remove('is-error');
      wrap.querySelector('[data-err]').textContent = '';

      busy(button, label, true, 'Email me the link');
      fetch('/api/portal-link.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          busy(button, label, false, 'Email me the link');
          var note = $('mg-sent');
          // The server answers the same way for an address that subscribes and
          // one that does not; repeating its wording keeps that true here too.
          note.textContent = data.message ||
            'If that address has a subscription with us, we have emailed you a link to manage it. The link is valid for one hour.';
          note.hidden = false;
          input.disabled = true;
          button.disabled = true;
        })
        .catch(function () {
          busy(button, label, false, 'Email me the link');
          showError('We could not send that just now. Please try again in a minute, or email info@genmarketer.hu.');
        });
    }

    button.addEventListener('click', send);
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); send(); }
    });
  }

  // ── Open the portal ───────────────────────────────────────────────────────

  function wireOpen(email, expires, signature) {
    $('mg-request').hidden = true;
    $('mg-open').hidden = false;

    var button = $('mg-go');
    var label = $('mg-go-text');

    // Not opened automatically on load. A Stripe portal session is single-use
    // and short-lived, so a browser that prefetches the page — or a customer
    // who reloads it — would burn the session and land on an error. One
    // deliberate click also means the session is created when it is wanted.
    button.addEventListener('click', function () {
      busy(button, label, true, 'Open my billing page');
      fetch('/api/portal.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, expires: Number(expires), signature: signature })
      })
        .then(function (res) {
          return res.json().then(function (data) {
            if (!res.ok) throw new Error((data && data.error && data.error.message) || 'That link is no longer valid.');
            return data;
          });
        })
        .then(function (data) {
          if (!data.url) throw new Error('That link is no longer valid.');
          window.location.href = data.url;
        })
        .catch(function (err) {
          busy(button, label, false, 'Open my billing page');
          showError(err.message || 'That link is no longer valid. Please request a new one.');
          // Put the request form back so the dead end has a way out.
          $('mg-open').hidden = true;
          $('mg-request').hidden = false;
        });
    });
  }

  function init() {
    wireRequest();

    var email = param('email');
    var expires = param('expires');
    var signature = param('signature');
    if (email && expires && signature) {
      wireOpen(email, expires, signature);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
