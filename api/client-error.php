<?php
/**
 * Browser-side JS error collection for the English landing (17/#3133).
 *
 * The logic lives in `_client-error.php`, SHARED with the Hungarian endpoint
 * (`hu-client-error.php`): the two differ only in the allowed origin and the
 * alert subject prefix. On `genmarketer.eu` the snapshot build rewrites
 * GM_EN_ALLOWED_ORIGIN to the .eu origin, so this endpoint only accepts the
 * English page there.
 */

declare(strict_types=1);

require __DIR__ . '/_lib.php';

$CE_ORIGIN  = GM_EN_ALLOWED_ORIGIN;
$CE_CHANNEL = 'EN';

require __DIR__ . '/_client-error.php';
