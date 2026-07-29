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

$piId = isset($_GET['payment_intent']) ? preg_replace('/[^a-zA-Z0-9_]/', '', (string) $_GET['payment_intent']) : '';
if ('' === $piId) {
    gm_en_json(['error' => ['code' => 'missing_id', 'message' => 'payment_intent is required.']], 400);
}

$res = gm_en_stripe('GET', '/payment_intents/' . $piId);
if (200 !== $res['status']) {
    gm_en_json(['error' => ['code' => 'not_found', 'message' => 'We could not find that payment.']], 404);
}

$pi = $res['body'];
$metadata = is_array($pi['metadata'] ?? null) ? $pi['metadata'] : [];

$plan = (string) ($metadata['plan'] ?? '');
$labels = [
    'training'     => 'The team',
    'consultation' => 'The team + consultation',
];

gm_en_json([
    'status'   => (string) ($pi['status'] ?? 'unknown'),
    'amount'   => (int) ($pi['amount_received'] ?? $pi['amount'] ?? 0),
    'currency' => strtoupper((string) ($pi['currency'] ?? 'EUR')),
    'plan'     => $plan,
    'plan_label' => $labels[$plan] ?? 'Your AI Team',
    'bump'     => !empty($metadata['bump']) && '0' !== $metadata['bump'],
    'reference' => $piId,
]);
