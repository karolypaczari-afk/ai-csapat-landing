<?php
/**
 * Shared plumbing for the English checkout endpoints.
 *
 * These files live in the ai-csapat.genmarketer.hu document root, which is fed
 * by a PUBLIC git mirror. Nothing secret may ever be committed here: the real
 * credentials live in _secrets.php, which is uploaded out of band and blocked
 * by .htaccess.
 */

declare(strict_types=1);

const GM_EN_API_VERSION   = '1.0.0';
const GM_EN_STRIPE_API    = '2026-06-24.dahlia';
const GM_EN_ALLOWED_ORIGIN = 'https://ai-csapat.genmarketer.hu';

/** Prices are the server's business. The browser may ask for a plan, never a price. */
const GM_EN_PRICES = [
    'training'     => 18900, // 189.00 EUR, in cents
    'consultation' => 28900, // 289.00 EUR
];
const GM_EN_BUMP_PRICE = 7900; // 79.00 EUR — extra consultation hour
const GM_EN_CURRENCY   = 'eur';

/**
 * The monthly plans.
 *
 * The amount is NOT sent to Stripe for these — a subscription is billed against
 * a Price object, and the Price is the single source of truth for what recurs.
 * The cents here exist only so the summary in the browser and the server agree,
 * and so a mismatch between this file and Stripe is detectable rather than
 * silent (api/health.php compares them).
 *
 * Prices are looked up by `lookup_key`, never by name. Stripe enforces
 * uniqueness on the lookup key and on nothing else: a script that searched by
 * product name would happily create a second product with a second recurring
 * price, and customers would end up split across two of them.
 */
const GM_EN_SUBSCRIPTION_PLANS = [
    'planner' => [
        'lookup_key' => 'gm_en_ai_team_planner_monthly_eur',
        'amount'     => 2900, // 29.00 EUR / month
        'label'      => 'Your AI Team — Planner',
    ],
    'autopilot' => [
        'lookup_key' => 'gm_en_ai_team_autopilot_monthly_eur',
        'amount'     => 5900, // 59.00 EUR / month
        'label'      => 'Your AI Team — Autopilot',
    ],
];

/**
 * The order bump, charged ONCE on the first invoice.
 *
 * It goes on the subscription through `add_invoice_items`, which takes a Price
 * — hence a real one-off Price rather than an ad-hoc amount, so the customer's
 * invoice shows a named line instead of an anonymous charge.
 */
const GM_EN_SUBSCRIPTION_BUMP = [
    'lookup_key' => 'gm_en_consult_hour_once_eur',
    'amount'     => 7900, // 79.00 EUR, one-off
    'label'      => 'Extra consultation hour',
];

/**
 * @return array{stripe_secret:string,stripe_publishable:string,webhook_secret:string,bridge_secret:string,bridge_url:string,mode:string,pmc:string,admin_email:string}
 */
function gm_en_config(): array
{
    static $config = null;
    if (null !== $config) {
        return $config;
    }
    $path = __DIR__ . '/_secrets.php';
    if (!is_readable($path)) {
        gm_en_fail(500, 'server_misconfigured', 'Checkout is not configured on this server.');
    }
    /** @var array $loaded */
    $loaded = require $path;
    $required = ['stripe_secret', 'stripe_publishable', 'webhook_secret', 'bridge_secret', 'bridge_url'];
    foreach ($required as $key) {
        if (empty($loaded[$key])) {
            gm_en_fail(500, 'server_misconfigured', 'Checkout configuration is incomplete.');
        }
    }
    $config = $loaded + ['mode' => 'test', 'pmc' => '', 'admin_email' => ''];
    return $config;
}

// ── Logging ─────────────────────────────────────────────────────────────────
//
// A payment that Stripe accepted but we failed to record is the worst outcome
// here, so every failure keeps its full payload for replay.

function gm_en_log_dir(): string
{
    $dir = __DIR__ . '/_logs';
    if (!is_dir($dir)) {
        @mkdir($dir, 0750, true);
        @file_put_contents($dir . '/.htaccess', "Require all denied\nDeny from all\n");
        @file_put_contents($dir . '/index.html', '');
    }
    return $dir;
}

