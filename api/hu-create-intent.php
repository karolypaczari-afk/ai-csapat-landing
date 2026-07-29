<?php
/**
 * Creates (or updates) the Stripe PaymentIntent behind the Hungarian checkout.
 *
 * Same shape as the English create-intent, with one addition that matters: the
 * funnel's open/closed state is checked FIRST. Until the Hungarian funnel is
 * switched on, no PaymentIntent is created at all, so the page can be live and
 * browsable without any risk of taking money we cannot turn into an order.
 */

declare(strict_types=1);

require __DIR__ . '/_hu-lib.php';

gm_hu_cors();

if ('POST' !== ($_SERVER['REQUEST_METHOD'] ?? '')) {
    gm_en_fail(405, 'method_not_allowed', 'POST szükséges.');
}

// ── The gate, before anything can cost money ────────────────────────────────
$state = gm_hu_funnel_state();
if (!$state['open']) {
    gm_hu_log('info', 'create-intent refused — funnel closed', ['reason' => $state['reason']]);
    gm_en_json([
        'error' => [
            'code'    => 'checkout_not_open',
            'message' => 'Ez a pénztár még nem indult el. A vásárlás jelenleg a megszokott úton megy.',
            'reason'  => $state['reason'],
        ],
    ], 409);
}

$input = gm_en_read_json_body();
$config = gm_en_config();

$plan = isset($input['plan']) ? preg_replace('/[^a-z_]/', '', (string) $input['plan']) : '';
$bump = !empty($input['bump']);
$pricing = gm_hu_resolve_amount($plan, $bump);

$couponCode = isset($input['coupon']) ? trim((string) $input['coupon']) : '';
$coupon = ['valid' => false, 'discount_cent' => 0, 'label' => '', 'code' => '', 'reason' => ''];
if ('' !== $couponCode) {
    $coupon = gm_hu_validate_coupon($couponCode, $pricing['amount']);
    if ($coupon['valid']) {
        $pricing['amount'] -= $coupon['discount_cent'];
    }
}

$email = isset($input['email']) ? trim((string) $input['email']) : '';
if ('' !== $email && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $email = '';
}

/**
 * Metadata rides along to Stripe and comes back on the webhook — the only
 * channel that survives the customer closing the tab mid-payment.
 */
$metadata = [
    'plan'   => $pricing['plan'],
    'bump'   => $pricing['bump'] ? '1' : '0',
    'lang'   => 'hu',
    'coupon' => $coupon['valid'] ? $coupon['code'] : '',
    'source' => 'ai-csapat.genmarketer.hu/checkout',
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

$description = 'konzultacio' === $pricing['plan']
    ? 'Az AI csapatod — Képzés + Konzultáció'
    : 'Az AI csapatod — Képzés';
if ($pricing['bump']) {
    $description .= ' + extra konzultációs óra';
}

$existingId = isset($input['payment_intent_id'])
    ? preg_replace('/[^a-zA-Z0-9_]/', '', (string) $input['payment_intent_id'])
    : '';

// ── Re-price the existing intent when the customer changes their mind ───────
if ('' !== $existingId) {
    $current = gm_en_stripe('GET', '/payment_intents/' . $existingId);
    $status  = $current['body']['status'] ?? '';

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
                'currency'          => GM_HU_CURRENCY,
                'publishable_key'   => $config['stripe_publishable'],
                'reused'            => true,
                'coupon'            => $coupon,
            ]);
        }
        gm_hu_log('error', 'PaymentIntent update failed — falling back to a new intent', [
            'id'     => $existingId,
            'status' => $updated['status'],
            'stripe' => $updated['body']['error']['message'] ?? '',
        ]);
    }
}

// ── Otherwise create a fresh one ───────────────────────────────────────────
$params = [
    'amount'      => (string) $pricing['amount'],
    'currency'    => GM_HU_CURRENCY,
    'description' => $description,
];

if (!empty($config['hu_pmc'])) {
    // A payment method configuration of its own: Hungarian buyers want card
    // plus wallets, not iDEAL or Bancontact. Mutually exclusive with
    // automatic_payment_methods — sending both is an API error, not a merge.
    $params['payment_method_configuration'] = $config['hu_pmc'];
} else {
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
    gm_en_fail(502, 'stripe_error', 'A fizetést nem sikerült elindítani. Kérlek, próbáld meg újra.', [
        'status' => $created['status'],
        'stripe' => $created['body']['error']['message'] ?? '',
        'plan'   => $pricing['plan'],
    ]);
}

gm_hu_log('info', 'PaymentIntent created', [
    'id'     => $created['body']['id'] ?? '',
    'amount' => $pricing['amount'],
    'plan'   => $pricing['plan'],
    'bump'   => $pricing['bump'],
]);

gm_en_json([
    'client_secret'     => $created['body']['client_secret'] ?? '',
    'payment_intent_id' => $created['body']['id'] ?? '',
    'amount'            => $pricing['amount'],
    'currency'          => GM_HU_CURRENCY,
    'publishable_key'   => $config['stripe_publishable'],
    'reused'            => false,
    'coupon'            => $coupon,
]);
