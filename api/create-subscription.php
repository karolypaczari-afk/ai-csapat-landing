<?php
/**
 * Creates (or re-prices) the Stripe Subscription that backs the English
 * monthly plans.
 *
 * How this differs from create-intent.php, and why
 * ------------------------------------------------
 * A one-off payment is a PaymentIntent the browser confirms. A subscription is
 * a Subscription object whose FIRST invoice the browser confirms; every invoice
 * after that is Stripe's job, off-session, with its own retries. So:
 *
 *   - the amount is never sent to Stripe. The recurring amount lives on the
 *     Price object, looked up by lookup_key. Sending a number here would set
 *     the first charge and leave the renewals to disagree with it silently.
 *   - the subscription is created `default_incomplete`, so nothing is billed
 *     until the customer confirms. An abandoned checkout leaves an incomplete
 *     subscription that Stripe expires on its own — no access is granted,
 *     because access hangs off `invoice.paid`, not off this call.
 *   - the client secret comes from `latest_invoice.confirmation_secret`. The
 *     older `latest_invoice.payment_intent` field is gone from the API version
 *     this account is pinned to (2026-07-29.dahlia).
 *
 * The customer's e-mail is REQUIRED here, unlike on the one-time path. A
 * subscription is attached to a Customer, and a Customer with no e-mail cannot
 * be sent a receipt, cannot be recognised on their return, and cannot be handed
 * a billing-portal link — the three things a subscriber needs most.
 */

declare(strict_types=1);

require __DIR__ . '/_lib.php';

gm_en_cors();

if ('POST' !== ($_SERVER['REQUEST_METHOD'] ?? '')) {
    gm_en_fail(405, 'method_not_allowed', 'POST required.');
}

$input  = gm_en_read_json_body();
$config = gm_en_config();

$plan = isset($input['plan']) ? preg_replace('/[^a-z_]/', '', (string) $input['plan']) : '';
if (!isset(GM_EN_SUBSCRIPTION_PLANS[$plan])) {
    gm_en_fail(400, 'unknown_plan', 'Unknown plan.', ['plan' => $plan]);
}

$email = isset($input['email']) ? trim((string) $input['email']) : '';
if ('' === $email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    gm_en_fail(400, 'email_required', 'A valid e-mail address is required to start a subscription.');
}

$priceId = gm_en_subscription_price_id($plan);
if ('' === $priceId) {
    // gm_en_subscription_price_id() has already logged precisely what was wrong.
    gm_en_fail(502, 'plan_unavailable', 'This plan is temporarily unavailable. Please try again shortly.');
}

// ── Metadata ────────────────────────────────────────────────────────────────
// Everything the WordPress mirror needs must ride on the SUBSCRIPTION, not just
// on the first invoice: renewal invoices are created by Stripe a month later and
// inherit the subscription's metadata, which is the only channel that still
// carries the customer's details at that point.
$bump = !empty($input['bump']);