function gm_en_scrub($data)
{
    if (!is_array($data)) {
        return $data;
    }
    $out = [];
    foreach ($data as $k => $v) {
        if (preg_match('/secret|token|password|authorization|signature/i', (string) $k)) {
            $out[$k] = '[redacted]';
        } elseif (is_array($v)) {
            $out[$k] = gm_en_scrub($v);
        } else {
            $out[$k] = $v;
        }
    }
    return $out;
}

function gm_en_log(string $level, string $message, array $context = []): void
{
    $dir  = gm_en_log_dir();
    $line = [
        'ts'      => gmdate('c'),
        'level'   => $level,
        'message' => $message,
        'context' => gm_en_scrub($context),
    ];
    @file_put_contents(
        $dir . '/' . gmdate('Y-m-d') . '.log',
        json_encode($line, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n",
        FILE_APPEND | LOCK_EX
    );
    if ('error' === $level) {
        error_log('[gm-en] ' . $message);
    }
}

/** Keeps the raw event so a failed hand-off can be replayed by hand. */
function gm_en_save_payload(string $name, array $data): void
{
    @file_put_contents(
        gm_en_log_dir() . '/' . $name,
        json_encode(gm_en_scrub($data), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
    );
}

// ── HTTP helpers ────────────────────────────────────────────────────────────

function gm_en_cors(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (GM_EN_ALLOWED_ORIGIN === $origin) {
        header('Access-Control-Allow-Origin: ' . GM_EN_ALLOWED_ORIGIN);
        header('Vary: Origin');
        header('Access-Control-Allow-Headers: Content-Type');
        header('Access-Control-Allow-Methods: POST, OPTIONS');
    }
    if ('OPTIONS' === ($_SERVER['REQUEST_METHOD'] ?? '')) {
        http_response_code(204);
        exit;
    }
}

function gm_en_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Customer-facing errors stay vague on purpose; the detail goes to the log.
 * An attacker probing this endpoint should learn nothing about the internals.
 */
function gm_en_fail(int $status, string $code, string $message, array $context = []): void
{
    if ($context) {
        gm_en_log('error', $code . ': ' . $message, $context);
    }
    gm_en_json(['error' => ['code' => $code, 'message' => $message]], $status);
}

function gm_en_read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if (false === $raw || '' === $raw) {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

// ── Stripe ──────────────────────────────────────────────────────────────────

/**
 * Minimal Stripe REST client. The official PHP SDK would need Composer on a
 * static-site host; a handful of form-encoded calls does not justify that.
 *
 * @return array{status:int,body:array}
 */
function gm_en_stripe(string $method, string $path, array $params = []): array
{
    $config = gm_en_config();
    $url    = 'https://api.stripe.com/v1' . $path;

    $ch = curl_init();
    $headers = [
        'Authorization: Bearer ' . $config['stripe_secret'],
        'Stripe-Version: ' . GM_EN_STRIPE_API,
    ];

    if ('GET' === $method) {
        if ($params) {
            $url .= '?' . http_build_query($params);
        }
    } else {
        $headers[] = 'Content-Type: application/x-www-form-urlencoded';
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params));
    }

    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_HTTPHEADER     => $headers,
    ]);

    $raw    = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err    = curl_error($ch);
    curl_close($ch);

    if ($err) {
        gm_en_log('error', 'Stripe transport error', ['path' => $path, 'error' => $err]);
        return ['status' => 0, 'body' => ['error' => ['message' => $err]]];
    }

    $body = json_decode((string) $raw, true);
    return ['status' => $status, 'body' => is_array($body) ? $body : []];
}

/**
 * Verifies a Stripe webhook signature.
 *
 * Implemented by hand for the same reason as the client above. Two properties
 * matter and both are easy to get wrong: the comparison must be timing-safe,
 * and the timestamp must be checked so a captured request cannot be replayed
 * later.
 */
