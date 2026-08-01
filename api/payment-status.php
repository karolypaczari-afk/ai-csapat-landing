<?php
/**
 * Reports the outcome of a payment to the thank-you page.
 *
 * Doing this server-side means the thank-you page needs no Stripe.js and no
 * publishable key, and the answer comes from Stripe rather than from a query
 * string the customer could edit.
 *
 * The PaymentIntent id is not a secret (it is already in the return URL), and
 * the response deliberately carries nothing sensitive: status, amount, plan.
 * The client secret is never accepted as input nor returned.
 */

declare(strict_types=1);

require __DIR__ . '/_lib.php';

gm_en_cors();

// ── Subscription ────────────────────────────────────────────────────────────
// The subscription checkout returns with ?subscription=sub_…, because a
// subscription's first payment is an invoice rather than a bare PaymentIntent
// and the customer's plan lives on the subscription, not on the intent.
$subId = isset($_GET['subscription']) ? preg_replace('/[^a-zA-Z0-9_]/', '', (string) $_GET['subscription']) : '';
if ('' !== $subId) {
    $res = gm_en_stripe('GET', '/subscriptions/' . $subId, ['expand' => ['latest_invoice']]);
    if (200 !== $res['status']) {
        gm_en_json(['error' => ['code' => 'not_found', 'message' => 'We could not find that subscription.']], 404);
    }

    $sub      = $res['body'];
    $metadata = is_array($sub['metadata'] ?? null) ? $sub['metadata'] : [];
    $invoice  = is_array($sub['latest_invoice'] ?? null) ? $sub['latest_invoice'] : [];
    $plan     = (string) ($metadata['plan'] ?? '');

    $labels = ['planner' => 'Planner', 'autopilot' => 'Autopilot'];
    $prices = ['planner' => 2900, 'autopilot' => 5900];

    gm_en_json([
        'kind'       => 'subscription',
        // `active` is what the customer cares about; `trialing` and `past_due`
        // are reported as-is rather than flattened, so the page can tell the
        // truth instead of claiming success for a payment still in the air.
        'status'     => (string) ($sub['status'] ?? 'unknown'),
        // What was actually charged today, bump included.
        'amount'     => (int) ($invoice['amount_paid'] ?? 0),
        'recurring'  => $prices[$plan] ?? 0,
        'currency'   => strtoupper((string) ($invoice['currency'] ?? 'EUR')),
        'plan'       => $plan,
        'plan_label' => $labels[$plan] ?? 'Your AI Team',
        'bump'       => !empty($metadata['bump']) && '0' !== $metadata['bump'],
        'reference'  => $subId,
    ]);
}

// ── One-off ─────────────────────────────────────────────────────────────────
$piId = isset($_GET['payment_intent']) ? preg_replace('/[^a-zA-Z0-9_]/', '', (string) $_GET['payment_intent']) : '';
if ('' === $piId) {
    gm_en_json(['error' => ['code' => 'missing_id', 'message' => 'payment_intent or subscription is required.']], 400);
}

$res = gm_en_stripe('GET', '/payment_intents/' . $piId);
if (200 !== $res['status']) {
    gm_en_json(['error' => ['code' => 'not_found', 'message' => 'We could not find that payment.']], 404);
}

$pi = $res['body'];
$metadata = is_array($pi['metadata'] ?? null) ? $pi['metadata'] : [];

$plan = (string) ($metadata['plan'] ?? '');
// `training` is sold again since 2026-08-01 as the one-off package.
// `consultation` is NOT — it stays in this table because historic thank-you
// links still resolve here, and a customer reopening an old receipt should see
// what they bought rather than a blank page.
$labels = [
    'training'     => 'Training (one-off)',
    'consultation' => 'The team + consultation',
];

gm_en_json([
    'kind'     => 'one_off',
    'status'   => (string) ($pi['status'] ?? 'unknown'),
    'amount'   => (int) ($pi['amount_received'] ?? $pi['amount'] ?? 0),
    'currency' => strtoupper((string) ($pi['currency'] ?? 'EUR')),
    'plan'     => $plan,
    'plan_label' => $labels[$plan] ?? 'Your AI Team',
    'bump'     => !empty($metadata['bump']) && '0' !== $metadata['bump'],
    'reference' => $piId,
]);
