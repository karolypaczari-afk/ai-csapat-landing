<?php
/**
 * Exchanges a signed link for a Stripe billing portal session.
 *
 * Why this exists
 * ---------------
 * The subscription lives in Stripe, not in WooCommerce. The WooCommerce record
 * is a mirror, so its native "Renew now" would charge in HUF and its native
 * "Cancel" would stop the mirror while Stripe kept billing. Both are hidden
 * (GM_EN_Subscription::replace_my_account_actions) and replaced by this path.
 *
 * The access model, and the one thing it must not do
 * --------------------------------------------------
 * A portal session is a bearer credential: whoever holds it can cancel the
 * subscription and read every past invoice. So it is never issued on the
 * strength of an address typed into a form.
 *
 * The obvious shortcut — hand the browser a token at checkout time — was
 * considered and rejected. create-subscription.php reuses an existing Stripe
 * customer when the address already has one, so a token minted there would let
 * anyone start a checkout with somebody else's e-mail and receive a credential
 * for THEIR billing account. The only way in is therefore a link signed by the
 * server and delivered to the address itself (api/portal-link.php).
 */

declare(strict_types=1);

require __DIR__ . '/_lib.php';

gm_en_cors();

if ('POST' !== ($_SERVER['REQUEST_METHOD'] ?? '')) {
    gm_en_fail(405, 'method_not_allowed', 'POST required.');
}

$input  = gm_en_read_json_body();
$config = gm_en_config();

$email     = isset($input['email']) ? trim((string) $input['email']) : '';
$expires   = isset($input['expires']) ? (int) $input['expires'] : 0;
$signature = isset($input['signature']) ? (string) $input['signature'] : '';

$refused = static function (string $why) use ($email): void {
    gm_en_log('error', 'Portal session refused', [
        'why' => $why,
        'ip'  => $_SERVER['REMOTE_ADDR'] ?? '',
        // The address is intentionally not logged in full: this endpoint is
        // reachable by anyone, and its log must not become a list of subscribers.
        'hint' => '' === $email ? '(none)' : substr(hash('sha256', strtolower($email)), 0, 8),
    ]);
    gm_en_fail(403, 'not_authorised', 'This link is no longer valid. Please request a new one.');
};

if ('' === $email || !filter_var($email, FILTER_VALIDATE_EMAIL) || '' === $signature) {
    $refused('missing fields');
}
if ($expires < time()) {
    $refused('expired');
}

$expected = hash_hmac('sha256', strtolower($email) . '.' . $expires, $config['bridge_secret']);
if (!hash_equals($expected, $signature)) {
    $refused('bad signature');
}

$search = gm_en_stripe('GET', '/customers', ['email' => $email, 'limit' => 1]);
if (200 !== $search['status'] || empty($search['body']['data'][0]['id'])) {
    $refused('no such customer');
}

$session = gm_en_stripe('POST', '/billing_portal/sessions', [
    'customer'   => (string) $search['body']['data'][0]['id'],
    'return_url' => 'https://ai-csapat.genmarketer.hu/en/',
]);

if (200 !== $session['status'] || empty($session['body']['url'])) {
    gm_en_fail(502, 'stripe_error', 'We could not open the subscription manager. Please try again shortly.', [
        'status' => $session['status'],
        'stripe' => $session['body']['error']['message'] ?? '',
    ]);
}

gm_en_json(['url' => (string) $session['body']['url']]);
