<?php
/**
 * Turns Stripe subscription events into WordPress facts.
 *
 * Included by stripe-webhook.php after the signature has been verified. Kept in
 * its own file because the two funnels sharing that endpoint share nothing else:
 * a one-off payment is keyed by PaymentIntent and delivered once, a subscription
 * is keyed by invoice and delivers again every month for years.
 *
 * Field locations follow the API version this account is pinned to
 * (2026-06-24.dahlia). Two of them moved in the 2025-03-31.basil release and are
 * the kind of thing that fails silently rather than loudly:
 *
 *   - `invoice.subscription` is gone. The subscription is now at
 *     `invoice.parent.subscription_details.subscription`, valid only when
 *     `invoice.parent.type` is `subscription_details`.
 *   - `subscription.current_period_end` is gone. Billing periods moved down to
 *     the items: `subscription.items.data[].current_period_end`.
 *
 * Reading the old paths would have yielded null, not an error — an invoice that
 * looked like it belonged to no subscription, and a renewal date of 1970.
 */

declare(strict_types=1);

/**
 * Handles one subscription event and sends the HTTP response.
 *
 * Response discipline is the same as the one-time funnel's: 500 for anything a
 * retry could still fix (Stripe retries for 72 hours), 200 for anything it
 * cannot — an event that is not ours, or one whose data is permanently
 * unusable. A 200 on recoverable work would strand a paying subscriber.
 */
function gm_en_handle_subscription_event(array $event, string $eventId, string $eventType): void
{
    $object = $event['data']['object'] ?? [];
    if (!is_array($object)) {
        http_response_code(200);
        echo json_encode(['received' => true, 'ignored' => 'malformed object']);
        return;
    }

    $payload = ('customer.subscription.deleted' === $eventType || 'customer.subscription.updated' === $eventType)
        ? gm_en_subscription_payload_from_subscription($object, $eventType)
        : gm_en_subscription_payload_from_invoice($object, $eventType);

    if (null === $payload) {
        // Not ours, or nothing to do. Already logged by the builder.
        http_response_code(200);
        echo json_encode(['received' => true, 'ignored' => 'not this funnel']);
        return;
    }

    gm_en_save_payload(
        gmdate('Y-m-d_H-i-s') . '_sub_' . ($payload['invoice_id'] ?: $payload['stripe_subscription']) . '.json',
        ['event_id' => $eventId, 'event_type' => $eventType, 'payload' => $payload, 'ts' => gmdate('c')]
    );

    $result = gm_en_call_subscription_bridge($payload);

    if (!$result['success']) {
        gm_en_log('error', 'Subscription bridge call failed — asking Stripe to retry', [
            'event_id'   => $eventId,
            'event_type' => $eventType,
            'stripe_sub' => $payload['stripe_subscription'],
            'invoice'    => $payload['invoice_id'],
            'status'     => $result['status'],
            'error'      => $result['error'],
            'body'       => $result['body'],
        ]);
        gm_en_alert_admin(
            'EN subscription bridge failure',
            "Event: $eventType\nSubscription: {$payload['stripe_subscription']}\nInvoice: {$payload['invoice_id']}\n"
            . "E-mail: {$payload['email']}\nBridge status: {$result['status']}\nError: {$result['error']}\n\n"
            . "Stripe will retry automatically. The subscriber has PAID but may not have access yet."
        );
        http_response_code(500);
        echo json_encode(['error' => 'bridge failed, will retry']);
        return;
    }

    gm_en_log('info', 'Subscription event mirrored', [
        'event_id'        => $eventId,
        'event_type'      => $eventType,
        'stripe_sub'      => $payload['stripe_subscription'],
        'invoice'         => $payload['invoice_id'],
        'order_id'        => $result['body']['order_id'] ?? null,
        'subscription_id' => $result['body']['subscription_id'] ?? null,
        'duplicate'       => !empty($result['body']['duplicate']),
    ]);

    http_response_code(200);
    echo json_encode([
        'received'        => true,
        'order_id'        => $result['body']['order_id'] ?? null,
        'subscription_id' => $result['body']['subscription_id'] ?? null,
    ]);
}

/**
 * Builds the bridge payload from an Invoice event.
 *
 * @return array|null null when the invoice is not ours.
 */
