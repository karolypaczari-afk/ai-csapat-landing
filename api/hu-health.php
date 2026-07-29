<?php
/**
 * One request that answers "vásárolhat most valaki a magyar pénztárban?".
 *
 * Checks the four things that can independently break this funnel: the config
 * file, Stripe, the WordPress bridge, and the funnel's own open/closed switch.
 * Unauthenticated but detail-free — pass/fail only, never a key or an id.
 *
 * The `open` flag is what the checkout page reads to decide whether to show
 * the preview banner instead of a pay button, so it is reported even when
 * everything else is healthy.
 */

declare(strict_types=1);

require __DIR__ . '/_hu-lib.php';

$checks = [];
$ok = true;

$configOk = is_readable(__DIR__ . '/_secrets.php');
$checks['config'] = $configOk ? 'ok' : 'missing';
$ok = $ok && $configOk;

$open = false;

if ($configOk) {
    $config = gm_en_config();
    $checks['mode'] = $config['mode'];
    $checks['hu_configured'] = !empty($config['hu_bridge_url']) && !empty($config['hu_bridge_secret']);
    $ok = $ok && $checks['hu_configured'];

    $account = gm_en_stripe('GET', '/account');
    $stripeOk = 200 === $account['status'];
    $checks['stripe'] = $stripeOk ? 'ok' : 'fail';
    if ($stripeOk) {
        $checks['stripe_account']  = (string) ($account['body']['business_profile']['name'] ?? '');
        $checks['charges_enabled'] = !empty($account['body']['charges_enabled']);
        $ok = $ok && !empty($account['body']['charges_enabled']);
    } else {
        $ok = false;
    }

    if (!empty($checks['hu_configured'])) {
        $bridge = gm_hu_call_bridge([], 'health');
        $bridgeOk = $bridge['success'] && !empty($bridge['body']['ok']);
        $checks['bridge'] = $bridgeOk ? 'ok' : ('fail (' . $bridge['status'] . ')');
        $ok = $ok && $bridgeOk;

        $state = gm_hu_funnel_state();
        $open = $state['open'];
        $checks['funnel_open'] = $open;
        if (!$open && '' !== $state['reason']) {
            $checks['closed_reason'] = $state['reason'];
        }
    } else {
        $checks['bridge'] = 'skipped';
    }
}

gm_en_json(
    [
        // `ok` means "the plumbing is healthy", `open` means "selling is switched
        // on". They are independent on purpose: a healthy but deliberately
        // closed funnel is the normal pre-launch state, not a fault.
        'ok'      => $ok,
        'open'    => $open,
        'version' => GM_EN_API_VERSION,
        'checks'  => $checks,
        'time'    => gmdate('c'),
    ],
    $ok ? 200 : 503
);
