<?php
/** Session tokens (signed HMAC) + current-user resolution. */

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/http.php';

function app_secret(): string
{
    $cfg = require __DIR__ . '/../config.php';
    return $cfg['app_secret'];
}

function b64url_encode(string $s): string
{
    return rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
}

function b64url_decode(string $s): string
{
    return base64_decode(strtr($s, '-_', '+/'));
}

/** Issue a stateless signed token: base64(payload).signature */
function issue_token(int $userId): string
{
    $cfg = require __DIR__ . '/../config.php';
    $exp = time() + ($cfg['session_ttl_days'] * 86400);
    $payload = json_encode(['uid' => $userId, 'exp' => $exp]);
    $p = b64url_encode($payload);
    $sig = b64url_encode(hash_hmac('sha256', $p, app_secret(), true));
    return "$p.$sig";
}

/** Verify a token and return the user id, or null if invalid/expired. */
function token_user_id(?string $token): ?int
{
    if (!$token || !str_contains($token, '.')) return null;
    [$p, $sig] = explode('.', $token, 2);
    $expected = b64url_encode(hash_hmac('sha256', $p, app_secret(), true));
    if (!hash_equals($expected, $sig)) return null;
    $data = json_decode(b64url_decode($p), true);
    if (!is_array($data) || ($data['exp'] ?? 0) < time()) return null;
    return (int) $data['uid'];
}

/** Read the bearer token from the Authorization header. */
function bearer_token(): ?string
{
    $hdr = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!$hdr && function_exists('apache_request_headers')) {
        $h = apache_request_headers();
        $hdr = $h['Authorization'] ?? $h['authorization'] ?? '';
    }
    if (preg_match('/Bearer\s+(.+)/i', $hdr, $m)) return trim($m[1]);
    return null;
}

/** Require an authenticated user; aborts with 401 otherwise. Returns user row. */
function require_user(): array
{
    $uid = token_user_id(bearer_token());
    if (!$uid) fail('Not authenticated', 401);
    $user = q1('SELECT * FROM users WHERE id = ?', [$uid]);
    if (!$user) fail('Not authenticated', 401);
    return $user;
}
