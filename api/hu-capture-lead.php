<?php
/**
 * Captures the e-mail from step 1 of the Hungarian checkout and hands it to the
 * cart abandonment recovery table in WordPress.
 *
 * Runs server-side so the bridge secret never reaches the browser. Failure is
 * silent by design: this is a marketing nicety and it must never be able to
 * stop someone from buying.
 */

declare(strict_types=1);

require __DIR__ . '/_hu-lib.php';

gm_hu_cors();

if ('POST' !== ($_SERVER['REQUEST_METHOD'] ?? '')) {
    gm_en_json(['captured' => false], 405);
}

$input = gm_en_read_json_body();
$email = isset($input['email']) ? trim((string) $input['email']) : '';
$session = isset($input['session_id'])
    ? preg_replace('/[^a-zA-Z0-9_-]/', '', (string) $input['session_id'])
    : '';

if ('' === $email || !filter_var($email, FILTER_VALIDATE_EMAIL) || '' === $session) {
    gm_en_json(['captured' => false, 'reason' => 'invalid_input'], 200);
}

$plan = isset($input['plan']) ? preg_replace('/[^a-z_]/', '', (string) $input['plan']) : 'kepzes';
if (!isset(GM_HU_PRICES[$plan])) {
    $plan = 'kepzes';
}
$pricing = gm_hu_resolve_amount($plan, !empty($input['bump']));

$res = gm_hu_call_bridge([
    'email'      => $email,
    'session_id' => $session,
    'plan'       => $pricing['plan'],
    'total'      => $pricing['amount'] / 100,
    'first_name' => isset($input['first_name']) ? mb_substr((string) $input['first_name'], 0, 100) : '',
], 'capture-abandonment');

if (!$res['success']) {
    gm_hu_log('error', 'Lead capture failed', ['status' => $res['status'], 'session' => $session]);
}

// Always 200 to the browser: a failure here is ours to fix, not the customer's
// to see.
gm_en_json(['captured' => $res['success']]);
