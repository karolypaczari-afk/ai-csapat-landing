<?php
/**
 * Managed AI team — interest capture (EN).
 * ---------------------------------------------------------------------------
 * This is NOT a checkout. The managed tier is sold through a conversation, so
 * the only job here is: validate → log → notify the operator → (optionally)
 * MailerLite → hand the browser a booking URL.
 *
 * ☠️ TWO OPPOSING PRINCIPLES, BOTH CORRECT — the same split as the
 *    `landing-kulcsrakesz/api/lead.php` this is ported from:
 *
 *  1. The INPUT is fail-closed: a missing/invalid field, a honeypot hit or a
 *     rate-limit → 400/429, and nothing is written anywhere.
 *  2. The CUSTOMER PATH is fail-open: if logging, mail or MailerLite falls
 *     over, that is OUR fault, not theirs — the confirmation still opens.
 *     Our own gate must never block the customer.
 *     (memory: customer_never_blocked_by_our_gate)
 *
 * The operator notification carries the FULL submission on purpose, so nobody
 * has to log in anywhere to read it (memory: operator_notification_full_content).
 *
 * Secrets come from the environment (host panel / .env), never from this file:
 *   GM_MANAGED_NOTIFY_TO        — operator recipient (default: info@genmarketer.hu)
 *   GM_MANAGED_MAILERLITE_KEY   — MailerLite API key (step skipped when absent)
 *   GM_MANAGED_MAILERLITE_GROUP — target group id (optional)
 *   GM_MANAGED_BOOKING_URL      — discovery call calendar
 */

declare(strict_types=1);

$BOOKING_URL = getenv('GM_MANAGED_BOOKING_URL') ?: 'https://tidycal.com/tibor-szantai/intro-meeting';
$LANG = 'en';

require __DIR__ . '/_managed-interest.php';
