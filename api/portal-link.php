<?php
/**
 * E-mails a subscriber a signed, expiring link to their billing portal.
 *
 * Why not just open the portal from an e-mail box on the page: whoever can type
 * an address would then be able to cancel that person's subscription and read
 * their invoices. Sending the link to the address instead means the request is
 * only useful to someone who can already read that mailbox.
 *
 * The response is identical whether or not the address belongs to a subscriber.
 * Anything else turns this endpoint into a way of asking "does this person pay
 * you?", which is customer data we have no business confirming to a stranger.
 */

declare(strict_types=1);

require __DIR__ . '/_lib.php';

gm_en_cors();

if ('POST' !== ($_SERVER['REQUEST_METHOD'] ?? '')) {
    gm_en_fail(405, 'method_not_allowed', 'POST required.');
}

$input  = gm_en_read_json_body();
$config = gm_en_config();

$email = isset($input['email']) ? trim((string) $input['email']) : '';

// Same answer in every branch below. Built once, here, so a later edit cannot
// accidentally make one path distinguishable from another.
$sameAnswer = [
    'sent'    => true,
    'message' => 'If that address has a subscription with us, we have e-mailed you a link to manage it. The link is valid for one hour.',
];

if ('' === $email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    gm_en_json($sameAnswer);
}

// A crude per-address throttle. Without it this endpoint is a way to send
// somebody a lot of mail from our domain.
$lock = gm_en_log_dir() . '/.portal_link_' . substr(hash('sha256', strtolower($email)), 0, 16);
if (is_file($lock) && (time() - (int) file_get_contents($lock)) < 300) {
    gm_en_json($sameAnswer);
}
@file_put_contents($lock, (string) time());

$search = gm_en_stripe('GET', '/customers', ['email' => $email, 'limit' => 1]);
if (200 !== $search['status'] || empty($search['body']['data'][0]['id'])) {
    gm_en_json($sameAnswer);
}

$expires   = time() + 3600;
$signature = hash_hmac('sha256', strtolower($email) . '.' . $expires, $config['bridge_secret']);
$link      = 'https://ai-csapat.genmarketer.hu/en/manage/?email=' . rawurlencode($email)
    . '&expires=' . $expires . '&signature=' . $signature;

$body = "Hi,\n\n"
    . "Here is your link to manage your Your AI Team subscription. You can update your card,\n"
    . "download your invoices, or cancel — the change takes effect immediately.\n\n"
    . $link . "\n\n"
    . "The link stops working in one hour. If you did not ask for it, you can ignore this e-mail;\n"
    . "nothing has changed on your subscription.\n\n"
    . "— GENmarketer\n";

@mail(
    $email,
    'Manage your Your AI Team subscription',
    $body,
    "From: noreply@genmarketer.hu\r\nContent-Type: text/plain; charset=UTF-8\r\n"
);

gm_en_log('info', 'Portal link e-mailed', ['customer' => (string) $search['body']['data'][0]['id']]);

gm_en_json($sameAnswer);
