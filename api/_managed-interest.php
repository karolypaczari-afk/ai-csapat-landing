<?php
/**
 * Shared implementation behind `managed-interest.php` (EN) and
 * `hu-managed-interest.php` (HU). The two endpoints differ ONLY in the
 * operator-facing strings and the booking URL, so the logic lives once.
 *
 * Why shared and not copied: sibling-language drift is a repeated failure here
 * — a fix lands on one language and silently misses the other. One
 * implementation cannot drift from itself.
 *
 * Expects the including file to define: $BOOKING_URL (string), $LANG ('en'|'hu').
 */

declare(strict_types=1);

if (!isset($BOOKING_URL, $LANG)) {
    http_response_code(500);
    exit('misconfigured endpoint');
}

$T = 'hu' === $LANG ? [
    'method'    => 'Csak POST.',
    'missing'   => 'Hiányzó mező: ',
    'email'     => 'Érvénytelen e-mail-cím.',
    'rate'      => 'Túl sok beküldés egy óra alatt. Kérlek, próbáld később.',
    'subject'   => 'Menedzselt AI-csapat — érdeklődés: ',
    'intro'     => 'Új érdeklődés a menedzselt AI-csapat iránt (magyar landoló).',
    'f_company' => 'Cég / weboldal',
    'f_size'    => 'Csapatméret',
    'f_goal'    => 'Mit venne le a válláról',
    'f_email'   => 'E-mail',
    'received'  => 'Beérkezett',
    'thanks'    => 'Köszönjük — a következő lépés: ',
] : [
    'method'    => 'POST only.',
    'missing'   => 'Missing field: ',
    'email'     => 'Invalid email address.',
    'rate'      => 'Too many submissions in one hour. Please try again later.',
    'subject'   => 'Managed AI team — interest: ',
    'intro'     => 'New interest in the managed AI team (English landing).',
    'f_company' => 'Company / website',
    'f_size'    => 'Team size',
    'f_goal'    => 'What they want it to take over',
    'f_email'   => 'Email',
    'received'  => 'Received',
    'thanks'    => 'Thanks — next step: ',
];

function gm_mi_fail(int $code, string $msg): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    gm_mi_fail(405, $T['method']);
}

/* 1) Honeypot - a real visitor never fills this. Silent 204: a bot learns nothing. */
if (trim((string) ($_POST['website_url'] ?? '')) !== '') {
    http_response_code(204);
    exit;
}

/* 2) File-based rate limit: 5 submissions per IP per hour. */
$ip  = (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
$dir = sys_get_temp_dir() . '/gm-managed-rate';
@mkdir($dir, 0700, true);
$bucket = $dir . '/' . sha1($ip) . '.txt';
$now    = time();
$hits   = [];
if (is_readable($bucket)) {
    $raw  = (string) @file_get_contents($bucket);
    $hits = array_values(array_filter(
        array_map('intval', explode(',', $raw)),
        static fn($t) => $t > $now - 3600
    ));
}
if (count($hits) >= 5) {
    gm_mi_fail(429, $T['rate']);
}
$hits[] = $now;
@file_put_contents($bucket, implode(',', $hits), LOCK_EX);

/* 3) Validation - fail-closed. */
$field = static function (string $k, int $max = 500): string {
    $v = (string) ($_POST[$k] ?? '');
    $v = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $v) ?? '');
    return mb_substr($v, 0, $max);
};

$lead = [
    'company'   => $field('company', 200),
    'team_size' => $field('team_size', 40),
    'goal'      => $field('goal', 2000),
    'email'     => $field('email', 190),
];
foreach (['company', 'team_size', 'goal', 'email'] as $req) {
    if ('' === $lead[$req]) {
        gm_mi_fail(400, $T['missing'] . $req);
    }
}
if (!filter_var($lead['email'], FILTER_VALIDATE_EMAIL)) {
    gm_mi_fail(400, $T['email']);
}

$lead['lang']    = $LANG;
$lead['ts']      = gmdate('c');
$lead['ip_hash'] = substr(hash('sha256', $ip . '|gm-managed'), 0, 16); // raw IP is never stored
$lead['ua']      = mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 300);
$lead['ref']     = mb_substr((string) ($_SERVER['HTTP_REFERER'] ?? ''), 0, 300);

/* From here EVERY step is fail-open: our failure must not block the customer. */

/* 4) JSONL log, denied to the web (it holds customer e-mail addresses). */
try {
    $logDir = __DIR__ . '/_leads';
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0700, true);
    }
    @file_put_contents($logDir . '/.htaccess', "Require all denied\n");
    @file_put_contents(
        $logDir . '/managed-' . gmdate('Y-m') . '.jsonl',
        json_encode($lead, JSON_UNESCAPED_UNICODE) . "\n",
        FILE_APPEND | LOCK_EX
    );
} catch (\Throwable $e) { /* silent: does not touch the customer path */ }

/* 5) Operator notification - the FULL submission, so nothing must be looked up. */
try {
    $to   = getenv('GM_MANAGED_NOTIFY_TO') ?: 'info@genmarketer.hu';
    $body = $T['intro'] . "\n\n"
          . $T['f_company'] . ': ' . $lead['company'] . "\n"
          . $T['f_size'] . ': ' . $lead['team_size'] . "\n"
          . $T['f_email'] . ': ' . $lead['email'] . "\n\n"
          . $T['f_goal'] . ":\n" . $lead['goal'] . "\n\n"
          . $T['received'] . ': ' . $lead['ts'] . " (UTC)\n";
    @mail($to, $T['subject'] . $lead['company'], $body, implode("\r\n", [
        'From: GENmarketer <no-reply@genmarketer.hu>',
        'Reply-To: ' . $lead['email'],
        'Content-Type: text/plain; charset=UTF-8',
    ]));
} catch (\Throwable $e) { /* silent */ }

/* 6) MailerLite - only when the key is actually present. No key is NOT an error. */
try {
    $mlKey = getenv('GM_MANAGED_MAILERLITE_KEY');
    if ($mlKey) {
        $payload = [
            'email'  => $lead['email'],
            'fields' => [
                'company'              => $lead['company'],
                'gm_managed_team_size' => $lead['team_size'],
                'gm_managed_goal'      => mb_substr($lead['goal'], 0, 500),
                'gm_managed_lang'      => $LANG,
            ],
        ];
        $group = getenv('GM_MANAGED_MAILERLITE_GROUP');
        if ($group) {
            $payload['groups'] = [$group];
        }

        $ch = curl_init('https://connect.mailerlite.com/api/subscribers');
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 8,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'Accept: application/json',
                'Authorization: Bearer ' . $mlKey,
            ],
            CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
        ]);
        curl_exec($ch);
        curl_close($ch);
    }
} catch (\Throwable $e) { /* silent */ }

/* 7) Done. The JS renders the confirmation; the 302 serves the no-JS path. */
$wantsJson = str_contains((string) ($_SERVER['HTTP_ACCEPT'] ?? ''), 'application/json')
          || strtolower((string) ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '')) === 'fetch';

if ($wantsJson) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => true, 'booking_url' => $BOOKING_URL], JSON_UNESCAPED_UNICODE);
    exit;
}
header('Location: ' . $BOOKING_URL, true, 302);
echo $T['thanks'] . htmlspecialchars($BOOKING_URL, ENT_QUOTES, 'UTF-8');
