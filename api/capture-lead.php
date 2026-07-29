<?php
/**
 * Captures the email from step 1 of the checkout and hands it to the cart
 * abandonment recovery table in WordPress.
 *
 * Runs server-side so the bridge secret never reaches the browser. Failure is
 * silent by design: this is a marketing nicety, and it must never be able to
 * stop someone from buying.
 */

declare(strict_types=1);

require __DIR__ . '/_lib.php';

gm_en_cors();

if ('POST' !== ($_SERVER['REQUEST_METHOD'] ?? '')) {
    gm_en_json(['captured' => false], 405);
}

$input = gm_en_read_json_body();
$email = isset($input['email']) ? trim((string) $input['email']) : '';
$session = isset($input['session_id']) ? preg_replace('/[^a-zA-Z0-9_-]/', '', (string) $input['session_id']) : '';

if ('' === $email || !filter_var($email, FILTER_VALIDATE_EMAIL) || '' === $session) {
    gm_en_json(['captured' => false, 'reason' => 'invalid_input'], 200);
}

$plan = isset($input['plan']) ? preg_replace('/[^a-z_]/', '', (string) $input['plan']) : 'training';
$bump = !empty($input['bump']);
$pricing = gm_en_resolve_amount($plan, $bump);

$config = gm_en_config();
$url = str_replace('/checkout-complete', '/capture-abandonment', $config['bridge_url']);

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 15,
    CURLOPT_CONNECTTIMEOUT => 6,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json; charset=utf-8',
        'X-GM-EN-Secret: ' . $config['bridge_secret'],
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'email'      => $email,
        'session_id' => $session,
        'plan'       => $pricing['plan'],
        'total'      => $pricing['amount'] / 100,
        'first_name' => isset($input['first_name']) ? mb_substr((string) $input['first_name'], 0, 100) : '',
    ], JSON_UNESCAPED_UNICODE),
]);
$raw = curl_exec($ch);
$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if (200 !== $status) {
    gm_en_log('error', 'Lead capture failed', ['status' => $status, 'session' => $session]);
}

// Always 200 to the browser: a failure here is ours to fix, not the
// customer's to see.
gm_en_json(['captured' => 200 === $status]);