$metadata = [
    'plan'   => $plan,
    'bump'   => $bump ? '1' : '0',
    'lang'   => 'en',
    'kind'   => 'subscription',
    'source' => 'ai-csapat.genmarketer.hu/en/checkout',
    'email'  => $email,
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

// ── Re-price an existing incomplete subscription ────────────────────────────
// The customer switched plan after we already created one. Updating the item in
// place keeps a single subscription per checkout attempt, which is what makes
// the webhook's idempotency meaningful — the alternative leaves a trail of
// abandoned incomplete subscriptions on the customer record.
$existingId = isset($input['subscription_id']) ? preg_replace('/[^a-zA-Z0-9_]/', '', (string) $input['subscription_id']) : '';
if ('' !== $existingId) {
    $current = gm_en_stripe('GET', '/subscriptions/' . $existingId, ['expand' => ['latest_invoice.confirmation_secret']]);
    $status  = (string) ($current['body']['status'] ?? '');

    if (200 === $current['status'] && 'incomplete' === $status) {
        $itemId       = (string) ($current['body']['items']['data'][0]['id'] ?? '');
        $currentPrice = (string) ($current['body']['items']['data'][0]['price']['id'] ?? '');
        $currentBump  = '1' === (string) ($current['body']['metadata']['bump'] ?? '0');

        if ($currentBump !== $bump) {
            // The bump is an invoice item on the draft invoice, not a subscription
            // item, so it cannot be toggled by updating the subscription. Cancel
            // and start again — an incomplete subscription has never been billed,
            // so nothing is lost and no stray draft is left on the customer.
            gm_en_stripe('DELETE', '/subscriptions/' . $existingId);
            gm_en_log('info', 'Incomplete subscription replaced after a bump change', ['id' => $existingId]);
        } elseif ('' !== $itemId && $currentPrice === $priceId) {
            // Same plan, same bump — hand back the secret we already have.
            gm_en_subscription_response($current['body'], $plan, $config, false);
        } elseif ('' !== $itemId) {
            $params = [
                'items[0][id]'       => $itemId,
                'items[0][price]'    => $priceId,
                'proration_behavior' => 'none',
                'expand[0]'          => 'latest_invoice.confirmation_secret',
            ];
            foreach ($metadata as $k => $v) {
                $params['metadata[' . $k . ']'] = $v;
            }
            $updated = gm_en_stripe('POST', '/subscriptions/' . $existingId, $params);
            if (200 === $updated['status']) {
                gm_en_subscription_response($updated['body'], $plan, $config, true);
            }
            gm_en_log('error', 'Subscription update failed — falling back to a new subscription', [
                'id'     => $existingId,
                'status' => $updated['status'],
                'stripe' => $updated['body']['error']['message'] ?? '',
            ]);
        }
    }
}

// ── Customer ────────────────────────────────────────────────────────────────
// Reused by e-mail so a returning customer keeps one Stripe record — otherwise
// the billing portal shows them only the subscription bought in this session.
$customerId = '';
$search = gm_en_stripe('GET', '/customers', ['email' => $email, 'limit' => 1]);
if (200 === $search['status'] && !empty($search['body']['data'][0]['id'])) {
    $customerId = (string) $search['body']['data'][0]['id'];
}

$customerParams = ['email' => $email];
$name = trim((string) ($input['first_name'] ?? '') . ' ' . (string) ($input['last_name'] ?? ''));
if ('' !== $name) {
    $customerParams['name'] = mb_substr($name, 0, 200);
}
foreach (['city' => 'address[city]', 'postcode' => 'address[postal_code]', 'address' => 'address[line1]', 'country' => 'address[country]'] as $field => $param) {
    if (!empty($input[$field])) {
        $customerParams[$param] = mb_substr((string) $input[$field], 0, 200);
    }
}

if ('' !== $customerId) {
    gm_en_stripe('POST', '/customers/' . $customerId, $customerParams);
} else {
    $created = gm_en_stripe('POST', '/customers', $customerParams);
    if (200 !== $created['status'] || empty($created['body']['id'])) {
        gm_en_fail(502, 'stripe_error', 'We could not start the subscription. Please try again.', [
            'status' => $created['status'],
            'stripe' => $created['body']['error']['message'] ?? '',
        ]);
    }
    $customerId = (string) $created['body']['id'];
}

// ── Subscription ────────────────────────────────────────────────────────────
$params = [
    'customer'                                  => $customerId,
    'items[0][price]'                           => $priceId,
    'payment_behavior'                          => 'default_incomplete',
    // Without this the card that pays the first invoice is not kept as the
    // subscription's default, and the first renewal fails for a customer who
    // did nothing wrong.
    'payment_settings[save_default_payment_method]' => 'on_subscription',
    'billing_mode[type]'                        => 'flexible',
    'expand[0]'                                 => 'latest_invoice.confirmation_secret',
];
// No payment_method_configuration here, deliberately. The Subscription's
// `payment_settings` has no such field (only payment_method_options,
// payment_method_types and save_default_payment_method) — the dedicated
// configuration built for the one-time funnel applies to PaymentIntents. Left
// unset, Stripe offers exactly the methods that can actually be charged again
// next month, which is the correct filter for a subscription and a narrower one
// than we would have written by hand.
foreach ($metadata as $k => $v) {
    $params['metadata[' . $k . ']'] = $v;
}

// The order bump rides on the FIRST invoice only. `add_invoice_items` is what
// makes that true by construction: the line is attached to the invoice being
// created now, not to the subscription, so no renewal can ever repeat it.
if ($bump) {
    $bumpPrice = gm_en_bump_price_id();
    if ('' !== $bumpPrice) {
        $params['add_invoice_items[0][price]'] = $bumpPrice;
    } else {
        // The plan is still sellable without the extra; charging for something
        // we could not price would be the worse failure.
        gm_en_log('error', 'Bump requested but its price could not be resolved — continuing without it', ['plan' => $plan]);
        $metadata['bump'] = '0';
        $params['metadata[bump]'] = '0';
        $bump = false;
    }
}

$created = gm_en_stripe('POST', '/subscriptions', $params);
if (200 !== $created['status']) {
    gm_en_fail(502, 'stripe_error', 'We could not start the subscription. Please try again.', [
        'status' => $created['status'],
        'stripe' => $created['body']['error']['message'] ?? '',
        'plan'   => $plan,
    ]);
}

gm_en_log('info', 'Subscription created', [
    'id'       => $created['body']['id'] ?? '',
    'plan'     => $plan,
    'customer' => $customerId,
]);

gm_en_subscription_response($created['body'], $plan, $config, false);

// ────────────────────────────────────────────────────────────────────────────

/**
 * Shapes the one response the browser needs, and never returns.
 *
 * A missing confirmation secret is treated as a hard failure rather than
 * returned as an empty string: the Payment Element cannot mount without it, and
 * an empty field would surface to the customer as a checkout that silently does
 * nothing.
 */
function gm_en_subscription_response(array $subscription, string $plan, array $config, bool $reused): void
{
    $secret = (string) ($subscription['latest_invoice']['confirmation_secret']['client_secret'] ?? '');
    if ('' === $secret) {
        gm_en_fail(502, 'stripe_error', 'We could not start the subscription. Please try again.', [
            'reason'       => 'no confirmation_secret on latest_invoice',
            'subscription' => $subscription['id'] ?? '',
            'status'       => $subscription['status'] ?? '',
        ]);
    }

    gm_en_json([
        'client_secret'    => $secret,
        'subscription_id'  => (string) ($subscription['id'] ?? ''),
        'customer_id'      => (string) ($subscription['customer'] ?? ''),
        'amount'           => GM_EN_SUBSCRIPTION_PLANS[$plan]['amount'],
        'currency'         => GM_EN_CURRENCY,
        'interval'         => 'month',
        'publishable_key'  => $config['stripe_publishable'],
        'reused'           => $reused,
    ]);
}