function gm_en_verify_stripe_signature(string $payload, string $header, string $secret, int $tolerance = 300): bool
{
    if ('' === $header || '' === $secret) {
        return false;
    }

    $timestamp = null;
    $signatures = [];
    foreach (explode(',', $header) as $part) {
        $kv = explode('=', trim($part), 2);
        if (2 !== count($kv)) {
            continue;
        }
        if ('t' === $kv[0]) {
            $timestamp = (int) $kv[1];
        } elseif ('v1' === $kv[0]) {
            $signatures[] = $kv[1];
        }
    }

    if (null === $timestamp || !$signatures) {
        return false;
    }
    if (abs(time() - $timestamp) > $tolerance) {
        gm_en_log('error', 'Webhook signature outside tolerance window', ['skew' => time() - $timestamp]);
        return false;
    }

    $expected = hash_hmac('sha256', $timestamp . '.' . $payload, $secret);
    foreach ($signatures as $candidate) {
        if (hash_equals($expected, $candidate)) {
            return true;
        }
    }
    return false;
}

/**
 * Names the other gateway when an intent was created by one, otherwise ''.
 *
 * The funnel guard already drops anything without our own language tag, so this
 * is a second, independent lock — deliberately so. The WooCommerce shop on
 * tudastar is the live Hungarian sales channel: an order created there must
 * never be touched by these endpoints, and a duplicate would be a real order
 * with a real invoice. One guard reading one field is not enough insurance for
 * that, especially now that a missing address can be recovered from the charge:
 * without this lock, a mis-tagged intent would resolve an e-mail and go on to
 * create a second order for a customer who already paid once.
 *
 * These keys are written by the Payment Plugins Stripe gateway and never by our
 * own checkout, which stamps `plan`, `lang` and `source` instead.
 */
function gm_en_foreign_gateway(array $metadata): string
{
    foreach (['order_id', 'gateway_id', 'partner', 'webhook_id'] as $key) {
        if ('' !== trim((string) ($metadata[$key] ?? ''))) {
            return $key;
        }
    }
    return '';
}

/**
 * Finds the customer's e-mail on a paid intent.
 *
 * Our checkout puts it in metadata, and a wallet payment copies the address the
 * wallet supplied onto the intent before confirming — but that update is one
 * more network call in the browser, and a payment that is already `processing`
 * will not accept it. When it does not land, the address is still on the charge
 * that Stripe created, so we go and read it there rather than strand a paying
 * customer. The webhook payload only carries the charge ID, hence the lookup.
 *
 * Callers must have established that the intent is ours before calling this:
 * on a foreign funnel's payment this would happily return an e-mail and we
 * would create a duplicate order for someone else's customer.
 */
function gm_en_resolve_email(array $pi): string
{
    foreach ([$pi['metadata']['email'] ?? '', $pi['receipt_email'] ?? ''] as $candidate) {
        $candidate = trim((string) $candidate);
        if ('' !== $candidate && filter_var($candidate, FILTER_VALIDATE_EMAIL)) {
            return $candidate;
        }
    }

    $charge = $pi['latest_charge'] ?? null;
    if (is_array($charge)) {
        $fromCharge = (string) ($charge['billing_details']['email'] ?? '');
    } elseif (is_string($charge) && '' !== $charge) {
        $result     = gm_en_stripe('GET', '/charges/' . $charge);
        $fromCharge = (string) ($result['body']['billing_details']['email'] ?? '');
    } else {
        return '';
    }

    $fromCharge = trim($fromCharge);
    return ('' !== $fromCharge && filter_var($fromCharge, FILTER_VALIDATE_EMAIL)) ? $fromCharge : '';
}

// ── WordPress bridge ────────────────────────────────────────────────────────

/**
 * Hands a confirmed payment to the gm-en-checkout plugin.
 *
 * @return array{success:bool,status:int,body:array,error:string}
 */
function gm_en_call_bridge(array $payload): array
{
    $config = gm_en_config();

    $ch = curl_init($config['bridge_url']);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 45,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json; charset=utf-8',
            'X-GM-EN-Secret: ' . $config['bridge_secret'],
        ],
        CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
    ]);

    $raw    = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err    = curl_error($ch);
    curl_close($ch);

    $success = !$err && $status >= 200 && $status < 300;
    $body    = json_decode((string) $raw, true);

    return [
        'success' => $success,
        'status'  => $status,
        'body'    => is_array($body) ? $body : [],
        'error'   => $err ?: ('HTTP ' . $status),
    ];
}

