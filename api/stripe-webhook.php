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
 * A 200 tells Stripe to stop retrying, so it is never returned for work that
 * could still succeed — a silent drop there is a paying customer with no
 * access. It IS returned for the two cases a retry cannot change: an event
 * that is not ours, and an intent of ours that carries no address anywhere.
 * Both are alerted or logged; retrying them only buries the alert under 72
 * hours of noise and pushes the endpoint towards Stripe's auto-disable.
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

// The subscription funnel's events are handled in their own file. They share
// this endpoint (one Stripe endpoint, one signing secret, one signature check)
// but nothing else: different objects, different idempotency keys, different
// failure behaviour.
if (in_array($eventType, GM_EN_SUBSCRIPTION_EVENTS, true)) {
    require __DIR__ . '/_subscription-events.php';
    gm_en_handle_subscription_event($event, $eventId, $eventType);
    exit;
}

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
 * Funnel guard — EVERY payment on this Stripe account is delivered here.
 *
 * A Stripe webhook endpoint receives every event it subscribes to; there is no
 * metadata filter on Stripe's side. Three funnels bill through this account:
 * this one, the Hungarian checkout, and the WooCommerce shop on tudastar, which
 * charges through its own Stripe gateway. Only intents created by our two
 * checkouts carry metadata.lang — so an intent without it is somebody else's.
 *
 * This used to default to 'en' when the key was absent, reasoning that an intent
 * created before the key existed should keep working. There were no such
 * intents — the funnel shipped with the key — and the default instead claimed
 * every WooCommerce order: no metadata.email, so the handler alerted "paid
 * intent with no email" and returned 500, and Stripe retried that for 72 hours.
 * A guard may only ever claim what positively identifies as ours.
 */
$lang    = (string) ($metadata['lang'] ?? '');
$foreign = gm_en_foreign_gateway($metadata);

// Our own subscription payments also land here: Stripe emits
// payment_intent.succeeded for every invoice it charges, and that intent
// carries no metadata of ours. They are handled by invoice.paid instead, so
// dropping them is right — but calling them "not this funnel's payment" in the
// log would send a future reader hunting for a foreign integration that does
// not exist.
if ('' === $lang && !empty($pi['invoice'])) {
    gm_en_log('info', 'Subscription invoice payment — handled by invoice.paid, dropped here', [
        'pi'      => $piId,
        'invoice' => (string) $pi['invoice'],
    ]);
    http_response_code(200);
    echo json_encode(['received' => true, 'ignored' => 'subscription_invoice']);
    exit;
}

if ('en' !== $lang || '' !== $foreign) {
    gm_en_log('info', 'Not this funnel\'s payment — acknowledged and dropped', [
        'pi'       => $piId,
        'lang'     => '' === $lang ? '(none)' : $lang,
        'currency' => $currency,
        // WooCommerce stamps its order number on the intent; logging it makes
        // the drop traceable to a real order instead of looking like data loss.
        'woo_order' => (string) ($metadata['order_id'] ?? ''),
        'marker'    => $foreign ?: '(none)',
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

// Falls back to the charge's billing details, which is where a wallet payment
// leaves the address when the pre-confirm intent update did not land.
$email = gm_en_resolve_email($pi);
if ('' === $email) {
    // The money arrived on an intent of ours and we cannot deliver. Nothing a
    // retry can change — an intent's metadata is fixed once it succeeded — so
    // this is acknowledged with a 200 rather than left to hammer the endpoint
    // for 72 hours. The alert is forced past the throttle instead: it fires
    // exactly once per payment, and it must not be swallowed by an unrelated
    // alert that happened to go out in the same quarter of an hour.
    gm_en_log('error', 'Paid intent has no email — cannot create order', ['pi' => $piId, 'event_id' => $eventId]);
    gm_en_alert_admin(
        'Paid PaymentIntent with no email',
        "PaymentIntent: $piId\nAmount: $amount $currency\n\nThe payment succeeded but carries no e-mail address, so no order could be created. Look it up in the Stripe dashboard and create the order manually.",
        true
    );
    http_response_code(200);
    echo json_encode(['received' => true, 'error' => 'no email on intent', 'action' => 'manual']);
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
