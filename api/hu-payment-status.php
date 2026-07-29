<?php
/**
 * Reports the outcome of a Hungarian payment to the thank-you page.
 *
 * Server-side, so the thank-you page needs no Stripe.js and no publishable
 * key, and the answer comes from Stripe rather than from a query string the
 * customer could edit. Nothing sensitive is returned: status, amount, plan.
 */

declare(strict_types=1);

require __DIR__ . '/_hu-lib.php';

gm_hu_cors();

$piId = isset($_GET['payment_intent'])
    ? preg_replace('/[^a-zA-Z0-9_]/', '', (string) $_GET['payment_intent'])
    : '';
if ('' === $piId) {
    gm_en_json(['error' => ['code' => 'missing_id', 'message' => 'A payment_intent kötelező.']], 400);
}

$res = gm_en_stripe('GET', '/payment_intents/' . $piId);
if (200 !== $res['status']) {
    gm_en_json(['error' => ['code' => 'not_found', 'message' => 'Nem találjuk ezt a fizetést.']], 404);
}

$pi = $res['body'];
$metadata = is_array($pi['metadata'] ?? null) ? $pi['metadata'] : [];

$plan = (string) ($metadata['plan'] ?? '');
$labels = [
    'kepzes'      => 'Az AI csapatod – Képzés',
    'konzultacio' => 'Az AI csapatod – Képzés + Konzultáció',
];

$amount = (int) ($pi['amount_received'] ?? $pi['amount'] ?? 0);

gm_en_json([
    'status'        => (string) ($pi['status'] ?? 'unknown'),
    'amount'        => $amount,
    'amount_display' => gm_hu_format_ft($amount),
    'currency'      => strtoupper((string) ($pi['currency'] ?? 'HUF')),
    'plan'          => $plan,
    'plan_label'    => $labels[$plan] ?? 'Az AI csapatod',
    'bump'          => !empty($metadata['bump']) && '0' !== $metadata['bump'],
    'reference'     => $piId,
]);
