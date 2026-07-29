<?php
/**
 * Receives payment_intent.succeeded from Stripe and hands the order to
 * WordPress.
 *
 * This is the one place where money has already moved but nothing has been
 * recorded yet, so the failure behaviour matters more than the happy path:
 *
 *   - the signature is verified before anything is read
 *   - every event is written to disk before we act on it
 *   - a failed bridge call returns 500 so Stripe retries (16 times over 72h)
 *   - a duplicate delivery is safe: the plugin keys orders by PaymentIntent
 *
 * Never returns 200 for work that did not happen. A 200 tells Stripe to stop
 * retrying, and a silent drop here is a paying customer with no access.
 */

declare(strict_types=1);

require __DIR__ . '/_lib.php';

if ('POST' !== ($_SERVER['REQUEST_METHOD'] ?? '')) {
    http_response_code(405);
    exit;
}

$config    = gm_en_config();
$payload   = (string) file_get_contents('php://input');
$signature = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';

if (!gm_en_verify_stripe_signature($payload, $signature, $config['webhook_secret'])) {
    gm_en_log('error', 'Webhook signature verification failed', [
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

// Events we do not act on still get a 200 — otherwise Stripe would retry them
// forever and the log would fill with noise.
if ('payment_intent.succeeded' !== $eventType) {
    gm_en_log('info', 'Ignoring event type', ['type' => $eventType, 'event_id' => $eventId]);
    http_response_code(200);
    echo json_encode(['received' => true, 'ignored' => $eventType]);
    exit;
}

$pi       = $event['data']['object'] ?? [];
$piId     = (string) ($pi['id'] ?? '');
$amount   = (int) ($pi['amount_received'] ?? $pi['amount'] ?? 0);
$currency = strtoupper((string) ($pi['currency'] ?? 'EUR'));
$metadata = is_array($pi['metadata'] ?? null) ? $pi['metadata'] : [];

/**
 * Language guard — both funnels bill through the SAME Stripe account.
 *
 * A Stripe webhook endpoint receives every event it subscribes to; there is no
 * metadata filter on Stripe's side. So once the Hungarian funnel is live, this
 * endpoint also sees its payments. Handing one to the English bridge would get
 * "unknown plan" back, return 500, and Stripe would retry that for 72 hours
 * while e-mailing the operator on each attempt.
 *
 * The default is 'en' so that any intent created before this key existed keeps
 * being processed exactly as it is today — the guard only ever drops something
 * that positively identifies as another funnel's.
 */
$lang = (string) ($metadata['lang'] ?? 'en');
if ('en' !== $lang) {
    gm_en_log('info', 'Not an English payment — leaving it to the other endpoint', [
        'pi'   => $piId,
        'lang' => $lang,
    ]);
    http_response_code(200);
    echo json_encode(['received' => true, 'ignored' => 'foreign_funnel']);
    exit;
}

// Written before any action, so a crash between here and the bridge call still
// leaves us able to replay the event by hand.
gm_en_save_payload(
    gmdate('Y-m-d_H-i-s') . '_' . ($piId ?: 'nopi') . '.json',
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
    // Without an e-mail we cannot create or find the customer. This is a hard
    // failure worth alerting on: the money arrived and we cannot deliver.
    gm_en_log('error', 'Paid intent has no email — cannot create order', ['pi' => $piId, 'event_id' => $eventId]);
    gm_en_alert_admin(
        'Paid PaymentIntent with no email',
        "PaymentIntent: $piId\nAmount: $amount $currency\n\nThe payment succeeded but carries no e-mail address, so no order could be created. Look it up in the Stripe dashboard and create the order manually."
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
    'country'         => (string) ($metadata['country'] ?? ''),
    'city'            => (string) ($metadata['city'] ?? ''),
    'postcode'        => (string) ($metadata['postcode'] ?? ''),
    'address'         => (string) ($metadata['address'] ?? ''),
    'company'         => (string) ($metadata['company'] ?? ''),
    'vat_number'      => (string) ($metadata['vat_number'] ?? ''),
    'coupon'          => (string) ($metadata['coupon'] ?? ''),
    'payment_intent'  => $piId,
    'stripe_customer' => (string) ($pi['customer'] ?? ''),
    // The amount Stripe actually captured. The plugin reconciles the order
    // total to this, so the order, the invoice and the payout agree.
    'amount_cent'     => $amount,
    'currency'        => $currency,
];
foreach (['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbc', 'fbp', 'gclid', 'ga_client_id'] as $field) {
    if (!empty($metadata[$field])) {
        $bridgePayload[$field] = (string) $metadata[$field];
    }
}

$result = gm_en_call_bridge($bridgePayload);

if (!$result['success']) {
    gm_en_log('error', 'Bridge call failed — asking Stripe to retry', [
        'pi'       => $piId,
        'event_id' => $eventId,
        'status'   => $result['status'],
        'error'    => $result['error'],
        'body'     => $result['body'],
    ]);
    gm_en_alert_admin(
        'EN checkout bridge failure',
        "PaymentIntent: $piId\nEmail: $email\nAmount: $amount $currency\nBridge status: {$result['status']}\nError: {$result['error']}\n\n"
        . "Stripe will retry automatically. If it keeps failing, replay by hand:\n"
        . "  https://ai-csapat.genmarketer.hu/api/replay.php\n"
    );

    // 500 is deliberate: it is what makes Stripe retry. Returning 200 here
    // would strand a paying customer with no order and no second chance.
    http_response_code(500);
    echo json_encode(['error' => 'bridge failed, will retry']);
    exit;
}

$orderId = $result['body']['order_id'] ?? null;
gm_en_log('info', 'Order created from webhook', [
    'pi'        => $piId,
    'event_id'  => $eventId,
    'order_id'  => $orderId,
    'duplicate' => !empty($result['body']['duplicate']),
]);

http_response_code(200);
echo json_encode(['received' => true, 'order_id' => $orderId]);
