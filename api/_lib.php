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

/** Rate-limited operator alert; a broken bridge must not send hundreds of mails. */
function gm_en_alert_admin(string $subject, string $body): void
{
    $config = gm_en_config();
    if (empty($config['admin_email'])) {
        return;
    }
    $lock = gm_en_log_dir() . '/.last_alert';
    if (is_file($lock) && (time() - (int) file_get_contents($lock)) < 900) {
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
