<?php
/**
 * Böngészőoldali JS-hibák gyűjtése a magyar landolóról (17/#3133).
 *
 * A logika a `_client-error.php`-ben él, KÖZÖSEN az angol párral
 * (`client-error.php`): a két belépő csak az engedett originben és a riasztás
 * tárgy-előtagjában tér el.
 */

declare(strict_types=1);

require __DIR__ . '/_hu-lib.php';

$CE_ORIGIN  = GM_HU_ALLOWED_ORIGIN;
$CE_CHANNEL = 'HU';

require __DIR__ . '/_client-error.php';