/**
 * Rate-limited operator alert; a broken bridge must not send hundreds of mails.
 *
 * The throttle is per SUBJECT, not global. With one shared lock a chatty bridge
 * failure would have silenced the far more serious "money arrived, no order"
 * alert for fifteen minutes — and both funnels share this log directory, so an
 * English alert would have swallowed a Hungarian one.
 *
 * $force skips the throttle. Use it only where the caller guarantees the alert
 * fires once per event (no Stripe retry behind it), otherwise the throttle is
 * the only thing standing between a stuck webhook and a flooded inbox.
 */
function gm_en_alert_admin(string $subject, string $body, bool $force = false): void
{
    $config = gm_en_config();
    if (empty($config['admin_email'])) {
        return;
    }
    $lock = gm_en_log_dir() . '/.last_alert_' . substr(md5($subject), 0, 12);
    if (!$force && is_file($lock) && (time() - (int) file_get_contents($lock)) < 900) {
        return;
    }
    @mail(
        $config['admin_email'],
        '[GENmarketer EN] ' . $subject,
        $body,
        "From: noreply@genmarketer.hu\r\nContent-Type: text/plain; charset=UTF-8\r\n"
    );
    @file_put_contents($lock, (string) time());
}

// ── Pricing ─────────────────────────────────────────────────────────────────

/**
 * Computes the amount to charge from the plan and bump flag alone.
 *
 * The browser never sends a price. If it could, a modified request would buy
 * the pack for a cent — the single most common flaw in hand-rolled checkouts.
 *
 * @return array{amount:int,plan:string,bump:bool}
 */
function gm_en_resolve_amount(string $plan, bool $bump): array
{
    if (!isset(GM_EN_PRICES[$plan])) {
        gm_en_fail(400, 'unknown_plan', 'Unknown plan.', ['plan' => $plan]);
    }
    $amount = GM_EN_PRICES[$plan];
    if ($bump) {
        $amount += GM_EN_BUMP_PRICE;
    }
    return ['amount' => $amount, 'plan' => $plan, 'bump' => $bump];
}

// ── Subscriptions ───────────────────────────────────────────────────────────

/**
 * The events the subscription funnel acts on.
 *
 * `invoice.paid` is the one that grants access — for the first invoice and for
 * every renewal alike. Provisioning on `customer.subscription.created` instead
 * would hand out access before the money arrived.
 */
const GM_EN_SUBSCRIPTION_EVENTS = [
    'invoice.paid',
    'invoice.payment_failed',
    'customer.subscription.updated',
    'customer.subscription.deleted',
];

/**
 * Resolves a plan slug to the live Stripe Price id.
 *
 * Looked up by `lookup_key` at request time rather than pinned in _secrets.php,
 * so the test and live modes each find their own price with no extra config and
 * no chance of a live checkout quoting a test price. The result is cached for
 * the request; Stripe's lookup endpoint is fast but this runs on every step.
 */
function gm_en_subscription_price_id(string $plan): string
{
    if (!isset(GM_EN_SUBSCRIPTION_PLANS[$plan])) {
        return '';
    }
    return gm_en_lookup_price(
        GM_EN_SUBSCRIPTION_PLANS[$plan]['lookup_key'],
        GM_EN_SUBSCRIPTION_PLANS[$plan]['amount'],
        'month'
    );
}

/** The one-off bump price. Same discipline, no recurring interval. */
function gm_en_bump_price_id(): string
{
    return gm_en_lookup_price(GM_EN_SUBSCRIPTION_BUMP['lookup_key'], GM_EN_SUBSCRIPTION_BUMP['amount'], '');
}

/**
 * @param string $expectInterval '' for a one-off price, otherwise 'month' etc.
 */
