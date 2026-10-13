<?php
/**
 * Böngészőoldali JS-hibák gyűjtése a magyar landolóról (17/#3133).
 *
 * Miért kell: a landoló minden szerveroldali hibája naplóba és riasztásba kerül,
 * de ami a VEVŐ BÖNGÉSZŐJÉBEN romlik el (egy kivétel az app.js-ben, egy le nem
 * töltődő vendor-fájl, egy elhaló 3D-hero), az eddig semmilyen naplóban nem
 * jelent meg. A CTA-mérés és az attribúció-továbbadás is a böngészőben fut —
 * ha az eltörik, a kampány „csak rosszabbul teljesít", és senki nem tudja, miért.
 *
 * Miért nem Sentry/GlitchTip: harmadik fél felé küldött hibaadat külön
 * adatkezelési és hozzájárulási kérdés, és a meglévő naplózás (_logs/,
 * gm_en_alert_admin) ezt már tudja. Saját domain, saját napló, nulla süti.
 *
 * Amit SZÁNDÉKOSAN NEM tárolunk: IP-cím, süti, űrlapérték, URL-paraméter (abban
 * click-ID és UTM utazik), e-mail-cím. A böngésző csak az útvonalat küldi, a
 * szerver az üzenetből is kitakarja az e-mail- és hosszú számsorozat-mintát.
 *
 * Korlátok, mind visszaélés ellen: 8 KB kérés, napi 2000 esemény összesen,
 * hibánként (ujjlenyomat) napi 20 naplósor, napi 10 riasztó levél. A válasz
 * mindig üres — a végpont semmit nem árul el a belső állapotáról. Az origin-kapu
 * csak a BÖNGÉSZŐT köti meg (curl-lel hamisítható); a nem-böngészős visszaélés
 * ellen a fenti korlátok védenek, ez a kettő együtt a szerződés.
 *
 * A `.eu` snapshotba nem kerül ki: a `deploy/build-eu-snapshot.mjs` minden `hu-*`
 * fájlt kiszűr az `api/`-ból. Ha mégis odajutna, az origin-kapu ott minden kérést
 * elutasít.
 */

declare(strict_types=1);

require __DIR__ . '/_hu-lib.php';

const GM_CE_MAX_BYTES        = 8192;
const GM_CE_DAILY_EVENTS     = 2000;
const GM_CE_PER_FP_LOG_LINES = 20;
const GM_CE_DAILY_ALERTS     = 10;
const GM_CE_SEEN_CAP         = 5000;
const GM_CE_RETENTION_DAYS   = 30;
const GM_CE_KINDS            = ['error', 'resource', 'rejection', 'caught'];

function gm_ce_done(int $status): void
{
    http_response_code($status);
    header('Cache-Control: no-store');
    exit;
}

function gm_ce_clip($value, int $max): string
{
    $s = is_scalar($value) ? (string) $value : '';
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s) ?? '';
    return mb_substr($s, 0, $max);
}

/** Személyes adatnak látszó minták ki — hibaüzenetbe kerülhet vevői bevitel. */
function gm_ce_scrub(string $s): string
{
    $s = preg_replace('/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i', '[email]', $s) ?? '';
    return preg_replace('/\d{7,}/', '[n]', $s) ?? '';
}

/** Csak az útvonal marad: a query-ben click-ID és UTM utazik. */
function gm_ce_path(string $s): string
{
    return (string) preg_replace('/[?#][^\s)]*/', '', $s);
}

/**
 * Szabad szövegben (üzenet, verem) csak az URL-ek query-részét vágjuk le — egy
 * hibaüzenet idézheti a kért URL-t (`fetch(https://…?gclid=…) failed`), de egy
 * mondatvégi kérdőjel nem URL.
 */
function gm_ce_strip_url_queries(string $s): string
{
    return (string) preg_replace('~((?:https?:)?//[^\s?#"\'()]*)[?#][^\s"\'()]*~i', '$1', $s);
}

/** A számok normalizálva: ugyanaz a hiba más sorszámmal/azonosítóval egy ujjlenyomat. */
function gm_ce_fingerprint(array $e): string
{
    $msg = preg_replace('/\d+/', '0', $e['message']) ?? '';
    return substr(sha1($e['kind'] . '|' . $msg . '|' . $e['source'] . '|' . $e['line']), 0, 12);
}

/**
 * Olvas-módosít-ír egy JSON állapotfájlon, kizárólagos zár alatt. Ha a fájl
 * sérült, üres állapotból indul — a számláló elvesztése kisebb baj, mint egy
 * örökre beragadt végpont.
 */
function gm_ce_locked_update(string $path, callable $fn)
{
    $fh = @fopen($path, 'c+');
    if (false === $fh) {
        gm_en_log('error', 'client-error: állapotfájl nem nyitható', ['file' => basename($path)]);
        return null;
    }
    if (!flock($fh, LOCK_EX)) {
        fclose($fh);
        gm_en_log('error', 'client-error: állapotfájl nem zárolható', ['file' => basename($path)]);
        return null;
    }
    $raw   = stream_get_contents($fh);
    $state = json_decode((string) $raw, true);
    if (!is_array($state)) {
        $state = [];
    }
    [$state, $result] = $fn($state);
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($state, JSON_UNESCAPED_SLASHES));
    fflush($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
    return $result;
}

function gm_ce_prune(string $dir): void
{
    $limit = time() - GM_CE_RETENTION_DAYS * 86400;
    foreach ((array) glob($dir . '/client-errors-*') as $file) {
        if (is_file($file) && filemtime($file) < $limit) {
            @unlink($file);
        }
    }
}

