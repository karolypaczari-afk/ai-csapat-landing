<?php
/**
 * Manual recovery: re-sends a saved webhook payload to the WordPress bridge.
 *
 * Needed when Stripe has exhausted its retries (72 hours) or when the bridge
 * was broken for longer than that. Because the plugin keys orders by
 * PaymentIntent, replaying an event that already produced an order is safe —
 * it returns the existing order rather than creating a second one.
 *
 * Authenticated with the same shared secret as the bridge itself.
 *
 *   GET  ?list=1              — saved payloads awaiting replay
 *   POST {"payment_intent":…} — replay one
 */

declare(strict_types=1);

require __DIR__ . '/_lib.php';

$config = gm_en_config();
$presented = $_SERVER['HTTP_X_GM_EN_SECRET'] ?? '';
if (!is_string($presented) || '' === $presented || !hash_equals($config['bridge_secret'], $presented)) {
    gm_en_log('error', 'Replay endpoint: bad credentials', ['ip' => $_SERVER['REMOTE_ADDR'] ?? '']);
    gm_en_json(['error' => 'forbidden'], 403);
}

$dir = gm_en_log_dir();

if ('GET' === ($_SERVER['REQUEST_METHOD'] ?? '')) {
    $items = [];
    foreach ((array) glob($dir . '/*.json') as $file) {
        $data = json_decode((string) file_get_contents($file), true);
        if (!is_array($data) || empty($data['pi'])) {
            continue;
        }
        $items[] = [
            'file'           => basename($file),
            'payment_intent' => $data['pi'],
            'amount'         => $data['amount'] ?? null,
            'currency'       => $data['currency'] ?? null,
            'email'          => $data['metadata']['email'] ?? null,
            'plan'           => $data['metadata']['plan'] ?? null,
            'ts'             => $data['ts'] ?? null,
        ];
    }
    usort($items, static fn ($a, $b) => strcmp((string) $b['ts'], (string) $a['ts']));
    gm_en_json(['count' => count($items), 'payloads' => $items]);
}

if ('POST' !== ($_SERVER['REQUEST_METHOD'] ?? '')) {
    gm_en_json(['error' => 'method not allowed'], 405);
}

$input = gm_en_read_json_body();
$wanted = isset($input['payment_intent']) ? preg_replace('/[^a-zA-Z0-9_]/', '', (string) $input['payment_intent']) : '';
if ('' === $wanted) {
    gm_en_json(['error' => 'payment_intent required'], 400);
}

$found = null;
foreach ((array) glob($dir . '/*.json') as $file) {
    $data = json_decode((string) file_get_contents($file), true);
    if (is_array($data) && ($data['pi'] ?? '') === $wanted) {
        $found = $data;
        break;
    }
}
if (!$found) {
    gm_en_json(['error' => 'no saved payload for that payment_intent'], 404);
}

$metadata = is_array($found['metadata'] ?? null) ? $found['metadata'] : [];
$email = (string) ($metadata['email'] ?? '');
if ('' === $email) {
    gm_en_json(['error' => 'saved payload has no email — create the order manually'], 422);
}

$payload = [
    'email'          => $email,
    'plan'           => (string) ($metadata['plan'] ?? ''),
    'bump'           => !empty($metadata['bump']) && '0' !== $metadata['bump'],
    'first_name'     => (string) ($metadata['first_name'] ?? ''),
    'last_name'      => (string) ($metadata['last_name'] ?? ''),
    'country'        => (string) ($metadata['country'] ?? ''),
    'city'           => (string) ($metadata['city'] ?? ''),
    'postcode'       => (string) ($metadata['postcode'] ?? ''),
    'address'        => (string) ($metadata['address'] ?? ''),
    'company'        => (string) ($metadata['company'] ?? ''),
    'vat_number'     => (string) ($metadata['vat_number'] ?? ''),
    'payment_intent' => (string) $found['pi'],
    'amount_cent'    => (int) ($found['amount'] ?? 0),
    'currency'       => (string) ($found['currency'] ?? 'EUR'),
];

$result = gm_en_call_bridge($payload);
gm_en_log($result['success'] ? 'info' : 'error', 'Manual replay', [
    'pi'      => $wanted,
    'success' => $result['success'],
    'status'  => $result['status'],
]);

gm_en_json(
    [
        'success' => $result['success'],
        'status'  => $result['status'],
        'body'    => $result['body'],
    ],
    $result['success'] ? 200 : 502
);
