<?php
/**
 * Receives payment_intent.succeeded for the HUNGARIAN funnel and hands the
 * order to WordPress.
 *
 * Same failure discipline as the English webhook: verify the signature before
 * reading anything, persist the raw event before acting, and never return 200
 * for work that did not happen — a 200 stops Stripe's retries, and a silent
 * drop here is a paying customer with no access.
 *
 * ── The language guard ──────────────────────────────────────────────────────
 * Both funnels bill through the SAME Stripe account, and a Stripe webhook
 * endpoint receives every event it is subscribed to — it cannot be filtered by
 * metadata on Stripe's side. So this endpoint sees English payments too, and
 * the English endpoint sees Hungarian ones.
 *
 * Without a guard each would hand the other's payment to its own bridge, get
 * "unknown plan" back, return 500, and Stripe would retry that for 72 hours
 * while e-mailing the operator. Every foreign event is therefore acknowledged
 * with a 200 and dropped: it is not ours, and someone else has it.
 */

declare(strict_types=1);

require __DIR__ . '/_hu-lib.php';

if ('POST' !== ($_SERVER['REQUEST_METHOD'] ?? '')) {
    http_response_code(405);
    exit;
}

$config    = gm_en_config();
$payload   = (string) file_get_contents('php://input');
$signature = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';

$secret = (string) ($config['hu_webhook_secret'] ?? '');
if ('' === $secret) {
    gm_hu_log('error', 'Webhook called but hu_webhook_secret is not configured', []);
    http_response_code(500);
    echo json_encode(['error' => 'not configured']);
    exit;
}

if (!gm_en_verify_stripe_signature($payload, $signature, $secret)) {
    gm_hu_log('error', 'Webhook signature verification failed', [
        'ip'  => $_SERVER['REMOTE_ADDR'] ?? '',
        'len' => strlen($payload),
    ]);
    http_response_code(400);
    echo json_encode(['error' => 'invalid signature']);
    exit;
}

$event = json_decode($payload, true);
if (!is_array($event) || empty($event['type'])) {
    http_response_code(400);
    echo json_encode(['error' => 'malformed event']);
    exit;
}

$eventId   = (string) ($event['id'] ?? '');
$eventType = (string) $event['type'];

if ('payment_intent.succeeded' !== $eventType) {
    gm_hu_log('info', 'Ignoring event type', ['type' => $eventType, 'event_id' => $eventId]);
    http_response_code(200);
    echo json_encode(['received' => true, 'ignored' => $eventType]);
    exit;
}

$pi       = $event['data']['object'] ?? [];
$piId     = (string) ($pi['id'] ?? '');
$amount   = (int) ($pi['amount_received'] ?? $pi['amount'] ?? 0);
$currency = strtoupper((string) ($pi['currency'] ?? 'HUF'));
$metadata = is_array($pi['metadata'] ?? null) ? $pi['metadata'] : [];

// ── The language guard (see the file header) ────────────────────────────────
if ('hu' !== (string) ($metadata['lang'] ?? '')) {
    gm_hu_log('info', 'Not a Hungarian payment — leaving it to the other endpoint', [
        'pi'   => $piId,
        'lang' => (string) ($metadata['lang'] ?? '(none)'),
    ]);
    http_response_code(200);
    echo json_encode(['received' => true, 'ignored' => 'foreign_funnel']);
    exit;
}

gm_en_save_payload(
    gmdate('Y-m-d_H-i-s') . '_hu_' . ($piId ?: 'nopi') . '.json',
    [
        'event_id'   => $eventId,
        'event_type' => $eventType,
        'pi'         => $piId,
        'amount'     => $amount,
        'currency'   => $currency,
        'metadata'   => $metadata,
        'ts'         => gmdate('c'),
    ]
);

$email = (string) ($metadata['email'] ?? $pi['receipt_email'] ?? '');
if ('' === $email) {
    gm_hu_log('error', 'Paid intent has no email — cannot create order', ['pi' => $piId, 'event_id' => $eventId]);
    gm_en_alert_admin(
        'Fizetett PaymentIntent e-mail nélkül (HU)',
        "PaymentIntent: $piId\nÖsszeg: $amount $currency\n\nA fizetés sikerült, de nincs rajta e-mail cím, így nem jött létre rendelés. Keresd meg a Stripe-fiókban, és hozd létre kézzel."
    );
    http_response_code(500);
    echo json_encode(['error' => 'no email on intent']);
    exit;
}

$bridgePayload = [
    'email'           => $email,
    'plan'            => (string) ($metadata['plan'] ?? ''),
    'bump'            => !empty($metadata['bump']) && '0' !== $metadata['bump'],
    'first_name'      => (string) ($metadata['first_name'] ?? ''),
    'last_name'       => (string) ($metadata['last_name'] ?? ''),
    'country'         => (string) ($metadata['country'] ?? 'HU'),
    'city'            => (string) ($metadata['city'] ?? ''),
    'postcode'        => (string) ($metadata['postcode'] ?? ''),
    'address'         => (string) ($metadata['address'] ?? ''),
    'company'         => (string) ($metadata['company'] ?? ''),
    'vat_number'      => (string) ($metadata['vat_number'] ?? ''),
    'coupon'          => (string) ($metadata['coupon'] ?? ''),
    'payment_intent'  => $piId,
    'stripe_customer' => (string) ($pi['customer'] ?? ''),
    'amount_cent'     => $amount,
    'currency'        => $currency,
];
foreach (['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbc', 'fbp', 'gclid', 'ga_client_id'] as $field) {
    if (!empty($metadata[$field])) {
        $bridgePayload[$field] = (string) $metadata[$field];
    }
}

$result = gm_hu_call_bridge($bridgePayload);

if (!$result['success']) {
    gm_hu_log('error', 'Bridge call failed — asking Stripe to retry', [
        'pi'       => $piId,
        'event_id' => $eventId,
        'status'   => $result['status'],
        'error'    => $result['error'],
        'body'     => $result['body'],
    ]);
    gm_en_alert_admin(
        'HU pénztár — bridge hiba',
        "PaymentIntent: $piId\nE-mail: $email\nÖsszeg: $amount $currency\nBridge státusz: {$result['status']}\nHiba: {$result['error']}\n\n"
        . "A Stripe automatikusan újrapróbálja. Ha tartósan hibázik, játszd vissza kézzel:\n"
        . "  https://ai-csapat.genmarketer.hu/api/hu-replay.php\n"
    );

    http_response_code(500);
    echo json_encode(['error' => 'bridge failed, will retry']);
    exit;
}

$orderId = $result['body']['order_id'] ?? null;
gm_hu_log('info', 'Order created from webhook', [
    'pi'        => $piId,
    'event_id'  => $eventId,
    'order_id'  => $orderId,
    'duplicate' => !empty($result['body']['duplicate']),
]);

http_response_code(200);
echo json_encode(['received' => true, 'order_id' => $orderId]);