function gm_en_lookup_price(string $key, int $expectAmount, string $expectInterval): string
{
    static $cache = [];
    if (isset($cache[$key])) {
        return $cache[$key];
    }

    $res = gm_en_stripe('GET', '/prices', ['lookup_keys' => [$key], 'active' => 'true', 'limit' => 2]);
    if (200 !== $res['status']) {
        gm_en_log('error', 'Price lookup failed', ['key' => $key, 'status' => $res['status']]);
        return '';
    }

    $rows = $res['body']['data'] ?? [];
    if (count($rows) !== 1) {
        // Zero means the price was never created in this mode; more than one means
        // the uniqueness guarantee we rely on has been broken. Neither may be
        // guessed past — quoting the wrong price is a recurring charge at the
        // wrong amount, discovered a month later.
        gm_en_log('error', 'Price lookup did not return exactly one price', [
            'key'   => $key,
            'found' => count($rows),
        ]);
        return '';
    }

    $price    = $rows[0];
    $currency = strtolower((string) ($price['currency'] ?? ''));
    $amount   = (int) ($price['unit_amount'] ?? 0);
    $interval = isset($price['recurring']['interval']) ? (string) $price['recurring']['interval'] : '';

    // The interval is asserted in BOTH directions. A one-off price that grew a
    // recurring interval would bill a single consultation hour every month, and
    // a monthly price that lost one would be charged exactly once and never
    // renew — two silent failures that look nothing like each other.
    if (GM_EN_CURRENCY !== $currency || $interval !== $expectInterval || $amount !== $expectAmount) {
        gm_en_log('error', 'Stripe price disagrees with the configured plan', [
            'key'              => $key,
            'currency'         => $currency,
            'interval'         => '' === $interval ? '(one-off)' : $interval,
            'expected_interval'=> '' === $expectInterval ? '(one-off)' : $expectInterval,
            'amount'           => $amount,
            'expected_amount'  => $expectAmount,
        ]);
        return '';
    }

    $cache[$key] = (string) $price['id'];
    return $cache[$key];
}

/**
 * Hands a subscription event to the gm-en-checkout plugin.
 *
 * Same shared-secret transport as the one-time bridge, different route: the
 * payloads and the idempotency keys differ, and a shared endpoint would have
 * made every change to one funnel a risk to the other.
 *
 * @return array{success:bool,status:int,body:array,error:string}
 */
function gm_en_call_subscription_bridge(array $payload): array
{
    $config = gm_en_config();
    $url    = str_replace('/checkout-complete', '/subscription-event', $config['bridge_url']);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 45,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json; charset=utf-8',
            'X-GM-EN-Secret: ' . $config['bridge_secret'],
        ],
        CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
    ]);

    $raw    = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err    = curl_error($ch);
    curl_close($ch);

    $success = !$err && $status >= 200 && $status < 300;
    $body    = json_decode((string) $raw, true);

    return [
        'success' => $success,
        'status'  => $status,
        'body'    => is_array($body) ? $body : [],
        'error'   => $err ?: ('HTTP ' . $status),
    ];
}

/**
 * Asks WordPress whether a coupon code is valid for this order.
 *
 * The discount is computed there, against the real WooCommerce coupon, so the
 * browser can neither invent a code nor a discount.
 *
 * @return array{valid:bool,discount_cent:int,label:string,code:string,reason:string}
 */
function gm_en_validate_coupon(string $code, int $subtotalCent, array $productIds = []): array
{
    $fail = ['valid' => false, 'discount_cent' => 0, 'label' => '', 'code' => '', 'reason' => 'That code is not valid.'];
    if ('' === trim($code)) {
        return $fail;
    }

    $config = gm_en_config();
    $url = str_replace('/checkout-complete', '/validate-coupon', $config['bridge_url']);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_CONNECTTIMEOUT => 6,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json; charset=utf-8',
            'X-GM-EN-Secret: ' . $config['bridge_secret'],
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'code'          => $code,
            'subtotal_cent' => $subtotalCent,
            'product_ids'   => $productIds,
        ]),
    ]);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if (200 !== $status) {
        gm_en_log('error', 'Coupon validation call failed', ['status' => $status]);
        return $fail;
    }

    $body = json_decode((string) $raw, true);
    if (!is_array($body) || empty($body['valid'])) {
        $fail['reason'] = isset($body['reason']) ? (string) $body['reason'] : $fail['reason'];
        return $fail;
    }

    return [
        'valid'         => true,
        'discount_cent' => (int) $body['discount_cent'],
        'label'         => (string) ($body['label'] ?? ''),
        'code'          => (string) ($body['code'] ?? $code),
        'reason'        => '',
    ];
}
