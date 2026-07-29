<?php
/**
 * Creates (or updates) the Stripe PaymentIntent that backs the English
 * checkout.
 *
 * The browser posts a plan slug and whether the order bump is ticked; the
 * amount is computed here. When the customer toggles the bump we update the
 * SAME PaymentIntent rather than creating a new one, so a single payment
 * attempt maps to a single intent — which is what makes the webhook's
 * idempotency key meaningful.
 */

declare(strict_types=1);

require __DIR__ . '/_lib.php';

gm_en_cors();

if ('POST' !== ($_SERVER['REQUEST_METHOD'] ?? '')) {
    gm_en_fail(405, 'method_not_allowed', 'POST required.');
}

$input = gm_en_read_json_body();
$config = gm_en_config();

$plan = isset($input['plan']) ? preg_replace('/[^a-z_]/', '', (string) $input['plan']) : '';
$bump = !empty($input['bump']);
$pricing = gm_en_resolve_amount($plan, $bump);

// Coupons are validated by WordPress against the real WooCommerce coupon, and
// the discount is applied here — never client-side. An invalid code is not an
// error: the order simply proceeds at full price and the browser is told why.
$couponCode = isset($input['coupon']) ? trim((string) $input['coupon']) : '';
$coupon = ['valid' => false, 'discount_cent' => 0, 'label' => '', 'code' => '', 'reason' => ''];
if ('' !== $couponCode) {
    $coupon = gm_en_validate_coupon($couponCode, $pricing['amount']);
    if ($coupon['valid']) {
        $pricing['amount'] -= $coupon['discount_cent'];
    }
}

$email = isset($input['email']) ? trim((string) $input['email']) : '';
if ('' !== $email && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $email = '';
}

/**
 * Metadata travels with the payment to Stripe and comes back on the webhook.
 * It is the only channel that survives the customer closing the tab mid-payment,
 * so everything the order needs must be here — not in a PHP session.
 */
$metadata = [
    'plan'     => $pricing['plan'],
    'bump'     => $pricing['bump'] ? '1' : '0',
    'lang'     => 'en',
    'coupon'   => $coupon['valid'] ? $coupon['code'] : '',
    'source'   => 'ai-csapat.genmarketer.hu/en/checkout',
];
foreach (['first_name', 'last_name', 'country', 'city', 'postcode', 'address', 'company', 'vat_number'] as $field) {
    if (!empty($input[$field])) {
        $metadata[$field] = mb_substr((string) $input[$field], 0, 200);
    }
}
foreach (['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbc', 'fbp', 'gclid', 'ga_client_id'] as $field) {
    if (!empty($input[$field])) {
        $metadata[$field] = mb_substr((string) $input[$field], 0, 500);
    }
}
if ('' !== $email) {
    $metadata['email'] = $email;
}

$description = 'consultation' === $pricing['plan']
    ? 'Your AI Team — Training + Consultation'
    : 'Your AI Team — Training';
if ($pricing['bump']) {
    $description .= ' + extra consultation hour';
}

$existingId = isset($input['payment_intent_id']) ? preg_replace('/[^a-zA-Z0-9_]/', '', (string) $input['payment_intent_id']) : '';

// ── Update the existing intent when the customer changes their mind ──────────
if ('' !== $existingId) {
    $current = gm_en_stripe('GET', '/payment_intents/' . $existingId);
    $status  = $current['body']['status'] ?? '';

    // Only an intent still awaiting payment may be re-priced. Anything already
    // processing or succeeded must never have its amount changed.
    if (200 === $current['status'] && in_array($status, ['requires_payment_method', 'requires_confirmation'], true)) {
        $params = [
            'amount'      => (string) $pricing['amount'],
            'description' => $description,
        ];
        foreach ($metadata as $k => $v) {
            $params['metadata[' . $k . ']'] = $v;
        }
        if ('' !== $email) {
            $params['receipt_email'] = $email;
        }
        $updated = gm_en_stripe('POST', '/payment_intents/' . $existingId, $params);
        if (200 === $updated['status']) {
            gm_en_json([
                'client_secret'     => $updated['body']['client_secret'] ?? '',
                'payment_intent_id' => $updated['body']['id'] ?? '',
                'amount'            => $pricing['amount'],
                'currency'          => GM_EN_CURRENCY,
                'publishable_key'   => $config['stripe_publishable'],
                'reused'            => true,
                'coupon'            => $coupon,
            ]);
        }
        gm_en_log('error', 'PaymentIntent update failed — falling back to a new intent', [
            'id'     => $existingId,
            'status' => $updated['status'],
            'stripe' => $updated['body']['error']['message'] ?? '',
        ]);
    }
}

// ── Otherwise create a fresh one ────────────────────────────────────────────
$params = [
    'amount'      => (string) $pricing['amount'],
    'currency'    => GM_EN_CURRENCY,
    'description' => $description,
];

if (!empty($config['pmc'])) {
    // A dedicated payment method configuration keeps the English funnel's
    // enabled methods (card, wallets, iDEAL, Bancontact, EPS, P24) independent
    // of the one WooCommerce uses for the Hungarian funnel.
    //
    // It is mutually exclusive with automatic_payment_methods — sending both
    // is an API error, not a merge.
    $params['payment_method_configuration'] = $config['pmc'];
} else {
    // Fallback: let Stripe pick what is relevant for this buyer and amount.
    $params['automatic_payment_methods[enabled]'] = 'true';
}
foreach ($metadata as $k => $v) {
    $params['metadata[' . $k . ']'] = $v;
}
if ('' !== $email) {
    $params['receipt_email'] = $email;
}

$created = gm_en_stripe('POST', '/payment_intents', $params);

if (200 !== $created['status']) {
    gm_en_fail(502, 'stripe_error', 'We could not start the payment. Please try again.', [
        'status' => $created['status'],
        'stripe' => $created['body']['error']['message'] ?? '',
        'plan'   => $pricing['plan'],
    ]);
}

gm_en_log('info', 'PaymentIntent created', [
    'id'     => $created['body']['id'] ?? '',
    'amount' => $pricing['amount'],
    'plan'   => $pricing['plan'],
    'bump'   => $pricing['bump'],
]);

gm_en_json([
    'client_secret'     => $created['body']['client_secret'] ?? '',
    'payment_intent_id' => $created['body']['id'] ?? '',
    'amount'            => $pricing['amount'],
    'currency'          => GM_EN_CURRENCY,
    'publishable_key'   => $config['stripe_publishable'],
    'reused'            => false,
    'coupon'            => $coupon,
]);
