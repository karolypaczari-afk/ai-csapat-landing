<?php
/**
 * Menedzselt AI-csapat — érdeklődés-fogadó végpont (HU).
 *
 * A logika a `_managed-interest.php`-ben él, KÖZÖSEN az angol párral: a két
 * nyelv csak az üzemeltetőnek szóló szövegekben és a naptár-URL-ben tér el.
 * Egy implementáció önmagától nem tud elcsúszni — a testvér-nyelvi drift itt
 * ismétlődő hibaosztály.
 *
 * Titkok környezeti változóból (a hoszton .env / panel), sosem a fájlból:
 *   GM_MANAGED_NOTIFY_TO · GM_MANAGED_MAILERLITE_KEY
 *   GM_MANAGED_MAILERLITE_GROUP · GM_MANAGED_BOOKING_URL
 */

declare(strict_types=1);

$BOOKING_URL = getenv('GM_MANAGED_BOOKING_URL') ?: 'https://tidycal.com/tibor-szantai/intro-meeting';
$LANG = 'hu';

require __DIR__ . '/_managed-interest.php';
