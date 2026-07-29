<?php
/**
 * One request that answers "can a customer buy right now?".
 *
 * Checks the three things that can independently break the funnel: the config
 * file, Stripe, and the WordPress bridge. Deliberately unauthenticated but
 * detail-free — it reports pass/fail, never a key, an id or an error body.
 */

declare(strict_types=1);

require __DIR__ . '/_lib.php';

$checks = [];
$ok = true;

// 1. Secrets present and well-formed
$configOk = is_readable(__DIR__ . '/_secrets.php');
$checks['config'] = $configOk ? 'ok' : 'missing';
$ok = $ok && $configOk;

if ($configOk) {
    $config = gm_en_config();
    $checks['mode'] = $config['mode'];

    // 2. Stripe reachable with the configured key
    $account = gm_en_stripe('GET', '/account');
    $stripeOk = 200 === $account['status'];
    $checks['stripe'] = $stripeOk ? 'ok' : 'fail';
    if ($stripeOk) {
        // Confirms we are pointed at the right business, not just *a* Stripe account.
        $checks['stripe_account'] = (string) ($account['body']['business_profile']['name'] ?? '');
        $checks['charges_enabled'] = !empty($account['body']['charges_enabled']);
        $ok = $ok && !empty($account['body']['charges_enabled']);
    } else {
        $ok = false;
    }

    // 3. WordPress bridge alive and configured
    $ch = curl_init(str_replace('/checkout-complete', '/health', $config['bridge_url']));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_HTTPHEADER     => ['X-GM-EN-Secret: ' . $config['bridge_secret']],
    ]);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $bridgeBody = json_decode((string) $raw, true);
    $bridgeOk = 200 === $status && !empty($bridgeBody['ok']);
    $checks['bridge'] = $bridgeOk ? 'ok' : ('fail (' . $status . ')');
    $ok = $ok && $bridgeOk;
}

gm_en_json(
    [
        'ok'      => $ok,
        'version' => GM_EN_API_VERSION,
        'checks'  => $checks,
        'time'    => gmdate('c'),
    ],
    $ok ? 200 : 503
);