// ── Kérés-kapuk ─────────────────────────────────────────────────────────────

if ('POST' !== ($_SERVER['REQUEST_METHOD'] ?? '')) {
    header('Allow: POST');
    gm_ce_done(405);
}

$origin  = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
$referer = (string) ($_SERVER['HTTP_REFERER'] ?? '');
$fromUs  = '' !== $origin
    ? GM_HU_ALLOWED_ORIGIN === $origin
    : 0 === strpos($referer, GM_HU_ALLOWED_ORIGIN . '/');
if (!$fromUs) {
    gm_ce_done(403);
}

$raw = file_get_contents('php://input', false, null, 0, GM_CE_MAX_BYTES + 1);
if (false === $raw || '' === $raw) {
    gm_ce_done(400);
}
if (strlen($raw) > GM_CE_MAX_BYTES) {
    gm_ce_done(413);
}
$in = json_decode($raw, true);
if (!is_array($in) || !in_array($in['kind'] ?? null, GM_CE_KINDS, true)) {
    gm_ce_done(400);
}

$event = [
    'kind'    => (string) $in['kind'],
    'message' => gm_ce_scrub(gm_ce_strip_url_queries(gm_ce_clip($in['message'] ?? '', 300))),
    'source'  => gm_ce_path(gm_ce_clip($in['source'] ?? '', 200)),
    'line'    => max(0, (int) ($in['line'] ?? 0)),
    'col'     => max(0, (int) ($in['col'] ?? 0)),
    'page'    => gm_ce_path(gm_ce_clip($in['page'] ?? '', 200)),
    'stack'   => gm_ce_scrub(gm_ce_strip_url_queries(gm_ce_clip($in['stack'] ?? '', 1500))),
    'ua'      => gm_ce_clip($_SERVER['HTTP_USER_AGENT'] ?? '', 160),
];
$fp  = gm_ce_fingerprint($event);
$dir = gm_en_log_dir();
$day = gmdate('Y-m-d');

if (0 === random_int(0, 49)) {
    gm_ce_prune($dir);
}

// ── Napi kvóta + ujjlenyomatonkénti számláló ────────────────────────────────

$verdict = gm_ce_locked_update($dir . "/client-errors-$day.json", static function (array $s) use ($fp): array {
    $s['total']   = (int) ($s['total'] ?? 0);
    $s['dropped'] = (int) ($s['dropped'] ?? 0);
    $s['fp']      = is_array($s['fp'] ?? null) ? $s['fp'] : [];
    if ($s['total'] >= GM_CE_DAILY_EVENTS) {
        $s['dropped']++;
        return [$s, 'drop'];
    }
    $s['total']++;
    $s['fp'][$fp] = (int) ($s['fp'][$fp] ?? 0) + 1;
    return [$s, $s['fp'][$fp] <= GM_CE_PER_FP_LOG_LINES ? 'log' : 'count'];
});

if ('log' === $verdict) {
    $line = json_encode(['ts' => gmdate('c'), 'fp' => $fp] + $event, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (false === @file_put_contents($dir . "/client-errors-$day.log", $line . "\n", FILE_APPEND | LOCK_EX)) {
        gm_en_log('error', 'client-error: naplósor nem írható', ['fp' => $fp]);
    }
}

// ── Riasztás: csak ÚJ hibafajtára, napi plafonnal ───────────────────────────

// A riasztó a _secrets.php-ból olvassa a címzettet; hiányzó config mellett a
// gm_en_config() 500-zal kilépne. Ilyenkor a hibafajtát NEM jelöljük látottnak,
// különben a config pótlása után sem jönne róla levél.
$canAlert = is_readable(__DIR__ . '/_secrets.php');

if ('drop' !== $verdict && $canAlert) {
    $isNew = gm_ce_locked_update($dir . '/client-errors-seen.json', static function (array $s) use ($fp, $day): array {
        $s['fp']     = is_array($s['fp'] ?? null) ? $s['fp'] : [];
        $s['alerts'] = is_array($s['alerts'] ?? null) ? $s['alerts'] : [];
        // A megőrzési időn túli hibafajta újra „új”: enélkül a látott halmaz a
        // plafonig hízna, és utána egyetlen új hiba sem kapna riasztást.
        $cutoff  = gmdate('Y-m-d', time() - GM_CE_RETENTION_DAYS * 86400);
        $s['fp'] = array_filter($s['fp'], static fn ($d) => is_string($d) && $d >= $cutoff);
        if (isset($s['fp'][$fp]) || count($s['fp']) >= GM_CE_SEEN_CAP) {
            return [$s, false];
        }
        $s['fp'][$fp] = $day;
        $sentToday    = (int) ($s['alerts'][$day] ?? 0);
        if ($sentToday >= GM_CE_DAILY_ALERTS) {
            return [$s, false];
        }
        $s['alerts'] = [$day => $sentToday + 1];
        return [$s, true];
    });

    if (true === $isNew) {
        gm_en_alert_admin(
            'HU landoló: új böngészőhiba (' . $fp . ')',
            "Új hibafajta a landolón, első előfordulás.\n\n"
            . "Típus:   {$event['kind']}\n"
            . "Üzenet:  {$event['message']}\n"
            . "Forrás:  {$event['source']}:{$event['line']}:{$event['col']}\n"
            . "Oldal:   {$event['page']}\n"
            . "Böngésző: {$event['ua']}\n\n"
            . "Verem:\n{$event['stack']}\n\n"
            . "Napló: api/_logs/client-errors-$day.log (fp=$fp)\n"
        );
    }
}

gm_ce_done(204);