function gm_en_subscription_payload_from_invoice(array $invoice, string $eventType): ?array
{
    $parent = $invoice['parent'] ?? [];
    if (!is_array($parent) || 'subscription_details' !== (string) ($parent['type'] ?? '')) {
        // A one-off invoice, or an invoice from another integration on this
        // account. Nothing here to act on.
        return null;
    }

    $details    = is_array($parent['subscription_details'] ?? null) ? $parent['subscription_details'] : [];
    $stripeSub  = (string) ($details['subscription'] ?? '');
    $metadata   = is_array($details['metadata'] ?? null) ? $details['metadata'] : [];

    // Positive identification, the same rule the one-time funnel learned the
    // hard way: claim only what proves it is ours. `subscription_details.metadata`
    // is a snapshot of the subscription's metadata taken when the invoice was
    // created, so it survives on renewals a year from now.
    if ('en' !== (string) ($metadata['lang'] ?? '') || 'subscription' !== (string) ($metadata['kind'] ?? '')) {
        gm_en_log('info', 'Subscription invoice is not this funnel\'s — dropped', [
            'invoice' => (string) ($invoice['id'] ?? ''),
            'sub'     => $stripeSub,
        ]);
        return null;
    }
    if ('' === $stripeSub) {
        gm_en_log('error', 'Our subscription invoice carries no subscription id', ['invoice' => (string) ($invoice['id'] ?? '')]);
        return null;
    }

    $email = trim((string) ($metadata['email'] ?? ''));
    if ('' === $email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $email = trim((string) ($invoice['customer_email'] ?? ''));
    }
    if ('' === $email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        // Money moved and we cannot deliver. A retry cannot invent an address,
        // so this is acknowledged and alerted rather than hammered for 72 hours.
        gm_en_log('error', 'Paid subscription invoice has no usable e-mail', [
            'invoice' => (string) ($invoice['id'] ?? ''),
            'sub'     => $stripeSub,
        ]);
        gm_en_alert_admin(
            'Paid subscription invoice with no e-mail',
            "Subscription: $stripeSub\nInvoice: " . (string) ($invoice['id'] ?? '') . "\n\n"
            . "The invoice was paid but carries no e-mail address, so no order could be created. Create it by hand.",
            true
        );
        return null;
    }

    return [
        'event'               => 'invoice.paid' === $eventType ? 'invoice_paid' : 'payment_failed',
        'invoice_id'          => (string) ($invoice['id'] ?? ''),
        'stripe_subscription' => $stripeSub,
        'stripe_customer'     => (string) ($invoice['customer'] ?? ''),
        'billing_reason'      => (string) ($invoice['billing_reason'] ?? ''),
        'amount_cent'         => (int) ($invoice['amount_paid'] ?? 0),
        'currency'            => strtoupper((string) ($invoice['currency'] ?? 'eur')),
        'payment_intent'      => gm_en_invoice_payment_intent($invoice),
        'period_end'          => gm_en_subscription_period_end($stripeSub),
    ] + gm_en_subscription_customer_fields($metadata, $email);
}

/**
 * Builds the bridge payload from a Subscription event.
 *
 * @return array|null
 */
function gm_en_subscription_payload_from_subscription(array $subscription, string $eventType): ?array
{
    $metadata = is_array($subscription['metadata'] ?? null) ? $subscription['metadata'] : [];
    if ('en' !== (string) ($metadata['lang'] ?? '') || 'subscription' !== (string) ($metadata['kind'] ?? '')) {
        return null;
    }

    $status = (string) ($subscription['status'] ?? '');
    $isGone = 'customer.subscription.deleted' === $eventType || in_array($status, ['canceled', 'incomplete_expired'], true);

    // An `updated` event fires for many harmless reasons (a card change, a
    // period roll). Only cancellation and the period refresh are acted on; the
    // rest would be write traffic with no new information.
    if (!$isGone && 'customer.subscription.updated' === $eventType && 'active' !== $status) {
        return null;
    }

    $email = trim((string) ($metadata['email'] ?? ''));

    return [
        'event'               => $isGone ? 'cancelled' : 'status_changed',
        'invoice_id'          => '',
        'stripe_subscription' => (string) ($subscription['id'] ?? ''),
        'stripe_customer'     => (string) ($subscription['customer'] ?? ''),
        'status'              => $status,
        'period_end'          => gm_en_subscription_period_end_from_object($subscription),
    ] + gm_en_subscription_customer_fields($metadata, $email);
}

/** The customer-shaped fields both payload builders share. */
function gm_en_subscription_customer_fields(array $metadata, string $email): array
{
    $fields = [
        'email' => $email,
        'plan'  => (string) ($metadata['plan'] ?? ''),
    ];
    foreach (['first_name', 'last_name', 'country', 'city', 'postcode', 'address', 'company', 'vat_number'] as $key) {
        $fields[$key] = (string) ($metadata[$key] ?? '');
    }
    foreach (['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbc', 'fbp', 'gclid', 'ga_client_id'] as $key) {
        if (!empty($metadata[$key])) {
            $fields[$key] = (string) $metadata[$key];
        }
    }
    return $fields;
}

/**
 * Next charge date, read from the SUBSCRIPTION ITEM.
 *
 * Since 2025-03-31.basil each item carries its own billing period and the
 * subscription-level fields are gone. Our subscriptions always have exactly one
 * item, so the first item's period is the subscription's period — but reading
 * `$subscription['current_period_end']` would return null for ever, and null
 * formats as 1970 rather than raising anything.
 */
function gm_en_subscription_period_end(string $subscriptionId): int
{
    if ('' === $subscriptionId) {
        return 0;
    }
    $res = gm_en_stripe('GET', '/subscriptions/' . $subscriptionId);
    if (200 !== $res['status']) {
        gm_en_log('error', 'Could not read the subscription for its period end', [
            'sub'    => $subscriptionId,
            'status' => $res['status'],
        ]);
        return 0;
    }
    return gm_en_subscription_period_end_from_object($res['body']);
}

function gm_en_subscription_period_end_from_object(array $subscription): int
{
    $items = $subscription['items']['data'] ?? [];
    if (!is_array($items) || !isset($items[0])) {
        return 0;
    }
    return (int) ($items[0]['current_period_end'] ?? 0);
}

/**
 * The PaymentIntent behind a paid invoice, when there is one.
 *
 * Optional on purpose: it is useful for reconciling against a Stripe payout, but
 * nothing about access depends on it, and the shape of `invoice.payments` is
 * newer than the rest of this integration. A missing value must not stop a
 * subscriber from getting what they paid for.
 */
function gm_en_invoice_payment_intent(array $invoice): string
{
    $payments = $invoice['payments']['data'] ?? [];
    if (is_array($payments) && isset($payments[0])) {
        $pi = $payments[0]['payment']['payment_intent'] ?? '';
        if (is_string($pi) && '' !== $pi) {
            return $pi;
        }
    }
    return '';
}
