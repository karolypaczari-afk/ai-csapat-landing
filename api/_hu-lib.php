<?php
/**
 * Shared plumbing for the Hungarian checkout endpoints.
 *
 * Lives next to the English ones and deliberately reuses their generic parts
 * (Stripe client, logging, CORS, JSON, signature verification) from _lib.php.
 * Those helpers still carry a `gm_en_` prefix: renaming them would mean editing
 * files that a LIVE, money-taking funnel runs on, for no behavioural gain. The
 * prefix is historical, not a statement about scope.
 *
 * What is NOT shared: prices, currency, bridge URL, bridge secret and payment
 * method configuration. Those are the things that must never leak between the
 * two funnels, so each one owns its own.
 *
 * The file name starts with an underscore on purpose — .htaccess denies `^_`,
 * so this is not reachable as an endpoint.
 */

declare(strict_types=1);

require_once __DIR__ . '/_lib.php';

const GM_HU_ALLOWED_ORIGIN = 'https://ai-csapat.genmarketer.hu';

/**
 * Prices in fillér (HUF × 100).
 *
 * Stripe treats HUF as a TWO-DECIMAL currency for charges: 69 990 Ft is
 * 6_999_000, not 69_990. Sending the plain forint amount would charge 699,90 Ft
 * and the mistake is invisible until a real payout. (The "must be divisible by
 * 100" rule that HUF also has applies to payouts, not charges — our whole-forint
 * prices satisfy it anyway.)
 *
 * As with the English funnel: the browser may ask for a plan, never a price.
 */
const GM_HU_PRICES = [
    'kepzes'       => 3499000, // 34 990 Ft — „Az AI csapatod – Képzés" (Woo 872)
    'konzultacio'  => 11999000, // 119 990 Ft — „… Képzés + Konzultáció" (Woo 873)
];
const GM_HU_BUMP_PRICE = 2999000; // 29 990 Ft — extra konzultációs óra
const GM_HU_CURRENCY   = 'huf';

/** Anchor ("Később …") prices shown struck through, mirroring the live landing. */
const GM_HU_ANCHORS = [
    'kepzes'      => 8999000,
    'konzultacio' => 14999000,
];

/**
 * HU-specific configuration, read from the same _secrets.php as the English
 * funnel. The Stripe account is shared; everything else is separate.
 *
 * @return array{bridge_url:string,bridge_secret:string,pmc:string}
 */
function gm_hu_config(): array
{
    $config = gm_en_config();
    foreach (['hu_bridge_url', 'hu_bridge_secret'] as $key) {
        if (empty($config[$key])) {
            gm_en_fail(500, 'server_misconfigured', 'A pénztár nincs beállítva ezen a szerveren.');
        }
    }
    return [
        'bridge_url'    => (string) $config['hu_bridge_url'],
        'bridge_secret' => (string) $config['hu_bridge_secret'],
        'pmc'           => (string) ($config['hu_pmc'] ?? ''),
    ];
}

function gm_hu_log(string $level, string $message, array $context = []): void
{
    gm_en_log($level, '[hu] ' . $message, $context);
}

function gm_hu_cors(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (GM_HU_ALLOWED_ORIGIN === $origin) {
        header('Access-Control-Allow-Origin: ' . GM_HU_ALLOWED_ORIGIN);
        header('Vary: Origin');
        header('Access-Control-Allow-Headers: Content-Type');
        header('Access-Control-Allow-Methods: POST, OPTIONS');
    }
    if ('OPTIONS' === ($_SERVER['REQUEST_METHOD'] ?? '')) {
        http_response_code(204);
        exit;
    }
}

/**
 * Computes the amount from the plan and bump flag alone.
 *
 * @return array{amount:int,plan:string,bump:bool}
 */
function gm_hu_resolve_amount(string $plan, bool $bump): array
{
    if (!isset(GM_HU_PRICES[$plan])) {
        gm_en_fail(400, 'unknown_plan', 'Ismeretlen csomag.', ['plan' => $plan]);
    }
    $amount = GM_HU_PRICES[$plan];
    if ($bump) {
        $amount += GM_HU_BUMP_PRICE;
    }
    return ['amount' => $amount, 'plan' => $plan, 'bump' => $bump];
}

/**
 * Calls a route on the gm-hu-checkout plugin.
 *
 * @return array{success:bool,status:int,body:array,error:string}
 */
function gm_hu_call_bridge(array $payload, string $route = ''): array
{
    $config = gm_hu_config();
    $url = '' === $route
        ? $config['bridge_url']
        : preg_replace('#/[a-z-]+$#', '/' . $route, $config['bridge_url']);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 45,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json; charset=utf-8',
            'X-GM-HU-Secret: ' . $config['bridge_secret'],
        ],
        CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
    ]);

    $raw    = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err    = curl_error($ch);
    curl_close($ch);

    $body = json_decode((string) $raw, true);

    return [
        'success' => !$err && $status >= 200 && $status < 300,
        'status'  => $status,
        'body'    => is_array($body) ? $body : [],
        'error'   => $err ?: ('HTTP ' . $status),
    ];
}

/**
 * Is the Hungarian funnel open for business?
 *
 * This is the funnel's on/off switch, and it is asked BEFORE any payment can
 * start — not only when the order is created. The English funnel could use
 * "leave the products unpublished" as its switch, but products 872/873 are the
 * live CartFlows funnel's products and must stay published. So the switch is
 * explicit instead, and it is checked at create-intent time.
 *
 * The ordering matters and is the whole point: if the gate only sat on the
 * bridge, a customer could pay while the funnel was closed and we would have
 * their money with no order against it.
 *
 * @return array{open:bool,reason:string}
 */
function gm_hu_funnel_state(): array
{
    $res = gm_hu_call_bridge([], 'state');
    if (!$res['success']) {
        // Fail CLOSED. If we cannot reach WordPress we cannot create the order
        // either, so taking a payment would strand it.
        gm_hu_log('error', 'Funnel state check failed — treating as closed', ['status' => $res['status']]);
        return ['open' => false, 'reason' => 'bridge_unreachable'];
    }
    return [
        'open'   => !empty($res['body']['open']),
        'reason' => (string) ($res['body']['reason'] ?? ''),
    ];
}

/**
 * Asks WordPress what a coupon code is worth on this order.
 *
 * @return array{valid:bool,discount_cent:int,label:string,code:string,reason:string}
 */
function gm_hu_validate_coupon(string $code, int $subtotalCent, array $productIds = []): array
{
    $fail = ['valid' => false, 'discount_cent' => 0, 'label' => '', 'code' => '', 'reason' => 'Ez a kód nem érvényes.'];
    if ('' === trim($code)) {
        return $fail;
    }

    $res = gm_hu_call_bridge([
        'code'          => $code,
        'subtotal_cent' => $subtotalCent,
        'product_ids'   => $productIds,
    ], 'validate-coupon');

    if (!$res['success']) {
        gm_hu_log('error', 'Coupon validation call failed', ['status' => $res['status']]);
        return $fail;
    }

    $body = $res['body'];
    if (empty($body['valid'])) {
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

/** Forint formatting for server-rendered strings: „69 990 Ft" (NBSP thousands). */
function gm_hu_format_ft(int $cent): string
{
    return number_format($cent / 100, 0, ',', "\u{00A0}") . "\u{00A0}Ft";
}
